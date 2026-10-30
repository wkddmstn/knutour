// js/account.js — 내 정보: 닉네임 중복 확인·수정, 회원 탈퇴, 의견과 제안
// 서버 쪽 함수·테이블은 supabase/account_feedback.sql
import { client, getCachedProfile, setCachedProfile } from "./supa.js";

export const NICK_TAKEN_MSG = "이미 가입된 닉네임입니다.";

// 이미 다른 사람이 쓰는 닉네임인지 (대소문자·앞뒤 공백 무시, 내 지금 닉네임은 제외)
// SQL을 아직 실행하지 않았으면 profiles를 직접 찾아 본다.
export async function isNicknameTaken(nickname) {
  const n = String(nickname || "").trim();
  const { data, error } = await client.rpc("nickname_taken", { p_nickname: n });
  if (!error) return !!data;
  const me = getCachedProfile();
  let q = client.from("profiles").select("id").ilike("nickname", n).limit(1);
  if (me) q = q.neq("id", me.id);
  const { data: rows } = await q;
  return !!rows?.length;
}

// 닉네임 바꾸기. 반환: { ok: true, nickname } | { ok: false, reason: "taken" | "invalid" | "error" }
// 내가 쓴 글·댓글에 찍힌 닉네임도 서버 함수가 함께 바꾼다.
export async function changeNickname(nickname) {
  const n = String(nickname || "").trim();
  if (n.length < 2 || n.length > 10) return { ok: false, reason: "invalid" };
  const { data, error } = await client.rpc("change_nickname", { p_nickname: n });
  if (error) {
    if (/nickname_taken|duplicate|unique/i.test(error.message || "")) return { ok: false, reason: "taken" };
    if (/invalid_nickname/.test(error.message || "")) return { ok: false, reason: "invalid" };
    return { ok: false, reason: "error" };
  }
  const me = getCachedProfile();
  if (me) setCachedProfile({ ...me, nickname: data || n });
  return { ok: true, nickname: data || n };
}

// 회원 탈퇴: 서버의 내 정보·기록·글과 로그인 계정을 지운 뒤, 이 기기에 남은 앱 데이터도 지운다.
// 같은 주소(github.io)의 다른 사이트 데이터는 건드리지 않도록 이 앱이 쓰는 이름만 골라 지운다.
const APP_KEY = /^(knu|oncampus|knutour|sb-)/;
export async function deleteAccount() {
  const { error } = await client.rpc("delete_my_account");
  if (error) return false;
  try { await client.auth.signOut(); } catch { /* 계정이 이미 지워져 있어도 괜찮음 */ }
  for (const store of [localStorage, sessionStorage]) {
    try { Object.keys(store).filter((k) => APP_KEY.test(k)).forEach((k) => store.removeItem(k)); } catch {}
  }
  try { indexedDB.deleteDatabase("knu-album"); } catch {}   // 도감 사진 앨범
  setCachedProfile(null);
  return true;
}

// 의견과 제안 보내기. 원활한 파악을 위해 기기·브라우저 정보(화면 크기 포함)를 함께 저장한다.
export async function sendFeedback(category, message) {
  const me = getCachedProfile();
  if (!me) return false;
  const device = `${navigator.userAgent} | ${screen.width}x${screen.height} @${window.devicePixelRatio || 1}`.slice(0, 400);
  const { error } = await client.from("feedback").insert({
    user_id: me.id, nickname: me.nickname, category, message: message.trim(), device,
  });
  return !error;
}
