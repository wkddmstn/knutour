import { icon, zoneIcon, hasIcon } from "./icons.js";   // 동글동글 젤리 아이콘
import { heroHtml } from "./hero.js";   // 홈 대표 카드의 움직이는 산책 그림
import { getState, isDone, getLevel, getLevelTable, getLevelLog } from "./storage.js";
import { getCachedProfile } from "./supa.js";
import { pickBest, toTag } from "./community.js";

const $ = (id) => document.getElementById(id);

// 사용자가 입력한 문자열(닉네임 등)을 HTML에 넣을 때는 반드시 esc()를 거친다
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- 화면 전환 ---------- */
// 탭 화면 4개(home·dex·community·me) + 카드 버튼으로 여는 상세 화면(explore·rank) + 구역(zone)
const VIEWS = ["onboard", "home", "dex", "community", "me", "explore", "rank", "board", "zone"];
// 상세 화면에 있을 때 탭바에서 어느 탭을 켜 둘지 (어느 탭에서 들어왔는지 보이게)
const PARENT_TAB = { explore: "home", rank: "community", board: "community" };
export function showView(name) {
  VIEWS.forEach((v) => $("view-" + v)?.classList.toggle("hidden", v !== name));
  document.body.dataset.view = name;
  const tab = PARENT_TAB[name] || name;
  document.querySelectorAll("#tabbar button").forEach((b) =>
    b.classList.toggle("on", b.dataset.tab === tab));
  window.scrollTo({ top: 0, behavior: "instant" });
}

// 상세 화면 맨 위의 "‹ 제목" 줄. 뒤로 버튼은 data-back으로 찾아서 main.js가 연결한다
const ICON_BACK = `<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>`;
function subHeader(title, right = "") {
  return `<div class="subbar">
    <button type="button" class="icon-btn" data-back aria-label="뒤로 가기">${ICON_BACK}</button>
    <h1>${esc(title)}</h1>${right}
  </div>`;
}

// 작은 메뉴 카드: 제목 + 한 줄 설명 + 오른쪽 화살표. 탭 안의 "나머지 카드"들은 전부 이 모양으로 맞춘다
function menuCard(id, title, sub = "", { icon = "" } = {}) {
  return `<button type="button" class="menu-card" id="${id}">
    ${icon ? `<span class="mc-icon">${icon}</span>` : ""}
    <span class="mc-body"><b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</span>
    <span class="mc-arrow" aria-hidden="true">›</span>
  </button>`;
}

/* ---------- 레벨 업 알림 ---------- */
// 상단 고정 바(레벨·XP 표시)는 없앴다. 레벨·XP는 홈 "진행 상황" 카드와 내 정보 탭에서 보여주고,
// 여기서는 점수가 바뀔 때 레벨이 올랐는지만 확인해서 알려준다.
let lastLevel = 0;
export function updateHud() {
  const lv = getLevel(getState().score);
  if (lastLevel && lv.level > lastLevel) toast(`레벨 업! Lv.${lv.level}이 되었어요`);
  lastLevel = lv.level;
}

/* ---------- 알림 ---------- */
export function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  $("fx").appendChild(t);
  setTimeout(() => t.remove(), 1900);
}

// 점수를 얻었을 때: 조용한 알림 + XP 갱신
export function reward(pts) {
  toast(`+${pts} XP`);
  updateHud();
}

/* ---------- 첫 실행 스플래시 ---------- */
// 처음 가입하기 전에만: 화면 가운데 로고 + "OnCampus"를 1초쯤 보여주고 사라진다.
// 가입 화면은 미리 뒤에 그려 두고 그 위를 덮었다가 걷어내서, 넘어가는 순간이 매끄럽게 보이게 한다.
export function showSplash(ms = 1000) {
  const el = document.createElement("div");
  el.className = "splash";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "OnCampus");
  el.innerHTML = `<img class="splash-logo" src="img/logo.png" alt=""><div class="splash-name">OnCampus</div>`;
  document.body.appendChild(el);
  return new Promise((resolve) => {
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => { el.remove(); resolve(); }, 350);   // .splash.out 페이드 시간과 맞춤
    }, ms);
  });
}

/* ---------- 온보딩 ---------- */
export function renderOnboard(depts, onSubmit) {
  $("view-onboard").innerHTML = `
    <div class="onb-scene">
      <svg class="onb-skyline" viewBox="0 0 400 90" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,90 L0,55 L22,55 L22,32 L48,32 L48,55 L74,55 L74,14 L86,14 L86,4 L98,14 L98,55 L134,55
                 L134,40 L162,40 L162,55 L196,55 L196,22 L210,22 L210,10 L224,22 L224,55 L258,55
                 L258,36 L284,36 L284,55 L320,55 L320,46 L346,46 L346,55 L400,55 L400,90 Z"
              fill="none" stroke="var(--primary)" stroke-opacity="0.16" stroke-width="2"/>
      </svg>
      <img class="onb-logo" src="img/logo.png" alt="OnCampus 로고">
    </div>
    <p class="onb-brand">OnCampus</p>
    <h1 class="onb-title">캠퍼스를 걸으며<br>미션을 클리어해요</h1>
    <p class="onb-sub">구역마다 위치를 인증하고, 사진·음성·퀴즈 미션을 수행해 보세요.<br>모은 점수로 랭킹에도 도전할 수 있어요.</p>
    <div class="card">
      <label class="field">닉네임
        <input id="in-nick" maxlength="10" placeholder="2~10자로 입력해 주세요" autocomplete="off">
      </label>
      <label class="field">소속
        <select id="in-dept">${depts.map((d) => `<option>${esc(d)}</option>`).join("")}</select>
      </label>
      <p id="onb-err" class="err"></p>
      <button id="btn-start" class="btn">시작하기</button>
    </div>
    <p class="onb-privacy">시작하면 <a href="privacy.html" target="_blank" rel="noopener">접속 기록 · 개인정보 안내</a>에 동의한 것으로 봐요.</p>`;
  const submit = () => {
    const nickname = $("in-nick").value.trim();
    if (nickname.length < 2) { $("onb-err").textContent = "닉네임은 2자 이상 입력해 주세요."; return; }
    onSubmit({ nickname, dept: $("in-dept").value });
  };
  $("btn-start").onclick = submit;
  $("in-nick").onkeydown = (e) => { if (e.key === "Enter") submit(); };
}

/* ---------- 홈: 대시보드 ---------- */
// hidden: 지금 활성화된 히든미션 정보({emoji,title,desc}) 또는 null. onHidden: "만나러 가기" 버튼 핸들러.
// 공지사항은 홈에 따로 두지 않고 종(알림창)에서만 보여준다.
/* ---------- 홈: 캠퍼스 탐험 지도(대표 카드) · 데일리 · 투어 · 히든미션 ---------- */
// 홈은 "오늘 뭐 하지?"에 답하는 화면. 지도·장소 목록 같은 디테일은 "미션 하러 가기"를 눌러야 열린다.
// 진행 상황은 미션 개수가 아니라 장소 단위(그 장소의 미션을 다 깼는지)로 센다 (장소마다 미션 수가 달라서).
// themeInfo: { theme, period, specials, onSpecial } — 지금 테마 이름·기간, 오늘의 특별 미션
export function renderDashboard(zones, onGoExplore, hidden = null, onHidden = null, themeInfo = {}) {
  const { theme = null, period = "", specials = [], onSpecial = null } = themeInfo;
  const st = getState();
  const nextZone = zones.find((z) => z.missions.some((m) => !isDone(m.id)));

  $("view-home").innerHTML = `
    <div class="home-head">
      <!-- 알림은 앱의 출발점인 홈 머리 오른쪽에 둔다. 다른 탭에선 하단 "홈" 탭의 빨간 점으로 새 알림을 알린다 -->
      <button id="bell-btn" class="bell-btn" type="button" aria-label="알림 보기">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>
        <span id="bell-badge" class="bell-badge hidden">0</span>
      </button>
      <h1 class="onb-title" style="font-size:22px">${esc(st.profile.nickname)}님, 안녕하세요!</h1>
      <p class="map-guide">오늘도 캠퍼스를 채워볼까요?</p>
    </div>
    ${specials.map((sp) => `
    <div class="card special-card">
      <div class="sum-label">🎉 오늘만 열리는 특별 미션</div>
      <div class="sum-big" style="font-size:18px">${esc(sp.emoji || "✨")} ${esc(sp.title)}</div>
      <p class="sum-foot" style="margin:6px 0 12px">${esc(sp.desc || "")}</p>
      <button class="btn cta-glow" data-special="${esc(sp.id)}">사진 올리고 +${sp.points} XP</button>
    </div>`).join("")}
    <div class="card card-hero quest-map-card hero-${["cherry", "midterm"].includes(theme?.id) ? theme.id : "march"}">
      ${theme?.id === "cherry" ? `<img class="hero-petal" src="img/hobanu/petal.png" alt="">` : ""}
      ${theme ? `<div class="theme-badge"><span>${esc(theme.emoji || "")} ${esc(theme.name)}</span>${period ? `<small>${esc(period)}</small>` : ""}</div>` : ""}
      ${heroHtml(theme, nextZone)}
      <button id="btn-go-quest" class="btn cta-glow">${nextZone ? "미션 하러 가기" : "다시 둘러보기"}</button>
    </div>
    <div id="home-food-slot"></div>
    <div id="daily-section"></div>
    <div id="home-tour-slot"></div>
    <div id="home-ar-slot"></div>
    ${hidden ? `
    <div class="card hidden-mission-card">
      <div class="sum-label">✨ 히든미션</div>
      <div class="sum-big" style="font-size:18px">${esc(hidden.emoji)} ${esc(hidden.title)}</div>
      <p class="sum-foot" style="margin:6px 0 12px">${esc(hidden.desc)}</p>
      <button id="btn-hidden-mission" class="btn cta-glow">만나러 가기</button>
    </div>` : ""}`;
  $("btn-go-quest").onclick = onGoExplore;
  if (hidden) $("btn-hidden-mission").onclick = onHidden;
  document.querySelectorAll("#view-home [data-special]").forEach((b) => {
    b.onclick = () => onSpecial?.(specials.find((sp) => sp.id === b.dataset.special));
  });
}

/* ---------- 캠퍼스 탐험 (홈 카드의 "미션 하러 가기"로 여는 상세 화면): 지도 · 장소 목록 ---------- */
// mode: "zones"(미션 장소) | "food"(맛집), theme: 지금 시즌 테마(themes.js, 장소 화면 안내에 표시). 위쪽 전환 버튼은 data-mode, 맛집 화면의 필터·목록은 renderFood()가 채운다.
export function renderExplore(cleared = 0, total = 0, mode = "zones", theme = null, { seg = true } = {}) {
  const food = mode === "food";
  // seg=false (장주연): 맛집이 홈 카드로 빠졌을 때는 "장소 | 맛집" 탭을 숨기고 제목만 바꾼다
  $("view-explore").innerHTML = `
    ${subHeader(food && !seg ? "학교 근처 맛집" : "캠퍼스 탐험", food ? "" : `<span class="qm-chip">${cleared} / ${total} 장소</span>`)}
    <div class="seg${seg ? "" : " hidden"}" role="tablist" style="margin:4px 0 8px">
      <button data-mode="zones" role="tab" aria-selected="${!food}" class="${food ? "" : "on"}">📍 장소</button>
      <button data-mode="food" role="tab" aria-selected="${food}" class="${food ? "on" : ""}">🍽️ 맛집</button>
    </div>
    <p class="map-guide">${food
      ? "선배 꿀팁 맛집과 문 주변 가게를 모았어요. 핀이나 목록을 누르면 자세히 볼 수 있어요."
      : `${theme ? `지금은 <b>${esc(theme.emoji || "")} ${esc(theme.name)}</b> 테마예요. ` : ""}지도나 목록에서 장소를 골라 미션을 시작해 보세요.`}</p>
    <div id="campus-map" role="application" aria-label="${food ? "경북대 주변 맛집 지도" : "경북대학교 캠퍼스 지도"}"></div>
    ${food ? `<div id="food-pane"></div>` : `<h3 class="sec">장소 목록</h3><div id="zone-list"></div>`}`;
}

/* ---------- 맛집 (캠퍼스 탐험 > 맛집) ---------- */
// data: data/restaurants.json, list: 필터를 거친 가게들, state: { theme, tipOnly, selId }
// 필터 버튼은 data-theme / data-tip, 가게는 data-rest(누르면 선택). 클릭 처리는 main.js에서 한다.
export function renderFood(data, list, { theme = "all", tipOnly = false, selId = null } = {}) {
  const el = $("food-pane");
  if (!el) return;
  const themes = data.themes || [];
  const emojiOf = (r) => hasIcon(r.theme) ? icon(r.theme) : (themes.find((t) => t.id === r.theme)?.emoji || "🍽️");
  const sel = list.find((r) => r.id === selId) || null;
  const gates = (data.gates || []).map((g) => g.name);
  const groups = gates.map((g) => [g, list.filter((r) => r.area === g)]).filter(([, rs]) => rs.length);
  const row = (r) => `
    <button type="button" class="food-row ${r.id === selId ? "on" : ""}" data-rest="${esc(r.id)}">
      <span class="food-emoji" aria-hidden="true">${emojiOf(r)}</span>
      <span class="food-body">
        <strong>${esc(r.name)}${r.tip ? ` <span class="food-tip">⭐ 선배 꿀팁</span>` : ""}</strong>
        <span class="food-kind">${esc(r.kind || "")}</span>
        ${r.tip ? `<span class="food-cmt">${esc(r.comment)}</span>` : ""}
      </span>
    </button>`;
  el.innerHTML = `
    <div class="food-filters" role="group" aria-label="맛집 종류">
      <button type="button" data-theme="all" class="${theme === "all" ? "on" : ""}">전체</button>
      ${themes.map((t) => `<button type="button" data-theme="${t.id}" class="${theme === t.id ? "on" : ""}">${hasIcon(t.id) ? icon(t.id, { size: 20, cls: "jelly-inline" }) : t.emoji} ${esc(t.name)}</button>`).join("")}
      <button type="button" data-tip class="tip ${tipOnly ? "on" : ""}" aria-pressed="${tipOnly}">⭐ 꿀팁만</button>
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
      <a class="btn" href="${esc(sel.url)}" target="_blank" rel="noopener">카카오맵에서 보기</a>
    </div>` : ""}
    <h3 class="sec">맛집 목록 <small class="food-count">${list.length}곳</small></h3>
    ${groups.length ? groups.map(([g, rs]) => `
      <h4 class="food-gate">🚪 ${esc(g)} <span>${rs.length}</span></h4>
      <div class="list-card">${rs.map(row).join("")}</div>`).join("")
      : `<div class="card" style="text-align:center"><p style="color:var(--mute);margin:0">조건에 맞는 가게가 없어요</p></div>`}
    <p class="food-src">가게 위치·정보: 카카오맵 (2026년 10월 기준). ⭐ 표시가 없는 가게는 카카오맵 검색 상위 가게예요.</p>`;
}

/* ---------- 전체 랭킹 (커뮤니티 > 내 순위 카드에서 여는 상세 화면) ---------- */
export function renderRankView() {
  $("view-rank").innerHTML = `${subHeader("전체 랭킹")}<div id="rank-pane"></div>`;
  return $("rank-pane");
}

// 커뮤니티 맨 위 "내 순위" 카드에 숫자 채우기 (랭킹은 서버에서 늦게 올 수 있어서 카드부터 그리고 나중에 채운다)
export function fillRankHero(totalRows, deptRows) {
  const set = (id, text) => { if ($(id)) $(id).textContent = text; };
  const me = totalRows.findIndex((r) => r.me);
  const myDept = deptRows.findIndex((r) => r.me);
  set("rh-total", me >= 0 ? `${me + 1}위` : "-");
  set("rh-total-sub", me >= 0 ? `${totalRows.length}명 중 · ${totalRows[me].score} XP` : "순위를 불러오지 못했어요");
  set("rh-dept", myDept >= 0 ? `${myDept + 1}위` : "-");
  set("rh-dept-sub", myDept >= 0 ? `${deptRows[myDept].name} · ${deptRows.length}개 중` : " ");
}

// 장소 목록: 남은 장소는 위, 다 깬 장소는 아래로. 방금 막 다 깬 장소(justCleared)는 "통과" 도장 효과
// locked: 지금 테마에 없는 장소 (흐리게, 누르면 "○○에 열려요" 안내)
export function renderZoneList(zones, isDone, justCleared = new Set(), locked = []) {
  const el = $("zone-list");
  if (!el) return;
  const rows = zones
    .map((z) => ({
      zone: z,
      done: z.missions.length > 0 && z.missions.every((m) => isDone(m.id)),   // 미션 없는 장소는 "통과"로 안 침 (장주연)
      doneCnt: z.missions.filter((m) => isDone(m.id)).length,
    }))
    .sort((a, b) => (!a.zone.missions.length - !b.zone.missions.length) || Number(a.done) - Number(b.done));   // 미션 있는 장소 먼저 (장주연)

  el.innerHTML = rows.map(({ zone: z, done, doneCnt }) => `
    <button type="button" class="zone-row ${done ? "cleared" : ""} ${justCleared.has(z.id) ? "just-cleared" : ""}" data-zone="${z.id}">
      <span class="zr-emoji">${zoneIcon(z)}</span>
      <span class="zr-body">
        <strong>${esc(z.name)}</strong>
        <span>${z.missions.length ? `${doneCnt}/${z.missions.length} 미션` : "둘러보기"}</span>
      </span>
      ${done ? '<span class="zr-check">✓ 통과</span>' : '<span class="zr-arrow">›</span>'}
    </button>`).join("") + (locked.length ? `
    <h3 class="sec locked-sec">다른 테마 장소</h3>
    ${locked.map((z) => `
    <button type="button" class="zone-row locked" data-zone="${z.id}">
      <span class="zr-emoji">${zoneIcon(z)}</span>
      <span class="zr-body">
        <strong>${esc(z.name)}</strong>
        <span>${z.openTheme ? `${esc(z.openTheme.emoji || "")} ${esc(z.openTheme.name)}에 열려요` : "다른 테마에서 열려요"}</span>
      </span>
      <span class="zr-lock" aria-hidden="true">🔒</span>
    </button>`).join("")}` : "");
}

/* ---------- 데일리 출석체크 / 퀴즈 ---------- */
// 출석 도장 줄: 전체 개수를 다 보여주지 않고, 최근 연속 출석 3일만 큼직한 도장으로 찍어 두고
// 그 뒤로 앞으로 채울 날들을 빈 칸으로 보여준다. (도장 3 + 빈칸 = 항상 6칸)
const ATT_STAMPED = 3;
const ATT_SLOTS = 6;
const ATT_TILT = [-12, 7, -5, 10, -8];
function attendanceStrip(checkin, justStamped) {
  const stamped = Math.min(checkin.live, ATT_STAMPED);
  const first = checkin.live - stamped + 1;   // 줄 맨 앞 도장이 연속 며칠째인지
  const slots = [];
  for (let i = 0; i < ATT_SLOTS; i++) {
    const n = first + i;
    if (i < stamped) {
      const isToday = checkin.done && i === stamped - 1;
      slots.push(`
        <div class="att-slot stamped">
          <span class="att-stamp ${isToday && justStamped ? "slam" : ""}" style="--tilt:${ATT_TILT[n % ATT_TILT.length]}deg">
            <b>출석</b><small>${n}일</small>
          </span>
          <span class="att-day ${isToday ? "today" : ""}">${isToday ? "오늘" : `${n}일차`}</span>
        </div>`);
    } else {
      const isToday = !checkin.done && i === stamped;
      slots.push(`
        <div class="att-slot">
          ${isToday
            ? `<button class="att-empty today" type="button" data-checkin aria-label="오늘 출석 도장 찍기">찍기</button>`
            : `<span class="att-empty" aria-hidden="true"></span>`}
          <span class="att-day ${isToday ? "today" : ""}">${isToday ? "오늘" : `${n}일차`}</span>
        </div>`);
    }
  }
  return `<div class="att-strip" role="img" aria-label="연속 출석 ${checkin.live}일">${slots.join("")}</div>`;
}

export function renderDaily(checkin, quiz, { justStamped = false } = {}) {
  const el = $("daily-section");
  if (!el) return;
  const quizStatus = !quiz.done ? "경북대 상식 퀴즈에 도전해 보세요!"
    : quiz.correct ? `${icon("check", { size: 26, cls: "jelly-inline" })} 오늘 정답을 맞혔어요` : `${icon("memo", { size: 26, cls: "jelly-inline" })} 오늘 퀴즈는 풀었어요`;
  el.innerHTML = `
    <h3 class="sec">오늘의 데일리</h3>
    <div class="card att-card">
      <div class="att-head">
        <div>
          <div class="sum-label">출석 체크</div>
          <div class="sum-big" style="font-size:19px">${checkin.done ? "오늘 도장 쾅! 내일 또 만나요" : "오늘의 도장을 찍어볼까요?"}</div>
        </div>
        ${checkin.live ? `<span class="att-streak">🔥 ${checkin.live}일 연속</span>` : ""}
      </div>
      ${attendanceStrip(checkin, justStamped)}
      ${checkin.done ? "" : `<button id="btn-daily-checkin" class="btn" type="button" style="margin-top:14px">출석 도장 찍기 · +10 XP</button>`}
    </div>
    <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div>
        <div class="sum-label">오늘의 퀴즈</div>
        <div class="sum-big" style="font-size:19px">${quizStatus}</div>
        <div class="sum-foot">${quiz.done ? "내일 또 도전해보세요" : "정답 시 +15 XP"}</div>
      </div>
      <button id="btn-daily-quiz" class="chip primary" style="white-space:nowrap" ${quiz.done ? "disabled" : ""}>
        ${quiz.done ? "완료" : "퀴즈 풀기"}
      </button>
    </div>`;
}

// 퀴즈 풀기 버튼을 누르면 열리는 화면. 아래에서 올라오는 시트가 아니라, 메인 미션처럼
// 화면 가운데로 "들어가는" 느낌의 팝업으로 연다. onAnswer(선택한 인덱스)는 정답 여부(boolean)를 돌려줘야 한다
export function showDailyQuiz(q, onAnswer) {
  const m = $("modal");
  m.classList.remove("hidden");
  m.classList.add("modal-center");
  m.innerHTML = `
    <div class="modal-card pop-in" style="text-align:center">
      <img class="mascot-hero" style="width:64px;margin:0 auto 10px" src="img/mascot/badge-campus.png" alt="호반우">
      <h2 style="font-size:19px">오늘의 퀴즈</h2>
      <p style="font-weight:600;margin:14px 0 18px;line-height:1.5">${esc(q.q)}</p>
      <div id="quiz-modal-opts" style="display:flex;flex-direction:column;gap:8px;text-align:left">
        ${q.options.map((opt, i) => `<button class="chip" data-i="${i}">${esc(opt)}</button>`).join("")}
      </div>
      <p id="quiz-modal-result" class="sum-foot" style="margin-top:12px"></p>
      <button id="quiz-modal-close" class="btn alt hidden" style="margin-top:12px">닫기</button>
    </div>`;
  const close = () => { m.classList.add("hidden"); m.classList.remove("modal-center"); m.innerHTML = ""; };
  m.querySelectorAll("#quiz-modal-opts [data-i]").forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.dataset.i);
      m.querySelectorAll("#quiz-modal-opts [data-i]").forEach((b) => (b.disabled = true));
      const correct = onAnswer(i);
      $("quiz-modal-result").textContent = correct
        ? "정답이에요! +15 XP 획득했어요."
        : `아쉬워요! 정답은 "${q.options[q.answer]}"였어요.`;
      $("quiz-modal-close").classList.remove("hidden");
    };
  });
  $("quiz-modal-close").onclick = close;
}

export function renderRankInto(container, rows, mode, onMode, theme = null) {
  if (!container) return;
  const meIdx = rows.findIndex((r) => r.me);
  const me = rows[meIdx];
  const unit = mode === "dept" ? "평균 XP" : "XP";
  const podium = [1, 0, 2]
    .filter((i) => rows[i])
    .map((i) => {
      const r = rows[i];
      return `<div class="pod p${i + 1} ${r.me ? "me" : ""}">
        <div class="pname">${esc(r.name)}</div>
        <div class="pscore">${r.score} ${unit}</div>
        <div class="bar">${i + 1}</div>
      </div>`;
    }).join("");
  const list = rows.slice(3).map((r, k) => `
    <li class="${r.me ? "me" : ""}">
      <span class="no">${k + 4}</span>
      <div class="who"><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></div>
      <span class="pts">${r.score}</span>
    </li>`).join("");

  container.innerHTML = `
    <div class="seg-sub" style="margin-top:12px">
      ${theme ? `<button data-m="theme" class="${mode === "theme" ? "on" : ""}">${esc(theme.emoji || "")} 이번 테마</button>` : ""}
      <button data-m="total" class="${mode === "total" ? "on" : ""}">개인</button>
      <button data-m="dept" class="${mode === "dept" ? "on" : ""}">단과대</button>
    </div>
    ${mode === "theme" ? `<p class="map-guide" style="margin-top:4px">${esc(theme.name)} 테마 미션으로 얻은 점수 순위예요.</p>` : ""}
    <div class="card my-rank">
      <div>
        <div class="sum-label">내 ${mode === "dept" ? "단과대 " : mode === "theme" ? "테마 " : ""}순위</div>
        <div class="my-big">${me ? `${meIdx + 1}위` : "-"}</div>
      </div>
      <div class="my-side">${me
        ? `<b>${me.score}</b> ${unit}<br><small>전체 ${rows.length}${mode === "dept" ? "개 단과대" : "명"}</small>`
        : `<small>${mode === "theme" ? "이번 테마 미션을 하면<br>순위에 올라가요" : "순위를 불러오지 못했어요"}</small>`}</div>
    </div>
    ${rows.length ? `<div class="podium">${podium}</div>` : `<p class="note">아직 순위에 오른 사람이 없어요. 첫 번째가 되어 보세요!</p>`}
    ${list ? `<ol class="ranklist">${list}</ol>` : ""}`;
  container.querySelectorAll(".seg-sub button").forEach((b) => (b.onclick = () => onMode(b.dataset.m)));
}

/* ---------- 커뮤니티 ---------- */
const ICON_HEART = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.6s-7.6-4.6-9.5-9.4C1.2 7.9 3.4 4.4 7 4.4c2.2 0 3.8 1.2 5 3 1.2-1.8 2.8-3 5-3 3.6 0 5.8 3.5 4.5 6.8-1.9 4.8-9.5 9.4-9.5 9.4z"/></svg>`;
const ICON_PENCIL = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>`;
const ICON_ASK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.9v.8"/><path d="M12 18h.01"/></svg>`;
const ICON_COMMENT =`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.6a8.4 8.4 0 0 1-12.3 7.5L3.5 20.5l1.4-4.5a8.4 8.4 0 1 1 15.6-4.4z"/></svg>`;

// "방금 전", "5분 전", "3시간 전", "2일 전", 일주일이 넘으면 날짜
export function timeAgo(iso) {
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "방금 전";
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

const avatar = (name, cls = "") => `<span class="avatar ${cls}" aria-hidden="true">${esc([...String(name || "?")][0])}</span>`;
// 카드 아래쪽: 자유게시판은 "좋아요 N개 / 댓글 N개 모두 보기",
// 질문글은 좋아요를 가장 많이 받은 답변(베스트 답변)을 펼쳐 보여줘서 글을 열지 않아도 답을 알 수 있게 한다.
function postFootHtml(p) {
  if (p.kind !== "question") {
    return `
      ${p.like_count ? `<b class="like-line">좋아요 ${p.like_count}개</b>` : ""}
      <button class="comment-line" type="button" data-act="comment">${p.comment_count ? `댓글 ${p.comment_count}개 모두 보기` : "첫 댓글을 남겨보세요"}</button>`;
  }
  // 질문: 베스트 답변 한 줄 미리보기 (누르면 답변 전체)
  if (p.best) {
    return `
      <button class="best-ans" type="button" data-act="comment">
        <span class="best-badge">베스트</span><span class="best-text">${esc(p.best.message)}</span>
      </button>`;
  }
  return `<button class="comment-line" type="button" data-act="comment">${
    p.comment_count ? `답변 ${p.comment_count}개 보기` : "첫 답변을 남겨보세요"}</button>`;
}

// 본문 속 #해시태그를 눌러서 모아 볼 수 있는 버튼으로 바꾼다. esc() 뒤에 돌리므로 "&#39;" 같은 엔티티는
// 앞이 공백/줄 시작이 아니라 걸리지 않는다.
const tagBtn = (t) => `<button type="button" class="tag" data-tag="${esc(t)}">#${esc(t)}</button>`;
const linkifyTags = (html) => html.replace(/(^|\s)#([0-9A-Za-z가-힣_]+)/g, (_, pre, t) => pre + tagBtn(t));

function postCardHtml(p, zoneName, myId) {
  const q = p.kind === "question";
  const place = p.zone_id ? toTag(zoneName(p.zone_id)) : "";
  return `
    <article class="post ${q ? "q-post" : ""} ${p.guide ? "guide" : ""}" data-post="${esc(p.id)}">
      ${p.guide ? `<div class="guide-ribbon">📌 이렇게 질문해 보세요 · 예시</div>` : ""}
      <header class="post-head">
        ${avatar(p.nickname)}
        <div class="post-meta">
          <b>${esc(p.nickname)}${p.guide ? ` <span class="guide-chip">가이드</span>` : ""}</b>
          <span>${place ? `${tagBtn(place)} · ` : ""}${p.guide ? "고정됨" : timeAgo(p.created_at)}</span>
        </div>
        ${!p.guide && p.user_id !== myId ? `<button class="post-report" type="button" data-act="report" aria-label="신고하기" title="신고하기">🚩</button>` : ""}
      </header>
      ${p.photo_url ? `
      <div class="post-photo" data-act="photo">
        <img src="${esc(p.photo_url)}" alt="${esc(p.nickname)}님이 올린 사진" loading="lazy">
        <span class="heart-burst" aria-hidden="true">${ICON_HEART}</span>
      </div>` : ""}
      ${p.message ? `<p class="post-text ${p.photo_url ? "" : "solo"}">${q ? `<span class="q-mark">Q.</span>` : ""}${linkifyTags(esc(p.message))}</p>` : ""}
      <div class="post-actions">
        <button class="act act-like ${p.liked ? "on" : ""}" type="button" data-act="like"
                aria-pressed="${p.liked}" aria-label="${q ? "나도 궁금해요" : "좋아요"}">${ICON_HEART}<span class="act-n">${p.like_count || ""}</span></button>
        <button class="act act-comment" type="button" data-act="comment" aria-label="${q ? "답변" : "댓글"}">${ICON_COMMENT}<span class="act-n">${p.comment_count || ""}</span></button>
      </div>
      <div class="post-foot">${postFootHtml(p)}</div>
    </article>`;
}

// 커뮤니티 탭 첫 화면: 내 순위 카드 + 자유게시판 카드(최근 글 3개 미리보기). 카드를 누르면 게시판 화면으로.
// posts: 자유게시판 최근 글 (listPosts 결과, 최신순)
export function renderCommunityHome(zones, posts) {
  const zoneName = (id) => zones.find((z) => z.id === id)?.name || "";
  const row = (p) => {
    const text = String(p.message || (p.photo_url ? "사진을 올렸어요" : "")).replace(/\s+/g, " ");
    return `<li class="bp-row">
      <span class="bp-body">
        <span class="bp-text">${esc(text)}</span>
        <span class="bp-meta">${esc(p.nickname)} · ${timeAgo(p.created_at)}${p.zone_id ? ` · ${esc(toTag(zoneName(p.zone_id)))}` : ""}${
          p.like_count ? ` · ♥ ${p.like_count}` : ""}${p.comment_count ? ` · 댓글 ${p.comment_count}` : ""}</span>
      </span>
      ${p.photo_url ? `<img class="bp-thumb" src="${esc(p.photo_url)}" alt="" loading="lazy">` : ""}
    </li>`;
  };
  $("view-community").innerHTML = `
    <div class="card card-hero rank-hero" id="rank-hero">
      <div class="qm-head"><span class="qm-title">🏆 내 순위</span></div>
      <div class="rank-hero-stats">
        <div><span class="sum-label">개인</span><b id="rh-total">-</b><small id="rh-total-sub">불러오는 중</small></div>
        <div><span class="sum-label">단과대</span><b id="rh-dept">-</b><small id="rh-dept-sub">&nbsp;</small></div>
      </div>
      <button id="btn-rank-all" class="btn alt-ghost">전체 랭킹 보기</button>
    </div>
    <button type="button" class="card board-hub" data-open-board="post">
      <span class="bh-head">
        ${icon("chat", { cls: "bh-ic" })}
        <span class="bh-title"><b>자유게시판</b><small>캠퍼스 이야기와 호반우 인증샷</small></span>
        <span class="bc-more">전체 보기 ›</span>
      </span>
      ${posts.length ? `<ul class="bp-list">${posts.map(row).join("")}</ul>`
        : `<span class="bc-empty">아직 글이 없어요. 첫 글을 남겨보세요!</span>`}
    </button>`;
}

// 게시판 상세 화면 (커뮤니티 > 자유게시판)
// board: "post"(자유게시판) | "question"(질문), posts: listPosts() 결과(최신순), filter: "all" | "mine",
// myId: 내 프로필 id (내 글엔 신고 버튼을 숨긴다)
// 버튼에는 data-act(like | comment | photo | report)가 붙어 있고, 클릭 처리는 main.js에서 위임으로 한다.
// tag: 해시태그로 모아 보는 중이면 "일청담" 같은 태그 글자 (위에 "#일청담 · N개" 칩이 뜨고 ✕로 해제)
export function renderCommunity(zones, posts, { board = "post", filter = "all", tag = null } = {}, myId = null) {
  const zoneName = (id) => zones.find((z) => z.id === id)?.name || "";
  const q = board === "question";
  const count = posts.length;
  $("view-board").innerHTML = `
    ${subHeader(q ? "질문" : "자유게시판")}
    ${tag
      ? `<button type="button" class="filter-chip tag-chip" data-f="all"><b>#${esc(tag)}</b> 방문 기록 ${count}개 <span aria-hidden="true">✕</span><span class="sr-only">해시태그 모아 보기 끄기</span></button>`
      : filter === "mine"
      ? `<button type="button" class="filter-chip" data-f="all">${q ? "내 질문" : "내가 쓴 글"}만 보는 중 <span aria-hidden="true">✕</span><span class="sr-only">전체 보기</span></button>`
      : `<p class="map-guide">${q
        ? "궁금한 걸 물어보세요. 도움이 된 답변에 ♥를 누르면 베스트 답변이 돼요."
        : "#장소 태그를 누르면 그곳의 방문 기록만 모아 볼 수 있어요."}</p>`}
    <div class="feed">
      ${posts.length ? posts.map((p) => postCardHtml(p, zoneName, myId)).join("") : `
        <div class="card" style="text-align:center;margin:0">
          <p style="color:var(--mute);margin:0">${tag ? `아직 #${esc(tag)} 태그가 달린 ${q ? "질문" : "글"}이 없어요`
            : filter === "mine"
            ? (q ? "아직 올린 질문이 없어요" : "아직 올린 글이 없어요")
            : (q ? "아직 질문이 없어요. 첫 질문을 남겨보세요!" : "아직 글이 없어요. 첫 글을 남겨보세요!")}</p>
        </div>`}
    </div>`;

  // 글쓰기 버튼은 오른쪽 아래에 떠 있는 동그란 버튼(FAB). .view는 등장 애니메이션에 transform을 써서
  // 그 안에 두면 position: fixed가 애니메이션 동안 흔들리므로 #app에 한 번만 만들어 두고,
  // 커뮤니티 화면일 때만 CSS로 보이게 한다.
  let fab = $("btn-compose");
  if (!fab) {
    fab = Object.assign(document.createElement("button"), { id: "btn-compose", className: "fab", type: "button" });
    $("app").appendChild(fab);
  }
  const label = q ? "질문하기" : "글쓰기 · 사진 올리기";
  fab.setAttribute("aria-label", label);
  fab.title = label;
  fab.innerHTML = q ? ICON_ASK : ICON_PENCIL;
}

// 좋아요/댓글 수가 바뀌었을 때 화면 전체를 다시 그리지 않고 그 글 카드만 고친다 (스크롤 위치 유지)
export function updatePostCard(p, { pop = false } = {}) {
  const card = document.querySelector(`#view-board [data-post="${CSS.escape(p.id)}"]`);
  if (!card) return;
  const like = card.querySelector(".act-like");
  like.classList.toggle("on", p.liked);
  like.setAttribute("aria-pressed", p.liked);
  like.querySelector(".act-n").textContent = p.like_count || "";
  if (pop) { like.classList.remove("pop"); void like.offsetWidth; like.classList.add("pop"); }
  card.querySelector(".act-comment .act-n").textContent = p.comment_count || "";
  card.querySelector(".post-foot").innerHTML = postFootHtml(p);
}

// 사진 더블탭 시 가운데 큰 하트가 톡 튀어나왔다 사라지는 효과
export function heartBurst(postId) {
  const b = document.querySelector(`#view-board [data-post="${CSS.escape(postId)}"] .heart-burst`);
  if (!b) return;
  b.classList.remove("go"); void b.offsetWidth; b.classList.add("go");
}

/* ---------- 댓글 시트 ---------- */
// 아래에서 올라오는 시트. load() => Promise<comments[] | null>, add(text) => Promise<{ok, comment, reason}>,
// remove(id) => Promise<boolean>, likeComment(id, like) => Promise<boolean>.
// 댓글이 늘거나 줄거나 좋아요가 바뀔 때마다 onChange(comments)를 부른다.
// question: 질문글이면 제목이 "답변"이 되고, 질문 내용(context)을 위에 보여주며, 베스트 답변에 배지를 단다.
// readOnly: 가이드 예시처럼 답변·좋아요를 막아야 할 때.
export function showComments({ myId, myName, question = false, context = "", readOnly = false,
                               load, add, remove, likeComment, onChange }) {
  const noun = question ? "답변" : "댓글";
  const m = $("modal");
  m.classList.remove("hidden", "modal-center");
  m.innerHTML = `
    <div class="cm-sheet" role="dialog" aria-modal="true" aria-labelledby="cm-title">
      <div class="cm-grab" aria-hidden="true"></div>
      <header class="cm-head">
        <b id="cm-title">${noun}</b><span id="cm-count"></span>
        <button id="cm-close" class="cm-x" type="button" aria-label="닫기">✕</button>
      </header>
      ${context ? `<div class="cm-context"><span class="q-mark">Q.</span>${esc(context)}</div>` : ""}
      <div id="cm-list" class="cm-list" aria-live="polite">
        <div class="cm-empty"><span class="cm-spin" aria-hidden="true"></span>불러오는 중…</div>
      </div>
      <form id="cm-form" class="cm-form" autocomplete="off">
        ${avatar(myName, "sm")}
        <input id="cm-in" class="cm-in" maxlength="200" enterkeyhint="send" ${readOnly ? "disabled" : ""}
               placeholder="${readOnly ? "예시 글에는 답변을 달 수 없어요" : `${esc(myName || "나")}(으)로 ${noun} 달기…`}">
        <button id="cm-send" class="cm-send" type="submit" disabled>게시</button>
      </form>
    </div>`;

  let comments = [];
  const list = $("cm-list"), input = $("cm-in"), send = $("cm-send");
  const pendingLikes = new Set();

  const row = (c, best) => `
    <div class="cm-row ${best ? "is-best" : ""}" data-cid="${esc(c.id)}">
      ${avatar(c.nickname, "sm")}
      <div class="cm-body">
        ${best ? `<span class="best-badge">👑 베스트 답변</span>` : ""}
        <div><b>${esc(c.nickname)}</b><time>${timeAgo(c.created_at)}</time>
          ${c.user_id && c.user_id === myId ? `<button class="cm-del" type="button" data-del="${esc(c.id)}">삭제</button>` : ""}</div>
        <p>${esc(c.message)}</p>
      </div>
      <button class="cm-like ${c.liked ? "on" : ""}" type="button" data-clike="${esc(c.id)}"
              aria-pressed="${!!c.liked}" aria-label="${noun} 좋아요">${ICON_HEART}<span>${c.like_count || ""}</span></button>
    </div>`;
  const paint = () => {
    $("cm-count").textContent = comments.length || "";
    const best = question ? pickBest(comments) : null;
    list.innerHTML = comments.length ? comments.map((c) => row(c, c === best)).join("")
      : `<div class="cm-empty"><b>아직 ${noun}이 없어요</b>${question ? "아는 만큼 편하게 알려주세요 🙌" : "첫 번째로 이야기를 건네보세요 💬"}</div>`;
  };
  const changed = () => { paint(); onChange?.(comments); };

  load().then((data) => {
    if (data === null) {
      list.innerHTML = `<div class="cm-empty"><b>댓글을 불러오지 못했어요</b>잠시 후 다시 시도해 주세요.</div>`;
      return;
    }
    comments = data;
    paint();
    list.scrollTop = list.scrollHeight;
  });

  input.oninput = () => { send.disabled = !input.value.trim(); };
  $("cm-form").onsubmit = async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || send.disabled) return;
    send.disabled = true;
    input.disabled = true;
    const r = await add(text);
    input.disabled = false;
    if (r?.ok) {
      comments.push(r.comment);
      input.value = "";
      changed();
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    } else {
      send.disabled = false;
      toast(r?.reason === "banned_word" ? "부적절한 표현이 포함되어 있어요." : `${noun}을 남기지 못했어요. 잠시 후 다시 시도해 주세요.`);
    }
    input.focus();
  };

  list.onclick = async (e) => {
    const likeBtn = e.target.closest("[data-clike]");
    if (likeBtn) {
      const c = comments.find((x) => x.id === likeBtn.dataset.clike);
      if (!c || pendingLikes.has(c.id)) return;
      if (readOnly) { toast("예시 글이라 좋아요를 누를 수 없어요."); return; }
      const like = !c.liked;
      pendingLikes.add(c.id);
      c.liked = like;
      c.like_count += like ? 1 : -1;
      changed();
      if (like) list.querySelector(`[data-clike="${CSS.escape(c.id)}"]`)?.classList.add("pop");
      if (!(await likeComment(c.id, like))) {
        c.liked = !like;
        c.like_count += like ? -1 : 1;
        changed();
        toast("좋아요를 반영하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
      pendingLikes.delete(c.id);
      return;
    }
    const btn = e.target.closest("[data-del]");
    if (!btn || !confirm(`이 ${noun}을 삭제할까요?`)) return;
    btn.disabled = true;
    if (await remove(btn.dataset.del)) {
      comments = comments.filter((c) => c.id !== btn.dataset.del);
      changed();
    } else {
      btn.disabled = false;
      toast("삭제하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  };

  const close = () => {
    document.removeEventListener("keydown", onKey);
    m.classList.add("hidden");
    m.innerHTML = "";
    m.onclick = null;
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  $("cm-close").onclick = close;
  m.onclick = (e) => { if (e.target === m) close(); };
}

/* ---------- 커뮤니티 글쓰기 (일반 글쓰기 + 미션 사진 업로드 공용) ---------- */
// zones: [{id,name}] 배열을 주면 장소 선택 드롭다운이 뜬다. lockZone이 true면 zoneName 하나만 고정 표시(선택 불가).
// photo를 미리 주면(File 객체 또는 "data:"로 시작하는 dataURL) 사진 선택 없이 바로 미리보기만 보여준다.
// onSubmit(message, photo, zoneId) => Promise<boolean>. onClose()는 모달이 닫힐 때(성공/취소 상관없이) 한 번 호출된다.
// title·placeholder를 주면 제목과 입력 안내 문구를 바꾼다 (질문하기 등).
export function showComposer({ zones = null, zoneId = null, zoneName = "", lockZone = false, photo = null,
                               title = "", placeholder = "무슨 얘기를 남길까요?", requirePhoto = false, initialText = "",
                               onSubmit, onClose }) {
  const m = $("modal");
  m.classList.remove("hidden");
  m.classList.add("modal-center");

  const photoSrc = (p) => (typeof p === "string" ? p : URL.createObjectURL(p));

  m.innerHTML = `
    <div class="modal-card pop-in" style="text-align:left">
      <h2 style="font-size:18px;text-align:center">${title || (photo ? "📤 커뮤니티에 올리기" : "✏️ 글쓰기")}</h2>
      ${!lockZone && zones ? `
        <select id="cw-zone" class="text-in" style="margin-bottom:4px" aria-label="장소 해시태그">
          <option value=""># 장소 태그 없음</option>
          ${zones.map((z) => `<option value="${esc(z.id)}" ${z.id === zoneId ? "selected" : ""}>#${esc(toTag(z.name))}</option>`).join("")}
        </select>
        <p class="cw-tag-hint">장소 태그를 달면 커뮤니티에서 그 장소의 방문 기록으로 모아 볼 수 있어요. 본문에 #태그를 직접 써도 돼요.</p>`
        : (zoneName ? `<div class="cw-tag-lock"><span class="tag">#${esc(toTag(zoneName))}</span> 태그가 붙어요</div>` : "")}
      ${photo
        ? `<img class="gb-photo-lg" src="${photoSrc(photo)}" alt="">`
        : `<label class="btn-file small">📷 사진 추가 (${requirePhoto ? "필수" : "선택"})<input id="cw-photo" type="file" accept="image/*" hidden></label>
           <span id="cw-photo-name" class="sum-foot" style="margin:4px 0 0;display:block"></span>`}
      <textarea id="cw-msg" class="text-in" placeholder="${esc(placeholder)}" maxlength="200" rows="3" style="margin-top:10px">${esc(initialText)}</textarea>
      <button id="cw-submit" class="btn" style="margin-top:10px">게시하기</button>
      <button id="cw-close" class="btn alt" style="margin-top:8px">닫기</button>
    </div>`;

  let pickedPhoto = photo;
  $("cw-photo")?.addEventListener("change", (e) => {
    pickedPhoto = e.target.files[0] || null;
    $("cw-photo-name").textContent = pickedPhoto ? pickedPhoto.name : "";
  });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    m.classList.add("hidden"); m.classList.remove("modal-center"); m.innerHTML = "";
    onClose?.();
  };
  $("cw-close").onclick = close;
  m.onclick = (e) => { if (e.target === m) close(); };

  $("cw-submit").onclick = async () => {
    const msg = $("cw-msg").value.trim();
    if (requirePhoto && !pickedPhoto) { toast("사진을 꼭 함께 올려 주세요."); return; }
    if (!msg && !pickedPhoto) { toast("글이나 사진 중 하나는 있어야 해요."); return; }
    const zid = lockZone ? zoneId : ($("cw-zone")?.value || null);
    const btn = $("cw-submit");
    btn.disabled = true;
    btn.textContent = "올리는 중...";
    // onSubmit은 과거 호환을 위해 boolean을 돌려줘도 되고, { ok, reason } 객체를 돌려줘도 된다.
    const result = await onSubmit(msg, pickedPhoto, zid);
    const ok = typeof result === "boolean" ? result : !!result?.ok;
    const reason = typeof result === "object" ? result?.reason : null;
    if (ok) { close(); toast("게시글을 올렸어요!"); }
    else {
      btn.disabled = false;
      btn.textContent = "게시하기";
      toast(
        reason === "banned_word" ? "부적절한 표현이 포함되어 있어요. 다시 써 주세요."
        : "게시에 실패했어요. 잠시 후 다시 시도해 주세요."
      );
    }
  };
}

/* ---------- 단대별 호반우 캐릭터 ---------- */
// img/stickers/collegeNN.png 번호 (11번은 원본에 없음). ar-stickers.js의 단대 스티커 목록과 같은 번호다.
const COLLEGE_STICKER = {
  "인문대학": "01", "사회과학대학": "02", "자연과학대학": "03", "경상대학": "04", "공과대학": "05",
  "IT대학": "06", "농업생명과학대학": "07", "예술대학": "08", "사범대학": "09", "의과대학": "10",
  "치과대학": "12", "수의과대학": "13", "생활과학대학": "14", "간호대학": "15", "약학대학": "16",
  "첨단기술융합대학": "17", "생태환경대학": "18", "과학기술대학": "19", "행정학부": "20", "자율전공학부": "21",
  // 전용 캐릭터가 없는 소속은 가장 비슷한 단대 캐릭터를 쓴다
  "AI대학": "06",             // → IT대학
  "공학첨단자율학부": "05",    // → 공과대학
  "경영대학": "04",           // 예전 이름 → 경상대학
  "기타": "21",               // 예전 선택지 → 자율전공학부
};
export const collegeSticker = (dept) => `img/stickers/college${COLLEGE_STICKER[dept] || "21"}.png`;

/* ---------- 내 정보 ---------- */
export function renderMe(zones, onReset, onMyPosts = null) {
  const st = getState();
  const myCode = getCachedProfile()?.code;
  const lv = getLevel(st.score);
  const el = $("view-me");
  el.innerHTML = `
    <div class="card card-hero me-hero">
      <img class="me-college" src="${collegeSticker(st.profile.dept)}" alt="${esc(st.profile.dept)} 호반우">
      <div class="sum-label">${esc(st.profile.dept)}</div>
      <div class="sum-big" style="font-size:26px">${esc(st.profile.nickname)}</div>
      <div class="sum-foot" style="margin-top:6px">
        Lv.${lv.level} ${lv.title}
        <button id="btn-level-info" class="level-info-btn" type="button" aria-label="레벨 기준 보기">ⓘ</button>
      </div>
      <div class="progress"><i style="width:${lv.pct}%"></i></div>
      <div class="me-xp-line"><b>${st.score} XP</b><span>${lv.maxed ? "최고 레벨 달성!" : `다음 레벨까지 ${lv.next} XP`}</span></div>
    </div>
    ${myCode ? `
    <div class="card" style="text-align:center;margin-top:16px">
      <div class="sum-label">내 친구 코드</div>
      <div class="sum-big" style="font-size:30px;letter-spacing:4px">${esc(myCode)}</div>
      <div class="sum-foot">'함께하기' 미션에서 친구에게 이 코드를 알려주세요</div>
    </div>` : ""}
    ${menuCard("btn-my-posts", "내가 쓴 글", "커뮤니티에 올린 글 모아 보기", { icon: "📝" })}
    <h3 class="sec">설정</h3>
    <button id="btn-reset" class="btn alt" style="margin-top:0">기록 초기화하고 처음부터 시작</button>`;
  $("btn-reset").onclick = () => {
    if (confirm("모든 점수와 기록을 지우고 처음부터 시작할까요?")) onReset();
  };
  if (onMyPosts) $("btn-my-posts").onclick = onMyPosts;
  $("btn-level-info").onclick = () => showLevelInfo(lv.level);
}

// 레벨 기준표 + 내가 실제로 각 레벨을 언제 찍었는지 보여주는 작은 팝업
function showLevelInfo(myLevel) {
  const m = $("modal");
  const table = getLevelTable();
  const log = getLevelLog();
  const logByLevel = Object.fromEntries(log.map((e) => [e.level, e.at]));
  const fmt = (ts) => new Date(ts).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

  m.classList.remove("hidden");
  m.classList.add("modal-center");
  m.innerHTML = `
    <div class="modal-card pop-in" style="text-align:left">
      <h2 style="font-size:18px;text-align:center">레벨 기준</h2>
      <p class="sum-foot" style="text-align:center;margin:4px 0 14px">레벨이 오를수록 다음 레벨까지 필요한 XP가 점점 늘어나요</p>
      <div class="level-table">
        ${table.map((r) => `
          <div class="level-row ${r.level === myLevel ? "me" : ""} ${logByLevel[r.level] ? "reached" : ""}">
            <span class="lv-num">Lv.${r.level}</span>
            <span class="lv-title">${esc(r.title)}</span>
            <span class="lv-need">${r.from}+ XP</span>
            <span class="lv-date">${logByLevel[r.level] ? fmt(logByLevel[r.level]) + " 달성" : (r.level === myLevel ? "현재" : "")}</span>
          </div>`).join("")}
      </div>
      <button id="level-info-close" class="btn alt" style="margin-top:14px">닫기</button>
    </div>`;
  const close = () => { m.classList.add("hidden"); m.classList.remove("modal-center"); m.innerHTML = ""; };
  $("level-info-close").onclick = close;
  m.onclick = (e) => { if (e.target === m) close(); };
}

/* ---------- 구역 부가정보 (상단 ⓘ 버튼 → 팝업) ---------- */
export function showZoneInfo(info) {
  const m = $("modal");
  m.classList.remove("hidden");
  m.classList.add("modal-center");
  m.innerHTML = `
    <div class="modal-card pop-in" style="text-align:left">
      <h2 style="font-size:18px;text-align:center">${esc(info.title || "더 알아보기")}</h2>
      <div class="accordion" style="margin-top:10px">
        ${info.sections.map((s, i) => `
          <details${i === 0 ? " open" : ""}>
            <summary>${esc(s.title)}</summary>
            <div class="acc-body">${esc(s.body)}</div>
          </details>`).join("")}
      </div>
      <button id="zone-info-close" class="btn alt" style="margin-top:14px">닫기</button>
    </div>`;
  const close = () => { m.classList.add("hidden"); m.classList.remove("modal-center"); m.innerHTML = ""; };
  $("zone-info-close").onclick = close;
  m.onclick = (e) => { if (e.target === m) close(); };
}

/* ---------- 완주 시트 ---------- */
export function showFinale(onRank) {
  const st = getState();
  const mins = Math.max(1, Math.round((Date.now() - (st.startedAt || Date.now())) / 60000));
  const m = $("modal");
  m.classList.remove("hidden");
  m.innerHTML = `
    <div class="modal-card">
      <img class="mascot-hero" style="width:96px;margin:0 auto 12px" src="img/mascot/grad-bachelor.png" alt="졸업한 호반우">
      <h2>캠퍼스를 완주했어요</h2>
      <p>${esc(st.profile.nickname)}님이 모든 구역을 클리어했어요.</p>
      <div class="final-score">${st.score} XP</div>
      <p>시작한 지 약 ${mins}분 만에 완주했어요.</p>
      <button id="fin-rank" class="btn">랭킹 확인하기</button>
      <button id="fin-close" class="btn alt">닫기</button>
    </div>`;
  const close = () => { m.classList.add("hidden"); m.innerHTML = ""; };
  $("fin-close").onclick = close;
  $("fin-rank").onclick = () => { close(); onRank(); };
}

/* ---------- 위치 상태 ---------- */
const COMPASS_LABELS = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
const compassText = (deg) => COMPASS_LABELS[Math.round(deg / 45) % 8];

export function setStatus(r, pos) {
  const el = $("status");
  if (r.status === "weak") {
    el.className = "pill warn";
    el.textContent = `GPS 신호가 약해요 (정확도 ${Math.round(pos.accuracy)}m). 하늘이 트인 곳으로 이동해 보세요.`;
  } else if (r.status === "inside") {
    el.className = "pill ok";
    el.textContent = `범위 안이에요. 인증하는 중이에요 (${r.streak}/3)`;
  } else {
    el.className = "pill";
    el.innerHTML = `<span class="compass-arrow" style="transform:rotate(${Math.round(r.bearing)}deg)">➤</span> ${compassText(r.bearing)}쪽으로 더 이동해주세요 (약 ${Math.round(r.distance)}m)`;
  }
}

export function setVerified() {
  const el = $("status");
  el.className = "pill ok";
  el.textContent = "위치 인증이 완료됐어요";
}

const ERR = {
  DENIED: "위치 권한이 꺼져 있어요. 브라우저 설정에서 위치를 허용해 주세요.",
  UNAVAILABLE: "위치를 가져올 수 없어요. 기기의 GPS가 켜져 있는지 확인해 주세요.",
  TIMEOUT: "위치 확인 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.",
  UNSUPPORTED: "이 브라우저는 위치 기능을 지원하지 않아요.",
};
export function showLocationError(code) {
  const el = $("status");
  el.className = "pill warn";
  el.textContent = ERR[code] || "알 수 없는 위치 오류가 발생했어요.";
}

/* ---------- 구역 이탈 배너 ---------- */
// 위치 인증 후에도 계속 위치를 지켜보다가 구역 밖으로 나가면 상단에 고정 배너로 알려준다.
let geoBanner = null;
export function setGeofenceWarning(show, zoneName = "") {
  if (!geoBanner) {
    geoBanner = document.createElement("div");
    geoBanner.id = "geofence-banner";
    geoBanner.className = "geofence-banner";
    const zoneView = $("view-zone");
    zoneView?.insertBefore(geoBanner, zoneView.firstChild);
  }
  geoBanner.textContent = `📍 ${zoneName ? zoneName + "에서 " : ""}멀어졌어요. 구역 안으로 들어와 주세요.`;
  geoBanner.classList.toggle("show", !!show);
}

export function updateDebug(pos, r) {
  $("debug").textContent =
    `lat ${pos.lat.toFixed(5)} lng ${pos.lng.toFixed(5)} ` +
    `acc ${Math.round(pos.accuracy)}m dist ${Math.round(r.distance)}m ` +
    `${r.status} streak ${r.streak}`;
}