// 미션 사진이 실제로 그 미션 내용과 맞는지 AI(Gemini)로 확인한다.
// Supabase SQL 함수를 거치지 않고 브라우저에서 Gemini API를 바로 호출한다.
// (Postgres 함수 경유 방식은 타임아웃/모델명 문제 등으로 디버깅이 어려워서 이 방식으로 바꿨다)

// ⬇️ https://aistudio.google.com 에서 발급받은 Gemini API 키로 바꾸세요
const GEMINI_API_KEY = "AQ.Ab8RN6JAJGUrgoQbJV_0avP0FYmJu43aQJKpQAnweM6JCEt12g";
const GEMINI_MODEL = "gemini-3.8-flash";

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

    const prompt =
      `다음 사진이 이 미션의 내용과 어울리는지 판단해줘. 미션 제목: "${missionTitle || ""}". 미션 설명: "${missionDesc || ""}". ` +
      `사진이 미션 내용과 명백히 관련 없거나(예: 완전히 다른 상황, 새까맣거나 빈 화면, 미션과 무관한 음식/사물, 음란물·혐오물 등 부적절한 내용) 미션 수행처럼 보이지 않으면 거절하고, ` +
      `조금이라도 관련 있어 보이면 너그럽게 통과시켜줘(엄격하게 판단하지 마). ` +
      `반드시 아래 JSON 형식으로만 답해, 다른 말은 하지 마: {"ok": true 또는 false, "reason": "거절이면 짧은 한국어 이유 한 문장, 통과면 빈 문자열"}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: "image/jpeg", data: base64 } },
              ],
            },
          ],
          generationConfig: { response_mime_type: "application/json" },
        }),
      }
    );

    if (!res.ok) return { ok: true, reason: "" };

    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ok: true, reason: "" };

    const parsed = JSON.parse(text);
    return { ok: parsed.ok !== false, reason: parsed.reason || "" };
  } catch {
    return { ok: true, reason: "" };
  }
}