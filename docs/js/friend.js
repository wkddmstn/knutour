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
  return { ok: true, partnerNickname: partner.nickname, partnerId: partner.id };
}

export async function confirmFriendRequest(requestId) {
  const { error } = await client
    .from("friend_requests")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending");
  return !error;
}

// 요청 한 건 + 상대방 닉네임 (함께 돌기: 수락한 쪽이 누구랑 하는지 알아야 해서)
export async function getFriendRequest(requestId) {
  const { data, error } = await client.from("friend_requests")
    .select("id, mission_id, requester_id, partner_id, status").eq("id", requestId).maybeSingle();
  if (error || !data) return null;
  const me = getCachedProfile();
  const otherId = data.requester_id === me?.id ? data.partner_id : data.requester_id;
  const { data: p } = await client.from("profiles").select("nickname").eq("id", otherId).maybeSingle();
  return { ...data, partnerNickname: p?.nickname || "친구" };
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