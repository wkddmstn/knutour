// js/home-cards.js — 홈 화면 작은 카드들 (담당: 장주연)
// ① 맛집 카드: "미션 하러 가기" 아래. 누르면 학교 근처 맛집 화면으로 (main.js의 FOOD_ON_HOME 스위치로 끄고 켬)
// ② AR 호반우 만나기 카드: "호반우와 캠퍼스 투어" 아래. 호반우를 골라 AR로 만난다 (장소 미션에서 뺀 AR 호반우가 여기로 옴)
import { MASCOTS, getDex } from "./ar.js";

let styled = false;
function injectStyle() {
  if (styled) return;
  styled = true;
  const s = document.createElement("style");
  s.textContent = `
  .hc-card{display:flex;align-items:center;gap:12px;width:100%;margin:4px 0 14px;padding:14px 16px;border-radius:20px;border:1px solid var(--line,#ece3d8);
    background:var(--card,#fff);color:var(--ink,#241c16);box-shadow:var(--shadow-card,0 6px 18px rgba(0,0,0,.06));font-family:inherit;text-align:left;cursor:pointer}
  .hc-card img{width:56px;height:56px;object-fit:contain;flex:none}
  .hc-card .hc-body{flex:1;min-width:0}
  .hc-card b{display:block;font-size:16px}
  .hc-card span{display:block;font-size:12.5px;color:var(--sub,#6b5f52);margin-top:2px;word-break:keep-all}
  .hc-card em{flex:none;font-style:normal;font-weight:800;font-size:13px;padding:8px 12px;border-radius:12px;background:var(--primary-weak,#fbe7e5);color:var(--primary,#d4121a)}
  .hc-ar{background:linear-gradient(135deg,#fff7e8,#ffeef3)}
  /* 위 "미션 하러 가기" 카드처럼 살짝 비치는 흰 유리 + 같은 Jua 제목 */
  .card.hc-food{display:flex;align-items:center;gap:12px;cursor:pointer;padding:14px 16px;
    background:linear-gradient(160deg,rgba(255,255,255,.82),rgba(255,255,255,.62));
    -webkit-backdrop-filter:blur(18px) saturate(170%);backdrop-filter:blur(18px) saturate(170%);border-color:rgba(255,255,255,.7)}
  .hc-food img{width:50px;height:50px;object-fit:contain;flex:none}
  .hc-food .hc-body{flex:1;min-width:0}
  .hc-food .hc-title{font-family:var(--font);font-size:17px;font-weight:800;line-height:1.3;letter-spacing:-.02em;color:var(--ink)}   /* 아래 작은 글씨와 같은 기본 글꼴, 굵게 */
  .hc-food .hc-sub{margin-top:2px;font-size:13px;color:var(--sub);word-break:keep-all}
  .hc-food .hc-go{flex:none;white-space:nowrap;padding:7px 12px;border-radius:999px;font-size:13px;font-weight:800;
    background:var(--primary-weak);color:var(--primary-dark)}   /* 보조 버튼: 홈의 빨간 꽉 찬 버튼은 "미션 하러 가기" 하나만 */
  @media (prefers-color-scheme:dark){ .hc-food .hc-go{color:#ffb3b7} }
  @media (prefers-color-scheme:dark){ .card.hc-food{background:linear-gradient(160deg,rgba(42,45,52,.78),rgba(42,45,52,.6));border-color:rgba(255,255,255,.09)} }
  #hc-sheet{position:fixed;inset:0;z-index:2200;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}
  #hc-sheet .hs{width:min(560px,100%);max-height:88vh;overflow:auto;background:var(--card,#fff);color:var(--ink,#241c16);border-radius:22px 22px 0 0;
    padding:18px 18px calc(18px + env(safe-area-inset-bottom))}
  #hc-sheet h3{margin:0 0 4px;font-size:18px}
  #hc-sheet p{margin:0 0 12px;font-size:12.5px;color:var(--sub,#6b5f52)}
  #hc-sheet .hs-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  #hc-sheet .hs-grid button{width:auto;margin:0;padding:8px 4px;border:none;border-radius:14px;background:var(--cream-weak,#f3ead9);font-family:inherit;color:inherit;
    display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer}
  #hc-sheet .hs-grid img{width:100%;aspect-ratio:1;object-fit:contain}
  #hc-sheet .hs-grid b{font-size:11.5px;line-height:1.2;word-break:keep-all}
  #hc-sheet .hs-grid small{font-size:10px;color:var(--mute,#9a8c7c)}
  #hc-sheet .hs-grid .new img{filter:brightness(0) opacity(.25)}
  #hc-sheet .hs-close{width:100%;margin:14px 0 0;padding:13px;border:none;border-radius:14px;background:var(--line,#ece3d8);font-weight:800;font-family:inherit;color:inherit}`;
  document.head.appendChild(s);
}

export function renderFoodCard(slot, onOpen) {
  if (!slot) return;
  injectStyle();
  // 바로 아래 "오늘의 퀴즈" 카드와 같은 .card 모양 (유리 카드·테두리) + 오른쪽 작은 빨간 버튼
  slot.innerHTML = `<div class="card hc-food" role="button" tabindex="0" aria-label="학교 근처 맛집 보기">
    <img src="img/mascot/eating.png" alt="">
    <div class="hc-body"><div class="hc-title">항상 배는 고프더라</div><div class="hc-sub">선배들이 추천하는 맛집 한 번 볼래요?</div></div>
    <button type="button" class="hc-go">맛집 보기</button></div>`;
  const card = slot.firstElementChild;
  card.onclick = onOpen;
  card.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } };
}

// 🎉 축제 응원 연습 카드 (관리자가 켰을 때만 홈에): 밤 무대 조명 + 마이크 든 호반우 (장주연)
export function renderFestivalCard(slot, { doneToday = false, reward = 100, onStart } = {}) {
  if (!slot) return;
  injectStyle();
  injectFestStyle();
  const bars = Array.from({ length: 14 }, (_, i) => `<i style="animation-delay:-${(i * 0.17) % 1}s;animation-duration:${0.7 + (i % 5) * 0.12}s"></i>`).join("");
  const dots = Array.from({ length: 12 }, (_, i) => `<b style="left:${(i * 37) % 100}%;top:${(i * 53) % 70}%;animation-delay:-${(i * 0.4) % 2}s"></b>`).join("");
  slot.innerHTML = `<div class="fest-card" role="button" tabindex="0" aria-label="축제 응원 연습 시작">
    <div class="fest-beam b1"></div><div class="fest-beam b2"></div><div class="fest-beam b3"></div>
    <div class="fest-dots" aria-hidden="true">${dots}</div>
    <div class="fest-body">
      <span class="fest-tag">축제 시즌 한정</span>
      <div class="fest-title">축제 응원 연습</div>
      <div class="fest-sub">응원단장 호반우와 휴대폰을 흔들어 응원 게이지를 채워 봐요!</div>
      <button type="button" class="fest-go">${doneToday ? "한 번 더 응원하기" : "응원하러 가기"}${reward ? ` · +${reward} XP` : ""}</button>
      ${doneToday ? `<span class="fest-done">오늘 응원 완료 ✓</span>` : ""}
    </div>
    <img class="fest-hob" src="img/mascot/festival.png" alt="마이크를 든 호반우">
    <div class="fest-eq" aria-hidden="true">${bars}</div>
  </div>`;
  const card = slot.firstElementChild;
  card.onclick = () => onStart?.();
  card.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStart?.(); } };
}
let festStyled = false;
function injectFestStyle() {
  if (festStyled) return;
  festStyled = true;
  const s = document.createElement("style");
  s.textContent = `
  .fest-card{position:relative;overflow:hidden;margin:4px 0 14px;padding:20px 18px 34px;border-radius:24px;cursor:pointer;color:#fff;isolation:isolate;
    background:radial-gradient(120% 90% at 85% 110%,#ff3d7f 0%,transparent 55%),radial-gradient(90% 80% at 0% 0%,#6a3cff 0%,transparent 60%),linear-gradient(160deg,#170f3a,#2b0f4a 55%,#3d0b3a);
    box-shadow:0 16px 32px -14px rgba(106,60,255,.65),inset 0 1px 0 rgba(255,255,255,.15)}
  .fest-beam{position:absolute;top:-40%;width:42%;height:160%;z-index:-1;transform-origin:50% 0;mix-blend-mode:screen;opacity:.55;filter:blur(2px);
    background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,0) 75%);clip-path:polygon(45% 0,55% 0,100% 100%,0 100%)}
  .fest-beam.b1{left:-6%;background:linear-gradient(180deg,rgba(255,214,90,.75),transparent 75%);animation:festSwing 3.2s ease-in-out infinite}
  .fest-beam.b2{left:30%;background:linear-gradient(180deg,rgba(120,200,255,.6),transparent 75%);animation:festSwing 4s ease-in-out infinite reverse}
  .fest-beam.b3{right:-8%;background:linear-gradient(180deg,rgba(255,110,180,.7),transparent 75%);animation:festSwing 3.6s ease-in-out infinite -1s}
  @keyframes festSwing{0%,100%{transform:rotate(-18deg)}50%{transform:rotate(18deg)}}
  .fest-dots b{position:absolute;width:4px;height:4px;border-radius:50%;background:#fff;opacity:.2;animation:festTw 2s ease-in-out infinite;z-index:-1}
  @keyframes festTw{50%{opacity:.9;transform:scale(1.6)}}
  .fest-body{position:relative;max-width:62%}
  .fest-tag{display:inline-block;padding:4px 10px;border-radius:999px;font-size:11.5px;font-weight:800;letter-spacing:.02em;color:#2b0f4a;
    background:linear-gradient(90deg,#ffe066,#ffb3d9);box-shadow:0 0 14px rgba(255,224,102,.6)}
  .fest-title{margin-top:8px;font-size:22px;font-weight:900;line-height:1.25;text-shadow:0 0 18px rgba(255,120,200,.75),0 2px 0 rgba(0,0,0,.25)}
  .fest-sub{margin-top:6px;font-size:13px;line-height:1.5;color:rgba(255,255,255,.85);word-break:keep-all}
  .fest-go{margin-top:12px;padding:9px 14px;border-radius:999px;font-size:13.5px;font-weight:900;color:#2b0f4a;white-space:nowrap;
    background:linear-gradient(90deg,#ffe066,#ff8fc7);box-shadow:0 6px 16px -4px rgba(255,120,200,.7)}
  .fest-done{display:block;margin-top:8px;font-size:12px;font-weight:800;color:#9dffcf}
  .fest-hob{position:absolute;right:-6px;bottom:18px;width:44%;max-width:190px;filter:drop-shadow(0 0 18px rgba(255,140,210,.55));animation:festBop .6s ease-in-out infinite alternate}
  @keyframes festBop{from{transform:translateY(0) rotate(-2deg)}to{transform:translateY(-6px) rotate(2deg)}}
  .fest-eq{position:absolute;left:0;right:0;bottom:0;height:26px;display:flex;align-items:flex-end;gap:3px;padding:0 10px;opacity:.75}
  .fest-eq i{flex:1;height:30%;border-radius:3px 3px 0 0;background:linear-gradient(0deg,#ff3d7f,#ffe066);animation:festEq .8s ease-in-out infinite alternate}
  @keyframes festEq{from{height:15%}to{height:95%}}
  @media (prefers-reduced-motion:reduce){.fest-card *{animation:none!important}}`;
  document.head.appendChild(s);
}

export function renderArCard(slot, { zones = [], meet } = {}) {
  if (!slot) return;
  injectStyle();
  const dex = getDex();
  const ids = Object.keys(MASCOTS);
  const n = ids.filter((i) => dex[i]).length;
  slot.innerHTML = `<button type="button" class="hc-card hc-ar">
    <img src="img/hobanu/react-love.png" alt="">
    <div class="hc-body"><b>AR 호반우 만나기</b><span>카메라 속 호반우를 쓰다듬고 같이 놀아요 · 만난 호반우 ${n} / ${ids.length}</span></div>
    <em>만나기</em></button>`;
  slot.querySelector("button").onclick = () => openSheet(zones, meet, () => renderArCard(slot, { zones, meet }));
}

function openSheet(zones, meet, onDone) {
  const dex = getDex();
  const el = document.createElement("div");
  el.id = "hc-sheet";
  const list = Object.keys(MASCOTS).map((id) => ({ id, m: MASCOTS[id], zone: zones.find((z) => z.id === id) })).filter((x) => x.zone);
  el.innerHTML = `<div class="hs">
    <h3>🐮 어떤 호반우를 만날까?</h3>
    <p>처음 만나는 호반우는 도감에 등록되고 +20 XP! 이미 만난 친구는 언제든 다시 만나 쓰다듬어 줄 수 있어요.</p>
    <div class="hs-grid">${list.map(({ id, m }) => `<button data-id="${id}" class="${dex[id] ? "" : "new"}">
      <img src="${m.img}" alt=""><b>${dex[id] ? m.name : "???"}</b><small>${dex[id] ? "다시 만나기" : m.name}</small></button>`).join("")}</div>
    <button class="hs-close">닫기</button></div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.onclick = (e) => { if (e.target === el) close(); };
  el.querySelector(".hs-close").onclick = close;
  el.querySelectorAll("[data-id]").forEach((b) => (b.onclick = async () => {
    const x = list.find((y) => y.id === b.dataset.id);
    close();
    try { await meet?.(x.zone); } finally { onDone?.(); }
  }));
}