-- Permanent removal is limited to authorized BK staff and retains action-only audit events.
alter table public.bk_cases drop constraint bk_cases_student_id_school_id_fkey;
alter table public.bk_cases add constraint bk_cases_student_id_school_id_fkey
  foreign key (student_id,school_id) references public.students(id,school_id) on delete cascade;

alter table public.bk_records drop constraint bk_records_student_id_school_id_fkey;
alter table public.bk_records add constraint bk_records_student_id_school_id_fkey
  foreign key (student_id,school_id) references public.students(id,school_id) on delete cascade;
alter table public.bk_records drop constraint bk_records_case_id_school_id_student_id_fkey;
alter table public.bk_records add constraint bk_records_case_id_school_id_student_id_fkey
  foreign key (case_id,school_id,student_id) references public.bk_cases(id,school_id,student_id) on delete cascade;

alter table public.bk_attendance drop constraint bk_attendance_student_id_school_id_fkey;
alter table public.bk_attendance add constraint bk_attendance_student_id_school_id_fkey
  foreign key (student_id,school_id) references public.students(id,school_id) on delete cascade;

create policy student_delete on public.students for delete to authenticated using (
  exists(select 1 from public.memberships m where m.school_id=students.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor'))
);
grant delete on public.students to authenticated;

create trigger audit_student_delete after delete on public.students for each row execute function private.log_bk_change();
create trigger audit_case_delete after delete on public.bk_cases for each row execute function private.log_bk_change();
create trigger audit_record_delete after delete on public.bk_records for each row execute function private.log_bk_change();
create trigger audit_attendance_delete after delete on public.bk_attendance for each row execute function private.log_bk_change();
