// 서버 없이 테스트할 수 있는 "가짜 백엔드"입니다.
// localStorage는 같은 브라우저의 모든 탭이 공유하기 때문에,
// 탭 2개를 열어두면 실제로 "서로 다른 두 사용자"처럼 친구 요청을 주고받는 걸 테스트할 수 있습니다.
//
// 나중에 실제 서비스로 갈 땐 이 파일과 friend.js, notifications.js 세 개만
// Supabase 버전으로 교체하면 됩니다. 다른 파일(notif-ui.js, main.js 연결부)은 그대로 씁니다.

const DB_KEY = "knu-quest-local-db";   // 탭끼리 공유되는 "가짜 서버" 데이터
const UID_KEY = "knu-quest-my-uid";    // 이 탭만의 "내 신원" (탭마다 다름 — sessionStorage라 탭 간 공유 안 됨)

function readDB() {
  try {
    const raw = JSON.parse(localStorage.getItem(DB_KEY));
    if (raw) return raw;
  } catch {}
  return { profiles: {}, friend_requests: [], notifications: [], announcements: [] };
}

function writeDB(db) {
  // 같은 탭에서 쓰면 그 탭에는 storage 이벤트가 안 뜨므로, 필요하면 직접 갱신 함수를 불러 쓴다
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function genCode(db) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (Object.values(db.profiles).some((p) => p.code === code));
  return code;
}

let cachedProfile = null;

// 앱 시작 시 호출: 이 탭의 "내 신원"을 보장한다 (없으면 nickname/dept로 새로 만듦)
export function ensureProfile({ nickname, dept } = {}) {
  let uid = sessionStorage.getItem(UID_KEY);
  if (!uid) {
    uid = crypto.randomUUID();
    sessionStorage.setItem(UID_KEY, uid);
  }
  const db = readDB();
  if (!db.profiles[uid]) {
    if (!nickname) return null; // 아직 온보딩 전
    db.profiles[uid] = { id: uid, code: genCode(db), nickname, dept };
    writeDB(db);
  }
  cachedProfile = db.profiles[uid];
  return cachedProfile;
}

export function getCachedProfile() {
  return cachedProfile;
}

export function findProfileByCode(code) {
  const db = readDB();
  const target = code.trim().toUpperCase();
  return Object.values(db.profiles).find((p) => p.code === target) || null;
}

// friend.js, notifications.js 에서 공용으로 쓰는 저수준 접근 함수들
export function _readDB() { return readDB(); }
export function _writeDB(db) { writeDB(db); }

// 다른 탭에서 데이터가 바뀔 때마다 콜백 실행 (브라우저가 기본 제공하는 storage 이벤트 사용)
export function onRemoteChange(cb) {
  const handler = (e) => { if (e.key === DB_KEY) cb(); };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
