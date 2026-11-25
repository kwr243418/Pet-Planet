// 주변 탐색의 출발점(내 위치 · 시연 위치)과 가는 방법(도보 · 버스 · 자동차 · 택시) 도우미
import { haversineKm } from './geo.js';

const ORIGIN_KEY = 'pp-origin';

/** 시연용 고정 위치 (현재 위치를 못 받거나 실내라 부정확할 때)
 *  좌표는 대략값이에요. 카카오맵에서 한 번 확인하고 필요하면 고쳐 주세요. */
export const PRESET_ORIGINS = [
  { key: 'mnu', label: '국립목포대학교', lat: 34.9113, lng: 126.4377 },
  { key: 'mokpo-st', label: '목포역', lat: 34.7914, lng: 126.3866 },
];

/** 마지막으로 고른 내 위치 { label, lat, lng } */
export function readOrigin() {
  try {
    const o = JSON.parse(localStorage.getItem(ORIGIN_KEY));
    return o && Number.isFinite(o.lat) && Number.isFinite(o.lng) ? o : null;
  } catch {
    return null;
  }
}

export function saveOrigin(o) {
  try {
    localStorage.setItem(ORIGIN_KEY, JSON.stringify({ label: o.label, lat: o.lat, lng: o.lng }));
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
