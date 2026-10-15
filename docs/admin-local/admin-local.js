// 메인 앱과 "같은 브라우저"에서 열어야 같은 localStorage를 공유해서 공지가 보입니다.
// (admin-local 폴더에서 이 파일을 쓰기 때문에, localdb.js를 import하지 않고
//  같은 DB_KEY를 직접 다룹니다 — 경로 문제 없이 독립적으로 동작하게 하기 위함입니다.)

const DB_KEY = "knu-quest-local-db";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function readDB() {
  try {
    const raw = JSON.parse(localStorage.getItem(DB_KEY));
    if (raw) return raw;
  } catch {}
  return { profiles: {}, friend_requests: [], notifications: [], announcements: [] };
}
function writeDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

function render() {
  const db = readDB();
  const list = [...db.announcements].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  $("list").innerHTML = list.length
    ? list.map((a) => `
      <div class="card ann-item">
        <div><b>${esc(a.title)}</b><p>${esc(a.body)}</p></div>
        <button class="del" data-id="${a.id}">삭제</button>
      </div>`).join("")
    : `<p style="color:var(--mute);font-size:14px;margin-top:16px">등록된 공지가 없어요.</p>`;

  $("list").querySelectorAll(".del").forEach((b) => {
    b.onclick = () => {
      const db2 = readDB();
      db2.announcements = db2.announcements.filter((a) => a.id !== b.dataset.id);
      writeDB(db2);
      render();
    };
  });
}

$("post-btn").onclick = () => {
  const title = $("title").value.trim();
  const body = $("body").value.trim();
  if (!title || !body) return;
  const db = readDB();
  db.announcements.push({ id: crypto.randomUUID(), title, body, created_at: new Date().toISOString() });
  writeDB(db);
  $("title").value = ""; $("body").value = "";
  render();
};

render();
