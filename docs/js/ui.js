import { getState, isDone, getLevel, getLevelTable, getLevelLog } from "./storage.js";
import { getCachedProfile } from "./supa.js";
import { pickBest } from "./community.js";

const $ = (id) => document.getElementById(id);

// 사용자가 입력한 문자열(닉네임 등)을 HTML에 넣을 때는 반드시 esc()를 거친다
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- 화면 전환 ---------- */
// 탭 화면 4개(home·dex·community·me) + 카드 버튼으로 여는 상세 화면(explore·rank) + 구역(zone)
const VIEWS = ["onboard", "home", "dex", "community", "me", "explore", "rank", "zone"];
// 상세 화면에 있을 때 탭바에서 어느 탭을 켜 둘지 (어느 탭에서 들어왔는지 보이게)
const PARENT_TAB = { explore: "home", rank: "community" };
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
    </div>`;
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
export function renderDashboard(zones, onGoExplore, hidden = null, onHidden = null) {
  const st = getState();
  const lv = getLevel(st.score);
  const total = zones.length;
  const cleared = zones.filter((z) => z.missions.every((m) => isDone(m.id))).length;
  const nextZone = zones.find((z) => z.missions.some((m) => !isDone(m.id)));

  $("view-home").innerHTML = `
    <div class="home-head">
      <img class="mascot-corner" src="img/mascot/cheer.png" alt="응원하는 호반우">
      <!-- 알림은 앱의 출발점인 홈 머리 오른쪽에 둔다. 다른 탭에선 하단 "홈" 탭의 빨간 점으로 새 알림을 알린다 -->
      <button id="bell-btn" class="bell-btn" type="button" aria-label="알림 보기">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>
        <span id="bell-badge" class="bell-badge hidden">0</span>
      </button>
      <h1 class="onb-title" style="font-size:22px">${esc(st.profile.nickname)}님, 안녕하세요!</h1>
      <p class="map-guide">오늘도 캠퍼스를 채워볼까요?</p>
    </div>
    <div class="card card-hero quest-map-card">
      <div class="qm-head">
        <span class="qm-title">캠퍼스 탐험 지도</span>
        <span class="qm-chip">${cleared} / ${total} 장소</span>
      </div>
      ${miniMapSvg(zones, nextZone)}
      <div class="qm-next">${nextZone
        ? `다음 목적지 · ${esc(nextZone.emoji)} ${esc(nextZone.name)}`
        : "모든 장소를 탐험했어요! 🎉"}</div>
      <div class="sum-foot" style="margin-top:4px">Lv.${lv.level} ${lv.title} · ${lv.maxed ? "최고 레벨 달성!" : `다음 레벨까지 ${lv.next} XP`}</div>
      <button id="btn-go-quest" class="btn cta-glow">${nextZone ? "미션 하러 가기" : "다시 둘러보기"}</button>
    </div>
    <div id="daily-section"></div>
    <div id="home-tour-slot"></div>
    ${hidden ? `
    <div class="card hidden-mission-card">
      <div class="sum-label">✨ 히든미션</div>
      <div class="sum-big" style="font-size:18px">${esc(hidden.emoji)} ${esc(hidden.title)}</div>
      <p class="sum-foot" style="margin:6px 0 12px">${esc(hidden.desc)}</p>
      <button id="btn-hidden-mission" class="btn cta-glow">만나러 가기</button>
    </div>` : ""}`;
  $("btn-go-quest").onclick = onGoExplore;
  if (hidden) $("btn-hidden-mission").onclick = onHidden;
}

// 홈 대표 카드 안의 미니 지도. 실제 지도 대신 장소를 네모 칸으로 보여준다.
// 칸 위치는 zones.json의 위도·경도로 자동 계산 → 장소가 추가돼도 손댈 필요가 없다.
//   클리어한 곳: 빨간 칸 + ✓ / 다음 목적지: 빨간 테두리 칸 + 장소 이모지 (통통 튐) / 아직: 물음표 칸
const MM = { W: 300, H: 176, T: 36, PAD: 14 };
function layoutTiles(zones) {
  const lats = zones.map((z) => z.lat), lngs = zones.map((z) => z.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const spanX = MM.W - MM.PAD * 2 - MM.T, spanY = MM.H - MM.PAD * 2 - MM.T;
  const pts = zones.map((z) => ({
    x: MM.PAD + (maxLng > minLng ? (z.lng - minLng) / (maxLng - minLng) : 0.5) * spanX,
    y: MM.PAD + (maxLat > minLat ? (maxLat - z.lat) / (maxLat - minLat) : 0.5) * spanY,   // 북쪽이 위
  }));
  // 가까이 붙은 칸끼리 겹치지 않게 조금씩 밀어낸다
  const GAP = MM.T + 12;
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
      if (Math.abs(dx) >= GAP || Math.abs(dy) >= GAP) continue;
      moved = true;
      // 덜 겹친 축 방향으로 밀어내기
      if (GAP - Math.abs(dx) < GAP - Math.abs(dy)) { const p = (GAP - Math.abs(dx)) / 2 * (dx >= 0 ? 1 : -1); pts[i].x -= p; pts[j].x += p; }
      else { const p = (GAP - Math.abs(dy)) / 2 * (dy >= 0 ? 1 : -1); pts[i].y -= p; pts[j].y += p; }
    }
    pts.forEach((p) => {   // 판 밖으로 나가지 않게
      p.x = Math.min(MM.W - MM.PAD - MM.T, Math.max(MM.PAD, p.x));
      p.y = Math.min(MM.H - MM.PAD - MM.T, Math.max(MM.PAD, p.y));
    });
    if (!moved) break;
  }
  return pts;
}
function miniMapSvg(zones, nextZone) {
  if (!zones.length) return "";
  const pts = layoutTiles(zones);
  const done = zones.map((z) => z.missions.every((m) => isDone(m.id)));
  const c = (i) => [pts[i].x + MM.T / 2, pts[i].y + MM.T / 2];
  // 길: 각 칸을 가장 가까운 칸 두 개와 잇는다. 양쪽 다 깬 길은 실선으로 "밝혀진다"
  const edges = new Set();
  pts.forEach((_, i) => {
    pts.map((_, j) => j).filter((j) => j !== i)
      .sort((a, b) => Math.hypot(...c(a).map((v, k) => v - c(i)[k])) - Math.hypot(...c(b).map((v, k) => v - c(i)[k])))
      .slice(0, 2).forEach((j) => edges.add([Math.min(i, j), Math.max(i, j)].join("-")));
  });
  const roads = [...edges].map((e) => {
    const [i, j] = e.split("-").map(Number);
    const [x1, y1] = c(i), [x2, y2] = c(j);
    return `<line class="mm-road ${done[i] && done[j] ? "lit" : ""}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join("");
  const tiles = zones.map((z, i) => {
    const { x, y } = pts[i];
    const name = esc(z.name);
    if (done[i]) return `<g class="mm-tile done"><title>${name} · 클리어</title>
      <rect x="${x}" y="${y}" width="${MM.T}" height="${MM.T}" rx="9"/>
      <text x="${x + MM.T / 2}" y="${y + MM.T / 2 + 1}">✓</text></g>`;
    if (nextZone && z.id === nextZone.id) return `<g class="mm-tile next"><title>${name} · 다음 목적지</title>
      <g class="mm-bob"><rect x="${x}" y="${y}" width="${MM.T}" height="${MM.T}" rx="9"/>
      <text x="${x + MM.T / 2}" y="${y + MM.T / 2 + 1}">${esc(z.emoji)}</text></g></g>`;
    return `<g class="mm-tile"><title>${name}</title>
      <rect x="${x}" y="${y}" width="${MM.T}" height="${MM.T}" rx="9"/>
      <text x="${x + MM.T / 2}" y="${y + MM.T / 2 + 1}">?</text></g>`;
  }).join("");
  return `<svg class="mini-map" viewBox="0 0 ${MM.W} ${MM.H}" role="img" aria-label="캠퍼스 탐험 지도: ${zones.length}곳 중 ${done.filter(Boolean).length}곳 클리어">
    <rect class="mm-bg" width="${MM.W}" height="${MM.H}" rx="16"/>${roads}${tiles}</svg>`;
}

/* ---------- 캠퍼스 탐험 (홈 카드의 "미션 하러 가기"로 여는 상세 화면): 지도 · 장소 목록 ---------- */
export function renderExplore(cleared = 0, total = 0) {
  $("view-explore").innerHTML = `
    ${subHeader("캠퍼스 탐험", `<span class="qm-chip">${cleared} / ${total} 장소</span>`)}
    <p class="map-guide">지도나 목록에서 장소를 골라 미션을 시작해 보세요.</p>
    <div id="campus-map" role="application" aria-label="경북대학교 캠퍼스 지도"></div>
    <h3 class="sec">장소 목록</h3>
    <div id="zone-list"></div>`;
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
export function renderZoneList(zones, isDone, justCleared = new Set()) {
  const el = $("zone-list");
  if (!el) return;
  const rows = zones
    .map((z) => ({
      zone: z,
      done: z.missions.every((m) => isDone(m.id)),
      doneCnt: z.missions.filter((m) => isDone(m.id)).length,
    }))
    .sort((a, b) => Number(a.done) - Number(b.done));

  el.innerHTML = rows.map(({ zone: z, done, doneCnt }) => `
    <button type="button" class="zone-row ${done ? "cleared" : ""} ${justCleared.has(z.id) ? "just-cleared" : ""}" data-zone="${z.id}">
      <span class="zr-emoji">${esc(z.emoji)}</span>
      <span class="zr-body">
        <strong>${esc(z.name)}</strong>
        <span>${doneCnt}/${z.missions.length} 미션</span>
      </span>
      ${done ? '<span class="zr-check">✓ 통과</span>' : '<span class="zr-arrow">›</span>'}
    </button>`).join("");
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
    : quiz.correct ? "✅ 오늘 정답을 맞혔어요" : "📝 오늘 퀴즈는 풀었어요";
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

export function renderRankInto(container, rows, mode, onMode) {
  if (!container) return;
  const meIdx = rows.findIndex((r) => r.me);
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
      <button data-m="total" class="${mode === "total" ? "on" : ""}">개인</button>
      <button data-m="dept" class="${mode === "dept" ? "on" : ""}">단과대</button>
    </div>
    <div class="card my-rank">
      <div>
        <div class="sum-label">내 ${mode === "dept" ? "단과대 " : ""}순위</div>
        <div class="my-big">${meIdx + 1}위</div>
      </div>
      <div class="my-side"><b>${rows[meIdx].score}</b> ${unit}<br><small>전체 ${rows.length}${mode === "dept" ? "개 단과대" : "명"}</small></div>
    </div>
    <div class="podium">${podium}</div>
    ${list ? `<ol class="ranklist">${list}</ol>` : ""}
    <p class="note">지금은 데모용 더미 순위예요. 서버를 연결하면 실제 참가자 순위가 표시돼요.</p>`;
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
  if (p.best) {
    const others = p.comment_count - 1;
    return `
      <button class="best-ans" type="button" data-act="comment">
        <span class="best-top">
          <span class="best-badge">👑 베스트 답변</span>
          <b>${esc(p.best.nickname)}</b>
          <span class="best-like">${ICON_HEART}${p.best.like_count}</span>
        </span>
        <span class="best-text">${esc(p.best.message)}</span>
        <span class="best-more">${others > 0 ? `다른 답변 ${others}개 더 보기` : "답변 보기"}</span>
      </button>`;
  }
  return `<button class="comment-line" type="button" data-act="comment">${
    p.comment_count ? `답변 ${p.comment_count}개 보기 · 도움이 된 답변에 ♥를 눌러주세요` : "아직 답변이 없어요 · 첫 답변을 남겨보세요"}</button>`;
}

function postCardHtml(p, zoneName, myId) {
  const q = p.kind === "question";
  return `
    <article class="post ${q ? "q-post" : ""} ${p.guide ? "guide" : ""}" data-post="${esc(p.id)}">
      ${p.guide ? `<div class="guide-ribbon">📌 이렇게 질문해 보세요 · 예시</div>` : ""}
      <header class="post-head">
        ${avatar(p.nickname)}
        <div class="post-meta">
          <b>${esc(p.nickname)}${p.guide ? ` <span class="guide-chip">가이드</span>` : ""}</b>
          <span>${p.zone_id ? `<em>📍 ${esc(zoneName(p.zone_id))}</em> · ` : ""}${p.guide ? "고정됨" : timeAgo(p.created_at)}</span>
        </div>
        ${!p.guide && p.user_id !== myId ? `<button class="post-report" type="button" data-act="report" aria-label="신고하기" title="신고하기">🚩</button>` : ""}
      </header>
      ${p.photo_url ? `
      <div class="post-photo" data-act="photo">
        <img src="${esc(p.photo_url)}" alt="${esc(p.nickname)}님이 올린 사진" loading="lazy">
        <span class="heart-burst" aria-hidden="true">${ICON_HEART}</span>
      </div>` : ""}
      ${p.message ? `<p class="post-text ${p.photo_url ? "" : "solo"}">${q ? `<span class="q-mark">Q.</span>` : ""}${esc(p.message)}</p>` : ""}
      <div class="post-actions">
        <button class="act act-like ${p.liked ? "on" : ""}" type="button" data-act="like"
                aria-pressed="${p.liked}" aria-label="${q ? "나도 궁금해요" : "좋아요"}">${ICON_HEART}<span class="act-n">${p.like_count || ""}</span></button>
        <button class="act act-comment" type="button" data-act="comment" aria-label="${q ? "답변" : "댓글"}">${ICON_COMMENT}<span class="act-n">${p.comment_count || ""}</span></button>
        ${q && p.like_count ? `<span class="act-hint">${p.like_count}명이 궁금해해요</span>` : ""}
      </div>
      <div class="post-foot">${postFootHtml(p)}</div>
    </article>`;
}

// board: "post"(자유게시판) | "question"(질문), posts: listPosts() 결과(최신순), filter: "all" | "mine",
// myId: 내 프로필 id (내 글엔 신고 버튼을 숨긴다)
// 버튼에는 data-act(like | comment | photo | report)가 붙어 있고, 클릭 처리는 main.js에서 위임으로 한다.
// 맨 위는 "내 순위" 대표 카드(누르면 전체 랭킹 상세 화면), 그 아래 게시판.
// "내 글만 보기"는 탭 안의 탭으로 두지 않고 내 정보 > 내가 쓴 글에서 들어오게 했다 (들어오면 위에 칩이 뜸).
export function renderCommunity(zones, posts, { board = "post", filter = "all" } = {}, myId = null) {
  const zoneName = (id) => zones.find((z) => z.id === id)?.name || "";
  const q = board === "question";
  $("view-community").innerHTML = `
    <div class="card card-hero rank-hero" id="rank-hero">
      <div class="qm-head"><span class="qm-title">🏆 내 순위</span></div>
      <div class="rank-hero-stats">
        <div><span class="sum-label">개인</span><b id="rh-total">-</b><small id="rh-total-sub">불러오는 중</small></div>
        <div><span class="sum-label">단과대</span><b id="rh-dept">-</b><small id="rh-dept-sub">&nbsp;</small></div>
      </div>
      <button id="btn-rank-all" class="btn alt-ghost">전체 랭킹 보기</button>
    </div>
    <h3 class="sec">게시판</h3>
    <div class="seg" role="tablist" style="margin:0 0 6px">
      <button data-board="post" role="tab" aria-selected="${!q}" class="${q ? "" : "on"}">자유게시판</button>
      <button data-board="question" role="tab" aria-selected="${q}" class="${q ? "on" : ""}">❓ 질문</button>
    </div>
    ${filter === "mine"
      ? `<button type="button" class="filter-chip" data-f="all">${q ? "내 질문" : "내가 쓴 글"}만 보는 중 <span aria-hidden="true">✕</span><span class="sr-only">전체 보기</span></button>`
      : `<p class="map-guide">${q
        ? "캠퍼스·미션에 대해 궁금한 걸 물어보세요. 도움이 된 답변에 ♥를 누르면 베스트 답변으로 올라가요."
        : "캠퍼스 곳곳의 이야기와 호반우 인증샷을 자유롭게 나눠보세요."}</p>`}
    <div class="feed">
      ${posts.length ? posts.map((p) => postCardHtml(p, zoneName, myId)).join("") : `
        <div class="card" style="text-align:center;margin:0">
          <p style="color:var(--mute);margin:0">${filter === "mine"
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
  const card = document.querySelector(`#view-community [data-post="${CSS.escape(p.id)}"]`);
  if (!card) return;
  const like = card.querySelector(".act-like");
  like.classList.toggle("on", p.liked);
  like.setAttribute("aria-pressed", p.liked);
  like.querySelector(".act-n").textContent = p.like_count || "";
  if (pop) { like.classList.remove("pop"); void like.offsetWidth; like.classList.add("pop"); }
  card.querySelector(".act-comment .act-n").textContent = p.comment_count || "";
  const hint = card.querySelector(".act-hint");
  if (p.kind === "question") {
    if (p.like_count) {
      const h = hint || card.querySelector(".post-actions").appendChild(Object.assign(document.createElement("span"), { className: "act-hint" }));
      h.textContent = `${p.like_count}명이 궁금해해요`;
    } else hint?.remove();
  }
  card.querySelector(".post-foot").innerHTML = postFootHtml(p);
}

// 사진 더블탭 시 가운데 큰 하트가 톡 튀어나왔다 사라지는 효과
export function heartBurst(postId) {
  const b = document.querySelector(`#view-community [data-post="${CSS.escape(postId)}"] .heart-burst`);
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
                               title = "", placeholder = "무슨 얘기를 남길까요?", onSubmit, onClose }) {
  const m = $("modal");
  m.classList.remove("hidden");
  m.classList.add("modal-center");

  const photoSrc = (p) => (typeof p === "string" ? p : URL.createObjectURL(p));

  m.innerHTML = `
    <div class="modal-card pop-in" style="text-align:left">
      <h2 style="font-size:18px;text-align:center">${title || (photo ? "📤 커뮤니티에 올리기" : "✏️ 글쓰기")}</h2>
      ${!lockZone && zones ? `
        <select id="cw-zone" class="text-in" style="margin-bottom:8px">
          <option value="">📍 장소 선택 안 함</option>
          ${zones.map((z) => `<option value="${esc(z.id)}" ${z.id === zoneId ? "selected" : ""}>${esc(z.name)}</option>`).join("")}
        </select>` : (zoneName ? `<div class="sum-foot" style="margin-bottom:8px">📍 ${esc(zoneName)}</div>` : "")}
      ${photo
        ? `<img class="gb-photo-lg" src="${photoSrc(photo)}" alt="">`
        : `<label class="btn-file small">📷 사진 추가 (선택)<input id="cw-photo" type="file" accept="image/*" hidden></label>
           <span id="cw-photo-name" class="sum-foot" style="margin:4px 0 0;display:block"></span>`}
      <textarea id="cw-msg" class="text-in" placeholder="${esc(placeholder)}" maxlength="200" rows="3" style="margin-top:10px"></textarea>
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
  // AR 미션은 보너스라 "완료한 미션" 집계에서 빼고, 구역별 메인 미션 1개만 센다 (8구역 = 8개)
  const missions = zones.flatMap((z) => z.missions).filter((m) => m.type !== "ar");
  const doneCnt = missions.filter((m) => isDone(m.id)).length;
  const clearCnt = zones.filter((z) => z.missions.every((m) => isDone(m.id))).length;

  // 가입한 지 며칠째인지 (개인 정보 한 줄 요약에 사용)
  const joinedAt = st.startedAt || Date.now();
  const daysWith = Math.max(1, Math.floor((Date.now() - joinedAt) / 86400000) + 1);
  const joinedDateText = new Date(joinedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  const el = $("view-me");
  el.innerHTML = `
    <div class="card card-hero me-hero">
      <img class="me-college" src="${collegeSticker(st.profile.dept)}" alt="${esc(st.profile.dept)} 호반우">
      <div class="sum-label">${esc(st.profile.dept)}</div>
      <div class="sum-big" style="font-size:26px">${esc(st.profile.nickname)}</div>
      <div class="sum-foot" style="margin-top:6px">
        Lv.${lv.level} ${lv.title} · ${lv.maxed ? "최고 레벨 달성!" : `다음 레벨까지 ${lv.next} XP`}
        <button id="btn-level-info" class="level-info-btn" type="button" aria-label="레벨 기준 보기">ⓘ</button>
      </div>
      <div class="progress"><i style="width:${lv.pct}%"></i></div>
      <div class="stats">
        <div class="stat"><b>${st.score}</b><span>총 XP</span></div>
        <div class="stat"><b>${doneCnt}/${missions.length}</b><span>완료한 미션 · ${clearCnt}개 구역</span></div>
        <div class="stat"><b>D+${daysWith}</b><span>함께한 지</span></div>
      </div>
      <div class="sum-foot" style="margin-top:10px">${joinedDateText}에 캠퍼스 퀘스트를 시작했어요</div>
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