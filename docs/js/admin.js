// js/admin.js — OnCampus 관리자 페이지 (admin.html)
// 서버 쪽 권한은 Supabase의 admin_* 함수가 비밀번호로 확인한다. 이 페이지는 그 함수를 부르는 화면일 뿐이라,
// 비밀번호가 없으면 아무것도 바꿀 수 없다.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supa-config.js";

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },   // 관리자 페이지는 로그인 세션을 저장하지 않는다
});
const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
const fmt = (iso) => new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const empty = (msg) => `<p class="empty">${esc(msg)}</p>`;

/* ================= 보안: 잠금·자동 잠금·로그인 시도 제한 ================= */
// - 비밀번호는 이 탭(sessionStorage)에만, 마지막 활동 후 IDLE_MS가 지나면 자동으로 잠그고 지운다.
// - 비밀번호를 여러 번 틀리면 점점 길게 기다리게 한다 (서버의 admin_login도 IP별로 15분에 5번까지만).
const PW_KEY = "knu-quest-admin-pw";
const FAIL_KEY = "knu-quest-admin-fails";
const IDLE_MS = 20 * 60 * 1000;
let password = "";
let lastActive = Date.now();
let idleTimer = null;

function loadSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(PW_KEY) || "null");
    if (s && s.pw && Date.now() - s.at < IDLE_MS) return s.pw;
  } catch { /* 예전 형식(비밀번호만 저장)은 버린다 */ }
  sessionStorage.removeItem(PW_KEY);
  return "";
}
function saveSession() {
  if (password) sessionStorage.setItem(PW_KEY, JSON.stringify({ pw: password, at: lastActive }));
}
function lock(msg = "") {
  password = "";
  sessionStorage.removeItem(PW_KEY);
  clearInterval(idleTimer);
  $("admin-app").classList.add("hidden");
  $("lock-screen").classList.remove("hidden");
  $("pw-input").value = "";
  $("pw-err").textContent = msg;
  // 화면에 남은 학생 데이터도 지운다 (사용자 표는 .ad-scroll이 표 전체를 감싸서, 통째로 비우면 #user-list까지 사라진다 → 목록 칸만 비운다)
  document.querySelectorAll("#admin-app .ad-scroll[id], #user-list, #user-depts").forEach((el) => (el.innerHTML = ""));
  $("user-count").textContent = "";
}
function touch() {
  lastActive = Date.now();
  saveSession();
}
["click", "keydown", "scroll", "touchstart"].forEach((ev) => document.addEventListener(ev, touch, { passive: true }));
function startIdleWatch() {
  clearInterval(idleTimer);
  idleTimer = setInterval(() => {
    const left = IDLE_MS - (Date.now() - lastActive);
    if (left <= 0) return lock("오랫동안 사용하지 않아 잠갔어요. 다시 입력해 주세요.");
    $("ad-idle").textContent = left < 5 * 60 * 1000 ? `${Math.ceil(left / 60000)}분 뒤 자동 잠금` : "";
  }, 15000);
}

// 틀린 횟수에 따라 기다리는 시간: 3번째부터 30초, 60초, 120초 … 최대 10분 (이 탭 기준)
function failState() {
  try { return JSON.parse(sessionStorage.getItem(FAIL_KEY) || "null") || { n: 0, until: 0 }; } catch { return { n: 0, until: 0 }; }
}
function recordFail() {
  const f = failState();
  f.n += 1;
  if (f.n >= 3) f.until = Date.now() + Math.min(30000 * 2 ** (f.n - 3), 600000);
  sessionStorage.setItem(FAIL_KEY, JSON.stringify(f));
}
let waitTimer = null;
function showWait() {
  clearInterval(waitTimer);
  const tick = () => {
    const left = failState().until - Date.now();
    const blocked = left > 0;
    $("pw-submit").disabled = blocked;
    $("pw-input").disabled = blocked;
    if (blocked) $("pw-err").textContent = `비밀번호를 여러 번 틀렸어요. ${Math.ceil(left / 1000)}초 뒤에 다시 시도해 주세요.`;
    else { clearInterval(waitTimer); if ($("pw-err").textContent.startsWith("비밀번호를 여러 번")) $("pw-err").textContent = ""; }
  };
  tick();
  waitTimer = setInterval(tick, 1000);
}

// 로그인: 서버의 admin_login(시도 제한 있음, supabase/admin_security.sql)을 먼저 쓰고, 없으면 예전 방식으로 확인
async function checkPassword(pw) {
  const r = await client.rpc("admin_login", { p_password: pw });
  if (!r.error) {
    if (r.data === -2) return { ok: false, msg: "로그인 시도가 너무 많아요. 15분 뒤에 다시 시도해 주세요." };
    if (r.data === -1 || r.data === null) return { ok: false };
    return { ok: true, users: r.data };
  }
  const { data, error } = await client.rpc("admin_profile_count", { p_password: pw });
  return error ? { ok: false } : { ok: true, users: data };
}

async function tryEnter(pw, silent = false) {
  if (!pw) return;
  if (failState().until > Date.now()) { showWait(); return; }
  $("pw-err").textContent = "";
  $("pw-submit").disabled = true;
  const r = await checkPassword(pw);
  $("pw-submit").disabled = false;
  if (!r.ok) {
    sessionStorage.removeItem(PW_KEY);
    if (silent) return;
    recordFail();
    $("pw-err").textContent = r.msg || "비밀번호가 틀렸어요.";
    showWait();
    return;
  }
  sessionStorage.removeItem(FAIL_KEY);
  password = pw;
  touch();
  startIdleWatch();
  $("lock-screen").classList.add("hidden");
  $("admin-app").classList.remove("hidden");
  $("stat-users").textContent = r.users ?? "-";
  showPanel(sessionStorage.getItem("knu-admin-panel") || "notice");
  loadAll();
}

// 장소 id → 이름 (게시글·신고의 장소 태그를 'ilcheongdam' 대신 '일청담'으로)
let zoneNames = {};
const zoneName = (id) => zoneNames[id] || id;
fetch("data/zones.json").then((r) => r.json()).then((d) => {
  zoneNames = Object.fromEntries((d.zones || d).map((z) => [z.id, z.name]));
}).catch(() => {});

function loadAll() {
  loadNotices();
  loadCommunityPosts();
  loadReports();
  loadFeedback();
  loadUsers();
  loadThemes();
  loadHiddenMissions();
  loadDemoSetting();
  loadProgress();
}

$("pw-submit").onclick = () => tryEnter($("pw-input").value.trim());
$("pw-input").addEventListener("keydown", (e) => { if (e.key === "Enter") tryEnter($("pw-input").value.trim()); });
$("ad-logout").onclick = () => lock("로그아웃했어요.");
$("ad-refresh").onclick = () => loadAll();
showWait();
// 같은 탭에서 새로고침했고 아직 잠기지 않았으면 다시 입장 (틀려도 시도 횟수에 넣지 않음)
const saved = loadSession();
if (saved) tryEnter(saved, true);

/* ================= 탭 ================= */
function showPanel(name) {
  if (!$("panel-" + name)) name = "notice";
  document.querySelectorAll(".ad-panel").forEach((p) => p.classList.toggle("hidden", p.id !== "panel-" + name));
  document.querySelectorAll(".ad-tabs [data-panel]").forEach((b) => b.classList.toggle("on", b.dataset.panel === name));
  sessionStorage.setItem("knu-admin-panel", name);
  window.scrollTo({ top: 0 });
}
document.querySelectorAll(".ad-tabs [data-panel]").forEach((b) => (b.onclick = () => showPanel(b.dataset.panel)));
document.querySelectorAll(".ad-stat[data-go]").forEach((b) => (b.onclick = () => showPanel(b.dataset.go)));
const setCount = (tabId, statId, n) => {
  if (tabId) $(tabId).textContent = n ? n : "";
  if (statId) { $(statId).textContent = n; $(statId).closest(".ad-stat")?.classList.toggle("alert", n > 0 && statId !== "stat-posts"); }
};

// 사진 크게 보기
function lightbox(src) {
  const d = document.createElement("div");
  d.id = "ad-lightbox";
  d.innerHTML = `<img src="${esc(src)}" alt="">`;
  d.onclick = () => d.remove();
  document.body.appendChild(d);
}

/* ================= 📢 전체 알림 (앱의 🔔 알림 창에 📢로 뜸, announcements 표) ================= */
function updateNoticePreview() {
  const target = $("nt-target").value;
  $("nt-pv-title").textContent = `📢 ${target ? `[${target}] ` : ""}${$("nt-title").value.trim() || "(제목)"}`;
  $("nt-pv-body").textContent = $("nt-body").value.trim() || "앱 알림 창에 이렇게 보여요";
}
["nt-target", "nt-title", "nt-body"].forEach((id) => $(id).addEventListener("input", updateNoticePreview));

async function loadNotices() {
  const { data, error } = await client.from("announcements").select("*").order("created_at", { ascending: false }).limit(200);
  const list = $("nt-list");
  if (error) { list.innerHTML = empty("알림을 불러오지 못했어요."); return; }
  $("nt-count").textContent = data.length ? `보낸 알림 ${data.length}개` : "";
  if (!data.length) { list.innerHTML = empty("아직 보낸 알림이 없어요."); return; }
  list.innerHTML = data.map((a) => `
    <div class="row-item">
      <div class="row-body">
        <div class="row-top"><span class="chip-tag ${a.dept ? "" : "gray"}">${a.dept ? esc(a.dept) : "모든 사용자"}</span><b>${esc(a.title)}</b><time>${fmt(a.created_at)}</time></div>
        <p>${esc(a.body)}</p>
        <div class="row-act"><button class="danger" data-del="${esc(a.id)}">삭제</button></div>
      </div>
    </div>`).join("");
  list.querySelectorAll("[data-del]").forEach((btn) => (btn.onclick = async () => {
    if (!confirm("이 알림을 삭제할까요? 학생들 알림 창에서도 사라져요.")) return;
    const { error: e } = await client.rpc("admin_delete_announcement", { p_password: password, p_id: btn.dataset.del });
    if (e) { alert("삭제 실패: " + e.message); return; }
    loadNotices();
  }));
}

$("nt-send").onclick = async () => {
  const title = $("nt-title").value.trim();
  const body = $("nt-body").value.trim();
  const dept = $("nt-target").value || null;   // 모든 사용자 = null (빈 글자로 저장되면 앱에서 안 보일 수 있음)
  $("nt-err").textContent = "";
  if (!title || !body) { $("nt-err").textContent = "제목과 내용을 모두 입력해 주세요."; return; }
  if (!confirm(`${dept ? `'${dept}' 사용자` : "모든 사용자"}에게 알림을 보낼까요?`)) return;
  $("nt-send").disabled = true;
  const { error } = await client.rpc("admin_add_announcement", { p_password: password, p_title: title, p_body: body, p_dept: dept });
  $("nt-send").disabled = false;
  if (error) { $("nt-err").textContent = "보내기 실패: " + error.message; return; }
  $("nt-title").value = ""; $("nt-body").value = ""; $("nt-target").value = "";
  updateNoticePreview();
  loadNotices();
};

/* ================= 💬 커뮤니티 게시판 (검색 · 사진만 · 더 보기) ================= */
let posts = [], postShown = 30;
async function loadCommunityPosts() {
  const { data, error } = await client.rpc("admin_list_community_posts", { p_password: password });
  posts = error ? [] : data || [];
  setCount("tab-posts", "stat-posts", posts.length);
  postShown = 30;
  renderPosts(error ? "게시글을 불러오지 못했어요." : null);
}
function renderPosts(err) {
  const list = $("post-list");
  if (err) { list.innerHTML = empty(err); return; }
  const q = $("post-q").value.trim().toLowerCase();
  const onlyPhoto = $("post-photo").checked;
  const rows = posts.filter((p) => (!onlyPhoto || p.photo_url) &&
    (!q || `${p.nickname} ${p.message}`.toLowerCase().includes(q)));
  $("post-count").textContent = `${rows.length}개${rows.length !== posts.length ? ` (전체 ${posts.length}개 중)` : ""}`;
  list.innerHTML = rows.length ? rows.slice(0, postShown).map((p) => `
    <div class="row-item">
      ${p.photo_url ? `<img src="${esc(p.photo_url)}" alt="" data-zoom="${esc(p.photo_url)}" loading="lazy">` : ""}
      <div class="row-body">
        <div class="row-top"><b>${esc(p.nickname)}</b>${p.zone_id ? `<span class="chip-tag gray">${esc(zoneName(p.zone_id))}</span>` : ""}<time>${fmt(p.created_at)}</time></div>
        ${p.message ? `<p>${esc(p.message)}</p>` : ""}
        <div class="row-act"><button class="danger" data-del-post="${esc(p.id)}">삭제</button></div>
      </div>
    </div>`).join("") : empty("조건에 맞는 글이 없어요.");
  $("post-more").classList.toggle("hidden", rows.length <= postShown);
  list.querySelectorAll("[data-zoom]").forEach((im) => (im.onclick = () => lightbox(im.dataset.zoom)));
  list.querySelectorAll("[data-del-post]").forEach((btn) => (btn.onclick = () => deleteCommunityPost(btn.dataset.delPost)));
}
$("post-q").addEventListener("input", () => { postShown = 30; renderPosts(); });
$("post-photo").addEventListener("change", () => { postShown = 30; renderPosts(); });
$("post-more").onclick = () => { postShown += 30; renderPosts(); };

async function deleteCommunityPost(id) {
  if (!confirm("이 게시글을 삭제할까요? (사진이 있었다면 저장공간에는 남지만 더 이상 보이지 않아요)")) return;
  const { error } = await client.rpc("admin_delete_community_post", { p_password: password, p_id: id });
  if (error) { alert("삭제 실패: " + error.message); return; }
  loadCommunityPosts();
  loadReports();   // 지운 글에 달려있던 신고도 같이 사라짐 (DB에서 cascade 삭제됨)
}

/* ================= 🚩 신고 접수함 ================= */
async function loadReports() {
  const { data, error } = await client.rpc("admin_list_reports", { p_password: password });
  const list = $("report-list");
  const rows = error ? [] : data || [];
  setCount("tab-reports", "stat-reports", rows.length);
  $("report-count").textContent = rows.length ? `대기 중인 신고 ${rows.length}건` : "";
  if (!rows.length) { list.innerHTML = empty(error ? "신고를 불러오지 못했어요." : "접수된 신고가 없어요."); return; }
  list.innerHTML = rows.map((r) => `
    <div class="row-item">
      ${r.photo_url ? `<img src="${esc(r.photo_url)}" alt="" data-zoom="${esc(r.photo_url)}" loading="lazy">` : ""}
      <div class="row-body">
        <div class="row-top"><b>${esc(r.nickname)}</b>${r.zone_id ? `<span class="chip-tag gray">${esc(zoneName(r.zone_id))}</span>` : ""}<time>신고 ${fmt(r.reported_at)}</time></div>
        <p>${esc(r.message)}</p>
        ${r.reason ? `<p class="reason">신고 사유: ${esc(r.reason)}</p>` : ""}
        <div class="row-act">
          <button data-resolve="${esc(r.report_id)}">무시하기</button>
          <button class="danger" data-del-post="${esc(r.post_id)}">글 삭제</button>
        </div>
      </div>
    </div>`).join("");
  list.querySelectorAll("[data-zoom]").forEach((im) => (im.onclick = () => lightbox(im.dataset.zoom)));
  list.querySelectorAll("[data-resolve]").forEach((btn) => (btn.onclick = async () => {
    await client.rpc("admin_resolve_report", { p_password: password, p_id: btn.dataset.resolve });
    loadReports();
  }));
  list.querySelectorAll("[data-del-post]").forEach((btn) => (btn.onclick = () => deleteCommunityPost(btn.dataset.delPost)));
}

/* ================= 📮 의견과 제안 (supabase/account_feedback.sql) ================= */
let feedback = [];
async function loadFeedback() {
  const { data, error } = await client.rpc("admin_list_feedback", { p_password: password });
  if (error) {
    $("feedback-list").innerHTML = empty("의견을 불러오지 못했어요. Supabase에서 supabase/account_feedback.sql을 실행했는지 확인해 주세요.");
    return;
  }
  feedback = data || [];
  const newCount = feedback.filter((f) => f.status !== "done").length;
  setCount("tab-feedback", "stat-feedback", newCount);
  const cats = [...new Set(feedback.map((f) => f.category))];
  const sel = $("fb-cat"), keep = sel.value;
  sel.innerHTML = `<option value="">모든 유형</option>` + cats.map((c) => `<option>${esc(c)}</option>`).join("");
  sel.value = cats.includes(keep) ? keep : "";
  renderFeedback();
}
function renderFeedback() {
  const list = $("feedback-list");
  const onlyNew = document.querySelector('input[name="fb-f"]:checked')?.value !== "all";
  const q = $("fb-q").value.trim().toLowerCase(), cat = $("fb-cat").value;
  const rows = feedback.filter((f) => (!onlyNew || f.status !== "done") && (!cat || f.category === cat) &&
    (!q || `${f.message} ${f.nickname || ""}`.toLowerCase().includes(q)));
  $("fb-count").textContent = rows.length ? `${rows.length}건` : "";
  if (!rows.length) { list.innerHTML = empty(onlyNew ? "새 의견이 없어요." : "조건에 맞는 의견이 없어요."); return; }
  list.innerHTML = rows.map((f) => `
    <div class="row-item ${f.status === "done" ? "done" : ""}">
      <div class="row-body">
        <div class="row-top"><span class="chip-tag">${esc(f.category)}</span><b>${f.nickname ? esc(f.nickname) : "(탈퇴한 사용자)"}</b><time>${fmt(f.created_at)}</time></div>
        <p>${esc(f.message)}</p>
        ${f.device ? `<div class="sub">${esc(f.device)}</div>` : ""}
        <div class="row-act">
          <button data-fb-status="${esc(f.id)}" data-next="${f.status === "done" ? "new" : "done"}">${f.status === "done" ? "새 의견으로 되돌리기" : "확인 완료"}</button>
          <button class="danger" data-fb-del="${esc(f.id)}">삭제</button>
        </div>
      </div>
    </div>`).join("");
  list.querySelectorAll("[data-fb-status]").forEach((btn) => (btn.onclick = async () => {
    await client.rpc("admin_set_feedback_status", { p_password: password, p_id: btn.dataset.fbStatus, p_status: btn.dataset.next });
    loadFeedback();
  }));
  list.querySelectorAll("[data-fb-del]").forEach((btn) => (btn.onclick = async () => {
    if (!confirm("이 의견을 삭제할까요?")) return;
    await client.rpc("admin_delete_feedback", { p_password: password, p_id: btn.dataset.fbDel });
    loadFeedback();
  }));
}
document.querySelectorAll('input[name="fb-f"]').forEach((r) => (r.onchange = renderFeedback));
$("fb-q").addEventListener("input", renderFeedback);
$("fb-cat").addEventListener("change", renderFeedback);

/* ================= 👥 사용자 (닉네임·단과대·XP만, 검색·단과대·정렬·더 보기) ================= */
let users = [], userDept = "", userShown = 20;
async function loadUsers() {
  const { data, error } = await client.from("profiles").select("nickname, dept, score").order("score", { ascending: false }).limit(5000);
  users = error ? [] : data || [];
  if (error) { $("user-list").innerHTML = `<tr><td colspan="4" class="empty">사용자를 불러오지 못했어요.</td></tr>`; return; }
  const byDept = users.reduce((m, u) => m.set(u.dept || "(없음)", (m.get(u.dept || "(없음)") || 0) + 1), new Map());
  $("user-depts").innerHTML = `<button data-dept="" class="${userDept ? "" : "on"}">전체 ${users.length}</button>` +
    [...byDept].sort((a, b) => b[1] - a[1]).map(([d, n]) => `<button data-dept="${esc(d)}" class="${userDept === d ? "on" : ""}">${esc(d)} ${n}</button>`).join("");
  $("user-depts").querySelectorAll("[data-dept]").forEach((b) => (b.onclick = () => {
    userDept = b.dataset.dept; userShown = 20;
    $("user-depts").querySelectorAll("[data-dept]").forEach((x) => x.classList.toggle("on", x === b));
    renderUsers();
  }));
  renderUsers();
}
function renderUsers() {
  const q = $("user-q").value.trim().toLowerCase();
  let rows = users.map((u, i) => ({ ...u, rank: i + 1 }))
    .filter((u) => (!userDept || (u.dept || "(없음)") === userDept) && (!q || String(u.nickname).toLowerCase().includes(q)));
  if ($("user-sort").value === "name") rows = rows.sort((a, b) => String(a.nickname).localeCompare(String(b.nickname), "ko"));
  $("user-count").textContent = `${rows.length}명`;
  $("user-list").innerHTML = rows.slice(0, userShown).map((u) => `
    <tr><td class="num">${u.rank}</td><td>${esc(u.nickname)}</td><td>${esc(u.dept || "-")}</td><td class="num">${(u.score || 0).toLocaleString()}</td></tr>`).join("")
    || `<tr><td colspan="4" class="empty">조건에 맞는 사용자가 없어요.</td></tr>`;
  $("user-more").classList.toggle("hidden", rows.length <= userShown);
}
$("user-q").addEventListener("input", () => { userShown = 20; renderUsers(); });
$("user-sort").addEventListener("change", renderUsers);
$("user-more").onclick = () => { userShown += 20; renderUsers(); };

/* ================= ⚙️ 운영 설정 · 📍 진행 현황 (예전 코드 그대로) ================= */
/* ---------- 🗓️ 테마(시즌) 기간 · 기본 테마 ---------- */
// 테마 목록은 data/themes.json, 관리자가 바꾼 날짜·기본 테마는 Supabase theme_settings (supabase/themes.sql)
async function loadThemes() {
  const list = $("theme-list"), now = $("theme-now");
  let cfg = null, zones = [];
  try {
    cfg = await (await fetch("data/themes.json")).json();
    zones = (await (await fetch("data/zones.json")).json()).zones || [];
  } catch { /* ignore */ }
  if (!cfg) { list.textContent = "data/themes.json을 불러오지 못했어요."; return; }
  const { data, error } = await client.from("theme_settings").select("*");
  if (error) {
    list.innerHTML = `<p style="color:var(--mute);font-size:var(--fs-sm, 13px)">테마 설정 표가 아직 없어요. supabase/themes.sql을 SQL Editor에서 실행해 주세요.</p>`;
    return;
  }
  const saved = Object.fromEntries((data || []).map((r) => [r.id, r]));
  const themes = cfg.themes.map((t) => ({
    ...t,
    start: saved[t.id]?.start_date || t.start,
    end: saved[t.id]?.end_date || t.end,
  }));
  const defaultId = (data || []).find((r) => r.is_default)?.id || cfg.defaultTheme || themes[0]?.id;
  const missionName = Object.fromEntries(zones.flatMap((z) => z.missions.map((m) => [m.id, `${z.name}·${m.title}`])));

  // 지금 앱에 적용되는 테마 (앱과 같은 규칙: 오늘이 기간 안인 테마 → 없으면 기본 테마)
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const active = themes.find((t) => t.start && t.end && t.start <= today && today <= t.end);
  const shown = active || themes.find((t) => t.id === defaultId);
  now.innerHTML = `오늘(${today}) 앱에 보이는 테마: <b>${esc(shown?.emoji || "")} ${esc(shown?.name || "-")}</b>
    <span style="color:var(--mute)">${active ? "(기간 안)" : "(기간 밖이라 기본 테마)"}</span>`;

  list.innerHTML = themes.map((t) => `
    <div class="theme-row" data-theme="${esc(t.id)}">
      <div class="tr-head">
        <b>${esc(t.emoji || "")} ${esc(t.name)}</b>
        <label class="tr-default"><input type="radio" name="default-theme" value="${esc(t.id)}" ${t.id === defaultId ? "checked" : ""}> 기본 테마</label>
      </div>
      <div class="tr-missions">${t.missions.map((id) => esc(missionName[id] || id)).join(" · ")}${(t.special || []).length ? ` · 특별: ${t.special.map((s) => `${esc(s.title)}(${esc(s.date)})`).join(", ")}` : ""}</div>
      <div class="tr-dates">
        <input type="date" data-k="start" value="${esc(t.start || "")}"> ~
        <input type="date" data-k="end" value="${esc(t.end || "")}">
        <button type="button" data-save>기간 저장</button>
      </div>
    </div>`).join("");

  list.querySelectorAll("[data-save]").forEach((btn) => {
    btn.onclick = async () => {
      const row = btn.closest("[data-theme]");
      const start = row.querySelector('[data-k="start"]').value || null;
      const end = row.querySelector('[data-k="end"]').value || null;
      if (start && end && end < start) { alert("종료일이 시작일보다 빨라요."); return; }
      // 다른 테마와 기간이 겹치면 앞쪽 테마가 우선이라 미리 알려준다
      const overlap = themes.find((o) => o.id !== row.dataset.theme && o.start && o.end && start && end && !(end < o.start || o.end < start));
      if (overlap && !confirm(`'${overlap.name}' 테마와 기간이 겹쳐요. 겹치는 날엔 목록에서 위에 있는 테마가 보여요. 그래도 저장할까요?`)) return;
      btn.disabled = true;
      const { error } = await client.rpc("admin_set_theme", { p_password: password, p_id: row.dataset.theme, p_start: start, p_end: end });
      btn.disabled = false;
      if (error) { alert("저장 실패: " + error.message); return; }
      loadThemes();
    };
  });
  list.querySelectorAll('input[name="default-theme"]').forEach((r) => {
    r.onchange = async () => {
      const { error } = await client.rpc("admin_set_default_theme", { p_password: password, p_id: r.value });
      if (error) { alert("변경 실패: " + error.message); }
      loadThemes();
    };
  });
}

/* ---------- ✨ 히든미션 on/off ---------- */
// id -> 관리자 페이지에 보여줄 이름. main.js의 HIDDEN_MISSIONS와 같은 id를 쓴다.
const HIDDEN_MISSION_LABELS = { "otter-sincheon": "🦦 신천 수달", "festival-cheer": "🎉 축제 응원 연습 (대운동장 AR 휴대폰 흔들기)" };
// 이름 옆에 붙는 안내 (장주연)
const HIDDEN_MISSION_NOTES = { "festival-cheer": "축제 2~3주 전부터 켜 주세요. 켜면 홈에 축제 카드가 뜨고, 끄면 바로 사라져요. (설정 줄이 없으면 꺼짐)" };

async function loadHiddenMissions() {
  let { data, error } = await client.from("hidden_mission_settings").select("*");
  data = (data || []).filter((h) => h.id !== DEMO_ID);   // 데모 모드 줄은 아래 "데모 모드" 칸에서 따로
  const list = $("hidden-list");
  if (error) {
    list.innerHTML = `<p style="color:var(--mute);font-size:var(--fs-sm, 13px)">히든미션 설정이 아직 없어요. ranking-sync-setup.sql / admin-extra-setup.sql을 실행했는지 확인해 주세요.</p>`;
    return;
  }
  // 앱이 아는 히든미션은 설정 줄이 아직 없어도 보여 준다 (꺼짐으로 표시)
  Object.keys(HIDDEN_MISSION_LABELS).forEach((id) => { if (!data.some((h) => h.id === id)) data.push({ id, enabled: false, missing: true }); });
  const sqlFor = (id) => `insert into hidden_mission_settings (id, enabled) values ('${id}', false) on conflict (id) do nothing;`;
  list.innerHTML = data.map((h) => `
    <div class="hidden-row" style="flex-wrap:wrap;gap:6px">
      <span style="flex:1;min-width:0">${esc(HIDDEN_MISSION_LABELS[h.id] || h.id)}
        ${HIDDEN_MISSION_NOTES[h.id] ? `<br><small style="color:var(--mute)">${esc(HIDDEN_MISSION_NOTES[h.id])}</small>` : ""}</span>
      <label class="switch">
        <input type="checkbox" data-hidden-toggle="${h.id}" ${h.enabled ? "checked" : ""}>
        <span class="slider"></span>
      </label>
      ${h.missing ? `<div data-missing="${h.id}" style="display:none;width:100%;font-size:var(--fs-sm, 13px);color:var(--mute);line-height:1.6">
        켜지지 않으면 설정 줄이 아직 없는 거예요. Supabase 관리자가 SQL Editor에서 아래 한 줄을 한 번 실행하면 이 스위치가 동작해요.
        <code style="display:block;white-space:pre-wrap;background:var(--line);padding:6px 8px;border-radius:8px;margin-top:4px;user-select:all">${esc(sqlFor(h.id))}</code></div>` : ""}
    </div>`).join("");
  list.querySelectorAll("[data-hidden-toggle]").forEach((cb) => {
    cb.onchange = async () => {
      const id = cb.dataset.hiddenToggle;
      const { error } = await client.rpc("admin_set_hidden_mission", {
        p_password: password, p_id: id, p_enabled: cb.checked,
      });
      if (error) { alert("변경 실패: " + error.message); cb.checked = !cb.checked; return; }
      // 실제로 저장됐는지 다시 읽어 확인 (설정 줄이 없으면 저장이 안 될 수 있음)
      const { data: row } = await client.from("hidden_mission_settings").select("enabled").eq("id", id).maybeSingle();
      if (!row || !!row.enabled !== cb.checked) {
        cb.checked = !!row?.enabled;
        const box = list.querySelector(`[data-missing="${id}"]`);
        if (box) box.style.display = "block";
        else alert("저장이 확인되지 않았어요. 잠시 뒤 새로고침해 보세요.");
      }
    };
  });
}

/* ---------- 🎬 데모(시연) 모드 on/off (장주연) ---------- */
// 앱(js/demo.js)이 hidden_mission_settings 표의 id "demo" 줄을 읽는다. 줄이 없으면 앱은 "켜짐"으로 본다.
const DEMO_ID = "demo";
const DEMO_SQL = "insert into hidden_mission_settings (id, enabled) values ('demo', true) on conflict (id) do nothing;";
async function loadDemoSetting() {
  const box = $("demo-setting");
  if (!box) return;
  const { data, error } = await client.from("hidden_mission_settings").select("*").eq("id", DEMO_ID).maybeSingle();
  // 이 기기 설정 (서버 설정 없이 바로, 이 폰·PC에서만) — demo.html과 같은 저장 칸을 쓴다
  const dev = (() => { try { return localStorage.getItem("knu-demo"); } catch { return null; } })();
  const deviceRow = `
    <div class="hidden-row">
      <span><b>이 기기만</b> · ${dev === "0" ? "꺼짐 (실제 사용자 화면)" : dev === "1" ? "켜짐" : "모든 사용자 설정을 따름"}</span>
      <span style="display:flex;gap:6px">
        <button type="button" data-dev="0" style="padding:6px 10px">끄기</button>
        <button type="button" data-dev="1" style="padding:6px 10px">켜기</button>
        <button type="button" data-dev="" style="padding:6px 10px">기본</button>
      </span>
    </div>`;
  const bindDevice = () => box.querySelectorAll("[data-dev]").forEach((b) => (b.onclick = () => {
    try { b.dataset.dev ? localStorage.setItem("knu-demo", b.dataset.dev) : localStorage.removeItem("knu-demo"); } catch {}
    loadDemoSetting();
  }));
  if (error || !data) {
    box.innerHTML = deviceRow + `<p style="color:var(--mute);font-size:var(--fs-sm, 13px);line-height:1.6;margin-top:8px">
      모든 사용자에게 한 번에 적용하는 스위치는 Supabase 설정 줄이 있어야 생겨요 (지금 서버 기본값은 <b>켜짐</b>).
      Supabase 관리자가 SQL Editor에서 아래 한 줄을 한 번 실행하면 돼요.</p>
      <code style="display:block;white-space:pre-wrap;font-size:var(--fs-sm, 13px);background:var(--line);padding:8px 10px;border-radius:8px;user-select:all">${esc(DEMO_SQL)}</code>`;
    bindDevice();
    return;
  }
  box.innerHTML = deviceRow + `
    <div class="hidden-row">
      <span><b>모든 사용자</b> · ${data.enabled ? "켜짐 (시연용 버튼이 보여요)" : "꺼짐 (실제 사용자 화면)"}</span>
      <label class="switch">
        <input type="checkbox" id="demo-toggle" ${data.enabled ? "checked" : ""}>
        <span class="slider"></span>
      </label>
    </div>`;
  bindDevice();
  $("demo-toggle").onchange = async (e) => {
    const on = e.target.checked;
    const { error: err } = await client.rpc("admin_set_hidden_mission", { p_password: password, p_id: DEMO_ID, p_enabled: on });
    if (err) { alert("변경 실패: " + err.message); e.target.checked = !on; return; }
    loadDemoSetting();
  };
}

/* ---------- 구역/미션 진행 현황 ---------- */
async function loadProgress() {
  const el = $("progress-list");
  let zones = [];
  try { zones = (await (await fetch("data/zones.json")).json()).zones || []; } catch { /* ignore */ }
  const { data, error } = await client.from("mission_completions").select("user_id, mission_id");
  if (error || !zones.length) {
    el.innerHTML = `<p style="color:var(--mute);font-size:var(--fs-sm, 13px)">진행 현황을 불러오지 못했어요.</p>`;
    return;
  }
  const byMission = new Map();   // mission_id -> Set(user_id)
  (data || []).forEach((r) => {
    if (!byMission.has(r.mission_id)) byMission.set(r.mission_id, new Set());
    byMission.get(r.mission_id).add(r.user_id);
  });

  el.innerHTML = zones.map((z) => {
    const missionIds = z.missions.map((m) => m.id);
    let cleared = null;   // 그 구역의 모든 미션을 깬 유저들의 교집합
    missionIds.forEach((id) => {
      const s = byMission.get(id) || new Set();
      cleared = cleared === null ? new Set(s) : new Set([...cleared].filter((u) => s.has(u)));
    });
    const missionRows = z.missions.map((m) => `
      <div class="zp-mission"><span>${esc(m.title)}</span><span>${(byMission.get(m.id) || new Set()).size}명 완료</span></div>`
    ).join("");
    return `
      <div class="zone-progress">
        <div class="zp-head"><span>${esc(z.emoji)} ${esc(z.name)}</span><span style="color:var(--primary)">${(cleared ? cleared.size : 0)}명 클리어</span></div>
        ${missionRows}
      </div>`;
  }).join("");
}