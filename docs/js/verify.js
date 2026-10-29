// 미션 사진이 실제로 그 미션 내용과 맞는지 확인한다.
// 서버 없이 앱(GitHub Pages)에서 Google Cloud Vision API를 직접 부른다.
// (예전 Vercel 백엔드 방식은 backend/ 폴더에 남아 있지만 지금은 쓰지 않는다.)
//
// ⚠️ 이 키는 앱 코드에 그대로 보이므로, Google Cloud 콘솔에서 반드시 아래처럼 제한해 두세요.
//   1) API 제한: Cloud Vision API만
//   2) 애플리케이션 제한: 웹사이트(HTTP 리퍼러) → https://wkddmstn.github.io/*
//   3) Cloud Vision API 할당량: Requests per minute(per user 없는 것)를 작게 (예: 10)
// 월 사용 횟수 제한: Google을 부르기 전에 Supabase의 use_vision()에 "이번 달 한 번 더 써도 되는지" 묻는다.
//   한도(기본 900장, supabase/vision_usage.sql)에 닿으면 Google을 부르지 않고 사진을 그냥 통과시킨다 → 무료 범위 유지.
// 판정 규칙은 photo-rules.js에 있다.

import { getRule } from "./photo-rules.js";
import { client } from "./supa.js";

// ⬇️ Google Cloud > API 및 서비스 > 사용자 인증 정보에서 만든 API 키를 넣으세요
const VISION_API_KEY = "AIzaSyAb8Q4rv31_aiVWVWQ2tCd8eNKYNbflhVo";

const MAX_SIDE = 800;    // 긴 변을 이 크기로 줄여서 보낸다 (물체·장면 인식엔 충분하고, 전송·분석이 훨씬 빨라짐)
const TIMEOUT_MS = 8000; // 이보다 오래 걸리면 기다리지 않고 통과 처리

// File 객체 또는 "data:"로 시작하는 dataURL을 받아서, 크기를 줄인 JPEG의 순수 base64로 바꾼다.
// 휴대폰 원본(수 MB)을 문자열로 통째로 읽지 않고 바로 줄여서 그리기 때문에 빠르다.
async function toBase64(photo) {
  const url = typeof photo === "string" ? photo : URL.createObjectURL(photo);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.decoding = "async";
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8).split(",")[1];
  } catch {
    return typeof photo === "string" ? photo.slice(photo.indexOf(",") + 1) : null;   // 줄이기에 실패하면 원본(dataURL)이라도
  } finally {
    if (typeof photo !== "string") URL.revokeObjectURL(url);
  }
}

// 이번 달 사용 한도 안인지 Supabase에 물어보고, 안이면 1회 사용으로 센다.
// 물어보는 것 자체가 실패하면(SQL을 아직 안 넣었거나 네트워크 문제) 돈이 나가지 않게 Google을 부르지 않는다.
async function reserveMonthlyUse() {
  try {
    const { data, error } = await client.rpc("use_vision");
    if (error) {
      console.warn("[사진 인증] 월 사용량 확인 실패 — supabase/vision_usage.sql을 실행했는지 확인해 주세요", error.message);
      return false;
    }
    if (data !== true) console.info("[사진 인증] 이번 달 사진 인증 한도에 도달해서 검사 없이 통과시켜요");
    return data === true;
  } catch (e) {
    console.warn("[사진 인증] 월 사용량 확인 실패", e);
    return false;
  }
}

// Google Vision 호출: 라벨(사진 속 물체·장면) + 필요할 때만 글자(OCR)
// 글자 인식은 식권·대출 화면처럼 글자가 핵심인 미션(규칙에 textHints가 있는 미션)에서만 요청한다 → 더 빠르고 요청 수도 절반
async function annotate(base64, withText) {
  let res = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(VISION_API_KEY)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: base64 },
            features: [
              { type: "LABEL_DETECTION", maxResults: 15 },
              ...(withText ? [{ type: "TEXT_DETECTION", maxResults: 5 }] : []),
            ],
          }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch {
      res = null;
    }
    // 일시적인 문제(과부하·요청 몰림)일 때만 한 번 더 시도 (시간 초과·키 오류·결제 미설정 등은 바로 포기)
    if (!res || res.ok || (res.status !== 503 && res.status !== 429)) break;
    if (attempt < 1) await new Promise((r) => setTimeout(r, 600));
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
    const rule = getRule(missionId);
    if (!rule) return { ok: true, reason: "" };               // 규칙 없는 새 미션 → 부를 필요 없이 통과

    // 사진 줄이기와 월 사용량 확인을 동시에 (기다리는 시간을 늘리지 않게)
    const [base64, allowed] = await Promise.all([toBase64(photo), reserveMonthlyUse()]);
    if (!base64) return { ok: true, reason: "" };
    if (!allowed) return { ok: true, reason: "", review: true };   // 이번 달 한도 도달 → 검사 없이 통과

    const a = await annotate(base64, rule.textHints.length > 0);
    if (!a) return { ok: true, reason: "", review: true };   // 분석 실패 → 막지 않음

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