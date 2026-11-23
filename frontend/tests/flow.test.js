// 시연 시나리오 통합 테스트 — 목 서버로 FE1 데이터 흐름 전체를 검증
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockServer, PLACE_STATIONS, NEARBY_KM } from '../src/mocks/mockServer.js';
import { LINE_STATIONS, PLACES, PLACE_CATEGORIES } from '../src/mocks/seed.js';

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

test('place_stations: 모든 매핑이 1km 이내, 모든 장소에 인접역 1개 이상', () => {
  assert.ok(PLACE_STATIONS.every((m) => m.distanceKm <= NEARBY_KM));
  for (const p of PLACES) assert.ok(PLACE_STATIONS.some((m) => m.placeId === p.placeId), `${p.name} has no station`);
});

test('노선도: 호선별 역이 순서(seq)대로, 환승 호선 포함', () => {
  const api = createMockServer({ storage: mem() });
  const line2 = api.handle('GET', '/stations', { query: { line: '2호선' } });
  assert.deepEqual(line2.map((s) => s.stationName), LINE_STATIONS['2호선']);
  assert.deepEqual(line2.map((s) => s.seq), LINE_STATIONS['2호선'].map((_, i) => i + 1));
  const hongdae = line2.find((s) => s.stationName === '홍대입구');
  assert.deepEqual(hongdae.lines, ['2호선', '경의중앙선', '공항철도']);
});

test('S01/S02: 홍대입구 반경 1km → 목업과 같은 0.3 / 0.6 / 0.7 / 0.9km, 0.5km 필터', () => {
  const api = createMockServer({ storage: mem() });
  const hd = api.handle('GET', '/stations', { query: { line: '2호선' } }).find((s) => s.stationName === '홍대입구');
  const res = api.handle('GET', '/places', { query: { stationId: hd.stationId, radiusKm: 1 } });
  assert.deepEqual(res.content.slice(0, 4).map((p) => Math.round(p.distanceKm * 10) / 10), [0.3, 0.6, 0.7, 0.9]);
  const half = api.handle('GET', '/places', { query: { stationId: hd.stationId, radiusKm: 0.5 } });
  assert.ok(half.content.every((p) => p.distanceKm <= 0.5));
  assert.ok(half.totalElements < res.totalElements);
  // 실내 필터 = 실내 + 실내·외 모두
  const indoor = api.handle('GET', '/places', { query: { stationId: hd.stationId, indoor: 'INDOOR,BOTH' } });
  assert.ok(indoor.content.every((p) => p.indoorType !== 'OUTDOOR'));
  // 리뷰 많은 순
  const byReviews = api.handle('GET', '/places', { query: { stationId: hd.stationId, sort: 'reviews' } }).content.map((p) => p.reviewCount);
  assert.deepEqual(byReviews, [...byReviews].sort((a, b) => b - a));
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
