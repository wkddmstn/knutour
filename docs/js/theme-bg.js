// js/theme-bg.js — 테마별 화면 배경 (모든 화면 맨 뒤에 깔리는 그림)
//   march   (3월 첫 주, 기본): 활기찬 새 학기 — 가랜드 깃발, 색종이, 풍선, 새싹 언덕
//   cherry  (벚꽃 기간)       : 벚꽃나무 한 그루 + 날리는 꽃잎 (홈 대표 카드 모서리에 꽃잎 하나가 내려앉음)
//   midterm (중간고사)        : 달밤의 도서관 — 연보라 저녁 하늘, 별, 초승달, 불 켜진 도서관, 종이비행기
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

// 도서관 (창문 불빛이 은은하게 깜빡임)
function library() {
  let wins = "";
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
    if ((r * 8 + c) % 5 === 2) continue;   // 몇 개는 불 꺼짐
    wins += `<rect class="tb-win" x="${176 + c * 46}" y="${124 + r * 32}" width="22" height="18" rx="6" style="animation-delay:-${(r * 8 + c) % 7}s"/>`;
  }
  return `<svg class="tb-library" viewBox="0 0 700 260" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <path d="M0 260V214Q120 196 230 208T470 204T700 212V260Z" fill="#d6ccf5"/>
    <rect x="150" y="104" width="400" height="140" rx="26" fill="#b3a5e3"/>
    <path d="M140 110Q350 30 560 110Z" fill="#9d8dd6"/>
    <circle cx="350" cy="78" r="15" fill="#fff6d6"/><path d="M350 70V78L356 82" stroke="#9d8dd6" stroke-width="3" stroke-linecap="round" fill="none"/>
    ${wins}
    <rect x="322" y="200" width="56" height="44" rx="24" fill="#8a79c8"/>
    <rect x="300" y="240" width="100" height="8" rx="4" fill="#c7bcef"/>
    <circle cx="86" cy="206" r="40" fill="#bfe6cf"/><circle cx="118" cy="214" r="28" fill="#cfeedb"/><rect x="82" y="226" width="10" height="24" rx="5" fill="#c9a88f"/>
    <circle cx="616" cy="208" r="36" fill="#bfe6cf"/><circle cx="586" cy="218" r="24" fill="#cfeedb"/><rect x="612" y="228" width="10" height="22" rx="5" fill="#c9a88f"/>
  </svg>`;
}

// 책 더미 + 김 나는 머그컵 (넓은 화면 오른쪽)
const DESK = `<svg class="tb-desk wide" viewBox="0 0 260 220" aria-hidden="true">
  <rect x="20" y="176" width="170" height="30" rx="10" fill="#9cc2ff"/><rect x="30" y="180" width="150" height="6" rx="3" fill="#fff" opacity=".6"/>
  <rect x="34" y="142" width="150" height="34" rx="10" fill="#ff9fb2"/><rect x="44" y="147" width="130" height="6" rx="3" fill="#fff" opacity=".6"/>
  <rect x="26" y="110" width="140" height="32" rx="10" fill="#b9aeff"/><rect x="36" y="115" width="120" height="6" rx="3" fill="#fff" opacity=".6"/>
  <rect x="196" y="150" width="46" height="56" rx="14" fill="#fff"/><path d="M242 164Q258 164 258 178Q258 192 242 192" fill="none" stroke="#fff" stroke-width="7"/>
  <rect x="196" y="150" width="46" height="12" rx="6" fill="#ffd9a8"/>
  <path class="tb-steam" d="M210 140Q204 128 212 118Q220 108 214 96" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
  <path class="tb-steam" style="animation-delay:-1.2s" d="M228 140Q222 128 230 118Q238 108 232 96" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
</svg>`;

const PLANE = `<svg viewBox="0 0 48 30" aria-hidden="true"><path d="M2 14L46 2L30 28L22 18Z" fill="#fff"/><path d="M22 18L46 2L26 22Z" fill="#e3dcff"/><path d="M22 18L24 27L26 22Z" fill="#c9bdf5"/></svg>`;

function sceneHtml(id) {
  if (id === "cherry") {
    return `
      <img class="tb-tree tb-tree-a" src="${TREE}" alt="">
      <img class="tb-tree tb-tree-b" src="${TREE}" alt="">
      ${fallers("petal")}`;
  }
  if (id === "midterm") {
    const stars = [[8, 10], [18, 26], [27, 8], [36, 18], [62, 12], [71, 30], [80, 9], [90, 22], [95, 40], [5, 44], [46, 6], [54, 34]]
      .map(([x, y], i) => `<span class="tb-star${i % 2 ? " wide" : ""}" style="left:${x}%;top:${y}%;animation-delay:-${i * 0.7}s">✦</span>`).join("");
    return `
      <div class="tb-moon"></div>
      ${stars}
      <div class="tb-plane tb-plane-a">${PLANE}</div>
      <div class="tb-plane tb-plane-b wide">${PLANE}</div>
      ${library()}
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