import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supa-config.js";

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

const PW_KEY = "knu-quest-admin-pw";
let password = sessionStorage.getItem(PW_KEY) || "";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function tryEnter(pw) {
  $("pw-err").textContent = "";
  const { data, error } = await client.rpc("admin_profile_count", { p_password: pw });
  if (error) {
    $("pw-err").textContent = "비밀번호가 틀렸어요.";
    sessionStorage.removeItem(PW_KEY);
    return false;
  }
  password = pw;
  sessionStorage.setItem(PW_KEY, pw);
  $("lock-screen").classList.add("hidden");
  $("admin-app").classList.remove("hidden");
  $("stat-users").textContent = data;
  loadAnnouncements();
  loadCommunityPosts();
  loadReports();
  loadFeedback();
  loadThemes();
  loadHiddenMissions();
  loadDemoSetting();
  loadProgress();
  loadRanking();
  return true;
}

$("pw-submit").onclick = () => tryEnter($("pw-input").value.trim());
$("pw-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryEnter($("pw-input").value.trim());
});

// 세션에 저장된 비밀번호가 있으면 자동으로 다시 입장 (새로고침해도 다시 안 물어봄)
if (password) tryEnter(password);

async function loadAnnouncements() {
  const { data, error } = await client
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });
  const list = $("ann-list");
  if (error || !data?.length) {
    list.innerHTML = `<p style="color:var(--mute);font-size:13px">등록된 공지사항이 없어요.</p>`;
    return;
  }
  list.innerHTML = data.map((a) => `
    <div class="ann-item">
      <h3>${a.dept ? `<span style="color:var(--primary)">[${esc(a.dept)}]</span> ` : ""}${esc(a.title)}</h3>
      <p>${esc(a.body)}</p>
      <div class="meta">
        <time>${new Date(a.created_at).toLocaleString("ko-KR")}</time>
        <button data-del="${a.id}">삭제</button>
      </div>
    </div>`).join("");
  list.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = () => deleteAnnouncement(btn.dataset.del);
  });
}

async function deleteAnnouncement(id) {
  if (!confirm("이 공지사항을 삭제할까요?")) return;
  const { error } = await client.rpc("admin_delete_announcement", { p_password: password, p_id: id });
  if (error) { alert("삭제 실패: " + error.message); return; }
  loadAnnouncements();
}

$("ann-submit").onclick = async () => {
  const title = $("ann-title").value.trim();
  const body = $("ann-body").value.trim();
  const dept = $("ann-dept").value;
  $("ann-err").textContent = "";
  if (!title || !body) { $("ann-err").textContent = "제목과 내용을 모두 입력해주세요."; return; }
  const { error } = await client.rpc("admin_add_announcement", { p_password: password, p_title: title, p_body: body, p_dept: dept });
  if (error) { $("ann-err").textContent = "등록 실패: " + error.message; return; }
  $("ann-title").value = "";
  $("ann-body").value = "";
  $("ann-dept").value = "";
  loadAnnouncements();
};

/* ---------- 커뮤니티 게시판 관리 ---------- */
async function loadCommunityPosts() {
  const { data, error } = await client.rpc("admin_list_community_posts", { p_password: password });
  const list = $("post-list");
  if (error || !data?.length) {
    list.innerHTML = `<p style="color:var(--mute);font-size:13px">등록된 게시글이 없어요.</p>`;
    return;
  }
  list.innerHTML = data.map((p) => `
    <div class="post-item">
      ${p.photo_url ? `<img src="${esc(p.photo_url)}" alt="">` : ""}
      <div class="post-body">
        <b>${esc(p.nickname)}${p.zone_id ? ` · ${esc(p.zone_id)}` : ""}</b>
        <p>${esc(p.message)}</p>
        <div class="meta">
          <time>${new Date(p.created_at).toLocaleString("ko-KR")}</time>
          <button data-del-post="${p.id}">삭제</button>
        </div>
      </div>
    </div>`).join("");
  list.querySelectorAll("[data-del-post]").forEach((btn) => {
    btn.onclick = () => deleteCommunityPost(btn.dataset.delPost);
  });
}

async function deleteCommunityPost(id) {
  if (!confirm("이 게시글을 삭제할까요? (사진이 있었다면 저장공간에는 남지만 더 이상 보이지 않아요)")) return;
  const { error } = await client.rpc("admin_delete_community_post", { p_password: password, p_id: id });
  if (error) { alert("삭제 실패: " + error.message); return; }
  loadCommunityPosts();
  loadReports();   // 지운 글에 달려있던 신고도 같이 사라짐 (DB에서 cascade 삭제됨)
}

/* ---------- 💬 의견과 제안 (supabase/account_feedback.sql) ---------- */
async function loadFeedback() {
  const list = $("feedback-list");
  const { data, error } = await client.rpc("admin_list_feedback", { p_password: password });
  if (error) {
    list.innerHTML = `<p style="color:var(--mute);font-size:13px">의견을 불러오지 못했어요. Supabase에서 supabase/account_feedback.sql을 실행했는지 확인해 주세요.</p>`;
    return;
  }
  const onlyNew = document.querySelector('input[name="fb-f"]:checked')?.value !== "all";
  const rows = (data || []).filter((f) => !onlyNew || f.status !== "done");
  const newCount = (data || []).filter((f) => f.status !== "done").length;
  $("fb-new").textContent = newCount || "";
  if (!rows.length) {
    list.innerHTML = `<p style="color:var(--mute);font-size:13px">${onlyNew ? "새 의견이 없어요." : "아직 받은 의견이 없어요."}</p>`;
    return;
  }
  list.innerHTML = rows.map((f) => `
    <div class="fb-item ${f.status === "done" ? "done" : ""}">
      <div class="fb-top">
        <span class="fb-cat">${esc(f.category)}</span>
        <span class="fb-who">${f.nickname ? esc(f.nickname) : "(탈퇴한 사용자)"}</span>
        <time>${new Date(f.created_at).toLocaleString("ko-KR")}</time>
      </div>
      <p>${esc(f.message)}</p>
      ${f.device ? `<div class="fb-dev">${esc(f.device)}</div>` : ""}
      <div class="meta">
        <button data-fb-status="${f.id}" data-next="${f.status === "done" ? "new" : "done"}">${f.status === "done" ? "새 의견으로 되돌리기" : "확인 완료"}</button>
        <button data-fb-del="${f.id}">삭제</button>
      </div>
    </div>`).join("");
  list.querySelectorAll("[data-fb-status]").forEach((btn) => {
    btn.onclick = async () => {
      await client.rpc("admin_set_feedback_status", { p_password: password, p_id: btn.dataset.fbStatus, p_status: btn.dataset.next });
      loadFeedback();
    };
  });
  list.querySelectorAll("[data-fb-del]").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("이 의견을 삭제할까요?")) return;
      await client.rpc("admin_delete_feedback", { p_password: password, p_id: btn.dataset.fbDel });
      loadFeedback();
    };
  });
}
document.querySelectorAll('input[name="fb-f"]').forEach((r) => (r.onchange = loadFeedback));

/* ---------- 🚩 신고 접수함 ---------- */
async function loadReports() {
  const { data, error } = await client.rpc("admin_list_reports", { p_password: password });
  const list = $("report-list");
  if (error || !data?.length) {
    list.innerHTML = `<p style="color:var(--mute);font-size:13px">접수된 신고가 없어요.</p>`;
    return;
  }
  list.innerHTML = data.map((r) => `
    <div class="post-item">
      ${r.photo_url ? `<img src="${esc(r.photo_url)}" alt="">` : ""}
      <div class="post-body">
        <b>${esc(r.nickname)}${r.zone_id ? ` · ${esc(r.zone_id)}` : ""}</b>
        <p>${esc(r.message)}</p>
        ${r.reason ? `<p class="reason">신고 사유: ${esc(r.reason)}</p>` : ""}
        <div class="meta">
          <time>${new Date(r.reported_at).toLocaleString("ko-KR")}</time>
          <span>
            <button data-resolve="${r.report_id}">무시하기</button>
            <button data-del-post="${r.post_id}" data-report-id="${r.report_id}">글 삭제</button>
          </span>
        </div>
      </div>
    </div>`).join("");
  list.querySelectorAll("[data-resolve]").forEach((btn) => {
    btn.onclick = async () => {
      await client.rpc("admin_resolve_report", { p_password: password, p_id: btn.dataset.resolve });
      loadReports();
    };
  });
  list.querySelectorAll("[data-del-post]").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("이 게시글을 삭제할까요?")) return;
      await client.rpc("admin_delete_community_post", { p_password: password, p_id: btn.dataset.delPost });
      loadReports();
      loadCommunityPosts();
    };
  });
}

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
    list.innerHTML = `<p style="color:var(--mute);font-size:13px">테마 설정 표가 아직 없어요. supabase/themes.sql을 SQL Editor에서 실행해 주세요.</p>`;
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
    list.innerHTML = `<p style="color:var(--mute);font-size:13px">히든미션 설정이 아직 없어요. ranking-sync-setup.sql / admin-extra-setup.sql을 실행했는지 확인해 주세요.</p>`;
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
      ${h.missing ? `<div data-missing="${h.id}" style="display:none;width:100%;font-size:12px;color:var(--mute);line-height:1.6">
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
    box.innerHTML = deviceRow + `<p style="color:var(--mute);font-size:12.5px;line-height:1.6;margin-top:8px">
      모든 사용자에게 한 번에 적용하는 스위치는 Supabase 설정 줄이 있어야 생겨요 (지금 서버 기본값은 <b>켜짐</b>).
      Supabase 관리자가 SQL Editor에서 아래 한 줄을 한 번 실행하면 돼요.</p>
      <code style="display:block;white-space:pre-wrap;font-size:12px;background:var(--line);padding:8px 10px;border-radius:8px;user-select:all">${esc(DEMO_SQL)}</code>`;
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
    el.innerHTML = `<p style="color:var(--mute);font-size:13px">진행 현황을 불러오지 못했어요.</p>`;
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

/* ---------- 실시간 랭킹 ---------- */
async function loadRanking() {
  const { data, error } = await client
    .from("profiles").select("nickname, dept, score")
    .order("score", { ascending: false }).limit(50);
  const el = $("rank-list");
  if (error || !data?.length) {
    el.innerHTML = `<p style="color:var(--mute);font-size:13px">아직 랭킹 데이터가 없어요.</p>`;
    return;
  }
  el.innerHTML = data.map((p, i) => `
    <div class="rank-row">
      <span>${i + 1}. ${esc(p.nickname)} <span style="color:var(--mute)">(${esc(p.dept)})</span></span>
      <b>${p.score} XP</b>
    </div>`).join("");
}