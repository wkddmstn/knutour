// 사진 미션 판정 규칙 (backend/mission-rules.js를 앱 쪽으로 옮긴 것).
// 새 사진 미션이 생기면 여기에 한 줄 추가하면 된다. 키는 zones.json의 미션 id.
//
// labels: Google Vision의 라벨 인식 결과 중 하나라도 minLabelScore 이상 신뢰도로 매칭되면
//         "사진 내용이 미션과 맞다"고 본다 (대소문자 무시, 부분 일치).
// textHints: 사진에서 읽은 글자(OCR)에 이 단어가 하나라도 있으면 보조 신호로 본다 (식권·영수증처럼 글자가 핵심인 사진).
// minLabelScore: 라벨 신뢰도 기준 (0~1). 낮출수록 너그럽고, 높일수록 엄격하다.
//
// 판정 (verify.js):
//   라벨 매칭 또는 글자 매칭이 있으면      → 통과
//   라벨·글자가 아예 안 나왔으면           → 보류 (일단 통과, 더 선명한 사진 권장)
//   관련 라벨도 글자도 없으면              → 거절

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

// 규칙이 없는 미션이면 null → verify.js에서 일단 통과시킨다 (새 미션 추가가 막히지 않게)
export const getRule = (missionId) => MISSION_RULES[missionId] || null;