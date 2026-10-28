// 구역별 방명록: zone마다 짧은 글(+사진 선택)을 남기고, 다른 사람들도 볼 수 있다.
import { client } from "./supa.js";

const BUCKET = "guestbook-photos";

// 그 구역의 방명록 글 목록 (최신순)
export async function listGuestbook(zoneId, limit = 30) {
  const { data, error } = await client
    .from("guestbook")
    .select("*")
    .eq("zone_id", zoneId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data;
}

// 글 남기기. photoFile은 선택 사항 — 넘기면 Storage에 올리고 글에 사진도 같이 붙는다.
// 성공하면 true, 실패하면 false를 돌려준다 (올리는 중 UI에서 버튼을 잠깐 막는 데 사용).
export async function postGuestbookEntry(zoneId, nickname, message, photoFile) {
  let photo_url = null;
  if (photoFile) {
    const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${zoneId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await client.storage.from(BUCKET).upload(path, photoFile);
    if (!upErr) {
      const { data } = client.storage.from(BUCKET).getPublicUrl(path);
      photo_url = data?.publicUrl || null;
    }
  }
  const { error } = await client.from("guestbook").insert({
    zone_id: zoneId,
    nickname: nickname || "익명",
    message,
    photo_url,
  });
  return !error;
}