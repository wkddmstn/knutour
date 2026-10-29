// 사진 미션 인증 백엔드. 브라우저가 아니라 여기(Vercel 서버)에서 Google Cloud Vision API를 불러서,
// API 키가 사용자 브라우저 코드에 노출되지 않게 한다.
//
// 요청: POST { missionId, imageBase64(순수 base64, data: 헤더 제외), mimeType }
// 응답: { status: "APPROVED" | "REJECTED" | "REVIEW_REQUIRED", reason, labels }

import { getRule } from "../mission-rules.js";

const VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;   // 원본 3MB까지만 (base64로는 약 4MB → Vercel 요청 용량 제한 안쪽)
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

function cors(res) {
  // 해커톤 데모용이라 모든 출처를 허용한다. 나중에 정식 운영한다면
  // res.setHeader("Access-Control-Allow-Origin", "https://wkddmstn.github.io") 처럼 제한하면 된다.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST만 지원해요" }); return; }

  try {
    const { missionId, imageBase64, mimeType } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ status: "REJECTED", reason: "사진 데이터가 없어요." });
    }
    if (mimeType && !ALLOWED_MIME.includes(mimeType)) {
      return res.status(400).json({ status: "REJECTED", reason: "지원하지 않는 이미지 형식이에요 (jpg/png/webp만 가능)." });
    }
    // base64는 원본보다 약 4/3배 크므로, 역산해서 대략의 원본 바이트 수를 추정해 너무 큰 이미지를 거른다
    const approxBytes = Math.ceil((imageBase64.length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) {
      return res.status(400).json({ status: "REJECTED", reason: "이미지 용량이 너무 커요 (3MB 이하로 올려주세요)." });
    }
    if (!VISION_API_KEY) {
      // 키 설정 전이면 서비스 전체가 막히지 않도록 "판정 보류"로 응답한다 (관리자 검토 유도)
      return res.status(200).json({ status: "REVIEW_REQUIRED", reason: "서버에 Vision API 키가 아직 설정되지 않았어요." });
    }

    const rule = getRule(missionId);

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBase64 },
              features: [
                { type: "LABEL_DETECTION", maxResults: 15 },
                { type: "TEXT_DETECTION", maxResults: 5 },
              ],
            },
          ],
        }),
      }
    );

    if (!visionRes.ok) {
      const errText = await visionRes.text();
      console.error("Vision API 요청 실패:", visionRes.status, errText);
      return res.status(200).json({ status: "REVIEW_REQUIRED", reason: "사진 분석 서버에 일시적인 문제가 있어요." });
    }

    const data = await visionRes.json();
    const result = data?.responses?.[0];
    if (result?.error) {
      console.error("Vision API 응답 오류:", result.error);
      return res.status(200).json({ status: "REVIEW_REQUIRED", reason: "사진을 분석하지 못했어요." });
    }

    const labels = (result?.labelAnnotations || []).map((l) => ({
      desc: String(l.description || "").toLowerCase(),
      score: l.score || 0,
    }));
    const text = (result?.fullTextAnnotation?.text || "").toLowerCase();

    if (!rule) {
      // 아직 규칙을 안 넣은 새 미션이면, 새 미션 추가가 막히지 않도록 일단 통과시킨다
      return res.status(200).json({ status: "APPROVED", reason: "", labels: labels.map((l) => l.desc) });
    }

    const labelMatch = labels.some(
      (l) => l.score >= rule.minLabelScore && rule.labels.some((want) => l.desc.includes(want.toLowerCase()))
    );
    const textMatch = rule.textHints.some((hint) => text.includes(hint.toLowerCase()));

    if (labelMatch || textMatch) {
      return res.status(200).json({ status: "APPROVED", reason: "", labels: labels.map((l) => l.desc) });
    }

    if (labels.length === 0 && !text) {
      return res.status(200).json({
        status: "REVIEW_REQUIRED",
        reason: "사진을 명확하게 분석하기 어려웠어요. 더 선명한 사진으로 다시 찍어주세요.",
        labels: [],
      });
    }

    return res.status(200).json({
      status: "REJECTED",
      reason: `'${rule.name}' 미션이랑 잘 안 맞는 사진 같아요.`,
      labels: labels.map((l) => l.desc),
    });
  } catch (err) {
    console.error("verify-photo 처리 중 오류:", err);
    // 서버 쪽 예외 때문에 사용자가 미션을 영영 못 깨는 일이 없도록, 막지 않고 보류 상태로 응답한다
    return res.status(200).json({ status: "REVIEW_REQUIRED", reason: "서버에서 오류가 발생했어요." });
  }
}