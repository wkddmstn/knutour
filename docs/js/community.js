// 커뮤니티 게시판: 구역 태그(선택)와 사진(선택)을 붙여 글을 남기고, 다른 사람들도 볼 수 있다.
// "구역별 방명록"이었던 기능을 이제 커뮤니티 탭 하나로 합쳤다. (guestbook.js를 대체)
import { client, getCachedProfile } from "./supa.js";

const BUCKET = "community-photos";

// 간단한 욕설/부적절한 표현 필터. 완벽하진 않지만(띄어쓰기·자모 분리로 우회는 가능) 기본적인 도배/욕설은 막는다.
// 더 걸러야 할 단어가 있으면 이 배열에 추가하면 된다. 공백을 모두 지우고 비교하므로 "시 발"처럼 띄어 써도 걸린다.
const BANNED_WORDS = [
  "시발", "씨발", "씨팔", "ㅅㅂ", "ㅆㅂ", "개새끼", "개새기", "병신", "ㅂㅅ", "미친놈", "미친년",
  "좆", "지랄", "ㅈㄹ", "썅", "존나", "닥쳐", "꺼져", "죽어버려", "섹스", "야동", "강간", "fuck", "shit",
];
function containsBannedWord(text) {
  const norm = String(text).replace(/\s+/g, "").toLowerCase();
  return BANNED_WORDS.some((w) => norm.includes(w));
}

// 게시글 목록 (최신순). zoneId를 주면 그 구역 글만, onlyMine이면 내가 쓴 글만 가져온다.
// 각 글에 like_count, liked(내가 눌렀는지), comment_count가 붙어서 나온다.
// 좋아요/댓글 테이블이 아직 없으면(supabase/community_likes_comments.sql 미실행) 0으로 채워서 글 목록만 보여준다.
export async function listPosts({ zoneId = null, onlyMine = false, limit = 50 } = {}) {
  const me = getCachedProfile();
  if (onlyMine && !me) return [];
  const build = (columns) => {
    let q = client.from("community_posts").select(columns).order("created_at", { ascending: false }).limit(limit);
    if (zoneId) q = q.eq("zone_id", zoneId);
    if (onlyMine) q = q.eq("user_id", me.id);
    return q;
  };
  let { data, error } = await build("*, community_likes(user_id), community_comments(count)");
  if (error) ({ data, error } = await build("*"));
  if (error) return [];
  return data.map(({ community_likes: likes = [], community_comments: comments = [], ...p }) => ({
    ...p,
    like_count: likes.length,
    liked: !!me && likes.some((l) => l.user_id === me.id),
    comment_count: comments[0]?.count || 0,
  }));
}

// 좋아요 누르기(like=true) / 취소(like=false). 성공하면 true.
export async function setLike(postId, like) {
  const me = getCachedProfile();
  if (!me) return false;
  if (like) {
    const { error } = await client.from("community_likes").insert({ post_id: postId, user_id: me.id });
    return !error || error.code === "23505";   // 이미 눌러둔 상태(중복)면 성공으로 본다
  }
  const { error } = await client.from("community_likes").delete().eq("post_id", postId).eq("user_id", me.id);
  return !error;
}

// 댓글 목록 (오래된 순 — 대화 흐름대로 위에서 아래로 읽히게)
export async function listComments(postId) {
  const { data, error } = await client.from("community_comments")
    .select("*").eq("post_id", postId).order("created_at", { ascending: true });
  return error ? null : data;
}

// 댓글 달기. 반환값: { ok: true, comment } 또는 { ok: false, reason: "banned_word" | "no_profile" | "error" }
export async function addComment(postId, nickname, message) {
  const me = getCachedProfile();
  if (!me) return { ok: false, reason: "no_profile" };
  if (containsBannedWord(message)) return { ok: false, reason: "banned_word" };
  const { data, error } = await client.from("community_comments")
    .insert({ post_id: postId, user_id: me.id, nickname: nickname || "익명", message })
    .select().single();
  return error ? { ok: false, reason: "error" } : { ok: true, comment: data };
}

// 내 댓글 삭제. 성공하면 true.
export async function deleteComment(commentId) {
  const me = getCachedProfile();
  if (!me) return false;
  const { error } = await client.from("community_comments").delete().eq("id", commentId).eq("user_id", me.id);
  return !error;
}

// AR 포토스튜디오에서 나온 "data:image/..." dataURL을 업로드 가능한 Blob으로 바꾼다
function dataUrlToBlob(dataUrl) {
  const [header, b64] = dataUrl.split(",");
  const mime = header.match(/data:(.*);base64/)?.[1] || "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// 글 남기기. zoneId·photo는 선택 사항 — photo는 File 객체이거나 "data:"로 시작하는 dataURL이어도 된다
// (호반우 AR 포토스튜디오에서 찍은 사진은 dataURL로 나온다).
// 반환값: { ok: true } 또는 { ok: false, reason: "banned_word" | "no_profile" | "error" }
export async function postCommunity(zoneId, nickname, message, photo) {
  const me = getCachedProfile();
  if (!me) return { ok: false, reason: "no_profile" };
  if (message && containsBannedWord(message)) return { ok: false, reason: "banned_word" };

  let photo_url = null;
  if (photo) {
    const isDataUrl = typeof photo === "string" && photo.startsWith("data:");
    const blob = isDataUrl ? dataUrlToBlob(photo) : photo;
    const ext = isDataUrl ? "jpg" : (photo.name?.split(".").pop() || "jpg").toLowerCase();
    const path = `${zoneId || "general"}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await client.storage.from(BUCKET).upload(path, blob);
    if (!upErr) {
      const { data } = client.storage.from(BUCKET).getPublicUrl(path);
      photo_url = data?.publicUrl || null;
    }
  }

  const { error } = await client.from("community_posts").insert({
    zone_id: zoneId || null,
    user_id: me.id,
    nickname: nickname || "익명",
    message: message || "",
    photo_url,
  });
  return error ? { ok: false, reason: "error" } : { ok: true };
}

// 게시글 신고. reason은 선택 사항. 성공하면 true.
export async function reportPost(postId, reason = "") {
  const me = getCachedProfile();
  if (!me) return false;
  const { error } = await client.from("community_reports").insert({
    post_id: postId,
    reporter_id: me.id,
    reason: reason || null,
  });
  return !error;
}