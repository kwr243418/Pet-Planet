// 주변 탐색: 내 위치(lat, lng) 기준 검색 · 가는 방법 어림 시간
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockServer } from '../src/mocks/mockServer.js';
import { TRAVEL_MODES, kakaoDirectionsUrl, travelMinutes } from '../src/utils/origin.js';

const mem = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
// 홍대입구역 근처 좌표 (시드 장소가 모여 있는 곳)
const HONGDAE = { lat: 37.5572, lng: 126.9245 };

test('내 위치 기준 장소 검색: 거리순, 반경 안만', () => {
  const api = createMockServer({ storage: mem() });
  const res = api.handle('GET', '/places', { query: { ...HONGDAE, radiusKm: 1 } });
  assert.ok(res.content.length > 0);
  for (const p of res.content) assert.ok(p.distanceKm <= 1);
  const d = res.content.map((p) => p.distanceKm);
  assert.deepEqual(d, [...d].sort((a, b) => a - b));
});

test('내 위치 기준 반경은 5km까지 넓힐 수 있어요', () => {
  const api = createMockServer({ storage: mem() });
  const near = api.handle('GET', '/places', { query: { ...HONGDAE, radiusKm: 1 } }).totalElements;
  const far = api.handle('GET', '/places', { query: { ...HONGDAE, radiusKm: 5 } }).totalElements;
  assert.ok(far >= near);
});

test('내 위치 기준 동물병원 · 펫호텔 목록에 거리가 붙어요', () => {
  const api = createMockServer({ storage: mem() });
  for (const path of ['/hospitals', '/pet-hotels']) {
    const res = api.handle('GET', path, { query: { ...HONGDAE, radiusKm: 20 } });
    for (const x of res.content) assert.equal(typeof x.distanceKm, 'number');
  }
});

test('가는 방법: 도보가 자동차보다 오래 걸리고, 카카오맵 링크에 교통수단이 들어가요', () => {
  const walk = TRAVEL_MODES.find((m) => m.key === 'walk');
  const car = TRAVEL_MODES.find((m) => m.key === 'car');
  assert.ok(travelMinutes(3, walk) > travelMinutes(3, car));
  const url = kakaoDirectionsUrl({ label: '목포역', lat: 34.79, lng: 126.38 }, { name: '카페', lat: 34.8, lng: 126.4 }, walk);
  assert.match(url, /^https:\/\/map\.kakao\.com\/link\/by\/walk\//);
});
