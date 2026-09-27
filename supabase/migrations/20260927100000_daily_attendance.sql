create table public.bk_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  attendance_date date not null,
  status text not null check (status in ('Hadir','Izin','Sakit','Alpa')),
  notes text not null default '',
  counselor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_id,school_id) references public.students(id,school_id),
  unique (student_id,attendance_date)
);

create index bk_attendance_school_date on public.bk_attendance(school_id,attendance_date desc);
alter table public.bk_attendance enable row level security;

create policy attendance_read on public.bk_attendance for select to authenticated using (
  exists(select 1 from public.memberships m where m.school_id=bk_attendance.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor'))
);
create policy attendance_insert on public.bk_attendance for insert to authenticated with check (
  counselor_id=(select auth.uid()) and exists(select 1 from public.memberships m where m.school_id=bk_attendance.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor'))
);
create policy attendance_update on public.bk_attendance for update to authenticated using (
  counselor_id=(select auth.uid()) and exists(select 1 from public.memberships m where m.school_id=bk_attendance.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor'))
) with check (
  counselor_id=(select auth.uid()) and exists(select 1 from public.memberships m where m.school_id=bk_attendance.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor'))
);

grant select,insert,update on public.bk_attendance to authenticated;

create trigger audit_attendance after insert or update on public.bk_attendance
for each row execute function private.log_bk_change();
