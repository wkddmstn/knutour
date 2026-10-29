// js/ar-missions.js — 장소별 AR 미니 미션 (담당: 장주연)
// ar.js의 startAR()가 AR 화면을 띄운 뒤, 미션 종류(mission.ar)에 맞는 놀이를 여기서 붙인다.
//   roulette : 센트럴파크 — 호반우 옆 피크닉 메뉴 돌림판 → 맛집 추천(틀만)
//   find     : 중앙도서관 — 주위에 숨은 추천 도서 찾기 (표지는 직접 그리거나 사진)
//   petals   : 벚꽃길 — 호반우 뒤 벚꽃 나무에서 흩날리는 꽃잎 잡기
//   cheer    : 대운동장 — 휴대폰 흔들어 응원 게이지 채우기
//   heart    : 러브로드 — 화면에 손가락으로 하트를 그려 호반우에게 마음 전하기
//   shop     : 복지관 — 호반우가 말한 개강 준비물을 끌어서 장바구니에 담기
// (snack: 공식당 학식 주기, pet: 쓰다듬기는 ar.js 안에서 처리)
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
  #ar-stage.with-wheel{--wheel:clamp(170px,36vmin,360px);--gap:min(230px,calc(100vw - var(--wheel) - 8px));
    width:calc(var(--gap) + var(--wheel));margin-left:calc((var(--gap) + var(--wheel)) / -2)}
  #ar-stage.with-wheel #ar-jump{right:auto;width:180px}
  #ar-stage.with-wheel #ar-shadow{left:90px}
  #ar-stage.with-wheel #ar-bubble{left:90px}   /* 말풍선은 호반우 머리 위 (돌림판은 오른쪽으로 띄워서 안 겹치게) */
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
  .arm-item.arm-book{width:80px;height:118px;margin:-59px 0 0 -40px;line-height:normal;font-size:inherit;filter:drop-shadow(0 0 10px rgba(255,255,200,.95)) drop-shadow(0 4px 6px rgba(0,0,0,.35))}
  .arm-book img{width:100%;height:100%;object-fit:cover;border-radius:4px 8px 8px 4px}
  .arm-cover{width:100%;height:100%;border-radius:4px 8px 8px 4px;background:linear-gradient(90deg,rgba(0,0,0,.25) 0 8%,transparent 8% 100%),var(--c);
    color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:12px 8px 8px 12px;box-sizing:border-box;text-align:left}
  .arm-cover b{font-size:15px;line-height:1.25;word-break:keep-all}
  .arm-cover small{font-size:10px;opacity:.9}
  /* 벚꽃 나무: 호반우 바로 뒤에 붙어서 같이 움직인다 */
  .arm-tree{position:absolute;left:50%;bottom:-14px;width:min(420px,92vw,52vh);transform:translateX(-50%);z-index:0;pointer-events:none;
    opacity:0;transition:opacity .5s}
  .arm-tree.on{opacity:1}
  .arm-tree img,.arm-tree svg{display:block;width:100%;height:auto}
  .arm-tree svg,.arm-tree img{display:block;width:100%;height:auto}
  .arm-bookinfo{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left}
  .arm-bookinfo img{width:58px;height:86px;object-fit:cover;border-radius:3px 6px 6px 3px;box-shadow:0 3px 8px rgba(0,0,0,.25);flex:none}
  .arm-bookinfo .t{font-size:15px}
  .arm-bookinfo .s{text-align:left;line-height:1.5}
  a.arm-btn{display:block;text-align:center;text-decoration:none;box-sizing:border-box}
  .arm-found{font-size:11px;color:#8b95a1;text-align:center;line-height:1.5}
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
  /* 하트 그리기 */
  .arm-draw{position:absolute;inset:0;width:100%;height:100%;z-index:3;touch-action:none;transition:opacity .5s}
  .arm-draw.fade{opacity:0}
  .arm-guide{position:absolute;left:50%;top:50%;width:min(62vw,260px);transform:translate(-50%,-58%);z-index:3;pointer-events:none;opacity:.75;
    transition:opacity .6s;animation:arm-pulse 1.8s ease-in-out infinite}
  .arm-guide.off{opacity:0;animation:none}
  .arm-fly{position:absolute;z-index:4;font-size:54px;pointer-events:none;transform:translate(-50%,-50%);
    transition:left .7s cubic-bezier(.5,0,.6,1),top .7s cubic-bezier(.5,0,.6,1),transform .7s,opacity .7s}
  /* 장보기 */
  .arm-basket{position:absolute;right:-58px;bottom:6px;width:86px;height:86px;z-index:2;font-size:62px;line-height:86px;text-align:center;
    border-radius:50%;background:rgba(255,255,255,.55);box-shadow:0 4px 12px rgba(0,0,0,.25);transition:transform .15s,background .15s;pointer-events:none}
  .arm-basket.over{transform:scale(1.18);background:rgba(255,240,200,.9)}
  .arm-basket.bump{animation:arm-bump .4s ease-out}
  .arm-basket i{position:absolute;right:-4px;top:-4px;min-width:26px;height:26px;border-radius:13px;background:#d4121a;color:#fff;font-style:normal;
    font-size:14px;font-weight:800;line-height:26px;padding:0 6px;box-sizing:border-box}
  .arm-shop{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;width:100%}
  .arm-shop button{width:auto;margin:0;padding:6px 2px;border:none;border-radius:12px;background:#fff3e0;color:#191f28;font-family:inherit;
    font-size:12px;font-weight:700;display:flex;flex-direction:column;align-items:center;gap:2px;touch-action:none;cursor:grab}
  .arm-shop button b{font-size:30px;line-height:1.1;pointer-events:none}
  .arm-shop button.got{opacity:.35;pointer-events:none}
  .arm-shop button.no{animation:arm-shake .35s}
  .arm-need{font-size:13px;font-weight:800;color:#191f28;text-align:center}
  .arm-need s{color:#b0b8c1}
  .arm-ghost{position:fixed;z-index:10;font-size:54px;transform:translate(-50%,-60%);pointer-events:none;filter:drop-shadow(0 6px 8px rgba(0,0,0,.35))}
  @keyframes arm-bump{40%{transform:scale(1.25) rotate(-8deg)}}
  @keyframes arm-shake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
  @keyframes arm-pulse{0%,100%{transform:translate(-50%,-58%) scale(1)}50%{transform:translate(-50%,-58%) scale(1.04)}}
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
  ctx.say("메뉴 고민돼? 돌림판 돌려 보자!");
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
    ctx.react("proud", `오늘 피크닉은 ${c.name} 어때?`, 2600);
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
  const fallback = [[16, 22], [84, 20], [14, 48], [86, 46], [50, 16]]; // 센서 없을 때 화면 위치(%) — 아래쪽 안내 카드에 가리지 않게 위쪽에
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
      ctx.say("추천 도서 찾았다!");
      progress();
      showBook(bk);
      if (found.length >= total) {
        ctx.react("proud", ctx.mission.tip || "다 찾았다! 도서관에서 빌려 봐", 3200);
        ctx.complete();
      }
    };
    ctx.root.appendChild(d);
    return { d, ang: angles[i], i };
  });

  const progress = () => ctx.info(found.length >= total ? "추천 도서를 모두 찾았어! 🎉" : `주위를 둘러보며 숨은 추천 도서 ${total}권을 찾아봐! (${found.length}/${total})`);
  // 방금 잡은 책 소개 + 지금까지 찾은 책 + "책 빌리러 가기"(경북대 도서관 홈페이지)
  const LIB_URL = ctx.mission.libraryUrl || "https://kudos.knu.ac.kr/pages/index.htm";
  function showBook(bk) {
    ctx.tray.innerHTML = `<div class="arm-card">
      <div class="arm-bookinfo">
        ${bk.img ? `<img src="${bk.img}" alt="">` : ""}
        <div><div class="t">『${bk.title}』</div><div class="s">${bk.author || ""}</div><div class="s">${bk.comment || ""}</div></div>
      </div>
      <div class="arm-found">찾은 추천 도서 ${found.length}/${total} · ${found.map((b) => `『${b.title}』`).join(" ")}</div>
      <a class="arm-btn primary" href="${LIB_URL}" target="_blank" rel="noopener">📚 책 빌리러 가기 (경북대 도서관)</a>
    </div>`;
    ctx.tray.classList.remove("ar-hidden");
  }
  progress();
  ctx.say(`추천 도서 ${total}권이 숨어 있어. 찾아봐!`);

  const W = () => window.innerWidth, H = () => window.innerHeight;
  ctx.onHeading(({ diff, y }) => {
    items.forEach(({ d, ang }) => {
      if (d.classList.contains("got")) return;
      let rel = diff - ang;
      rel = ((rel + 540) % 360) - 180;
      const inView = Math.abs(rel) < ctx.VIEW / 2 + 5;
      d.style.display = inView ? "block" : "none";
      d.style.left = W() / 2 - rel * ctx.PX + "px";
      d.style.top = Math.min(H() * 0.5, H() * 0.36 + y + ((Math.abs(ang) % 3) * 18)) + "px";   // 아래 카드에 가리지 않게
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
  { title: "두고 온 여름", author: "성해나 소설", img: "img/books/book1.jpg",
    comment: "잠시 한 가족이 되었던 두 사람이 함께 보낸 여름과 그 뒤의 시간을 돌아보는 이야기." },
  { title: "저녁의 구애", author: "편혜영 소설집", img: "img/books/book2.jpg",
    comment: "평범한 일상에 스며든 불안과 낯섦을 서늘하게 그려 낸 단편들." },
  { title: "대온실 수리 보고서", author: "김금희 장편소설", img: "img/books/book3.jpg",
    comment: "창경궁 대온실 보수 공사의 기록을 맡은 주인공이 오래 묻어 둔 기억과 마주하는 이야기." },
  { title: "저주토끼", author: "정보라 소설집", img: "img/books/book4.jpg",
    comment: "저주와 복수, 기이한 상상으로 현실의 부조리를 비추는 소설집. 2022 부커상 인터내셔널 최종 후보." },
];
const BOOK_COLORS = ["#2f6fed", "#d4121a", "#0a9d63", "#8d5fd3", "#a86400"];

/* ============================================================
   🌸 벚꽃길: 떨어지는 벚꽃잎 잡기
   ============================================================ */
// 벚꽃 나무: img/hobanu/cherry-tree.webp 일러스트를 쓰고, 못 불러오면 아래 SVG로 대신 그린다.
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

  // 1) 호반우 옆에 큰 벚꽃 나무
  // 나무는 호반우 뒤에 붙여서 같이 움직인다. 그림을 다 불러온 뒤에 넣어서 바뀌며 깜박이지 않게 한다
  const tree = el("div", "arm-tree");
  const png = new Image();
  png.alt = "";
  png.onload = () => { tree.appendChild(png); tree.classList.add("on"); };
  png.onerror = () => { tree.innerHTML = cherryTreeSVG(); tree.classList.add("on"); };
  png.decoding = "async";
  png.src = "img/hobanu/cherry-tree.webp";
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
      size: 9 + Math.random() * 9, ph: Math.random() * Math.PI * 2, a: 0.75 + Math.random() * 0.25,
      c: COLORS[(Math.random() * COLORS.length) | 0],
    });
  }
  const petalImg = new Image();
  petalImg.src = "img/hobanu/petal.png";          // 꽃잎 일러스트 (없으면 아래 도형으로 그림)
  function drawPetal(p) {
    if (petalImg.complete && petalImg.naturalWidth) {
      const s = p.size * 2.3;
      g.save();
      g.translate(p.x * dpr, p.y * dpr);
      g.rotate(p.rot);
      g.scale(dpr, dpr * (0.5 + 0.5 * Math.abs(Math.sin(p.ph))));   // 뒤집히며 떨어지는 느낌
      g.globalAlpha = p.a ?? 1;
      g.drawImage(petalImg, -s / 2, -s / 2 * petalImg.naturalHeight / petalImg.naturalWidth, s, s * petalImg.naturalHeight / petalImg.naturalWidth);
      g.restore();
      return;
    }
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
    spawnAcc += dt * (playing ? 0.0045 : 0.0015);   // 1초에 약 4.5개 (대기 중엔 1.5개)
    while (spawnAcc > 1 && parts.length < 45) { spawn(); spawnAcc -= 1; }
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
    ctx.say("바람이 분다! 꽃잎을 잡아 봐");
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
  ctx.say("벚꽃잎 잡으러 가 볼까?");
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
    ctx.react("proud", "최고의 응원이야! 고마워!", 3000);
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

/* ============================================================
   💗 러브로드: 화면에 하트 그려서 호반우에게 마음 전하기
   ============================================================ */
// 하트 판정: 그린 선을 64개 점으로 고르게 나눈 뒤
//  ① 수학 하트 곡선과 얼마나 가까운지(평균 거리) ② 위 가운데 홈 + 양쪽 볼록 + 아래 뾰족 끝이 있는지 ③ 닫혀 있는지를 본다.
function heartTemplate(n = 64) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2;
    p.push({ x: 16 * Math.sin(t) ** 3, y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) });
  }
  return p;
}
function resample(strokes, n) {
  let L = 0;
  strokes.forEach((s) => { for (let i = 1; i < s.length; i++) L += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y); });
  const out = [];
  if (!L) return out;
  const step = L / (n - 1);
  strokes.forEach((s) => {
    if (!s.length) return;
    out.push({ ...s[0] });
    let prev = s[0], acc = 0;
    for (let i = 1; i < s.length; i++) {
      const q = s[i];
      let d = Math.hypot(q.x - prev.x, q.y - prev.y);
      while (acc + d >= step && d > 0) {
        const k = (step - acc) / d;
        prev = { x: prev.x + k * (q.x - prev.x), y: prev.y + k * (q.y - prev.y) };
        out.push(prev);
        d = Math.hypot(q.x - prev.x, q.y - prev.y);
        acc = 0;
      }
      acc += d;
      prev = q;
    }
  });
  return out;
}
function normBox(p) {
  const xs = p.map((a) => a.x), ys = p.map((a) => a.y);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 || 1, h = Math.max(...ys) - y0 || 1;
  return { pts: p.map((a) => ({ x: (a.x - x0) / w, y: (a.y - y0) / h })), w, h, cx: x0 + w / 2, cy: y0 + h / 2 };
}
let HEART_TPL = null;
// 하트 판정 (완화 버전): 비뚤거나, 홈이 얕거나, 살짝 기울었거나, 덧그려도 웬만하면 통과. 동그라미·세모·별은 실패.
function judgeOnce(pts0) {
  const { pts, w, h, cx, cy } = normBox(pts0);
  if (Math.min(w, h) < 40) return { ok: false, why: "small", cx, cy, w, h };
  if (w / h > 2.8 || h / w > 2.8) return { ok: false, why: "shape", cx, cy, w, h };
  const md = (a, set) => { let m = 9; for (const b of set) m = Math.min(m, Math.hypot(a.x - b.x, a.y - b.y)); return m; };
  const dists = pts.map((a) => md(a, HEART_TPL));
  const score = (dists.reduce((s, d) => s + d, 0) / pts.length
    + HEART_TPL.reduce((s, a) => s + md(a, pts), 0) / HEART_TPL.length) / 2;
  const far = [...dists].sort((x, y) => x - y)[Math.floor(dists.length * 0.9)];   // 낙서처럼 안쪽까지 칠한 건 실패
  const minY = (f) => { const q = pts.filter(f); return q.length ? Math.min(...q.map((a) => a.y)) : 1; };
  const notch = minY((a) => a.x > 0.4 && a.x < 0.6) - Math.max(minY((a) => a.x < 0.35), minY((a) => a.x > 0.65));
  // 양쪽 볼록한 부분: 위쪽 높이(15~50%)에서 좌우 끝까지 퍼져 있어야 한다 (V자는 여기가 좁음)
  const mid = pts.filter((a) => a.y > 0.15 && a.y < 0.5);
  const sideOk = mid.length > 2 && Math.min(...mid.map((a) => a.x)) < 0.14 && Math.max(...mid.map((a) => a.x)) > 0.86;
  const bottom = pts.reduce((b, a) => (a.y > b.y ? a : b));
  // 아래 끝이 뾰족한지: 맨 아래 15% 높이에 있는 점들의 폭이 좁아야 한다 (동그라미는 넓음)
  const low = pts.filter((a) => a.y > 0.85);
  const tipW = low.length ? Math.max(...low.map((a) => a.x)) - Math.min(...low.map((a) => a.x)) : 1;
  const tipOk = bottom.x > 0.2 && bottom.x < 0.8 && tipW < 0.42;
  const notchOk = (notch > 0.015 || (notch > -0.01 && score < 0.05)) && notch < 0.55;
  const ok = score < 0.12 && tipOk && notchOk && sideOk && far < 0.2;
  return { ok, why: ok ? "" : "shape", score, notch, tipW, cx, cy, w, h };
}
const rot = (p, deg) => {
  const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const mx = p.reduce((t, a) => t + a.x, 0) / p.length, my = p.reduce((t, a) => t + a.y, 0) / p.length;
  return p.map((a) => ({ x: mx + (a.x - mx) * c - (a.y - my) * s, y: my + (a.x - mx) * s + (a.y - my) * c }));
};
export function judgeHeart(strokes) {
  HEART_TPL = HEART_TPL || normBox(heartTemplate(64)).pts;
  strokes = strokes.filter((s) => s.length > 1);
  const raw = resample(strokes, 96);
  if (raw.length < 20) return { ok: false, why: "small" };
  let best = null;
  for (const deg of [0, -12, 12, -24, 24]) {     // 살짝 기울여 그린 하트도 인정
    const r = judgeOnce(deg ? rot(raw, deg) : raw);
    if (r.ok) return r;
    if (!best || (r.score ?? 9) < (best.score ?? 9)) best = r;
  }
  return best;
}
// 여러 번 그린 경우: 전체 → 마지막 획 → 마지막 두 획 순서로 하나라도 하트면 성공
export function judgeHeartMulti(strokes) {
  const tries = [strokes];
  if (strokes.length > 1) tries.push(strokes.slice(-1), strokes.slice(-2));
  if (strokes.length > 3) tries.push(strokes.slice(-3));
  let last = null;
  for (const t of tries) { last = judgeHeart(t); if (last.ok) return last; }
  return judgeHeart(strokes);
}

function heart(ctx) {
  const GOAL = ctx.mission.goal || 3;
  let count = 0, strokes = [], cur = null, judgeT = 0, busy = false;

  const cv = el("canvas", "arm-draw");
  ctx.root.appendChild(cv);
  const g = cv.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; redraw(); };

  // 호반우 위에 점선 하트 가이드를 계속 보여 준다
  const guide = el("div", "arm-guide");
  guide.innerHTML = `<svg viewBox="-18 -14 36 33" xmlns="http://www.w3.org/2000/svg"><path d="${
    heartTemplate(48).map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("")}Z"
    fill="rgba(255,111,165,.12)" stroke="#fff" stroke-width=".9" stroke-dasharray="2 1.6" stroke-linecap="round"/></svg>`;
  ctx.root.appendChild(guide);

  function redraw(color = "#ff5c93", fill = false) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath();
    strokes.forEach((s) => s.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))));
    if (fill) { g.fillStyle = "rgba(255,92,147,.55)"; g.fill(); }
    g.shadowColor = color; g.shadowBlur = 14;
    g.strokeStyle = "#fff"; g.lineWidth = 11; g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = color; g.lineWidth = 6; g.stroke();
  }
  resize();
  window.addEventListener("resize", resize);

  const pos = (e) => ({ x: e.clientX, y: e.clientY });
  cv.addEventListener("pointerdown", (e) => {
    if (busy) return;
    clearTimeout(judgeT);
    cv.classList.remove("fade");
    cv.setPointerCapture?.(e.pointerId);
    cur = [pos(e)];
    strokes.push(cur);
    e.preventDefault();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!cur) return;
    const p = pos(e), l = cur[cur.length - 1];
    if (Math.hypot(p.x - l.x, p.y - l.y) < 2) return;
    cur.push(p);
    redraw();
  });
  const up = () => {
    if (!cur) return;
    cur = null;
    clearTimeout(judgeT);
    judgeT = setTimeout(judge, 800);   // 여러 번에 나눠 그리거나 덧그리는 사람도 있어서 잠깐 기다렸다가 판정
  };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);

  const FAIL = {
    small: "조금 더 크게 그려 줘!",
    open: "끝을 처음 점이랑 이어 줘!",
    shape: "아래를 뾰족하게! 덧그려도 돼",
  };
  const LINES = ["고마워! 나도 좋아 💕", "심쿵… 💘", "하트 받았다! 💗", "우리 완전 단짝이야! 💞"];

  function clear(delay) {
    cv.classList.add("fade");
    setTimeout(() => { strokes = []; redraw(); cv.classList.remove("fade"); busy = false; }, delay);
  }
  function judge() {
    const r = judgeHeartMulti(strokes);
    if (!r.ok) {
      // 실패해도 바로 지우지 않는다 → 이어서 덧그리면 다시 판정. 3초 동안 안 그리면 지움
      redraw("#c3a9b5");
      ctx.say(FAIL[r.why] || FAIL.shape);
      navigator.vibrate?.(60);
      if (strokes.length > 6) strokes = strokes.slice(-3);
      judgeT = setTimeout(() => clear(400), 3000);
      return;
    }
    busy = true;
    // 성공: 그린 하트를 채우고, 하트가 호반우에게 날아간다
    redraw("#ff2d78", true);
    navigator.vibrate?.([30, 40, 30]);
    count++;
    const fly = el("div", "arm-fly");
    fly.textContent = "💗";
    fly.style.left = r.cx + "px"; fly.style.top = r.cy + "px";
    fly.style.fontSize = Math.max(40, Math.min(120, r.w * 0.6)) + "px";
    ctx.root.appendChild(fly);
    clear(350);
    const hb = ctx.hob.getBoundingClientRect();
    const hx = hb.width ? hb.left + hb.width / 2 : innerWidth / 2, hy = hb.height ? hb.top + hb.height * 0.4 : innerHeight / 2;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fly.style.left = hx + "px"; fly.style.top = hy + "px";
      fly.style.transform = "translate(-50%,-50%) scale(.4)"; fly.style.opacity = ".2";
    }));
    setTimeout(() => {
      fly.remove();
      for (let i = 0; i < 6; i++) setTimeout(() => ctx.spawnHeart(hx + (Math.random() * 80 - 40), hy + (Math.random() * 40 - 20), ["💗", "💕", "💘"][i % 3]), i * 70);
      if (count >= GOAL && count === GOAL) {
        ctx.react("love", "마음 다 전해졌어! 고마워", 3000);
        ctx.info(`💗 하트 ${GOAL}/${GOAL} · 마음이 전해졌어!`);
        ctx.complete();
        guide.classList.add("off");
        ctx.tray.innerHTML = `<div class="arm-card"><div class="t">💞 하트 ${GOAL}개 전달 성공!</div>
          <div class="s">더 그려도 돼요. 다 했으면 아래 완료를 눌러 주세요</div></div>`;
      } else {
        ctx.react("love", LINES[(count - 1) % LINES.length], 1600);
        if (count < GOAL) update();
      }
    }, 720);
  }
  function update() { ctx.info(`💗 하트 ${count}/${GOAL} · 화면에 하트를 그려 줘!`); }

  ctx.tray.innerHTML = `<div class="arm-card"><div class="t">💗 화면에 손가락으로 하트를 그려서<br>호반우에게 마음을 전해 줘!</div>
    <div class="s">한 번에 이어서 그리면 더 잘 알아봐요 · ${GOAL}번 성공하면 완료</div></div>`;
  ctx.tray.classList.remove("ar-hidden");
  ctx.say("나한테 하트 그려 줄래? 💕");
  update();
  return () => {
    clearTimeout(judgeT);
    window.removeEventListener("resize", resize);
    cv.remove(); guide.remove();
  };
}

/* ============================================================
   🛒 복지관: 호반우 개강 준비물 장보기 (끌어서 장바구니에 담기)
   ============================================================ */
// 지우개 이모티콘이 없어서 흰 직사각형 지우개를 직접 그림
const ERASER = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g transform="rotate(-18 32 32)"><rect x="8" y="20" width="48" height="24" rx="4" fill="#fff" stroke="#8b95a1" stroke-width="2.5"/>
  <rect x="26" y="20" width="20" height="24" fill="#3d7be0"/><rect x="8" y="20" width="48" height="24" rx="4" fill="none" stroke="#5c6670" stroke-width="2.5"/></g></svg>`);
const itemIcon = (it) => (it.img ? `<img src="${it.img}" alt="" style="width:1em;height:1em;vertical-align:-.12em">` : it.e);
const SHOP_ITEMS = {
  note: { n: "공책", e: "📒" }, pen: { n: "볼펜", e: "🖊️" }, book: { n: "전공책", e: "📘" }, eraser: { n: "지우개", e: "", img: ERASER },
  marker: { n: "형광펜", e: "🖍️" }, box: { n: "택배 상자", e: "📦" }, letter: { n: "편지", e: "✉️" }, umbrella: { n: "우산", e: "☂️" },
  water: { n: "생수", e: "💧" }, gimbap: { n: "삼각김밥", e: "🍙" }, card: { n: "체크카드", e: "💳" }, bandage: { n: "밴드", e: "🩹" },
};
// 복지관엔 서점, 우체국, 은행, 학식당 등이 있어서 그에 맞는 부탁들
const SHOP_ORDERS = [
  { say: "공책이랑 볼펜 사 줘!", need: ["note", "pen"] },
  { say: "서점에서 전공책 하나만!", need: ["book"] },
  { say: "형광펜이랑 지우개도 필요해!", need: ["marker", "eraser"] },
  { say: "우체국에 부칠 택배 상자 줘!", need: ["box"] },
  { say: "목말라. 생수랑 삼각김밥!", need: ["water", "gimbap"] },
  { say: "비 온대. 우산 하나만 사 줘!", need: ["umbrella"] },
];
function shop(ctx) {
  const ROUNDS = ctx.mission.rounds || 3;
  const orders = [...SHOP_ORDERS].sort(() => Math.random() - 0.5).slice(0, ROUNDS);
  let round = 0, got = [], total = 0, ghost = null, finished = false;

  const basket = el("div", "arm-basket");
  basket.innerHTML = `🛒<i>0</i>`;
  ctx.inner.appendChild(basket);

  const order = () => orders[round];
  function drawTray() {
    const o = order();
    const decoys = Object.keys(SHOP_ITEMS).filter((k) => !o.need.includes(k)).sort(() => Math.random() - 0.5).slice(0, 5 - o.need.length);
    const list = [...o.need, ...decoys].sort(() => Math.random() - 0.5);
    ctx.tray.innerHTML = `<div class="arm-card">
      <div class="arm-need">🧾 ${o.need.map((k) => got.includes(k) ? `<s>${SHOP_ITEMS[k].n}</s>` : SHOP_ITEMS[k].n).join(" · ")}</div>
      <div class="arm-shop">${list.map((k) => `<button data-k="${k}" class="${got.includes(k) ? "got" : ""}"><b>${itemIcon(SHOP_ITEMS[k])}</b>${SHOP_ITEMS[k].n}</button>`).join("")}</div>
      <div class="s">물건을 끌어서 장바구니에 담아 줘 (눌러도 담겨요)</div></div>`;
    ctx.tray.classList.remove("ar-hidden");
    ctx.tray.querySelectorAll(".arm-shop button").forEach(bindDrag);
  }
  function update() { ctx.info(`🛒 개강 준비물 장보기 ${Math.min(round + 1, ROUNDS)}/${ROUNDS}`); }

  // 장바구니(또는 호반우) 위에 놓았는지
  const overTarget = (x, y) => [basket, ctx.hob].some((t) => {
    const r = t.getBoundingClientRect();
    return r.width && x > r.left - 20 && x < r.right + 20 && y > r.top - 20 && y < r.bottom + 20;
  });
  function bindDrag(btn) {
    let start = null, moved = false;
    btn.addEventListener("pointerdown", (e) => {
      if (finished) return;
      start = { x: e.clientX, y: e.clientY }; moved = false;
      btn.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    btn.addEventListener("pointermove", (e) => {
      if (!start) return;
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) {
        moved = true;
        ghost = el("div", "arm-ghost"); ghost.innerHTML = itemIcon(SHOP_ITEMS[btn.dataset.k]);
        ctx.root.appendChild(ghost);
      }
      if (ghost) {
        ghost.style.left = e.clientX + "px"; ghost.style.top = e.clientY + "px";
        basket.classList.toggle("over", overTarget(e.clientX, e.clientY));
      }
    });
    const end = (e, cancel) => {
      if (!start) return;
      const wasMoved = moved, x = e.clientX, y = e.clientY;
      start = null; moved = false;
      ghost?.remove(); ghost = null;
      basket.classList.remove("over");
      if (cancel) return;
      if (!wasMoved || overTarget(x, y)) put(btn);   // 그냥 눌러도 담긴다
    };
    btn.addEventListener("pointerup", (e) => end(e, false));
    btn.addEventListener("pointercancel", (e) => end(e, true));
  }

  function put(btn) {
    const k = btn.dataset.k, o = order();
    if (!o.need.includes(k)) {
      btn.classList.remove("no"); void btn.offsetWidth; btn.classList.add("no");
      ctx.say(`${SHOP_ITEMS[k].n}? 그건 안 시켰는데?`);
      ctx.jump();
      navigator.vibrate?.(80);
      return;
    }
    if (got.includes(k)) return;
    got.push(k); total++;
    basket.querySelector("i").textContent = total;
    basket.classList.remove("bump"); void basket.offsetWidth; basket.classList.add("bump");
    const r = basket.getBoundingClientRect();
    ctx.spawnHeart(r.left + r.width / 2, r.top, SHOP_ITEMS[k].e || "✨");
    navigator.vibrate?.(30);
    if (o.need.every((n) => got.includes(n))) {
      round++;
      got = [];
      if (round >= ROUNDS) return win();
      ctx.react("proud", "고마워! 하나만 더 부탁해", 1400);
      update();
      setTimeout(() => { if (!finished) { ctx.say(order().say); drawTray(); } }, 1300);
      ctx.tray.querySelectorAll(".arm-shop button").forEach((b) => b.classList.add("got"));
    } else {
      ctx.say(`${SHOP_ITEMS[k].n} 좋아! 나머지도!`);
      drawTray();
    }
  }
  function win() {
    finished = true;
    ctx.react("love", "개강 준비 끝! 고마워", 3000);
    ctx.info("🛒 장보기 완료! 개강 준비 끝 🎉");
    ctx.tray.innerHTML = `<div class="arm-card"><div class="t">🛒 개강 준비물 ${total}개를 다 샀어요!</div>
      <div class="s">복지관엔 서점, 우체국, 은행, 학식당이 있어요</div></div>`;
    ctx.complete();
  }

  update();
  ctx.say(order().say);
  drawTray();
  return () => { ghost?.remove(); basket.remove(); };
}

/* ---------------- 공통 ---------------- */
const $stage = (ctx) => ctx.root.querySelector("#ar-stage");
const MISSIONS = { roulette, find, petals, cheer, heart, shop };

// startAR가 호반우를 처음 보여줄 때 부른다. 정리 함수(cleanup)를 돌려준다.
export async function runArMission(type, ctx) {
  injectStyle();
  const fn = MISSIONS[type];
  if (!fn) return () => {};
  return (await fn(ctx)) || (() => {});
}
export const hasArMission = (type) => !!MISSIONS[type];
