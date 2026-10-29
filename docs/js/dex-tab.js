// js/dex-tab.js — "도감" 화면 (담당: 장주연)
// 구성: ① 호반우 도감(실루엣 → 만나면 컬러, 누르면 상세) ② 투어 뱃지 ③ 호반우와 사진(찍기 + 장소별·날짜별 앨범)
// 사용법: renderDexTab(아무 div)  — 지금은 퀘스트 > 호반우 탭에서 쓰고, 나중에 "도감" 탭을 만들면 거기서 그대로 부르면 된다.
import { MASCOTS, RARE, getDex, startAR, openPhotoStudio, getHobanuPaneExtra } from "./ar.js";
import { renderAlbum, nearestZone, getZones, listPhotos } from "./album.js";

const LOVE_MAX = 5;

let styled = false;
function injectStyle() {
  if (styled) return;
  styled = true;
  const s = document.createElement("style");
  s.textContent = `
  .dx-wrap{display:flex;flex-direction:column;gap:14px;padding-bottom:20px}
  .dx-card{background:var(--card,#fff);border-radius:20px;padding:16px;box-shadow:var(--shadow-card,0 6px 18px rgba(0,0,0,.06));border:1px solid var(--line,#e5e8eb)}
  .dx-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
  .dx-head b{font-size:16px}
  .dx-head span{font-size:13px;font-weight:800;color:var(--primary,#d4121a)}
  .dx-sub{margin:0 0 10px;font-size:12.5px;color:var(--sub,#4e5968)}
  .dx-bar{height:8px;border-radius:4px;background:var(--line,#e5e8eb);overflow:hidden;margin:6px 0 12px}
  .dx-bar i{display:block;height:100%;background:var(--primary,#d4121a);border-radius:4px}
  .dx-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .dx-item{width:auto;margin:0;padding:8px 4px;border:none;border-radius:14px;background:var(--cream-weak,#f2f4f6);font-family:inherit;color:inherit;
    display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer}
  .dx-item img{width:100%;aspect-ratio:1;object-fit:contain}
  .dx-item b{font-size:11.5px;line-height:1.2;word-break:keep-all}
  .dx-item small{font-size:10px;color:var(--mute,#8b95a1)}
  .dx-item.locked img{filter:brightness(0) opacity(.2)}
  .dx-item.locked b{color:var(--mute,#8b95a1)}
  .dx-item.rare{background:linear-gradient(135deg,#f2f4f6,#ffe9f2)}
  .dx-rare{margin:12px 0 6px;font-size:13px;font-weight:800;color:#e8590c}
  .dx-cta{width:100%;margin:4px 0 0;padding:14px;border:none;border-radius:16px;background:var(--primary,#d4121a);color:#fff;font-weight:800;font-size:15px;
    font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px}
  .dx-cta img{width:34px;height:34px;object-fit:contain}
  .dx-badges .tb-section{margin:0;padding:0;background:none;box-shadow:none}
  #dx-detail{position:fixed;inset:0;z-index:2200;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}
  #dx-detail .dd{width:min(560px,100%);max-height:90vh;overflow:auto;background:var(--card,#fff);color:var(--ink,#191f28);border-radius:22px 22px 0 0;
    padding:18px 18px calc(18px + env(safe-area-inset-bottom));font-family:inherit}
  #dx-detail .dd-hero{display:flex;gap:14px;align-items:center}
  #dx-detail .dd-hero img{width:120px;height:120px;object-fit:contain;flex:none;border-radius:20px;background:var(--cream-weak,#f2f4f6)}
  #dx-detail .dd-hero.locked img{filter:brightness(0) opacity(.2)}
  #dx-detail h3{margin:0 0 4px;font-size:19px}
  #dx-detail .dd-meta{font-size:12.5px;color:var(--sub,#4e5968);line-height:1.6}
  #dx-detail .dd-line{margin:12px 0 0;padding:11px 14px;border-radius:16px 16px 16px 4px;background:var(--cream-weak,#f2f4f6);font-size:14px}
  #dx-detail .dd-btns{display:flex;gap:8px;margin-top:14px}
  #dx-detail .dd-btns button{flex:1;width:auto;margin:0;padding:13px 8px;border:none;border-radius:14px;font-weight:800;font-size:14px;font-family:inherit;
    background:var(--line,#e5e8eb);color:inherit}
  #dx-detail .dd-btns button.primary{background:var(--primary,#d4121a);color:#fff}
  #dx-detail h4{margin:16px 0 4px;font-size:14px}`;
  document.head.appendChild(s);
}

const fmtDay = (t) => new Date(t).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

export async function renderDexTab(container) {
  if (!container) return;
  injectStyle();
  const dex = getDex();
  const ids = Object.keys(MASCOTS);
  const n = ids.filter((i) => dex[i]).length;
  const photos = await listPhotos();
  container.innerHTML = `
    <div class="dx-wrap">
      <section class="dx-card">
        <div class="dx-head"><b>📖 호반우 도감</b><span>${n} / ${ids.length}</span></div>
        <div class="dx-bar"><i style="width:${(n / ids.length) * 100}%"></i></div>
        <p class="dx-sub">${n === ids.length ? "도감 완성! 넌 이제 캠퍼스 마스터야!" : "캠퍼스 곳곳의 호반우를 만나면 실루엣이 컬러로 바뀌어요. 눌러서 자세히 보기!"}</p>
        <div class="dx-grid">${ids.map((i) => {
          const d = dex[i], mm = MASCOTS[i];
          return `<button class="dx-item ${d ? "" : "locked"}" data-id="${i}"><img src="${mm.img}" alt=""><b>${d ? mm.name : "???"}</b>
            <small>${d ? "💗".repeat(d.love || 0) || "만났어요" : mm.name}</small></button>`;
        }).join("")}</div>
        <div class="dx-rare">✨ 희귀</div>
        <div class="dx-grid">${Object.keys(RARE).map((i) => `<button class="dx-item ${dex[i] ? "rare" : "locked"}" data-id="${i}" data-rare="1">
            <img src="${RARE[i].img}" alt=""><b>${dex[i] ? RARE[i].name : "???"}</b><small>${dex[i] ? "희귀!" : "?"}</small></button>`).join("")}</div>
      </section>
      <section class="dx-card dx-badges"></section>
      <section class="dx-card">
        <div class="dx-head"><b>📸 호반우와 사진</b><span>${photos.length}장</span></div>
        <p class="dx-sub">모은 호반우와 사진을 찍고 <b>📒 도감에 기록</b>하면 장소별·날짜별로 모여요. 커뮤니티에 공유도 할 수 있어요!</p>
        <button class="dx-cta" data-a="shot"><img src="img/hobanu/react-hi.png" alt="">호반우와 사진 찍기</button>
        <div class="dx-album"></div>
      </section>
    </div>`;
  const redraw = () => renderDexTab(container);
  // 투어 뱃지 (tour.js가 있으면)
  const bslot = container.querySelector(".dx-badges");
  const badgeFn = getHobanuPaneExtra();   // tour.js가 등록한 투어 뱃지 칸 (없으면 숨김)
  if (badgeFn) { try { badgeFn(bslot); } catch { bslot.remove(); } } else bslot.remove();
  // 앨범
  renderAlbum(container.querySelector(".dx-album"), { onChange: redraw });
  // 사진 찍기: 지금 위치가 어느 구역 근처면 그 장소로 기록
  container.querySelector('[data-a="shot"]').onclick = async () => {
    const z = await nearestZone().catch(() => null);
    await openPhotoStudio({ start: z?.id, place: z?.name || "", zoneId: z?.id || null, record: true });
    redraw();
  };
  container.querySelectorAll(".dx-item").forEach((b) => (b.onclick = () => openDetail(b.dataset.id, !!b.dataset.rare, redraw)));
}

// 호반우 상세: 큰 그림, 만난 날, 친밀도, 한마디, 이 호반우와 찍은 사진, AR로 만나기 / 같이 찍기
async function openDetail(id, rare, onChange) {
  injectStyle();
  const mm = rare ? RARE[id] : MASCOTS[id];
  if (!mm) return;
  const d = getDex()[id];
  const zones = await getZones();
  const zone = zones.find((z) => z.id === id);
  const el = document.createElement("div");
  el.id = "dx-detail";
  const love = d?.love || 0;
  el.innerHTML = `<div class="dd">
    <div class="dd-hero ${d ? "" : "locked"}"><img src="${mm.img}" alt="">
      <div><h3>${d ? (rare ? mm.name : mm.name + " 호반우") : "???"}</h3>
        <div class="dd-meta">${d
          ? `📅 ${fmtDay(d.at)}에 처음 만났어요${rare ? "" : `<br>친밀도 ${"💗".repeat(love)}${"🤍".repeat(LOVE_MAX - love)}`}`
          : rare ? mm.hint : `📍 ${mm.name}에 가면 만날 수 있어요`}</div></div></div>
    ${d && mm.lines ? `<div class="dd-line">${mm.lines[Math.floor(Math.random() * mm.lines.length)].replace(/[\p{Extended_Pictographic}️]/gu, "").trim()}</div>` : ""}
    <div class="dd-btns">
      ${!rare && zone ? `<button data-a="ar">${d ? "🐮 AR로 다시 만나기" : "🐮 AR로 만나러 가기"}</button>` : ""}
      ${d ? `<button class="primary" data-a="shot">📸 같이 찍기</button>` : ""}
      <button data-a="x">닫기</button>
    </div>
    ${d ? `<h4>이 호반우와 찍은 사진</h4><div class="dd-album"></div>` : ""}
  </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.onclick = (e) => { if (e.target === el) close(); };
  el.querySelector('[data-a="x"]').onclick = close;
  el.querySelector('[data-a="ar"]')?.addEventListener("click", async () => {
    close();
    await startAR(zone);
    onChange?.();
  });
  el.querySelector('[data-a="shot"]')?.addEventListener("click", async () => {
    close();
    const here = await nearestZone().catch(() => null);   // 사진 장소는 "찍은 곳" 기준
    await openPhotoStudio({ start: id, place: here?.name || "", zoneId: here?.id || null, record: true });
    onChange?.();
  });
  if (d) renderAlbum(el.querySelector(".dd-album"), { mascotId: id, noSeg: true, mode: "date", onChange });
}