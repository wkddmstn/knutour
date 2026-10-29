// js/campusmap.js — 캠퍼스 일러스트 지도
// 실제 지도 타일 대신, OpenStreetMap에서 받아 둔 경북대 도로·건물·잔디·물 모양(data/campus-map.json)을
// 글자 없는 플랫 스타일 SVG로 직접 그린다. 키·사용량 제한 없이 동작하고, 색은 style.css의 --map-* 토큰을 쓴다.
//
// 사용법
//   await loadCampusData();                         // 앱 시작할 때 한 번
//   const cm = new CampusMap(div);                  // div 크기에 맞춰 그림
//   cm.setZones(zones, { status, onSelect });       // 장소 핀
//   cm.setMe({ lat, lng });  cm.setRoute([{lat,lng}, ...]);  cm.setArea(zone);
//   cm.fit([{lat,lng}, ...], 여백m) / cm.fitCampus()
//   cm.destroy();
//
// 핀·내 위치·말풍선은 SVG 위에 HTML로 얹는다 (확대해도 크기가 그대로라 손가락으로 누르기 좋음).

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
  data = { feats, campus, src: raw.src };
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

const ROAD_W = { secondary: 14, secondary_link: 10, tertiary: 11, residential: 8, living_street: 7,
                 service: 7, pedestrian: 8, cycleway: 4, path: 3, footway: 3 };
const pathOf = (pts, close) => pts.map(([la, ln], i) => `${i ? "L" : "M"}${px(ln).toFixed(1)} ${py(la).toFixed(1)}`).join("") + (close ? "Z" : "");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 지도 바탕(도로·건물 등)은 한 번만 문자열로 만들어 두고 재사용
let baseSvg = null;
function buildBase() {
  if (baseSvg) return baseSvg;
  const { feats, campus } = data;
  const by = (k) => feats.filter((f) => f.kind === k);
  const roads = feats.filter((f) => f.kind.startsWith("h:"));
  // 큰길 → 작은길 순서로 그려야 교차점이 자연스럽다
  const order = ["footway", "path", "cycleway", "service", "living_street", "pedestrian", "residential", "tertiary", "secondary_link", "secondary"];
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

export class CampusMap {
  constructor(el, { onMapClick = null } = {}) {
    if (!data) throw new Error("loadCampusData()를 먼저 불러 주세요");
    this.el = el;
    el.classList.add("campus-map");
    el.innerHTML = `
      <svg class="cm-svg" preserveAspectRatio="none" aria-hidden="true">
        <g class="cm-base">${buildBase()}</g>
        <g class="cm-over"></g>
      </svg>
      <div class="cm-layer"></div>
      <div class="cm-attr">© OpenStreetMap</div>`;
    this.svg = el.querySelector(".cm-svg");
    this.over = el.querySelector(".cm-over");
    this.layer = el.querySelector(".cm-layer");
    this.pins = [];       // { lat, lng, node }
    this.me = null;
    this.target = null;   // 마지막으로 맞춘 영역 (크기가 바뀌면 다시 맞춘다)
    this.ro = new ResizeObserver(() => this.refit());
    this.ro.observe(el);
    if (onMapClick) {
      this.svg.addEventListener("click", (e) => {
        const r = this.svg.getBoundingClientRect();
        const x = this.vb.x + ((e.clientX - r.left) / r.width) * this.vb.w;
        const y = this.vb.y + ((e.clientY - r.top) / r.height) * this.vb.h;
        onMapClick({ lat: uny(y), lng: unx(x) });
      });
    }
    this.fitCampus();
  }

  // ----- 보이는 영역 맞추기 -----
  // pts: [{lat,lng}...] 를 모두 담도록, 그리고 상자 비율에 맞게 넓혀서 viewBox를 정한다
  fit(pts, padM = 40) {
    this.target = { pts, padM };
    this.refit();
  }
  fitCampus() {
    const c = data.campus;
    if (c) this.fit(c.pts.map(([lat, lng]) => ({ lat, lng })), 30);
  }
  refit() {
    if (!this.target) return;
    const W = this.el.clientWidth, H = this.el.clientHeight;
    if (!W || !H) return;   // 접혀 있으면(높이 0) 펼쳐질 때 다시 맞춤
    const xs = this.target.pts.map((p) => px(p.lng)), ys = this.target.pts.map((p) => py(p.lat));
    const pad = this.target.padM;
    let x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
    let w = x1 - x0, h = y1 - y0;
    const want = W / H;
    if (w / h < want) { const nw = h * want; x0 -= (nw - w) / 2; w = nw; }
    else { const nh = w / want; y0 -= (nh - h) / 2; h = nh; }
    this.vb = { x: x0, y: y0, w, h };
    this.svg.setAttribute("viewBox", `${x0} ${y0} ${w} ${h}`);
    this.el.style.setProperty("--cm-scale", (W / w).toFixed(4));   // 1m가 몇 px인지 (선 굵기 보정용)
    this.place();
  }
  // HTML 핀들을 현재 영역에 맞는 자리(%)로 옮긴다
  place() {
    if (!this.vb) return;
    const put = (node, lat, lng) => {
      node.style.left = ((px(lng) - this.vb.x) / this.vb.w) * 100 + "%";
      node.style.top = ((py(lat) - this.vb.y) / this.vb.h) * 100 + "%";
    };
    this.pins.forEach((p) => put(p.node, p.lat, p.lng));
    if (this.me) put(this.me.node, this.me.lat, this.me.lng);
    if (this.bubble) put(this.bubble.node, this.bubble.lat, this.bubble.lng);
  }

  // ----- 장소 핀 -----
  // status(zone) → "cleared" | "next" | "" , onSelect(zone)
  setZones(zones, { status = () => "", onSelect = null, bubble = true } = {}) {
    this.pins.forEach((p) => p.node.remove());
    this.pins = zones.map((z) => {
      const st = status(z);
      const node = document.createElement("button");
      node.type = "button";
      node.className = `cm-pin ${st}`;
      node.setAttribute("aria-label", `${z.name}${st === "cleared" ? " (클리어)" : ""}`);
      node.innerHTML = `<span class="cm-pin-head"><span class="cm-pin-emoji">${esc(z.emoji || "📍")}</span></span>
        ${st === "cleared" ? '<span class="cm-pin-check">✓</span>' : ""}`;
      node.onclick = (e) => {
        e.stopPropagation();
        if (!onSelect) return;
        if (bubble) this.showBubble(z, st, onSelect); else onSelect(z);
      };
      this.layer.appendChild(node);
      return { lat: z.lat, lng: z.lng, node };
    });
    this.place();
  }
  // 핀을 누르면 뜨는 작은 말풍선: 장소 이름 + "미션 보기"
  showBubble(z, st, onSelect) {
    this.hideBubble();
    const node = document.createElement("div");
    node.className = "cm-bubble";
    node.innerHTML = `<b>${esc(z.emoji || "")} ${esc(z.name)}</b>
      <button type="button">${st === "cleared" ? "다시 보기" : "미션 보기"}</button>`;
    node.querySelector("button").onclick = (e) => { e.stopPropagation(); onSelect(z); };
    node.onclick = (e) => e.stopPropagation();
    this.layer.appendChild(node);
    this.bubble = { lat: z.lat, lng: z.lng, node };
    this.place();
    this._closeBubble = () => this.hideBubble();
    this.el.addEventListener("click", this._closeBubble, { once: true });
  }
  hideBubble() {
    this.bubble?.node.remove();
    this.bubble = null;
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
    if (this._closeBubble) this.el.removeEventListener("click", this._closeBubble);
    this.el.innerHTML = "";
    this.el.classList.remove("campus-map");
    this.el.style.removeProperty("--cm-scale");
  }
}