// 지역 파싱 · 대중교통 접근성 등급 · 반려동물 버스 안내 · 카카오맵 링크 (백엔드 TransitTest 와 같은 규칙)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSido, parseRegion, regionLabel } from '../src/utils/region.js';
import { accessGrade, kakaoPlaceSearchUrl, petBusAdvice, walkMinutes } from '../src/utils/transit.js';

test('주소 → 시도 짧은 이름 · 시군구', () => {
  assert.deepEqual(parseRegion('전라남도 목포시 영산로 123'), { sido: '전남', sigungu: '목포시' });
  assert.deepEqual(parseRegion('전남 무안군 청계면 영산로 1666'), { sido: '전남', sigungu: '무안군' });
  assert.deepEqual(parseRegion('서울특별시 마포구 와우산로 000 (시연용)'), { sido: '서울', sigungu: '마포구' });
  assert.deepEqual(parseRegion('경기도 수원시 장안구 정조로 1'), { sido: '경기', sigungu: '수원시' });
  assert.deepEqual(parseRegion('세종특별자치시 한누리대로 2130'), { sido: '세종', sigungu: '세종시' });
  assert.deepEqual(parseRegion('주소 없음'), { sido: null, sigungu: null });
  assert.equal(normalizeSido('전라남도'), '전남');
  assert.equal(normalizeSido('목포'), null);
  assert.equal(regionLabel({ sido: '전남', sigungu: '목포시' }), '전남 목포시');
});

test('접근성 등급: 거리 점수 + 노선(없으면 정류장 수) 1점', () => {
  assert.equal(accessGrade(150, 3, 7), 'A');
  assert.equal(accessGrade(150, 3, 2), 'B');
  assert.equal(accessGrade(350, 1, 6), 'B');
  assert.equal(accessGrade(350, 1, 1), 'C');
  assert.equal(accessGrade(700, 5, null), 'C');
  assert.equal(accessGrade(700, 1, null), 'D');
  assert.equal(accessGrade(1500, 9, 20), 'D');
  assert.equal(accessGrade(null, 0, null), 'D');
  assert.equal(walkMinutes(200), 4);
});

test('반려동물 버스 안내: 5kg 이하 가능 · 10kg 이하 확인 필요 · 그 위는 비추천', () => {
  assert.equal(petBusAdvice(3.2).level, 'ok');
  assert.equal(petBusAdvice(6.2).level, 'caution');
  assert.equal(petBusAdvice(18).level, 'no');
  assert.equal(petBusAdvice(undefined).level, 'unknown');
});

test('카카오맵 후기 링크는 검색 결과 페이지 (내용을 가져오지 않음)', () => {
  const url = kakaoPlaceSearchUrl('한라동물병원', '목포시');
  assert.equal(url, `https://map.kakao.com/link/search/${encodeURIComponent('목포시 한라동물병원')}`);
});
