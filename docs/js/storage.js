const KEY = "knu-quest-v2";

// 로컬 테스트 버전 전용: 탭마다 "다른 사람"으로 테스트하기 위해 sessionStorage를 씁니다.
// (localStorage였다면 두 탭이 같은 브라우저 저장공간을 공유해서 같은 사람으로 보였을 거예요.)
// 실제 배포(knu-tour 폴더, 백엔드 없는 1인용 버전)에서는 이 줄을 다시 localStorage로 되돌리세요.
const STORE = sessionStorage;

const empty = () => ({
  profile: null,   // { nickname, dept }
  done: {},        // { missionId: { at, pts } }
  verified: {},    // { zoneId: true }  위치 인증을 마친 구역
  bonus: {},       // { "zone:zone-1": 50, "all": 200 ... }  받은 보너스
  score: 0,
  startedAt: null,
  chatLog: {},     // { zoneId: htmlString }  구역별 대화 기록 스냅샷 (새로고침해도 유지)
  daily: { checkin: { lastDate: null, streak: 0 }, quiz: { lastDate: null } },  // 데일리 출석체크 / 퀴즈
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

// 미션 완료 기록 + 점수 반영 (중복 득점 방지)
export function completeMission(missionId, pts) {
  const s = load();
  if (s.done[missionId]) return false;
  s.done[missionId] = { at: Date.now(), pts };
  s.score += pts;
  save(s);
  return true;
}

// 보너스 지급 (같은 key는 한 번만). 새로 지급되면 true
export function grantBonus(key, pts) {
  const s = load();
  if (s.bonus[key]) return false;
  s.bonus[key] = pts;
  s.score += pts;
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
  return { ...c, done: c.lastDate === todayStr() };
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
  s.score += pts;
  save(s);
  return { ok: true, streak: s.daily.checkin.streak, pts };
}

/* ---------- 데일리 퀴즈 ---------- */
export function getDailyQuizState() {
  const s = load();
  const q = s.daily?.quiz || { lastDate: null };
  return { ...q, done: q.lastDate === todayStr() };
}

// 오늘 처음 푸는 거면 기록하고(정답이면 XP 지급), 이미 풀었으면 false
export function completeDailyQuiz(correct, pts = 15) {
  const s = load();
  s.daily = s.daily || { checkin: { lastDate: null, streak: 0 }, quiz: { lastDate: null } };
  const today = todayStr();
  if (s.daily.quiz.lastDate === today) return false;
  s.daily.quiz.lastDate = today;
  if (correct) s.score += pts;
  save(s);
  return true;
}

// 레벨: 250 XP마다 1레벨
const STEP = 250;
const TITLES = ["새내기", "길잡이", "캠퍼스 탐험가", "캠퍼스 러너", "투어 마스터", "캠퍼스 레전드", "KNU 전설"];
export function getLevel(score) {
  const level = Math.floor(score / STEP) + 1;
  return {
    level,
    title: TITLES[Math.min(level - 1, TITLES.length - 1)],
    pct: ((score % STEP) / STEP) * 100,
    next: STEP - (score % STEP),
  };
}