import { getState, isDone, getLevel } from "./storage.js";
import { getCachedProfile } from "./supa.js";

const $ = (id) => document.getElementById(id);

// 사용자가 입력한 문자열(닉네임 등)을 HTML에 넣을 때는 반드시 esc()를 거친다
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- 화면 전환 ---------- */
const VIEWS = ["onboard", "home", "quest", "community", "me", "zone"];
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
    <img class="mascot-hero" src="img/mascot/commute1.png" alt="등교하는 호반우">
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
export function renderDashboard(zones, announcements, onGoQuest) {
  const st = getState();
  const lv = getLevel(st.score);
  const total = zones.reduce((a, z) => a + z.missions.length, 0);
  const done = zones.reduce((a, z) => a + z.missions.filter((m) => isDone(m.id)).length, 0);
  const preview = announcements.slice(0, 2);
  const nextZone = zones.find((z) => z.missions.some((m) => !isDone(m.id)));

  $("view-home").innerHTML = `
    <div style="position:relative">
      <img class="mascot-corner" src="img/mascot/cheer.png" alt="응원하는 호반우">
      <h1 class="onb-title" style="font-size:22px">${esc(st.profile.nickname)}님, 안녕하세요!</h1>
      <p class="map-guide">오늘도 캠퍼스를 채워볼까요?</p>
    </div>
    <div class="card card-hero">
      <div class="sum-label">진행 상황</div>
      <div class="sum-big">${done}<small> / ${total} 미션</small></div>
      <div class="progress"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>
      <div class="sum-foot">Lv.${lv.level} ${lv.title} · 다음 레벨까지 ${lv.next} XP</div>
      ${nextZone ? `<div class="sum-foot" style="margin-top:10px;font-weight:700;color:var(--primary)">다음 목적지 · ${esc(nextZone.emoji)} ${esc(nextZone.name)}</div>` : ""}
      <button id="btn-go-quest" class="btn cta-glow" style="margin-top:18px">${nextZone ? "미션 하러 가기" : "다시 둘러보기"}</button>
    </div>
    <h3 class="sec">공지사항</h3>
    <div class="list-card">
      ${preview.length ? preview.map((a) => `
        <div class="zone-card" style="cursor:default">
          <div class="zc-body"><strong>${a.dept ? `<span style="color:var(--primary);font-weight:700">[${esc(a.dept)}]</span> ` : ""}${esc(a.title)}</strong><span>${esc(a.body || "")}</span></div>
        </div>`).join("") : `
        <div class="card" style="text-align:center;margin:0">
          <img src="img/mascot/save-earth.png" alt="호반우" style="width:100px;margin:0 auto 10px">
          <p style="color:var(--mute);margin:0">아직 공지가 없어요</p>
        </div>`}
    </div>`;
  $("btn-go-quest").onclick = onGoQuest;
}
/* ---------- 퀘스트: 랜딩(메인 미션) + 탐험(지도·목록·랭킹) ---------- */
// 퀘스트 탭을 열면 바로 지도가 아니라, "메인 미션"을 소개하는 꾸며진 랜딩 화면이 먼저 보인다.
// 거기서 버튼을 눌러야 지도 + 구역 목록이 나오는 탐험 화면으로 들어간다.
export function renderQuestShell(cleared = 0, total = 0, nextZone = null) {
  $("view-quest").innerHTML = `
    <div id="quest-landing">
      <div style="position:relative">
        <img class="mascot-corner" src="img/mascot/commute1.png" alt="호반우">
        <h1 class="onb-title" style="font-size:22px">오늘의 캠퍼스 미션</h1>
        <p class="map-guide">메인 미션부터 하나씩 깨러 가볼까요?</p>
      </div>
      <div class="card card-hero" style="text-align:center">
        <img class="mascot-hero" style="width:104px;margin:0 auto 8px" src="img/mascot/badge-campus.png" alt="호반우">
        <div class="sum-label">캠퍼스 점령도</div>
        <div class="sum-big">${cleared}<small> / ${total} 구역</small></div>
        <div class="progress"><i style="width:${total ? (cleared / total) * 100 : 0}%"></i></div>
        ${nextZone
          ? `<div class="sum-foot" style="margin-top:10px;font-weight:700;color:var(--primary)">메인 미션 · ${esc(nextZone.emoji)} ${esc(nextZone.name)}</div>`
          : `<div class="sum-foot" style="margin-top:10px;font-weight:700;color:var(--primary)">모든 구역을 클리어했어요!</div>`}
        <button id="btn-quest-enter" class="btn cta-glow" style="margin-top:18px">${nextZone ? "메인 미션 시작하기" : "지도 둘러보기"}</button>
      </div>
      <div id="daily-section"></div>
    </div>
    <div id="quest-explore" class="hidden">
      <button type="button" id="btn-quest-back" class="back-link">‹ 미션 홈으로</button>
      <div class="seg quest-seg">
        <button data-m="map" class="on">지도</button>
        <button data-m="rank">랭킹</button>
      </div>
      <div id="quest-map-pane">
        <h1 class="sec campus-title">캠퍼스 지도</h1>
        <p class="map-guide">지도에서 장소를 선택해 미션을 시작해 보세요.</p>
        <div id="campus-map" role="application" aria-label="경북대학교 캠퍼스 지도"></div>
        <h3 class="sec">나머지 구역</h3>
        <div id="zone-list"></div>
      </div>
      <div id="quest-rank-pane" class="hidden"></div>
    </div>`;
}

// 구역 목록(메인 미션 제외): 남은 구역은 위, 다 깬 구역은 아래로. 방금 막 다 깬 구역(justCleared)은 "통과" 도장 효과
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

  if (!rows.length) {
    el.innerHTML = `<p class="map-guide" style="text-align:center">메인 미션 외에 다른 구역은 없어요.</p>`;
    return;
  }

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
export function renderDaily(checkin, quiz) {
  const el = $("daily-section");
  if (!el) return;
  const quizStatus = !quiz.done ? "경북대 상식 퀴즈에 도전해 보세요!"
    : quiz.correct ? "✅ 오늘 정답을 맞혔어요" : "📝 오늘 퀴즈는 풀었어요";
  el.innerHTML = `
    <h3 class="sec">오늘의 데일리</h3>
    <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div>
        <div class="sum-label">출석 체크</div>
        <div class="sum-big" style="font-size:19px">${checkin.done ? "✅ 오늘 출석 완료" : "오늘도 출석해볼까요?"}</div>
        <div class="sum-foot">🔥 연속 ${checkin.streak}일째</div>
      </div>
      <button id="btn-daily-checkin" class="chip primary" style="white-space:nowrap" ${checkin.done ? "disabled" : ""}>
        ${checkin.done ? "완료" : "+10 XP"}
      </button>
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
  container.querySelectorAll(".seg-sub button").forEach((b) => (b.onclick = () => onMode(b.dataset.m)));
}

/* ---------- 커뮤니티 ---------- */
export function renderCommunity(announcements) {
  $("view-community").innerHTML = `
    <h1 class="sec" style="margin-top:4px">커뮤니티</h1>
    <p class="map-guide">공지사항과 학교 소식을 확인해 보세요.</p>
    <div class="list-card">
      ${announcements.length ? announcements.map((a) => `
        <div class="zone-card" style="cursor:default">
          <div class="zc-body"><strong>${a.dept ? `<span style="color:var(--primary);font-weight:700">[${esc(a.dept)}]</span> ` : ""}${esc(a.title)}</strong><span>${esc(a.body || "")}</span></div>
        </div>`).join("") : `
        <div class="card" style="text-align:center;margin:0">
          <img src="img/mascot/polarbear-friends.png" alt="호반우와 친구들" style="width:140px;margin:0 auto 10px">
          <p style="color:var(--mute);margin:0">아직 공지가 없어요</p>
        </div>`}
    </div>`;
}

/* ---------- 내 정보 ---------- */
export function renderMe(zones, onReset, onRanking) {
  const st = getState();
  const myCode = getCachedProfile()?.code;
  const lv = getLevel(st.score);
  const missions = zones.flatMap((z) => z.missions);
  const doneCnt = missions.filter((m) => isDone(m.id)).length;
  const clearCnt = zones.filter((z) => z.missions.every((m) => isDone(m.id))).length;

  // 가입한 지 며칠째인지 (개인 정보 한 줄 요약에 사용)
  const joinedAt = st.startedAt || Date.now();
  const daysWith = Math.max(1, Math.floor((Date.now() - joinedAt) / 86400000) + 1);
  const joinedDateText = new Date(joinedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  const el = $("view-me");
  el.innerHTML = `
    <div class="card card-hero" style="position:relative">
      <img class="mascot-corner" src="img/mascot/badge-campus.png" alt="호반우" style="width:64px">
      <div class="sum-label">${esc(st.profile.dept)}</div>
      <div class="sum-big" style="font-size:26px">${esc(st.profile.nickname)}</div>
      <div class="sum-foot" style="margin-top:6px">Lv.${lv.level} ${lv.title} · 다음 레벨까지 ${lv.next} XP</div>
      <div class="progress"><i style="width:${lv.pct}%"></i></div>
      <div class="stats">
        <div class="stat"><b>${st.score}</b><span>총 XP</span></div>
        <div class="stat"><b>${doneCnt}/${missions.length}</b><span>완료한 미션 · ${clearCnt}개 구역</span></div>
        <div class="stat"><b>D+${daysWith}</b><span>함께한 지</span></div>
      </div>
      <div class="sum-foot" style="margin-top:10px">${joinedDateText}에 캠퍼스 퀘스트를 시작했어요</div>
    </div>
    <button id="btn-ranking" class="btn" style="margin-top:16px">랭킹 보기</button>
    ${myCode ? `
    <div class="card" style="text-align:center;margin-top:16px">
      <div class="sum-label">내 친구 코드</div>
      <div class="sum-big" style="font-size:30px;letter-spacing:4px">${esc(myCode)}</div>
      <div class="sum-foot">'함께하기' 미션에서 친구에게 이 코드를 알려주세요</div>
    </div>` : ""}
    <h3 class="sec">설정</h3>
    <button id="btn-reset" class="btn alt" style="margin-top:0">기록 초기화하고 처음부터 시작</button>`;
  $("btn-reset").onclick = () => {
    if (confirm("모든 점수와 기록을 지우고 처음부터 시작할까요?")) onReset();
  };
  $("btn-ranking").onclick = onRanking;
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

export function updateDebug(pos, r) {
  $("debug").textContent =
    `lat ${pos.lat.toFixed(5)} lng ${pos.lng.toFixed(5)} ` +
    `acc ${Math.round(pos.accuracy)}m dist ${Math.round(r.distance)}m ` +
    `${r.status} streak ${r.streak}`;
}