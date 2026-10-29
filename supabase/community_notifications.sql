-- 내 게시글에 좋아요·댓글이 달리면 글쓴이에게 알림 (notifications 테이블에 한 줄 추가)
-- community_likes_comments.sql을 먼저 실행한 뒤, 이 파일을 SQL Editor에서 실행한다. (여러 번 실행해도 안전)
--
-- 알림 생성은 앱이 아니라 DB 트리거가 한다. 다른 사람의 알림함에 직접 쓰는 권한을 앱에 줄 필요가 없고,
-- 알림 만들기에 실패해도(예: notifications 열 구성이 다름) 좋아요·댓글 자체는 그대로 저장되게 감싸 두었다.

-- ---------- 좋아요 알림: "OO님이 내 게시글에 좋아요를 눌렀어요." ----------
create or replace function public.notify_post_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid;
  actor    text;
begin
  select user_id into owner_id from community_posts where id = new.post_id;
  if owner_id is null or owner_id = new.user_id then
    return new;   -- 글이 없거나 내 글에 내가 누른 좋아요면 알림 없음
  end if;
  -- 좋아요를 취소했다가 다시 눌러도, 아직 안 읽은 같은 알림이 있으면 또 만들지 않는다
  if exists (select 1 from notifications
             where user_id = owner_id and type = 'post_like' and not is_read
               and payload->>'post_id' = new.post_id::text and payload->>'actor_id' = new.user_id::text) then
    return new;
  end if;
  select nickname into actor from profiles where id = new.user_id;
  begin
    insert into notifications (user_id, type, title, payload)
    values (owner_id, 'post_like', coalesce(actor, '누군가') || '님이 내 게시글에 좋아요를 눌렀어요.',
            jsonb_build_object('post_id', new.post_id, 'actor_id', new.user_id));
  exception when others then
    raise warning 'notify_post_like failed: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists community_likes_notify on public.community_likes;
create trigger community_likes_notify after insert on public.community_likes
  for each row execute function public.notify_post_like();

-- ---------- 댓글 알림: "OO님이 내 게시글에 댓글을 달았어요." ----------
create or replace function public.notify_post_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid;
begin
  select user_id into owner_id from community_posts where id = new.post_id;
  if owner_id is null or owner_id = new.user_id then
    return new;   -- 내 글에 내가 단 댓글이면 알림 없음
  end if;
  begin
    insert into notifications (user_id, type, title, payload)
    values (owner_id, 'post_comment', new.nickname || '님이 내 게시글에 댓글을 달았어요.',
            jsonb_build_object('post_id', new.post_id, 'actor_id', new.user_id, 'comment_id', new.id));
  exception when others then
    raise warning 'notify_post_comment failed: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists community_comments_notify on public.community_comments;
create trigger community_comments_notify after insert on public.community_comments
  for each row execute function public.notify_post_comment();
