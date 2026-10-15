import { _readDB, _writeDB, getCachedProfile, findProfileByCode, onRemoteChange } from "./localdb.js";

// A가 B의 코드를 입력했을 때 호출
export async function sendFriendRequest(missionId, partnerCode) {
  const me = getCachedProfile();
  const partner = findProfileByCode(partnerCode);
  if (!partner) return { ok: false, reason: "not_found" };
  if (partner.id === me.id) return { ok: false, reason: "self" };

  const db = _readDB();
  const req = {
    id: crypto.randomUUID(), mission_id: missionId,
    requester_id: me.id, partner_id: partner.id,
    status: "pending", created_at: new Date().toISOString(),
  };
  db.friend_requests.push(req);
  db.notifications.push({
    id: crypto.randomUUID(), user_id: partner.id, type: "friend_request",
    title: `${me.nickname}님이 함께하기를 신청했어요`,
    payload: { request_id: req.id, mission_id: missionId, requester_id: me.id },
    is_read: false, created_at: new Date().toISOString(),
  });
  _writeDB(db);
  return { ok: true, partnerNickname: partner.nickname };
}

// 알림함에서 "수락하기"를 눌렀을 때 호출
export async function confirmFriendRequest(requestId) {
  const db = _readDB();
  const req = db.friend_requests.find((r) => r.id === requestId && r.status === "pending");
  if (!req) return false;
  req.status = "confirmed";
  req.confirmed_at = new Date().toISOString();

  const me = getCachedProfile();
  db.notifications.push({
    id: crypto.randomUUID(), user_id: req.requester_id, type: "friend_confirmed",
    title: `${me.nickname}님이 함께하기를 수락했어요`,
    payload: { request_id: req.id, mission_id: req.mission_id, partner_id: me.id },
    is_read: false, created_at: new Date().toISOString(),
  });
  _writeDB(db);
  return true;
}

// 이 미션을 누군가와 이미 confirmed로 완료했는지 확인
export async function hasConfirmedTogether(missionId) {
  const me = getCachedProfile();
  const db = _readDB();
  return db.friend_requests.some((r) =>
    r.mission_id === missionId && r.status === "confirmed" &&
    (r.requester_id === me.id || r.partner_id === me.id));
}

// 다른 탭(=다른 사용자)에서 내 요청이 오거나, 내가 보낸 요청이 확정될 때 실시간으로 알려준다
export function subscribeFriendRequests({ onIncoming, onConfirmed }) {
  const me = getCachedProfile();
  const seen = new Set(_readDB().notifications.filter((n) => n.user_id === me.id).map((n) => n.id));

  const check = () => {
    const db = _readDB();
    db.notifications
      .filter((n) => n.user_id === me.id && !seen.has(n.id))
      .forEach((n) => {
        seen.add(n.id);
        if (n.type === "friend_request") onIncoming?.(n.payload);
        if (n.type === "friend_confirmed") onConfirmed?.(n.payload);
      });
  };
  return onRemoteChange(check); // 구독 해제 함수를 그대로 반환
}
