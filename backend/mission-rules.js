// 미션 종류별 판정 규칙.
// 새 사진 미션이 생기면 여기에 한 줄 추가하면 된다 — 코드 수정 없이 규칙만 늘어난다.
//
// labels: Vision API Label Detection이 돌려주는 라벨 중, 이 중 하나라도 minLabelScore 이상
//         신뢰도로 매칭되면 "그림 내용이 미션과 맞다"는 신호로 센다 (대소문자 무시, 부분일치).
// textHints: Vision API Text Detection(OCR)으로 사진에서 읽은 글자 중, 이 단어들이 하나라도
//            포함돼 있으면 보조 신호로 센다 (예: 식권/영수증처럼 글자가 핵심인 사진).
// minLabelScore: 라벨 신뢰도 기준 (0~1). 낮출수록 너그러워지고, 높일수록 엄격해진다.
//
// 판정 로직(verify-photo.js에서 사용):
//   라벨 매칭 OR 텍스트 매칭 있으면       → APPROVED
//   라벨/텍스트가 아예 없거나 너무 적으면  → REVIEW_REQUIRED (애매함, 재업로드 유도)
//   관련 라벨이 전혀 없고 텍스트도 없으면  → REJECTED

export const MISSION_RULES = {
  "m-centralpark-photo": {
    name: "피크닉 사진",
    labels: ["picnic", "grass", "meadow", "lawn", "park", "leisure", "blanket", "outdoor recreation", "tree", "grassland"],
    textHints: [],
    minLabelScore: 0.55,
  },
  "m-ilcheongdam-photo": {
    name: "일청담 야경 사진",
    labels: ["night", "lighting", "reflection", "light", "pond", "water", "evening", "lantern", "landmark", "dusk"],
    textHints: [],
    minLabelScore: 0.5,
  },
  "m-library-photo": {
    name: "대출 인증샷",
    labels: ["book", "text", "document", "screenshot", "mobile phone", "display device", "publication", "reading"],
    textHints: ["대출", "도서", "반납", "library"],
    minLabelScore: 0.5,
  },
  "m-gongstaurant-photo": {
    name: "학식 먹기",
    labels: ["food", "dish", "meal", "tableware", "cuisine", "ingredient", "recipe", "cooking", "receipt", "paper"],
    textHints: ["식권", "학식", "영수증", "원", "메뉴"],
    minLabelScore: 0.5,
  },
  "m-cherryroad-photo": {
    name: "벚꽃길 사진찍기",
    labels: ["flower", "blossom", "cherry blossom", "plant", "petal", "pink", "tree", "spring", "flowering plant"],
    textHints: [],
    minLabelScore: 0.55,
  },
};

// zones.json의 mission.id가 위 키랑 이름이 다를 수 있으므로, 못 찾으면 null을 돌려주고
// verify-photo.js 쪽에서 "규칙이 없는 미션"은 일단 통과시키도록 처리한다 (새 미션 추가 시 안전장치).
export function getRule(missionId) {
  return MISSION_RULES[missionId] || null;
}