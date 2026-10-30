// js/ar.js — 호반우 AR (담당: 장주연)
//   startAR(zone, { mission })  → Promise<{ met, fed, done, otter }>
//       met: 호반우와 놀았는지 / fed: 학식 주기 성공 / done: AR 미션 성공 / otter: 희귀 수달을 잡았는지
//   openPhotoStudio({ items, start, submit, place }) → 사진 찍기 화면(꾸미기 포함). submit이면 "이 사진으로 제출" → { dataUrl }
//   openDex() / renderHobanuPane(div) / hasMet(id) / photoItemsFor(zoneId)
// AR 미니 미션(돌림판·책 찾기·꽃잎·응원)은 ar-missions.js에 있다.
import { runArMission } from "./ar-missions.js";
import { stickerCatalog, frameSVG, LOGO, logoItem } from "./ar-stickers.js";   // 사진 꾸미기 아이템

const IMG = "img/hobanu/";
// 시연(데모)용: true면 일청담 미션 목록에 "히든 미션!" 버튼이 생겨서 수달을 항상 만날 수 있다. 실제 운영 때는 false로 (장주연)
export const OTTER_DEMO = true;

export const MASCOTS = {
  centralpark:  { name: "센트럴 파크",     img: IMG + "centralpark.png",  lines: ["센팍에 온 걸 환영해! 🌳", "무빔 영화 보러 돗자리 챙겨 와!"] },
  ilcheongdam:  { name: "일청담",          img: IMG + "ilcheongdam.png",  lines: ["일청담은 감꽃 모양을 본떠 만들었어!", "운 좋으면 신천 수달도 만날 수 있어", "밤엔 호롱불이 켜져서 진짜 예뻐!"] },
  library:      { name: "중앙도서관",      img: IMG + "library.png",      lines: ["쉿! 도서관이야 📚", "열람실은 신관, 책은 구관에 있어!", "자리는 도서관 앱으로 예약해!"] },
  stadium:      { name: "대운동장·백호관", img: IMG + "stadium.png",      lines: ["여기가 축제 무대야! 🎤", "올해는 누가 올까? 두근두근!", "백호관엔 중앙동아리방이 모여 있어!"] },
  gongstaurant: { name: "공식당",          img: IMG + "gongstaurant.png", lines: ["배고프지? 🍚", "치즈알밥이랑 육회비빔밥 강추!", "개강 시즌엔 일찍 와야 해!"] },
  loveroad:     { name: "러브로드",        img: IMG + "react-love.png",   lines: ["러브로드에 온 걸 환영해 💕", "손잡고 걸으면 사랑이 이뤄진대!", "친구랑 같이 걸어도 좋아!"] },
  cherryroad:   { name: "벚꽃길",          img: IMG + "loveroad.png",     lines: ["벚꽃길에 온 걸 환영해 🌸", "봄이면 꽃잎이 눈처럼 흩날려!", "여기서 찍으면 인생샷 보장 📸"] },
  bokji:        { name: "복지관",          img: IMG + "bokji.png",        lines: ["복지관엔 뭐가 있을까? 🛍️", "퀴즈 맞힐 수 있겠어?"] },
};
// 희귀 캐릭터 (도감의 "희귀" 칸)
export const RARE = {
  otter: { name: "신천 수달", img: IMG + "otter.png", hint: "일청담에서 '호반우 만나기 (AR)'를 열면 가끔 나타난대요 (밤에 더 자주)" },
};
const DEFAULT = { name: "캠퍼스", img: IMG + "react-hi.png", lines: ["반가워! 나는 호반우야!"] };
const REACT = { love: IMG + "react-love.png", hi: IMG + "react-hi.png", proud: IMG + "react-proud.png" };
// 공식당 특별 미션 메뉴 (직접 찍은 사진)
const SNACKS = {
  gongstaurant: [
    { img: "img/food/albap.jpg",  n: "치즈알밥" },
    { img: "img/food/yukhoe-v2.jpg", n: "육회비빔밥" },
  ],
};
const PET_LINES = ["기분 좋아~ 💕", "헤헤, 간지러워!", "더 쓰다듬어 줘!", "너 좋은 사람이구나!"];

const OFFSET = 0;       // 호반우가 나타나는 방향: 0 = 휴대폰 정면 (숫자를 키우면 그만큼 오른쪽에 숨음)
const VIEW = 60;        // 화면에 보이는 각도 범위
const LOVE_MAX = 5;     // 친밀도 최대치
const DEX_KEY = "knu-hobanu-dex";

/* ---------------- 도감 저장 (이 브라우저에 저장) ---------------- */
export function getDex() {
  try { return JSON.parse(localStorage.getItem(DEX_KEY)) || {}; } catch { return {}; }
}
function saveDex(d) { try { localStorage.setItem(DEX_KEY, JSON.stringify(d)); } catch {} }
function addToDex(id) {
  const d = getDex();
  const isNew = !d[id];
  if (isNew) d[id] = { at: Date.now(), love: 0 };
  saveDex(d);
  return isNew;
}
function addLove(id, n = 1) {
  const d = getDex();
  if (!d[id]) d[id] = { at: Date.now(), love: 0 };
  d[id].love = Math.min(LOVE_MAX, (d[id].love || 0) + n);
  saveDex(d);
  return d[id].love;
}
// 도감에 모은 호반우 목록 (사진 찍기 화면에서 사용)
function collectedItems() {
  const dex = getDex();
  const all = { ...MASCOTS, ...RARE };
  return Object.keys(all).filter((id) => dex[id]).map((id) => ({ id, name: all[id].name, img: all[id].img }));
}
// 사진 미션용: 그 장소 호반우를 맨 앞에 두고, 모은 호반우를 뒤에 붙인다
export function photoItemsFor(zoneId) {
  const items = collectedItems().filter((it) => it.id !== zoneId);
  const m = MASCOTS[zoneId];
  if (m) items.unshift({ id: zoneId, name: m.name, img: m.img });
  return items;
}

/* ---------------- 공통 도구 ---------------- */
const el = (tag) => document.createElement(tag);

// data URL → 파일 (공유 창은 클릭 직후에 열어야 해서 동기 방식으로 만든다)
function dataUrlToFile(url, name) {
  const [head, body] = url.split(",");
  const type = head.match(/:(.*?);/)[1];
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type });
}
/* ---------------- 스타일 ---------------- */
let styled = false;
function injectStyle() {
  if (styled) return;
  styled = true;
  const s = el("style");
  s.textContent = `
  #ar-root{position:fixed;inset:0;z-index:9999;background:#000;overflow:hidden;touch-action:manipulation;font-family:inherit;user-select:none;-webkit-user-select:none}
  #ar-root.nocam{background:linear-gradient(#bfe3ff,#e9f6ff 60%,#cdeac0)}
  #ar-cam{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  #ar-stage{position:absolute;left:50%;top:50%;width:220px;height:260px;margin:-130px 0 0 -110px;display:none;will-change:transform;z-index:2}
  #ar-inner{position:absolute;inset:0}
  #ar-inner.pop{animation:ar-pop .5s ease-out}
  #ar-shadow{position:absolute;bottom:0;left:50%;width:150px;height:28px;margin-left:-75px;border-radius:50%;
    background:radial-gradient(rgba(0,0,0,.5),transparent 70%);animation:ar-shadow 2.4s ease-in-out infinite}
  #ar-jump{position:absolute;left:0;right:0;bottom:18px}
  #ar-jump.jump{animation:ar-jump .45s ease-out}
  #ar-hob{display:block;width:100%;height:230px;object-fit:contain;object-position:bottom;cursor:grab;touch-action:none;-webkit-user-drag:none;
    filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 2px #fff) drop-shadow(0 8px 10px rgba(0,0,0,.35));
    animation:ar-bob 2.4s ease-in-out infinite}
  #ar-bubble{position:absolute;bottom:100%;left:50%;transform:translateX(calc(-50% + var(--bx,0px)));margin-bottom:10px;background:#fff;color:#191f28;
    padding:10px 14px;border-radius:16px;font-size:15px;line-height:1.4;width:max-content;max-width:calc(100vw - 20px);box-shadow:0 4px 12px rgba(0,0,0,.2);
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #ar-bubble::after{content:"";position:absolute;top:100%;left:calc(50% - var(--bx,0px));margin-left:-8px;border:8px solid transparent;border-top-color:#fff}
  #ar-fx{position:absolute;inset:0;pointer-events:none;z-index:3}
  .ar-heart{position:fixed;font-size:26px;pointer-events:none;animation:ar-heart 1s ease-out forwards}
  #ar-top{position:absolute;top:max(18px,env(safe-area-inset-top));left:16px;right:16px;text-align:center;z-index:4}
  #ar-info{color:#fff;font-size:17px;font-weight:600;text-shadow:0 0 6px #000}
  #ar-love{display:inline-block;margin-top:8px;padding:4px 12px;border-radius:999px;background:rgba(0,0,0,.4);color:#fff;font-size:13px}
  #ar-toast{position:absolute;left:50%;top:38%;transform:translateX(-50%);z-index:5;padding:10px 16px;border-radius:14px;
    background:rgba(25,31,40,.85);color:#fff;font-size:15px;font-weight:700;white-space:nowrap;animation:ar-toast 1.8s forwards}
  #ar-tray{position:absolute;left:16px;right:16px;bottom:calc(max(24px,env(safe-area-inset-bottom)) + 62px);z-index:4;
    background:rgba(255,255,255,.94);border-radius:16px;padding:10px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
  .ar-tray-title{width:100%;text-align:center;font-size:13px;font-weight:700;color:#191f28}
  .ar-snack{width:auto;margin:0;flex:1;min-width:120px;display:flex;align-items:center;justify-content:center;gap:8px;padding:8px;border:none;
    border-radius:14px;background:#fff3e0;color:#191f28;font-size:15px;font-weight:700;touch-action:none;cursor:grab}
  .ar-snack img{width:52px;height:52px;border-radius:50%;object-fit:cover;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.2)}
  .ar-ghost{position:fixed;width:84px;height:84px;border-radius:50%;object-fit:cover;transform:translate(-50%,-50%);pointer-events:none;
    z-index:10;box-shadow:0 6px 16px rgba(0,0,0,.35);border:3px solid #fff}
  #ar-bar{position:absolute;left:16px;right:16px;bottom:max(24px,env(safe-area-inset-bottom));display:flex;gap:8px;justify-content:center;z-index:4}
  .ar-btn{width:auto;margin:0;display:inline-block;text-align:center;padding:13px 18px;border:none;border-radius:14px;font-size:16px;font-weight:600;background:rgba(255,255,255,.92);color:#191f28}
  .ar-btn.primary{background:#d4121a;color:#fff}
  #ar-root .ar-hidden,#hob-dex .ar-hidden,#ps-root .ar-hidden{display:none !important}
  #ar-otter{position:absolute;left:-72px;bottom:4px;width:98px;cursor:pointer;touch-action:manipulation;z-index:2;
    filter:drop-shadow(0 0 6px #fff7b0) drop-shadow(0 0 3px #fff) drop-shadow(0 6px 8px rgba(0,0,0,.35));
    animation:ar-otter-in .7s ease-out, ar-bob 1.8s ease-in-out .7s infinite}
  #ar-otter.hop{animation:ar-otter-hop .5s ease-out}
  #ar-otter.spin{animation:ar-otter-spin .8s ease-in-out}
  #ar-otter-say{position:absolute;left:-76px;bottom:104px;transform:translateX(-10%);z-index:3;background:#fff8d6;color:#5a3d00;padding:6px 10px;
    border-radius:12px;font-size:13px;font-weight:700;white-space:nowrap;box-shadow:0 3px 8px rgba(0,0,0,.2);pointer-events:none}
  #ar-otter-say::after{content:"";position:absolute;top:100%;left:26px;border:6px solid transparent;border-top-color:#fff8d6}
  @keyframes ar-otter-hop{40%{transform:translateY(-26px) rotate(-6deg)}70%{transform:translateY(0) rotate(4deg)}}
  @keyframes ar-otter-spin{50%{transform:translateY(-20px) rotate(180deg) scale(1.1)}100%{transform:rotate(360deg)}}
  /* 큰 수달: 아래 버튼 줄 바로 위에서 쏙 올라온다. 크기는 폭(폰)과 높이(PC) 둘 다로 제한 */
  #ar-sudal{position:absolute;left:50%;bottom:calc(max(24px,env(safe-area-inset-bottom)) + 58px);
    width:min(92vw,420px,calc(38vh * 1.56));transform:translate(-50%,40px);opacity:0;z-index:3;pointer-events:none;
    transition:transform .5s cubic-bezier(.2,1.3,.4,1),opacity .35s}
  #ar-sudal.up{transform:translate(-50%,0);opacity:1}
  #ar-sudal img{display:block;width:100%;height:auto;-webkit-mask-image:linear-gradient(#000 78%,transparent);mask-image:linear-gradient(#000 78%,transparent)}
  #ar-sudal p{position:absolute;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%);margin:0;background:#fff;color:#5a3d00;padding:10px 16px;
    border-radius:16px;font-size:16px;font-weight:800;white-space:nowrap;
    box-shadow:0 4px 12px rgba(0,0,0,.25);transition:opacity .2s}
  #ar-sudal:not(.up) p{opacity:0}
  #ar-sudal p::after{content:"";position:absolute;top:100%;left:50%;margin-left:-8px;border:8px solid transparent;border-top-color:#fff}
  #ar-otter.flee{animation:ar-otter-out .9s ease-in forwards;pointer-events:none}
  @keyframes ar-otter-in{from{transform:translateY(70px) scale(.6);opacity:0}to{transform:none;opacity:1}}
  @keyframes ar-otter-out{to{transform:translateY(90px) scale(.5);opacity:0}}
  .dex-rare-title{margin:16px 0 8px;font-size:14px;font-weight:800;color:#a86400}
  .dex-item.rare{background:linear-gradient(135deg,#fff7d6,#ffe9f2)}
  @keyframes ar-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
  @keyframes ar-shadow{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(.8);opacity:.55}}
  @keyframes ar-pop{0%{transform:scale(0)}70%{transform:scale(1.15)}100%{transform:scale(1)}}
  @keyframes ar-jump{0%{transform:translateY(0)}40%{transform:translateY(-40px)}100%{transform:translateY(0)}}
  @keyframes ar-heart{0%{opacity:1;transform:translate(-50%,-50%) scale(.6)}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),-130px) scale(1.2)}}
  @keyframes ar-toast{0%{opacity:0;transform:translate(-50%,10px)}15%,80%{opacity:1;transform:translate(-50%,0)}100%{opacity:0}}

  .hob-pane{display:flex;flex-direction:column;gap:12px}
  .hob-photo-cta{width:100%;margin:0;display:flex;align-items:center;gap:12px;padding:12px 16px;border:none;border-radius:18px;
    background:linear-gradient(135deg,#d4121a,#ff5a5f);color:#fff;text-align:left;font-family:inherit;box-shadow:0 6px 16px rgba(212,18,26,.25)}
  .hob-photo-cta img{width:52px;height:52px;object-fit:contain;flex:none}
  .hob-photo-cta span{display:flex;flex-direction:column;gap:2px}
  .hob-photo-cta b{font-size:16px}
  .hob-photo-cta small{font-size:12px;opacity:.9}
  .dex-inline{background:#fff;color:#191f28;border-radius:18px;padding:16px}
  #hob-dex{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}
  .dex-card{width:100%;max-width:480px;max-height:88vh;overflow:auto;background:#fff;color:#191f28;border-radius:22px 22px 0 0;
    padding:18px 16px calc(20px + env(safe-area-inset-bottom))}
  .dex-head{display:flex;align-items:center;gap:8px;font-size:18px}
  .dex-head span{color:#d4121a;font-weight:700}
  .dex-x{display:block;padding:0;text-align:center;margin:0 0 0 auto;border:none;background:#f2f4f6;color:#191f28;border-radius:50%;width:32px;height:32px;font-size:15px}
  .dex-bar{height:8px;background:#f2f4f6;border-radius:4px;margin:12px 0 6px;overflow:hidden}
  .dex-bar i{display:block;height:100%;background:#d4121a;border-radius:4px}
  .dex-sub{margin:4px 0 12px;font-size:13px;color:#6b7684}
  .dex-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
  .dex-item{background:#f7f8fa;border-radius:16px;padding:10px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center}
  .dex-item img{width:100%;height:110px;object-fit:contain}
  .dex-item b{font-size:14px}
  .dex-item small{font-size:12px;color:#6b7684;min-height:16px}
  .dex-item.locked img{filter:brightness(0) opacity(.15)}

  #ps-root{position:fixed;inset:0;z-index:10000;background:#000;color:#fff;overflow:hidden;font-family:inherit;
    user-select:none;-webkit-user-select:none}
  #ps-root button{font-family:inherit;margin:0}
  #ps-frame{position:absolute;overflow:hidden;background:#000;touch-action:none;cursor:move;border-radius:4px;transition:all .2s}
  #ps-frame.nocam{background:linear-gradient(#bfe3ff,#e9f6ff 60%,#cdeac0)}
  #ps-cam{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform-origin:center}
  #ps-hob{position:absolute;pointer-events:none;-webkit-user-drag:none;filter:drop-shadow(0 6px 8px rgba(0,0,0,.3))}
  #ps-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
  #ps-flash.on{animation:ps-flash .35s ease-out}
  .ps-glass{background:rgba(0,0,0,.38);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
  .ps-topbar{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;
    padding:max(14px,env(safe-area-inset-top)) 14px 0;z-index:3;pointer-events:none}
  .ps-topbar>*{pointer-events:auto}
  .ps-round{width:40px;height:40px;border-radius:50%;border:none;color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;padding:0}
  .ps-pill{width:auto;border:none;border-radius:999px;color:#fff;font-size:13px;font-weight:700;padding:9px 16px}
  .ps-rail{position:absolute;right:10px;top:calc(max(14px,env(safe-area-inset-top)) + 58px);display:flex;flex-direction:column;gap:16px;z-index:3}
  .ps-tool{width:auto;display:flex;flex-direction:column;align-items:center;gap:4px;border:none;background:none;color:#fff;font-size:11px;font-weight:700;
    text-shadow:0 1px 3px rgba(0,0,0,.7);padding:0}
  .ps-tool i{font-style:normal;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:19px}
  .ps-tip{position:absolute;left:50%;top:calc(max(14px,env(safe-area-inset-top)) + 58px);transform:translateX(-50%);z-index:3;padding:8px 14px;
    border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap;animation:ps-tip 4s forwards;pointer-events:none}
  .ps-bottom{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:40px 0 max(18px,env(safe-area-inset-bottom));
    background:linear-gradient(transparent,rgba(0,0,0,.6))}
  .ps-zooms{display:flex;justify-content:center;gap:8px;margin-bottom:12px}
  .ps-zchip{width:auto;min-width:38px;height:38px;border-radius:50%;border:none;color:#fff;font-size:12px;font-weight:800;padding:0 4px;transition:transform .15s}
  .ps-zchip.on{color:#ffd60a;transform:scale(1.15)}
  .ps-carousel{display:flex;gap:14px;overflow-x:auto;padding:6px calc(50% - 30px);scroll-snap-type:x mandatory;scrollbar-width:none}
  .ps-carousel::-webkit-scrollbar{display:none}
  .ps-item{flex:none;scroll-snap-align:center;width:54px;height:54px;border-radius:50%;border:none;background:rgba(255,255,255,.2);padding:6px;transition:transform .15s,background .15s}
  .ps-item.on{transform:scale(1.18);background:#fff;box-shadow:0 0 0 3px #d4121a}
  .ps-item img{width:100%;height:100%;object-fit:contain;pointer-events:none}
  .ps-name{text-align:center;font-size:13px;font-weight:700;margin:8px 0 12px;text-shadow:0 1px 4px #000}
  .ps-shootrow{display:flex;align-items:center;justify-content:space-between;padding:0 36px}
  .ps-thumb{width:48px;height:48px;border-radius:12px;border:2px solid #fff;background:#222 center/cover no-repeat;padding:0}
  .ps-thumb.empty{visibility:hidden}
  #ps-shutter{width:80px;height:80px;border-radius:50%;border:5px solid #fff;background:rgba(255,255,255,.2);padding:0;
    display:flex;align-items:center;justify-content:center}
  #ps-shutter::after{content:"";width:62px;height:62px;border-radius:50%;background:#fff;transition:transform .1s}
  #ps-shutter:active::after{transform:scale(.85)}
  .ps-spacer{width:48px;height:48px}
  .ps-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;color:#ddd;
    font-size:15px;line-height:1.7;padding:24px;pointer-events:none}   /* 안내 글자가 ✕ 버튼을 가리지 않게 */
  .ps-empty button{pointer-events:auto;width:auto;margin:0;padding:12px 22px;border:none;border-radius:999px;background:#fff;color:#191f28;font-weight:800;font-size:15px;font-family:inherit}
  #ps-review{position:absolute;inset:0;z-index:5;background:#000;display:flex;align-items:center;justify-content:center}
  #ps-review img{max-width:100%;max-height:100%;object-fit:contain;-webkit-touch-callout:default;user-select:auto;-webkit-user-select:auto}
  .ps-rv-top{position:absolute;top:max(14px,env(safe-area-inset-top));left:14px}
  .ps-rv-bar{position:absolute;left:0;right:0;bottom:0;padding:24px 16px max(20px,env(safe-area-inset-bottom));
    background:linear-gradient(transparent,rgba(0,0,0,.75));display:flex;flex-direction:column;align-items:center;gap:10px}
  .ps-rv-row{display:flex;gap:10px;justify-content:center}
  .ps-rv-row + .ps-rv-row{margin-top:8px}
  .ps-rv-btn{width:auto;display:flex;align-items:center;gap:6px;border:none;border-radius:999px;padding:12px 18px;font-size:15px;font-weight:700;
    color:#fff;white-space:nowrap}
  .ps-rv-btn.primary{background:#fff;color:#191f28}
  .ps-rv-hint{margin:0;font-size:12px;color:#ddd;text-align:center;line-height:1.5;max-width:320px}
  .ps-toast{position:absolute;left:50%;top:45%;transform:translateX(-50%);z-index:6;padding:10px 18px;border-radius:14px;
    background:rgba(25,31,40,.85);color:#fff;font-size:15px;font-weight:700;white-space:nowrap;animation:ar-toast 1.8s forwards}
  /* ---- 가로 모드: 도구는 왼쪽, 호반우 목록·셔터는 오른쪽 세로 줄, 줌은 셔터 옆 ---- */
  #ps-root.land .ps-rail{right:auto;left:max(14px,env(safe-area-inset-left));top:calc(max(12px,env(safe-area-inset-top)) + 52px);gap:8px}
  #ps-root.land .ps-tool{font-size:10px}
  #ps-root.land .ps-tool i{width:36px;height:36px;font-size:16px}
  #ps-root.land .ps-topbar{right:150px}
  #ps-root.land .ps-tip{left:calc(50% - 75px)}
  #ps-root.land .ps-bottom{left:auto;top:0;right:0;bottom:0;width:150px;
    padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) 12px;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:linear-gradient(90deg,transparent,rgba(0,0,0,.6))}
  #ps-root.land .ps-zooms{position:absolute;right:calc(100% - 4px);top:50%;transform:translateY(-50%);flex-direction:column;margin:0;gap:6px}
  #ps-root.land .ps-zchip{min-width:34px;height:34px;font-size:11px}
  #ps-root.land .ps-carousel{flex-direction:column;overflow-x:hidden;overflow-y:auto;max-height:calc(100% - 140px);padding:8px 6px;gap:10px;scroll-snap-type:y mandatory}
  #ps-root.land .ps-item{width:44px;height:44px}
  #ps-root.land .ps-name{display:none}
  #ps-root.land .ps-shootrow{flex-direction:column;gap:10px;padding:0}
  #ps-root.land .ps-shootrow .ps-spacer{display:none}
  #ps-root.land #ps-shutter{width:66px;height:66px}
  #ps-root.land #ps-shutter::after{width:50px;height:50px}
  #ps-root.land .ps-thumb{width:40px;height:40px;order:2}
  #ps-root.land .ps-rv-bar{padding-top:12px}
  #ps-root.land .ps-rv-hint{display:none}
  /* ---- 가로 모드: AR 만나기 화면 ---- */
  @media (orientation:landscape) and (max-height:520px){
    #ar-stage{top:60%;width:160px;height:180px;margin:-90px 0 0 -80px}
    #ar-hob{height:155px}
    #ar-bubble{font-size:14px;padding:8px 12px}
    #ar-shadow{width:120px;margin-left:-60px}
    #ar-top{top:max(10px,env(safe-area-inset-top))}
    #ar-tray{left:auto;right:max(16px,env(safe-area-inset-right));width:300px;bottom:calc(max(12px,env(safe-area-inset-bottom)) + 56px)}
    #ar-bar{bottom:max(12px,env(safe-area-inset-bottom))}
    .ar-btn{padding:10px 16px;font-size:15px}
    .ar-snack img{width:40px;height:40px}
  }
  /* ---- 사진 꾸미기 (스티커·프레임) ---- */
  #ps-hob{z-index:1}
  .ps-stk{position:absolute;z-index:2;pointer-events:none;-webkit-user-drag:none;filter:drop-shadow(0 3px 5px rgba(0,0,0,.25))}
  #ps-frameimg{position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none}
  #ps-root .ps-sel{outline:2px dashed rgba(255,255,255,.95);outline-offset:4px}
  #ps-del{position:absolute;z-index:4;width:30px;height:30px;margin:-15px 0 0 -15px;padding:0;border-radius:50%;border:2px solid #fff;
    background:#B21B1D;color:#fff;font-size:14px;font-weight:900;display:none;box-shadow:0 2px 6px rgba(0,0,0,.4)}
  #ps-deco{position:absolute;left:0;right:0;bottom:0;z-index:6;background:#fff;color:#191f28;border-radius:20px 20px 0 0;
    padding:12px 14px max(16px,env(safe-area-inset-bottom));max-height:48vh;display:flex;flex-direction:column;gap:10px;box-shadow:0 -6px 20px rgba(0,0,0,.35)}
  #ps-root.land #ps-deco{right:150px;max-height:70vh}
  .ps-deco-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .ps-deco-tab{width:auto;border:none;border-radius:999px;padding:7px 12px;background:#f2f4f6;color:#4e5968;font-size:13px;font-weight:700}
  .ps-deco-tab.on{background:#B21B1D;color:#fff}
  .ps-deco-done{width:auto;margin-left:auto !important;border:none;border-radius:999px;padding:7px 14px;background:#1D1A17;color:#fff;font-size:13px;font-weight:700}
  .ps-deco-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px;overflow-y:auto;padding-bottom:4px}
  .ps-deco-item{width:auto;border:none;background:#f7f8fa;border-radius:12px;padding:6px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;
    font-size:10px;font-weight:600;color:#4e5968;line-height:1.2;text-align:center}
  .ps-deco-item img{width:100%;height:56px;object-fit:contain;pointer-events:none}
  .ps-deco-item img.ps-frameprev{height:auto;object-fit:fill;background:linear-gradient(160deg,#8b95a1,#4e5968);border-radius:3px;box-shadow:0 1px 4px rgba(0,0,0,.25)}
  .ps-deco-item .ps-deco-none{height:84px}
  .ps-deco-item:has(.ps-frameprev),.ps-deco-item:has(.ps-deco-none){justify-content:flex-end;min-height:112px}
  .ps-deco-item.on{box-shadow:inset 0 0 0 2px #B21B1D;background:#fff1f1}
  .ps-deco-none{height:56px;display:flex;align-items:center;justify-content:center;font-size:22px;color:#b0b8c1}
  .ps-logo-colors{grid-column:1/-1;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0 4px}
  .ps-logo-sw{width:auto;flex:none;border:none;background:none;padding:2px 4px;display:flex;flex-direction:column;align-items:center;gap:3px;
    font-size:11px;font-weight:700;color:#4e5968;font-family:inherit}
  .ps-logo-sw i{width:28px;height:28px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}
  .ps-logo-sw.on i{box-shadow:0 0 0 2px #fff,0 0 0 4px #B21B1D}
  .ps-logo-sw.on{color:#B21B1D}
  .ps-deco-item.dark{background:#4e5968;color:#fff}
  .ps-deco-hint{font-size:11px;color:#8b95a1;margin:0}
  @keyframes ps-tip{0%,80%{opacity:1}100%{opacity:0}}
  @keyframes ps-flash{0%{opacity:.9}100%{opacity:0}}`;
  document.head.appendChild(s);
}

/* ============================================================
   1) AR 화면 — 장소에 도착하면 호반우를 찾고 함께 놀기
   ============================================================ */
export function startAR(zone, opts = {}) {
  injectStyle();
  const id = zone.id;
  const m = zone.mascot || MASCOTS[id] || DEFAULT;
  const collectible = !!MASCOTS[id];
  const mission = opts.mission || null;            // zones.json의 AR 미션 (type: "ar", ar: "roulette" 등)
  const mtype = mission?.ar || null;
  const snacks = mtype === "snack" ? (SNACKS[id] || SNACKS.gongstaurant) : null;
  const PET_GOAL = 16;
  // 일청담 희귀 수달: 낮 5%, 밤(18시~6시) 15%.
  // 히든 미션(opts.hidden === "otter")이거나 주소 끝에 ?otter=1 을 붙이면 무조건 등장
  const hiddenOtter = opts.hidden === "otter";
  const otterChance = () => {
    if (hiddenOtter || new URLSearchParams(location.search).get("otter") === "1") return 1;
    const h = new Date().getHours();
    return h >= 18 || h < 6 ? 0.15 : 0.05;
  };
  const otterPlanned = id === "ilcheongdam" && Math.random() < otterChance();

  return new Promise((resolve) => {
    const root = el("div");
    root.id = "ar-root";
    root.innerHTML = `
      <video id="ar-cam" autoplay playsinline muted></video>
      <div id="ar-stage">
        <div id="ar-inner">
          <div id="ar-bubble" class="ar-hidden"></div>
          <div id="ar-shadow"></div>
          <div id="ar-jump"><img id="ar-hob" src="${m.img}" alt="호반우" draggable="false"></div>
          ${otterPlanned ? `<img id="ar-otter" class="ar-hidden" src="${RARE.otter.img}" alt="수달" draggable="false">` : ""}
        </div>
      </div>
      <div id="ar-fx"></div>
      <div id="ar-top"><div id="ar-info"></div><div id="ar-love" class="ar-hidden"></div></div>
      <div id="ar-tray" class="ar-hidden"></div>
      <div id="ar-bar">
        <button id="ar-sensor" class="ar-btn ar-hidden">📡 움직임 켜기</button>
        <button id="ar-shot" class="ar-btn primary ar-hidden">📸 같이 찍기</button>
        <button id="ar-close" class="ar-btn">닫기</button>
      </div>`;
    document.body.appendChild(root);
    const $ = (x) => root.querySelector("#" + x);
    const hob = $("ar-hob");

    const PX = window.innerWidth / VIEW;
    let stream = null, target = null, raf = 0, closed = false;
    let visible = false, gotSensor = false, met = false, fed = false, done = false, otter = false;
    let missionStarted = false, cleanupMission = null, otterShown = false, otterTimer = 0;
    const headingFns = [];
    let lineIdx = 0, petDist = 0, petCount = 0, reactTimer = 0;
    const pos = { x: 0, y: 0 }, cur = { x: 0, y: 0 };

    const info = (t) => { $("ar-info").textContent = t; };
    info(mission ? `${mission.title} · 주위를 둘러보며 호반우를 찾아봐!`
      : hiddenOtter ? "히든 미션! 일청담 어딘가에 신천 수달이 숨어 있대"
      : `${zone.name || m.name}에 호반우가 숨어 있어! 주위를 둘러봐`);
    renderLove();

    /* 카메라: "호반우 만나기"를 누른 순간 바로 켠다 (안 되면 하늘색 배경) */
    async function startCam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (closed) { stopCam(); return; }
        root.classList.remove("nocam");
        $("ar-cam").classList.remove("ar-hidden");
        $("ar-cam").srcObject = stream;
      } catch {
        root.classList.add("nocam");
        $("ar-cam").classList.add("ar-hidden");
      }
    }
    function stopCam() {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    startCam();

    /* 방향 센서: 아이폰은 권한 요청이 필요. 자동 요청이 막히면 "움직임 켜기" 버튼으로 다시 요청 */
    async function startSensors(fromButton) {
      try {
        if (typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission === "function") {
          const r = await DeviceOrientationEvent.requestPermission();
          if (r !== "granted") throw new Error("denied");
        }
        window.addEventListener("deviceorientation", onTurn);
        $("ar-sensor").classList.add("ar-hidden");
      } catch {
        $("ar-sensor").classList.remove("ar-hidden");
        if (fromButton) info("설정에서 동작 권한을 허용하면 더 실감 나게 볼 수 있어!");
      }
    }
    $("ar-sensor").onclick = () => startSensors(true);
    startSensors(false);

    raf = requestAnimationFrame(loop);
    // 센서가 없는 기기(PC 등)면 화면 가운데에 바로 등장
    setTimeout(() => { if (!gotSensor && !visible && !closed) show(); }, 1500);

    // 휴대폰 방향 → 호반우 화면 위치 (공간에 서 있는 것처럼)
    function onTurn(e) {
      let heading = e.webkitCompassHeading;                            // 아이폰
      if (heading == null && e.alpha != null) heading = 360 - e.alpha; // 안드로이드
      if (heading == null) return;
      gotSensor = true;
      // 이미 화면에 떠 있으면 그 자리(정면)를 기준으로 고정
      if (target === null) target = (heading + (visible ? 0 : OFFSET)) % 360;

      const diff = ((heading - target + 540) % 360) - 180;
      pos.x = -diff * PX;
      pos.y = Math.max(-200, Math.min(200, ((e.beta ?? 90) - 90) * PX));

      // 화면 가장자리에서 보였다 안 보였다 반복(깜박임)하지 않게 나타날 때/사라질 때 기준을 다르게 둔다
      const ad = Math.abs(diff);
      if (!visible && ad < VIEW / 2 + 10) show();
      else if (visible && ad > VIEW / 2 + 28) hide();
      headingFns.forEach((fn) => fn({ diff, y: pos.y }));
    }

    function loop() {
      cur.x += (pos.x - cur.x) * 0.15;
      cur.y += (pos.y - cur.y) * 0.15;
      $("ar-stage").style.transform = `translate(${cur.x}px, ${cur.y}px)`;
      raf = requestAnimationFrame(loop);
    }

    function show() {
      visible = true;
      $("ar-stage").style.display = "block";
      const inner = $("ar-inner");
      if (Date.now() - (show.last || 0) > 1500) { inner.classList.remove("pop"); void inner.offsetWidth; inner.classList.add("pop"); }
      show.last = Date.now();
      navigator.vibrate?.(150);
      $("ar-shot").classList.remove("ar-hidden");
      if (!met && !mission && !hiddenOtter) info("호반우 발견! 눌러 보거나 쓰다듬어 봐 👆");
      if (mission && !missionStarted) startMission();
      if (otterPlanned && !otterShown) { otterShown = true; setTimeout(showOtter, hiddenOtter ? 1500 : 2500); }
    }

    function hide() {
      visible = false;
      $("ar-stage").style.display = "none";
      if (!mission) info("주위를 천천히 둘러봐...");   // 미션 중에는 진행 상황 문구를 유지
    }

    /* ---------- 상호작용 공통 ---------- */
    // 호반우 말풍선: 이모티콘은 빼고 한 줄로. 화면보다 길면 글자 크기를 줄인다
    const noEmoji = (t) => String(t).replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D]/gu, "").replace(/\s{2,}/g, " ").trim();
    function say(line) {
      const b = $("ar-bubble");
      b.textContent = noEmoji(line);
      b.style.fontSize = "";
      b.classList.remove("ar-hidden");
      for (let fs = 15; fs > 11 && b.scrollWidth > b.clientWidth + 1; fs--) b.style.fontSize = fs - 1 + "px";
      // 말할 때 화면 밖으로 잘리면 안쪽으로 밀어 준다 (꼬리는 호반우를 계속 가리킴)
      b.style.setProperty("--bx", "0px");
      const r = b.getBoundingClientRect();
      const dx = r.left < 8 ? 8 - r.left : r.right > innerWidth - 8 ? innerWidth - 8 - r.right : 0;
      if (dx && r.width < innerWidth - 16) b.style.setProperty("--bx", dx + "px");
    }
    function jump() {
      const j = $("ar-jump");
      j.classList.remove("jump"); void j.offsetWidth; j.classList.add("jump");
    }
    function react(kind, line, ms = 1400) {
      hob.src = REACT[kind];
      say(line);
      jump();
      clearTimeout(reactTimer);
      reactTimer = setTimeout(() => { hob.src = m.img; }, ms);
    }
    function toast(t) {
      $("ar-toast")?.remove();
      const d = el("div"); d.id = "ar-toast"; d.textContent = t;
      root.appendChild(d);
      setTimeout(() => d.remove(), 1900);
    }
    function spawnHeart(x, y, ch = "💗") {
      const h = el("span");
      h.className = "ar-heart";
      h.textContent = ch;
      h.style.left = x + "px";
      h.style.top = y + "px";
      h.style.setProperty("--dx", (Math.random() * 70 - 35) + "px");
      $("ar-fx").appendChild(h);
      setTimeout(() => h.remove(), 1000);
    }
    function renderLove() {
      const d = getDex()[id];
      if (!collectible || !d) return;
      const n = d.love || 0;
      $("ar-love").textContent = `친밀도 ${"💗".repeat(n)}${"🤍".repeat(LOVE_MAX - n)}`;
      $("ar-love").classList.remove("ar-hidden");
    }
    function markMet() {
      if (met) return;
      met = true;
      if (collectible && addToDex(id)) toast("📖 도감에 등록됐어!");
      renderLove();
    }

    /* ---------- AR 미션 ---------- */
    function complete() {
      if (done) return;
      done = true;
      markMet();
      setTimeout(() => toast("✅ 미션 성공!"), 400);
      const c = $("ar-close");
      c.textContent = "✅ 완료";
      c.classList.add("primary");
    }
    async function startMission() {
      missionStarted = true;
      if (mtype === "snack") { showTray(); return; }
      if (mtype === "pet") { say("나 쓰다듬어 줄래? 💕"); info(`호반우를 손가락으로 쓰다듬어 줘! 💗 0/${PET_GOAL}`); return; }
      const ctx = {
        root, inner: $("ar-inner"), hob, tray: $("ar-tray"), PX, VIEW, mission, zone,
        say, react, toast, info, spawnHeart, jump, complete,
        onHeading: (fn) => headingFns.push(fn),
        hasSensor: () => gotSensor,
      };
      cleanupMission = await runArMission(mtype, ctx);
    }

    /* ---------- 일청담 희귀 수달 ---------- */
    // 수달을 누르면 작은 수달이 사라지고, 화면 아래에서 큰 수달이 쏙 올라와 인사한다 (5초 뒤 다시 작은 수달로)
    // 처음 누르면 친구가 되어 도감에 등록. 그냥 마주쳤을 때는 15초 안에 안 누르면 물속으로 숨는다(히든 미션은 안 숨음).
    function showOtter() {
      const o = $("ar-otter");
      if (!o || closed) return;
      const LINES = ["안녕! 나는 신천에서 놀러 온 수달이야", "일청담 물 진짜 시원하다!", "우리 친구 하자! 꾸르륵", "물고기 있으면 나 줘!", "밤에 또 놀러 와!"];
      let lineN = 0, bigTimer = 0, bigOn = false;
      const bubble = el("div"); bubble.id = "ar-otter-say";
      bubble.textContent = "…?";
      o.parentNode.appendChild(bubble);
      const big = el("div"); big.id = "ar-sudal";
      big.innerHTML = `<p></p><img src="${IMG}sudal.webp" alt="">`;
      root.appendChild(big);
      o.classList.remove("ar-hidden");
      say("어, 신천 수달이다!");
      jump();
      toast(hiddenOtter ? "✨ 히든 미션! 신천 수달 발견!" : "✨ 희귀! 신천 수달이 나타났어!");
      info(hiddenOtter ? "✨ 히든 미션: 수달을 눌러서 인사해 봐!" : "✨ 수달이 나타났어! 15초 안에 눌러 봐!");
      navigator.vibrate?.([60, 40, 60, 40, 120]);
      if (!hiddenOtter) {
        otterTimer = setTimeout(() => {
          if (otter) return;
          o.classList.add("flee");
          bubble.remove();
          say("앗, 수달이 숨어 버렸어");
          info("수달이 물속으로 숨어 버렸어… 다음에 또 만나!");
          setTimeout(() => o.remove(), 900);
        }, 15000);
      }
      o.onclick = () => {
        if (bigOn) return;
        bigOn = true;
        clearTimeout(otterTimer);
        o.classList.add("ar-hidden");
        bubble.classList.add("ar-hidden");
        big.querySelector("p").textContent = LINES[lineN++ % LINES.length];
        requestAnimationFrame(() => big.classList.add("up"));
        navigator.vibrate?.([40, 30, 80]);
        if (!otter) {   // 처음 누르면 친구 성공!
          otter = true;
          const isNew = addToDex("otter");
          toast(isNew ? "🦦 희귀 수달 도감 등록!" : "🦦 수달이 또 놀러 왔어!");
          info(hiddenOtter ? "히든 미션 성공! 수달이랑 친구가 됐어 ✨" : "수달이랑 친구가 됐어! 같이 사진도 찍어 봐 ✨");
          react("love", "수달이랑 친구가 됐다!", 2400);
          if (hiddenOtter) complete();
        }
        bigTimer = setTimeout(() => {
          big.classList.remove("up");
          setTimeout(() => {
            bigOn = false;
            if (closed) return;
            o.classList.remove("ar-hidden");
            bubble.textContent = "꾸르륵~";
            bubble.classList.remove("ar-hidden");
          }, 550);
        }, 5000);
      };
    }

    /* ---------- 터치(대사) & 쓰다듬기(문지르기) ---------- */
    function tap() {
      say(m.lines[lineIdx % m.lines.length]);
      lineIdx++;
      jump();
      navigator.vibrate?.(60);
      markMet();
      if (!mission) info(lineIdx < m.lines.length ? "한 번 더 눌러 봐! 쓰다듬어도 좋아 🤚" : "호반우랑 사진도 찍어 봐 📸");
    }
    function pet(x, y) {
      spawnHeart(x, y);
      petCount++;
      markMet();
      if (petCount % 8 === 0) {   // 하트 8개마다 친밀도 +1
        const before = getDex()[id]?.love || 0;
        const love = collectible ? addLove(id) : 0;
        renderLove();
        if (collectible && love === LOVE_MAX && before < LOVE_MAX) react("love", "우리 이제 단짝이야! 💗", 2000);
        else react("love", PET_LINES[(petCount / 8 - 1) % PET_LINES.length]);
        navigator.vibrate?.(40);
      }
      if (mtype === "pet" && !done) {
        info(`호반우를 손가락으로 쓰다듬어 줘! 💗 ${Math.min(petCount, PET_GOAL)}/${PET_GOAL}`);
        if (petCount >= PET_GOAL) { react("love", "우리 완전 친해졌다! 💕", 2500); info("호반우와 친해졌어! 💕"); complete(); }
      }
    }
    let down = null;
    hob.addEventListener("pointerdown", (e) => {
      down = { x: e.clientX, y: e.clientY, moved: 0 };
      hob.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    hob.addEventListener("pointermove", (e) => {
      if (!down) return;
      const d = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down.x = e.clientX; down.y = e.clientY;
      down.moved += d;
      petDist += d;
      if (petDist > 70) { petDist = 0; pet(e.clientX, e.clientY); }
    });
    hob.addEventListener("pointerup", () => { if (down && down.moved < 12) tap(); down = null; });
    hob.addEventListener("pointercancel", () => { down = null; });

    /* ---------- 공식당 특별 미션: 학식 주기 ---------- */
    function showTray() {
      const tray = $("ar-tray");
      tray.innerHTML = `<div class="ar-tray-title">🍚 학식을 호반우에게 끌어다 줘!</div>` +
        snacks.map((s, i) => `<button class="ar-snack" data-i="${i}"><img src="${s.img}" alt="">${s.n}</button>`).join("");
      tray.classList.remove("ar-hidden");
      tray.querySelectorAll(".ar-snack").forEach((b) => dragSnack(b, snacks[+b.dataset.i]));
      say("배고파… 학식 먹고 싶어 🍚");
      info("학식 사진을 호반우에게 끌어다 줘!");
    }
    function dragSnack(btn, s) {
      let start = null, ghost = null;
      const place = (e) => { ghost.style.left = e.clientX + "px"; ghost.style.top = e.clientY + "px"; };
      btn.addEventListener("pointerdown", (e) => {
        start = { x: e.clientX, y: e.clientY };
        ghost = el("img"); ghost.className = "ar-ghost"; ghost.src = s.img; ghost.alt = "";
        root.appendChild(ghost); place(e);
        btn.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      });
      btn.addEventListener("pointermove", (e) => { if (ghost) place(e); });
      btn.addEventListener("pointerup", (e) => {
        if (!ghost) return;
        ghost.remove(); ghost = null;
        const r = hob.getBoundingClientRect();
        const onHob = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (onHob || moved < 12) feed(s);       // 끌어다 놓거나, 그냥 눌러도 먹여 준다
      });
      btn.addEventListener("pointercancel", () => { ghost?.remove(); ghost = null; });
    }
    function feed(s) {
      if (fed) return;
      fed = true;
      $("ar-tray").classList.add("ar-hidden");
      const r = hob.getBoundingClientRect();
      for (let i = 0; i < 6; i++) {
        setTimeout(() => spawnHeart(r.left + r.width * (0.25 + Math.random() * 0.5), r.top + r.height * 0.4, i % 2 ? "✨" : "💗"), i * 90);
      }
      if (collectible) { addLove(id, 2); renderLove(); }
      react("proud", `냠냠! ${s.n} 최고야! 😋`, 2200);
      navigator.vibrate?.([80, 40, 80]);
      info("호반우가 배불러졌어! 🍚");
      complete();
    }

    /* ---------- 같이 찍기 → 사진 찍기 화면(크기 조절·촬영)으로 ---------- */
    $("ar-shot").onclick = async () => {
      markMet();
      stopCam();                               // 휴대폰은 카메라를 동시에 두 번 못 켜서 잠시 끈다
      const items = collectedItems();
      if (!items.some((it) => it.id === id)) items.unshift({ id: id || "ar", name: m.name, img: m.img });
      if (otter && !items.some((it) => it.id === "otter")) items.push({ id: "otter", name: RARE.otter.name, img: RARE.otter.img });
      const r = await openPhotoStudio({ items, start: id || "ar", place: zone.name || "", zoneId: zone.id || null });   // zoneId → 커뮤니티 #장소 태그
      // "커뮤니티에 공유"를 눌렀으면 AR 화면도 닫아서 글쓰기 창이 바로 보이게 (카메라로 돌아가지 않음)
      if (r?.shared) { $("ar-close")?.click(); return; }
      if (!closed) startCam();
    };

    /* ---------- 닫기 ---------- */
    $("ar-close").onclick = () => {
      closed = true;
      cancelAnimationFrame(raf);
      clearTimeout(reactTimer);
      clearTimeout(otterTimer);
      window.removeEventListener("deviceorientation", onTurn);
      try { cleanupMission?.(); } catch {}
      stopCam();
      root.remove();
      resolve({ met, fed, done, otter });
    };
  });
}

/* ============================================================
   2) 사진 찍기 화면 — 카메라 앱처럼: 위 닫기·비율, 오른쪽 도구, 아래 줌·호반우 고르기·셔터
   ============================================================ */
const RATIOS = [
  { label: "전체", w: 0, h: 0 },        // 화면 꽉 차게
  { label: "3:4", w: 3, h: 4 },
  { label: "1:1", w: 1, h: 1 },
  { label: "4:3 가로", w: 4, h: 3 },
];
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isMobile = () => isIOS() || /Android/i.test(navigator.userAgent);

export function openPhotoStudio({ items, start, submit = false, place = "", zoneId = null } = {}) {
  injectStyle();
  items = items || collectedItems();
  // (장주연) 모은 호반우가 없어도 기본 호반우 + 기본 프레임으로 바로 찍을 수 있게
  if (!items.length) items = [{ id: "basic", name: "호반우", img: DEFAULT.img }];

  return new Promise((resolve) => {
    const root = el("div");
    root.id = "ps-root";
    root.innerHTML = `
      <div id="ps-frame">
        <video id="ps-cam" autoplay playsinline muted></video>
        <img id="ps-hob" alt="호반우" draggable="false">
        <div id="ps-stks"></div>
        <img id="ps-frameimg" class="ar-hidden" alt="" draggable="false">
        <button id="ps-del" aria-label="스티커 지우기">✕</button>
        <div id="ps-flash"></div>
      </div>
      <div class="ps-topbar">
        <button class="ps-round ps-glass" id="ps-close" aria-label="닫기">✕</button>
        <button class="ps-pill ps-glass" id="ps-ratio"></button>
        <span class="ps-spacer" style="width:40px;height:40px"></span>
      </div>
      <div class="ps-rail">
        <button class="ps-tool" id="ps-deco-btn"><i class="ps-glass">✨</i>꾸미기</button>
        <button class="ps-tool" id="ps-flip"><i class="ps-glass">🔄</i>전환</button>
        <button class="ps-tool" id="ps-bigger"><i class="ps-glass">➕</i>크게</button>
        <button class="ps-tool" id="ps-smaller"><i class="ps-glass">➖</i>작게</button>
        <button class="ps-tool" id="ps-reset"><i class="ps-glass">↺</i>원위치</button>
      </div>
      <div class="ps-tip ps-glass">끌어서 옮기고 · 두 손가락으로 크기 조절</div>
      <div class="ps-bottom">
        <div class="ps-zooms" id="ps-zooms"></div>
        <div class="ps-carousel" id="ps-carousel"></div>
        <div class="ps-name" id="ps-name"></div>
        <div class="ps-shootrow">
          <button class="ps-thumb empty" id="ps-thumb" aria-label="방금 찍은 사진"></button>
          <button id="ps-shutter" aria-label="촬영"></button>
          <span class="ps-spacer"></span>
        </div>
      </div>
      <div id="ps-deco" class="ar-hidden">
        <div class="ps-deco-head" id="ps-deco-tabs"></div>
        <p class="ps-deco-hint">눌러서 붙이고, 붙인 스티커를 눌러 선택하면 옮기기·크기 조절·✕로 지우기를 할 수 있어요</p>
        <div class="ps-deco-grid" id="ps-deco-grid"></div>
      </div>
      <div id="ps-review" class="ar-hidden">
        <img id="ps-photo" alt="찍은 사진">
        <div class="ps-rv-top"><button class="ps-round ps-glass" id="ps-back" aria-label="카메라로 돌아가기">✕</button></div>
        <div class="ps-rv-bar">
          <div class="ps-rv-row">
            <button class="ps-rv-btn ps-glass" id="ps-retake">↺ 다시 찍기</button>
            ${submit ? `<button class="ps-rv-btn primary" id="ps-submit">✅ 이 사진으로 제출</button>` : ""}
            <button class="ps-rv-btn ${submit ? "ps-glass" : "primary"}" id="ps-save">⬇ 저장</button>
          </div>
          <div class="ps-rv-row">
            <button class="ps-rv-btn ${submit ? "ps-glass" : "primary"}" id="ps-record">📒 도감에 기록</button>
            ${submit ? "" : `<button class="ps-rv-btn ps-glass" id="ps-community">💬 커뮤니티에 공유</button>`}
          </div>
          <p class="ps-rv-hint" id="ps-hint"></p>
        </div>
      </div>`;
    document.body.appendChild(root);
    const $ = (x) => root.querySelector("#" + x);
    const frame = $("ps-frame"), video = $("ps-cam"), hob = $("ps-hob");

    let closed = false;
    const close = (val) => {
      closed = true;
      // 모은 호반우가 없을 때는 카메라 준비 전에 닫히므로, 정리 중 오류가 나도 화면은 꼭 닫는다
      try { stopCam(); } catch {}
      try { window.removeEventListener("resize", fit); } catch {}
      root.remove();
      resolve(val);
    };
    $("ps-close").onclick = () => close();

    // 모은 호반우가 없으면 안내만 보여준다
    if (!items.length) {
      root.querySelectorAll(".ps-rail,.ps-tip,.ps-bottom,#ps-ratio,#ps-frame").forEach((n) => n.classList.add("ar-hidden"));
      const msg = el("div");
      msg.className = "ps-empty";
      msg.innerHTML = `<div>아직 모은 호반우가 없어요<br>캠퍼스 곳곳에서 호반우를 만나면<br>여기서 같이 사진을 찍을 수 있어요!</div>
        <button type="button">← 돌아가기</button>`;
      root.appendChild(msg);
      msg.querySelector("button").onclick = () => close();
      return;
    }

    let current = items.find((it) => it.id === start) || items[0];
    let ratio = 0, FW = 0, FH = 0;
    let facing = "environment", stream = null, track = null, hwZoom = null, zoom = 1;
    const HOME = { x: 0.5, y: 0.62, w: 0.55 };
    const st = { ...HOME };   // 호반우 중심 위치·너비 (사진 틀 대비 비율)

    /* ---------- 호반우 고르기 (틱톡 필터처럼 가로로 넘기기) ---------- */
    const car = $("ps-carousel");
    car.innerHTML = items.map((it) =>
      `<button class="ps-item" data-id="${it.id}" aria-label="${it.name}"><img src="${it.img}" alt=""></button>`).join("");
    car.querySelectorAll(".ps-item").forEach((b) => {
      b.onclick = () => { current = items.find((it) => it.id === b.dataset.id); setMascot(true); };
    });
    function setMascot(scroll) {
      hob.src = current.img;
      $("ps-name").textContent = current.name + " 호반우";
      car.querySelectorAll(".ps-item").forEach((b) => {
        const on = b.dataset.id === current.id;
        b.classList.toggle("on", on);
        if (on && scroll) b.scrollIntoView(root.classList.contains("land")
          ? { behavior: "smooth", block: "center", inline: "nearest" }
          : { behavior: "smooth", inline: "center", block: "nearest" });
      });
    }
    hob.onload = render;
    setMascot(false);

    /* ---------- 사진 비율 (전체 / 3:4 / 1:1 / 4:3) ---------- */
    function fit() {
      const W = window.innerWidth, H = window.innerHeight;
      const land = W > H;                         // 휴대폰을 가로로 돌렸을 때
      root.classList.toggle("land", land);
      const { w, h } = RATIOS[ratio];
      const AW = land && w ? W - 150 : W;         // 가로 모드: 오른쪽 셔터 줄(150px)을 뺀 영역에 맞춤
      let fw = W, fh = H;
      if (w) { fw = AW; fh = AW * h / w; if (fh > H) { fh = H; fw = H * w / h; } }
      FW = fw; FH = fh;
      const top = !w ? 0 : land ? (H - fh) / 2 : Math.max(0, (H - fh) / 2 - (fh < H - 160 ? 50 : 0));
      const left = !w ? 0 : (AW - fw) / 2;
      Object.assign(frame.style, { width: fw + "px", height: fh + "px", left: left + "px", top: top + "px" });
      $("ps-ratio").textContent = "📐 " + RATIOS[ratio].label;
      if (frameId !== "none") frameImg.src = frameSVG(frameId, FW, FH, place);
      render();
    }
    $("ps-ratio").onclick = () => { ratio = (ratio + 1) % RATIOS.length; fit(); };
    window.addEventListener("resize", fit);

    /* ---------- 호반우 그리기 + 크기 버튼 ---------- */
    // 호반우와 스티커는 모두 { x, y, w } (사진 틀 대비 비율)로 위치를 기억한다
    function placeObj(img, o) {
      const w = o.w * Math.min(FW, FH * 0.9);
      const h = img.naturalWidth ? w * img.naturalHeight / img.naturalWidth : w;
      img.style.width = w + "px";
      img.style.left = (o.x * FW - w / 2) + "px";
      img.style.top = (o.y * FH - h / 2) + "px";
    }
    function render() {
      if (!FW) return;
      placeObj(hob, st);
      stickers.forEach((sk) => placeObj(sk.el, sk));
      // 선택 표시: 스티커가 있을 때만 점선으로 보여 준다
      hob.classList.toggle("ps-sel", sel === "hob" && stickers.length > 0);
      stickers.forEach((sk) => sk.el.classList.toggle("ps-sel", sk === sel));
      const del = $("ps-del");
      if (sel !== "hob" && sel) {
        const r = sel.el.getBoundingClientRect(), fr = frame.getBoundingClientRect();
        del.style.display = "block";
        del.style.left = (r.right - fr.left) + "px";
        del.style.top = (r.top - fr.top) + "px";
      } else del.style.display = "none";
    }
    const clampW = (w) => Math.max(0.08, Math.min(1.3, w));
    const T = () => (sel === "hob" || !sel ? st : sel);     // 지금 조작하는 대상
    $("ps-bigger").onclick = () => { T().w = clampW(T().w * 1.15); render(); };
    $("ps-smaller").onclick = () => { T().w = clampW(T().w / 1.15); render(); };
    $("ps-reset").onclick = () => {
      if (T() === st) Object.assign(st, HOME); else Object.assign(T(), { x: 0.5, y: 0.45, w: T().w0 });
      render();
    };

    /* ---------- 꾸미기: 스티커·프레임 ---------- */
    const cat = stickerCatalog(place);
    const stickers = [];          // { id, el, x, y, w, w0 }
    let sel = "hob";              // 선택된 대상: "hob" · 스티커 · null(아무것도 선택 안 함)
    let frameId = "none";
    let decoTab = "frame";
    let logoColor = LOGO.colors[0];   // 로고 탭에서 고른 색
    const frameImg = $("ps-frameimg");
    function setFrame(id) {
      frameId = id;
      if (id === "none") { frameImg.classList.add("ar-hidden"); frameImg.removeAttribute("src"); }
      else { frameImg.src = frameSVG(id, FW, FH, place); frameImg.classList.remove("ar-hidden"); }
      drawDeco();
    }
    function addSticker(item) {
      const img = el("img");
      img.className = "ps-stk"; img.alt = ""; img.draggable = false;
      const sk = { id: item.id, el: img, x: 0.5, y: 0.4 + (stickers.length % 4) * 0.06, w: item.w || 0.3, w0: item.w || 0.3 };
      img.onload = render;
      img.src = item.src;
      $("ps-stks").appendChild(img);
      stickers.push(sk);
      sel = sk;
      render();
      navigator.vibrate?.(20);
    }
    $("ps-del").addEventListener("pointerdown", (e) => e.stopPropagation());
    $("ps-del").onclick = (e) => {
      e.stopPropagation();
      if (sel === "hob" || !sel) return;
      sel.el.remove();
      stickers.splice(stickers.indexOf(sel), 1);
      sel = "hob";
      render();
    };
    function drawDeco() {
      $("ps-deco-tabs").innerHTML = cat.tabs.map((t) =>
        `<button class="ps-deco-tab ${t.id === decoTab ? "on" : ""}" data-t="${t.id}">${t.name}</button>`).join("") +
        `<button class="ps-deco-done" id="ps-deco-done">완료</button>`;
      $("ps-deco-tabs").querySelectorAll(".ps-deco-tab").forEach((b) => { b.onclick = () => { decoTab = b.dataset.t; drawDeco(); }; });
      $("ps-deco-done").onclick = () => $("ps-deco").classList.add("ar-hidden");
      // 로고 탭: 위에 색 고르기 → 아래에 언어별 로고 (고른 색으로)
      const list = decoTab === "logo" ? LOGO.langs.map((l) => logoItem(l, logoColor)) : cat[decoTab];
      const colorRow = decoTab !== "logo" ? "" : `<div class="ps-logo-colors">${LOGO.colors.map((c) =>
        `<button class="ps-logo-sw ${c === logoColor ? "on" : ""}" data-c="${c.id}" title="${c.name}"><i style="background:${c.sw}"></i>${c.name}</button>`).join("")}</div>`;
      $("ps-deco-grid").innerHTML = colorRow + list.map((it, i) => {
        if (decoTab === "frame") {
          const prev = it.id === "none" ? `<div class="ps-deco-none">⦸</div>` : `<img class="ps-frameprev" style="width:min(100%,${Math.round(84 * (FW || 360) / (FH || 640))}px)" src="${frameSVG(it.id, FW || 360, FH || 640, place)}" alt="">`;
          return `<button class="ps-deco-item ${it.id === frameId ? "on" : ""}" data-i="${i}">${prev}${it.name}</button>`;
        }
        const dark = decoTab === "logo" && logoColor.id === "white" ? " dark" : "";   // 흰 로고는 어두운 바탕에서 보이게
        return `<button class="ps-deco-item${dark}" data-i="${i}"><img src="${it.src}" alt="">${it.name}</button>`;
      }).join("");
      $("ps-deco-grid").querySelectorAll(".ps-logo-sw").forEach((b) => {
        b.onclick = () => { logoColor = LOGO.colors.find((c) => c.id === b.dataset.c); drawDeco(); };
      });
      $("ps-deco-grid").querySelectorAll(".ps-deco-item").forEach((b) => {
        b.onclick = () => {
          const it = list[+b.dataset.i];
          if (decoTab === "frame") setFrame(it.id); else addSticker(it);
        };
      });
    }
    $("ps-deco-btn").onclick = () => {
      const d = $("ps-deco");
      d.classList.toggle("ar-hidden");
      if (!d.classList.contains("ar-hidden")) drawDeco();
    };

    /* ---------- 끌어서 옮기기 + 두 손가락으로 크기 조절 ---------- */
    const pts = new Map();
    let g0 = null;
    const snap = () => {
      const p = [...pts.values()];
      const t = T();
      g0 = { x: t.x, y: t.y, w: t.w, p };
      if (p.length >= 2) {
        g0.d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        g0.cx = (p[0].x + p[1].x) / 2; g0.cy = (p[0].y + p[1].y) / 2;
      }
    };
    const hit = (x, y, img) => { const r = img.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
    frame.addEventListener("pointerdown", (e) => {
      frame.setPointerCapture?.(e.pointerId);
      if (pts.size === 0) {   // 첫 손가락: 누른 스티커(맨 위부터) 또는 호반우를 선택
        const top = [...stickers].reverse().find((sk) => hit(e.clientX, e.clientY, sk.el));
        if (top) sel = top;
        else if (hit(e.clientX, e.clientY, hob)) sel = "hob";
        else sel = stickers.length ? null : "hob";   // 빈 곳을 누르면 선택 해제 (스티커가 없을 땐 예전처럼 호반우 이동)
        render();
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      snap();
      e.preventDefault();
    });
    frame.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId) || !g0 || sel === null) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = [...pts.values()];
      const t = T();
      if (p.length === 1) {
        t.x = g0.x + (p[0].x - g0.p[0].x) / FW;
        t.y = g0.y + (p[0].y - g0.p[0].y) / FH;
      } else if (p.length >= 2 && g0.d) {
        const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        t.w = clampW(g0.w * d / g0.d);
        t.x = g0.x + ((p[0].x + p[1].x) / 2 - g0.cx) / FW;
        t.y = g0.y + ((p[0].y + p[1].y) / 2 - g0.cy) / FH;
      }
      t.x = Math.max(0, Math.min(1, t.x));
      t.y = Math.max(0, Math.min(1, t.y));
      render();
    });
    const lift = (e) => { pts.delete(e.pointerId); snap(); };
    frame.addEventListener("pointerup", lift);
    frame.addEventListener("pointercancel", lift);
    frame.addEventListener("wheel", (e) => { e.preventDefault(); T().w = clampW(T().w * (1 - e.deltaY * 0.001)); render(); }, { passive: false });

    /* ---------- 카메라 (전면/후면 전환 + 줌 버튼) ---------- */
    async function startCam() {
      stopCam();
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
        });
        if (closed) { stopCam(); return; }
        video.srcObject = stream;
        frame.classList.remove("nocam");
        video.classList.remove("ar-hidden");
        track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() || {};
        hwZoom = caps.zoom ? { min: caps.zoom.min, max: caps.zoom.max } : null;
        const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        $("ps-flip").classList.toggle("ar-hidden", cams.length < 2);
      } catch {
        stream = null; track = null; hwZoom = null;
        frame.classList.add("nocam");
        video.classList.add("ar-hidden");
        $("ps-flip").classList.add("ar-hidden");
      }
      setupZoom();
    }
    function stopCam() {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null; track = null;
    }
    // 카메라 앱처럼 1x · 2x · 3x 버튼. 기기 줌을 지원하면 그걸 쓰고, 아니면 화면 확대
    function setupZoom() {
      let steps = hwZoom
        ? [hwZoom.min < 1 ? hwZoom.min : null, 1, 2, 3, 5].filter((z) => z != null && z >= hwZoom.min && z <= hwZoom.max)
        : [1, 1.5, 2, 3];
      if (!steps.length) steps = [1];
      zoom = steps.includes(1) ? 1 : steps[0];
      const box = $("ps-zooms");
      box.innerHTML = steps.map((z) => `<button class="ps-zchip ps-glass" data-z="${z}">${z < 1 ? Number(z).toFixed(1) : z}x</button>`).join("");
      box.querySelectorAll(".ps-zchip").forEach((b) => { b.onclick = () => { zoom = Number(b.dataset.z); applyZoom(); }; });
      applyZoom();
    }
    function applyZoom() {
      $("ps-zooms").querySelectorAll(".ps-zchip").forEach((b) => b.classList.toggle("on", Number(b.dataset.z) === zoom));
      const mirror = facing === "user" ? "scaleX(-1) " : "";
      if (hwZoom && track) {
        track.applyConstraints({ advanced: [{ zoom }] }).catch(() => {});
        video.style.transform = mirror;
      } else {
        video.style.transform = `${mirror}scale(${zoom})`;
      }
    }
    $("ps-flip").onclick = () => { facing = facing === "environment" ? "user" : "environment"; startCam(); };

    /* ---------- 촬영 ---------- */
    let lastShot = null;
    function toast(t) {
      const d = el("div"); d.className = "ps-toast"; d.textContent = t;
      root.appendChild(d);
      setTimeout(() => d.remove(), 1900);
    }
    $("ps-shutter").onclick = async () => {
      if (frameId !== "none" && !frameImg.complete) await new Promise((r) => { frameImg.onload = r; frameImg.onerror = r; });
      const k = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
      const c = el("canvas");
      c.width = Math.round(FW * k); c.height = Math.round(FH * k);
      const g = c.getContext("2d");
      g.scale(k, k);
      if (stream && video.videoWidth) {
        const dz = hwZoom ? 1 : zoom;
        const s = Math.max(FW / video.videoWidth, FH / video.videoHeight) * dz;
        const dw = video.videoWidth * s, dh = video.videoHeight * s;
        g.save();
        if (facing === "user") { g.translate(FW, 0); g.scale(-1, 1); }   // 셀카는 화면과 똑같이 좌우 반전
        g.drawImage(video, (FW - dw) / 2, (FH - dh) / 2, dw, dh);
        g.restore();
      } else {
        const grd = g.createLinearGradient(0, 0, 0, FH);
        grd.addColorStop(0, "#bfe3ff"); grd.addColorStop(0.6, "#e9f6ff"); grd.addColorStop(1, "#cdeac0");
        g.fillStyle = grd; g.fillRect(0, 0, FW, FH);
      }
      const fr = frame.getBoundingClientRect(), hr = hob.getBoundingClientRect();
      g.drawImage(hob, hr.left - fr.left, hr.top - fr.top, hr.width, hr.height);
      stickers.forEach((sk) => {                       // 붙인 스티커 (붙인 순서대로)
        const r = sk.el.getBoundingClientRect();
        try { g.drawImage(sk.el, r.left - fr.left, r.top - fr.top, r.width, r.height); } catch {}
      });
      if (frameId !== "none") { try { g.drawImage(frameImg, 0, 0, FW, FH); } catch {} }   // 프레임은 맨 위

      const f = $("ps-flash");
      f.classList.remove("on"); void f.offsetWidth; f.classList.add("on");
      navigator.vibrate?.(50);
      lastShot = c.toDataURL("image/jpeg", 0.92);
      recorded = null;   // 새로 찍었으니 아직 도감에 기록 안 됨
      $("ps-thumb").style.backgroundImage = `url(${lastShot})`;
      $("ps-thumb").classList.remove("empty");
      setTimeout(openReview, 250);
    };
    $("ps-thumb").onclick = () => { if (lastShot) openReview(); };

    /* ---------- 미리보기: 저장 / 공유 분리 ---------- */
    const fileName = () => {
      const d = new Date(), p = (n) => String(n).padStart(2, "0");
      return `호반우_${current.name.replace(/[^\w가-힣]/g, "")}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`;
    };
    function openReview() {
      $("ps-photo").src = lastShot;
      $("ps-hint").textContent = isIOS()
        ? "아이폰: 사진을 길게 눌러 '사진 앱에 저장'을 누르면 사진첩에 바로 저장돼요. (⬇ 저장은 '파일' 앱에 저장돼요)"
        : /Android/i.test(navigator.userAgent)
          ? "⬇ 저장하면 갤러리(다운로드 폴더)에서 볼 수 있어요."
          : "⬇ 저장하면 다운로드 폴더에 저장돼요.";
      $("ps-review").classList.remove("ar-hidden");
    }
    const back = () => $("ps-review").classList.add("ar-hidden");
    $("ps-back").onclick = back;
    $("ps-retake").onclick = back;
    $("ps-save").onclick = () => {
      const a = el("a");
      a.href = URL.createObjectURL(dataUrlToFile(lastShot, fileName()));
      a.download = fileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast("⬇ 저장했어요!");
    };
    // 📒 도감에 기록 (사진 앨범, album.js). 미션 제출할 때도 자동으로 기록한다
    let recorded = null;
    async function record(silent) {
      if (recorded) return recorded;
      try {
        const m = await import("./album.js");
        recorded = await m.recordPhoto({ dataUrl: lastShot, zoneId, place, mascotId: current.id, mascotName: current.name });
        if (!silent) toast("📒 도감에 기록했어요! (도감 > 호반우와 사진)");
        $("ps-record").textContent = "✅ 기록됨";
      } catch (e) { console.warn(e); if (!silent) toast("기록하지 못했어요"); }
      return recorded;
    }
    $("ps-record").onclick = () => record(false);
    if ($("ps-community")) $("ps-community").onclick = async () => {   // 기록하고 → 카메라 닫고 → 커뮤니티 글쓰기 창
      await record(true);
      const shot = lastShot;
      close({ shared: true });   // 사진 찍기 화면을 연 쪽(AR 화면 등)도 함께 닫으라는 표시
      try { (await import("./album.js")).shareToCommunity(shot, zoneId); } catch (e) { console.warn(e); }
    };
    if (submit) $("ps-submit").onclick = async () => { await record(true); close({ dataUrl: lastShot, mascot: current.id }); };
    // 외부 앱(인스타그램 등) 공유 버튼은 없앴다. 사진 공유는 "💬 커뮤니티에 공유"로 하고,
    // 찍은 장소가 #해시태그로 붙어서 커뮤니티에서 장소별로 모아 볼 수 있다.

    requestAnimationFrame(fit);
    startCam();
  });
}

/* ============================================================
   3) 도감 — 팝업(openDex)과 탐색 탭 안에 그리는 버전(renderHobanuPane)
   ============================================================ */
// 이미 만난 호반우인지 (장소 대화에서 "호반우 만나기"를 다시 물을지 정할 때 사용)
export function hasMet(id) { return !!getDex()[id]; }

function dexBody() {
  const dex = getDex();
  const ids = Object.keys(MASCOTS);
  const n = ids.filter((i) => dex[i]).length;
  return {
    n, total: ids.length,
    html: `
      <div class="dex-bar"><i style="width:${(n / ids.length) * 100}%"></i></div>
      <p class="dex-sub">${n === ids.length ? "🎉 도감 완성! 넌 이제 캠퍼스 마스터야!" : "캠퍼스 곳곳에 숨은 호반우를 모아 봐! 쓰다듬을수록 친밀도가 올라가."}</p>
      <div class="dex-grid">
        ${ids.map((i) => {
          const mm = MASCOTS[i], d = dex[i];
          if (!d) return `<div class="dex-item locked"><img src="${mm.img}" alt=""><b>???</b><small>${mm.name}에서 만날 수 있어요</small></div>`;
          const love = d.love || 0;
          return `<div class="dex-item"><img src="${mm.img}" alt="${mm.name} 호반우"><b>${mm.name}</b>
            <small>${"💗".repeat(love)}${"🤍".repeat(LOVE_MAX - love)}</small></div>`;
        }).join("")}
      </div>
      <div class="dex-rare-title">✨ 희귀</div>
      <div class="dex-grid">
        ${Object.keys(RARE).map((i) => {
          const rr = RARE[i];
          return dex[i]
            ? `<div class="dex-item rare"><img src="${rr.img}" alt="${rr.name}"><b>${rr.name}</b><small>희귀 캐릭터를 만났어요!</small></div>`
            : `<div class="dex-item locked"><img src="${rr.img}" alt=""><b>???</b><small>${rr.hint}</small></div>`;
        }).join("")}
      </div>`,
  };
}

// 팝업 도감
export function openDex() {
  injectStyle();
  document.getElementById("hob-dex")?.remove();
  const box = el("div");
  box.id = "hob-dex";
  document.body.appendChild(box);
  const b = dexBody();
  box.innerHTML = `
    <div class="dex-card">
      <div class="dex-head"><b>📖 호반우 도감</b><span>${b.n} / ${b.total}</span><button class="dex-x" aria-label="닫기">✕</button></div>
      ${b.html}
    </div>`;
  box.querySelector(".dex-x").onclick = () => box.remove();
  box.onclick = (e) => { if (e.target === box) box.remove(); };
}

// 호반우 탭 아래에 다른 기능(투어 뱃지 등)을 붙일 수 있게 하는 자리. tour.js가 등록한다
let paneExtra = null;
export function setHobanuPaneExtra(fn) { paneExtra = fn; }
export const getHobanuPaneExtra = () => paneExtra;

// 탐색 화면의 "호반우" 탭: 사진 찍기 버튼 + 도감을 container 안에 그린다
// 새 "도감" 화면(dex-tab.js: 도감·투어 뱃지·사진 앨범)을 그린다. 불러오지 못하면 예전 화면으로
export function renderHobanuPane(container) {
  if (!container) return;
  injectStyle();
  import("./dex-tab.js").then((m) => m.renderDexTab(container)).catch((e) => { console.warn("[도감]", e); oldHobanuPane(container); });
}
function oldHobanuPane(container) {
  const draw = () => {
    const b = dexBody();
    container.innerHTML = `
      <div class="hob-pane">
        <button class="hob-photo-cta" type="button">
          <img src="${REACT.hi}" alt="">
          <span><b>📸 모은 호반우와 사진 찍기</b><small>${b.n ? "지금까지 모은 호반우와 함께 찍어 보세요" : "장소에서 호반우를 만나면 열려요"}</small></span>
        </button>
        <div class="dex-inline">
          <div class="dex-head"><b>📖 호반우 도감</b><span>${b.n} / ${b.total}</span></div>
          ${b.html}
        </div>
        <div class="hob-extra"></div>
      </div>`;
    try { paneExtra?.(container.querySelector(".hob-extra")); } catch (e) { console.warn(e); }
    container.querySelector(".hob-photo-cta").onclick = async () => {
      await openPhotoStudio();
      draw();
    };
  };
  draw();
}