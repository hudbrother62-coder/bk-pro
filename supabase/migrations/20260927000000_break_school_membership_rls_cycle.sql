-- Break the schools <-> memberships RLS dependency at first workspace creation.
create or replace function public.bk_is_school_owner(p_school uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.schools
    where id = p_school and owner_id = (select auth.uid())
  );
$$;
create or replace function public.bk_is_school_member(p_school uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships
    where school_id = p_school and user_id = (select auth.uid())
  );
$$;
revoke all on function public.bk_is_school_owner(uuid), public.bk_is_school_member(uuid) from public, anon;
grant execute on function public.bk_is_school_owner(uuid), public.bk_is_school_member(uuid) to authenticated;
drop policy if exists membership_owner_create on public.memberships;
create policy membership_owner_create on public.memberships for insert to authenticated
with check (user_id = (select auth.uid()) and role = 'owner' and public.bk_is_school_owner(school_id));
drop policy if exists school_read on public.schools;
create policy school_read on public.schools for select to authenticated
using (owner_id = (select auth.uid()) or public.bk_is_school_member(id));
