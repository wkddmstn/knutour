// js/theme-bg.js — 테마별 화면 배경 (모든 화면 맨 뒤에 깔리는 그림)
// 시선을 뺏지 않도록 아주 연하고 잔잔하게: 얇은 선으로 그린 일러스트 + 은은한 빛, 움직임은 느리고 적게.
// 세 테마 모두 "감성 일러스트 한 장 + 꽃잎처럼 천천히 날리는 것" 구성
//   march   (3월, 기본): 아침 등굣길 그림(img/theme/march.webp: 정문·나무·가로등 길) + 바람에 날리는 연두 새잎
//   cherry  (벚꽃 기간)       : 벚꽃나무 그림(img/hobanu/cherry-tree.webp) + 벚꽃잎 (홈 대표 카드 모서리에 꽃잎 하나)
//   midterm (중간고사)        : 밤 책상 그림(img/theme/midterm.webp) + 천천히 떠오르는 따뜻한 불빛 알갱이
// 그림 파일이 아직 없으면(불러오기 실패) 그 자리에 얇은 선 그림(캠퍼스·책상)을 대신 보여 준다.
// 카드는 반투명 유리라 배경이 살짝만 비친다 (style.css).
// 폰(좁은 화면)은 그림을 아래·가장자리에 작게, 노트북(넓은 화면)은 앱 양옆 빈 공간에 크게 둔다 (style.css의 @media).

const PETAL = "img/hobanu/petal.png";
const TREE = "img/hobanu/cherry-tree.webp";
const INK = "#4a6fa5";   // 선 색 (남색: KNU 빨강과 잘 어울림)

// 꽃잎: 자리·속도 고정 (left %, 지속 s, 지연 s, 크기 px). 홀수 번째는 넓은 화면에서만
const PETALS = [[8, 22, 2, 14], [26, 26, 11, 12], [44, 24, 6, 15], [63, 28, 15, 12], [81, 23, 9, 14], [94, 27, 4, 12]];
function petals() {
  return PETALS.map(([left, dur, delay, size], i) =>
    `<img class="tb-fall${i % 2 ? " wide" : ""}" src="${PETAL}" alt="" style="left:${left}%;width:${size}px;animation-duration:${dur}s;animation-delay:-${delay}s">`).join("");
}
// 3월: 바람에 날리는 연두 새잎 (CSS로 그린 부드러운 잎, 색을 조금씩 다르게)
function leaves() {
  return PETALS.map(([left, dur, delay, size], i) =>
    `<i class="tb-fall tb-leaf${i % 3 === 2 ? " light" : ""}${i % 2 ? " wide" : ""}" style="left:${left}%;width:${size}px;animation-duration:${dur + 4}s;animation-delay:-${delay}s"></i>`).join("");
}
// 중간고사: 아래에서 천천히 떠오르는 따뜻한 불빛 알갱이
const MOTES = [[10, 20, 3, 6], [22, 26, 12, 4], [35, 22, 7, 5], [52, 28, 16, 4], [66, 24, 2, 6], [78, 30, 10, 4], [88, 21, 5, 5], [95, 27, 14, 4]];
function motes() {
  return MOTES.map(([left, dur, delay, size], i) =>
    `<i class="tb-mote${i % 2 ? " wide" : ""}" style="left:${left}%;width:${size}px;height:${size}px;animation-duration:${dur}s;animation-delay:-${delay}s"></i>`).join("");
}
// 감성 일러스트 자리: 파일이 없으면 #theme-bg에 no-art를 붙여 선 그림이 대신 보이게
const ART = (src, cls) => `<img class="tb-art ${cls}" src="${src}" alt="" onerror="this.closest('#theme-bg')?.classList.add('no-art');this.remove()">`;

// 아침 캠퍼스 등굣길 (얇은 선): 가로등 · 정문 · 시계탑 건물 · 나무 · 도서관 · 가로등 · 나무 · 건물 · 나무
const CAMPUS = `<svg class="tb-campus" viewBox="0 0 1200 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <g fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M0 200H1200"/>
    <path d="M40 200V150M30 150H50"/><circle cx="40" cy="144" r="5"/>
    <path d="M120 200V120Q120 112 128 112H150Q158 112 158 120V200M250 200V120Q250 112 258 112H280Q288 112 288 120V200"/>
    <path d="M150 128Q204 96 258 128"/><path d="M164 152H244"/>
    <text x="204" y="146" font-size="13" text-anchor="middle" fill="${INK}" stroke="none" font-family="Pretendard,sans-serif" letter-spacing="3">KNU</text>
    <path d="M340 200V128H470V200M340 128L405 96L470 128"/><path d="M405 96V72"/><circle cx="405" cy="62" r="10"/><path d="M405 56V62L409 64"/>
    <path d="M362 150H448M362 172H448"/><path d="M392 200V182H418V200"/>
    <circle cx="520" cy="168" r="22"/><path d="M520 190V200"/><circle cx="556" cy="176" r="15"/><path d="M556 191V200"/>
    <path d="M600 200V138H780V200M600 138H780M612 150H768"/><path d="M630 162V190M660 162V190M690 162V190M720 162V190M750 162V190"/>
    <path d="M830 200V150M820 150H840"/><circle cx="830" cy="144" r="4"/>
    <circle cx="880" cy="172" r="18"/><path d="M880 190V200"/>
    <path d="M930 200V112H1040V200M930 112H1040M985 112V90M972 90H998"/><path d="M948 130H1022M948 150H1022M948 170H1022"/>
    <circle cx="1090" cy="166" r="24"/><path d="M1090 190V200"/><circle cx="1130" cy="178" r="14"/><path d="M1130 192V200"/>
  </g>
</svg>`;
const BIRD = `<svg viewBox="0 0 30 12" aria-hidden="true"><path d="M1 8Q8 1 15 8Q22 1 29 8" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/></svg>`;

// 늦은 밤 공부 책상 (얇은 선 + 스탠드 불빛): 스탠드 · 펼친 책 · 책 더미 + 화분
const DESK = `<svg class="tb-desk" viewBox="0 0 520 300" aria-hidden="true">
  <defs><radialGradient id="tbLamp" cx="50%" cy="40%" r="50%"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient></defs>
  <ellipse class="tb-glow" cx="150" cy="190" rx="170" ry="120" fill="url(#tbLamp)"/>
  <g fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 270H510"/>
    <path d="M70 270H150M110 270V250L80 160L150 110"/><circle cx="80" cy="160" r="5"/><path d="M130 96L190 92L176 140L118 128Z"/>
    <path d="M200 270V238Q240 228 280 238V270M280 238Q320 228 360 238V270"/>
    <path d="M214 250H266M294 250H346M214 260H262M294 260H340"/>
    <rect x="380" y="242" width="110" height="28" rx="5"/><rect x="390" y="216" width="96" height="26" rx="5"/><rect x="384" y="192" width="100" height="24" rx="5"/>
    <path d="M440 192V170M440 172Q428 158 432 146M440 176Q454 164 452 150"/>
  </g>
</svg>`;
const MUG = `<svg class="tb-mug" viewBox="0 0 80 90" aria-hidden="true"><g fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round">
  <path d="M12 40H54V74Q54 84 44 84H22Q12 84 12 74Z"/><path d="M54 48Q68 48 68 58Q68 68 54 68"/>
  <path class="tb-steam" d="M26 32Q22 24 28 16Q34 8 30 2"/><path class="tb-steam" style="animation-delay:-1.5s" d="M40 32Q36 24 42 16Q48 8 44 2"/></g></svg>`;

function sceneHtml(id) {
  if (id === "cherry") {
    return `
      <img class="tb-tree tb-tree-a" src="${TREE}" alt="">
      <img class="tb-tree tb-tree-b" src="${TREE}" alt="">
      ${petals()}`;
  }
  if (id === "midterm") {
    return `
      ${ART("img/theme/midterm.webp", "tb-art-a")}
      ${ART("img/theme/midterm.webp", "tb-art-b")}
      <div class="tb-fallback tb-lines"></div>
      <div class="tb-fallback tb-desk-wrap">${DESK}</div>
      <div class="tb-fallback tb-mug-wrap wide">${MUG}</div>
      ${motes()}`;
  }
  // march (기본): 아침 등굣길 그림 + 연두 새잎 (그림이 없으면 등굣길 선 그림)
  return `
    <div class="tb-sunlight"></div>
    ${ART("img/theme/march.webp", "tb-art-a")}
    ${ART("img/theme/march.webp", "tb-art-b")}
    <div class="tb-fallback tb-campus-wrap">${CAMPUS}</div>
    ${leaves()}`;
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