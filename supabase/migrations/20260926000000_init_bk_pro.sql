-- Bantu Beres BK Pro. Run once on a dedicated Supabase project.
create extension if not exists pgcrypto;

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 3 and 160),
  academic_year text not null default '2026/2027',
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.memberships (
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','counselor','principal')),
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (school_id,user_id)
);
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','counselor','principal')),
  invited_by uuid not null references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (school_id,email)
);
create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  nis text not null,
  name text not null,
  class_name text not null,
  gender text not null default 'L' check (gender in ('L','P')),
  guardian_name text not null default '',
  guardian_phone text not null default '',
  counselor_id uuid references auth.users(id),
  status text not null default 'Aktif' check (status in ('Aktif','Arsip')),
  created_at timestamptz not null default now(),
  unique (school_id,nis),
  unique (id,school_id)
);
create table public.bk_cases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  counselor_id uuid not null references auth.users(id),
  code text not null,
  opened_on date not null,
  domain text not null check (domain in ('Pribadi','Sosial','Belajar','Karier')),
  topic text not null,
  priority text not null default 'Sedang',
  source text not null default '',
  status text not null default 'Baru',
  summary text not null default '',
  next_on date,
  created_at timestamptz not null default now(),
  foreign key (student_id,school_id) references public.students(id,school_id),
  unique (school_id,code),
  unique (id,school_id,student_id)
);
create table public.bk_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid,
  case_id uuid,
  counselor_id uuid not null references auth.users(id),
  kind text not null check (kind in ('need','counseling','group','classical','rpl','program','agenda','followup','visit','referral','career','document')),
  happened_on date not null,
  title text not null,
  domain text not null default 'Pribadi',
  status text not null default 'Terencana',
  notes text not null default '',
  confidential boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (student_id,school_id) references public.students(id,school_id),
  foreign key (case_id,school_id,student_id) references public.bk_cases(id,school_id,student_id),
  constraint confidential_session check (kind not in ('counseling','visit') or confidential)
);
create index students_school_class on public.students(school_id,class_name);
create index cases_school_status on public.bk_cases(school_id,status,opened_on desc);
create index records_school_kind_date on public.bk_records(school_id,kind,happened_on desc);
create index invitations_email on public.invitations(email) where accepted_at is null;

alter table public.schools enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.students enable row level security;
alter table public.bk_cases enable row level security;
alter table public.bk_records enable row level security;

-- Membership reads are self-only, avoiding recursive policies on the membership table.
create policy membership_read on public.memberships for select to authenticated using (user_id=(select auth.uid()));
create policy membership_join on public.memberships for insert to authenticated with check (
  user_id=(select auth.uid()) and (
    (role='owner' and exists(select 1 from public.schools s where s.id=school_id and s.owner_id=(select auth.uid())))
    or exists(select 1 from public.invitations i where i.school_id=memberships.school_id and i.role=memberships.role and lower(i.email)=lower((select auth.jwt()->>'email')) and i.accepted_at is null)
  )
);
create policy school_read on public.schools for select to authenticated using (
  owner_id=(select auth.uid()) or exists(select 1 from public.memberships m where m.school_id=id and m.user_id=(select auth.uid()))
);
create policy school_create on public.schools for insert to authenticated with check (owner_id=(select auth.uid()));
create policy school_edit on public.schools for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));

create policy invite_read on public.invitations for select to authenticated using (
  lower(email)=lower((select auth.jwt()->>'email')) or exists(select 1 from public.memberships m where m.school_id=invitations.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
);
create policy invite_create on public.invitations for insert to authenticated with check (
  invited_by=(select auth.uid()) and exists(select 1 from public.memberships m where m.school_id=invitations.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
);
create policy invite_accept on public.invitations for update to authenticated using (
  lower(email)=lower((select auth.jwt()->>'email')) and accepted_at is null
) with check (lower(email)=lower((select auth.jwt()->>'email')) and accepted_at is not null);

create policy student_read on public.students for select to authenticated using (
  exists(select 1 from public.memberships m where m.school_id=students.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor'))
);
create policy student_insert on public.students for insert to authenticated with check (
  exists(select 1 from public.memberships m where m.school_id=students.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor'))
);
create policy student_update on public.students for update to authenticated using (
  exists(select 1 from public.memberships m where m.school_id=students.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor'))
) with check (exists(select 1 from public.memberships m where m.school_id=students.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor')));

create policy case_read on public.bk_cases for select to authenticated using (
  counselor_id=(select auth.uid()) or exists(select 1 from public.memberships m where m.school_id=bk_cases.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor'))
);
create policy case_insert on public.bk_cases for insert to authenticated with check (
  counselor_id=(select auth.uid()) and exists(select 1 from public.memberships m where m.school_id=bk_cases.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor'))
);
create policy case_update on public.bk_cases for update to authenticated using (
  counselor_id=(select auth.uid())
) with check (counselor_id=(select auth.uid()) and exists(select 1 from public.memberships m where m.school_id=bk_cases.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor')));

create policy record_read on public.bk_records for select to authenticated using (
  counselor_id=(select auth.uid()) or (not confidential and exists(select 1 from public.memberships m where m.school_id=bk_records.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor')))
);
create policy record_insert on public.bk_records for insert to authenticated with check (
  counselor_id=(select auth.uid()) and exists(select 1 from public.memberships m where m.school_id=bk_records.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor'))
);
create policy record_update on public.bk_records for update to authenticated using (
  counselor_id=(select auth.uid())
) with check (counselor_id=(select auth.uid()) and exists(select 1 from public.memberships m where m.school_id=bk_records.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor')));

-- API exposure is explicit on new Supabase projects. No anonymous access to school data.
grant usage on schema public to authenticated;
grant select,insert,update on public.schools,public.memberships,public.students,public.bk_cases,public.bk_records to authenticated;
grant select,insert on public.invitations to authenticated;
grant update(accepted_at) on public.invitations to authenticated;

-- Principal reporting is aggregate only; validate school membership in every invocation.
create or replace function public.bk_school_report(p_school uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.memberships where school_id=p_school and user_id=auth.uid()) then
    raise exception 'School access denied';
  end if;
  select jsonb_build_object(
    'students',(select count(*) from public.students where school_id=p_school and status='Aktif'),
    'cases',(select count(*) from public.bk_cases where school_id=p_school),
    'completed',(select count(*) from public.bk_cases where school_id=p_school and status='Selesai'),
    'sessions',(select count(*) from public.bk_records where school_id=p_school and kind='counseling'),
    'services',(select count(*) from public.bk_records where school_id=p_school),
    'domains',(select coalesce(jsonb_object_agg(domain,n), '{}'::jsonb) from (select domain,count(*) n from public.bk_cases where school_id=p_school group by domain) d)
  ) into result;
  return result;
end $$;
revoke all on function public.bk_school_report(uuid) from public,anon;
grant execute on function public.bk_school_report(uuid) to authenticated;

-- An audit trail stores action metadata only; confidential notes are never copied.
create schema if not exists private;
create table private.bk_audit_events (
  id bigint generated always as identity primary key,
  school_id uuid not null,
  actor_id uuid,
  entity text not null,
  entity_id uuid not null,
  action text not null,
  happened_at timestamptz not null default now()
);
create index audit_school_date on private.bk_audit_events(school_id,happened_at desc);
alter table private.bk_audit_events enable row level security;
create or replace function private.log_bk_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare row_data jsonb;
begin
  if tg_op='DELETE' then row_data := to_jsonb(old);
  else row_data := to_jsonb(new); end if;
  insert into private.bk_audit_events(school_id,actor_id,entity,entity_id,action)
  values ((row_data->>'school_id')::uuid,auth.uid(),tg_table_name,(row_data->>'id')::uuid,tg_op);
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.log_bk_change() from public,anon,authenticated;
create trigger audit_student after insert or update on public.students for each row execute function private.log_bk_change();
create trigger audit_case after insert or update on public.bk_cases for each row execute function private.log_bk_change();
create trigger audit_record after insert or update on public.bk_records for each row execute function private.log_bk_change();
