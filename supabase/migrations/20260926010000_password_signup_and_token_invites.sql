-- Public email registration uses a narrow Edge Function. Staff access requires
-- possession of a one-time invitation token, never an unverified email alone.
alter table public.invitations add column token_hash text unique;
alter table public.invitations add constraint invitation_token_hash_length check (token_hash is null or length(token_hash)=64);

drop policy membership_join on public.memberships;
create policy membership_owner_create on public.memberships for insert to authenticated with check (
  user_id=(select auth.uid()) and role='owner' and
  exists(select 1 from public.schools s where s.id=school_id and s.owner_id=(select auth.uid()))
);
drop policy invite_read on public.invitations;
create policy invite_admin_read on public.invitations for select to authenticated using (
  exists(select 1 from public.memberships m where m.school_id=invitations.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
);
drop policy invite_accept on public.invitations;
revoke update(accepted_at) on public.invitations from authenticated;

create or replace function public.claim_bk_invitation(p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare matched public.invitations%rowtype;
begin
  if auth.uid() is null or length(p_token) < 32 then return false; end if;
  select * into matched from public.invitations
  where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and accepted_at is null
  for update;
  if not found then return false; end if;
  if lower(matched.email)<>lower(auth.jwt()->>'email') then return false; end if;
  insert into public.memberships(school_id,user_id,role,display_name)
  values(matched.school_id,auth.uid(),matched.role,split_part(matched.email,'@',1));
  update public.invitations set accepted_at=now() where id=matched.id;
  return true;
end $$;
revoke all on function public.claim_bk_invitation(text) from public,anon;
grant execute on function public.claim_bk_invitation(text) to authenticated;

create table private.bk_signup_limits (
  key text not null,
  hour_bucket timestamptz not null,
  attempts integer not null,
  primary key(key,hour_bucket)
);
alter table private.bk_signup_limits enable row level security;
create or replace function public.allow_bk_signup(p_key text,p_limit integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare attempts_now integer;
begin
  if p_limit<1 or p_limit>100 or length(p_key)>128 then return false; end if;
  insert into private.bk_signup_limits(key,hour_bucket,attempts)
  values(p_key,date_trunc('hour',now()),1)
  on conflict(key,hour_bucket) do update set attempts=private.bk_signup_limits.attempts+1
  returning attempts into attempts_now;
  return attempts_now<=p_limit;
end $$;
revoke all on function public.allow_bk_signup(text,integer) from public,anon,authenticated;
grant execute on function public.allow_bk_signup(text,integer) to service_role;
