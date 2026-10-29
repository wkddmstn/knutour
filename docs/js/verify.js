// 미션 사진이 실제로 그 미션 내용과 맞는지 확인한다.
// Google Cloud Vision API는 브라우저에서 바로 부르지 않고, 백엔드(Vercel)를 거쳐서 호출한다
// → API 키가 사용자 브라우저 코드에 노출되지 않는다.

// ⬇️ Vercel에 backend/를 배포하고 나온 주소로 바꿔주세요 (예: https://knutour-verify.vercel.app/api/verify-photo)
const VERIFY_ENDPOINT = "CHANGE_ME_VERCEL_VERIFY_URL";

// File 객체 또는 "data:"로 시작하는 dataURL 문자열을 { base64, mimeType }으로 바꾼다
function toBase64(photo) {
  if (typeof photo === "string") {
    const idx = photo.indexOf(",");
    const header = idx >= 0 ? photo.slice(0, idx) : "";
    const mimeMatch = header.match(/data:([^;]+);base64/);
    return Promise.resolve({
      base64: idx >= 0 ? photo.slice(idx + 1) : photo,
      mimeType: mimeMatch ? mimeMatch[1] : "image/jpeg",
    });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const idx = result.indexOf(",");
      resolve({ base64: result.slice(idx + 1), mimeType: photo.type || "image/jpeg" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(photo);
  });
}

// missionTitle/missionDesc는 화면 표시용 메시지에만 쓰고, 실제 판정 규칙은 missionId로 백엔드에서 찾는다.
// 반환: { ok: boolean, reason: string, review?: boolean }
//   review:true면 "거절"은 아니지만 AI가 판단을 보류한 경우 — 일단 통과시키되 나중에 관리자가 확인할 수 있다.
// 호출 자체가 실패해도(배포 전, 네트워크 문제 등) 미션 진행을 막지 않도록 ok:true로 처리한다.
export async function verifyMissionPhoto(missionTitle, missionDesc, photo, missionId) {
  if (VERIFY_ENDPOINT.startsWith("CHANGE_ME")) return { ok: true, reason: "" };   // 아직 배포 전

  try {
    const { base64, mimeType } = await toBase64(photo);
    if (!base64) return { ok: true, reason: "" };

    const url = VERIFY_ENDPOINT;
    let res = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ missionId, imageBase64: base64, mimeType }),
          signal: controller.signal,
        });
        clearTimeout(timer);
      } catch {
        res = null;
      }
      if (res && (res.ok || (res.status !== 503 && res.status !== 429))) break;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1200));
    }

    if (!res || !res.ok) return { ok: true, reason: "" };

    const data = await res.json();
    if (data.status === "REJECTED") return { ok: false, reason: data.reason || "" };
    if (data.status === "REVIEW_REQUIRED") return { ok: true, reason: "", review: true };
    return { ok: true, reason: "" };   // APPROVED
  } catch {
    return { ok: true, reason: "" };
  }
}