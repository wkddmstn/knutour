-- 커뮤니티 질문 게시판 + 댓글(답변) 좋아요
-- community_likes_comments.sql을 먼저 실행한 뒤, 이 파일을 SQL Editor에서 실행한다. (여러 번 실행해도 안전)

-- ---------- 게시글 종류: 'post'(자유게시판) | 'question'(질문) ----------
alter table public.community_posts
  add column if not exists kind text not null default 'post';

alter table public.community_posts drop constraint if exists community_posts_kind_check;
alter table public.community_posts
  add constraint community_posts_kind_check check (kind in ('post', 'question'));

create index if not exists community_posts_kind_idx on public.community_posts (kind, created_at desc);

-- ---------- 댓글 좋아요: (댓글, 사용자) 한 쌍당 한 줄 ----------
-- 질문글에서는 좋아요를 가장 많이 받은 댓글이 "베스트 답변"으로 목록에 바로 보인다.
create table if not exists public.community_comment_likes (
  comment_id uuid not null references public.community_comments(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.community_comment_likes enable row level security;

drop policy if exists "comment likes are readable by everyone" on public.community_comment_likes;
create policy "comment likes are readable by everyone" on public.community_comment_likes
  for select using (true);

drop policy if exists "users like comments as themselves" on public.community_comment_likes;
create policy "users like comments as themselves" on public.community_comment_likes
  for insert with check (user_id = auth.uid());

drop policy if exists "users unlike their own comment like" on public.community_comment_likes;
create policy "users unlike their own comment like" on public.community_comment_likes
  for delete using (user_id = auth.uid());

grant select on public.community_comment_likes to anon, authenticated;
grant insert, delete on public.community_comment_likes to authenticated;

notify pgrst, 'reload schema';
