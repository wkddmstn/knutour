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
  .hc-food{display:flex;align-items:center;gap:12px;cursor:pointer;padding:16px 18px}
  .hc-food img{width:52px;height:52px;object-fit:contain;flex:none}
  .hc-food .hc-body{flex:1;min-width:0}
  .hc-food .sum-big{font-size:19px}
  .hc-food .sum-foot{word-break:keep-all}
  .hc-food .chip{white-space:nowrap;flex:none}
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
    <div class="hc-body"><div class="sum-big">배는 항상 고파</div><div class="sum-foot">선배들이 추천하는 맛집 한 번 볼래요?</div></div>
    <button type="button" class="chip primary">맛집 보기</button></div>`;
  const card = slot.firstElementChild;
  card.onclick = onOpen;
  card.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } };
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
