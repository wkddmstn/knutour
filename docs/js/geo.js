const EARTH_RADIUS = 6371000; // m
export const MAX_ACCURACY = 60; // 이보다 부정확하면 판정 보류

const toRad = (d) => (d * Math.PI) / 180;

// 두 좌표 사이 거리(m) - Haversine
export function distanceM(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

// a 지점에서 b 지점을 바라보는 방위각(도, 0=북/90=동/180=남/270=서)
export function bearingDeg(a, b) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// 점이 다각형 안에 있는지 (ray casting). poly는 [{lat,lng}, ...] 꼭짓점 배열(시계/반시계 상관없음)
// 건물 윤곽이나 길처럼 원이 아닌 모양의 구역을 쓸 때 사용한다.
export function pointInPolygon(point, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng, yi = poly[i].lat;
    const xj = poly[j].lng, yj = poly[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// 한 번의 위치값 판정: weak(부정확) / inside / outside
// zone.polygon(건물/길 윤곽 꼭짓점 배열)이 있으면 그 모양 기준으로, 없으면 zone.radius 원 기준으로 판정한다.
export function evaluate(pos, zone) {
  const distance = distanceM(pos, zone);
  const bearing = bearingDeg(pos, zone);
  if (pos.accuracy > MAX_ACCURACY) return { status: "weak", distance, bearing };
  const inside = zone.polygon && zone.polygon.length >= 3
    ? pointInPolygon(pos, zone.polygon)
    : distance <= zone.radius;
  return { status: inside ? "inside" : "outside", distance, bearing };
}

let watchId = null;
let handlers = null;
let mockMode = false; // 디버그 순간이동 후에는 실제 GPS 무시

export function startWatch(onUpdate, onError) {
  handlers = { onUpdate, onError };
  mockMode = false;
  if (!("geolocation" in navigator)) {
    onError({ code: "UNSUPPORTED" });
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      if (mockMode) return;
      onUpdate({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracy: p.coords.accuracy,
      });
    },
    (err) => {
      if (mockMode) return;
      const map = { 1: "DENIED", 2: "UNAVAILABLE", 3: "TIMEOUT" };
      onError({ code: map[err.code] || "UNKNOWN" });
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
  );
}

export function stopWatch() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  handlers = null;
}

// 디버그용: 가짜 위치 주입 (지도 클릭 시 호출)
export function injectMockPosition(lat, lng) {
  mockMode = true;
  handlers?.onUpdate({ lat, lng, accuracy: 5 });
}

// "N회 연속 inside"면 인증 성공으로 알려주는 헬퍼
export function createVerifier(zone, needed = 3, onVerified) {
  let streak = 0;
  return (pos) => {
    const result = evaluate(pos, zone);
    streak = result.status === "inside" ? streak + 1 : 0;
    if (streak >= needed) onVerified();
    return { ...result, streak };
  };
}
// 두 좌표 사이를 비율(t: 0~1)로 보간 — 애니메이션 이동에 사용
export function lerp(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

// 중심점에서 distanceM(m)만큼, bearingDegVal(도) 방향으로 떨어진 좌표 계산 — 데모 출발점 생성용
export function offsetPoint(center, distanceM, bearingDegVal) {
  const br = toRad(bearingDegVal);
  const angularDist = distanceM / EARTH_RADIUS;
  const lat1 = toRad(center.lat), lng1 = toRad(center.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDist) + Math.cos(lat1) * Math.sin(angularDist) * Math.cos(br)
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(br) * Math.sin(angularDist) * Math.cos(lat1),
    Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2)
  );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}