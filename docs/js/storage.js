import { client, getCachedProfile } from "./supa.js";

const KEY = "knu-quest-v2";

// 실제 배포본: 브라우저/탭을 닫았다 열어도 유저 정보가 남아있도록 localStorage를 씁니다.
// (여러 탭에서 각각 "다른 사람"으로 테스트하고 싶을 때만 아래를 sessionStorage로 바꾸세요 —
//  그러면 탭마다 따로 저장되지만, 탭을 닫으면 그 탭의 정보는 사라져요.)
const STORE = localStorage;

const empty = () => ({
  profile: null,   // { nickname, dept }
  done: {},        // { missionId: { at, pts } }
  verified: {},    // { zoneId: true }  위치 인증을 마친 구역
  bonus: {},       // { "zone:zone-1": 50, "all": 200 ... }  받은 보너스
  score: 0,
  startedAt: null,
  chatLog: {},     // { zoneId: htmlString }  구역별 대화 기록 스냅샷 (새로고침해도 유지)
  daily: { checkin: { lastDate: null, streak: 0 }, quiz: { lastDate: null, correct: false } },  // 데일리 출석체크 / 퀴즈
  levelLog: [],    // [{ level, at }]  레벨업할 때마다 기록 (내 정보 탭의 "레벨 기록"에 사용)
  hiddenClaims: {}, // { hiddenMissionId: "YYYY-MM-DD" }  히든미션을 오늘 이미 했는지
  photoHashes: {},  // { missionId: "0101...(64자리)" }  미션별로 제출한 사진의 pHash (재사용 사진 감지용)
});

const todayStr = () => new Date().toISOString().slice(0, 10);

function load() {
  try { return { ...empty(), ...JSON.parse(STORE.getItem(KEY)) }; }
  catch { return empty(); }
}
const save = (s) => STORE.setItem(KEY, JSON.stringify(s));

export const getState = () => load();
export const hasProfile = () => !!load().profile;
export const isDone = (missionId) => !!load().done[missionId];
export const isVerified = (zoneId) => !!load().verified[zoneId];

export function saveProfile(profile) {
  const s = load();
  s.profile = profile;
  s.startedAt = s.startedAt || Date.now();
  save(s);
}

export function setVerified(zoneId) {
  const s = load();
  s.verified[zoneId] = true;
  save(s);
}

// 점수를 서버(Supabase profiles.score)에도 실시간으로 올려둔다. 랭킹 탭과 관리자 페이지가 이 값을 본다.
// 실패해도(오프라인 등) 로컬 진행에는 영향 없도록 조용히 무시한다.
async function syncScoreToServer(score) {
  const me = getCachedProfile();
  if (!me) return;
  try { await client.from("profiles").update({ score }).eq("id", me.id); } catch { /* 무시 */ }
}

// 미션 완료 기록을 서버(mission_completions)에도 남겨서, 관리자 페이지의 "구역/미션 진행 현황"에 잡히게 한다
async function syncMissionCompletionToServer(missionId, pts) {
  const me = getCachedProfile();
  if (!me) return;
  try {
    await client.from("mission_completions")
      .upsert({ user_id: me.id, mission_id: missionId, points: pts }, { onConflict: "user_id,mission_id", ignoreDuplicates: true });
  } catch { /* 무시 */ }
}

// 점수를 더하면서, 그 사이에 레벨이 오르면 levelLog에 "언제 몇 레벨을 찍었는지" 기록해 둔다
function addScore(s, amt) {
  const before = getLevel(s.score).level;
  s.score += amt;
  const after = getLevel(s.score).level;
  s.levelLog = s.levelLog || [];
  for (let lv = before + 1; lv <= after; lv++) s.levelLog.push({ level: lv, at: Date.now() });
  syncScoreToServer(s.score);
}

// 미션 완료 기록 + 점수 반영 (중복 득점 방지)
export function completeMission(missionId, pts) {
  const s = load();
  if (s.done[missionId]) return false;
  s.done[missionId] = { at: Date.now(), pts };
  addScore(s, pts);
  save(s);
  syncMissionCompletionToServer(missionId, pts);
  return true;
}

// 보너스 지급 (같은 key는 한 번만). 새로 지급되면 true
export function grantBonus(key, pts) {
  const s = load();
  if (s.bonus[key]) return false;
  s.bonus[key] = pts;
  addScore(s, pts);
  save(s);
  return true;
}

export const resetAll = () => STORE.removeItem(KEY);

// 구역 대화 기록 저장/복원 (새로고침하거나 다른 화면 갔다 와도 유지)
export function getZoneChat(zoneId) {
  return load().chatLog[zoneId] || null;
}
export function saveZoneChat(zoneId, html) {
  const s = load();
  s.chatLog[zoneId] = html;
  save(s);
}
export function clearZoneChat(zoneId) {
  const s = load();
  delete s.chatLog[zoneId];
  save(s);
}

/* ---------- 데일리 출석체크 ---------- */
export function getDailyCheckin() {
  const s = load();
  const c = s.daily?.checkin || { lastDate: null, streak: 0 };
  const done = c.lastDate === todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  // live: 지금 이어지고 있는 연속 출석 일수. 어제도 오늘도 안 했으면 끊긴 것이라 0 (출석 도장 줄에 쓴다)
  const live = done || c.lastDate === yesterday ? c.streak : 0;
  return { ...c, done, live };
}

// 오늘 처음이면 출석 처리하고 XP 지급, 이미 했으면 ok:false
export function doDailyCheckin(pts = 10) {
  const s = load();
  s.daily = s.daily || { checkin: { lastDate: null, streak: 0 }, quiz: { lastDate: null } };
  const today = todayStr();
  if (s.daily.checkin.lastDate === today) return { ok: false, streak: s.daily.checkin.streak };
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  s.daily.checkin.streak = s.daily.checkin.lastDate === yesterday ? s.daily.checkin.streak + 1 : 1;
  s.daily.checkin.lastDate = today;
  addScore(s, pts);
  save(s);
  return { ok: true, streak: s.daily.checkin.streak, pts };
}

/* ---------- 데일리 퀴즈 ---------- */
export function getDailyQuizState() {
  const s = load();
  const q = s.daily?.quiz || { lastDate: null, correct: false };
  return { ...q, done: q.lastDate === todayStr() };
}

// 오늘 처음 푸는 거면 기록하고(정답이면 XP 지급), 이미 풀었으면 false
export function completeDailyQuiz(correct, pts = 15) {
  const s = load();
  s.daily = s.daily || { checkin: { lastDate: null, streak: 0 }, quiz: { lastDate: null, correct: false } };
  const today = todayStr();
  if (s.daily.quiz.lastDate === today) return false;
  s.daily.quiz.lastDate = today;
  s.daily.quiz.correct = !!correct;
  if (correct) addScore(s, pts);
  save(s);
  return true;
}

// 레벨: 총 10단계, 마지막 Lv.10은 누적 2000 XP에서 달성한다.
// 레벨이 오를수록 다음 레벨까지 필요한 XP가 점점 커지고(50→70→100→...→490), 레벨마다 고유한 이름을 가진다.
// need는 "이 레벨에서 다음 레벨로 가는 데 필요한 XP"(마지막 레벨은 더 오를 데가 없어서 0).
const LEVELS = [
  { title: "새내기",        need: 50 },  // Lv.1
  { title: "길잡이",        need: 70 },  // Lv.2
  { title: "캠퍼스 탐험가",  need: 100 }, // Lv.3
  { title: "캠퍼스 러너",    need: 140 }, // Lv.4
  { title: "투어 마스터",    need: 190 }, // Lv.5
  { title: "캠퍼스 레전드",  need: 250 }, // Lv.6
  { title: "호반우 조련사",  need: 320 }, // Lv.7
  { title: "경북대 수호자",  need: 390 }, // Lv.8
  { title: "캠퍼스 정복자",  need: 490 }, // Lv.9
  { title: "KNU 전설",      need: 0 },   // Lv.10 (최고 레벨, 누적 2000 XP에서 달성)
];
const MAX_LEVEL = LEVELS.length;

// 레벨 n에서 n+1로 가는 데 필요한 XP
function stepFor(level) {
  return LEVELS[level - 1]?.need ?? 0;
}

export function getLevel(score) {
  let level = 1, floor = 0;
  while (level < MAX_LEVEL && score >= floor + stepFor(level)) {
    floor += stepFor(level);
    level++;
  }
  const step = stepFor(level);
  return {
    level,
    title: LEVELS[level - 1].title,
    pct: step ? Math.min(100, ((score - floor) / step) * 100) : 100,
    next: step ? Math.max(0, step - (score - floor)) : 0,
    maxed: level >= MAX_LEVEL,   // 최고 레벨(Lv.10)에 도달했는지
  };
}

// 레벨별 필요 XP 기준표 (내 정보 탭의 "레벨 기준 보기"에 사용)
export function getLevelTable() {
  const rows = [];
  let floor = 0;
  for (let lv = 1; lv <= MAX_LEVEL; lv++) {
    rows.push({ level: lv, title: LEVELS[lv - 1].title, from: floor, need: stepFor(lv) });
    floor += stepFor(lv);
  }
  return rows;
}

// 내가 실제로 각 레벨을 언제 찍었는지 기록 (레벨업 시점에 저장됨)
export function getLevelLog() {
  return load().levelLog || [];
}

/* ---------- 히든미션 (홈 화면에 가끔 나타나는 보너스 미션) ---------- */
// 지금은 데모라 "하루에 한 번"만 체크한다. 나중에 특정 시간대 조건을 추가하고 싶으면
// isHiddenMissionAvailable 안에 현재 시각 체크를 더 넣으면 된다 (예: 12~13시에만 true).
export function isHiddenMissionAvailable(id) {
  const s = load();
  return (s.hiddenClaims || {})[id] !== todayStr();
}
export function claimHiddenMission(id) {
  const s = load();
  s.hiddenClaims = s.hiddenClaims || {};
  s.hiddenClaims[id] = todayStr();
  save(s);
}

/* ---------- 사진 재사용(pHash) 기록 ---------- */
export function getPhotoHashes() {
  return load().photoHashes || {};
}
export function savePhotoHash(missionId, hash) {
  const s = load();
  s.photoHashes = s.photoHashes || {};
  s.photoHashes[missionId] = hash;
  save(s);
}