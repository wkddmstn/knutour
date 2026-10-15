import { _readDB, _writeDB, getCachedProfile } from "./localdb.js";

export async function listNotifications() {
  const me = getCachedProfile();
  return _readDB().notifications
    .filter((n) => n.user_id === me.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 30);
}

export async function markNotificationRead(id) {
  const db = _readDB();
  const n = db.notifications.find((x) => x.id === id);
  if (n) { n.is_read = true; _writeDB(db); }
}

export async function unreadCount() {
  const me = getCachedProfile();
  return _readDB().notifications.filter((n) => n.user_id === me.id && !n.is_read).length;
}

// ---------- 공지사항 ----------
const SEEN_KEY = "knu-quest-announcements-seen-at";

export async function listAnnouncements() {
  return _readDB().announcements
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20);
}

export function getAnnouncementsSeenAt() {
  return localStorage.getItem(SEEN_KEY) || "1970-01-01T00:00:00.000Z";
}

export function markAnnouncementsSeenNow() {
  localStorage.setItem(SEEN_KEY, new Date().toISOString());
}

export async function unreadAnnouncementCount() {
  const seenAt = getAnnouncementsSeenAt();
  return _readDB().announcements.filter((a) => a.created_at > seenAt).length;
}
