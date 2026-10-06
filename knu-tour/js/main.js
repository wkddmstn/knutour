import * as geo from "./geo.js";
import * as chat from "./chat.js";
import * as store from "./storage.js";
import * as ui from "./ui.js";
import { runMission, icon } from "./missions.js";
import { getRanking } from "./ranking.js";

const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).get("debug") === "1";
const DEMO_MODE = true;   // 데모: "미션 위치로 이동하기" 버튼 표시 (실제 운영 때는 false)

// 소속 목록은 학교 상황에 맞게 수정하세요
const DEPTS = ["인문대학", "사회과학대학", "자연과학대학", "경영대학", "공과대학", "IT대학",
               "농업생명과학대학", "사범대학", "의과대학", "기타"];

let zones = [];
let map = null;
let marker = null;
let forceVerify = null;   // 데모 이동 버튼이 인증을 강제로 끝낼 때 사용

/* ================= 시작 ================= */
async function init() {
  try {
    zones = (await (await fetch("data/zones.json")).json()).zones;
  } catch {
    $("view-home").classList.remove("hidden");
    $("view-home").innerHTML = `<div class="card">데이터를 불러오지 못했어요.<br>Live Server로 열었는지, data/zones.json 경로가 맞는지 확인해 주세요.</div>`;
    return;
  }
  if (DEBUG) $("debug").classList.remove("hidden");

  document.querySelectorAll("#tabbar button").forEach((b) => (b.onclick = () => goTab(b.dataset.tab)));
  $("btn-back").onclick = () => goTab("home");
  $("btn-map").onclick = toggleMap;

  if (store.hasProfile()) goTab("home");
  else showOnboard();
}

function showOnboard() {
  ui.renderOnboard(DEPTS, (profile) => {
    store.saveProfile(profile);
    goTab("home");
  });
  ui.showView("onboard");
}

/* ================= 탭 이동 ================= */
async function goTab(tab) {
  leaveZone();
  ui.updateHud();
  if (tab === "home") ui.renderHome(zones, openZone);
  if (tab === "me") ui.renderMe(zones, onReset);
  if (tab === "rank") await showRank("total");
  ui.showView(tab);
}

async function showRank(mode) {
  ui.renderRank(await getRanking(mode), mode, showRank);
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

function openZone(zone) {
  leaveZone();
  ui.showView("zone");
  $("zone-name").textContent = zone.name;
  $("zone-top").classList.remove("collapsed");
  $("btn-map").textContent = "지도 접기";
  initMap(zone);

  const verified = store.isVerified(zone.id);
  $("btn-skip").classList.add("hidden");   // 디버그 버튼은 위치 인증 단계가 시작되면 나타남
  if (verified) ui.setVerified();
  else { $("status").className = "pill"; $("status").textContent = "위치를 확인하는 중이에요..."; }

  runZone(zone);
}

// 구역 대화의 전체 흐름: 인사 → 위치 인증 → 미션 메뉴 → 구역 클리어
async function runZone(zone) {
  await chat.bot(`<b>${zone.name}</b>에 도착했어요.<br>${zone.intro}`);

  if (!store.isVerified(zone.id)) {
    await chat.bot("먼저 <b>위치 인증</b>이 필요해요.<br>지도의 <b>파란 원</b> 안으로 들어와 주세요.");

    if (DEMO_MODE) {
      await chat.bot("데모 버전이라 아래 버튼으로 바로 이동할 수 있어요.");
      chat.choices([{ label: "미션 위치로 이동하기", value: "go" }])
        .then(() => demoMove(zone));
    }

    await verifyLocation(zone);
    // 실제 GPS로 먼저 인증된 경우를 대비해 남은 이동 버튼 제거
    document.querySelectorAll("#chat .row.choices").forEach((el) => el.remove());

    if (store.grantBonus("arrive:" + zone.id, 10)) ui.reward(10);
    await chat.bot("<b>위치 인증이 완료됐어요.</b><br>도착 보너스 10 XP를 받았어요. 이제 미션을 시작해 볼까요?");
  }
  await missionMenu(zone);
}

// 데모: 미션 위치로 "이동한 것"처럼 연출하고 인증을 완료시킨다
async function demoMove(zone) {
  $("status").className = "pill";
  $("status").textContent = "미션 위치로 이동하는 중이에요...";
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
      $("btn-skip").classList.add("hidden");
      $("zone-top").classList.add("collapsed");   // 인증이 끝나면 지도를 접어 대화 공간 확보
      $("btn-map").textContent = "지도 펴기";
      setTimeout(() => map && map.invalidateSize(), 300);
      resolve();
    };
    const verify = geo.createVerifier(zone, 3, finish);
    forceVerify = finish;
    $("btn-skip").classList.toggle("hidden", !DEBUG);
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
    $("btn-skip").onclick = finish;
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
    if (pick === "__home") { goTab("home"); return; }
    await runMission(zone.missions.find((m) => m.id === pick));
  }
}

const allCleared = () => zones.every((z) => z.missions.every((m) => store.isDone(m.id)));

async function finishZone(zone) {
  if (store.grantBonus("zone:" + zone.id, 50)) {
    ui.reward(50);
    await chat.bot(`<b>${zone.name}</b> 구역을 클리어했어요.<br>구역 보너스 <b>50 XP</b>와 스탬프 ${zone.emoji}를 받았어요.`);
  } else {
    await chat.bot("이 구역은 이미 모두 클리어했어요.");
  }

  if (allCleared() && store.grantBonus("all", 200)) {
    ui.reward(200);
    await chat.bot("<b>모든 구역을 완주했어요.</b><br>완주 보너스 <b>200 XP</b>를 받았어요.");
    ui.showFinale(() => goTab("rank"));
  }

  const next = await chat.choices([
    { label: "다른 구역 보기", value: "home" },
    { label: "랭킹 보기", value: "rank" },
  ]);
  goTab(next);
}

/* ================= 지도 ================= */
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
  const collapsed = $("zone-top").classList.toggle("collapsed");
  $("btn-map").textContent = collapsed ? "지도 펴기" : "지도 접기";
  setTimeout(() => map && map.invalidateSize(), 300);
}

init();
