// 미션 사진이 실제로 그 미션 내용과 맞는지 확인한다.
// 서버 없이 앱(GitHub Pages)에서 Google Cloud Vision API를 직접 부른다.
// (예전 Vercel 백엔드 방식은 backend/ 폴더에 남아 있지만 지금은 쓰지 않는다.)
//
// ⚠️ 이 키는 앱 코드에 그대로 보이므로, Google Cloud 콘솔에서 반드시 아래처럼 제한해 두세요.
//   1) API 제한: Cloud Vision API만
//   2) 애플리케이션 제한: 웹사이트(HTTP 리퍼러) → https://wkddmstn.github.io/*
//   3) Cloud Vision API 할당량: 하루 요청 수를 작게 (예: 100) → 넘으면 호출이 거절돼 요금이 나가지 않음
// 판정 규칙은 photo-rules.js에 있다.

import { getRule } from "./photo-rules.js";

// ⬇️ Google Cloud > API 및 서비스 > 사용자 인증 정보에서 만든 API 키를 넣으세요
const VISION_API_KEY = "CHANGE_ME_VISION_API_KEY";

const MAX_SIDE = 1280;   // 긴 변을 이 크기로 줄여서 보낸다 (전송이 빨라지고, 인식 정확도에는 거의 영향 없음)

// File 객체 또는 "data:"로 시작하는 dataURL을 받아서, 크기를 줄인 JPEG의 순수 base64로 바꾼다
async function toBase64(photo) {
  const src = typeof photo === "string" ? photo : await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(photo);
  });
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = src;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85).split(",")[1];
  } catch {
    return src.slice(src.indexOf(",") + 1);   // 줄이기에 실패하면 원본 그대로
  }
}

// Google Vision 호출: 라벨(사진 속 물체·장면) + 글자(OCR)
async function annotate(base64) {
  let res = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(VISION_API_KEY)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: base64 },
            features: [
              { type: "LABEL_DETECTION", maxResults: 15 },
              { type: "TEXT_DETECTION", maxResults: 5 },
            ],
          }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch {
      res = null;
    }
    // 일시적인 문제(과부하·요청 몰림)일 때만 다시 시도
    if (res && (res.ok || (res.status !== 503 && res.status !== 429))) break;
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1200));
  }
  if (!res || !res.ok) {
    if (res) console.warn("[사진 인증] Vision API 요청 실패", res.status, await res.text().catch(() => ""));
    return null;
  }
  const result = (await res.json())?.responses?.[0];
  if (!result || result.error) {
    console.warn("[사진 인증] Vision API 응답 오류", result?.error);
    return null;
  }
  return {
    labels: (result.labelAnnotations || []).map((l) => ({ desc: String(l.description || "").toLowerCase(), score: l.score || 0 })),
    text: (result.fullTextAnnotation?.text || "").toLowerCase(),
  };
}

// missionTitle/missionDesc는 예전 호출 방식과 맞추려고 남겨 둔 인자 (판정은 missionId의 규칙으로 한다).
// 반환: { ok: boolean, reason: string, review?: boolean }
//   review:true면 "거절"은 아니지만 판단을 보류한 경우 — 일단 통과시킨다.
// 키가 없거나, 할당량 초과·네트워크 문제로 호출이 실패해도 미션 진행을 막지 않도록 ok:true로 처리한다.
export async function verifyMissionPhoto(missionTitle, missionDesc, photo, missionId) {
  if (VISION_API_KEY.startsWith("CHANGE_ME")) return { ok: true, reason: "" };   // 아직 키를 안 넣음

  try {
    const base64 = await toBase64(photo);
    if (!base64) return { ok: true, reason: "" };

    const rule = getRule(missionId);
    const a = await annotate(base64);
    if (!a) return { ok: true, reason: "", review: true };   // 분석 실패 → 막지 않음
    if (!rule) return { ok: true, reason: "" };               // 규칙 없는 새 미션 → 통과

    const labelMatch = a.labels.some((l) =>
      l.score >= rule.minLabelScore && rule.labels.some((want) => l.desc.includes(want.toLowerCase())));
    const textMatch = rule.textHints.some((hint) => a.text.includes(hint.toLowerCase()));
    if (labelMatch || textMatch) return { ok: true, reason: "" };

    if (a.labels.length === 0 && !a.text) return { ok: true, reason: "", review: true };   // 너무 흐릿함 → 보류

    return { ok: false, reason: `'${rule.name}' 미션이랑 잘 안 맞는 사진 같아요.` };
  } catch (e) {
    console.warn("[사진 인증] 처리 중 오류", e);
    return { ok: true, reason: "" };
  }
}