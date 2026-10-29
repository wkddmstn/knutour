import {
  listNotifications, markNotificationRead, unreadCount,
  listAnnouncements, unreadAnnouncementCount, markAnnouncementsSeenNow,
} from "./notifications.js";
import { confirmFriendRequest } from "./friend.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function timeAgo(iso) {
  const sec = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (sec < 60) return "방금";
  if (sec < 3600) return Math.floor(sec / 60) + "분 전";
  if (sec < 86400) return Math.floor(sec / 3600) + "시간 전";
  return Math.floor(sec / 86400) + "일 전";
}

export async function refreshBellBadge() {
  const [a, b] = await Promise.all([unreadCount(), unreadAnnouncementCount()]);
  const total = a + b;
  // 종은 홈 화면에만 있으니, 다른 탭에서도 새 알림을 알 수 있게 하단 "홈" 탭에 빨간 점을 찍는다
  document.querySelector('#tabbar [data-tab="home"]')?.classList.toggle("has-unread", total > 0);
  const badge = $("bell-badge");
  if (!badge) return;
  badge.textContent = total > 9 ? "9+" : String(total);
  badge.classList.toggle("hidden", total === 0);
}

// 패널 바깥(어두운 부분)을 누르거나 Esc를 누르면 닫는다
function onOutside(e) {
  if (!e.target.closest("#notif-panel, #bell-btn")) closeNotifPanel();
}
function onEsc(e) {
  if (e.key === "Escape") closeNotifPanel();
}

export async function openNotifPanel() {
  const panel = $("notif-panel");
  if (!panel) { console.warn("notif-panel missing"); return; }
  panel.classList.remove("hidden");
  panel.innerHTML = `<div class="notif-head">알림</div><div class="notif-empty">불러오는 중...</div>`;
  document.addEventListener("pointerdown", onOutside);
  document.addEventListener("keydown", onEsc);

  const [notifs, anns] = await Promise.all([listNotifications(), listAnnouncements()]);
  const items = [
    ...notifs.map((n) => ({ ...n, _kind: "personal" })),
    ...anns.map((a) => ({ ...a, _kind: "announcement", title: a.title, created_at: a.created_at })),
  ].sort((x, y) => new Date(y.created_at) - new Date(x.created_at));

  markAnnouncementsSeenNow();

  if (!items.length) {
    panel.innerHTML = `<div class="notif-head">알림<button class="notif-close" id="notif-close">✕</button></div>
      <div class="notif-empty">아직 알림이 없어요</div>`;
  } else {
    panel.innerHTML = `
      <div class="notif-head">알림<button class="notif-close" id="notif-close">✕</button></div>
      <div class="notif-list">
        ${items.map(renderItem).join("")}
      </div>`;
  }
  $("notif-close").onclick = closeNotifPanel;

  panel.querySelectorAll(".notif-item").forEach((el) => {
    const id = el.dataset.id;
    if (el.dataset.kind === "personal" && !el.dataset.read) markNotificationRead(id);
  });

  panel.querySelectorAll(".notif-accept").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      btn.disabled = true;
      btn.textContent = "수락하는 중...";
      const ok = await confirmFriendRequest(btn.dataset.requestId);
      btn.textContent = ok ? "수락 완료" : "오류, 다시 시도";
      if (ok) btn.closest(".notif-item").classList.add("notif-handled");
      else btn.disabled = false;
    };
  });

  refreshBellBadge();
}

export function closeNotifPanel() {
  $("notif-panel")?.classList.add("hidden");
  document.removeEventListener("pointerdown", onOutside);
  document.removeEventListener("keydown", onEsc);
}

function renderItem(it) {
  if (it._kind === "announcement") {
    return `<div class="notif-item" data-kind="announcement">
      <div class="notif-icon">📢</div>
      <div class="notif-body">
        <div class="notif-title">${esc(it.title)}</div>
        <div class="notif-sub">${esc(it.body || "")}</div>
        <div class="notif-time">${timeAgo(it.created_at)}</div>
      </div>
    </div>`;
  }
  const isFriendReq = it.type === "friend_request";
  return `<div class="notif-item" data-kind="personal" data-id="${it.id}" ${it.is_read ? "data-read=1" : ""}>
    <div class="notif-icon">${it.type === "friend_confirmed" ? "🤝" : it.type === "achievement" ? "🏅" : "🙋"}</div>
    <div class="notif-body">
      <div class="notif-title">${esc(it.title)}</div>
      <div class="notif-time">${timeAgo(it.created_at)}</div>
      ${isFriendReq ? `<button class="notif-accept" data-request-id="${it.payload.request_id}">수락하기</button>` : ""}
    </div>
  </div>`;
}