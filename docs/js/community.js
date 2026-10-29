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

// 질문 게시판 맨 위에 고정되는 "이렇게 질문해 보세요" 예시. DB에 없는 글이라 좋아요·답변은 막혀 있다.
export const GUIDE_QUESTION = {
  id: "guide-question",
  guide: true,
  kind: "question",
  zone_id: null,
  user_id: null,
  nickname: "호반우 가이드",
  message: "처음 캠퍼스 투어를 시작했어요! 어느 구역부터 돌면 좋을까요? 🐮",
  photo_url: null,
  created_at: "2026-03-02T09:00:00+09:00",
  like_count: 8,
  liked: false,
  comment_count: 1,
  comments: [{
    id: "guide-answer",
    user_id: null,
    nickname: "선배 호반우",
    message: "중앙도서관 → 일청담 → 센트럴 파크 순서로 걸어 보세요! 서로 가까워서 동선이 짧고, 일청담 근처에서는 가끔 신천 수달 히든 미션도 떠요 🦦",
    created_at: "2026-03-02T09:20:00+09:00",
    like_count: 12,
    liked: false,
  }],
};
GUIDE_QUESTION.best = GUIDE_QUESTION.comments[0];

// 좋아요를 가장 많이 받은 댓글(1개 이상 받은 것만). 동점이면 먼저 달린 댓글.
export function pickBest(comments = []) {
  let best = null;
  for (const c of comments) {
    if (c.like_count > 0 && (!best || c.like_count > best.like_count
        || (c.like_count === best.like_count && c.created_at < best.created_at))) best = c;
  }
  return best;
}

// 게시글 목록 (최신순). kind는 "post"(자유게시판) | "question"(질문). zoneId를 주면 그 구역 글만,
// onlyMine이면 내가 쓴 글만 가져온다. 각 글에 like_count, liked(내가 눌렀는지), comment_count가 붙고,
// 질문글에는 best(좋아요를 가장 많이 받은 댓글)도 붙는다.
// supabase/*.sql이 아직 실행되지 않았으면 쓸 수 있는 정보만으로 단계적으로 물러나서 글 목록은 보여준다.
// 해시태그 글자: 한글·영문·숫자·밑줄만. 장소 이름은 띄어쓰기·가운뎃점을 뺀 것이 태그가 된다 ("센트럴 파크" → #센트럴파크)
export const toTag = (s) => String(s || "").replace(/[^0-9A-Za-z가-힣_]/g, "");
export const TAG_RE = /#([0-9A-Za-z가-힣_]+)/g;

// tag: { tag, zoneId } — 그 장소(zone_id)로 올린 글 + 본문에 #tag를 직접 쓴 글을 함께 보여준다
export async function listPosts({ kind = "post", zoneId = null, onlyMine = false, tag = null, limit = 50 } = {}) {
  const me = getCachedProfile();
  if (onlyMine && !me) return [];
  const t = toTag(tag?.tag);
  const build = ([columns, byKind]) => {
    let q = client.from("community_posts").select(columns).order("created_at", { ascending: false }).limit(limit);
    if (byKind) q = q.eq("kind", kind);
    if (t) q = tag.zoneId ? q.or(`zone_id.eq.${tag.zoneId},message.ilike.*#${t}*`) : q.ilike("message", `%#${t}%`);
    if (zoneId) q = q.eq("zone_id", zoneId);
    if (onlyMine) q = q.eq("user_id", me.id);
    return q;
  };
  const counts = "*, community_likes(user_id), community_comments(count)";
  const attempts = kind === "question"
    ? [["*, community_likes(user_id), community_comments(id, nickname, message, created_at, community_comment_likes(count))", true],
       [counts, true], ["*", true]]
    : [[counts, true], ["*", true],
       [counts, false], ["*", false]];   // kind 열이 없던 시절 글은 전부 자유게시판 글
  let data = null;
  for (const a of attempts) {
    const r = await build(a);
    if (!r.error) { data = r.data; break; }
  }
  if (!data) return [];
  return data.map(({ community_likes: likes = [], community_comments: comments = [], ...p }) => {
    const post = {
      ...p,
      kind: p.kind || "post",
      like_count: likes.length,
      liked: !!me && likes.some((l) => l.user_id === me.id),
      comment_count: comments[0]?.count ?? comments.length,
    };
    if (comments.length && comments[0].count === undefined) {
      post.best = pickBest(comments.map(({ community_comment_likes: cl = [], ...c }) => ({ ...c, like_count: cl[0]?.count || 0 })));
    }
    return post;
  });
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

// 댓글 목록 (오래된 순 — 대화 흐름대로 위에서 아래로 읽히게). 각 댓글에 like_count, liked가 붙는다.
export async function listComments(postId) {
  const me = getCachedProfile();
  const build = (columns) => client.from("community_comments")
    .select(columns).eq("post_id", postId).order("created_at", { ascending: true });
  let { data, error } = await build("*, community_comment_likes(user_id)");
  if (error) ({ data, error } = await build("*"));
  if (error) return null;
  return data.map(({ community_comment_likes: likes = [], ...c }) => ({
    ...c,
    like_count: likes.length,
    liked: !!me && likes.some((l) => l.user_id === me.id),
  }));
}

// 댓글 좋아요 누르기(like=true) / 취소(like=false). 성공하면 true.
export async function setCommentLike(commentId, like) {
  const me = getCachedProfile();
  if (!me) return false;
  if (like) {
    const { error } = await client.from("community_comment_likes").insert({ comment_id: commentId, user_id: me.id });
    return !error || error.code === "23505";
  }
  const { error } = await client.from("community_comment_likes").delete().eq("comment_id", commentId).eq("user_id", me.id);
  return !error;
}

// 댓글 달기. 반환값: { ok: true, comment } 또는 { ok: false, reason: "banned_word" | "no_profile" | "error" }
export async function addComment(postId, nickname, message) {
  const me = getCachedProfile();
  if (!me) return { ok: false, reason: "no_profile" };
  if (containsBannedWord(message)) return { ok: false, reason: "banned_word" };
  const { data, error } = await client.from("community_comments")
    .insert({ post_id: postId, user_id: me.id, nickname: nickname || "익명", message })
    .select().single();
  return error ? { ok: false, reason: "error" } : { ok: true, comment: { ...data, like_count: 0, liked: false } };
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
// (호반우 AR 포토스튜디오에서 찍은 사진은 dataURL로 나온다). kind는 "post"(기본) | "question".
// 반환값: { ok: true } 또는 { ok: false, reason: "banned_word" | "no_profile" | "error" }
export async function postCommunity(zoneId, nickname, message, photo, kind = "post") {
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
    ...(kind !== "post" ? { kind } : {}),   // 자유게시판 글은 DB 기본값에 맡겨서 kind 열이 없어도 올라가게
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