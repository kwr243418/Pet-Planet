// 주변 탐색의 출발점(내 위치)과 가는 방법(도보 · 버스 · 자동차 · 택시) 도우미
import { haversineKm } from './geo.js';

const ORIGIN_KEY = 'pp-origin';

/** 홈 "다음 정류장"의 기본 기준점 (저장된 내 위치가 없을 때만 씀 · 화면에 버튼으로 나오지 않아요) */
export const PRESET_ORIGINS = [
  { key: 'mnu', label: '국립목포대학교', lat: 34.9113, lng: 126.4377 },
  { key: 'mokpo-st', label: '목포역', lat: 34.7914, lng: 126.3866 },
];

/** 마지막으로 고른 내 위치 { label, lat, lng } */
export function readOrigin() {
  try {
    const o = JSON.parse(localStorage.getItem(ORIGIN_KEY));
    if (!o || !Number.isFinite(o.lat) || !Number.isFinite(o.lng)) return null;
    // 예전 "○○ 기준" 버튼으로 저장된 값은 버려요 (지금은 내 위치만 써요)
    if (!o.kind && PRESET_ORIGINS.some((p) => p.label === o.label)) return null;
    return o;
  } catch {
    return null;
  }
}

export function saveOrigin(o) {
  try {
    localStorage.setItem(ORIGIN_KEY, JSON.stringify({ label: o.label, lat: o.lat, lng: o.lng, kind: o.kind ?? 'here' }));
  } catch {
    /* 저장 못 해도 화면은 동작 */
  }
}

/** 브라우저 위치 → { label, lat, lng } */
export function locateMe() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('이 브라우저는 위치 정보를 지원하지 않아요.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ label: '현재 위치', lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED ? '위치 권한이 꺼져 있어요. 브라우저 주소창의 위치 권한을 허용하거나 "지역별" 탐색을 써 주세요.' : '현재 위치를 찾지 못했어요. "지역별" 탐색을 써 주세요.',
          ),
        ),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

/** 카카오 좌표 → 주소: 도로명 주소의 건물명, 없으면 동 이름 */
async function kakaoNameNear(lat, lng) {
  const key = (import.meta.env ?? {}).VITE_KAKAO_MAP_KEY;
  if (!key) return null;
  try {
    const { loadKakaoMaps } = await import('../components/map/KakaoMap.jsx');
    const kakao = await loadKakaoMaps(key);
    const { services } = kakao.maps;
    if (!services) return null;
    const r = await new Promise((resolve) =>
      new services.Geocoder().coord2Address(lng, lat, (out, status) => resolve(status === services.Status.OK ? out[0] : null)),
    );
    const building = r?.road_address?.building_name?.trim();
    return { building: building || null, dong: r?.address?.region_3depth_name || null };
  } catch {
    return null;
  }
}

/** 우리 DB의 가장 가까운 버스 정류장 이름 (300m 안) */
async function stopNameNear(lat, lng) {
  try {
    const { busApi } = await import('../api/index.js');
    const [s] = (await busApi.nearby({ lat, lng, radiusM: 300, limit: 1 })) ?? [];
    return s?.name ?? null;
  } catch {
    return null;
  }
}

/**
 * 내 좌표를 사람이 알아볼 이름으로: 가까운 건물 → 가까운 정류장 → 동 → "현재 위치"
 * 예) "국립목포대학교 근처", "목포가톨릭대학교 정류장 근처", "석현동"
 */
export async function nameNear(lat, lng) {
  const [k, stop] = await Promise.all([withTimeout(kakaoNameNear(lat, lng), 4000), withTimeout(stopNameNear(lat, lng), 4000)]);
  if (k?.building) return `${k.building} 근처`;
  if (stop) return `${stop} 정류장 근처`;
  if (k?.dong) return k.dong;
  return '현재 위치';
}

/** 현재 위치를 찾고 이름까지 붙여서 { label, lat, lng, kind: 'here' } */
export async function locateHere() {
  const o = await locateMe();
  return { ...o, label: await nameNear(o.lat, o.lng), kind: 'here' };
}

/** 위치 권한을 이미 허용했는지 (허용했을 때만 상세 화면에서 조용히 위치를 새로 받아요) */
export async function locationGranted() {
  try {
    return (await navigator.permissions?.query({ name: 'geolocation' }))?.state === 'granted';
  } catch {
    return false;
  }
}

/** 가는 방법: 직선거리 × 우회 계수 ÷ 평균 속도로 어림한 시간 (실제 경로는 카카오맵에서) */
export const TRAVEL_MODES = [
  { key: 'walk', label: '도보', detour: 1.25, kmh: 4.5, waitMin: 0, kakaoBy: 'walk' },
  { key: 'bus', label: '버스', detour: 1.4, kmh: 18, waitMin: 10, kakaoBy: 'traffic' },
  { key: 'car', label: '자동차', detour: 1.3, kmh: 30, waitMin: 0, kakaoBy: 'car' },
  { key: 'taxi', label: '택시', detour: 1.3, kmh: 30, waitMin: 5, kakaoBy: 'car' },
];

export function travelMinutes(km, mode) {
  if (km == null) return null;
  return Math.max(1, Math.round((km * mode.detour * 60) / mode.kmh + mode.waitMin));
}

export const formatMinutes = (m) => (m == null ? '' : m < 60 ? `${m}분` : `${Math.floor(m / 60)}시간 ${m % 60 ? `${m % 60}분` : ''}`.trim());

export const distanceFrom = (origin, target) => (origin && target ? haversineKm(origin.lat, origin.lng, target.lat, target.lng) : null);

/** 카카오맵 길찾기 (카카오 지도 URL 가이드의 /link/by/{car|traffic|walk}/출발/도착 형식)
 *  출발점이 없으면 도착지만 넣어서 열어요 (출발지는 카카오맵에서 고름) */
export function kakaoDirectionsUrl(origin, dest, mode) {
  const point = (name, lat, lng) => `${encodeURIComponent(name)},${lat},${lng}`;
  const to = point(dest.name, dest.lat, dest.lng);
  if (!origin) return `https://map.kakao.com/link/to/${to}`;
  const from = point(origin.label ?? '출발', origin.lat, origin.lng);
  return mode?.kakaoBy ? `https://map.kakao.com/link/by/${mode.kakaoBy}/${from}/${to}` : `https://map.kakao.com/link/from/${from}/to/${to}`;
}
