// js/campusmap.js — 캠퍼스 일러스트 지도
// 실제 지도 타일 대신, OpenStreetMap에서 받아 둔 경북대 도로·건물·잔디·물 모양(data/campus-map.json)을
// 글자 없는 플랫 스타일 SVG로 직접 그린다. 키·사용량 제한 없이 동작하고, 색은 style.css의 --map-* 토큰을 쓴다.
//
// 조작: 드래그로 이동 · 두 손가락(핀치)/마우스 휠/더블탭으로 확대 · 오른쪽 아래 +, −, 전체 보기 버튼
// 확대하면 건물·잔디·연못 이름과 장소 이름이 나타난다 (겹치는 이름은 큰 건물 것부터 보여 줌).
//
// 사용법
//   await loadCampusData();                         // 앱 시작할 때 한 번
//   const cm = new CampusMap(div);                  // div 크기에 맞춰 그림
//   cm.setZones(zones, { status, onSelect });       // 장소 핀
//   cm.setMe({ lat, lng });  cm.setRoute([{lat,lng}, ...]);  cm.setArea(zone);  cm.setMarks([{lat,lng,cls,html}])
//   cm.fit([{lat,lng}, ...], 여백m) / cm.fitCampus()
//   cm.destroy();
//
// 핀·이름·내 위치·말풍선은 SVG 위에 HTML로 얹는다 (확대해도 크기가 그대로라 읽기·누르기 좋음).
import { icon, hasIcon } from "./icons.js";   // 핀 안 젤리 아이콘 (장소 id 또는 z.icon)

let data = null;
export async function loadCampusData() {
  if (data) return data;
  const raw = await (await fetch("data/campus-map.json")).json();
  const [lat0, lng0] = raw.origin, u = raw.unit;
  const feats = raw.f.map(([kind, name, ...xs]) => {
    const pts = [];
    for (let i = 0; i < xs.length; i += 2) pts.push([lat0 + xs[i] * u, lng0 + xs[i + 1] * u]);
    return { kind, name, pts };
  });
  const campus = feats.find((f) => f.kind === "u");
  // 지도에 그려진 전체 범위 (캠퍼스 밖 맛집 거리까지). 이 안에서만 끌어서 이동할 수 있다
  let bounds = null;   // (점이 수만 개라 Math.min(...배열) 대신 한 번씩 훑는다)
  for (const f of feats) for (const [la, ln] of f.pts) {
    if (!bounds) bounds = { s: la, n: la, w: ln, e: ln };
    else { bounds.s = Math.min(bounds.s, la); bounds.n = Math.max(bounds.n, la); bounds.w = Math.min(bounds.w, ln); bounds.e = Math.max(bounds.e, ln); }
  }
  data = { feats, campus, bounds, src: raw.src, labels: buildLabels(feats) };
  return data;
}
export const campusDataReady = () => !!data;

// 위도·경도 → 미터 단위 평면 좌표 (북쪽이 위). 캠퍼스 정도 넓이에선 이 근사로 충분하다.
const LAT0 = 35.89, LNG0 = 128.61;
const MY = 111320, MX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const px = (lng) => (lng - LNG0) * MX;
const py = (lat) => (LAT0 - lat) * MY;
const unx = (x) => x / MX + LNG0;
const uny = (y) => LAT0 - y / MY;

const ROAD_W = { trunk: 18, primary: 16, primary_link: 10, secondary: 14, secondary_link: 10, tertiary: 11, tertiary_link: 8,
                 residential: 8, unclassified: 7, living_street: 7, service: 7, pedestrian: 8, cycleway: 4, path: 3, footway: 3 };
const pathOf = (pts, close) => pts.map(([la, ln], i) => `${i ? "L" : "M"}${px(ln).toFixed(1)} ${py(la).toFixed(1)}`).join("") + (close ? "Z" : "");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 확대 단계 (1m가 화면에서 몇 px인지)
const MAX_SCALE = 4;           // 이 이상은 확대하지 않음
const LABEL_BIG = 0.5;         // 이만큼 확대하면 큰 건물·잔디·연못 이름부터
const LABEL_ALL = 0.95;        // 이만큼 확대하면 작은 건물 이름까지
const ZONE_NAME = 0.5;         // 장소 핀 아래에 장소 이름 표시

// 이름표 목록: 이름이 있는 건물·잔디·연못의 무게중심과 넓이
function buildLabels(feats) {
  const out = [];
  for (const f of feats) {
    if (!f.name || !["b", "g", "w"].includes(f.kind)) continue;
    // 다각형 넓이·무게중심 (미터 좌표)
    const P = f.pts.map(([la, ln]) => [px(ln), py(la)]);
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[i + 1];
      const c = x1 * y2 - x2 * y1;
      a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c;
    }
    if (Math.abs(a) < 1e-6) continue;
    a /= 2; cx /= 6 * a; cy /= 6 * a;
    // "대운동장 (Main Playground)"처럼 괄호 붙은 이름은 앞부분만
    const name = f.name.replace(/\s*\(.*$/, "").replace(/^경북대학교\s*/, "").trim();
    if (name) out.push({ name, kind: f.kind, x: cx, y: cy, area: Math.abs(a) });
  }
  return out.sort((p, q) => q.area - p.area);   // 큰 것부터 (겹칠 때 큰 건물 이름이 이김)
}

// 지도 바탕(도로·건물 등)은 한 번만 문자열로 만들어 두고 재사용
let baseSvg = null;
function buildBase() {
  if (baseSvg) return baseSvg;
  const { feats, campus } = data;
  const by = (k) => feats.filter((f) => f.kind === k);
  const roads = feats.filter((f) => f.kind.startsWith("h:"));
  // 큰길 → 작은길 순서로 그려야 교차점이 자연스럽다
  const order = ["footway", "path", "cycleway", "service", "living_street", "pedestrian", "unclassified", "residential",
                 "tertiary_link", "tertiary", "secondary_link", "secondary", "primary_link", "primary", "trunk"];
  roads.sort((a, b) => order.indexOf(a.kind.slice(2)) - order.indexOf(b.kind.slice(2)));
  baseSvg = `
    <rect class="cm-bg" x="-5000" y="-5000" width="10000" height="10000"/>
    ${campus ? `<path class="cm-campus" d="${pathOf(campus.pts, true)}"/>` : ""}
    ${by("g").map((f) => `<path class="cm-green" d="${pathOf(f.pts, true)}"/>`).join("")}
    ${by("w").map((f) => `<path class="cm-water" d="${pathOf(f.pts, true)}"/>`).join("")}
    ${roads.map((f) => {
      const t = f.kind.slice(2);
      return `<path class="cm-road ${t === "footway" || t === "path" ? "foot" : ""}" stroke-width="${ROAD_W[t] || 6}" d="${pathOf(f.pts, false)}"/>`;
    }).join("")}
    ${by("b").map((f) => `<path class="cm-bldg" d="${pathOf(f.pts, true)}"/>`).join("")}`;
  return baseSvg;
}

const ICON_PLUS = `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`;
const ICON_MINUS = `<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>`;
const ICON_FIT = `<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`;

export class CampusMap {
  // labelAt: 이름표가 나타나는 확대 기준을 바꿀 때 { big, all, zone } (작은 지도에선 더 일찍 보이게)
  constructor(el, { onMapClick = null, interactive = true, labelAt = {} } = {}) {
    if (!data) throw new Error("loadCampusData()를 먼저 불러 주세요");
    this.el = el;
    el.classList.add("campus-map");
    el.innerHTML = `
      <svg class="cm-svg" preserveAspectRatio="none" aria-hidden="true">
        <g class="cm-base">${buildBase()}</g>
        <g class="cm-over"></g>
      </svg>
      <div class="cm-labels" aria-hidden="true"></div>
      <div class="cm-layer"></div>
      ${interactive ? `<div class="cm-ctrl">
        <button type="button" data-z="in" aria-label="확대">${ICON_PLUS}</button>
        <button type="button" data-z="out" aria-label="축소">${ICON_MINUS}</button>
        <button type="button" data-z="fit" aria-label="처음 보기로">${ICON_FIT}</button>
      </div>` : ""}
      <div class="cm-attr">© OpenStreetMap</div>`;
    this.svg = el.querySelector(".cm-svg");
    this.over = el.querySelector(".cm-over");
    this.layer = el.querySelector(".cm-layer");
    this.labelBox = el.querySelector(".cm-labels");
    this.pins = [];       // { lat, lng, node, name }
    this.me = null;
    this.target = null;   // 마지막으로 맞춘 영역 (처음 보기 / 크기 변경 때 사용)
    this.moved = false;   // 사용자가 직접 확대·이동했는지
    this.onMapClick = onMapClick;
    this.at = { big: LABEL_BIG, all: LABEL_ALL, zone: ZONE_NAME, ...labelAt };
    this.ro = new ResizeObserver(() => this.refit(true));
    this.ro.observe(el);
    if (interactive) this.bindGestures();
    else if (onMapClick) this.svg.addEventListener("click", (e) => this.onMapClick(this.toLatLng(e.clientX, e.clientY)));
    this.fitCampus();
  }

  toLatLng(clientX, clientY) {
    const r = this.el.getBoundingClientRect();
    return { lat: uny(this.vb.y + ((clientY - r.top) / r.height) * this.vb.h),
             lng: unx(this.vb.x + ((clientX - r.left) / r.width) * this.vb.w) };
  }
  get scale() { return this.vb ? this.el.clientWidth / this.vb.w : 1; }   // 1m = 몇 px

  // ----- 보이는 영역 맞추기 -----
  // pts: [{lat,lng}...] 를 모두 담도록, 그리고 상자 비율에 맞게 넓혀서 viewBox를 정한다
  fit(pts, padM = 40) {
    this.target = { pts, padM };
    this.moved = false;
    this.refit();
  }
  fitCampus() {
    const c = data.campus;
    if (c) this.fit(c.pts.map(([lat, lng]) => ({ lat, lng })), 30);
  }
  refit(fromResize = false) {
    const W = this.el.clientWidth, H = this.el.clientHeight;
    if (!W || !H) return;   // 접혀 있으면(높이 0) 펼쳐질 때 다시 맞춤
    // 사용자가 확대·이동한 상태에서 상자 크기만 바뀌면, 가운데와 배율을 유지한다
    if (fromResize && this.moved && this.vb) {
      const s = this.vbScale, cx = this.vb.x + this.vb.w / 2, cy = this.vb.y + this.vb.h / 2;
      return this.setVB(cx - W / s / 2, cy - H / s / 2, W / s, H / s);
    }
    if (!this.target) return;
    const xs = this.target.pts.map((p) => px(p.lng)), ys = this.target.pts.map((p) => py(p.lat));
    const pad = this.target.padM;
    let x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
    let w = x1 - x0, h = y1 - y0;
    const want = W / H;
    if (w / h < want) { const nw = h * want; x0 -= (nw - w) / 2; w = nw; }
    else { const nh = w / want; y0 -= (nh - h) / 2; h = nh; }
    this.minScale = Math.min(W / w, this.campusScale(W, H)) * 0.6;   // 이보다 더 축소하지 않음 (캠퍼스 주변까지 보이게 조금 더 축소 가능)
    this.setVB(x0, y0, w, h);
  }
  // 캠퍼스 전체가 꼭 맞게 보이는 배율
  campusScale(W, H) {
    const c = data.campus;
    if (!c) return 0.2;
    const xs = c.pts.map(([, ln]) => px(ln)), ys = c.pts.map(([la]) => py(la));
    return Math.min(W / (Math.max(...xs) - Math.min(...xs) + 60), H / (Math.max(...ys) - Math.min(...ys) + 60));
  }
  setVB(x, y, w, h) {
    this.vb = { x, y, w, h };
    this.vbScale = this.el.clientWidth / w;
    this.svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
    this.place();
  }

  // ----- 확대·이동 -----
  // 화면의 (clientX, clientY) 지점을 고정한 채로 factor배 확대 (factor<1이면 축소)
  zoomAt(factor, clientX, clientY) {
    const r = this.el.getBoundingClientRect();
    const s0 = this.scale;
    const s1 = Math.min(MAX_SCALE, Math.max(this.minScale || 0.1, s0 * factor));
    if (s1 === s0) return;
    const fx = (clientX - r.left) / r.width, fy = (clientY - r.top) / r.height;
    const mx = this.vb.x + fx * this.vb.w, my = this.vb.y + fy * this.vb.h;
    const w = r.width / s1, h = r.height / s1;
    this.moved = true;
    this.setVB(mx - fx * w, my - fy * h, w, h);
    this.clampPan();
  }
  panBy(dxPx, dyPx) {
    const s = this.scale;
    this.moved = true;
    this.setVB(this.vb.x - dxPx / s, this.vb.y - dyPx / s, this.vb.w, this.vb.h);
    this.clampPan();
  }
  // 캠퍼스 밖으로 너무 멀리 끌려가지 않게
  clampPan() {
    const b = data.bounds;
    if (!b) return;
    // 지도 데이터가 있는 범위(캠퍼스 주변 맛집 거리 포함) 안에서만 가운데가 움직이게
    const [x0, x1, y0, y1] = [px(b.w), px(b.e), py(b.n), py(b.s)];
    let { x, y, w, h } = this.vb;
    const cx = Math.min(Math.max(x + w / 2, x0), x1), cy = Math.min(Math.max(y + h / 2, y0), y1);
    if (cx !== x + w / 2 || cy !== y + h / 2) this.setVB(cx - w / 2, cy - h / 2, w, h);
  }
  center() {
    const r = this.el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  bindGestures() {
    const el = this.el;
    const ptrs = new Map();     // 화면에 닿아 있는 손가락/마우스
    let start = null;           // 이동 시작 정보
    let dragged = false;        // 조금이라도 움직였으면 클릭으로 치지 않음
    let lastTap = 0;

    const onDown = (e) => {
      if (e.target.closest(".cm-ctrl, .cm-bubble")) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { dragged = false; start = { x: e.clientX, y: e.clientY }; }
      if (ptrs.size === 2) start = { pinch: this.pinchInfo(ptrs) };
    };
    const onMove = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) {
        if (!dragged && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) {
          dragged = true;
          el.classList.add("dragging");
          try { el.setPointerCapture(e.pointerId); } catch {}
        }
        if (dragged) this.panBy(e.clientX - prev.x, e.clientY - prev.y);
      } else if (ptrs.size === 2 && start?.pinch) {
        dragged = true;
        const now = this.pinchInfo(ptrs);
        this.panBy(now.cx - start.pinch.cx, now.cy - start.pinch.cy);
        this.zoomAt(now.d / start.pinch.d, now.cx, now.cy);
        start.pinch = now;
      }
    };
    const onUp = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size === 1) { const [p] = ptrs.values(); start = { x: p.x, y: p.y }; }   // 핀치 → 한 손가락 이동으로
      if (ptrs.size === 0) {
        el.classList.remove("dragging");
        if (!dragged && e.type === "pointerup") {
          // 빠르게 두 번 탭하면 그 자리를 확대
          const now = Date.now();
          if (now - lastTap < 300) { this.zoomAt(2, e.clientX, e.clientY); lastTap = 0; }
          else lastTap = now;
        }
      }
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    // 끌어서 이동한 직후의 클릭(핀 열기 등)은 무시
    el.addEventListener("click", (e) => {
      if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; return; }
      if (this.onMapClick && !e.target.closest(".cm-layer > *, .cm-ctrl")) this.onMapClick(this.toLatLng(e.clientX, e.clientY));
    }, true);
    // 마우스 휠 / 트랙패드 확대
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)), e.clientX, e.clientY);
    }, { passive: false });
    el.querySelector(".cm-ctrl")?.addEventListener("click", (e) => {
      const b = e.target.closest("[data-z]");
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.z === "fit") this.fit(this.target.pts, this.target.padM);
      else this.zoomAt(b.dataset.z === "in" ? 1.8 : 1 / 1.8, ...this.center());
    });
  }
  pinchInfo(ptrs) {
    const [a, b] = [...ptrs.values()];
    return { d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  // HTML 핀·이름표를 현재 영역에 맞는 자리(%)로 옮긴다
  place() {
    if (!this.vb) return;
    const put = (node, lat, lng) => {
      node.style.left = ((px(lng) - this.vb.x) / this.vb.w) * 100 + "%";
      node.style.top = ((py(lat) - this.vb.y) / this.vb.h) * 100 + "%";
    };
    this.pins.forEach((p) => put(p.node, p.lat, p.lng));
    if (this.me) put(this.me.node, this.me.lat, this.me.lng);
    (this.marks || []).forEach((m) => put(m.node, m.lat, m.lng));
    if (this.bubble) put(this.bubble.node, this.bubble.lat, this.bubble.lng);
    this.el.classList.toggle("show-zone-names", this.scale >= this.at.zone);
    this.drawClusters();
    if (!this._labelRaf) this._labelRaf = requestAnimationFrame(() => { this._labelRaf = 0; this.drawLabels(); });
  }

  // 확대 정도에 따라 건물·잔디·연못 이름 표시. 서로 겹치면 큰 것 하나만.
  drawLabels() {
    const s = this.scale, box = this.labelBox;
    if (!box || !this.vb) return;
    if (s < this.at.big) { box.innerHTML = ""; return; }
    const W = this.el.clientWidth, H = this.el.clientHeight;
    const minArea = s >= this.at.all ? 0 : 1800;   // 덜 확대했을 땐 큰 건물(약 1,800㎡ 이상)만
    const taken = [];
    // 장소 핀 자리는 비워 둔다
    this.pins.forEach((p) => {
      const x = (px(p.lng) - this.vb.x) * s, y = (py(p.lat) - this.vb.y) * s;
      taken.push([x - 22, y - 50, x + 22, y + (s >= this.at.zone ? 18 : 0)]);
    });
    const html = [];
    for (const l of data.labels) {
      if (l.area < minArea) continue;
      const x = (l.x - this.vb.x) * s, y = (l.y - this.vb.y) * s;
      const w = l.name.length * 11 + 8, h = 16;   // 글자 수로 대략적인 크기
      const r = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
      if (r[0] < 2 || r[1] < 2 || r[2] > W - 2 || r[3] > H - 2) continue;   // 가장자리에서 잘리는 이름은 숨김
      if (taken.some((t) => r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1])) continue;
      taken.push(r);
      html.push(`<span class="cm-label ${l.kind}" style="left:${x}px;top:${y}px">${esc(l.name)}</span>`);
    }
    box.innerHTML = html.join("");
  }

  // ----- 장소 핀 -----
  // status(zone) → "cleared" | "next" | "" , onSelect(zone)
  // status: "cleared" | "next" | "locked"(다른 테마 장소, 누르면 lockNote 안내만) | ""
  // cluster: 핀이 많을 때(맛집 지도) 화면에서 겹치는 핀들을 "숫자 동그라미"로 묶는다. 확대할수록 풀린다.
  //   { radius: 묶는 거리(px), skip: (z) => true면 안 묶음(문 표시·선택한 가게 등) }. 안 주면 묶지 않는다.
  setZones(zones, { status = () => "", onSelect = null, bubble = true, lockNote = () => "", cluster = null } = {}) {
    this.pins.forEach((p) => p.node.remove());
    this.cluster = cluster;
    this.pins = zones.map((z) => {
      const st = status(z);
      const node = document.createElement("button");
      node.type = "button";
      node.className = `cm-pin ${st}`;
      node.setAttribute("aria-label", `${z.name}${st === "cleared" ? " (클리어)" : ""}`);
      node.innerHTML = `<span class="cm-pin-head"><span class="cm-pin-emoji">${hasIcon(z.icon || z.id) ? icon(z.icon || z.id, { bg: false }) : esc(z.emoji || "📍")}</span></span>
        ${st === "cleared" ? '<span class="cm-pin-check">✓</span>' : ""}
        ${st === "locked" ? '<span class="cm-pin-check cm-pin-lock">🔒</span>' : ""}
        <span class="cm-pin-name">${esc(z.name)}</span>`;
      node.onclick = (e) => {
        e.stopPropagation();
        if (st === "locked") { this.showBubble(z, st, null, lockNote(z)); return; }
        if (!onSelect) return;
        if (bubble) this.showBubble(z, st, onSelect); else onSelect(z);
      };
      this.layer.appendChild(node);
      return { lat: z.lat, lng: z.lng, node, z };
    });
    this.place();
  }

  // ----- 핀 묶기 (숫자 동그라미) -----
  // 지금 확대 정도에서 화면상 radius px 안에 모인 핀들을 한 묶음으로. 앞에서부터 차례로 묶는 단순한 방식(핀 100개 안팎이면 충분히 빠름).
  // 같은 건물처럼 사실상 같은 자리(8m 안)에 있는 핀은 아무리 확대해도 안 풀리니 묶지 않고 그대로 둔다.
  drawClusters() {
    const pool = (this.clusterNodes ||= []);
    let used = 0;
    if (this.cluster) {
      const s = this.scale, R = this.cluster.radius || 44, skip = this.cluster.skip || (() => false);
      const pts = this.pins.filter((p) => !skip(p.z)).map((p) => ({ p, x: (px(p.lng) - this.vb.x) * s, y: (py(p.lat) - this.vb.y) * s }));
      // 핀 하나하나를 묶음으로 시작해서, 중심끼리 R보다 가까운 두 묶음을 더 이상 없을 때까지 합친다 (숫자 동그라미끼리도 안 겹치게)
      let groups = pts.map((b) => ({ m: [b], x: b.x, y: b.y }));
      for (let merged = true; merged;) {
        merged = false;
        for (let i = 0; i < groups.length && !merged; i++) {
          for (let j = i + 1; j < groups.length; j++) {
            const A = groups[i], B = groups[j];
            if (Math.hypot(A.x - B.x, A.y - B.y) > R) continue;
            const m = [...A.m, ...B.m];
            groups[i] = { m, x: m.reduce((t, b) => t + b.x, 0) / m.length, y: m.reduce((t, b) => t + b.y, 0) / m.length };
            groups.splice(j, 1);
            merged = true;
            break;
          }
        }
      }
      const taken = new Set();
      for (const { m: group } of groups) {
        if (group.length < 2) continue;
        const spreadM = Math.max(...group.flatMap((b) => group.map((c) => Math.hypot(b.x - c.x, b.y - c.y)))) / s;
        if (spreadM < 8) continue;
        group.forEach((b) => { taken.add(b); b.p.node.classList.add("cm-clustered"); });
        let node = pool[used];
        if (!node) {
          node = pool[used] = document.createElement("button");
          node.type = "button";
          node.className = "cm-cluster";
          this.layer.appendChild(node);
        }
        used++;
        const n = group.length;
        node.hidden = false;
        node.textContent = n;
        node.setAttribute("aria-label", `가게 ${n}곳 모여 있음, 눌러서 확대`);
        node.style.setProperty("--n", Math.min(n, 30));
        node.style.left = (group.reduce((t, b) => t + b.x, 0) / n / this.el.clientWidth) * 100 + "%";
        node.style.top = (group.reduce((t, b) => t + b.y, 0) / n / this.el.clientHeight) * 100 + "%";
        const members = group.map((b) => ({ lat: b.p.lat, lng: b.p.lng }));
        node.onclick = (e) => { e.stopPropagation(); this.fit(members, 30); };
      }
      this.pins.forEach((p) => { if (!pts.some((b) => b.p === p && taken.has(b))) p.node.classList.remove("cm-clustered"); });
    } else {
      this.pins.forEach((p) => p.node.classList.remove("cm-clustered"));
    }
    for (let i = used; i < pool.length; i++) pool[i].hidden = true;
  }
  // 핀을 누르면 뜨는 작은 말풍선: 장소 이름 + "미션 보기"
  showBubble(z, st, onSelect, note = "") {
    this.hideBubble();
    const node = document.createElement("div");
    node.className = "cm-bubble";
    node.innerHTML = st === "locked"
      ? `<b>${esc(z.emoji || "")} ${esc(z.name)}</b><span class="cm-bubble-note">🔒 ${esc(note)}</span>`
      : `<b>${esc(z.emoji || "")} ${esc(z.name)}</b>
      <button type="button">${st === "cleared" ? "다시 보기" : "미션 보기"}</button>`;
    node.querySelector("button")?.addEventListener("click", (e) => { e.stopPropagation(); onSelect(z); });
    node.onclick = (e) => e.stopPropagation();
    this.layer.appendChild(node);
    this.bubble = { lat: z.lat, lng: z.lng, node };
    this.place();
    // 지도 다른 곳을 누르면 닫힘 (끌어서 이동한 건 제외)
    setTimeout(() => {
      this._closeBubble = (e) => { if (!e.target.closest(".cm-bubble")) this.hideBubble(); };
      this.el.addEventListener("click", this._closeBubble);
    });
  }
  hideBubble() {
    this.bubble?.node.remove();
    this.bubble = null;
    if (this._closeBubble) { this.el.removeEventListener("click", this._closeBubble); this._closeBubble = null; }
  }

  // ----- 인증 영역 (원 또는 건물 윤곽) -----
  setArea(zone) {
    this.over.querySelector(".cm-area")?.remove();
    if (!zone) return;
    let shape;
    if (zone.polygon && zone.polygon.length >= 3) {
      shape = `<path class="cm-area" d="${pathOf(zone.polygon.map((p) => [p.lat, p.lng]), true)}"/>`;
    } else {
      shape = `<circle class="cm-area" cx="${px(zone.lng)}" cy="${py(zone.lat)}" r="${zone.radius || 50}"/>`;
    }
    this.over.insertAdjacentHTML("afterbegin", shape);
  }

  // ----- 경로 (점선) -----
  setRoute(points) {
    this.over.querySelector(".cm-route")?.remove();
    if (!points?.length) return;
    this.over.insertAdjacentHTML("beforeend",
      `<path class="cm-route" d="${pathOf(points.map((p) => [p.lat, p.lng]), false)}"/>`);
  }

  // ----- 추가 표시 (함께 돌기 체크포인트·친구 위치 등) -----
  // marks: [{ lat, lng, cls, html }] — 부를 때마다 통째로 바꾼다. 빈 배열이면 모두 지움.
  setMarks(marks = []) {
    (this.marks || []).forEach((m) => m.node.remove());
    this.marks = marks.map((m) => {
      const node = document.createElement("div");
      node.className = "cm-mark " + (m.cls || "");
      node.innerHTML = m.html || "";
      this.layer.appendChild(node);
      return { ...m, node };
    });
    this.place();
  }

  // ----- 내 위치 -----
  setMe(pos) {
    if (!pos) { this.me?.node.remove(); this.me = null; return; }
    if (!this.me) {
      const node = document.createElement("div");
      node.className = "cm-me";
      node.innerHTML = "<i></i>";
      this.layer.appendChild(node);
      this.me = { node };
    }
    this.me.lat = pos.lat;
    this.me.lng = pos.lng;
    this.place();
  }

  destroy() {
    this.ro.disconnect();
    if (this._labelRaf) cancelAnimationFrame(this._labelRaf);
    this.hideBubble();
    this.el.innerHTML = "";
    this.el.classList.remove("campus-map", "dragging", "show-zone-names");
    this.el.style.removeProperty("--cm-scale");
  }
}