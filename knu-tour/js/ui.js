import { getState, isDone, getLevel } from "./storage.js";

const $ = (id) => document.getElementById(id);

// 사용자가 입력한 문자열(닉네임 등)을 HTML에 넣을 때는 반드시 esc()를 거친다
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- 화면 전환 ---------- */
const VIEWS = ["onboard", "home", "rank", "me", "zone"];
export function showView(name) {
  VIEWS.forEach((v) => $("view-" + v).classList.toggle("hidden", v !== name));
  document.body.dataset.view = name;
  document.querySelectorAll("#tabbar button").forEach((b) =>
    b.classList.toggle("on", b.dataset.tab === name));
  window.scrollTo({ top: 0, behavior: "instant" });
}

/* ---------- 상단 XP ---------- */
let lastLevel = 0;
export function updateHud() {
  const s = getState();
  const lv = getLevel(s.score);
  $("lv").textContent = `Lv.${lv.level}`;
  $("score").textContent = `${s.score} XP`;
  $("xpfill").style.width = lv.pct + "%";
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
  const sc = $("score");
  sc.classList.remove("pop");
  void sc.offsetWidth;
  sc.classList.add("pop");
}

/* ---------- 온보딩 ---------- */
export function renderOnboard(depts, onSubmit) {
  $("view-onboard").innerHTML = `
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

/* ---------- 홈: 구역 선택 ---------- */
export function renderHome(zones, onSelect) {
  const st = getState();
  const lv = getLevel(st.score);
  const cleared = (z) => z.missions.every((m) => isDone(m.id));
  const total = zones.reduce((a, z) => a + z.missions.length, 0);
  const done = zones.reduce((a, z) => a + z.missions.filter((m) => isDone(m.id)).length, 0);

  const el = $("view-home");
  el.innerHTML = `
    <div class="card">
      <div class="sum-label">${esc(st.profile.nickname)}님의 진행 상황</div>
      <div class="sum-big">${done}<small> / ${total} 미션</small></div>
      <div class="progress"><i style="width:${(done / total) * 100}%"></i></div>
      <div class="stamps">
        ${zones.map((z) => `<div class="stamp ${cleared(z) ? "on" : ""}" title="${esc(z.name)}">${z.emoji}</div>`).join("")}
      </div>
      <div class="sum-foot">${lv.title} · 다음 레벨까지 ${lv.next} XP</div>
    </div>
    <h3 class="sec">구역</h3>
    <div class="list-card" id="zone-list"></div>`;

  const list = $("zone-list");
  zones.forEach((z) => {
    const d = z.missions.filter((m) => isDone(m.id)).length;
    const full = d === z.missions.length;
    const b = document.createElement("button");
    b.className = "zone-card" + (full ? " clear" : "");
    b.innerHTML = `
      <div class="zc-emoji">${z.emoji}</div>
      <div class="zc-body"><strong>${z.name}</strong><span>${z.desc}</span></div>
      <div class="zc-side">${full ? "완료" : `${d}/${z.missions.length}`}</div>`;
    b.onclick = () => onSelect(z);
    list.appendChild(b);
  });
}

/* ---------- 랭킹 ---------- */
export function renderRank(rows, mode, onMode) {
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

  const el = $("view-rank");
  el.innerHTML = `
    <div class="seg">
      <button data-m="total" class="${mode === "total" ? "on" : ""}">개인</button>
      <button data-m="dept" class="${mode === "dept" ? "on" : ""}">소속</button>
    </div>
    <div class="card my-rank">
      <div>
        <div class="sum-label">내 ${mode === "dept" ? "소속 " : ""}순위</div>
        <div class="my-big">${meIdx + 1}위</div>
      </div>
      <div class="my-side"><b>${rows[meIdx].score}</b> ${unit}<br><small>전체 ${rows.length}${mode === "dept" ? "개 소속" : "명"}</small></div>
    </div>
    <div class="podium">${podium}</div>
    ${list ? `<ol class="ranklist">${list}</ol>` : ""}
    <p class="note">지금은 데모용 더미 순위예요. 서버를 연결하면 실제 참가자 순위가 표시돼요.</p>`;
  el.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => onMode(b.dataset.m)));
}

/* ---------- 내 정보 ---------- */
export function renderMe(zones, onReset) {
  const st = getState();
  const lv = getLevel(st.score);
  const missions = zones.flatMap((z) => z.missions);
  const doneCnt = missions.filter((m) => isDone(m.id)).length;
  const count = (t) => missions.filter((m) => m.type === t && isDone(m.id)).length;
  const clearCnt = zones.filter((z) => z.missions.every((m) => isDone(m.id))).length;
  const badges = [
    { e: "👣", n: "첫 발걸음", ok: doneCnt >= 1 },
    { e: "📸", n: "포토 헌터", ok: count("photo") >= 1 },
    { e: "🎤", n: "목소리 주인공", ok: count("voice") >= 1 },
    { e: "🧠", n: "퀴즈 러버", ok: count("quiz") + count("code") >= 1 },
    { e: "🚩", n: "구역 정복자", ok: clearCnt >= 1 },
    { e: "🏅", n: "캠퍼스 마스터", ok: doneCnt === missions.length },
  ];

  const el = $("view-me");
  el.innerHTML = `
    <div class="card">
      <div class="sum-label">${esc(st.profile.dept)}</div>
      <div class="sum-big" style="font-size:26px">${esc(st.profile.nickname)}</div>
      <div class="sum-foot" style="margin-top:6px">Lv.${lv.level} ${lv.title} · 다음 레벨까지 ${lv.next} XP</div>
      <div class="progress"><i style="width:${lv.pct}%"></i></div>
      <div class="stats">
        <div class="stat"><b>${st.score}</b><span>총 XP</span></div>
        <div class="stat"><b>${doneCnt}/${missions.length}</b><span>미션</span></div>
        <div class="stat"><b>${clearCnt}/${zones.length}</b><span>스탬프</span></div>
      </div>
    </div>
    <h3 class="sec">배지</h3>
    <div class="badges">
      ${badges.map((b) => `<div class="badge ${b.ok ? "" : "off"}"><span>${b.e}</span>${b.n}</div>`).join("")}
    </div>
    <h3 class="sec">설정</h3>
    <button id="btn-reset" class="btn alt" style="margin-top:0">기록 초기화하고 처음부터 시작</button>`;
  $("btn-reset").onclick = () => {
    if (confirm("모든 점수와 기록을 지우고 처음부터 시작할까요?")) onReset();
  };
}

/* ---------- 완주 시트 ---------- */
export function showFinale(onRank) {
  const st = getState();
  const mins = Math.max(1, Math.round((Date.now() - (st.startedAt || Date.now())) / 60000));
  const m = $("modal");
  m.classList.remove("hidden");
  m.innerHTML = `
    <div class="modal-card">
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
    el.textContent = `목표까지 약 ${Math.round(r.distance)}m 남았어요`;
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

export function updateDebug(pos, r) {
  $("debug").textContent =
    `lat ${pos.lat.toFixed(5)} lng ${pos.lng.toFixed(5)} ` +
    `acc ${Math.round(pos.accuracy)}m dist ${Math.round(r.distance)}m ` +
    `${r.status} streak ${r.streak}`;
}
