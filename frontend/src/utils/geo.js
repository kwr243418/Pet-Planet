// 위치 계산 유틸 — 백엔드 ST_Distance_Sphere · 적재기의 정류장 거리 계산(하버사인)과 같은 공식이에요.

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

/** 두 좌표 간 거리(km) — 하버사인 공식 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** 기준 좌표에서 북쪽 dyM, 동쪽 dxM 미터만큼 떨어진 좌표 */
export function offsetMeters(lat, lng, dxM, dyM) {
  const dLat = dyM / 111_320;
  const dLng = dxM / (111_320 * Math.cos(toRad(lat)));
  return { lat: lat + dLat, lng: lng + dLng };
}

/** 성인 도보 평균 약 4km/h(=67m/분) 기준 도보 시간(분) */
export function walkingMinutes(km) {
  return Math.max(1, Math.ceil((km * 1000) / 67));
}

/** 좌표 목록을 모두 포함하는 경계 */
export function boundsOf(points) {
  if (!points.length) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}
