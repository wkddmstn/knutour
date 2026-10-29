// js/icons.js — 동글동글 젤리 아이콘
// 이모지는 폰·PC마다 모양이 달라서(윈도우 3D, 아이폰 광택) 앱 그림체와 안 맞는다.
// 아이콘 자리(장소 목록, 지도 핀, 맛집 종류, 앨범, 퀴즈 결과)에는 이 SVG를 쓴다.
// 대화·알림 문장 속 이모지는 글자라서 그대로 둔다.
//
// 쓰는 법: icon("library")  → 연한 동그라미 배경이 있는 아이콘
//          icon("library", { bg: false }) → 배경 없이 모양만 (지도 핀 안)
//          zoneIcon(zone) → 장소 id로 고르고, 없는 장소면 원래 이모지

const P = {   // 젤리 색
  red: "#ff5a5f", pink: "#ff8a93", pinkL: "#ffd1d9", pinkBg: "#fff0f1",
  mint: "#8fd9b0", mintL: "#c9f0d9", mintBg: "#ecf9f1",
  sky: "#9cc2ff", skyL: "#c7dcff", skyBg: "#eef4ff",
  sun: "#ffc85c", sunL: "#ffe3a3", sunBg: "#fff6e3",
  wood: "#e8b9a0", white: "#fff",
};

// 각 아이콘: [배경색, 모양 SVG] (48×48 기준)
const SHAPES = {
  // 공식당: 밥그릇
  gongstaurant: [P.pinkBg, `<path d="M9 25H39Q38 38 24 38Q10 38 9 25Z" fill="${P.pink}"/><path d="M12 25Q13 13 24 13Q35 13 36 25Z" fill="${P.white}"/><ellipse cx="19" cy="19" rx="3" ry="2" fill="${P.pinkL}"/><rect x="13" y="27" width="22" height="3" rx="1.5" fill="${P.red}" opacity=".45"/>`],
  // 대운동장: 트랙 + 깃발
  stadium: [P.mintBg, `<ellipse cx="24" cy="29" rx="17" ry="10" fill="${P.mint}"/><ellipse cx="24" cy="29" rx="10" ry="5" fill="${P.mintL}"/><path d="M24 22V9" stroke="${P.pink}" stroke-width="3" stroke-linecap="round"/><path d="M24 9Q34 11 24 16Z" fill="${P.red}"/>`],
  // 중앙도서관: 책
  library: [P.skyBg, `<rect x="11" y="13" width="26" height="24" rx="6" fill="${P.sky}"/><rect x="15" y="13" width="22" height="20" rx="5" fill="${P.skyL}"/><rect x="19" y="18" width="12" height="3" rx="1.5" fill="${P.white}"/><path d="M31 13V24L34 21L37 24V13Z" fill="${P.red}"/>`],
  // 센트럴 파크: 피크닉 바구니
  centralpark: [P.sunBg, `<path d="M15 21Q15 11 24 11Q33 11 33 21" fill="none" stroke="${P.wood}" stroke-width="3.5" stroke-linecap="round"/><path d="M9 21H39L36 36Q35 38 33 38H15Q13 38 12 36Z" fill="${P.sunL}"/><path d="M9 21H39L38.2 25H9.8Z" fill="${P.pink}"/><path d="M17 28V34M24 28V34M31 28V34" stroke="${P.sun}" stroke-width="2.5" stroke-linecap="round"/>`],
  // 일청담: 연못과 분수
  ilcheongdam: [P.skyBg, `<ellipse cx="24" cy="33" rx="16" ry="6" fill="${P.sky}"/><ellipse cx="24" cy="32" rx="11" ry="3.5" fill="${P.skyL}"/><path d="M24 31Q20 22 24 12Q28 22 24 31Z" fill="${P.skyL}"/><circle cx="17" cy="20" r="2.5" fill="${P.sky}"/><circle cx="31" cy="18" r="2" fill="${P.sky}"/><circle cx="24" cy="10" r="2" fill="${P.white}"/>`],
  // 사랑의 길: 하트
  loveroad: [P.pinkBg, `<path d="M24 37Q10 28 10 19Q10 12 17 12Q21 12 24 16Q27 12 31 12Q38 12 38 19Q38 28 24 37Z" fill="${P.red}"/><ellipse cx="17" cy="18" rx="3.5" ry="2.5" fill="${P.white}" opacity=".55"/>`],
  // 벚꽃길: 벚꽃
  cherryroad: [P.pinkBg, `${[0, 72, 144, 216, 288].map((r) => `<ellipse cx="24" cy="14.5" rx="6" ry="8" fill="${P.pinkL}" transform="rotate(${r} 24 24)"/>`).join("")}<circle cx="24" cy="24" r="5" fill="${P.pink}"/><circle cx="24" cy="24" r="2" fill="${P.sun}"/>`],
  // 복지관: 동글한 건물
  bokji: [P.mintBg, `<rect x="11" y="14" width="26" height="24" rx="7" fill="${P.white}"/><rect x="11" y="14" width="26" height="8" rx="4" fill="${P.mint}"/><rect x="15" y="25" width="6" height="6" rx="3" fill="${P.skyL}"/><rect x="27" y="25" width="6" height="6" rx="3" fill="${P.skyL}"/><rect x="21" y="30" width="6" height="8" rx="3" fill="${P.pink}"/>`],
  // 맛집 종류
  meal: [P.pinkBg, `<path d="M9 25H39Q38 38 24 38Q10 38 9 25Z" fill="${P.pink}"/><path d="M12 25Q13 13 24 13Q35 13 36 25Z" fill="${P.white}"/><path d="M30 8L22 22M36 10L26 23" stroke="${P.wood}" stroke-width="2.5" stroke-linecap="round"/>`],
  cafe: [P.sunBg, `<path d="M11 18H33V30Q33 38 22 38Q11 38 11 30Z" fill="${P.wood}"/><path d="M14 18H30V22H14Z" fill="${P.white}" opacity=".7"/><path d="M33 22Q40 22 40 27Q40 32 33 32" fill="none" stroke="${P.wood}" stroke-width="3.5"/><path d="M18 8Q16 11 18 14M24 8Q22 11 24 14" stroke="${P.sun}" stroke-width="2.5" stroke-linecap="round" fill="none"/>`],
  pub: [P.sunBg, `<rect x="11" y="15" width="22" height="23" rx="5" fill="${P.sun}"/><path d="M11 18Q11 11 17 12Q20 8 25 11Q32 10 33 17Z" fill="${P.white}"/><path d="M33 21Q40 21 40 26Q40 31 33 31" fill="none" stroke="${P.sun}" stroke-width="3.5"/><path d="M17 22V33M24 22V33" stroke="${P.white}" stroke-width="2" stroke-linecap="round" opacity=".6"/>`],
  // 게시판: 말풍선(자유게시판) · 물음표(질문)
  chat: [P.pinkBg, `<path d="M10 14Q10 9 15 9H33Q38 9 38 14V27Q38 32 33 32H22L15 38V32Q10 32 10 27Z" fill="${P.pink}"/><circle cx="18" cy="21" r="2.4" fill="${P.white}"/><circle cx="24" cy="21" r="2.4" fill="${P.white}"/><circle cx="30" cy="21" r="2.4" fill="${P.white}"/>`],
  question: [P.skyBg, `<circle cx="24" cy="24" r="15" fill="${P.sky}"/><ellipse cx="19" cy="16" rx="4" ry="2.4" fill="${P.white}" opacity=".45"/><path d="M19.5 20Q19.5 15 24 15Q28.5 15 28.5 19.5Q28.5 22.5 25.5 23.8Q24 24.5 24 26.5" fill="none" stroke="${P.white}" stroke-width="3.4" stroke-linecap="round"/><circle cx="24" cy="31.5" r="2.2" fill="${P.white}"/>`],
  // 결과·기타
  check: [P.pinkBg, `<circle cx="24" cy="24" r="15" fill="${P.red}"/><ellipse cx="19" cy="17" rx="4" ry="2.5" fill="${P.white}" opacity=".5"/><path d="M17 24L22 29L31 19" fill="none" stroke="${P.white}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`],
  memo: [P.skyBg, `<rect x="13" y="10" width="22" height="28" rx="6" fill="${P.white}"/><rect x="13" y="10" width="22" height="7" rx="3.5" fill="${P.sky}"/><path d="M18 23H30M18 29H26" stroke="${P.skyL}" stroke-width="3" stroke-linecap="round"/>`],
  pin: [P.pinkBg, `<path d="M24 39Q12 27 12 20Q12 10 24 10Q36 10 36 20Q36 27 24 39Z" fill="${P.red}"/><circle cx="24" cy="20" r="5" fill="${P.white}"/>`],
};

export function hasIcon(name) { return !!SHAPES[name]; }

export function icon(name, { bg = true, size = null, cls = "" } = {}) {
  const s = SHAPES[name] || SHAPES.pin;
  const wh = size ? ` width="${size}" height="${size}"` : "";
  return `<svg class="jelly ${cls}" viewBox="0 0 48 48"${wh} aria-hidden="true">${bg ? `<circle cx="24" cy="24" r="22" fill="${s[0]}"/>` : ""}${s[1]}</svg>`;
}

// 장소 아이콘: 등록된 장소면 젤리 아이콘, 아니면 zones.json의 이모지 글자
export function zoneIcon(z, opts) {
  return z && SHAPES[z.id] ? icon(z.id, opts) : `<span class="jelly-emoji">${String(z?.emoji || "📍").replace(/[<>&"]/g, "")}</span>`;
}