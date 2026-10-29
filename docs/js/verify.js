// 미션 사진이 실제로 그 미션 내용과 맞는지 AI(Gemini, Supabase SQL 함수 경유)로 확인한다.
import { client } from "./supa.js";

// File 객체 또는 "data:"로 시작하는 dataURL 문자열을 순수 base64 문자열로 바꾼다 (헤더 제외)
function toBase64(photo) {
  if (typeof photo === "string") {
    const idx = photo.indexOf(",");
    return Promise.resolve(idx >= 0 ? photo.slice(idx + 1) : photo);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(photo);
  });
}

// missionTitle/missionDesc: 미션 설명, photo: File 객체 또는 dataURL 문자열
// 반환: { ok: boolean, reason: string }
// AI 호출 자체가 실패해도(키 미설정, 네트워크 문제 등) 미션 진행을 막지 않도록 ok:true로 처리한다.
export async function verifyMissionPhoto(missionTitle, missionDesc, photo) {
  try {
    const base64 = await toBase64(photo);
    if (!base64) return { ok: true, reason: "" };
    const { data, error } = await client.rpc("verify_mission_photo", {
      p_mission_title: missionTitle || "",
      p_mission_desc: missionDesc || "",
      p_image_base64: base64,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return { ok: true, reason: "" };
    return { ok: row.ok !== false, reason: row.reason || "" };
  } catch {
    return { ok: true, reason: "" };
  }
}