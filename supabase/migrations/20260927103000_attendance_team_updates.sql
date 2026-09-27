drop policy attendance_update on public.bk_attendance;
create policy attendance_update on public.bk_attendance for update to authenticated using (
  exists(select 1 from public.memberships m where m.school_id=bk_attendance.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor'))
) with check (
  counselor_id=(select auth.uid()) and exists(select 1 from public.memberships m where m.school_id=bk_attendance.school_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','counselor'))
);
