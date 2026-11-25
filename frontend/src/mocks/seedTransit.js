// 목 서버용 버스 정류장 · 노선 · 지역 (⚠️ 모두 가상 데이터예요 — 실제 정류장 이름 · 위치가 아님)
// 실제 API 는 국토교통부 전국 버스정류장 위치정보(bus_stops)를 쓰고, 장소마다 가장 가까운 정류장을 적재기가 미리 계산해요.
// 목 서버는 같은 응답 모양을 만들기 위해 시드 장소 · 병원 · 호텔 주변에 정류장을 규칙적으로 흩어 놓아요.

import { haversineKm, offsetMeters } from '../utils/geo.js';
import { busAccessOf, NEAR_STOP_M } from '../utils/transit.js';
import { normalizeSido, parseRegion } from '../utils/region.js';
import { PLACES } from './seed.js';
import { HOSPITALS, PET_HOTELS } from './seedCommerce.js';

const SUFFIX = ['입구', '사거리', '앞', '중앙', '삼거리', '정문', '건너편', '공원'];
// 장소마다 가장 가까운 정류장 거리(m)를 다르게 → 등급 A~D 가 고루 나오게
const NEAREST_M = [90, 160, 240, 330, 450, 620, 780, 1200];
const ROUTE_POOL = ['271', '273', '602', '6716', '7011', '7016', '7711', '마포08', '마포09', '서대문05', '146', '360', '740', '4412', '3412'];

function makeStops() {
  const stops = [];
  let id = 1;
  const add = (base, name, lat, lng, cityName, routes) => {
    stops.push({ stopId: `MOCK${String(id++).padStart(5, '0')}`, name, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), cityCode: 'MOCK', cityName, routes });
  };
  PLACES.forEach((p, i) => {
    const d = NEAREST_M[i % NEAREST_M.length];
    const ang = (i * 47 * Math.PI) / 180;
    const word = p.name.split(' ')[0];
    const routes = ROUTE_POOL.filter((_, k) => (k + i) % (2 + (i % 4)) === 0).slice(0, 1 + (i % 7));
    const o = offsetMeters(p.lat, p.lng, Math.cos(ang) * d, Math.sin(ang) * d);
    add(p, `${word}${SUFFIX[i % SUFFIX.length]}`, o.lat, o.lng, '서울특별시', routes);
    // 짝수 번째 장소 주변에는 정류장을 몇 곳 더 (반경 500m 정류장 수가 달라지게)
    for (let k = 0; k < (i % 2 === 0 ? 3 : 0); k++) {
      const a2 = ang + ((k + 1) * Math.PI) / 2;
      const o2 = offsetMeters(p.lat, p.lng, Math.cos(a2) * (d + 120), Math.sin(a2) * (d + 120));
      add(p, `${word}${SUFFIX[(i + k + 1) % SUFFIX.length]}`, o2.lat, o2.lng, '서울특별시', routes.slice(0, 2));
    }
  });
  [...HOSPITALS, ...PET_HOTELS].forEach((h, i) => {
    const o = offsetMeters(h.lat, h.lng, 60 + i * 15, -40);
    add(h, `${h.name.split(' ')[0]}${SUFFIX[(i + 2) % SUFFIX.length]}`, o.lat, o.lng, '서울특별시', ROUTE_POOL.slice(i, i + 6));
  });
  // 시연 위치(목포역 · 국립목포대학교) 주변 — 내 위치 기준 화면 확인용
  [
    ['목포역 앞', 34.7908, 126.3874],
    ['목포역 건너편', 34.7921, 126.3859],
    ['목포대 정문', 34.9105, 126.4369],
    ['목포대 후문', 34.9128, 126.4395],
  ].forEach(([name, lat, lng], i) => add(null, `${name} (가상)`, lat, lng, i < 2 ? '목포시' : '무안군', ['1', '1-2', '200'].slice(0, 2 + (i % 2))));
  return stops;
}

export const BUS_STOPS = makeStops();
const byId = new Map(BUS_STOPS.map((s) => [s.stopId, s]));
export const busStopById = (id) => byId.get(id) ?? null;

/** 좌표에서 가까운 정류장 (가까운 순) */
export function stopsNear(lat, lng, radiusM) {
  return BUS_STOPS.map((s) => ({ s, m: Math.round(haversineKm(lat, lng, s.lat, s.lng) * 1000) }))
    .filter((x) => x.m <= radiusM)
    .sort((a, b) => a.m - b.m || a.s.stopId.localeCompare(b.s.stopId));
}

/** 장소 · 병원 · 호텔 응답에 붙이는 지역 + 대중교통 접근성 (백엔드 BusAccess 와 같은 모양) */
export function accessFields(address, lat, lng) {
  const near = stopsNear(lat, lng, 2000);
  const within500 = near.filter((x) => x.m <= 500).length;
  const nearest = near[0];
  return {
    ...parseRegion(address),
    busAccess: busAccessOf(nearest?.s ?? null, nearest?.m ?? null, within500, nearest ? nearest.s.routes.length : null),
  };
}

/** 가상 실시간 도착: 시각에 따라 바뀌는 그럴듯한 값 */
export function mockArrivals(stop, now = Date.now()) {
  const minute = Math.floor(now / 60000);
  return stop.routes.slice(0, 4).map((no, i) => {
    const period = 9 + i * 4;
    const minutes = (period - ((minute + i * 3 + stop.stopId.length) % period)) % period;
    return { routeId: `R-${no}`, routeNo: no, routeType: '일반버스', minutes, remainingStops: Math.max(0, Math.round(minutes / 2)), lowFloor: i % 2 === 0 };
  }).sort((a, b) => a.minutes - b.minutes);
}

/** 지역 · 정류장 300m 필터 (백엔드 BusAccess.filters 와 같은 규칙) — x 는 accessFields 가 붙은 응답 행 */
export function matchRegion(x, query, fail) {
  if (query.sido) {
    const sido = normalizeSido(query.sido) ?? fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', [{ field: 'sido', message: '시/도 이름을 확인해 주세요. (예: 전남, 서울)' }]);
    if (x.sido !== sido) return false;
  }
  if (query.sigungu && x.sigungu !== String(query.sigungu).trim()) return false;
  if (String(query.nearStop) === 'true' && !(x.busAccess?.distanceM != null && x.busAccess.distanceM <= NEAR_STOP_M)) return false;
  return true;
}

/** 내 위치(lat, lng) — 대한민국 범위만 (백엔드 Origin.resolve 와 같은 규칙) */
export function originOf(query, fail) {
  if (query.lat == null && query.lng == null) return null;
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  if (!(lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132)) fail(400, 'INVALID_LOCATION', '위치 좌표가 올바르지 않아요.');
  return { lat, lng };
}

/** 정류장 가까운 순 비교 (정보 없음은 뒤로) */
export const byStop = (a, b) => (a.busAccess?.distanceM ?? Infinity) - (b.busAccess?.distanceM ?? Infinity);
