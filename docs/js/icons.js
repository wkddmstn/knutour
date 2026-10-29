// js/hero.js — 홈 대표 카드의 움직이는 그림 ("캠퍼스 산책")
// 호반우가 동글동글한 캠퍼스 사이를 걸어가고, 배경이 두 겹으로 천천히 흐른다.
// 테마(themes.json의 id)마다 색·날리는 장식·말풍선·문구만 바꾼다.
//   march   (3월 첫 주)  : 민트·하늘색, 새싹과 색종이
//   cherry  (벚꽃 기간)  : 분홍, 벚꽃잎
//   midterm (중간고사)   : 보랏빛 저녁, 책·연필·별
// 다른 테마 id가 오면 march 모양을 쓴다.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 받침 있으면 "으로", 없거나 ㄹ받침이면 "로"
function ro(name) {
  const c = String(name).charCodeAt(String(name).length - 1);
  if (c < 0xac00 || c > 0xd7a3) return "로";
  const jong = (c - 0xac00) % 28;
  return jong === 0 || jong === 8 ? "로" : "으로";
}

const THEMES = {
  march: {
    bubble: "새 학기 시작! 구경 가자 🌱",
    title: (z) => `오늘은 ${z}${ro(z)} 가볼까?`,
    sub: "새 학기 캠퍼스와 친해지는 시간이에요",
    particles: "leaf",
  },
  cherry: {
    bubble: "벚꽃 보러 가자! 🌸",
    title: (z) => `오늘은 ${z}${ro(z)} 산책 갈까?`,
    sub: "벚꽃 핀 캠퍼스를 걸어 봐요",
    particles: "petal",
  },
  midterm: {
    bubble: "시험 화이팅! 📚",
    title: (z) => `공부하다 지치면 ${z}${ro(z)}!`,
    sub: "시험 기간에도 쉬엄쉬엄 캠퍼스 한 바퀴",
    particles: "book",
  },
};

// 먼 건물 (연하게, 천천히)
const FAR = `<svg viewBox="0 0 600 230" preserveAspectRatio="xMinYMax meet" aria-hidden="true">
  <path d="M0 200 Q80 150 170 190 T360 185 T600 195 V230 H0Z" fill="var(--hx-hill2)"/>
  <rect x="40" y="120" width="70" height="80" rx="22" fill="var(--hx-far1)"/><circle cx="75" cy="118" r="26" fill="var(--hx-far2)"/>
  <circle cx="62" cy="150" r="7" fill="var(--hx-win)"/><circle cx="88" cy="150" r="7" fill="var(--hx-win)"/>
  <rect x="250" y="110" width="90" height="90" rx="26" fill="var(--hx-far3)"/>
  <rect x="268" y="132" width="20" height="16" rx="8" fill="var(--hx-win)"/><rect x="302" y="132" width="20" height="16" rx="8" fill="var(--hx-win)"/>
  <rect x="440" y="130" width="60" height="70" rx="20" fill="var(--hx-far4)"/><circle cx="470" cy="128" r="20" fill="var(--hx-far4)"/>
</svg>`;

// 가까운 건물·나무·분수 (또렷하게, 조금 빠르게)
const NEAR = `<svg viewBox="0 0 600 230" preserveAspectRatio="xMinYMax meet" aria-hidden="true">
  <path d="M0 206 Q150 186 300 204 T600 204 V230 H0Z" fill="var(--hx-hill)"/>
  <g><rect x="10" y="118" width="110" height="90" rx="26" fill="var(--hx-wall)"/><path d="M10 140 Q65 84 120 140Z" fill="var(--hx-roof)"/>
    <circle cx="65" cy="104" r="10" fill="var(--hx-accent)"/>
    <rect x="30" y="150" width="20" height="22" rx="10" fill="var(--hx-win2)"/><rect x="80" y="150" width="20" height="22" rx="10" fill="var(--hx-win2)"/>
    <rect x="54" y="176" width="22" height="32" rx="11" fill="var(--hx-door)"/></g>
  <g><circle cx="168" cy="168" r="24" fill="var(--hx-tree1)"/><circle cx="186" cy="152" r="18" fill="var(--hx-tree2)"/>
    <circle cx="152" cy="150" r="15" fill="var(--hx-tree2)"/><rect x="163" y="186" width="10" height="22" rx="5" fill="var(--hx-trunk)"/></g>
  <g><ellipse cx="300" cy="200" rx="46" ry="10" fill="var(--hx-pool)"/><path d="M300 196 Q290 170 300 150 Q310 170 300 196" fill="var(--hx-jet)"/>
    <circle cx="300" cy="146" r="5" fill="var(--hx-pool)"/><circle cx="286" cy="164" r="3" fill="var(--hx-pool)"/><circle cx="314" cy="160" r="3" fill="var(--hx-pool)"/></g>
  <g><rect x="390" y="124" width="100" height="84" rx="26" fill="var(--hx-wall)"/><rect x="390" y="124" width="100" height="26" rx="13" fill="var(--hx-roof2)"/>
    <rect x="408" y="162" width="16" height="16" rx="8" fill="var(--hx-win3)"/><rect x="432" y="162" width="16" height="16" rx="8" fill="var(--hx-win3)"/>
    <rect x="456" y="162" width="16" height="16" rx="8" fill="var(--hx-win3)"/>
    <path d="M440 124 V100" stroke="var(--hx-roof)" stroke-width="4" stroke-linecap="round"/><path d="M440 100 Q456 104 440 112" fill="var(--hx-accent)"/></g>
  <g><circle cx="540" cy="174" r="20" fill="var(--hx-tree3)"/><circle cx="556" cy="160" r="15" fill="var(--hx-tree4)"/>
    <rect x="536" y="188" width="9" height="20" rx="4.5" fill="var(--hx-trunk)"/></g>
</svg>`;

// 날리는 장식 (자리·속도는 고정값으로 흩어 놓아 매번 같은 모양)
const SPOTS = [[8, 6.2, 0.5, 13], [22, 8.4, 3.1, 11], [37, 7.1, 6.0, 16], [51, 9.3, 1.7, 12], [64, 6.8, 4.4, 15],
               [77, 8.9, 7.3, 11], [88, 7.6, 2.4, 14], [96, 9.8, 5.5, 12]];
const BOOK_SVG = (c) => `<svg viewBox="0 0 20 16"><rect x="1" y="2" width="18" height="12" rx="3" fill="${c}"/><rect x="4" y="2" width="13" height="10" rx="2" fill="#fff" opacity=".7"/><rect x="9.2" y="2" width="1.6" height="12" fill="${c}"/></svg>`;
function particles(kind) {
  return SPOTS.map(([left, dur, delay, size], i) => {
    const style = `left:${left}%;width:${size}px;animation-duration:${dur}s;animation-delay:-${delay}s`;
    if (kind === "petal") return `<img class="hx-p" src="img/hobanu/petal.png" alt="" style="${style}">`;
    if (kind === "book") {
      const c = ["#9c8cff", "#7fb3ff", "#ff9fb2", "#8fd9b0"][i % 4];
      return i % 3 === 2
        ? `<span class="hx-p hx-star" style="${style}">✦</span>`
        : `<span class="hx-p hx-book" style="${style}">${BOOK_SVG(c)}</span>`;
    }
    // leaf: 새싹 잎 + 색종이
    return i % 2
      ? `<span class="hx-p hx-leaf" style="${style}"></span>`
      : `<span class="hx-p hx-conf" style="${style};background:${["#ff8a93", "#7fb3ff", "#ffd27a", "#8fd9b0"][i % 4]}"></span>`;
  }).join("");
}

// 홈 카드 안에 넣을 그림 + 문구
// theme: 지금 테마(themes.js), nextZone: 다음에 갈 장소(없으면 다 깬 상태)
export function heroHtml(theme, nextZone) {
  const id = THEMES[theme?.id] ? theme.id : "march";
  const t = THEMES[id];
  const title = nextZone ? t.title(nextZone.name) : "모든 장소를 다 돌았어요! 🎉";
  const sub = nextZone ? t.sub : "다른 테마가 열리면 또 만나요";
  return `
    <div class="hx-stage hx-${id}" aria-hidden="true">
      <div class="hx-sun"></div>
      <div class="hx-cloud" style="top:28px;width:58px;animation-duration:32s;animation-delay:-6s"></div>
      <div class="hx-cloud" style="top:60px;width:44px;animation-duration:40s;animation-delay:-24s"></div>
      ${id === "midterm" ? `<span class="hx-twinkle" style="left:18%;top:20px">✦</span><span class="hx-twinkle" style="left:44%;top:40px;animation-delay:.8s">✦</span><span class="hx-twinkle" style="left:70%;top:16px;animation-delay:1.6s">✦</span>` : ""}
      <div class="hx-layer hx-far">${FAR}${FAR}</div>
      <div class="hx-layer hx-near">${NEAR}${NEAR}</div>
      ${id === "march" ? `<div class="hx-sprouts"><i style="left:12%"></i><i style="left:31%;animation-delay:.6s"></i><i style="left:74%;animation-delay:1.2s"></i><i style="left:90%;animation-delay:.3s"></i></div>` : ""}
      <div class="hx-walker"><img class="hx-f1" src="img/mascot/commute1.png" alt=""><img class="hx-f2" src="img/mascot/commute2.png" alt=""></div>
      <div class="hx-bubble">${esc(t.bubble)}</div>
      <span class="hx-heart" style="left:42%;bottom:118px">♥</span><span class="hx-heart" style="left:56%;bottom:108px;animation-delay:1.5s;font-size:11px">♥</span>
      ${particles(t.particles)}
    </div>
    <div class="hx-title">${esc(title)}</div>
    <div class="hx-sub">${esc(sub)}</div>`;
}