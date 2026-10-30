-- 관리자 비밀번호 바꾸기
-- Supabase 대시보드 → SQL Editor에서 실행한다. 비밀번호를 또 바꿀 때도 이 파일을 다시 쓰면 된다.
-- 실행 전에 아래 '여기에_새_비밀번호'를 새 비밀번호로 바꾼다. (새 비밀번호를 넣은 채로 이 파일을 커밋하지 말 것)
--
-- 비밀번호는 함수 안에 글자 그대로 두지 않고, admin_secret 표에 bcrypt 해시로만 저장한다.
-- 모든 admin_* 함수는 admin_profile_count(p_password)로 비밀번호를 확인하므로, 그 함수 하나만 바꾸면 전부 새 비밀번호를 쓴다.
-- 혹시 admin_profile_count를 거치지 않고 비밀번호를 직접 비교하는 admin_* 함수가 있으면,
-- 맨 위 점검에서 오류를 내고 아무것도 바꾸지 않는다 (그 함수 이름이 오류 메시지에 나온다).

-- ============ 0) 점검: 모든 관리자 함수가 admin_profile_count로 확인하는지 ============
do $$
declare v_bad text;
begin
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'admin\_%'
    and p.proname not in ('admin_profile_count', 'admin_check', 'admin_login')
    and p.prosrc not ilike '%admin_profile_count%' and p.prosrc not ilike '%admin_check%';
  if v_bad is not null then
    raise exception '비밀번호를 직접 확인하는 관리자 함수가 있어서 중단했어요: %', v_bad;
  end if;
end $$;

-- ============ 1) 새 비밀번호 저장 (해시) ============
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admin_secret (
  id int primary key default 1 check (id = 1),
  pw_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.admin_secret enable row level security;   -- 정책이 없으니 앱에서는 읽기·쓰기 모두 불가
revoke all on public.admin_secret from anon, authenticated;

insert into public.admin_secret (id, pw_hash)
values (1, extensions.crypt('여기에_새_비밀번호', extensions.gen_salt('bf', 10)))
on conflict (id) do update set pw_hash = excluded.pw_hash, updated_at = now();

-- ============ 2) 비밀번호 확인 함수 ============
create or replace function public.admin_check(p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_password is null or not exists (
    select 1 from admin_secret where id = 1 and pw_hash = crypt(p_password, pw_hash)
  ) then
    raise exception 'invalid admin password';
  end if;
end $$;
revoke all on function public.admin_check(text) from public, anon, authenticated;

-- ============ 3) admin_profile_count가 새 비밀번호로 확인하게 (반환 형식은 기존 그대로) ============
do $$
declare v_ret text := pg_get_function_result('public.admin_profile_count(text)'::regprocedure);
begin
  execute format($f$
    create or replace function public.admin_profile_count(p_password text) returns %s
    language plpgsql security definer set search_path = public as $b$
    begin
      perform public.admin_check(p_password);
      return (select count(*) from public.profiles);
    end $b$
  $f$, v_ret);
end $$;
grant execute on function public.admin_profile_count(text) to anon, authenticated;

notify pgrst, 'reload schema';
