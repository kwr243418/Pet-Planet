// 시연 시나리오 통합 테스트 — 목 서버로 FE1 데이터 흐름 전체를 검증
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockServer } from '../src/mocks/mockServer.js';
import { PLACES, PLACE_CATEGORIES } from '../src/mocks/seed.js';

const mem = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};

const expectError = (fn, status, code) => {
  try {
    fn();
  } catch (e) {
    assert.equal(e.status, status);
    if (code) assert.equal(e.code, code);
    return e;
  }
  assert.fail(`expected ${status} ${code ?? ''}`);
};

const PET = { name: '보리', breed: '진돗개', weight: 18, gender: 'MALE', neutered: true };

test('시드: 카테고리는 목업 기준 4종(카페·식당·숙소·운동장)', () => {
  assert.deepEqual(PLACE_CATEGORIES.map((c) => c.name), ['카페', '식당', '숙소', '운동장']);
  assert.ok(PLACES.every((p) => [1, 2, 3, 4].includes(p.categoryId)));
});

test('모든 시드 장소에 지역(시도 · 시군구)과 가장 가까운 버스 정류장이 붙어요', () => {
  const api = createMockServer({ storage: mem() });
  const all = api.handle('GET', '/places', { query: { size: 50 } }).content;
  assert.equal(all.length, PLACES.length);
  for (const p of all) {
    assert.ok(['서울', '전남광주'].includes(p.sido), p.name);
    assert.match(p.sigungu, /[구시]$/);
    assert.ok(['A', 'B', 'C', 'D'].includes(p.busAccess.grade), `${p.name} grade`);
  }
  // 지하철 필드는 더 이상 없어요
  assert.equal(all[0].nearestStation, undefined);
});

test('S02 내 근처: 홍대입구 근처 반경 1km → 목업과 같은 0.3 / 0.6 / 0.7 / 0.9km, 0.5km 필터', () => {
  const api = createMockServer({ storage: mem() });
  const HONGDAE = { lat: 37.5572, lng: 126.9245 };
  const res = api.handle('GET', '/places', { query: { ...HONGDAE, radiusKm: 1 } });
  assert.deepEqual(res.content.slice(0, 4).map((p) => Math.round(p.distanceKm * 10) / 10), [0.3, 0.6, 0.7, 0.9]);
  const half = api.handle('GET', '/places', { query: { ...HONGDAE, radiusKm: 0.5 } });
  assert.ok(half.content.every((p) => p.distanceKm <= 0.5));
  assert.ok(half.totalElements < res.totalElements);
  // 실내 필터 = 실내 + 실내·외 모두
  const indoor = api.handle('GET', '/places', { query: { ...HONGDAE, indoor: 'INDOOR,BOTH' } });
  assert.ok(indoor.content.every((p) => p.indoorType !== 'OUTDOOR'));
  // 리뷰 많은 순
  const byReviews = api.handle('GET', '/places', { query: { ...HONGDAE, sort: 'reviews' } }).content.map((p) => p.reviewCount);
  assert.deepEqual(byReviews, [...byReviews].sort((a, b) => b - a));
});

test('S02 지역별: 시도 → 시군구 목록과 필터, 정류장 300m · 정류장 가까운 순', () => {
  const api = createMockServer({ storage: mem() });
  const regions = api.handle('GET', '/regions', { query: { type: 'place' } });
  const seoul = regions.find((r) => r.sido === '서울');
  const seoulPlaces = PLACES.filter((p) => p.address.startsWith('서울')).length;
  assert.equal(seoul.count, seoulPlaces);
  assert.equal(regions.find((r) => r.sido === '전남광주').sigungus[0].name, '목포시'); // 11/25 목포 시연 장소
  const mapo = seoul.sigungus.find((g) => g.name === '마포구');
  const res = api.handle('GET', '/places', { query: { sido: '서울특별시', sigungu: '마포구', size: 50 } });
  assert.equal(res.totalElements, mapo.count);
  assert.ok(res.content.every((p) => p.sigungu === '마포구'));
  const near = api.handle('GET', '/places', { query: { sido: '서울', nearStop: true, size: 50 } });
  assert.ok(near.totalElements > 0 && near.totalElements < seoulPlaces);
  assert.ok(near.content.every((p) => p.busAccess.distanceM <= 300));
  const transit = api.handle('GET', '/places', { query: { sido: '서울', sort: 'transit', size: 50 } }).content.map((p) => p.busAccess.distanceM ?? Infinity);
  assert.deepEqual(transit, [...transit].sort((a, b) => a - b));
  expectError(() => api.handle('GET', '/places', { query: { sido: '목포' } }), 400, 'VALIDATION_ERROR');
  assert.equal(api.handle('GET', '/places', { query: { sido: '전남' } }).totalElements, PLACES.length - seoulPlaces); // 전남 → 전남광주 (통합) = 목포 시연 장소
});

test('버스: 근처 정류장 · 노선 · 실시간 도착(가상)', () => {
  const api = createMockServer({ storage: mem() });
  const stops = api.handle('GET', '/bus-stops/nearby', { query: { lat: 34.7914, lng: 126.3866, radiusM: 500 } });
  assert.ok(stops.length >= 2);
  const d = stops.map((s) => s.distanceM);
  assert.deepEqual(d, [...d].sort((a, b) => a - b));
  const routes = api.handle('GET', `/bus-stops/${stops[0].stopId}/routes`);
  assert.equal(routes.length, stops[0].routeCount);
  const arr = api.handle('GET', `/bus-stops/${stops[0].stopId}/arrivals`);
  assert.equal(arr.status, 'OK');
  const mins = arr.arrivals.map((a) => a.minutes);
  assert.deepEqual(mins, [...mins].sort((a, b) => a - b));
  expectError(() => api.handle('GET', '/bus-stops/NOPE/arrivals'), 404, 'BUS_STOP_NOT_FOUND');
  expectError(() => api.handle('GET', '/bus-stops/nearby', { query: { lat: 0, lng: 0 } }), 400, 'INVALID_LOCATION');
});

test('S09: 계정 + 첫 반려동물을 한 번에 가입 (하나라도 틀리면 아무것도 저장 안 됨)', () => {
  const api = createMockServer({ storage: mem() });
  // 반려동물 정보가 틀리면 계정도 만들어지지 않아야 함
  const bad = expectError(
    () => api.handle('POST', '/auth/signup', { body: { email: 'new@pet.kr', password: 'abcd1234!', name: '신규', role: 'USER', pets: [{ ...PET, weight: 0 }] } }),
    400,
    'VALIDATION_ERROR',
  );
  assert.ok(bad.fieldErrors.some((f) => f.field === 'pets[0].weight'));
  assert.equal(api.handle('GET', '/auth/check-email', { query: { email: 'new@pet.kr' } }).available, true);
  // 관리자는 가입 시 선택 불가
  expectError(() => api.handle('POST', '/auth/signup', { body: { email: 'a@pet.kr', password: 'abcd1234!', name: '관리', role: 'ADMIN', pets: [PET] } }), 400);

  const res = api.handle('POST', '/auth/signup', {
    body: { email: 'new@pet.kr', password: 'abcd1234!', name: '신규', role: 'BUSINESS', pets: [PET, { ...PET, name: '콩이', weight: 3.2, gender: 'FEMALE' }] },
  });
  assert.equal(res.user.role, 'BUSINESS');
  assert.equal(res.pets.length, 2);
  assert.equal(api.handle('GET', '/pets', { token: res.accessToken }).length, 2);
  expectError(() => api.handle('POST', '/auth/signup', { body: { email: 'new@pet.kr', password: 'abcd1234!', name: '중복', role: 'USER', pets: [PET] } }), 409, 'DUPLICATE_EMAIL');
});

test('S03/S08: 찜(중복 불가) → 리뷰 작성·중복·수정·삭제 → 마이페이지 요약·탈퇴', () => {
  const api = createMockServer({ storage: mem() });
  const { accessToken: token } = api.handle('POST', '/auth/signup', { body: { email: 'flow@pet.kr', password: 'abcd1234!', name: '흐름', role: 'USER', pets: [PET] } });
  const call = (method, path, opts = {}) => api.handle(method, path, { ...opts, token });

  // 찜: 같은 장소 두 번은 409
  call('POST', '/places/1/bookmark');
  expectError(() => call('POST', '/places/1/bookmark'), 409, 'DUPLICATE_BOOKMARK');
  assert.equal(call('GET', '/places/1').bookmarked, true);
  assert.equal(call('GET', '/users/me/bookmarks').length, 1);

  // 리뷰
  const before = call('GET', '/reviews', { query: { targetId: 1 } }).summary;
  const mine = call('POST', '/reviews', { body: { targetType: 'PLACE', targetId: 1, rating: 1, content: '테스트 리뷰입니다. 열 글자 이상!' } });
  const after = call('GET', '/reviews', { query: { targetId: 1 } });
  assert.equal(after.summary.reviewCount, before.reviewCount + 1);
  assert.ok(after.summary.avgRating < before.avgRating);
  expectError(() => call('POST', '/reviews', { body: { targetId: 1, rating: 5, content: '두 번째 리뷰는 막혀야 해요' } }), 409, 'DUPLICATE_REVIEW');
  expectError(() => call('POST', '/reviews', { body: { targetId: 1, rating: 5, content: '짧음' } }), 400, 'VALIDATION_ERROR');
  call('PUT', `/reviews/${mine.reviewId}`, { body: { rating: 5, content: '수정한 리뷰입니다. 최고예요!' } });
  assert.equal(call('GET', '/users/me/reviews')[0].rating, 5);
  assert.equal(call('GET', '/users/me/reviews', { query: { targetType: 'PRODUCT' } }).length, 0);

  // 요약 타일
  const sum = call('GET', '/users/me/summary');
  assert.equal(sum.reviewCount, 1);
  assert.equal(sum.bookmarkCount, 1);

  // 회원정보 수정
  assert.equal(call('PUT', '/users/me', { body: { name: '바뀐이름' } }).name, '바뀐이름');
  expectError(() => call('PUT', '/users/me', { body: { name: 'x' } }), 400);

  call('DELETE', `/reviews/${mine.reviewId}`);
  assert.equal(call('GET', '/reviews', { query: { targetId: 1 } }).summary.reviewCount, before.reviewCount);

  // 탈퇴 → 찜 삭제, 토큰 무효
  call('DELETE', '/users/me');
  expectError(() => call('GET', '/auth/me'), 401);
});

test('권한/예외: 비로그인 401, 남의 리뷰 403, 없는 장소 404, 로그인 실패 401', () => {
  const api = createMockServer({ storage: mem() });
  expectError(() => api.handle('POST', '/places/1/bookmark'), 401, 'UNAUTHORIZED');
  expectError(() => api.handle('GET', '/places/9999'), 404, 'PLACE_NOT_FOUND');
  expectError(() => api.handle('POST', '/auth/login', { body: { email: 'demo@petplanet.kr', password: 'wrong' } }), 401, 'INVALID_CREDENTIALS');
  const { accessToken } = api.handle('POST', '/auth/login', { body: { email: 'demo@petplanet.kr', password: 'petplanet123!' } });
  const others = api.handle('GET', '/reviews', { query: { targetId: 2 } }).content.find((r) => r.userId !== 1);
  expectError(() => api.handle('DELETE', `/reviews/${others.reviewId}`, { token: accessToken }), 403, 'FORBIDDEN');
});
