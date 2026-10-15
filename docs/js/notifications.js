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

export async function listAnnouncements() {
  const { data, error } = await client
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return data;
}

export function getAnnouncementsSeenAt() {
  return localStorage.getItem(SEEN_KEY) || "1970-01-01T00:00:00.000Z";
}

export function markAnnouncementsSeenNow() {
  localStorage.setItem(SEEN_KEY, new Date().toISOString());
}

export async function unreadAnnouncementCount() {
  const seenAt = getAnnouncementsSeenAt();
  const { count } = await client
    .from("announcements")
    .select("id", { count: "exact", head: true })
    .gt("created_at", seenAt);
  return count || 0;
}