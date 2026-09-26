-- Restrict case and record reads to CURRENT school members; revocation takes effect immediately.
-- Principals remain aggregate-only through bk_school_report.
drop policy if exists case_read on public.bk_cases;
create policy case_read on public.bk_cases for select to authenticated using (
  exists (
    select 1 from public.memberships m
    where m.school_id=bk_cases.school_id
      and m.user_id=(select auth.uid())
      and m.role in ('owner','admin','counselor')
      and (bk_cases.counselor_id=(select auth.uid()) or m.role in ('owner','admin'))
  )
);
drop policy if exists record_read on public.bk_records;
create policy record_read on public.bk_records for select to authenticated using (
  exists (
    select 1 from public.memberships m
    where m.school_id=bk_records.school_id
      and m.user_id=(select auth.uid())
      and m.role in ('owner','admin','counselor')
      and (bk_records.counselor_id=(select auth.uid()) or not bk_records.confidential)
  )
);

-- Creating a school and its owner membership is atomic, avoiding orphan workspaces.
create or replace function public.create_bk_school(p_name text,p_academic_year text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_school uuid;
begin
 if auth.uid() is null then raise exception 'Login diperlukan'; end if;
 if length(trim(coalesce(p_name,''))) not between 3 and 160 then raise exception 'Nama sekolah harus 3-160 karakter'; end if;
 if length(trim(coalesce(p_academic_year,''))) not between 4 and 24 then raise exception 'Tahun ajaran tidak valid'; end if;
 if exists (select 1 from public.memberships where user_id=(select auth.uid())) then
   raise exception 'Akun sudah terhubung ke ruang kerja sekolah';
 end if;
 insert into public.schools(name,academic_year,owner_id)
 values(trim(p_name),trim(p_academic_year),(select auth.uid())) returning id into v_school;
 insert into public.memberships(school_id,user_id,role,display_name)
 values(v_school,(select auth.uid()),'owner',split_part(coalesce((select auth.jwt()->>'email'),'Admin'),'@',1));
 return v_school;
end $$;
revoke all on function public.create_bk_school(text,text) from public,anon;
grant execute on function public.create_bk_school(text,text) to authenticated;
