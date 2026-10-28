import * as geo from "./geo.js";
import * as chat from "./chat.js";
import * as store from "./storage.js";
import * as ui from "./ui.js";
import { runMission, icon } from "./missions.js";
import { getRanking } from "./ranking.js";
import { ensureProfile } from "./supa.js";
import { subscribeFriendRequests } from "./friend.js";
import { openNotifPanel, refreshBellBadge } from "./notif-ui.js";
import { listAnnouncements } from "./notifications.js";
import { startAR, MASCOTS, renderHobanuPane, OTTER_DEMO } from "./ar.js";   // AR 호반우 (장주연)
import { listGuestbook, postGuestbookEntry } from "./guestbook.js";

const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).get("debug") === "1";
// 데모 모드: true면 실제 GPS를 쓰지 않고, 구역에 들어올 때마다 "위치 이동" 버튼을 눌러야 미션이 시작됩니다.
// 실제 운영 때는 false로 바꾸세요.
const DEMO_MODE = true;

// 소속 목록은 학교 상황에 맞게 수정하세요
const DEPTS = ["인문대학", "사회과학대학", "자연과학대학", "경영대학", "공과대학", "IT대학",
               "농업생명과학대학", "사범대학", "의과대학", "기타"];

let zones = [];
let map = null;
let campusMap = null;
let marker = null;
let forceVerify = null;   // 데모 이동 버튼이 인증을 강제로 끝낼 때 사용
let lastClearedSet = new Set(); // 구역 목록에서 "방금 막 깼다" 도장 효과를 보여줄지 판단하는 기준점

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
const ZONE_ACCENTS = ["#d4121a", "#0a9d63", "#2f6fed", "#a86400", "#8d5fd3", "#d1538a", "#1aa6a6"];
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
const QUIZ_BANK = [
  { q: "경북대학교의 상징 마스코트 이름은 무엇일까요?", options: ["황소", "호반우", "호랑이", "곰돌이"], answer: 1 },
  { q: "경북대학교 대구캠퍼스는 어느 구에 위치해 있을까요?", options: ["중구", "북구", "수성구", "달서구"], answer: 1 },
  { q: "경북대학교가 개교한 연도는 언제일까요?", options: ["1946년", "1952년", "1965년", "1980년"], answer: 0 },
  { q: "경북대 학생들이 줄여서 '센팍'이라고 부르는 장소는 어디일까요?", options: ["도서관", "센트럴파크", "북문", "대운동장"], answer: 1 },
  { q: "경북대학교의 영문 약자는 무엇일까요?", options: ["KNU", "SNU", "PNU", "CNU"], answer: 0 },
];
const todayQuiz = () => QUIZ_BANK[Math.floor(Date.now() / 86400000) % QUIZ_BANK.length];

function renderDailySection() {
  const checkin = store.getDailyCheckin();
  const quizState = store.getDailyQuizState();
  ui.renderDaily(checkin, quizState);

  $("btn-daily-checkin")?.addEventListener("click", () => {
    const res = store.doDailyCheckin(10);
    if (res.ok) { ui.reward(res.pts); renderDailySection(); }
  });

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

/* ================= 지도 타일 (라이트/다크 자동 전환) ================= */
// 라이트 모드: 표준 OpenStreetMap(초록/파랑 컬러, 길·건물 이름 다 보임) — API 키 불필요.
// 다크 모드: OSM은 다크 버전이 없어서, Esri의 무료 Dark Gray(바탕) + Reference(라벨) 조합 사용.
const isDarkMode = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

function tileConfig() {
  if (isDarkMode()) {
    const attr = 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors, GIS User Community';
    return {
      base: {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        options: { maxZoom: 19, maxNativeZoom: 16, attribution: attr },
      },
      ref: {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        options: { maxZoom: 19, maxNativeZoom: 16 },
      },
    };
  }
  return {
    base: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      options: {
        maxZoom: 19, subdomains: "abc",
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    },
    ref: null, // 표준 OSM 타일에는 이미 라벨이 포함돼 있어서 별도 레이어가 필요 없음
  };
}

function addBaseTiles(targetMap) {
  const cfg = tileConfig();
  const baseLayer = L.tileLayer(cfg.base.url, cfg.base.options).addTo(targetMap);
  const refLayer = cfg.ref ? L.tileLayer(cfg.ref.url, cfg.ref.options).addTo(targetMap) : null;
  return { baseLayer, refLayer };
}

// 시스템 다크모드가 실시간으로 바뀌면(설정 변경 등) 열려 있는 지도 타일도 같이 바꿔준다
let tileLayers = []; // { targetMap, baseLayer, refLayer } 목록
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  const cfg = tileConfig();
  tileLayers.forEach((entry) => {
    entry.baseLayer.setUrl(cfg.base.url);
    if (entry.refLayer && cfg.ref) entry.refLayer.setUrl(cfg.ref.url);
    else if (entry.refLayer && !cfg.ref) { entry.targetMap.removeLayer(entry.refLayer); entry.refLayer = null; }
    else if (!entry.refLayer && cfg.ref) { entry.refLayer = L.tileLayer(cfg.ref.url, cfg.ref.options).addTo(entry.targetMap); }
  });
});

/* ================= 시작 ================= */
async function init() {
  try {
    zones = (await (await fetch("data/zones.json")).json()).zones;
    // 이미 깨놓은 구역들을 기준점으로 잡아둬서, 첫 화면에서 "방금 깼다" 효과가 잘못 뜨지 않게 한다
    lastClearedSet = new Set(zones.filter((z) => z.missions.every((m) => store.isDone(m.id))).map((z) => z.id));
  } catch {
    $("view-explore").classList.remove("hidden");
    $("view-explore").innerHTML = `<div class="card">데이터를 불러오지 못했어요.<br>Live Server로 열었는지, data/zones.json 경로가 맞는지 확인해 주세요.</div>`;
    return;
  }
  if (DEBUG) $("debug")?.classList.remove("hidden");

  // 요소가 없어도(예: index.html이 구버전이라 특정 버튼이 빠져있어도) 전체가 멈추지 않도록
  // 모든 연결을 ?.(옵셔널 체이닝)으로 감쌉니다. 요소가 없으면 그 기능만 조용히 빠집니다.
  document.querySelectorAll("#tabbar button").forEach((b) => (b.onclick = () => goTab(b.dataset.tab)));
  $("btn-back")?.addEventListener("click", () => goTab("quest"));
  $("btn-map")?.addEventListener("click", toggleMap);
  if ($("bell-btn")) {
    $("bell-btn").onclick = openNotifPanel;
  } else {
    console.warn("[캠퍼스 퀘스트] #bell-btn 요소가 없어요 — index.html이 최신 버전인지 확인해 주세요. 알림 기능은 비활성화됩니다.");
  }

  if (store.hasProfile()) {
    await ensureProfile(store.getState().profile);   // Supabase 프로필 보장 (친구 코드 발급)
    setupNotifications();
    goTab("home");
  } else {
    showOnboard();
  }
}

// 친구 요청 실시간 반영: 다른 탭(=다른 사용자)의 행동을 이 탭에 즉시 보여준다
let unsubscribeFriend = null;
function setupNotifications() {
  refreshBellBadge();
  if (unsubscribeFriend) unsubscribeFriend();
  unsubscribeFriend = subscribeFriendRequests({
    onIncoming: () => { ui.toast("새 알림이 도착했어요"); refreshBellBadge(); },
    onConfirmed: (payload) => {
      ui.toast("친구가 수락했어요! 미션이 완료됐어요");
      const pts = store.completeMission(payload.mission_id, 100) ? 100 : 0;
      if (pts) ui.reward(pts);
      refreshBellBadge();
    },
  });
}

function showOnboard() {
  ui.renderOnboard(DEPTS, async (profile) => {
    store.saveProfile(profile);
    await ensureProfile(profile);   // Supabase 프로필 생성 (친구 코드 발급)
    setupNotifications();
    goTab("home");
  });
  ui.showView("onboard");
}

/* ================= 탭 이동 ================= */
async function goTab(tab, opts = {}) {
  leaveZone();
  ui.updateHud();
  clearCampusMap();

  if (tab === "home") {
    const anns = await listAnnouncements(store.getState().profile?.dept);
    ui.renderDashboard(zones, anns, () => goTab("quest"));
    ui.showView("home");
    renderDailySection();
   } else if (tab === "quest") {
    const clearedCount = zones.filter((z) => z.missions.every((m) => store.isDone(m.id))).length;
    ui.renderQuestShell(clearedCount, zones.length);
    ui.showView("quest");
    initCampusMap(openZone);
    renderZoneListSection();
    wireQuestSegment();
    if (opts.mode === "rank") switchQuestPane("rank");
  } else if (tab === "community") {
    const anns = await listAnnouncements(store.getState().profile?.dept);
    ui.renderCommunity(anns);
    ui.showView("community");
  } else if (tab === "me") {
    ui.renderMe(zones, onReset);
    refreshBellBadge();
    ui.showView("me");
  }
}

// 구역 목록: 직전 렌더 이후 새로 클리어된 구역엔 "통과" 도장 효과를 준다
function renderZoneListSection() {
  const clearedNow = new Set(zones.filter((z) => z.missions.every((m) => store.isDone(m.id))).map((z) => z.id));
  const justCleared = new Set([...clearedNow].filter((id) => !lastClearedSet.has(id)));
  ui.renderZoneList(zones, store.isDone, justCleared);
  document.querySelectorAll("#zone-list .zone-row").forEach((btn) => {
    btn.onclick = () => {
      const zone = zones.find((z) => z.id === btn.dataset.zone);
      if (zone) openZone(zone);
    };
  });
  lastClearedSet = clearedNow;
}

function wireQuestSegment() {
  document.querySelectorAll(".quest-seg button").forEach((b) => {
    b.onclick = () => switchQuestPane(b.dataset.m);
  });
}

function switchQuestPane(mode) {
  document.querySelectorAll(".quest-seg button").forEach((b) => b.classList.toggle("on", b.dataset.m === mode));
  $("quest-map-pane")?.classList.toggle("hidden", mode !== "map");
  $("quest-rank-pane")?.classList.toggle("hidden", mode !== "rank");
  $("quest-hobanu-pane")?.classList.toggle("hidden", mode !== "hobanu");   // 호반우 탭 (장주연)
  if (mode === "rank") showQuestRank("total");
  if (mode === "hobanu") renderHobanuPane($("quest-hobanu-pane"));
}

async function showQuestRank(mode) {
  const rows = await getRanking(mode);
  ui.renderRankInto($("quest-rank-pane"), rows, mode, showQuestRank);
}

function onReset() {
  store.resetAll();
  showOnboard();
}

/* ================= 구역 화면 ================= */
function leaveZone() {
  geo.stopWatch();
  stopZoneGeofence();
  chat.clear();
  resetZoneTheme();
  if (map) {
    tileLayers = tileLayers.filter((t) => t.targetMap !== map);
    map.remove(); map = null; marker = null;
  }
}

function clearCampusMap() {
  if (campusMap) {
    tileLayers = tileLayers.filter((t) => t.targetMap !== campusMap);
    campusMap.remove(); campusMap = null;
  }
}

function openZone(zone) {
  clearCampusMap();
  leaveZone();
  applyZoneTheme(zone);
  ui.showView("zone");
  if ($("zone-name")) $("zone-name").textContent = zone.name;
  $("zone-top")?.classList.remove("collapsed");
  if ($("btn-map")) $("btn-map").textContent = "지도 접기";
  initMap(zone);

  // 이 구역의 대화 기록을 저장해 뒀다가, 새로고침하거나 다른 화면 갔다 와도 복원한다
  chat.setPersist((html) => store.saveZoneChat(zone.id, html));
  const savedChat = store.getZoneChat(zone.id);
  const resuming = !!savedChat;
  if (resuming) {
    $("chat").innerHTML = savedChat;
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

    // 장소에 부가정보(extraInfo)가 있으면 "더 알아보기" 버튼을 띄운다 (누르지 않아도 흐름은 계속 진행됨)
    if (zone.extraInfo) {
      chat.choices([{ label: zone.extraInfo.buttonLabel || "더 알아보기", value: "info", ghost: true }])
        .then(() => showExtraInfo(zone.extraInfo));
    }
  }

  if (!store.isVerified(zone.id)) {
    if (!resuming) {
      await chat.bot("일단 <b>위치 인증</b>부터 하자! 지도의 <b>파란 원</b> 안으로 들어와 줘.");
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
    await chat.bot(
      "좋아, <b>위치 인증 완료</b>!<br>" +
      (first ? "도착 보너스 10 XP 챙겼어. " : "") + "이제 미션 시작해볼까?"
    );

  }
  // 인증 이후에도 계속 위치를 지켜보다가, 구역(반경) 밖으로 나가면 배너로 알리고 미션 진행을 막는다
  startZoneGeofence(zone);
  await missionMenu(zone);
}

// 장소 부가정보를 아코디언(펼침 목록) 형태로 보여준다. 내용은 지금은 자리표시자이며 나중에 채워 넣으면 됩니다.
async function showExtraInfo(info) {
  await chat.ask((card, done) => {
    card.innerHTML = `
      <div class="accordion">
        ${info.sections.map((s, i) => `
          <details${i === 0 ? " open" : ""}>
            <summary>${ui.esc(s.title)}</summary>
            <div class="acc-body">${ui.esc(s.body)}</div>
          </details>`).join("")}
      </div>
      <button class="chip primary" style="margin-top:10px">확인했어요</button>`;
    card.querySelector(".chip").onclick = () => done(true);
  });
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
    const routeColor = getComputedStyle(document.documentElement).getPropertyValue("--zone-accent").trim() || "#d4121a";
    L.polyline(route.map((p) => [p.lat, p.lng]), {
      color: routeColor, weight: 4, opacity: .85, lineCap: "round",
    }).addTo(map);
    map.flyToBounds(route.map((p) => [p.lat, p.lng]), { padding: [30, 30] });
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
      if (map) map.flyTo([target.lat, target.lng], 17);
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
      setTimeout(() => map && map.invalidateSize(), 300);
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

// 구역 방명록 팝업 열기 (목록 불러오고, 글 남기면 새로고침된 목록으로 다시 띄운다)
async function openGuestbook(zone) {
  const entries = await listGuestbook(zone.id);
  ui.showGuestbook(zone.name, entries, async (message, photoFile) => {
    const nickname = store.getState().profile?.nickname || "익명";
    const ok = await postGuestbookEntry(zone.id, nickname, message, photoFile);
    if (ok) await openGuestbook(zone);
    return ok;
  });
}

// 미션 선택 메뉴 (챗봇의 선택 버튼)
async function missionMenu(zone) {
  let replay = false;   // 구역 클리어 후 "사진·AR 미션 다시 하기"를 고른 경우 (장주연)
  while (true) {
    const left = zone.missions.filter((m) => !store.isDone(m.id));
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
        : `남은 미션이 <b>${left.length}개</b> 있어요. 다음은 뭘 할까요?`
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
      ...(MASCOTS[zone.id] ? [{ label: "🐮 호반우 만나기 (AR)", value: "__ar", ghost: true }] : []),
      // 데모용 히든 미션: 일청담에서 신천 수달 만나기 (장주연)
      ...(OTTER_DEMO && zone.id === "ilcheongdam" ? [{ label: "🦦 히든 미션! (데모)", value: "__otter", ghost: true }] : []),
      { label: "📖 방명록", value: "__guestbook", ghost: true },
      { label: "구역 목록으로 돌아가기", value: "__home", ghost: true },
    ]);
    if (pick === "__home") { goTab("quest"); return; }
    if (pick === "__guestbook") { await openGuestbook(zone); continue; }
    if (pick === "__ar" || pick === "__otter") {   // AR 호반우 (장주연): 처음 만나면 +20 XP, 일청담 희귀 수달 +50 XP
      const r = await startAR(zone, pick === "__otter" ? { hidden: "otter" } : {});
      if (r.met && store.grantBonus("ar:" + zone.id, 20)) ui.reward(20);
      if (r.otter && store.grantBonus("otter", 50)) {
        ui.reward(50);
        await chat.bot("✨ 희귀 <b>신천 수달</b>을 만났어! 보너스 <b>50 XP</b>!");
      }
      continue;
    }
    if (!inZone) {
      ui.toast(`${zone.name}에서 멀어졌어요. 구역 안으로 들어와서 다시 시도해 주세요.`);
      continue;
    }
    await runMission(zone.missions.find((m) => m.id === pick), zone);
  }
}

const allCleared = () => zones.every((z) => z.missions.every((m) => store.isDone(m.id)));

async function finishZone(zone) {
  if (store.grantBonus("zone:" + zone.id, 50)) {
    ui.reward(50);
    await chat.bot(`<b>${zone.name}</b> 클리어!<br>구역 보너스 <b>50 XP</b>랑 스탬프 ${zone.emoji} 챙겼어.`);
  } else {
    await chat.bot("여긴 이미 다 깬 곳이야!");
  }

  if (allCleared() && store.grantBonus("all", 200)) {
    ui.reward(200);
    await chat.bot("우와, <b>전 구역 완주</b>했네!<br>완주 보너스 <b>200 XP</b>까지 챙겼어.");
    ui.showFinale(() => goTab("quest", { mode: "rank" }));
  }

  const canReplay = zone.missions.some((m) => m.type === "photo" || m.type === "ar");
  const next = await chat.choices([
    { label: "다른 구역 보기", value: "quest" },
    { label: "랭킹 보기", value: "quest-rank" },
    ...(canReplay ? [{ label: "사진·AR 미션 다시 하기", value: "stay", ghost: true }] : []),   // (장주연)
  ]);
  if (next === "stay") return "stay";
  if (next === "quest-rank") goTab("quest", { mode: "rank" });
  else goTab("quest");
}

/* ================= 지도 ================= */
function initCampusMap(onSelect) {
  if (!zones.length) return;
  if (!window.L) {
    $("campus-map").textContent = "지도를 불러오지 못했어요. 네트워크 연결을 확인해 주세요.";
    return;
  }
  const center = [
    zones.reduce((sum, zone) => sum + zone.lat, 0) / zones.length,
    zones.reduce((sum, zone) => sum + zone.lng, 0) / zones.length,
  ];
  campusMap = L.map("campus-map").setView(center, 16);
  const { baseLayer, refLayer } = addBaseTiles(campusMap);
  tileLayers.push({ targetMap: campusMap, baseLayer, refLayer });

  const bounds = [];
  zones.forEach((zone) => {
    const cleared = zone.missions.every((m) => store.isDone(m.id));
    const position = [zone.lat, zone.lng];
    bounds.push(position);

    L.circle(position, {
      radius: Math.max(zone.radius, 40),
      color: cleared ? "#d4121a" : "#9a8c7c",
      weight: cleared ? 2 : 1,
      fillColor: cleared ? "#d4121a" : "#9a8c7c",
      fillOpacity: cleared ? 0.22 : 0.07,
    }).addTo(campusMap);

    const icon = L.divIcon({
      className: "",
      html: `<div class="zone-pin ${cleared ? "cleared" : ""}">
               <span class="zone-pin-emoji">${ui.esc(zone.emoji)}</span>
               ${cleared ? '<span class="zone-pin-check">✓</span>' : ""}
             </div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -22],
    });

    const pin = L.marker(position, { icon }).addTo(campusMap).bindPopup(`
      <b>${ui.esc(zone.emoji)} ${ui.esc(zone.name)}</b>
      <button type="button" class="map-zone-button">${cleared ? "다시 보기" : "미션 보기"}</button>`);
    pin.on("popupopen", (event) => {
      event.popup.getElement().querySelector(".map-zone-button").onclick = () => onSelect(zone);
    });
  });
  campusMap.fitBounds(bounds, { padding: [28, 28], maxZoom: 17 });
}

function initMap(zone) {
  map = L.map("map").setView([zone.lat, zone.lng], 17);
  const { baseLayer, refLayer } = addBaseTiles(map);
  tileLayers.push({ targetMap: map, baseLayer, refLayer });

  // zone.polygon(건물/길 윤곽 좌표 배열)이 있으면 그 모양 그대로, 없으면 원형 반경으로 표시
  if (zone.polygon && zone.polygon.length >= 3) {
    L.polygon(zone.polygon.map((p) => [p.lat, p.lng]), { color: "#3182f6", weight: 2, fillOpacity: 0.12 }).addTo(map);
  } else {
    L.circle([zone.lat, zone.lng], { radius: zone.radius, color: "#3182f6", weight: 2, fillOpacity: 0.12 }).addTo(map);
  }
  L.marker([zone.lat, zone.lng]).addTo(map).bindPopup(zone.name);

  // 디버그: 지도 클릭 = 그 위치로 순간이동
  if (DEBUG) map.on("click", (e) => geo.injectMockPosition(e.latlng.lat, e.latlng.lng));
}

function updateMarker(pos) {
  if (!map) return;
  if (!marker) marker = L.circleMarker([pos.lat, pos.lng], { radius: 8, color: "#ffffff", weight: 3, fillColor: "#191f28", fillOpacity: 1 }).addTo(map);
  else marker.setLatLng([pos.lat, pos.lng]);
}

function toggleMap() {
  const zoneTop = $("zone-top");
  if (!zoneTop) return;
  const collapsed = zoneTop.classList.toggle("collapsed");
  if ($("btn-map")) $("btn-map").textContent = collapsed ? "지도 펴기" : "지도 접기";
  setTimeout(() => map && map.invalidateSize(), 300);
}

init();