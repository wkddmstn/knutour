-- 내 정보: 닉네임 중복 확인·수정, 회원 탈퇴, 의견과 제안
-- Supabase 대시보드 → SQL Editor에 붙여넣고 실행한다. (여러 번 실행해도 안전)
-- 관리자 함수는 기존 admin_profile_count(p_password)로 비밀번호를 확인한다 (틀리면 그 함수가 오류를 낸다).

-- ============ 1) 닉네임 중복 확인 · 수정 ============
-- 대소문자·앞뒤 공백은 무시하고 같은 닉네임인지 본다. 로그인 전(가입 화면)에도 부를 수 있게 anon 허용.
create or replace function public.nickname_taken(p_nickname text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where lower(trim(nickname)) = lower(trim(p_nickname))
      and id is distinct from auth.uid()   -- 내 지금 닉네임은 중복으로 치지 않음
  );
$$;
grant execute on function public.nickname_taken(text) to anon, authenticated;

-- 닉네임 바꾸기: 중복이면 'nickname_taken' 오류. 내가 쓴 글·댓글에 찍힌 닉네임도 함께 바꾼다.
create or replace function public.change_nickname(p_nickname text) returns text
language plpgsql security definer set search_path = public as $$
declare
  n text := trim(p_nickname);
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if char_length(n) < 2 or char_length(n) > 10 then raise exception 'invalid_nickname'; end if;
  if exists (select 1 from profiles where lower(trim(nickname)) = lower(n) and id <> auth.uid()) then
    raise exception 'nickname_taken';
  end if;
  update profiles set nickname = n where id = auth.uid();
  begin update community_posts set nickname = n where user_id = auth.uid(); exception when undefined_table then null; end;
  begin update community_comments set nickname = n where user_id = auth.uid(); exception when undefined_table then null; end;
  return n;
end $$;
grant execute on function public.change_nickname(text) to authenticated;

-- 동시에 같은 닉네임으로 가입하는 경우까지 막는 고유 인덱스.
-- 이미 같은 닉네임이 여러 명 있으면 만들 수 없어서 건너뛴다 (그래도 위 함수와 앱에서 새 중복은 막는다).
do $$
begin
  create unique index if not exists profiles_nickname_unique on public.profiles (lower(trim(nickname)));
exception when unique_violation then
  raise notice '이미 같은 닉네임이 여러 개 있어 고유 인덱스는 건너뜀';
end $$;

-- ============ 2) 회원 탈퇴 ============
-- 내 프로필·미션 기록·글·댓글·좋아요·알림·함께하기 기록과 로그인 계정(auth.users)까지 지운다.
-- 테이블이 아직 없을 수도 있어서 하나씩 감싼다. 내가 남긴 의견은 내용만 남기고 작성자 연결을 끊는다.
-- (커뮤니티에 올린 사진 파일은 저장소에 남는다 — 필요하면 Storage에서 따로 정리)
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  begin delete from community_comment_likes where user_id = uid; exception when undefined_table then null; end;
  begin delete from community_likes where user_id = uid; exception when undefined_table then null; end;
  begin delete from community_comments where user_id = uid; exception when undefined_table then null; end;
  begin delete from community_reports where reporter_id = uid; exception when undefined_table or undefined_column then null; end;
  begin delete from community_posts where user_id = uid; exception when undefined_table then null; end;
  begin delete from notifications where user_id = uid; exception when undefined_table then null; end;
  begin delete from friend_requests where requester_id = uid or partner_id = uid; exception when undefined_table or undefined_column then null; end;
  begin delete from mission_completions where user_id = uid; exception when undefined_table then null; end;
  begin update feedback set user_id = null, nickname = null where user_id = uid; exception when undefined_table then null; end;
  delete from profiles where id = uid;
  delete from auth.users where id = uid;
end $$;
grant execute on function public.delete_my_account() to authenticated;

-- ============ 3) 의견과 제안 ============
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default auth.uid() references auth.users(id) on delete set null,
  nickname   text,
  category   text not null check (char_length(category) between 1 and 30),
  message    text not null check (char_length(message) between 1 and 2000),
  device     text,                                   -- 원활한 파악을 위한 기기·브라우저 정보
  status     text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;
-- 학생은 보내기만 가능 (읽기는 관리자 함수로만)
drop policy if exists "users send feedback as themselves" on public.feedback;
create policy "users send feedback as themselves" on public.feedback
  for insert with check (user_id = auth.uid());
grant insert on public.feedback to authenticated;

create or replace function public.admin_list_feedback(p_password text) returns setof public.feedback
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_profile_count(p_password);   -- 비밀번호 확인
  return query select * from feedback order by created_at desc limit 500;
end $$;

create or replace function public.admin_set_feedback_status(p_password text, p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_profile_count(p_password);
  update feedback set status = p_status where id = p_id;
end $$;

create or replace function public.admin_delete_feedback(p_password text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_profile_count(p_password);
  delete from feedback where id = p_id;
end $$;

grant execute on function public.admin_list_feedback(text) to anon, authenticated;
grant execute on function public.admin_set_feedback_status(text, uuid, text) to anon, authenticated;
grant execute on function public.admin_delete_feedback(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
