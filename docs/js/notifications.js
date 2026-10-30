import { client, getCachedProfile } from "./supa.js";

export async function listNotifications() {
  const me = getCachedProfile();
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return [];
  return data;
}

export async function markNotificationRead(id) {
  await client.from("notifications").update({ is_read: true }).eq("id", id);
}

export async function unreadCount() {
  const me = getCachedProfile();
  const { count } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", me.id)
    .eq("is_read", false);
  return count || 0;
}

export function subscribeNotifications(onNew) {
  const me = getCachedProfile();
  const channel = client
    .channel("notifications_" + me.id)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` },
      (payload) => onNew(payload.new))
    .subscribe();
  return () => client.removeChannel(channel);
}

const SEEN_KEY = "knu-quest-announcements-seen-at";

// 전체 알림(관리자 페이지 📢): dept를 넘기면 모든 사용자 알림(dept 없음) + 그 단과대 알림만,
// 안 넘기면(예: 가입 전) 모든 사용자 알림만. 예전에 빈 글자("")로 저장된 것도 모든 사용자 알림으로 본다.
const forDept = (q, dept) => (dept ? q.or(`dept.is.null,dept.eq.,dept.eq."${dept}"`) : q.or("dept.is.null,dept.eq."));
export async function listAnnouncements(dept) {
  let q = client.from("announcements").select("*").order("created_at", { ascending: false }).limit(20);
  q = forDept(q, dept);
  const { data, error } = await q;
  if (error) return [];
  return data;
}

export function getAnnouncementsSeenAt() {
  return localStorage.getItem(SEEN_KEY) || "1970-01-01T00:00:00.000Z";
}

export function markAnnouncementsSeenNow() {
  localStorage.setItem(SEEN_KEY, new Date().toISOString());
}

// 안 읽은 전체 알림 수 (내 단과대 것 + 모든 사용자 것만)
export async function unreadAnnouncementCount(dept) {
  const seenAt = getAnnouncementsSeenAt();
  const { count } = await forDept(client
    .from("announcements")
    .select("id", { count: "exact", head: true })
    .gt("created_at", seenAt), dept);
  return count || 0;
}