// Day 10 "장소 탐색 / 북마크 / 리뷰 통합 테스트" — 목 서버로 FE1 데이터 흐름 전체(E2E 시나리오) 검증
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockServer, PLACE_STATIONS, NEARBY_KM } from '../src/mocks/mockServer.js';
import { STATIONS, PLACES } from '../src/mocks/seed.js';

const mem = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
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

test('place_stations: 모든 매핑이 1km 이내, 모든 장소에 인접역 1개 이상', () => {
  assert.ok(PLACE_STATIONS.every((m) => m.distanceKm <= NEARBY_KM));
  for (const p of PLACES) assert.ok(PLACE_STATIONS.some((m) => m.placeId === p.placeId), `${p.name} has no station`);
});

test('시연 시나리오: 회원가입 → 반려동물 등록 → 강남역 검색 → 필터 → 찜 → 리뷰', () => {
  const api = createMockServer({ storage: mem() });
  const call = (method, path, opts = {}) => api.handle(method, path, { ...opts, token });
  let token;

  // 1. 회원가입 & 중복 이메일
  assert.equal(call('GET', '/auth/check-email', { query: { email: 'new@pet.kr' } }).available, true);
  const s = call('POST', '/auth/signup', { body: { email: 'new@pet.kr', password: 'abcd1234!', name: '신규' } });
  token = s.accessToken;
  expectError(() => call('POST', '/auth/signup', { body: { email: 'new@pet.kr', password: 'x', name: 'y' } }), 409, 'DUPLICATE_EMAIL');
  assert.equal(call('GET', '/auth/me').email, 'new@pet.kr');

  // 2. 반려동물 등록 / 검증 에러
  const pet = call('POST', '/pets', { body: { name: '보리', breed: '푸들', weight: 4.1, gender: 'M', neutered: true } });
  assert.equal(call('GET', '/pets').length, 1);
  const ve = expectError(() => call('POST', '/pets', { body: { name: '', breed: '', weight: 0, gender: 'X' } }), 400, 'VALIDATION_ERROR');
  assert.equal(ve.fieldErrors.length, 4);
  call('PUT', `/pets/${pet.petId}`, { body: { ...pet, weight: 4.5 } });
  assert.equal(call('GET', `/pets/${pet.petId}`).weight, 4.5);

  // 3. 역 검색 ("강남역" 입력도 허용) — 호선 묶음
  const st = call('GET', '/stations', { query: { keyword: '강남역' } });
  assert.equal(st[0].stationName, '강남');
  assert.deepEqual(st[0].lines, ['2', 'SB']);

  // 4. 반경 1km 검색 — 거리순 정렬, 모두 1km 이내
  const res = call('GET', '/places', { query: { stationId: st[0].stationId, radiusKm: 1 } });
  assert.ok(res.totalElements > 0);
  assert.ok(res.content.every((p) => p.distanceKm <= 1));
  const dists = res.content.map((p) => p.distanceKm);
  assert.deepEqual(dists, [...dists].sort((a, b) => a - b));

  // 5. 다중 필터: 카테고리 + 호선 + 크기
  const cafes = call('GET', '/places', { query: { categoryIds: '1', lines: '6', sizes: 'LARGE' } });
  assert.ok(cafes.content.length > 0);
  assert.ok(cafes.content.every((p) => p.categoryId === 1 && p.maxSize === 'LARGE'));
  const none = call('GET', '/places', { query: { stationId: st[0].stationId, categoryIds: '3' } });
  assert.equal(none.totalElements, 0, '강남역 1km 안에 숙소 없음');

  // 6. 페이지네이션
  const p0 = call('GET', '/places', { query: { size: 10, page: 0 } });
  const p3 = call('GET', '/places', { query: { size: 10, page: 3 } });
  assert.equal(p0.hasNext, true);
  assert.equal(p3.hasNext, false);

  // 7. 찜하기 (중복 요청에도 1건) → 목록 → 해제
  const target = res.content[0].placeId;
  call('POST', `/places/${target}/bookmark`);
  call('POST', `/places/${target}/bookmark`);
  assert.equal(call('GET', '/users/me/bookmarks').length, 1);
  assert.equal(call('GET', `/places/${target}`).bookmarked, true);
  call('DELETE', `/places/${target}/bookmark`);
  assert.equal(call('GET', '/users/me/bookmarks').length, 0);

  // 8. 리뷰 작성 → 평균 별점 반영 → 중복 409 → 수정 → 삭제
  const before = call('GET', '/reviews', { query: { targetId: target } }).summary;
  call('POST', '/reviews', { body: { targetType: 'PLACE', targetId: target, rating: 1, content: '테스트 리뷰입니다. 열 글자 이상!' } });
  const after = call('GET', '/reviews', { query: { targetId: target } });
  assert.equal(after.summary.reviewCount, before.reviewCount + 1);
  assert.ok(after.summary.avgRating < before.avgRating);
  assert.equal(after.content[0].mine, true);
  expectError(() => call('POST', '/reviews', { body: { targetId: target, rating: 5, content: '두 번째 리뷰는 막혀야 해요' } }), 409, 'DUPLICATE_REVIEW');
  expectError(() => call('POST', '/reviews', { body: { targetId: target, rating: 5, content: '짧음' } }), 400, 'VALIDATION_ERROR');
  const mine = after.content[0];
  call('PUT', `/reviews/${mine.reviewId}`, { body: { rating: 5, content: '수정한 리뷰입니다. 최고예요!' } });
  assert.equal(call('GET', '/users/me/reviews')[0].rating, 5);
  call('DELETE', `/reviews/${mine.reviewId}`);
  assert.equal(call('GET', '/reviews', { query: { targetId: target } }).summary.reviewCount, before.reviewCount);
});

test('권한/예외: 비로그인 401, 남의 리뷰 403, 없는 장소 404, 로그인 실패 401', () => {
  const api = createMockServer({ storage: mem() });
  expectError(() => api.handle('POST', '/places/1/bookmark'), 401, 'UNAUTHORIZED');
  expectError(() => api.handle('GET', '/places/9999'), 404, 'PLACE_NOT_FOUND');
  expectError(() => api.handle('POST', '/auth/login', { body: { email: 'demo@petplanet.kr', password: 'wrong' } }), 401, 'INVALID_CREDENTIALS');
  const { accessToken } = api.handle('POST', '/auth/login', { body: { email: 'demo@petplanet.kr', password: 'petplanet123!' } });
  const others = api.handle('GET', '/reviews', { query: { targetId: 1 } }).content.find((r) => r.userId !== 1);
  expectError(() => api.handle('DELETE', `/reviews/${others.reviewId}`, { token: accessToken }), 403, 'FORBIDDEN');
});

test('홈 인기역 ID가 시드 데이터와 일치', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
  for (const [, id, name] of src.matchAll(/stationId: (\d+), stationName: '([^']+)'/g)) {
    assert.equal(STATIONS.find((s) => s.stationId === Number(id))?.stationName, name);
  }
});
