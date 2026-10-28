// js/ar-stickers.js — 사진 꾸미기 아이템 (담당: 장주연)
// 프레임·위치 스탬프·글자 스티커는 코드(SVG)로 직접 그린다 → 화질이 안 깨지고, 장소·날짜가 자동으로 들어간다.
// 색은 호반우 이미지에서 뽑은 색을 쓴다.
export const KNU = {
  red: "#B21B1D",     // 호반우 점퍼 빨강
  beige: "#C8B595",   // 털 베이지
  cream: "#F6EBD9",   // 크림
  ochre: "#DFB580",   // 황토
  brown: "#96856C",   // 진한 갈색
  ink: "#1D1A17",     // 외곽선
};
const FONT = `'Pretendard','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif`;
const STK = "img/stickers/";

const svgUrl = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function today() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

/* ---------------- 위치 스탬프: 📍 경북대 ○○ · 날짜 ---------------- */
function stampSVG(place) {
  const title = place ? `경북대 ${place}` : "경북대학교";
  const w = Math.max(360, 150 + title.length * 34);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="120" viewBox="0 0 ${w} 120">
    <rect x="5" y="5" width="${w - 10}" height="110" rx="55" fill="${KNU.cream}" stroke="${KNU.ink}" stroke-width="7"/>
    <g transform="translate(62 60)">
      <circle r="38" fill="${KNU.red}" stroke="${KNU.ink}" stroke-width="5"/>
      <path d="M0 22 C-14 4 -16 -4 -16 -9 A16 16 0 0 1 16 -9 C16 -4 14 4 0 22 Z" fill="#fff" stroke="${KNU.ink}" stroke-width="4"/>
      <circle cy="-9" r="6" fill="${KNU.red}"/>
    </g>
    <text x="118" y="58" font-family="${FONT}" font-size="36" font-weight="900" fill="${KNU.ink}">${esc(title)}</text>
    <text x="120" y="92" font-family="${FONT}" font-size="22" font-weight="700" fill="${KNU.brown}">${today()}</text>
  </svg>`;
}

/* ---------------- 글자 스티커 3종 ---------------- */
function freshmanSVG() {   // "2027 새내기" 빨간 라벨
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="150" viewBox="0 0 420 150">
    <rect x="14" y="20" width="392" height="116" rx="30" fill="${KNU.ink}"/>
    <rect x="6" y="8" width="392" height="116" rx="30" fill="${KNU.red}" stroke="${KNU.ink}" stroke-width="7"/>
    <text x="202" y="62" text-anchor="middle" font-family="${FONT}" font-size="28" font-weight="900" fill="${KNU.ochre}" letter-spacing="6">2027</text>
    <text x="202" y="106" text-anchor="middle" font-family="${FONT}" font-size="50" font-weight="900" fill="#fff">새내기</text>
    <circle cx="44" cy="66" r="9" fill="${KNU.cream}"/><circle cx="360" cy="66" r="9" fill="${KNU.cream}"/>
  </svg>`;
}
function loveKnuSVG() {    // "I ♥ KNU" 둥근 배지
  return `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260">
    <circle cx="136" cy="136" r="118" fill="${KNU.ink}"/>
    <circle cx="128" cy="128" r="118" fill="${KNU.cream}" stroke="${KNU.ink}" stroke-width="8"/>
    <circle cx="128" cy="128" r="96" fill="none" stroke="${KNU.beige}" stroke-width="5" stroke-dasharray="10 9"/>
    <text x="98" y="138" text-anchor="middle" font-family="${FONT}" font-size="58" font-weight="900" fill="${KNU.ink}">I</text>
    <path d="M128 150 C96 128 86 112 86 98 A20 20 0 0 1 128 90 A20 20 0 0 1 170 98 C170 112 160 128 128 150 Z"
      transform="translate(152 116) scale(0.72) translate(-128 -116)" fill="${KNU.red}" stroke="${KNU.ink}" stroke-width="6"/>
    <text x="128" y="200" text-anchor="middle" font-family="${FONT}" font-size="50" font-weight="900" fill="${KNU.red}" letter-spacing="2">KNU</text>
  </svg>`;
}
function arrivedSVG() {    // "경대 왔다!" 말풍선
  return `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="200" viewBox="0 0 380 200">
    <path d="M40 14 H340 A28 28 0 0 1 368 42 V122 A28 28 0 0 1 340 150 H150 L104 192 L110 150 H40 A28 28 0 0 1 12 122 V42 A28 28 0 0 1 40 14 Z"
      fill="#fff" stroke="${KNU.ink}" stroke-width="8" stroke-linejoin="round"/>
    <text x="190" y="102" text-anchor="middle" font-family="${FONT}" font-size="54" font-weight="900" fill="${KNU.red}">경대 왔다!</text>
    <path d="M330 34 l6 14 l14 6 l-14 6 l-6 14 l-6 -14 l-14 -6 l14 -6 Z" fill="${KNU.ochre}" stroke="${KNU.ink}" stroke-width="3"/>
  </svg>`;
}

/* ---------------- 프레임 2종 (사진 크기에 맞춰 그때그때 그림) ---------------- */
export function frameSVG(id, W, H, place) {
  W = Math.round(W); H = Math.round(H);
  const m = Math.min(W, H);
  if (id === "polaroid") {
    const side = Math.round(m * 0.045), bottom = Math.round(Math.max(m * 0.17, 56));
    const fs = Math.round(bottom * 0.32), fs2 = Math.round(bottom * 0.2);
    return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <path fill-rule="evenodd" fill="${KNU.cream}" d="M0 0H${W}V${H}H0Z M${side} ${side}V${H - bottom}H${W - side}V${side}Z"/>
      <rect x="${side}" y="${side}" width="${W - side * 2}" height="${H - bottom - side}" fill="none" stroke="${KNU.beige}" stroke-width="3"/>
      <text x="${side + 4}" y="${H - bottom * 0.42}" font-family="${FONT}" font-size="${fs}" font-weight="900" fill="${KNU.red}">KNU 온캠퍼스</text>
      <text x="${side + 4}" y="${H - bottom * 0.14}" font-family="${FONT}" font-size="${fs2}" font-weight="700" fill="${KNU.brown}">${esc(place ? "경북대 " + place : "경북대학교")}</text>
      <text x="${W - side - 4}" y="${H - bottom * 0.14}" text-anchor="end" font-family="${FONT}" font-size="${fs2}" font-weight="700" fill="${KNU.brown}">${today()}</text>
      <g transform="translate(${W - side - bottom * 0.42} ${H - bottom * 0.62})">
        <circle r="${bottom * 0.2}" fill="${KNU.red}"/>
        <path d="M0 ${bottom * 0.1} C${-bottom * 0.12} 0 ${-bottom * 0.12} ${-bottom * 0.1} 0 ${-bottom * 0.06} C${bottom * 0.12} ${-bottom * 0.1} ${bottom * 0.12} 0 0 ${bottom * 0.1} Z" fill="#fff"/>
      </g>
    </svg>`);
  }
  if (id === "film") {
    const band = Math.round(Math.max(m * 0.1, 34));
    const hole = Math.round(band * 0.34), gap = Math.round(hole * 1.9);
    let holes = "";
    for (let x = gap / 2; x < W; x += gap) {
      holes += `<rect x="${x}" y="${band * 0.33}" width="${hole}" height="${hole * 0.8}" rx="${hole * 0.2}" fill="${KNU.cream}"/>`;
    }
    const fs = Math.round(band * 0.36);
    return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <rect width="${W}" height="${band}" fill="${KNU.red}"/>${holes}
      <rect y="${H - band}" width="${W}" height="${band}" fill="${KNU.red}"/>
      <text x="${W * 0.07}" y="${H - band * 0.36}" font-family="${FONT}" font-size="${fs}" font-weight="900" fill="${KNU.cream}" letter-spacing="2">KNU CAMPUS QUEST</text>
      <text x="${W * 0.93}" y="${H - band * 0.36}" text-anchor="end" font-family="${FONT}" font-size="${fs}" font-weight="800" fill="${KNU.ochre}">${today()}</text>
      <rect x="1.5" y="${band}" width="${W - 3}" height="${H - band * 2}" fill="none" stroke="${KNU.ink}" stroke-width="3"/>
    </svg>`);
  }
  return "";
}

/* ---------------- 단대별 호반우 (학교 원본, 아래 학과명 글씨만 잘라 냄) ---------------- */
const COLLEGES = [
  ["01", "인문대학"], ["02", "사회과학대학"], ["03", "자연과학대학"], ["04", "경상대학"], ["05", "공과대학"],
  ["06", "IT대학"], ["07", "농업생명과학대학"], ["08", "예술대학"], ["09", "사범대학"], ["10", "의과대학"],
  ["12", "치과대학"], ["13", "수의과대학"], ["14", "생활과학대학"], ["15", "간호대학"], ["16", "약학대학"],
  ["17", "첨단기술융합대학"], ["18", "생태환경대학"], ["19", "과학기술대학"], ["20", "행정학부"], ["21", "자율전공학부"],
];

/* ---------------- 꾸미기 서랍에 보여 줄 목록 ---------------- */
// w: 처음 붙일 때 크기(사진 틀 대비 비율)
export function stickerCatalog(place) {
  return {
    tabs: [
      { id: "frame", name: "프레임" },
      { id: "text", name: "글자·스탬프" },
      { id: "deco", name: "스티커" },
      { id: "college", name: "단대 호반우" },
    ],
    frame: [
      { id: "none", name: "없음" },
      { id: "polaroid", name: "폴라로이드" },
      { id: "film", name: "필름" },
    ],
    text: [
      { id: "stamp", name: "위치 스탬프", src: svgUrl(stampSVG(place)), w: 0.62 },
      { id: "freshman", name: "2027 새내기", src: svgUrl(freshmanSVG()), w: 0.46 },
      { id: "loveknu", name: "I ♥ KNU", src: svgUrl(loveKnuSVG()), w: 0.3 },
      { id: "arrived", name: "경대 왔다!", src: svgUrl(arrivedSVG()), w: 0.44 },
    ],
    deco: [
      { id: "star", name: "별", src: STK + "star.png", w: 0.22 },
      { id: "heart", name: "하트", src: STK + "heart.png", w: 0.22 },
    ],
    college: COLLEGES.map(([n, name]) => ({ id: "college" + n, name, src: STK + `college${n}.png`, w: 0.3 })),
  };
}
