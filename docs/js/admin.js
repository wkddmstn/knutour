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
      <h3>${esc(a.title)}</h3>
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
  $("ann-err").textContent = "";
  if (!title || !body) { $("ann-err").textContent = "제목과 내용을 모두 입력해주세요."; return; }
  const { error } = await client.rpc("admin_add_announcement", { p_password: password, p_title: title, p_body: body });
  if (error) { $("ann-err").textContent = "등록 실패: " + error.message; return; }
  $("ann-title").value = "";
  $("ann-body").value = "";
  loadAnnouncements();
};