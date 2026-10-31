// js/album.js — 호반우 사진 앨범 (담당: 장주연)
// 사진 찍기 화면에서 "📒 도감에 기록"한 사진을 이 기기(브라우저)에 저장하고, 장소별·날짜별로 보여 준다.
// 사진은 용량이 커서 localStorage 대신 IndexedDB에 저장한다. 커뮤니티 공유는 팀 커뮤니티 기능(community.js)을 그대로 쓴다.
import { zoneIcon } from "./icons.js";   // 장소 젤리 아이콘
import { postCommunity } from "./community.js";
import * as ui from "./ui.js";
import { confirmDialog } from "./dialog.js";
import { getState } from "./storage.js";
import * as geo from "./geo.js";

const DB_NAME = "knu-album", STORE = "photos";

/* ---------------- 저장소 (IndexedDB) ---------------- */
let dbP = null;
function db() {
  if (dbP) return dbP;
  dbP = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: "id" });
      s.createIndex("at", "at");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbP;
}
const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  });
};
export async function listPhotos() {
  try {
    const all = await tx("readonly", (s) => s.getAll());
    return (all || []).sort((a, b) => b.at - a.at);
  } catch { return []; }
}
export const updatePhoto = (p) => tx("readwrite", (s) => s.put(p));
export const deletePhoto = (id) => tx("readwrite", (s) => s.delete(id));

/* ---------------- 장소 정보 ---------------- */
let zonesP = null;
export function getZones() {
  if (!zonesP) zonesP = fetch("data/zones.json").then((r) => r.json()).then((j) => j.zones || []).catch(() => []);
  return zonesP;
}
// 지금 위치에서 가장 가까운 구역 (150m 안일 때만). 위치를 못 받으면 null
export async function nearestZone() {
  const zones = await getZones();
  const pos = await new Promise((res) => {
    if (!("geolocation" in navigator)) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null),
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 60000 });
  });
  if (!pos) return null;
  let best = null, bd = 150;
  zones.forEach((z) => { const d = geo.distanceM(pos, z); if (d < bd) { bd = d; best = z; } });
  return best;
}

/* ---------------- 사진 기록 ---------------- */
function dataUrlToBlob(u) {
  const [h, b] = u.split(",");
  const bin = atob(b), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: h.match(/:(.*?);/)?.[1] || "image/jpeg" });
}
function makeThumb(dataUrl, max = 360) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    im.onerror = () => resolve(dataUrl);
    im.src = dataUrl;
  });
}
// 사진 한 장 기록. { dataUrl, zoneId?, place?(장소 이름), mascotId, mascotName }
export async function recordPhoto({ dataUrl, zoneId = null, place = "", mascotId = "", mascotName = "" }) {
  if (!zoneId && place) {   // 장소 이름만 아는 경우(미션 사진 등) 이름으로 구역 찾기
    const z = (await getZones()).find((q) => q.name === place || place.includes(q.name));
    zoneId = z?.id || null;
  }
  const rec = {
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    at: Date.now(), zoneId, mascotId, mascotName,
    blob: dataUrlToBlob(dataUrl), thumb: await makeThumb(dataUrl),
  };
  await updatePhoto(rec);
  return rec;
}

/* ---------------- 커뮤니티 공유 ---------------- */
export async function shareToCommunity(photo /* dataUrl 또는 Blob */, zoneId = null) {
  const zones = await getZones();
  const file = photo instanceof Blob ? new File([photo], "hobanu.jpg", { type: photo.type || "image/jpeg" }) : photo;
  ui.showComposer({
    zones: zones.map((z) => ({ id: z.id, name: z.name })),
    zoneId,
    photo: file,
    title: "📤 호반우 사진 커뮤니티에 올리기",
    placeholder: "호반우와 찍은 사진에 한마디 남겨 볼까요?",
    onSubmit: (msg, ph, zid) => postCommunity(zid || null, getState().profile?.nickname || "익명", msg, ph, "post"),
  });
}

/* ---------------- 앨범 화면 ---------------- */
let styled = false;
function injectStyle() {
  if (styled) return;
  styled = true;
  const s = document.createElement("style");
  s.textContent = `
  .al-seg{display:flex;gap:6px;margin:10px 0 8px}
  .al-seg button{width:auto;flex:1;margin:0;padding:9px;border:none;border-radius:12px;background:var(--cream-weak,#f2f4f6);color:var(--sub,#4e5968);
    font-weight:800;font-size:var(--fs-sm, 13px);font-family:inherit}
  .al-seg button.on{background:var(--primary,#d4121a);color:#fff}
  .al-place{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line,#e5e8eb)}
  .al-place:first-child{border-top:none}
  .al-place .ap-ic{flex:none;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-size:var(--fs-2xl, 24px);background:var(--cream-weak,#f2f4f6)}
  .al-place.empty .ap-ic{filter:grayscale(1);opacity:.45}
  .al-place .ap-body{flex:1;min-width:0}
  .al-place .ap-body b{display:block;font-size:var(--fs-md, 15px)}
  .al-place .ap-body small{display:block;font-size:var(--fs-xs, 11px);color:var(--mute,#8b95a1)}
  .al-strip{display:flex;gap:6px;overflow-x:auto;margin-top:6px;scrollbar-width:none}
  .al-strip::-webkit-scrollbar{display:none}
  .al-th{flex:none;width:64px;height:64px;border-radius:10px;overflow:hidden;padding:0;margin:0;border:none;background:#ddd;cursor:pointer}
  .al-th img{width:100%;height:100%;object-fit:cover;display:block}
  .al-day{margin-top:12px}
  .al-day h4{margin:0 0 6px;font-size:var(--fs-sm, 13px)}
  .al-day h4 small{color:var(--mute,#8b95a1);font-weight:600;margin-left:6px}
  .al-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px}
  .al-grid .al-th{width:100%;height:auto;aspect-ratio:1}
  .al-left{margin:14px 0 0;padding-top:12px;border-top:1px solid var(--line,#e5e8eb)}
  .al-left h4{margin:0 0 10px;font-size:var(--fs-sm, 13px)}
  .al-left h4 small{color:var(--mute,#8b95a1);font-weight:600;margin-left:6px}
  .al-left-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 6px}
  .al-left-item{display:flex;flex-direction:column;align-items:center;gap:5px;text-align:center;font-size:var(--fs-xs, 11px);color:var(--mute,#8b95a1);word-break:keep-all;line-height:1.25}
  .al-left-item .ap-ic{width:44px;height:44px;display:grid;place-items:center;filter:grayscale(1);opacity:.45}
  .al-left-item .ap-ic .jelly{width:44px;height:44px}
  .al-empty{text-align:center;color:var(--mute,#8b95a1);font-size:var(--fs-sm, 13px);padding:18px 0 8px}
  #al-view{position:fixed;inset:0;z-index:2300;background:rgba(0,0,0,.92);display:flex;flex-direction:column;color:#fff;font-family:inherit}
  #al-view .av-top{display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top)) 14px 8px}
  #al-view .av-top b{flex:1;font-size:var(--fs-md, 15px)}
  #al-view .av-top small{display:block;font-size:var(--fs-sm, 13px);opacity:.75;font-weight:600}
  #al-view .av-img{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:0 10px}
  #al-view .av-img img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px}
  #al-view .av-btns{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px 14px calc(14px + env(safe-area-inset-bottom))}
  #al-view button{width:auto;margin:0;border:none;border-radius:14px;padding:12px 6px;background:rgba(255,255,255,.14);color:#fff;font-weight:800;font-size:var(--fs-sm, 13px);font-family:inherit}
  #al-view button.primary{background:var(--primary,#d4121a)}
  #al-view .av-x{width:40px;height:40px;padding:0;border-radius:50%;font-size:var(--fs-lg, 17px)}
  #al-view select{margin:0;border-radius:10px;padding:8px;font-family:inherit;font-size:var(--fs-md, 15px)}`;
  document.head.appendChild(s);
}
const DAY = (t) => new Date(t).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
const TIME = (t) => new Date(t).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });

// 앨범 칸을 slot 안에 그린다. opts.mascotId가 있으면 그 호반우와 찍은 사진만
export async function renderAlbum(slot, opts = {}) {
  if (!slot) return;
  injectStyle();
  const zones = await getZones();
  let photos = await listPhotos();
  if (opts.mascotId) photos = photos.filter((p) => p.mascotId === opts.mascotId);
  let mode = opts.mode || "place";
  const zoneOf = (id) => zones.find((z) => z.id === id);
  const th = (p) => `<button class="al-th" data-id="${p.id}"><img src="${p.thumb}" alt="" loading="lazy"></button>`;
  const draw = () => {
    let body = "";
    if (!photos.length) body = `<div class="al-empty">아직 기록한 사진이 없어요.<br>호반우와 사진을 찍고 <b>📒 도감에 기록</b>을 눌러 보세요!</div>`;
    else if (mode === "place") {
      const groups = [...zones.map((z) => ({ z, list: photos.filter((p) => p.zoneId === z.id) })),
        { z: { id: null, name: "장소 미정", emoji: "❔" }, list: photos.filter((p) => !p.zoneId || !zoneOf(p.zoneId)) }];
      // 사진이 있는 장소만 보여주고, 빈 장소는 맨 아래 한 줄로 (목록이 길게 늘어지지 않게)
      const empty = groups.filter((g) => g.z.id && !g.list.length).map((g) => g.z);
      body = groups.filter((g) => g.list.length).map(({ z, list }) => `
        <div class="al-place ${list.length ? "" : "empty"}">
          <div class="ap-ic">${zoneIcon(z)}</div>
          <div class="ap-body"><b>${z.name}</b><small>${list.length ? `사진 ${list.length}장 · 마지막 ${DAY(list[0].at)}` : "아직 찍은 사진이 없어요"}</small>
            ${list.length ? `<div class="al-strip">${list.map(th).join("")}</div>` : ""}</div>
        </div>`).join("");
      // 아직 사진이 없는 장소: 흐린 아이콘 칸으로 모아서 "다음에 찍으러 갈 곳"이 한눈에 보이게
      if (empty.length) body += `<div class="al-left"><h4>아직 사진이 없는 곳 <small>${empty.length}곳</small></h4>
        <div class="al-left-grid">${empty.map((z) => `<div class="al-left-item"><span class="ap-ic">${zoneIcon(z)}</span><span>${z.name}</span></div>`).join("")}</div></div>`;
    } else {
      const byDay = new Map();
      photos.forEach((p) => { const k = new Date(p.at).toDateString(); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(p); });
      body = [...byDay.values()].map((list) => `
        <div class="al-day"><h4>${DAY(list[0].at)}<small>${list.length}장</small></h4>
          <div class="al-grid">${list.map(th).join("")}</div></div>`).join("");
    }
    slot.innerHTML = `${opts.noSeg ? "" : `<div class="al-seg"><button data-m="place" class="${mode === "place" ? "on" : ""}">📍 장소별</button>
      <button data-m="date" class="${mode === "date" ? "on" : ""}">📅 날짜별</button></div>`}${body}`;
    slot.querySelectorAll(".al-seg button").forEach((b) => (b.onclick = () => { mode = b.dataset.m; draw(); }));
    slot.querySelectorAll(".al-th").forEach((b) => (b.onclick = () => openViewer(photos.find((p) => p.id === b.dataset.id), zones, async () => {
      photos = await listPhotos();
      if (opts.mascotId) photos = photos.filter((p) => p.mascotId === opts.mascotId);
      draw(); opts.onChange?.();
    })));
  };
  draw();
}

// 사진 크게 보기: 커뮤니티 공유 · 저장 · 장소 바꾸기 · 삭제
function openViewer(p, zones, onChange) {
  if (!p) return;
  injectStyle();
  document.getElementById("al-view")?.remove();
  const url = URL.createObjectURL(p.blob);
  const z = zones.find((q) => q.id === p.zoneId);
  const el = document.createElement("div");
  el.id = "al-view";
  el.innerHTML = `
    <div class="av-top"><b>${z ? `${z.emoji || "📍"} ${z.name}` : "❔ 장소 미정"}<small>${DAY(p.at)} ${TIME(p.at)}${p.mascotName ? ` · ${p.mascotName} 호반우` : ""}</small></b>
      <button class="av-x" data-a="x" aria-label="닫기">✕</button></div>
    <div class="av-img"><img src="${url}" alt="호반우 사진"></div>
    <div class="av-btns">
      <button class="primary" data-a="share">💬 공유</button>
      <button data-a="save">⬇ 저장</button>
      <button data-a="place">📍 장소</button>
      <button data-a="del">🗑 삭제</button>
    </div>`;
  document.body.appendChild(el);
  const close = () => { URL.revokeObjectURL(url); el.remove(); };
  el.querySelector('[data-a="x"]').onclick = close;
  el.querySelector('[data-a="share"]').onclick = () => { close(); shareToCommunity(p.blob, p.zoneId); };
  el.querySelector('[data-a="save"]').onclick = () => {
    const a = document.createElement("a");
    const d = new Date(p.at), q = (n) => String(n).padStart(2, "0");
    a.href = url; a.download = `호반우_${d.getFullYear()}${q(d.getMonth() + 1)}${q(d.getDate())}_${q(d.getHours())}${q(d.getMinutes())}.jpg`;
    document.body.appendChild(a); a.click(); a.remove();
    ui.toast("⬇ 저장했어요!");
  };
  el.querySelector('[data-a="place"]').onclick = (e) => {
    const box = e.currentTarget.parentElement;
    box.innerHTML = `<select style="grid-column:1/-1"><option value="">❔ 장소 미정</option>
      ${zones.map((q) => `<option value="${q.id}" ${q.id === p.zoneId ? "selected" : ""}>${q.emoji || ""} ${q.name}</option>`).join("")}</select>`;
    box.querySelector("select").onchange = async (ev) => {
      p.zoneId = ev.target.value || null;
      await updatePhoto(p);
      ui.toast("📍 장소를 바꿨어요");
      close(); onChange?.();
    };
  };
  el.querySelector('[data-a="del"]').onclick = async () => {
    if (!(await confirmDialog({ title: "이 사진을 지울까요?", message: "이 기기에서만 지워져요.", ok: "지우기", danger: true }))) return;
    await deletePhoto(p.id);
    close(); onChange?.();
  };
}