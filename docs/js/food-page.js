// js/food-page.js — 경북대 맛집 지도 페이지 (restaurant/index.html)
// 앱(가입·로그인) 없이 누구나 열 수 있는 독립 페이지라서, 링크로 공유할 수 있다.
//
// 주소창의 쿼리가 곧 화면 상태다 (그대로 복사해도 같은 화면이 열림)
//   ?place=k27359456   그 가게를 골라서 상세 카드까지 연 상태
//   ?theme=cafe        밥집(meal)·카페(cafe)·술집(pub) 중 하나만
//   ?tip=1             선배 꿀팁 가게만
//   ?menu=pizza        센트럴파크 돌림판 메뉴로 모아 보기 (ar-missions.js의 FOOD_WORDS 칸 id)
//   ?gate=north        그 문(정문·북문·쪽문 등, restaurants.json의 gates id) 주변 가게만
import { loadCampusData, campusDataReady, CampusMap } from "./campusmap.js";
import { icon, hasIcon } from "./icons.js";
import { matchFood } from "./ar-missions.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ICON_BACK = `<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>`;
const ICON_SHARE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>`;
// 돌림판 메뉴 이름 (data/restaurants.json의 categories에 없을 때 대비)
const MENU_FALLBACK = { name: "추천 메뉴", emoji: "🍽️" };

const q = new URLSearchParams(location.search);
const st = {
  theme: ["meal", "cafe", "pub"].includes(q.get("theme")) ? q.get("theme") : "all",
  tipOnly: q.get("tip") === "1",
  menu: q.get("menu") || null,
  selId: q.get("place") || null,
  gate: q.get("gate") || null,
};
let data = null;
let map = null;

/* ---------- 주소(공유 링크) ---------- */
// 페이지 주소: <base href="../">라서 상대 경로 대신 지금 문서 주소에서 쿼리만 바꾼다
const pageUrl = (params = {}) => {
  const u = new URL(location.href);
  u.search = "";
  u.hash = "";
  Object.entries(params).forEach(([k, v]) => { if (v) u.searchParams.set(k, v); });
  return u.toString();
};
// 화면 상태가 바뀔 때마다 주소창도 맞춰 둔다 (뒤로 가기 기록은 쌓지 않음)
function syncUrl() {
  history.replaceState(null, "", pageUrl({
    place: st.selId,
    theme: st.theme === "all" ? null : st.theme,
    tip: st.tipOnly ? "1" : null,
    menu: st.menu,
    gate: st.gate,
  }));
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  $("fx").appendChild(t);
  setTimeout(() => t.remove(), 1900);
}

// 휴대폰은 공유 창(카톡·인스타 DM 등), 공유 창이 없는 PC는 링크 복사
async function share({ title, text, url }) {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return; }
    catch (e) { if (e.name === "AbortError") return; }   // 사용자가 공유 창을 닫은 경우
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("🔗 링크를 복사했어요");
  } catch {
    window.prompt("아래 링크를 복사해 주세요", url);
  }
}

/* ---------- 데이터 ---------- */
// 위치가 확인된 가게만, 같은 가게(같은 카카오맵 링크)는 한 번만
function allPlaces() {
  const seen = new Set();
  return data.restaurants.filter((r) => {
    if (!r.lat || !r.theme || (r.url && seen.has(r.url))) return false;
    if (r.url) seen.add(r.url);
    return true;
  });
}
const visible = () => allPlaces().filter((r) =>
  (st.theme === "all" || r.theme === st.theme) && (!st.tipOnly || r.tip) && (!st.menu || matchFood(r, st.menu)));
// 문별로 보기: 고른 문(gate id) 주변 가게만. 문 이름은 restaurants.json의 gates에서 찾는다
const gateName = (id) => data.gates?.find((g) => g.id === id)?.name || null;
const byGate = (list) => (st.gate ? list.filter((r) => r.area === gateName(st.gate)) : list);
const menuInfo = () => data.categories?.find((c) => c.id === st.menu) || MENU_FALLBACK;
const emojiOf = (r) => hasIcon(r.theme) ? icon(r.theme) : (data.themes?.find((t) => t.id === r.theme)?.emoji || "🍽️");

/* ---------- 그리기 ---------- */
function renderShell() {
  $("page").innerHTML = `
    <div class="subbar">
      <a class="icon-btn" id="fp-back" href="./" aria-label="OnCampus로 돌아가기">${ICON_BACK}</a>
      <h1>학교 근처 맛집</h1>
      <button type="button" class="icon-btn fp-share" id="fp-share-page" aria-label="이 페이지 공유하기">${ICON_SHARE}</button>
    </div>
    <p class="map-guide">선배 꿀팁 맛집과 경북대 문 주변 가게를 모았어요. 핀이나 목록을 누르면 자세히 볼 수 있고, 가게마다 링크로 공유할 수 있어요.</p>
    <div id="campus-map" role="application" aria-label="경북대 주변 맛집 지도"></div>
    <div id="food-pane"></div>`;

  // 앱에서 들어왔으면 뒤로 가기, 공유 링크로 바로 들어왔으면 앱 첫 화면으로
  $("fp-back").onclick = (e) => {
    if (document.referrer.startsWith(location.origin) && history.length > 1) { e.preventDefault(); history.back(); }
  };
  $("fp-share-page").onclick = () => share({
    title: "OnCampus · 경북대 맛집 지도",
    text: "경북대 선배 꿀팁 맛집과 정문·북문·쪽문 주변 가게 지도",
    url: pageUrl({ theme: st.theme === "all" ? null : st.theme, tip: st.tipOnly ? "1" : null, menu: st.menu, gate: st.gate }),
  });
}

function renderPane(all) {
  const list = byGate(all);
  const sel = list.find((r) => r.id === st.selId) || null;
  const themes = data.themes || [];
  const gates = (data.gates || []).map((g) => g.name);
  const groups = gates.map((g) => [g, list.filter((r) => r.area === g)]).filter(([, rs]) => rs.length);
  // 문별 탐색 칩: 지금 필터(종류·선배추천·메뉴)에 맞는 가게 수를 문마다 보여 준다
  const gateChips = (data.gates || []).map((g) => [g, all.filter((r) => r.area === g.name).length]).filter(([, n]) => n);
  const menu = st.menu ? menuInfo() : null;
  const row = (r) => `
    <button type="button" class="food-row ${r.id === st.selId ? "on" : ""}" data-rest="${esc(r.id)}">
      <span class="food-emoji" aria-hidden="true">${emojiOf(r)}</span>
      <span class="food-body">
        <strong>${esc(r.name)}${r.tip ? ` <span class="food-tip">⭐ 선배추천</span>` : ""}</strong>
        <span class="food-kind">${esc(r.kind || "")}</span>
        ${r.tip ? `<span class="food-cmt">${esc(r.comment)}</span>` : ""}
      </span>
    </button>`;
  $("food-pane").innerHTML = `
    ${menu ? `<button type="button" class="filter-chip" data-menuoff>${esc(menu.emoji)} 돌림판 메뉴 <b>${esc(menu.name)}</b> 가게만 보는 중 <span aria-hidden="true">✕</span><span class="sr-only">모아 보기 끄기</span></button>` : ""}
    <div class="food-filters" role="group" aria-label="맛집 종류">
      <button type="button" data-theme="all" class="${st.theme === "all" ? "on" : ""}">전체</button>
      ${themes.map((t) => `<button type="button" data-theme="${t.id}" class="${st.theme === t.id ? "on" : ""}">${hasIcon(t.id) ? icon(t.id, { size: 20, cls: "jelly-inline" }) : t.emoji} ${esc(t.name)}</button>`).join("")}
      <button type="button" data-tip class="tip ${st.tipOnly ? "on" : ""}" aria-pressed="${st.tipOnly}">⭐ 선배추천</button>
    </div>
    ${sel ? `
    <div class="card food-detail" id="food-detail">
      <div class="food-detail-top">
        <span class="food-emoji lg" aria-hidden="true">${emojiOf(sel)}</span>
        <div style="min-width:0">
          <div class="sum-label">${esc(sel.area)} · ${esc(sel.kind || "")}</div>
          <div class="sum-big" style="font-size:20px">${esc(sel.name)}</div>
        </div>
        <button type="button" class="cm-x" data-close aria-label="닫기">✕</button>
      </div>
      ${sel.tip ? `<div class="food-quote"><b>⭐ 선배 꿀팁</b>${esc(sel.comment)}</div>` : `<p class="food-note">${esc(sel.comment)}</p>`}
      <div class="food-addr">${esc(sel.address)}</div>
      <div class="fp-actions">
        <button type="button" class="btn alt" data-share-place>${ICON_SHARE} 공유하기</button>
        <a class="btn" href="${esc(sel.url)}" target="_blank" rel="noopener">카카오맵에서 보기</a>
      </div>
    </div>` : ""}
    <h3 class="sec">맛집 목록 <small class="food-count">${list.length}곳</small></h3>
    ${gateChips.length > 1 ? `
    <div class="food-filters gate-chips" role="group" aria-label="문별로 보기">
      <button type="button" data-gate="" class="${st.gate ? "" : "on"}">전체 <span>${all.length}</span></button>
      ${gateChips.map(([g, n]) => `<button type="button" data-gate="${esc(g.id)}" class="${st.gate === g.id ? "on" : ""}">${esc(g.name)} <span>${n}</span></button>`).join("")}
    </div>` : ""}
    ${groups.length ? groups.map(([g, rs]) => `
      <h4 class="food-gate">${esc(g)} <span>${rs.length}</span></h4>
      <div class="list-card">${rs.map(row).join("")}</div>`).join("")
      : `<div class="card" style="text-align:center"><p style="color:var(--mute);margin:0">조건에 맞는 가게가 없어요</p></div>`}
    <p class="food-src">가게 위치·정보: 카카오맵 (2026년 10월 기준). ⭐ 표시가 없는 가게는 카카오맵 검색 상위 가게예요.</p>
    <a class="btn alt fp-app" href="./">🐮 OnCampus에서 캠퍼스 미션 하러 가기</a>`;

  const pane = $("food-pane");
  pane.querySelectorAll("[data-theme]").forEach((b) => (b.onclick = () => { st.theme = b.dataset.theme; st.menu = null; update(); }));
  pane.querySelector("[data-tip]").onclick = () => { st.tipOnly = !st.tipOnly; update(); };
  pane.querySelectorAll("[data-gate]").forEach((b) => (b.onclick = () => {
    st.gate = b.dataset.gate || null;
    update();
    $("campus-map")?.scrollIntoView({ behavior: "smooth", block: "start" });   // 고른 문 주변이 지도에 보이게
  }));
  pane.querySelector("[data-menuoff]")?.addEventListener("click", () => { st.menu = null; update(); });
  pane.querySelectorAll("[data-rest]").forEach((b) => (b.onclick = () => select(b.dataset.rest, true)));
  pane.querySelector("[data-close]")?.addEventListener("click", () => { st.selId = null; update(); });
  pane.querySelector("[data-share-place]")?.addEventListener("click", () => share({
    title: `${sel.name} · OnCampus 맛집`,
    text: `${sel.name} (경북대 ${sel.area})\n${sel.tip ? `⭐ 선배 꿀팁: ${sel.comment}` : sel.kind || ""}`,
    url: pageUrl({ place: sel.id }),
  }));
}

function renderMap(list) {
  if (!map && campusDataReady() && $("campus-map")) map = new CampusMap($("campus-map"));
  if (!map) return;
  // 캠퍼스 밖은 길이 거의 안 그려져 있어서, 북문·정문 같은 문 위치(🚪)도 함께 꽂아 방향을 잡기 쉽게 한다
  const gatePins = (data.gates || []).map((g) => ({ ...g, id: "gate-" + g.id, emoji: "🚪", gate: true }));
  const themeEmoji = (r) => data.themes?.find((t) => t.id === r.theme)?.emoji || "🍽️";
  map.setZones([...gatePins, ...list.map((r) => ({ ...r, emoji: themeEmoji(r), icon: r.theme }))], {
    status: (r) => r.gate ? "gate" : ["food", r.tip ? "tip" : "", r.id === st.selId ? "sel" : ""].join(" "),
    onSelect: (r) => { if (!r.gate) select(r.id, false); },
    bubble: false,
    // 북문처럼 가게가 몰린 곳은 숫자 동그라미로 묶고, 누르면 확대해서 풀어 준다 (문 표시·선택한 가게는 안 묶음)
    cluster: { radius: 46, skip: (z) => z.gate || z.id === st.selId },
  });
  const sel = list.find((r) => r.id === st.selId);
  if (sel) map.fit([sel], 220);   // 너무 확대하면 캠퍼스 밖은 빈 땅처럼 보여서, 근처 문·가게가 함께 보이게
  else if (list.length) map.fit(list, 40);
}

function update() {
  if (st.gate && !gateName(st.gate)) st.gate = null;   // 없는 문 id가 링크에 들어 있으면 무시
  let list = visible();
  if (st.selId && !list.some((r) => r.id === st.selId)) {
    // 공유 링크로 들어온 가게가 필터에 걸려 안 보이면 필터를 풀어서라도 보여준다
    const hit = allPlaces().find((r) => r.id === st.selId);
    if (hit) { st.theme = "all"; st.tipOnly = false; st.menu = null; st.gate = null; return update(); }
    st.selId = null;
  }
  // 고른 문에 지금 필터(예: 선배추천)로 남는 가게가 없으면 문 선택을 푼다 (빈 화면에 갇히지 않게)
  if (st.gate && !byGate(list).length) st.gate = null;
  // 고른 가게가 다른 문 쪽이면 문 선택을 풀어서 보여준다
  if (st.selId && st.gate && !byGate(list).some((r) => r.id === st.selId)) st.gate = null;
  const sel = list.find((r) => r.id === st.selId);
  document.title = sel ? `${sel.name} · OnCampus 맛집` : "경북대 맛집 지도 · OnCampus";
  renderPane(list);
  renderMap(byGate(list));
  syncUrl();
}

// 가게 선택: 지도를 그 가게로 옮기고 지도 아래 상세 카드를 띄운다.
// 목록에서 눌렀으면(fromList) 지도와 상세 카드가 보이도록 위로 올려 준다.
function select(id, fromList) {
  st.selId = id;
  update();
  const target = fromList ? $("campus-map") : $("food-detail");
  target?.scrollIntoView({ behavior: "smooth", block: fromList ? "start" : "nearest" });
}

async function init() {
  renderShell();
  try {
    [data] = await Promise.all([
      fetch("data/restaurants.json").then((r) => r.json()),
      loadCampusData().catch(() => null),   // 지도를 못 불러와도 목록은 보여준다
    ]);
  } catch {
    $("food-pane").innerHTML = `<div class="card">맛집 정보를 불러오지 못했어요. 잠시 후 다시 열어 주세요.</div>`;
    return;
  }
  if (!Array.isArray(data.restaurants)) data.restaurants = [];
  if (!campusDataReady()) $("campus-map").textContent = "지도를 불러오지 못했어요. 아래 목록을 봐 주세요.";
  update();
  // 공유 링크로 특정 가게를 열었으면 상세 카드가 보이게
  if (st.selId) requestAnimationFrame(() => $("food-detail")?.scrollIntoView({ block: "center" }));
}

init();
