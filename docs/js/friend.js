import { client, getCachedProfile, findProfileByCode } from "./supa.js";

export async function sendFriendRequest(missionId, partnerCode) {
  const me = getCachedProfile();
  const partner = await findProfileByCode(partnerCode);
  if (!partner) return { ok: false, reason: "not_found" };
  if (partner.id === me.id) return { ok: false, reason: "self" };

  const { error } = await client.from("friend_requests").insert({
    mission_id: missionId,
    requester_id: me.id,
    partner_id: partner.id,
  });
  if (error) return { ok: false, reason: "error", error };
  return { ok: true, partnerNickname: partner.nickname };
}

export async function confirmFriendRequest(requestId) {
  const { error } = await client
    .from("friend_requests")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending");
  return !error;
}

export async function hasConfirmedTogether(missionId) {
  const me = getCachedProfile();
  const { data, error } = await client
    .from("friend_requests")
    .select("id")
    .eq("mission_id", missionId)
    .eq("status", "confirmed")
    .or(`requester_id.eq.${me.id},partner_id.eq.${me.id}`)
    .limit(1);
  if (error) return false;
  return data.length > 0;
}

export function subscribeFriendRequests({ onIncoming, onConfirmed }) {
  const me = getCachedProfile();
  const channel = client
    .channel("friend_requests_" + me.id)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "friend_requests", filter: `partner_id=eq.${me.id}` },
      (payload) => onIncoming?.(payload.new))
    .on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "friend_requests", filter: `requester_id=eq.${me.id}` },
      (payload) => { if (payload.new.status === "confirmed") onConfirmed?.(payload.new); })
    .subscribe();
  return () => client.removeChannel(channel);
}