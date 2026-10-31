import * as geo from "./geo.js";
import * as chat from "./chat.js";
import * as store from "./storage.js";
import * as ui from "./ui.js";
import { confirmDialog } from "./dialog.js";   // 앱 디자인 확인 창 (confirm() 대신)
import { runMission, icon } from "./missions.js";
import { getRanking } from "./ranking.js";
import { ensureProfile, getCachedProfile } from "./supa.js";
import { isNicknameTaken, changeNickname, deleteAccount, sendFeedback, NICK_TAKEN_MSG } from "./account.js";   // 내 정보: 닉네임·탈퇴·의견
import { subscribeFriendRequests, getFriendRequest } from "./friend.js";
import { activeKey, pairKey } from "./together.js";   // 함께 돌기 실시간 미션
import { openNotifPanel, closeNotifPanel, refreshBellBadge } from "./notif-ui.js";
import { startAR, MASCOTS, renderHobanuPane } from "./ar.js";   // AR 호반우 (장주연) — 도감 탭은 renderHobanuPane이 dex-tab.js를 불러 그린다
import { listPosts, postCommunity, reportPost, setLike, listComments, addComment, deleteComment,
         setCommentLike, pickBest, toTag } from "./community.js";
import { isHiddenMissionEnabled } from "./settings.js";
import { loadDemo } from "./demo.js";   // 데모(시연) 모드 on/off (관리자 페이지)
import { loadCampusData, campusDataReady, CampusMap } from "./campusmap.js";   // 캠퍼스 일러스트 지도
import * as themes from "./themes.js";
import { applyThemeBg } from "./theme-bg.js";   // 테마별 화면 배경 그림   // 테마(시즌)별 미션

// 호반우 캠퍼스 투어 (장주연): tour.js를 "있으면 쓰는" 방식으로 불러온다.
// tour.js에 문제가 생겨도 import가 실패할 뿐 기존 앱은 그대로 동작한다.
let tour = null;
const tourReady = import("./tour.js")
  .then((m) => {
    if (!m.TOUR_ON) return null;
    tour = m;
    m.initTour({ zones: () => allZones, openZone, goTab, store, ui });   // 투어 코스는 모든 장소 기준 (지금 테마에 없는 장소는 openZone이 안내)
    if (document.body.dataset.view === "home") m.renderQuestCard($("home-tour-slot"));   // 홈의 투어 카드
    return m;
  })
  .catch((e) => { console.warn("[투어] 불러오지 못했어요 — 투어 없이 계속합니다", e); return null; });
const tourItem = (zone) => { try { const it = tour?.menuItem(zone); return it ? [it] : []; } catch { return []; } };

const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).get("debug") === "1";
// 데모 모드: true면 실제 GPS를 쓰지 않고, 구역에 들어올 때마다 "위치 이동" 버튼을 눌러야 미션이 시작됩니다.
// 실제 운영 때는 false로 바꾸세요.
let DEMO_MODE = true;   // 관리자 페이지 "데모 모드" 값으로 시작할 때 바뀐다 (demo.js)
// (장주연) 화면 배치 스위치 — 언제든 false로 바꾸면 예전 모습으로 돌아간다
const FOOD_ON_HOME = true;      // true: 맛집을 홈 "미션 하러 가기" 아래 카드로 / false: 캠퍼스 탐험의 "장소 | 맛집" 탭으로
const OPEN_ALL_PLACES = true;   // true: 장소는 늘 열고 미션만 이번 시즌 것 / false: 이번 시즌에 미션 없는 장소는 잠금

// 소속 목록은 학교 상황에 맞게 수정하세요
const DEPTS = ["인문대학", "사회과학대학", "자연과학대학", "경상대학", "공과대학", "IT대학",
               "AI대학", "농업생명과학대학", "예술대학", "사범대학", "의과대학", "치과대학",
               "수의과대학", "생활과학대학", "간호대학", "약학대학", "첨단기술융합대학", "행정학부",
               "자율전공학부", "공학첨단자율학부"];

// 히든미션: 홈 화면에만 가끔 나타나는 보너스 미션. 지금은 데모용으로 1개만 두고,
// "하루에 한 번"이면 나타날 수 있게 했다. 나중에 특정 시간대 조건을 추가하려면
// storage.js의 isHiddenMissionAvailable() 안에 시각 체크를 더 넣으면 된다.
const HIDDEN_MISSIONS = [
  {
    id: "otter-sincheon",
    emoji: "🦦",
    title: "신천 수달이 나타났어요!",
    desc: "캠퍼스 근처 신천에만 가끔 나타나는 신비한 손님이에요. 지금 바로 만나러 가볼까요?",
    reward: 50,
  },
];

let allZones = [];     // zones.json의 모든 장소
let zones = [];        // 지금 테마에 열린 장소 (미션도 지금 테마 것만)
let lockedZones = [];  // 지금 테마에 없는 장소 (다른 테마에서 열림)
let map = null;          // 장소 화면 지도 (CampusMap)
let campusMap = null;    // 탐험 화면 지도 (CampusMap)
let forceVerify = null;   // 데모 이동 버튼이 인증을 강제로 끝낼 때 사용
let lastClearedSet = new Set(); // 구역 목록에서 "방금 막 깼다" 도장 효과를 보여줄지 판단하는 기준점
let communityBoard = "post";   // "post"(자유게시판) | "question"(질문)
// 맛집은 링크로 공유할 수 있는 따로 된 페이지(restaurant/, js/food-page.js)에서 연다.
// 피크닉 돌림판 결과는 그 메뉴 가게만 모아서 연다 (?menu=pizza) (장주연)
const FOOD_PAGE = "restaurant/";
window.addEventListener("knu:open-restaurants", (e) => {
  const { category } = e.detail || {};
  location.href = FOOD_PAGE + (category ? `?menu=${encodeURIComponent(category)}` : "");
});
const HOT_TAG = "인기글", HOT_LIKES = 5, HOT_COMMENTS = 2;   // #인기글 기준 (장주연)
let communityTag = null;      // 해시태그로 모아 보는 중이면 "일청담" 같은 태그 글자
let communityFilter = "all";   // "all" | "mine" (내 정보 > 내가 쓴 글에서 들어오면 "mine")

/* ================= 구역 이탈 감지(지오펜스) ================= */
// 위치 인증이 끝난 뒤에도 계속 위치를 지켜보다가, 구역 밖으로 나가면 배너로 알려주고
// 미션 시도도 막는다. 실내 GPS 오차 등으로 "weak" 판정이면 무시하고 이전 상태를 유지한다.
let geofenceOn = false;
let inZone = true;
function startZoneGeofence(zone) {
  geofenceOn = true;
  inZone = true;
  // 데모 모드에서는 "위치 이동하기"로 가상 이동한 것이라 실제 GPS와 다르다 → 이탈 감지를 하지 않는다 (장주연)
  if (DEMO_MODE) return;
  geo.startWatch(
    (pos) => {
      if (!geofenceOn) return;
      const r = geo.evaluate(pos, zone);
      updateMarker(pos);
      if (DEBUG) ui.updateDebug(pos, r);
      if (r.status === "weak") return;
      const nowInside = r.status === "inside";
      if (nowInside !== inZone) {
        inZone = nowInside;
        ui.setGeofenceWarning(!inZone, zone.name);
      }
    },
    () => {} // 위치 권한이 없거나 실패해도 흐름이 끊기지 않도록 조용히 무시
  );
}
function stopZoneGeofence() {
  geofenceOn = false;
  inZone = true;
  ui.setGeofenceWarning(false);
}

/* ================= 구역별 배경 테마 ================= */
// zones.json을 따로 건드릴 필요 없이, 구역 순서대로 색을 돌려서 그 구역만의 분위기를 준다.
// 작은 패턴 대신, 부드럽게 번진 색 덩어리(블롭) 2개를 화면 구석에 은은하게 깔아서 장소 느낌을 표현한다.
const ZONE_ACCENTS = ["#d4121a", "#0a9d63", "#2f6fed", "#e8590c", "#8d5fd3", "#d1538a", "#1aa6a6"];
// 블롭이 매번 같은 자리에 있지 않도록 구역마다 위치를 돌려가며 쓴다
const BLOB_LAYOUTS = [
  ["6% -8%", "94% 22%"],
  ["-6% 20%", "100% 74%"],
  ["14% 98%", "90% -6%"],
  ["96% 4%", "2% 60%"],
];

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function buildZoneBlobs(idx, accent) {
  const { r, g, b } = hexToRgb(accent);
  const [p1, p2] = BLOB_LAYOUTS[idx % BLOB_LAYOUTS.length];
  return `radial-gradient(420px 420px at ${p1}, rgba(${r},${g},${b},.24), transparent 72%),` +
         `radial-gradient(360px 360px at ${p2}, rgba(${r},${g},${b},.16), transparent 72%)`;
}

function applyZoneTheme(zone) {
  const idx = Math.max(0, zones.findIndex((z) => z.id === zone.id));
  const accent = ZONE_ACCENTS[idx % ZONE_ACCENTS.length];
  document.documentElement.style.setProperty("--zone-accent", accent);
  document.documentElement.style.setProperty("--zone-blobs", buildZoneBlobs(idx, accent));
}
function resetZoneTheme() {
  document.documentElement.style.removeProperty("--zone-accent");
  document.documentElement.style.removeProperty("--zone-blobs");
}

/* ================= 데일리 퀴즈 문제 은행 ================= */
// 날짜별로 문제가 바뀐다 (같은 날에는 모든 유저가 같은 문제를 봄)
// exp: 답을 고른 뒤 보여 주는 짧은 해설
const QUIZ_BANK = [
  { q: "경북대학교의 상징 마스코트 이름은 무엇일까요?", options: ["황소", "호반우", "호랑이", "곰돌이"], answer: 1, exp: "호반우는 경북대 마스코트예요. 이 앱 곳곳에서 만나는 바로 그 캐릭터!" },
  { q: "경북대학교 대구캠퍼스는 어느 구에 위치해 있을까요?", options: ["중구", "북구", "수성구", "달서구"], answer: 1, exp: "대구캠퍼스 주소는 대구광역시 북구 대학로 80이에요." },
  { q: "경북대학교가 개교한 연도는 언제일까요?", options: ["1946년", "1952년", "1965년", "1980년"], answer: 0, exp: "경북대는 1946년을 개교 연도로 삼고 있어요." },
  { q: "경북대 학생들이 줄여서 '센팍'이라고 부르는 장소는 어디일까요?", options: ["도서관", "센트럴파크", "북문", "대운동장"], answer: 1, exp: "캠퍼스 안 잔디 공원 센트럴파크를 줄여서 '센팍'이라고 불러요." },
  { q: "경북대학교의 영문 약자는 무엇일까요?", options: ["KNU", "SNU", "PNU", "CNU"], answer: 0, exp: "Kyungpook National University의 머리글자예요. SNU는 서울대, PNU는 부산대예요." },
];
const todayQuiz = () => QUIZ_BANK[Math.floor(Date.now() / 86400000) % QUIZ_BANK.length];

function renderDailySection(opts = {}) {
  const checkin = store.getDailyCheckin();
  const quizState = store.getDailyQuizState();
  ui.renderDaily(checkin, quizState, opts);

  // 아래 버튼이나 줄 안의 "오늘" 빈칸, 어느 쪽을 눌러도 도장이 찍힌다
  const checkIn = () => {
    const res = store.doDailyCheckin(10);
    if (res.ok) { ui.reward(res.pts); renderDailySection({ justStamped: true }); }
  };
  $("btn-daily-checkin")?.addEventListener("click", checkIn);
  document.querySelector("#daily-section [data-checkin]")?.addEventListener("click", checkIn);

  $("btn-daily-quiz")?.addEventListener("click", () => {
    const q = todayQuiz();
    ui.showDailyQuiz(q, (i) => {
      const correct = i === q.answer;
      const did = store.completeDailyQuiz(correct, 15);
      if (did && correct) ui.reward(15);
      renderDailySection();
      return correct;
    });
  });
}

/* ================= 시작 ================= */
async function init() {
  try {
    allZones = (await (await fetch("data/zones.json")).json()).zones;
    zones = allZones;
    // 테마: 오늘 날짜(관리자가 정한 기간) 기준으로 지금 테마를 정하고, 그 테마의 장소·미션만 연다
    try {
      await themes.loadThemes();
      ({ active: zones, locked: lockedZones } = themes.splitZones(allZones));
      if (OPEN_ALL_PLACES) {   // (장주연) 모든 장소를 열되, 미션은 이번 시즌 것만 (없으면 빈 목록 → 둘러보기만)
        zones = allZones.map((z) => zones.find((a) => a.id === z.id) || { ...z, missions: [] });
        lockedZones = [];
      }
    } catch (e) {
      console.warn("[테마] 불러오지 못해서 모든 장소를 엽니다", e);
    }
    DEMO_MODE = await loadDemo().catch(() => true);
    applyThemeBg(themes.currentTheme());   // 테마를 못 정했으면 기본(3월) 배경
    // 지도 모양 데이터 (탐험·장소 화면 지도에서 씀). 못 불러와도 지도만 빠지고 앱은 계속 동작한다
    await loadCampusData().catch((e) => console.warn("[지도] 캠퍼스 지도 데이터를 불러오지 못했어요", e));
    // 이미 깨놓은 구역들을 기준점으로 잡아둬서, 첫 화면에서 "방금 깼다" 효과가 잘못 뜨지 않게 한다
    lastClearedSet = new Set(zones.filter(zoneCleared).map((z) => z.id));
  } catch {
    $("view-explore").classList.remove("hidden");
    $("view-explore").innerHTML = `<div class="card">데이터를 불러오지 못했어요.<br>Live Server로 열었는지, data/zones.json 경로가 맞는지 확인해 주세요.</div>`;
    return;
  }
  if (DEBUG) $("debug")?.classList.remove("hidden");

  // 요소가 없어도(예: index.html이 구버전이라 특정 버튼이 빠져있어도) 전체가 멈추지 않도록
  // 모든 연결을 ?.(옵셔널 체이닝)으로 감쌉니다. 요소가 없으면 그 기능만 조용히 빠집니다.
  document.querySelectorAll("#tabbar button").forEach((b) => (b.onclick = () => goTab(b.dataset.tab)));
  $("btn-back")?.addEventListener("click", () => goBack("explore"));
  window.addEventListener("notif:goto", (e) => goTab(e.detail));   // 알림 패널에서 "내 게시글" 알림을 눌렀을 때
  $("btn-map")?.addEventListener("click", toggleMap);

  if (store.hasProfile()) {
    await ensureProfile(store.getState().profile);   // Supabase 프로필 보장 (친구 코드 발급)
    setupNotifications();
    history.scrollRestoration = "manual";
    const start = routeFromHash();
    setEntry("home", {}, 0, ["home"], false);   // 뒤로 가기의 맨 아래는 늘 홈
    if (start === "home") showTab("home");
    else if (start.startsWith("zone:")) {
      const z = zones.find((x) => x.id === start.slice(5));
      z ? openZone(z) : showTab("home");
    } else goTab(start);
  } else {
    showOnboard();     // 가입 화면을 먼저 뒤에 그려 두고
    ui.showSplash();   // 처음 가입 전에만 로고 스플래시를 1초 띄웠다가 걷어낸다
  }
}

// 친구 요청 실시간 반영: 다른 탭(=다른 사용자)의 행동을 이 탭에 즉시 보여준다
let unsubscribeFriend = null;
// 관리자가 새 공지를 올렸을 때도(실시간 구독이 아니라 주기적으로 다시 확인하는 방식으로) 종 배지에 반영한다
let bellPollTimer = null;
function setupNotifications() {
  refreshBellBadge();
  if (unsubscribeFriend) unsubscribeFriend();
  unsubscribeFriend = subscribeFriendRequests({
    onIncoming: () => { ui.toast("새 알림이 도착했어요"); refreshBellBadge(); },
    onConfirmed: async (payload) => {
      const live = findMission(payload.mission_id);
      if (live?.live) {   // 함께 돌기: 완료가 아니라 "같이 시작"
        if (activeKey() === pairKey(live.id, payload.requester_id, payload.partner_id)) {
          ui.toast("친구가 수락했어요! 둘 다 위치 인증하면 시작해요");
          return;
        }
        const req = await getFriendRequest(payload.id);
        ui.toast("친구가 함께 돌기를 수락했어요! 대운동장으로 이동해요");
        joinTogether(live, { partnerId: payload.partner_id, partnerName: req?.partnerNickname || "친구", role: "requester" });
        return;
      }
      ui.toast("친구가 수락했어요! 미션이 완료됐어요");
      const pts = store.completeMission(payload.mission_id, 100) ? 100 : 0;
      if (pts) ui.reward(pts);
      refreshBellBadge();
    },
  });
  if (bellPollTimer) clearInterval(bellPollTimer);
  bellPollTimer = setInterval(refreshBellBadge, 60000);   // 60초마다 새 공지 있는지 확인
}

/* ================= 함께 돌기 (실시간) 연결 ================= */
const findMission = (id) => allZones.flatMap((z) => z.missions).find((x) => x.id === id) || null;
let pendingJoin = null;   // { missionId, partnerId, partnerName, role } — 구역 화면이 열리고 위치 인증 뒤에 바로 세션 시작

// 알림에서 "수락하기"를 누르면(notif-ui.js) 내 앱도 그 장소로 이동해서 함께 시작
window.addEventListener("together:accepted", async (e) => {
  const req = await getFriendRequest(e.detail.requestId);
  const m = req && findMission(req.mission_id);
  if (!m?.live) return;   // 예전 방식 함께하기는 수락만으로 끝
  closeNotifPanel();
  joinTogether(m, { partnerId: req.requester_id, partnerName: req.partnerNickname, role: "partner" });
});

function joinTogether(m, join) {
  if (store.isDone(m.id)) { ui.toast("이미 끝낸 미션이에요"); return; }
  const zone = zones.find((z) => z.missions.some((x) => x.id === m.id));
  if (!zone) { ui.toast("이 미션은 지금 테마에 열려 있지 않아요"); return; }
  pendingJoin = { missionId: m.id, ...join };
  openZone(zone);
}

// 미션에 넘겨주는 도구들 (함께 돌기가 지도·데모 모드를 쓴다)
function missionCtx(extra = {}) {
  return {
    demo: DEMO_MODE,
    map: () => map,
    openMap: () => {
      $("zone-top")?.classList.remove("collapsed");
      if ($("btn-map")) $("btn-map").textContent = "지도 접기";
    },
    ...extra,
  };
}

// 함께 돌기 중에는 일반 구역 이탈 배너 대신 세션이 직접 경고(30초 카운트다운)를 띄운다
async function runMissionIn(zone, m, extra) {
  const live = m.type === "together" && m.live;
  if (live) stopZoneGeofence();
  await runMission(m, zone, missionCtx(extra));
  if (live) startZoneGeofence(zone);
}

function showOnboard() {
  // 오류 문구를 돌려주면 가입 화면에 보여 주고 다시 입력받는다
  ui.renderOnboard(DEPTS, async (profile) => {
    try {
      if (await isNicknameTaken(profile.nickname)) return NICK_TAKEN_MSG;
      await ensureProfile(profile);   // Supabase 프로필 생성 (친구 코드 발급)
    } catch (e) {
      // 같은 닉네임으로 거의 동시에 가입한 경우 (서버의 고유 인덱스가 막음)
      if (e?.code === "23505") return NICK_TAKEN_MSG;
      console.warn("[가입]", e);
      return "가입하지 못했어요. 잠시 후 다시 시도해 주세요.";
    }
    store.saveProfile(profile);
    setupNotifications();
    goTab("home");
    return null;
  });
  ui.showView("onboard");
}

/* ================= 탭 이동 ================= */
// 탭 4개: home(홈) · dex(도감) · community(커뮤니티) · me(내 정보)
// 상세 화면 3개: explore(홈 > 캠퍼스 탐험 지도 > 미션 하러 가기) · rank(커뮤니티 > 내 순위 > 전체 랭킹)
//               board(커뮤니티 > 자유게시판 / 질문 카드)
// 상세 화면의 "‹" 버튼은 자기가 나온 탭으로 돌아간다.
const BACK_TO = { explore: "home", rank: "community", board: "community", feedback: "me", course: "home" };

/* ================= 주소(#)와 뒤로 가기 ================= */
// 탭·상세 화면마다 주소를 붙여서 휴대폰·브라우저의 뒤로 가기가 동작하게 한다 (새로고침해도 보던 화면 유지).
//   홈 = (주소 그대로) · 카메라 #camera · 커뮤니티 #community · 내 정보 #my
//   상세: 캠퍼스 탐험 #explore · 랭킹 #rank · 게시판 #board · 장소 #zone/일청담id · 투어 코스 고르기 #course(홈 위에 시트)
// 기록 쌓는 규칙: 홈이 맨 아래. 홈 → 탭은 쌓고, 탭 → 탭은 바꿔치기(그래서 탭에서 뒤로 가면 늘 홈),
// 상세 화면은 그 위에 쌓는다. 이미 지나온 화면으로 가면(예: 장소 → "다른 장소 보기" → 탐험) 그만큼 뒤로 간다.
// history.state = { nav, route, opts, depth(몇 번째 기록인지, 홈 0), stack(홈부터 지금까지 화면들) }
const ROUTE_HASH = { dex: "camera", community: "community", me: "my", explore: "explore", rank: "rank", board: "board", feedback: "feedback", course: "course" };
const TAB_ROOTS = new Set(["home", "dex", "community", "me"]);
const routeUrl = (route) =>
  route === "home" ? location.pathname + location.search
  : route.startsWith("zone:") ? "#zone/" + encodeURIComponent(route.slice(5))
  : "#" + ROUTE_HASH[route];
function routeFromHash() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (h.startsWith("zone/")) return "zone:" + h.slice(5);
  return Object.keys(ROUTE_HASH).find((k) => ROUTE_HASH[k] === h) || "home";
}
const navState = () => (history.state?.nav ? history.state : null);
function setEntry(route, opts, depth, stack, push) {
  history[push ? "pushState" : "replaceState"]({ nav: true, route, opts, depth, stack }, "", routeUrl(route));
}
let navPending = null;   // history.go()로 뒤로 간 뒤 popstate에서 마저 할 일
// 기록을 정리하고, 지금 바로 화면을 그려야 하면 true (뒤로 가는 중이면 popstate가 그린다)
function navigate(route, opts = {}) {
  const { depth, stack } = navState() || { depth: 0, stack: ["home"] };
  if (route === stack[depth]) { setEntry(route, opts, depth, stack, false); return true; }   // 같은 화면 다시 그리기
  const back = stack.lastIndexOf(route, depth - 1);
  if (back >= 0) { navPending = { route, opts }; history.go(back - depth); return false; }
  if (TAB_ROOTS.has(route)) {
    if (depth <= 1) { setEntry(route, opts, 1, ["home", route], depth === 0); return true; }
    navPending = { route, opts, atTab: true };   // 상세 화면에서 다른 탭으로: 탭 자리(1번)까지 돌아가서 바꿔치기
    history.go(1 - depth);
    return false;
  }
  setEntry(route, opts, depth + 1, [...stack.slice(0, depth + 1), route], true);
  return true;
}
function renderRoute(route, opts = {}) {
  if (route.startsWith("zone:")) {
    const z = zones.find((x) => x.id === route.slice(5));
    return z ? showZone(z) : showTab("explore");
  }
  return showTab(route, opts);
}
window.addEventListener("popstate", (e) => {
  $("modal")?.classList.add("hidden");   // 열려 있던 창(댓글·글쓰기 등)과 알림 패널은 닫고 화면을 바꾼다
  closeNotifPanel();
  if (!store.hasProfile()) return;
  if (navPending) {
    const p = navPending;
    navPending = null;
    const cur = navState() || { depth: 0, stack: ["home"] };
    if (p.atTab) setEntry(p.route, p.opts, 1, ["home", p.route], false);
    else setEntry(p.route, p.opts, cur.depth, cur.stack, false);
    return renderRoute(p.route, p.opts);
  }
  if (!e.state?.nav) {   // 주소창에서 #을 직접 바꾼 경우
    const route = routeFromHash();
    setEntry(route, {}, route === "home" ? 0 : 1, route === "home" ? ["home"] : ["home", route], false);
    return renderRoute(route);
  }
  renderRoute(e.state.route, e.state.opts || {});
});
// 화면 이동은 모두 여기로: 주소·기록을 맞추고 화면을 그린다
function goTab(tab, opts = {}) {
  if (tab === "quest") tab = "explore";   // 예전 이름으로 불러도 동작하게
  if (navigate(tab, opts)) return showTab(tab, opts);
}
// 화면 안의 "‹" 버튼: 앱 안에서 쌓인 기록이 있으면 뒤로, 없으면(주소로 바로 들어온 경우) 부모 화면으로
function goBack(fallback) {
  if ((navState()?.depth || 0) > 0) history.back();
  else goTab(fallback);
}

async function showTab(tab, opts = {}) {
  if (tab === "course") {   // 투어 코스 고르기: 지금 화면(홈·탐험) 위에 코스 시트. 주소로 바로 들어왔으면 홈을 깐다. 닫거나 시작하면 이전 화면으로
    const base = $("view-" + document.body.dataset.view);
    if (!["home", "explore"].includes(document.body.dataset.view) || !base || base.classList.contains("hidden") || !base.childElementCount) await showTab("home");
    const m = await tourReady;
    if (!m) return;
    if (navState()?.route !== "course") return;   // 불러오는 사이에 다른 화면으로 갔으면 열지 않음
    m.openCourseSheet({ onClose: () => { if (navState()?.route === "course") goBack("home"); } });
    return;
  }
  tour?.closeCourseSheet?.();   // 뒤로 가기 등으로 #course를 벗어나면 시트도 닫는다
  leaveZone();
  ui.updateHud();
  clearCampusMap();

  if (tab === "home") {
    const hidden = await activeHiddenMission();
    const theme = themes.currentTheme();
    const specials = themes.todaysSpecials().filter((sp) => !store.isDone(sp.id));
    ui.renderDashboard(zones, () => goTab("explore"), hidden, hidden ? () => startHiddenMission(hidden) : null,
      { theme, period: themes.periodText(theme), specials, onSpecial: startSpecial });
    $("bell-btn").onclick = openNotifPanel;
    ui.showView("home");
    renderDailySection();
    try { tour?.renderQuestCard($("home-tour-slot")); } catch (e) { console.warn("[투어]", e); }   // 투어 카드 (장주연)
    renderFestivalSlot();   // 축제 응원 연습 (관리자가 켰을 때만, 장주연)
    // (장주연) 홈 카드: 맛집 (FOOD_ON_HOME 스위치)
    import("./home-cards.js").then((hc) => {
      if (document.body.dataset.view !== "home") return;
      if (FOOD_ON_HOME) hc.renderFoodCard($("home-food-slot"), () => { location.href = FOOD_PAGE; });
      // "AR 호반우 만나기" 카드는 뺐다 (호반우는 도감에서 만남). 다시 넣으려면 hc.renderArCard($("home-ar-slot"), …)
    }).catch((e) => console.warn("[홈 카드]", e));
    refreshBellBadge();
  } else if (tab === "explore") {
    const mz = zones.filter((z) => z.missions.length);   // 미션이 있는 장소만 진행도에 센다
    const clearedCount = mz.filter(zoneCleared).length;
    ui.renderExplore(clearedCount, mz.length, themes.currentTheme(), { seg: !FOOD_ON_HOME });
    ui.showView("explore");
    initCampusMap(openZone); renderZoneListSection();
    try { tour?.renderQuestCard($("explore-tour-slot"), { entry: true }); } catch (e) { console.warn("[투어]", e); }   // 투어 입구 (장주연)
  } else if (tab === "dex") {
    renderHobanuPane($("view-dex"));   // 도감 화면 (dex-tab.js, 장주연). 못 불러오면 예전 호반우 화면으로 대신 그림
    ui.showView("dex");
    refreshBellBadge();
  } else if (tab === "community") {
    await renderCommunityHome();
    ui.showView("community");
    refreshBellBadge();
  } else if (tab === "board") {
    // opts: { board: "post" | "question", filter: "all" | "mine", tag } — 안 주면 지금 상태 그대로
    if (opts.board) communityBoard = "post";   // 게시판은 자유게시판 하나
    if (opts.board || opts.filter) { communityFilter = opts.filter || "all"; communityTag = opts.tag || null; }
    await renderCommunityTab();
    ui.showView("board");
  } else if (tab === "feedback") {
    ui.renderFeedback(async (category, message) => {
      if (!(await sendFeedback(category, message))) return false;
      ui.toast("소중한 의견 고마워요! 꼼꼼히 확인할게요");
      goBack("me");
      return true;
    });
    ui.showView("feedback");
  } else if (tab === "rank") {
    ui.renderRankView();
    ui.showView("rank");
    showRank(opts.mode || (themes.currentTheme() ? "theme" : "total"));
  } else if (tab === "me") {
    ui.renderMe(allZones, {
      onMyPosts: () => goTab("board", { board: "post", filter: "mine" }),
      onEditNickname: () => ui.showNicknameEditor(store.getState().profile.nickname, async (n) => {
        if (await isNicknameTaken(n)) return NICK_TAKEN_MSG;
        const r = await changeNickname(n);
        if (!r.ok) return r.reason === "taken" ? NICK_TAKEN_MSG
          : r.reason === "invalid" ? "닉네임은 2~10자로 입력해 주세요." : "바꾸지 못했어요. 잠시 후 다시 시도해 주세요.";
        store.saveProfile({ ...store.getState().profile, nickname: r.nickname });
        ui.toast("닉네임을 바꿨어요");
        showTab("me");
        return null;
      }),
      onWithdraw: () => ui.showWithdrawConfirm(async () => {
        if (!(await deleteAccount())) return false;
        store.resetAll();
        location.replace(location.pathname);   // 처음(가입) 화면부터 다시
        return true;
      }),
      onFeedback: () => goTab("feedback"),
    });
    refreshBellBadge();
    ui.showView("me");
  }
  // 상세 화면의 뒤로 버튼 연결
  // (게시판 화면은 글 목록을 다시 그릴 때마다 renderCommunityTab()이 직접 연결한다)
  if (BACK_TO[tab] && tab !== "board") $("view-" + tab)?.querySelector("[data-back]")?.addEventListener("click", () => goBack(BACK_TO[tab]));
}

/* ================= 특별 미션 (홈 화면, 그날 하루만) ================= */
// 예: 만우절 교복 사진 — 사진을 커뮤니티 게시판에 올리면 완료
function startSpecial(sp) {
  if (store.isDone(sp.id)) { ui.toast("이미 완료한 미션이에요"); return; }
  let posted = false;
  ui.showComposer({
    zones: allZones.map((z) => ({ id: z.id, name: z.name })),
    zoneId: null,
    lockZone: false,
    photo: null,
    requirePhoto: true,
    title: `${sp.emoji || "✨"} ${sp.title}`,
    placeholder: `${sp.tag || ""} 오늘의 사진을 소개해 주세요`.trim(),
    initialText: sp.tag ? `${sp.tag} ` : "",
    onSubmit: async (message, photo, zoneId) => {
      const nickname = store.getState().profile?.nickname || "익명";
      const res = await postCommunity(zoneId || null, nickname, message, photo, "post");
      if (res?.ok) posted = true;   // 게시판에 실제로 올라갔을 때만 완료
      return res;
    },
    onClose: () => {
      if (posted && store.completeMission(sp.id, sp.points)) {
        ui.reward(sp.points);
        ui.toast(`${sp.emoji || "✨"} ${sp.title} 완료!`);
      }
      goTab("home");
    },
  });
}

/* ================= 🎉 축제 응원 연습 (홈 화면, 장주연) ================= */
// 관리자 페이지 "히든미션 관리"의 "축제 응원 연습"을 켜면 홈에 나타난다 (축제 2~3주 전부터 켜는 용도).
// 설정 줄이 없으면 꺼짐. 대운동장 AR 응원(휴대폰 흔들기)을 어디서나 연습할 수 있고, 처음 성공하면 +100 XP.
const FESTIVAL = { id: "festival-cheer", reward: 100 };
async function renderFestivalSlot() {
  const slot = $("home-festival-slot");
  if (!slot) return;
  if (!(await isHiddenMissionEnabled(FESTIVAL.id, false))) { slot.innerHTML = ""; return; }
  if (document.body.dataset.view !== "home") return;
  const hc = await import("./home-cards.js");
  hc.renderFestivalCard(slot, {
    doneToday: !store.isHiddenMissionAvailable(FESTIVAL.id),             // 오늘 이미 응원했는지
    reward: store.getState().bonus?.["hidden:" + FESTIVAL.id] ? 0 : FESTIVAL.reward,   // 보너스는 처음 한 번만
    onStart: startFestival,
  });
}
async function startFestival() {
  const base = allZones.find((z) => z.id === "stadium") || { id: "stadium", name: "대운동장", lat: 0, lng: 0 };
  const m = base.missions?.find((x) => x.ar === "cheer") || { id: "m-stadium-ar", ar: "cheer", title: "축제 응원 흔들기" };
  // 응원단장 호반우(깃발 든 호반우)로 등장
  const zone = { ...base, mascot: { name: "응원단장 호반우", img: "img/mascot/cheer.png", lines: ["축제가 코앞이야! 같이 응원 연습하자!", "더 크게! 더 신나게!"] } };
  const r = await startAR(zone, { mission: { ...m, festival: true, title: "축제 응원 연습" } });
  if (r?.done) {
    store.claimHiddenMission(FESTIVAL.id);
    if (store.grantBonus("hidden:" + FESTIVAL.id, FESTIVAL.reward)) { ui.reward(FESTIVAL.reward); ui.toast(`🎉 응원 연습 완료! 보너스 ${FESTIVAL.reward} XP`); }
  }
  await goTab("home");
}

/* ================= 히든미션 (홈 화면) ================= */
// "오늘 아직 안 했는지"(로컬) + "관리자가 켜놨는지"(서버) 둘 다 확인한다
async function activeHiddenMission() {
  const h = HIDDEN_MISSIONS.find((h) => store.isHiddenMissionAvailable(h.id));
  if (!h) return null;
  return (await isHiddenMissionEnabled(h.id)) ? h : null;
}

async function startHiddenMission(h) {
  // "신천 수달"은 일청담 근처라는 설정이라 그 구역의 배경/마스코트를 그대로 쓴다. 나중에 다른 히든미션을 추가하면
  // h에 zoneId 필드를 둬서 여기서 찾아 쓰면 된다.
  const zone = allZones.find((z) => z.id === "ilcheongdam") || { id: "hidden", name: "신천" };
  const r = await startAR(zone, { hidden: "otter" });
  if (r?.otter) {
    store.claimHiddenMission(h.id);
    if (store.grantBonus("hidden:" + h.id, h.reward)) ui.reward(h.reward);
    ui.toast(`✨ ${h.emoji} 신천 수달을 만났어! 보너스 ${h.reward} XP`);
    await goTab("home");   // 카드 갱신 (오늘은 다시 안 뜸)
  }
}

/* ================= 커뮤니티 탭 ================= */
// 첫 화면: 내 순위 + 자유게시판 카드(최근 글 3개). 질문 게시판은 없앴다 (예전 질문 글은 보이지 않음). 카드를 누르면 게시판 상세 화면으로.
async function renderCommunityHome() {
  const posts = await listPosts({ kind: "post", limit: 3 });
  ui.renderCommunityHome(allZones, posts);
  $("view-community").querySelectorAll("[data-open-board]").forEach((b) => {
    b.onclick = () => goTab("board", { board: b.dataset.openBoard });
  });
  $("btn-rank-all")?.addEventListener("click", () => goTab("rank"));
  // 내 순위 카드: 랭킹은 서버에서 받아오니 카드를 먼저 그려 두고 숫자는 받아오는 대로 채운다
  Promise.all([getRanking("total"), getRanking("dept")])
    .then(([t, d]) => ui.fillRankHero(t, d))
    .catch(() => ui.fillRankHero([], []));
}

// 게시판 상세 화면 (자유게시판 / 질문)
async function renderCommunityTab() {
  const isQuestion = communityBoard === "question";
  // 태그가 장소 이름이면 그 장소(zone_id)로 올린 글도 함께 찾는다
  const tagZone = communityTag ? allZones.find((z) => toTag(z.name) === communityTag) : null;
  // #인기글은 해시태그가 아니라 반응으로 모은다: 좋아요 5개 이상 + 댓글 2개 이상 (장주연)
  const hot = communityTag === HOT_TAG;
  let posts = await listPosts({
    kind: communityBoard,
    onlyMine: communityFilter === "mine",
    tag: communityTag && !hot ? { tag: communityTag, zoneId: tagZone?.id || null } : null,
  });
  if (hot) posts = posts.filter((p) => p.like_count >= HOT_LIKES && p.comment_count >= HOT_COMMENTS);
  // 안내 문구 아래 해시태그 줄: #인기글 + 장소 태그
  const tagRow = [HOT_TAG, ...allZones.map((z) => toTag(z.name))];
  const myId = getCachedProfile()?.id || null;
  const byId = new Map(posts.map((p) => [p.id, p]));
  ui.renderCommunity(allZones, posts, { board: communityBoard, filter: communityFilter, tag: communityTag, tagRow, placeTag: !!tagZone }, myId);
  $("view-board").querySelector("[data-back]")?.addEventListener("click", () => goBack("community"));
  // 글쓰기 방법 "?" — 처음 들어오면 한 번 자동으로 (장주연)
  $("view-board").querySelector("[data-help]")?.addEventListener("click", () => ui.showBoardHelp());
  if (communityBoard === "post") {
    let seen = false;
    try { seen = localStorage.getItem("knu-board-help-seen") === "1"; localStorage.setItem("knu-board-help-seen", "1"); } catch {}
    if (!seen) ui.showBoardHelp();
  }
  document.querySelectorAll("#view-board .filter-chip").forEach((b) => {
    b.onclick = () => { communityFilter = "all"; communityTag = null; renderCommunityTab(); };
  });

  // 좋아요는 누르자마자 화면에 반영하고(낙관적 업데이트), 서버 저장에 실패하면 되돌린다
  const pending = new Set();
  const toggleLike = async (p, like = !p.liked) => {
    if (p.guide) { ui.toast("예시 글이라 좋아요를 누를 수 없어요."); return; }
    if (pending.has(p.id) || like === p.liked) return;
    pending.add(p.id);
    p.liked = like;
    p.like_count += like ? 1 : -1;
    ui.updatePostCard(p, { pop: like });
    if (!(await setLike(p.id, like))) {
      p.liked = !like;
      p.like_count += like ? -1 : 1;
      ui.updatePostCard(p);
      ui.toast("좋아요를 반영하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    pending.delete(p.id);
  };

  const openComments = (p) => {
    const nickname = store.getState().profile?.nickname || "익명";
    const q = p.kind === "question";
    ui.showComments({
      myId,
      myName: nickname,
      question: q,
      context: q ? p.message : "",
      readOnly: !!p.guide,
      load: () => (p.guide ? Promise.resolve(structuredClone(p.comments)) : listComments(p.id)),
      add: (text) => addComment(p.id, nickname, text),
      remove: (id) => deleteComment(id),
      likeComment: (id, like) => setCommentLike(id, like),
      // 답변 수·베스트 답변이 바뀌면 목록 카드에도 바로 반영 (시트를 닫았을 때 최신 상태로 보이게)
      onChange: (comments) => {
        p.comment_count = comments.length;
        if (q) p.best = pickBest(comments);
        ui.updatePostCard(p);
      },
    });
  };

  // 사진은 두 번 빠르게 탭하면 좋아요(이미 눌렀으면 하트 효과만). 모바일·PC 모두 click 두 번으로 판단한다.
  let lastTap = { id: null, t: 0 };
  $("view-board").onclick = async (e) => {
    // #해시태그를 누르면 그 태그(장소)의 방문 기록만 모아 본다
    const tagEl = e.target.closest("[data-tag]");
    if (tagEl) {
      // 위쪽 해시태그 줄에서 이미 고른 태그를 다시 누르면 해제
      communityTag = tagEl.closest(".tag-row") && communityTag === tagEl.dataset.tag ? null : tagEl.dataset.tag;
      communityFilter = "all";
      await renderCommunityTab();
      // 고른 태그가 줄 밖에 있으면 보이게 옆으로 밀어 주고, 화면은 맨 위로
      const on = document.querySelector("#view-board .tag-pill.on");
      if (on) { on.parentElement.scrollLeft = on.offsetLeft - on.parentElement.clientWidth / 2 + on.offsetWidth / 2; window.scrollTo({ top: 0, behavior: "smooth" }); }
      return;
    }
    const el = e.target.closest("[data-act]");
    const p = byId.get(el?.closest("[data-post]")?.dataset.post);
    if (!p) return;
    switch (el.dataset.act) {
      case "like": toggleLike(p); break;
      case "comment": openComments(p); break;
      case "photo": {
        const now = Date.now();
        if (lastTap.id === p.id && now - lastTap.t < 320) {
          ui.heartBurst(p.id);
          toggleLike(p, true);
          lastTap = { id: null, t: 0 };
        } else lastTap = { id: p.id, t: now };
        break;
      }
      case "report": {
        if (!(await confirmDialog({ title: "이 글을 신고할까요?", message: "관리자가 확인한 뒤 조치해요.", ok: "신고하기", danger: true }))) return;
        const ok = await reportPost(p.id);
        ui.toast(ok ? "신고가 접수됐어요." : "신고에 실패했어요. 잠시 후 다시 시도해 주세요.");
        break;
      }
    }
  };
  $("btn-compose")?.addEventListener("click", () => {
    ui.showComposer({
      zones: allZones.map((z) => ({ id: z.id, name: z.name })),
      zoneId: null,
      lockZone: false,
      photo: null,
      ...(isQuestion ? { title: "❓ 질문하기", placeholder: "예) 공식당 점심은 몇 시에 제일 붐비나요?" } : {}),
      onSubmit: async (message, photo, zoneId) => {
        const nickname = store.getState().profile?.nickname || "익명";
        return await postCommunity(zoneId || null, nickname, message, photo, communityBoard);
      },
      onClose: () => renderCommunityTab(),
    });
  });
}

// 구역 목록: 직전 렌더 이후 새로 클리어된 구역엔 "통과" 도장 효과를 준다
function renderZoneListSection() {
  const clearedNow = new Set(zones.filter(zoneCleared).map((z) => z.id));
  const justCleared = new Set([...clearedNow].filter((id) => !lastClearedSet.has(id)));
  ui.renderZoneList(zones, store.isDone, justCleared, lockedZones);
  document.querySelectorAll("#zone-list .zone-row").forEach((btn) => {
    btn.onclick = () => {
      const zone = allZones.find((z) => z.id === btn.dataset.zone);
      if (zone) openZone(zone);
    };
  });
  lastClearedSet = clearedNow;
}

// 전체 랭킹 상세 화면 (이번 테마 / 개인 / 단과대)
async function showRank(mode) {
  const theme = themes.currentTheme();
  if (mode === "theme" && !theme) mode = "total";
  const rows = await getRanking(mode, theme ? themeMissionIds(theme) : []);
  if (document.body.dataset.view !== "rank") return;   // 받아오는 사이 다른 화면으로 갔으면 그리지 않음
  ui.renderRankInto($("rank-pane"), rows, mode, showRank, theme);
}
// 테마 랭킹에 들어가는 미션 (장소 미션 + 특별 미션)
const themeMissionIds = (t) => [...t.missions, ...t.special.map((sp) => sp.id)];

/* ================= 구역 화면 ================= */
function leaveZone() {
  geo.stopWatch();
  stopZoneGeofence();
  chat.clear();
  resetZoneTheme();
  if (map) { map.destroy(); map = null; }
}

function clearCampusMap() {
  if (campusMap) { campusMap.destroy(); campusMap = null; }
}

// 구역 부가정보(extraInfo)가 있으면 상단 구역 이름 옆에 ⓘ 버튼을 띄운다 (대화 흐름을 막지 않도록).
// 버튼 엘리먼트는 한 번만 만들어두고 구역이 바뀔 때마다 재사용한다.
function setupZoneInfoBtn(zone) {
  let btn = $("zone-info-btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "zone-info-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", "장소 정보 보기");
    btn.textContent = "ⓘ";
    $("zone-name")?.insertAdjacentElement("afterend", btn);
  }
  if (zone.extraInfo) {
    btn.classList.remove("hidden");
    btn.onclick = () => ui.showZoneInfo({ title: zone.extraInfo.buttonLabel || zone.name, sections: zone.extraInfo.sections });
  } else {
    btn.classList.add("hidden");
  }
}

// 장소 화면 열기: 주소(#zone/id)를 쌓고 그린다. 지금 테마에 없는 장소는 안내만 (주소는 그대로)
function openZone(zone) {
  if (!zones.some((z) => z.id === zone.id)) return showZone(zone);
  if (navigate("zone:" + zone.id)) showZone(zone);
}

function showZone(zone) {
  // 지금 테마의 장소면 그 테마 미션만 담긴 장소로, 아니면 "○○에 열려요" 안내만 (투어 등에서 열 때)
  const opened = zones.find((z) => z.id === zone.id);
  if (!opened) {
    const locked = lockedZones.find((z) => z.id === zone.id);
    ui.toast(`${zone.name}은(는) ${locked?.openTheme ? `'${locked.openTheme.name}' 테마에` : "다른 테마에서"} 열려요`);
    return;
  }
  zone = opened;
  clearCampusMap();
  leaveZone();
  applyZoneTheme(zone);
  ui.showView("zone");
  if ($("zone-name")) $("zone-name").textContent = zone.name;
  setupZoneInfoBtn(zone);
  $("zone-top")?.classList.remove("collapsed");
  if ($("btn-map")) $("btn-map").textContent = "지도 접기";
  initMap(zone);

  // 이 구역의 대화 기록을 저장해 뒀다가, 새로고침하거나 다른 화면 갔다 와도 복원한다
  chat.setPersist((html) => store.saveZoneChat(zone.id, html));
  const savedChat = store.getZoneChat(zone.id);
  const resuming = !!savedChat;
  if (resuming) {
    $("chat").innerHTML = savedChat;
    chat.fixDeadMedia($("chat"));   // 예전에 저장된 깨진 사진·녹음(blob:)은 글자 표시로
    chat.dedupeRepeats();           // 다시 들어올 때마다 쌓였던 똑같은 질문 말풍선은 하나만
    requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  }

  // 한 번 인증한 구역은 (데모 모드여도) 다시 들어올 때 재인증을 요구하지 않는다
  const verified = store.isVerified(zone.id);
  $("btn-skip")?.classList.add("hidden");   // 디버그 버튼은 위치 인증 단계가 시작되면 나타남
  if (verified) ui.setVerified();
  else if ($("status")) {
    $("status").className = "pill";
    $("status").textContent = DEMO_MODE ? "데모 모드예요. 아래 버튼을 눌러 미션 위치로 이동해 보세요." : "위치를 확인하는 중이에요...";
  }

  runZone(zone, resuming);
}

// 구역 대화의 전체 흐름: 인사 → 위치 인증 → 미션 메뉴 → 구역 클리어
// resuming이 true면(저장된 대화가 있으면) 이미 봤던 인사말은 다시 보여주지 않는다
async function runZone(zone, resuming = false) {
  if (!resuming) {
    const introLine = zone.intro ? `<br>${zone.intro}` : "";
    await chat.bot(`오, 여기가 <b>${zone.name}</b>이구나!${introLine}`);
  }

  if (!store.isVerified(zone.id)) {
    if (!resuming) {
      await chat.bot("지도의 <b>빨간 점선 영역</b>으로 와서 위치를 인증해 줘!");
    }

    if (DEMO_MODE) {
      chat.choices([{ label: "출발하기", value: "go" }])
        .then(() => startJourney(zone));
    }

    await verifyLocation(zone);
    // 실제 GPS로 먼저 인증된 경우를 대비해 남은 이동 버튼 제거
    document.querySelectorAll("#chat .row.choices").forEach((el) => el.remove());

    const first = store.grantBonus("arrive:" + zone.id, 10);
    if (first) ui.reward(10);
    // 바로 뒤에 미션 메뉴가 물어보니 "이제 미션 시작해볼까?"는 빼고 결과만
    await chat.bot(`<b>위치 인증 완료!</b>${first ? " <b>+10 XP</b>" : ""}${zone.missions.length ? "" : " 천천히 둘러보자 🙂"}`, { whole: true });

  }
  // 인증 이후에도 계속 위치를 지켜보다가, 구역(반경) 밖으로 나가면 배너로 알리고 미션 진행을 막는다
  startZoneGeofence(zone);
  // 친구가 함께 돌기를 수락했거나(내가 요청) 내가 수락해서 들어온 경우 → 메뉴 없이 바로 세션으로
  const join = pendingJoin && zone.missions.find((x) => x.id === pendingJoin.missionId);
  if (join) {
    const j = pendingJoin;
    pendingJoin = null;
    await runMissionIn(zone, join, { join: j });
  }
  await missionMenu(zone);
}

// 데모: 목표 지점까지의 경로를 보여주고, 실제로 걸어가듯 실시간으로 이동시킨다
// 브라우저 GPS로 현재 위치를 한 번 가져온다 (실패하면 reject)
function getCurrentPositionOnce() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject();
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

// OSRM(보행자 경로) API로 실제 걸을 수 있는 경로를 받아온다. 실패하면 직선 경로로 대체.
async function fetchWalkingRoute(start, end) {
  const url = `https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  const coords = data.routes?.[0]?.geometry?.coordinates;
  if (!coords || !coords.length) throw new Error("no route");
  return coords.map(([lng, lat]) => ({ lat, lng }));
}

// 출발하기: 실제 내 위치 → 목표까지 경로/거리 표시, 위치 인증 버튼 + (데모용) 위치 이동 버튼 제공
async function startJourney(zone) {
  const target = { lat: zone.lat, lng: zone.lng };

  let here;
  try {
    here = await getCurrentPositionOnce();
  } catch {
    here = geo.offsetPoint(target, 180, Math.random() * 360); // GPS를 못 가져오면 임의 지점에서 시작
  }

  let route;
  try {
    route = await fetchWalkingRoute(here, target);
  } catch {
    route = [here, target]; // 경로 API 실패 시 직선으로 대체
  }

  if (map) {
    map.setRoute(route);   // 점선 경로
    map.fit([...route, target], 30);
  }

  let simPos = { ...here, accuracy: 5 };
  updateMarker(simPos);

  while (true) {
    const r = geo.evaluate(simPos, zone);
    if (r.distance <= 20) {
      if ($("status")) {
        $("status").className = "pill ok";
        $("status").textContent = "목표 지점 근처예요! 위치 인증하기를 눌러줘.";
      }
    } else {
      ui.setStatus({ ...r, streak: 0 }, simPos);
    }

    const pick = await chat.choices([
      { label: "위치 인증하기", value: "verify" },
      { label: "위치 이동하기 (데모)", value: "teleport", ghost: true },
    ]);

    if (pick === "teleport") {
      simPos = { ...target, accuracy: 5 };
      updateMarker(simPos);
      if (map) map.fit([target], (zone.radius || 50) + 60);
      continue; // 상태 갱신 후 버튼 다시 노출
    }

    const r2 = geo.evaluate(simPos, zone);
    if (r2.distance <= 20) {
      forceVerify?.();
      return;
    }
    ui.setStatus({ ...r2, streak: 0 }, simPos); // 20m 넘게 떨어져 있으면 화살표+안내 코멘트 다시 표시
  }
}

// 위치 인증이 끝나면 resolve되는 Promise
function verifyLocation(zone) {
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      geo.stopWatch();
      store.setVerified(zone.id);
      ui.setVerified();
      $("btn-skip")?.classList.add("hidden");
      $("zone-top")?.classList.add("collapsed");   // 인증이 끝나면 지도를 접어 대화 공간 확보
      if ($("btn-map")) $("btn-map").textContent = "지도 펴기";
      resolve();
    };
    const verify = geo.createVerifier(zone, 3, finish);
    forceVerify = finish;
    $("btn-skip")?.classList.toggle("hidden", !DEBUG);
    if (DEMO_MODE) return;   // 데모 모드: 실제 GPS 없이 이동 버튼으로만 인증
    geo.startWatch(
      (pos) => {
        if (finished) return;
        const r = verify(pos);
        if (finished) return;              // 방금 인증됐으면 문구를 덮어쓰지 않음
        ui.setStatus(r, pos);
        updateMarker(pos);
        if (DEBUG) ui.updateDebug(pos, r);
      },
      (err) => ui.showLocationError(err.code)
    );
    const skipBtn = $("btn-skip");
    if (skipBtn) skipBtn.onclick = finish;
  });
}

// 미션 선택 메뉴 (챗봇의 선택 버튼)
async function missionMenu(zone) {
  let replay = false;   // 구역 클리어 후 "사진·AR 미션 다시 하기"를 고른 경우 (장주연)
  while (true) {
    const left = zone.missions.filter((m) => !store.isDone(m.id));
    if (!zone.missions.length) {   // (장주연) 이번 시즌 미션이 없는 장소: "미션 없어요" 대신 둘러보기만
      const pick = await chat.choices([
        ...tourItem(zone),
        { label: "다른 장소 보기", value: "explore" },
      ]);
      if (pick === "__tour") tour?.next(zone);
      else goTab("explore");
      return;
    }
    if (!left.length && !replay) {
      if ((await finishZone(zone)) !== "stay") return;
      replay = true;
      continue;
    }

    await chat.bot(
      !left.length
        ? "다시 해 볼 미션을 골라 봐! 📸"
        : left.length === zone.missions.length
        ? "어떤 미션부터 시작할까요?"
        : `남은 미션이 <b>${left.length}개</b> 있어요.`
    );
    const pick = await chat.choices([
      ...zone.missions.map((m) => {
        const doneM = store.isDone(m.id);
        const again = doneM && (m.type === "photo" || m.type === "ar");   // 사진·AR 미션은 끝낸 뒤에도 다시 하기 (장주연)
        return {
          label: `${doneM ? "✓" : icon(m.type)}  ${m.title}  ·  ${again ? "다시 하기" : `+${m.points} XP`}`,
          value: m.id,
          disabled: doneM && !again,
        };
      }),
      ...tourItem(zone),   // 투어 중이면 "다음 장소로 (투어)" (장주연)
      // "호반우 만나기 (AR)"·"장소 목록으로 돌아가기"는 뺐다: 호반우는 도감에서 만나고, 돌아가기는 위쪽 ‹ 버튼으로
    ]);
    if (pick === "__home") { goTab("explore"); return; }
    if (pick === "__tour") { tour?.next(zone); return; }
    if (pick === "__ar") {   // AR 호반우 (장주연): 처음 만나면 +20 XP
      const r = await startAR(zone);
      if (r?.met && store.grantBonus("ar:" + zone.id, 20)) ui.reward(20);
      continue;
    }
    if (!inZone) {
      ui.toast(`${zone.name}에서 멀어졌어요. 구역 안으로 들어와서 다시 시도해 주세요.`);
      continue;
    }
    await runMissionIn(zone, zone.missions.find((m) => m.id === pick));
  }
}

const allCleared = () => zones.filter((z) => z.missions.length).every(zoneCleared);

async function finishZone(zone) {
  if (store.grantBonus("zone:" + zone.id, 50)) {
    ui.reward(50);
    await chat.bot(`<b>${zone.name}</b> 클리어! 🎉 <b>+50 XP</b> · 스탬프 ${zone.emoji}`, { whole: true });
  } else {
    await chat.bot("여긴 이미 다 깬 곳이야!");
  }

  const theme = themes.currentTheme();
  if (allCleared() && store.grantBonus(theme ? "all:" + theme.id : "all", 200)) {
    ui.reward(200);
    await chat.bot(theme
      ? `<b>${theme.emoji} ${theme.name}</b> 테마 완주! 🏆 <b>+200 XP</b>`
      : "<b>전 구역 완주!</b> 🏆 <b>+200 XP</b>", { whole: true });
    ui.showFinale(() => goTab("rank"));
  }

  const canReplay = zone.missions.some((m) => m.type === "photo" || m.type === "ar");
  const next = await chat.choices([
    ...tourItem(zone),   // 투어 중이면 "다음 장소로 (투어)"를 맨 앞에 (장주연)
    { label: "다른 장소 보기", value: "explore" },
    { label: "랭킹 보기", value: "rank" },
    ...(canReplay ? [{ label: "사진·AR 미션 다시 하기", value: "stay", ghost: true }] : []),   // (장주연)
  ]);
  if (next === "__tour") { tour?.next(zone); return; }
  if (next === "stay") return "stay";
  if (next === "rank") goTab("rank");
  else goTab("explore");
}

/* ================= 지도 (캠퍼스 일러스트 지도, campusmap.js) ================= */
// 미션이 없는 장소(이번 시즌 미션 없음)는 "클리어"로 치지 않는다 (장주연)
function zoneCleared(zone) { return zone.missions.length > 0 && zone.missions.every((m) => store.isDone(m.id)); }

// 탐험 화면: 캠퍼스 전체 + 장소 핀. 핀을 누르면 말풍선 → "미션 보기"
function initCampusMap(onSelect) {
  const el = $("campus-map");
  if (!zones.length || !el) return;
  if (!campusDataReady()) { el.textContent = "지도를 불러오지 못했어요. 아래 목록에서 장소를 골라 주세요."; return; }
  campusMap = new CampusMap(el);
  const next = zones.find((z) => z.missions.length && !zoneCleared(z));
  // 지금 테마 장소 + 다른 테마 장소(잠금 핀, 누르면 "○○에 열려요")
  campusMap.setZones([...zones, ...lockedZones], {
    // 이번 시즌 미션이 남은 장소는 반짝이(mission), 미션 없는 장소는 한 톤 죽임(rest) (장주연)
    status: (z) => (z.openTheme !== undefined ? "locked" : zoneCleared(z) ? "cleared"
      : !z.missions.length ? "rest" : z === next ? "next mission" : "mission"),
    lockNote: (z) => (z.openTheme ? `'${z.openTheme.name}' 테마에 열려요` : "다른 테마에서 열려요"),
    onSelect,
  });
}

// 장소 화면: 그 장소 주변으로 확대 + 인증 영역(원/건물 윤곽) + 내 위치
function initMap(zone) {
  if (!campusDataReady() || !$("map")) return;
  map = new CampusMap($("map"), {
    // 디버그: 지도 클릭 = 그 위치로 순간이동
    onMapClick: DEBUG ? (p) => geo.injectMockPosition(p.lat, p.lng) : null,
    labelAt: { big: 0.5, all: 1.0, zone: 0.5 },   // 작은 지도라 덜 확대해도 이름이 보이게
  });
  map.setArea(zone);
  map.setZones([zone], { status: () => (zoneCleared(zone) ? "cleared" : "next") });
  map.fit([zone], (zone.radius || 50) + 60);
}

function updateMarker(pos) {
  map?.setMe(pos);
}

function toggleMap() {
  const zoneTop = $("zone-top");
  if (!zoneTop) return;
  const collapsed = zoneTop.classList.toggle("collapsed");
  if ($("btn-map")) $("btn-map").textContent = collapsed ? "지도 펴기" : "지도 접기";
}

init();