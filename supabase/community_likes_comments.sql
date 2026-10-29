-- 커뮤니티 게시글 좋아요 · 댓글 테이블
-- Supabase 대시보드 → SQL Editor에 붙여넣고 한 번 실행하면 된다. (여러 번 실행해도 안전)

-- ---------- 좋아요: (게시글, 사용자) 한 쌍당 한 줄 ----------
create table if not exists public.community_likes (
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.community_likes enable row level security;

drop policy if exists "likes are readable by everyone" on public.community_likes;
create policy "likes are readable by everyone" on public.community_likes
  for select using (true);

drop policy if exists "users like as themselves" on public.community_likes;
create policy "users like as themselves" on public.community_likes
  for insert with check (user_id = auth.uid());

drop policy if exists "users unlike their own like" on public.community_likes;
create policy "users unlike their own like" on public.community_likes
  for delete using (user_id = auth.uid());

-- ---------- 댓글 ----------
create table if not exists public.community_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nickname   text not null check (char_length(nickname) between 1 and 30),
  message    text not null check (char_length(message) between 1 and 200),
  created_at timestamptz not null default now()
);

create index if not exists community_comments_post_idx on public.community_comments (post_id, created_at);

alter table public.community_comments enable row level security;

drop policy if exists "comments are readable by everyone" on public.community_comments;
create policy "comments are readable by everyone" on public.community_comments
  for select using (true);

drop policy if exists "users comment as themselves" on public.community_comments;
create policy "users comment as themselves" on public.community_comments
  for insert with check (user_id = auth.uid());

drop policy if exists "users delete their own comments" on public.community_comments;
create policy "users delete their own comments" on public.community_comments
  for delete using (user_id = auth.uid());

grant select on public.community_likes, public.community_comments to anon, authenticated;
grant insert, delete on public.community_likes, public.community_comments to authenticated;

-- PostgREST가 새 테이블/관계를 바로 인식하도록 스키마 캐시 새로고침
notify pgrst, 'reload schema';
