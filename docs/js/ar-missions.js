// js/ar-missions.js — 장소별 AR 미니 미션 (담당: 장주연)
// ar.js의 startAR()가 AR 화면을 띄운 뒤, 미션 종류(mission.ar)에 맞는 놀이를 여기서 붙인다.
//   roulette : 센트럴파크 — 호반우 옆 피크닉 메뉴 돌림판 → 맛집 추천(틀만)
//   find     : 중앙도서관 — 주위에 숨은 추천 도서 찾기 (표지는 직접 그리거나 사진)
//   petals   : 벚꽃길 — 호반우 뒤 벚꽃 나무에서 흩날리는 꽃잎 잡기
//   cheer    : 대운동장 — 휴대폰 흔들어 응원 게이지 채우기
// (snack: 공식당 학식 주기, pet: 러브로드 쓰다듬기는 ar.js 안에서 처리)
//
// ctx: startAR가 넘겨주는 도구 모음
//   root, inner(호반우 묶음), hob, tray, PX, VIEW
//   say(말풍선) react(표정) toast info spawnHeart complete(성공 처리)
//   onHeading(fn)  : 방향이 바뀔 때마다 fn({ diff, y })   diff = 지금 방향 − 호반우 방향(도)
//   hasSensor()    : 방향 센서가 작동 중인지

const el = (tag, cls) => { const d = document.createElement(tag); if (cls) d.className = cls; return d; };

let styled = false;
function injectStyle() {
  if (styled) return;
  styled = true;
  const s = el("style");
  s.textContent = `
  /* 돌림판 */
  #ar-stage.with-wheel{--wheel:clamp(170px,36vmin,360px);width:calc(190px + var(--wheel));margin-left:calc(-95px - var(--wheel) / 2)}
  #ar-stage.with-wheel #ar-jump{right:auto;width:180px}
  #ar-stage.with-wheel #ar-shadow{left:90px}
  #ar-stage.with-wheel #ar-bubble{left:50%;max-width:min(300px,90vw)}
  .arm-wheel{position:absolute;right:0;bottom:40px;width:var(--wheel,170px);height:var(--wheel,170px);touch-action:none;cursor:pointer}
  .arm-wheel canvas{width:100%;height:100%;border-radius:50%;box-shadow:0 6px 16px rgba(0,0,0,.35);
    transition:transform 3.4s cubic-bezier(.12,.67,.12,1)}
  .arm-wheel::before{content:"";position:absolute;left:50%;top:-10px;margin-left:-11px;border:11px solid transparent;
    border-top:18px solid #d4121a;z-index:2;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4))}
  .arm-wheel b{position:absolute;left:50%;top:50%;width:24%;height:24%;transform:translate(-50%,-50%);border-radius:50%;background:#fff;
    color:#d4121a;font-size:clamp(13px,3.2vmin,24px);font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3)}
  .arm-card{width:100%;display:flex;flex-direction:column;align-items:center;gap:8px;color:#191f28}
  .arm-card .t{font-size:14px;font-weight:800}
  .arm-card .s{font-size:12px;color:#6b7684;text-align:center}
  .arm-row{display:flex;gap:8px;width:100%}
  .arm-btn{flex:1;width:auto;margin:0;padding:10px;border:none;border-radius:12px;font-size:14px;font-weight:700;background:#f2f4f6;color:#191f28;font-family:inherit}
  .arm-btn.primary{background:#d4121a;color:#fff}
  /* 숨은 물건 찾기 */
  .arm-item{position:absolute;left:0;top:0;width:64px;height:64px;margin:-32px 0 0 -32px;font-size:46px;line-height:64px;text-align:center;
    z-index:3;display:none;cursor:pointer;filter:drop-shadow(0 0 8px rgba(255,255,200,.9));animation:arm-bob 1.6s ease-in-out infinite;touch-action:manipulation}
  .arm-item.got{animation:arm-got .5s ease-out forwards;pointer-events:none}
  .arm-item.arm-book{width:78px;height:108px;margin:-54px 0 0 -39px;line-height:normal;font-size:inherit;filter:drop-shadow(0 0 10px rgba(255,255,200,.95)) drop-shadow(0 4px 6px rgba(0,0,0,.35))}
  .arm-book img{width:100%;height:100%;object-fit:cover;border-radius:4px 8px 8px 4px}
  .arm-cover{width:100%;height:100%;border-radius:4px 8px 8px 4px;background:linear-gradient(90deg,rgba(0,0,0,.25) 0 8%,transparent 8% 100%),var(--c);
    color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:12px 8px 8px 12px;box-sizing:border-box;text-align:left}
  .arm-cover b{font-size:15px;line-height:1.25;word-break:keep-all}
  .arm-cover small{font-size:10px;opacity:.9}
  .arm-tree{position:absolute;left:50%;bottom:-4px;width:min(440px,110vw);transform:translateX(-50%);z-index:0;pointer-events:none}
  .arm-tree svg,.arm-tree img{display:block;width:100%;height:auto}
  .arm-petal-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none}
  .arm-petal-canvas.on{pointer-events:auto;cursor:pointer}
  /* 벚꽃잎 */
  .arm-petal{position:absolute;top:-50px;font-size:34px;z-index:3;cursor:pointer;touch-action:manipulation;user-select:none;
    animation:arm-fall var(--dur) linear forwards}
  .arm-petal i{display:inline-block;font-style:normal;animation:arm-sway 1.4s ease-in-out infinite alternate}
  .arm-pop{position:absolute;z-index:4;font-size:22px;font-weight:900;color:#ff6fa5;pointer-events:none;animation:arm-up .7s ease-out forwards;
    text-shadow:0 1px 3px #fff}
  /* 응원 게이지 */
  .arm-gauge{width:100%;height:16px;border-radius:8px;background:#f2f4f6;overflow:hidden}
  .arm-gauge i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ffb703,#d4121a);border-radius:8px;transition:width .15s}
  .arm-confetti{position:absolute;top:-30px;font-size:26px;z-index:4;pointer-events:none;animation:arm-fall var(--dur) linear forwards}
  @keyframes arm-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
  @keyframes arm-got{0%{transform:scale(1);opacity:1}60%{transform:scale(1.6);opacity:1}100%{transform:scale(.2) translateY(-60px);opacity:0}}
  @keyframes arm-fall{to{transform:translate(var(--dx),calc(100vh + 80px)) rotate(var(--rot))}}
  @keyframes arm-sway{from{transform:translateX(-10px) rotate(-15deg)}to{transform:translateX(10px) rotate(15deg)}}
  @keyframes arm-up{to{transform:translateY(-50px);opacity:0}}`;
  document.head.appendChild(s);
}

/* ============================================================
   🎡 센트럴파크: 피크닉 메뉴 돌림판
   ============================================================ */
const DEFAULT_CATEGORIES = [
  { id: "chicken", name: "치킨", emoji: "🍗" },
  { id: "pizza", name: "피자", emoji: "🍕" },
  { id: "kimbap", name: "김밥·분식", emoji: "🍙" },
  { id: "burger", name: "햄버거", emoji: "🍔" },
  { id: "sandwich", name: "샌드위치", emoji: "🥪" },
  { id: "tteokbokki", name: "떡볶이", emoji: "🌶️" },
  { id: "dosirak", name: "도시락", emoji: "🍱" },
  { id: "dessert", name: "디저트·음료", emoji: "🧋" },
];
const WHEEL_COLORS = ["#ffd6d6", "#ffe8b3", "#fff6b3", "#d9f5c5", "#c9ecff", "#dcd6ff", "#ffd6f0", "#e8e8e8"];

// 맛집 데이터(data/restaurants.json). 없거나 비어 있으면 기본 카테고리로 돌림판만 동작한다.
let foodData = null;
export async function loadRestaurants() {
  if (foodData) return foodData;
  try {
    const r = await fetch("data/restaurants.json", { cache: "no-store" });
    foodData = await r.json();
  } catch { foodData = {}; }
  if (!foodData.categories?.length) foodData.categories = DEFAULT_CATEGORIES;
  if (!Array.isArray(foodData.restaurants)) foodData.restaurants = [];
  return foodData;
}

// 나중에 메인 탭 "맛집" 화면이 생기면 이 이벤트를 받아서 해당 카테고리를 열면 된다.
//   window.addEventListener("knu:open-restaurants", (e) => openRestaurantTab(e.detail.category));
export function openRestaurants(categoryId) {
  window.dispatchEvent(new CustomEvent("knu:open-restaurants", { detail: { category: categoryId } }));
}

async function roulette(ctx) {
  const data = await loadRestaurants();
  const cats = data.categories;
  const seg = 360 / cats.length;

  $stage(ctx).classList.add("with-wheel");
  const box = el("div", "arm-wheel");
  const cv = el("canvas");
  cv.width = 640; cv.height = 640;
  box.appendChild(cv);
  const go = el("b"); go.textContent = "GO";
  box.appendChild(go);
  ctx.inner.appendChild(box);

  // 돌림판 그리기 (0번 칸이 맨 위에서 시작해 시계 방향)
  const g = cv.getContext("2d");
  const R = 320;
  cats.forEach((c, i) => {
    const a0 = ((i * seg - 90) * Math.PI) / 180, a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
    g.beginPath(); g.moveTo(R, R); g.arc(R, R, R - 2, a0, a1); g.closePath();
    g.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length]; g.fill();
    g.strokeStyle = "#fff"; g.lineWidth = 5; g.stroke();
    g.save(); g.translate(R, R); g.rotate((a0 + a1) / 2);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#191f28";
    let fs = 46;                                       // 칸 안에 들어가도록 글씨 크기 자동 조절
    do { g.font = `900 ${fs}px Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`; fs -= 2; }
    while (g.measureText(c.name).width > R * 0.58 && fs > 18);
    g.fillText(c.name, R * 0.6, 0);
    g.restore();
  });
  g.beginPath(); g.arc(R, R, R - 4, 0, Math.PI * 2); g.strokeStyle = "#d4121a"; g.lineWidth = 10; g.stroke();

  let rot = 0, spinning = false;
  ctx.say("피크닉 메뉴 고민돼? 돌림판 돌려 보자! 🎡");
  ctx.info("돌림판을 눌러서 돌려 봐!");

  const spin = () => {
    if (spinning) return;
    spinning = true;
    ctx.tray.classList.add("ar-hidden");
    const pick = Math.floor(Math.random() * cats.length);
    const center = pick * seg + seg / 2;
    const now = ((rot % 360) + 360) % 360;
    rot += 360 * 5 + ((360 - center - now) % 360 + 360) % 360 + (Math.random() - 0.5) * seg * 0.6;
    cv.style.transform = `rotate(${rot}deg)`;
    ctx.say("두구두구두구… 🥁");
    navigator.vibrate?.([30, 60, 30, 60, 30]);
    setTimeout(() => { spinning = false; showResult(cats[pick]); }, 3500);
  };
  box.addEventListener("click", spin);

  function showResult(c) {
    const list = data.restaurants.filter((r) => r.category === c.id);
    ctx.react("proud", `오늘 피크닉은 ${c.emoji} ${c.name} 어때?`, 2600);
    ctx.info(`오늘의 피크닉 메뉴는 ${c.emoji} ${c.name}!`);
    navigator.vibrate?.(120);
    ctx.tray.innerHTML = `
      <div class="arm-card">
        <div class="t">🎡 오늘의 피크닉 메뉴: ${c.emoji} ${c.name}</div>
        <div class="s">${list.length
          ? `호반우 추천: <b>${list[0].name}</b>${list[0].area ? ` (${list[0].area})` : ""}${list[0].comment ? `<br>${list[0].comment}` : ""}`
          : "근처 맛집 추천은 곧 열려요! 맛집에서 영수증을 인증하면 포인트도 받을 수 있어요."}</div>
        <div class="arm-row">
          <button class="arm-btn" data-a="again">다시 돌리기</button>
          <button class="arm-btn primary" data-a="shops">추천 맛집 보기</button>
        </div>
      </div>`;
    ctx.tray.classList.remove("ar-hidden");
    ctx.tray.querySelector('[data-a="again"]').onclick = spin;
    ctx.tray.querySelector('[data-a="shops"]').onclick = () => {
      openRestaurants(c.id);
      ctx.toast("🍽️ 맛집 추천은 준비 중이에요!");
    };
    ctx.complete();
  }
  return () => {};
}

/* ============================================================
   📚 중앙도서관: 숨은 물건 찾기 (주위 여러 방향에 숨어 있음)
   ============================================================ */
function find(ctx) {
  // 추천 도서: zones.json 미션의 "books"로 바꿀 수 있다. img(표지 사진 경로)가 있으면 사진, 없으면 표지를 직접 그린다.
  const books = (ctx.mission.books && ctx.mission.books.length ? ctx.mission.books : DEFAULT_BOOKS).slice(0, 5);
  const total = books.length;
  const angles = [-75, 70, 150, -150, 110].slice(0, total);     // 호반우 기준 각도
  const fallback = [[18, 30], [82, 26], [22, 70], [78, 68], [50, 20]]; // 센서 없을 때 화면 위치(%)
  const found = [];

  const items = books.map((bk, i) => {
    const d = el("div", "arm-item arm-book");
    d.innerHTML = bk.img
      ? `<img src="${bk.img}" alt="${bk.title}">`
      : `<div class="arm-cover" style="--c:${bk.color || BOOK_COLORS[i % BOOK_COLORS.length]}"><b>${bk.title}</b><small>${bk.author || ""}</small></div>`;
    d.onclick = () => {
      if (d.classList.contains("got")) return;
      d.classList.add("got");
      found.push(bk);
      navigator.vibrate?.(60);
      ctx.spawnHeart(parseFloat(d.style.left), parseFloat(d.style.top), "✨");
      ctx.say(`『${bk.title}』 찾았다! ${bk.comment || ""}`.trim());
      progress();
      showList();
      if (found.length >= total) {
        ctx.react("proud", ctx.mission.tip || "추천 도서 다 찾았다! 도서관에서 빌려 봐 📚", 3200);
        ctx.complete();
      }
    };
    ctx.root.appendChild(d);
    return { d, ang: angles[i], i };
  });

  const progress = () => ctx.info(found.length >= total ? "추천 도서를 모두 찾았어! 🎉" : `주위를 둘러보며 숨은 추천 도서 ${total}권을 찾아봐! (${found.length}/${total})`);
  function showList() {
    ctx.tray.innerHTML = `<div class="arm-card"><div class="t">📖 찾은 추천 도서 ${found.length}/${total}</div>
      <div class="s">${found.map((b) => `『${b.title}』 ${b.author || ""}`).join("<br>")}</div>
      ${found.length >= total ? `<div class="s">중앙도서관에서 빌려 보세요! 대출은 학생증으로 할 수 있어요.</div>` : ""}</div>`;
    ctx.tray.classList.remove("ar-hidden");
  }
  progress();
  ctx.say(`이 근처에 추천 도서 ${total}권이 숨어 있대! 휴대폰을 돌려 찾아봐!`);

  const W = () => window.innerWidth, H = () => window.innerHeight;
  ctx.onHeading(({ diff, y }) => {
    items.forEach(({ d, ang }) => {
      if (d.classList.contains("got")) return;
      let rel = diff - ang;
      rel = ((rel + 540) % 360) - 180;
      const inView = Math.abs(rel) < ctx.VIEW / 2 + 5;
      d.style.display = inView ? "block" : "none";
      d.style.left = W() / 2 - rel * ctx.PX + "px";
      d.style.top = H() * 0.42 + y + ((Math.abs(ang) % 3) * 18) + "px";
    });
  });
  // 센서가 없으면(PC 등) 화면 곳곳에 바로 보여준다
  const t = setTimeout(() => {
    if (ctx.hasSensor()) return;
    items.forEach(({ d, i }) => {
      d.style.display = "block";
      d.style.left = (W() * fallback[i][0]) / 100 + "px";
      d.style.top = (H() * fallback[i][1]) / 100 + "px";
    });
  }, 1800);
  return () => { clearTimeout(t); items.forEach(({ d }) => d.remove()); };
}
const DEFAULT_BOOKS = [
  { title: "데미안", author: "헤르만 헤세", comment: "새내기에게 딱 맞는 성장 소설!" },
  { title: "어린 왕자", author: "생텍쥐페리", comment: "다시 읽으면 또 다른 책이야." },
  { title: "코스모스", author: "칼 세이건", comment: "우주가 궁금하다면!" },
];
const BOOK_COLORS = ["#2f6fed", "#d4121a", "#0a9d63", "#8d5fd3", "#a86400"];

/* ============================================================
   🌸 벚꽃길: 떨어지는 벚꽃잎 잡기
   ============================================================ */
// 벚꽃 나무 그림 (직접 그린 SVG). img/hobanu/cherry-tree.png 파일을 넣으면 그 그림을 대신 쓴다.
function cherryTreeSVG() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pinks = ["#f7a1bd", "#ffb7cc", "#ffc8d8", "#ffd9e4", "#fbb0c7"];
  let blossoms = "";
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 34; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
      const x = 200 + Math.cos(a) * r * 175, y = 135 + Math.sin(a) * r * 100;
      const s = 20 + rnd() * 18 - layer * 3;
      blossoms += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(1)}" fill="${pinks[(i + layer) % pinks.length]}" opacity="${0.85 + layer * 0.05}"/>`;
    }
  }
  let dots = "";
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    dots += `<circle cx="${(200 + Math.cos(a) * r * 170).toFixed(1)}" cy="${(135 + Math.sin(a) * r * 95).toFixed(1)}" r="${(2 + rnd() * 3).toFixed(1)}" fill="#fff"/>`;
  }
  return `<svg viewBox="0 0 400 380" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M186 380 C190 330 188 290 176 250 C168 225 150 205 128 190 L136 180 C160 194 178 210 190 232 C196 205 198 185 194 160 L208 158
             C212 186 210 210 204 236 C222 214 246 200 276 192 L280 204 C250 214 226 232 214 258 C206 290 208 330 214 380 Z" fill="#7a4b32"/>
    <path d="M150 196 C130 180 110 172 86 170 M262 198 C286 186 306 182 326 184" stroke="#7a4b32" stroke-width="9" stroke-linecap="round" fill="none"/>
    ${blossoms}${dots}
  </svg>`;
}

function petals(ctx) {
  const GOAL = ctx.mission.goal || 10, TIME = ctx.mission.time || 15;
  let caught = 0, left = TIME, tickT = 0, raf = 0, playing = false, spawnAcc = 0, lastT = 0;

  // 1) 호반우 뒤에 큰 벚꽃 나무 (호반우와 함께 공간에 고정되어 움직인다)
  const tree = el("div", "arm-tree");
  const png = new Image();
  png.onload = () => { tree.innerHTML = ""; tree.appendChild(png); };
  png.src = "img/hobanu/cherry-tree.png";
  tree.innerHTML = cherryTreeSVG();
  ctx.inner.insertBefore(tree, ctx.inner.firstChild);

  // 2) 화면 전체에 흩날리는 꽃잎 (캔버스)
  const cv = el("canvas", "arm-petal-canvas");
  ctx.root.appendChild(cv);
  const g = cv.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
  resize();
  window.addEventListener("resize", resize);

  const parts = [];
  const COLORS = ["#ffc2d4", "#ffb3c8", "#ffd6e2", "#f9a8c0", "#ffe3ec"];
  function spawn() {
    const r = tree.getBoundingClientRect();
    const fromTree = r.width > 10 && r.bottom > 0 && r.top < innerHeight;
    parts.push({
      x: fromTree ? r.left + r.width * (0.1 + Math.random() * 0.8) : Math.random() * innerWidth,
      y: fromTree ? r.top + r.height * (0.1 + Math.random() * 0.45) : -20,
      vy: 0.5 + Math.random() * 0.9,
      vx: (Math.random() - 0.3) * 0.6,
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.06,
      size: 9 + Math.random() * 9, ph: Math.random() * Math.PI * 2,
      c: COLORS[(Math.random() * COLORS.length) | 0],
    });
  }
  function drawPetal(p) {
    g.save();
    g.translate(p.x * dpr, p.y * dpr);
    g.rotate(p.rot);
    g.scale(dpr, dpr * (0.55 + 0.45 * Math.abs(Math.sin(p.ph))));   // 뒤집히며 떨어지는 느낌
    const s = p.size;
    g.beginPath();                                                    // 끝이 살짝 파인 벚꽃잎 모양
    g.moveTo(0, -s);
    g.bezierCurveTo(s * 0.9, -s * 0.9, s * 0.8, s * 0.5, 0, s);
    g.bezierCurveTo(-s * 0.8, s * 0.5, -s * 0.9, -s * 0.9, 0, -s);
    g.moveTo(-s * 0.22, -s);
    g.lineTo(0, -s * 0.72);
    g.lineTo(s * 0.22, -s);
    g.fillStyle = p.c;
    g.shadowColor = "rgba(255,120,160,.35)";
    g.shadowBlur = 4;
    g.fill("evenodd");
    g.restore();
  }
  function frame(t) {
    const dt = Math.min(50, t - (lastT || t)); lastT = t;
    const wind = Math.sin(t / 1800) * 0.7 + Math.sin(t / 600) * 0.25 + 0.35;   // 바람이 세졌다 약해졌다
    spawnAcc += dt * (playing ? 0.012 : 0.004);
    while (spawnAcc > 1 && parts.length < 140) { spawn(); spawnAcc -= 1; }
    g.clearRect(0, 0, cv.width, cv.height);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.ph += 0.05;
      p.x += (p.vx + wind + Math.sin(p.ph) * 0.6) * dt / 16;
      p.y += (p.vy + Math.cos(p.ph * 0.7) * 0.2) * dt / 16;
      p.rot += p.vr * dt / 16;
      if (p.y > innerHeight + 30 || p.x > innerWidth + 40 || p.x < -60) { parts.splice(i, 1); continue; }
      drawPetal(p);
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // 3) 꽃잎 잡기: 화면을 터치한 곳 근처의 꽃잎을 잡는다
  cv.addEventListener("pointerdown", (e) => {
    if (!playing) return;
    let best = -1, bd = 42;
    parts.forEach((p, i) => { const d = Math.hypot(p.x - e.clientX, p.y - e.clientY); if (d < bd) { bd = d; best = i; } });
    if (best < 0) return;
    parts.splice(best, 1);
    caught++;
    navigator.vibrate?.(30);
    const pop = el("div", "arm-pop"); pop.textContent = "+1 🌸";
    pop.style.left = e.clientX + "px"; pop.style.top = e.clientY + "px";
    ctx.root.appendChild(pop); setTimeout(() => pop.remove(), 700);
    update();
    if (caught >= GOAL) end(true);
  });

  function start() {
    caught = 0; left = TIME; playing = true;
    cv.classList.add("on");
    ctx.tray.classList.add("ar-hidden");
    ctx.say("바람이 분다! 흩날리는 꽃잎을 잡아 봐 🌸");
    update();
    tickT = setInterval(() => { left--; update(); if (left <= 0) end(false); }, 1000);
  }
  function update() { ctx.info(`🌸 벚꽃잎 ${caught}/${GOAL} · ⏱ ${left}초`); }
  function end(ok) {
    playing = false;
    cv.classList.remove("on");
    clearInterval(tickT);
    if (ok) {
      ctx.react("love", "벚꽃잎 다 모았다! 봄이 왔어 🌸", 3000);
      ctx.info("벚꽃잎을 모두 모았어! 🎉");
      ctx.complete();
      showRetry("한 번 더 하기");
    } else {
      ctx.say("아쉬워! 다시 해 볼까?");
      ctx.info(`${caught}개 잡았어. 다시 도전!`);
      showRetry("다시 도전");
    }
  }
  function showRetry(label) {
    ctx.tray.innerHTML = `<div class="arm-card"><div class="t">🌸 ${TIME}초 안에 흩날리는 벚꽃잎 ${GOAL}개 잡기</div>
      <div class="arm-row"><button class="arm-btn primary">${label}</button></div></div>`;
    ctx.tray.classList.remove("ar-hidden");
    ctx.tray.querySelector("button").onclick = start;
  }
  showRetry("시작하기");
  ctx.say("벚꽃 나무 아래에서 꽃잎을 잡아 볼까?");
  ctx.info("시작하기를 누르면 바람이 불어요");
  return () => {
    clearInterval(tickT);
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    cv.remove();
    tree.remove();
  };
}

/* ============================================================
   📣 대운동장: 휴대폰 흔들어 응원하기
   ============================================================ */
function cheer(ctx) {
  let gauge = 0, last = null, lastAdd = 0, done = false;
  ctx.tray.innerHTML = `
    <div class="arm-card">
      <div class="t">📣 휴대폰을 흔들어서 응원 게이지를 채워 줘!</div>
      <div class="arm-gauge"><i></i></div>
      <div class="arm-row">
        <button class="arm-btn" data-a="motion">흔들기 켜기</button>
        <button class="arm-btn primary" data-a="tap">응원하기! 👏</button>
      </div>
      <div class="s">흔들기가 안 되면 응원하기 버튼을 연타해도 돼요</div>
    </div>`;
  ctx.tray.classList.remove("ar-hidden");
  const bar = ctx.tray.querySelector(".arm-gauge i");
  ctx.say("오늘 축제 무대 응원해 줄래? 📣");
  ctx.info("휴대폰을 흔들거나 응원하기를 연타해!");

  const add = (n) => {
    if (done) return;
    gauge = Math.min(100, gauge + n);
    bar.style.width = gauge + "%";
    if (gauge >= 100) win();
  };
  function onMotion(e) {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a || a.x == null) return;
    const mag = Math.hypot(a.x, a.y, a.z);
    const now = Date.now();
    if (last != null && Math.abs(mag - last) > 7 && now - lastAdd > 90) { lastAdd = now; add(5); navigator.vibrate?.(15); }
    last = mag;
  }
  async function enableMotion() {
    try {
      if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
        const r = await DeviceMotionEvent.requestPermission();
        if (r !== "granted") throw 0;
      }
      window.addEventListener("devicemotion", onMotion);
      ctx.tray.querySelector('[data-a="motion"]').textContent = "흔들기 켜짐 ✅";
    } catch {
      ctx.toast("흔들기를 쓸 수 없어서 버튼으로 응원해 줘!");
    }
  }
  enableMotion();
  ctx.tray.querySelector('[data-a="motion"]').onclick = enableMotion;
  ctx.tray.querySelector('[data-a="tap"]').onclick = () => { add(6); ctx.jump(); };

  function win() {
    done = true;
    window.removeEventListener("devicemotion", onMotion);
    ctx.react("proud", "최고의 응원이야! 축제 분위기 최고! 🎉", 3000);
    ctx.info("응원 성공! 🎉");
    for (let i = 0; i < 24; i++) {
      const c = el("div", "arm-confetti");
      c.textContent = ["🎉", "🎊", "✨", "📣"][i % 4];
      c.style.left = Math.random() * 100 + "vw";
      c.style.setProperty("--dur", 2 + Math.random() * 2 + "s");
      c.style.setProperty("--dx", (Math.random() * 80 - 40) + "px");
      c.style.setProperty("--rot", (Math.random() * 360) + "deg");
      c.style.animationDelay = Math.random() * 0.6 + "s";
      ctx.root.appendChild(c);
      setTimeout(() => c.remove(), 5000);
    }
    navigator.vibrate?.([100, 50, 100, 50, 200]);
    ctx.complete();
  }
  return () => window.removeEventListener("devicemotion", onMotion);
}

/* ---------------- 공통 ---------------- */
const $stage = (ctx) => ctx.root.querySelector("#ar-stage");
const MISSIONS = { roulette, find, petals, cheer };

// startAR가 호반우를 처음 보여줄 때 부른다. 정리 함수(cleanup)를 돌려준다.
export async function runArMission(type, ctx) {
  injectStyle();
  const fn = MISSIONS[type];
  if (!fn) return () => {};
  return (await fn(ctx)) || (() => {});
}
export const hasArMission = (type) => !!MISSIONS[type];
