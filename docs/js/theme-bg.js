// js/theme-bg.js — 테마별 화면 배경 (모든 화면 맨 뒤에 깔리는 그림)
//   march   (3월 첫 주, 기본): 활기찬 새 학기 — 가랜드 깃발, 색종이, 풍선, 새싹 언덕
//   cherry  (벚꽃 기간)       : 벚꽃나무 한 그루 + 날리는 꽃잎 (홈 대표 카드 모서리에 꽃잎 하나가 내려앉음)
//   midterm (중간고사)        : 공부 책상 — 줄 공책 바탕 + KNU 빨간 여백선, 포스트잇(D-7·A+), 연필, 알람시계, 책 더미, 종이비행기
// 배경은 카드 사이 빈 공간에서 잘 보이고, 카드 위에서는 카드가 거의 가려서 글이 눈에 잘 들어오게 한다 (style.css).
// 폰(좁은 화면)은 그림을 모서리에 작게, 노트북(넓은 화면)은 앱 양옆 빈 공간에 크게 둔다 (style.css의 @media).

const PETAL = "img/hobanu/petal.png";
const TREE = "img/hobanu/cherry-tree.webp";

// 같은 자리·속도로 흩어 놓아 매번 같은 모양 (left %, 지속 s, 시작 지연 s, 크기 px). wide: 넓은 화면에서만
const SPOTS = [
  [4, 13, 1, 16], [12, 17, 7, 12], [21, 15, 3, 18], [30, 19, 11, 13], [39, 14, 5, 15], [48, 18, 9, 12],
  [57, 16, 2, 17], [66, 20, 13, 13], [75, 15, 6, 16], [84, 18, 10, 12], [92, 14, 4, 15], [98, 19, 8, 13],
];

function fallers(kind) {
  return SPOTS.map(([left, dur, delay, size], i) => {
    const wide = i % 2 ? " wide" : "";   // 폰에선 절반만 (덜 산만하게)
    const style = `left:${left}%;width:${size}px;animation-duration:${dur}s;animation-delay:-${delay}s`;
    if (kind === "petal") return `<img class="tb-fall${wide}" src="${PETAL}" alt="" style="${style}">`;
    const colors = ["#ff8a93", "#ffc85c", "#7fb3ff", "#8fd9b0", "#c4a7ff"];
    return `<i class="tb-fall tb-conf${wide}" style="${style};height:${Math.round(size * 0.55)}px;background:${colors[i % colors.length]}"></i>`;
  }).join("");
}

// 가랜드 깃발 한 줄 (SVG)
function bunting() {
  const colors = ["#ff8a93", "#ffc85c", "#7fb3ff", "#8fd9b0", "#c4a7ff"];
  let flags = "";
  for (let i = 0; i < 24; i++) {
    const x = i * 50 + 10;
    const y = 18 + Math.sin((i / 23) * Math.PI) * 26;   // 가운데가 처진 줄
    flags += `<path d="M${x} ${y} L${x + 36} ${y + 2} L${x + 18} ${y + 34} Z" fill="${colors[i % colors.length]}"/>`;
  }
  return `<svg class="tb-bunting" viewBox="0 0 1210 80" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 16 Q605 66 1210 16" fill="none" stroke="#e8b9a0" stroke-width="2.5"/>${flags}</svg>`;
}

const BALLOON = (c) => `<svg viewBox="0 0 60 110" aria-hidden="true"><path d="M30 4C14 4 4 17 4 32C4 50 18 64 30 70C42 64 56 50 56 32C56 17 46 4 30 4Z" fill="${c}"/>
  <ellipse cx="20" cy="22" rx="6" ry="9" fill="#fff" opacity=".45"/><path d="M27 70L33 70L30 76Z" fill="${c}"/>
  <path d="M30 76Q24 88 31 98T29 110" fill="none" stroke="#c9b8a8" stroke-width="1.5"/></svg>`;

// 시험 기간 소품 (남색·빨강·흰색: KNU 빨강과 어울리게)
const NAVY = "#4a6fa5", NAVY_L = "#c9d7ee", RED = "#e2525a";
const NOTE = (text, color, cls) => `<div class="tb-note ${cls}" style="background:${color}"><span>${text}</span></div>`;
const PENCIL = `<svg class="tb-pencil" viewBox="0 0 200 40" aria-hidden="true">
  <rect x="30" y="8" width="140" height="24" rx="4" fill="#ffd46b"/><rect x="30" y="8" width="140" height="8" rx="4" fill="#ffe39a"/>
  <rect x="150" y="8" width="20" height="24" fill="#c9d1de"/><rect x="170" y="8" width="22" height="24" rx="8" fill="${RED}"/>
  <path d="M30 8L4 20L30 32Z" fill="#f2d3b3"/><path d="M12 16L4 20L12 24Z" fill="#3b4252"/></svg>`;
const CLOCK = `<svg class="tb-clock" viewBox="0 0 120 130" aria-hidden="true">
  <circle cx="28" cy="22" r="16" fill="${RED}"/><circle cx="92" cy="22" r="16" fill="${RED}"/>
  <path d="M30 116L20 128M90 116L100 128" stroke="${NAVY}" stroke-width="7" stroke-linecap="round"/>
  <circle cx="60" cy="70" r="50" fill="#fff" stroke="${NAVY}" stroke-width="7"/>
  ${[0, 90, 180, 270].map((r) => `<rect x="58" y="28" width="4" height="9" rx="2" fill="${NAVY_L}" transform="rotate(${r} 60 70)"/>`).join("")}
  <g class="tb-hand-m"><rect x="57.5" y="34" width="5" height="38" rx="2.5" fill="${NAVY}"/></g>
  <g class="tb-hand-h"><rect x="57" y="48" width="6" height="24" rx="3" fill="${RED}"/></g>
  <circle cx="60" cy="70" r="5" fill="${NAVY}"/></svg>`;
const DESK = `<svg class="tb-desk" viewBox="0 0 260 220" aria-hidden="true">
  <rect x="20" y="176" width="170" height="30" rx="10" fill="${NAVY}"/><rect x="30" y="180" width="150" height="6" rx="3" fill="#fff" opacity=".5"/>
  <rect x="34" y="142" width="150" height="34" rx="10" fill="${RED}"/><rect x="44" y="147" width="130" height="6" rx="3" fill="#fff" opacity=".5"/>
  <rect x="26" y="110" width="140" height="32" rx="10" fill="#ffffff" stroke="${NAVY_L}" stroke-width="3"/><rect x="36" y="117" width="120" height="5" rx="2.5" fill="${NAVY_L}"/>
  <rect x="196" y="150" width="46" height="56" rx="14" fill="#fff" stroke="${NAVY_L}" stroke-width="3"/><path d="M242 164Q258 164 258 178Q258 192 242 192" fill="none" stroke="${NAVY_L}" stroke-width="7"/>
  <text x="219" y="186" font-size="18" font-weight="900" fill="${RED}" text-anchor="middle" font-family="Pretendard,sans-serif">K</text>
  <path class="tb-steam" d="M210 140Q204 128 212 118Q220 108 214 96" fill="none" stroke="${NAVY_L}" stroke-width="4" stroke-linecap="round"/>
  <path class="tb-steam" style="animation-delay:-1.2s" d="M228 140Q222 128 230 118Q238 108 232 96" fill="none" stroke="${NAVY_L}" stroke-width="4" stroke-linecap="round"/>
</svg>`;

const PLANE = `<svg viewBox="0 0 48 30" aria-hidden="true"><path d="M2 14L46 2L30 28L22 18Z" fill="#fff" stroke="#c9d7ee" stroke-width="1.5" stroke-linejoin="round"/><path d="M22 18L46 2L26 22Z" fill="#dbe5f5"/><path d="M22 18L24 27L26 22Z" fill="#c9d7ee"/></svg>`;

function sceneHtml(id) {
  if (id === "cherry") {
    return `
      <img class="tb-tree tb-tree-a" src="${TREE}" alt="">
      <img class="tb-tree tb-tree-b" src="${TREE}" alt="">
      ${fallers("petal")}`;
  }
  if (id === "midterm") {
    return `
      <div class="tb-margin"></div>
      ${NOTE("D-7", "#ffe1e3", "tb-note-a")}
      ${NOTE("A+", "#dfe9fb", "tb-note-b wide")}
      ${NOTE("화이팅!", "#e2f5ea", "tb-note-c wide")}
      ${PENCIL}
      ${CLOCK}
      <div class="tb-plane tb-plane-a">${PLANE}</div>
      <div class="tb-plane tb-plane-b wide">${PLANE}</div>
      ${DESK}`;
  }
  // march (기본)
  return `
    <div class="tb-sun"></div>
    ${bunting()}
    <div class="tb-balloon tb-balloon-a">${BALLOON("#ff8a93")}</div>
    <div class="tb-balloon tb-balloon-b">${BALLOON("#7fb3ff")}</div>
    <div class="tb-balloon tb-balloon-c wide">${BALLOON("#ffc85c")}</div>
    <div class="tb-balloon tb-balloon-d wide">${BALLOON("#8fd9b0")}</div>
    ${fallers("confetti")}
    <svg class="tb-hills" viewBox="0 0 1200 160" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 160V90Q200 40 420 86T820 74T1200 92V160Z" fill="#d9f2e2"/>
      <path d="M0 160V118Q260 86 560 116T1200 112V160Z" fill="#c4ebd3"/>
    </svg>`;
}

let current = null;
// 테마가 정해진 뒤 한 번 부른다. 테마 id가 바뀌면 다시 그린다.
export function applyThemeBg(theme) {
  const id = ["march", "cherry", "midterm"].includes(theme?.id) ? theme.id : "march";
  document.body.dataset.themeBg = id;
  if (current === id) return;
  current = id;
  let el = document.getElementById("theme-bg");
  if (!el) {
    el = document.createElement("div");
    el.id = "theme-bg";
    el.setAttribute("aria-hidden", "true");
    document.body.prepend(el);
  }
  el.className = "tb-" + id;
  el.innerHTML = sceneHtml(id);
}