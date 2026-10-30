-- 관리자 페이지 보안: 로그인 시도 제한 + 보안 점검
-- Supabase 대시보드 → SQL Editor에서 실행한다. (여러 번 실행해도 안전)
-- 기존 admin_* 함수(비밀번호 확인 방식)는 그대로 두고, 관리자 페이지의 "입장"만 이 함수로 바꾼다.

-- ============ 1) 로그인 시도 제한 ============
-- 같은 IP에서 15분 동안 5번 틀리면 그 IP는 15분 동안 입장할 수 없다.
-- (오류를 내면 실패 기록까지 되돌려지므로, 실패는 오류 대신 -1 / 막힘은 -2로 돌려준다)
create table if not exists public.admin_login_failures (
  id bigserial primary key,
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists admin_login_failures_ip_at on public.admin_login_failures (ip, at);
alter table public.admin_login_failures enable row level security;   -- 정책이 없으니 앱에서는 읽기·쓰기 모두 불가
revoke all on public.admin_login_failures from anon, authenticated;

create or replace function public.admin_login(p_password text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_ip text := coalesce(
    nullif(trim(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1)), ''),
    'unknown');
  v_fails int;
  v_users int;
begin
  delete from admin_login_failures where at < now() - interval '1 day';
  select count(*) into v_fails from admin_login_failures where ip = v_ip and at > now() - interval '15 minutes';
  if v_fails >= 5 then return -2; end if;
  begin
    v_users := public.admin_profile_count(p_password)::int;   -- 기존 비밀번호 확인 (틀리면 오류)
  exception when others then
    insert into admin_login_failures (ip) values (v_ip);
    return -1;
  end;
  delete from admin_login_failures where ip = v_ip;
  return v_users;
end $$;
grant execute on function public.admin_login(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ============ 2) 보안 점검 (읽기만 함) ============
-- 실행 결과 표에 줄이 나오면 확인이 필요한 항목이다. 아무 줄도 없으면 통과.
-- (a) 행 수준 보안(RLS)이 꺼진 표: 누구나 anon 키로 읽고 쓸 수 있을 수 있다
-- (b) 누구나(anon) 부를 수 있는 security definer 함수 중 admin_ 으로 시작하는 것: 함수 안에서 비밀번호를 확인하는지 점검
select '(a) RLS가 꺼진 표' as 점검항목, c.relname as 이름
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
union all
select '(b) anon이 부를 수 있는 관리자 함수 — 비밀번호 확인 여부 점검', p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'admin\_%' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'execute')
  and p.prosrc not ilike '%password%'
order by 1, 2;
