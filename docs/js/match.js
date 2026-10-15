// "친구가 없어요" 선택 시 쓰는 랜덤 매칭 대기열.
// friend.js의 friend_requests 테이블을 그대로 재사용해서, 매칭이 성사되면
// main.js에 이미 연결된 실시간 알림·XP 지급 로직을 그대로 탑니다.
import { _readDB, _writeDB, getCachedProfile, onRemoteChange } from "./localdb.js";

function compatible(a, b) {
  const wantOk = (want, gender) => want === "any" || want === gender;
  return wantOk(a.want, b.gender) && wantOk(b.want, a.gender);
}

// 대기열에 들어간다. 그 순간 바로 짝이 있으면 즉시 매칭되고, 없으면 대기 상태로 남는다.
// 반환: { matched: true, partnerNickname } | { matched: false }
export async function joinQueue(missionId, gender, want) {
  const me = getCachedProfile();
  const db = _readDB();
  db.match_queue = db.match_queue || [];

  // 이미 같은 미션에 대기 중이던 내 이전 요청이 있으면 정리
  db.match_queue = db.match_queue.filter((q) => !(q.mission_id === missionId && q.uid === me.id));

  const candidate = db.match_queue.find((q) => q.mission_id === missionId && compatible({ gender, want }, q));

  if (candidate) {
    // 즉시 매칭 성사 — 대기 중이던 상대를 큐에서 빼고, friend_requests에 confirmed로 바로 기록
    db.match_queue = db.match_queue.filter((q) => q.id !== candidate.id);
    const reqRow = {
      id: crypto.randomUUID(), mission_id: missionId,
      requester_id: candidate.uid, partner_id: me.id,
      status: "confirmed", random: true,
      created_at: new Date().toISOString(), confirmed_at: new Date().toISOString(),
    };
    db.friend_requests.push(reqRow);
    // 양쪽 모두에게 "매칭 성사" 알림 — friend.js의 subscribeFriendRequests가 이미 이 타입을 처리함
    [
      { user_id: candidate.uid, partnerName: me.nickname },
      { user_id: me.id, partnerName: candidate.nickname },
    ].forEach(({ user_id, partnerName }) => {
      db.notifications.push({
        id: crypto.randomUUID(), user_id, type: "friend_confirmed",
        title: `${partnerName}님과 랜덤 매칭됐어요!`,
        payload: { request_id: reqRow.id, mission_id: missionId, partner_id: user_id === me.id ? candidate.uid : me.id },
        is_read: false, created_at: new Date().toISOString(),
      });
    });
    _writeDB(db);
    return { matched: true, partnerNickname: candidate.nickname };
  }

  // 짝이 없으면 대기열에 등록
  db.match_queue.push({
    id: crypto.randomUUID(), mission_id: missionId,
    uid: me.id, nickname: me.nickname, gender, want,
    joined_at: new Date().toISOString(),
  });
  _writeDB(db);
  return { matched: false };
}

export function leaveQueue(missionId) {
  const me = getCachedProfile();
  const db = _readDB();
  db.match_queue = (db.match_queue || []).filter((q) => !(q.mission_id === missionId && q.uid === me.id));
  _writeDB(db);
}

// 대기 중일 때, 다른 사람이 나중에 들어와서 나와 매칭시켜줄 때까지 기다린다 (다른 탭의 행동 감지)
export function waitForMatch(missionId, onMatched) {
  const me = getCachedProfile();
  const seen = new Set(
    _readDB().friend_requests
      .filter((r) => r.mission_id === missionId && r.status === "confirmed")
      .map((r) => r.id)
  );
  const check = () => {
    const db = _readDB();
    const hit = db.friend_requests.find((r) =>
      r.mission_id === missionId && r.status === "confirmed" && !seen.has(r.id) &&
      (r.requester_id === me.id || r.partner_id === me.id));
    if (hit) {
      seen.add(hit.id);
      const db2 = _readDB();
      const partnerId = hit.requester_id === me.id ? hit.partner_id : hit.requester_id;
      const partner = db2.profiles[partnerId];
      onMatched(partner?.nickname || "상대방");
    }
  };
  return onRemoteChange(check);
}
