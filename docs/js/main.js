import * as geo from "./geo.js";
import * as chat from "./chat.js";
import * as store from "./storage.js";
import * as ui from "./ui.js";
import { runMission, icon } from "./missions.js";
import { getRanking } from "./ranking.js";
import { ensureProfile } from "./supa.js";
import { subscribeFriendRequests } from "./friend.js";
import { openNotifPanel, refreshBellBadge } from "./notif-ui.js";

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

/* ================= 시작 ================= */
async function init() {
  try {
    zones = (await (await fetch("data/zones.json")).json()).zones;
  } catch {
    $("view-explore").classList.remove("hidden");
    $("view-explore").innerHTML = `<div class="card">데이터를 불러오지 못했어요.<br>Live Server로 열었는지, data/zones.json 경로가 맞는지 확인해 주세요.</div>`;
    return;
  }
  if (DEBUG) $("debug")?.classList.remove("hidden");

  // 요소가 없어도(예: index.html이 구버전이라 특정 버튼이 빠져있어도) 전체가 멈추지 않도록
  // 모든 연결을 ?.(옵셔널 체이닝)으로 감쌉니다. 요소가 없으면 그 기능만 조용히 빠집니다.
  document.querySelectorAll("#tabbar button").forEach((b) => (b.onclick = () => goTab(b.dataset.tab)));
  $("btn-back")?.addEventListener("click", () => goTab("explore"));
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
  ui.renderOnboard(DEPTS, (profile) => {
    store.saveProfile(profile);
    ensureProfile(profile);   // 이 탭의 신원 생성 (친구 코드 발급)
    setupNotifications();
    goTab("home");
  });
  ui.showView("onboard");
}

/* ================= 탭 이동 ================= */
async function goTab(tab) {
  leaveZone();
  ui.updateHud();
  clearCampusMap();

  const destination = tab === "rank" ? "me" : tab;
  if (destination === "home") {
    ui.renderCampusMap();
    ui.showView("home");
    initCampusMap(openZone);
  } else if (destination === "explore") {
    ui.renderExplore(zones, openZone);
    ui.showView("explore");
  } else if (destination === "me") {
    ui.renderMe(zones, onReset, () => showRank("total"));
    refreshBellBadge();
    ui.showView("me");
    if (tab === "rank") await showRank("total");
  }
}

async function showRank(mode) {
  ui.renderRank(await getRanking(mode), mode, showRank, () => ui.showView("me"));
  ui.showView("rank");
}

function onReset() {
  store.resetAll();
  showOnboard();
}

/* ================= 구역 화면 ================= */
function leaveZone() {
  geo.stopWatch();
  chat.clear();
  if (map) { map.remove(); map = null; marker = null; }
}

function clearCampusMap() {
  if (campusMap) { campusMap.remove(); campusMap = null; }
}

function openZone(zone) {
  clearCampusMap();
  leaveZone();
  ui.showView("zone");
  if ($("zone-name")) $("zone-name").textContent = zone.name;
  $("zone-top")?.classList.remove("collapsed");
  if ($("btn-map")) $("btn-map").textContent = "지도 접기";
  initMap(zone);

  // 데모 모드에서는 이전에 인증한 구역이어도 매번 이동 버튼을 누르게 한다
  const verified = !DEMO_MODE && store.isVerified(zone.id);
  $("btn-skip")?.classList.add("hidden");   // 디버그 버튼은 위치 인증 단계가 시작되면 나타남
  if (verified) ui.setVerified();
  else if ($("status")) {
    $("status").className = "pill";
    $("status").textContent = DEMO_MODE ? "데모 모드예요. 아래 버튼을 눌러 미션 위치로 이동해 보세요." : "위치를 확인하는 중이에요...";
  }

  runZone(zone);
}

// 구역 대화의 전체 흐름: 인사 → 위치 인증 → 미션 메뉴 → 구역 클리어
async function runZone(zone) {
  const introLine = zone.intro ? `<br>${zone.intro}` : "";
  await chat.bot(`오, 여기가 <b>${zone.name}</b>이구나!${introLine}`);

  // 장소에 부가정보(extraInfo)가 있으면 "더 알아보기" 버튼을 띄운다 (누르지 않아도 흐름은 계속 진행됨)
  if (zone.extraInfo) {
    chat.choices([{ label: zone.extraInfo.buttonLabel || "더 알아보기", value: "info", ghost: true }])
      .then(() => showExtraInfo(zone.extraInfo));
  }

  if (DEMO_MODE || !store.isVerified(zone.id)) {
    await chat.bot("일단 <b>위치 인증</b>부터 하자! 지도의 <b>파란 원</b> 안으로 들어와 줘.");

    if (DEMO_MODE) {
      chat.choices([{ label: "위치 이동하기 (데모)", value: "go" }])
        .then(() => demoMove(zone));
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

// 데모: 미션 위치로 "이동한 것"처럼 연출하고 인증을 완료시킨다
async function demoMove(zone) {
  if ($("status")) {
    $("status").className = "pill";
    $("status").textContent = "미션 위치로 이동하는 중이에요...";
  }
  if (map) map.flyTo([zone.lat, zone.lng], 17);
  updateMarker({ lat: zone.lat, lng: zone.lng });
  await new Promise((r) => setTimeout(r, 900));
  forceVerify?.();
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

// 미션 선택 메뉴 (챗봇의 선택 버튼)
async function missionMenu(zone) {
  while (true) {
    const left = zone.missions.filter((m) => !store.isDone(m.id));
    if (!left.length) { await finishZone(zone); return; }

    await chat.bot(
      left.length === zone.missions.length
        ? "어떤 미션부터 시작할까요?"
        : `남은 미션이 <b>${left.length}개</b> 있어요. 다음은 뭘 할까요?`
    );
    const pick = await chat.choices([
      ...zone.missions.map((m) => ({
        label: `${store.isDone(m.id) ? "✓" : icon(m.type)}  ${m.title}  ·  +${m.points} XP`,
        value: m.id,
        disabled: store.isDone(m.id),
      })),
      { label: "구역 목록으로 돌아가기", value: "__home", ghost: true },
    ]);
    if (pick === "__home") { goTab("explore"); return; }
    await runMission(zone.missions.find((m) => m.id === pick));
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
    ui.showFinale(() => goTab("rank"));
  }

  const next = await chat.choices([
    { label: "다른 구역 보기", value: "explore" },
    { label: "랭킹 보기", value: "rank" },
  ]);
  goTab(next);
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
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap",
  }).addTo(campusMap);
  const bounds = [];
  zones.forEach((zone) => {
    const position = [zone.lat, zone.lng];
    bounds.push(position);
    const pin = L.marker(position).addTo(campusMap).bindPopup(`
      <b>${ui.esc(zone.emoji)} ${ui.esc(zone.name)}</b>
      <button type="button" class="map-zone-button">미션 보기</button>`);
    pin.on("popupopen", (event) => {
      event.popup.getElement().querySelector(".map-zone-button").onclick = () => onSelect(zone);
    });
  });
  campusMap.fitBounds(bounds, { padding: [28, 28], maxZoom: 17 });
}

function initMap(zone) {
  map = L.map("map").setView([zone.lat, zone.lng], 17);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap",
  }).addTo(map);
  L.circle([zone.lat, zone.lng], { radius: zone.radius, color: "#3182f6", weight: 2, fillOpacity: 0.12 }).addTo(map);
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
