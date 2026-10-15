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
});

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
