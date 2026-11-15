import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, offsetMeters, walkingMinutes } from '../src/utils/geo.js';
import { validateEmail, validatePassword, validateWeight, validateReview, validateName } from '../src/utils/validators.js';
import { canBring, sizeFromWeight, formatDistance, maskEmail } from '../src/utils/format.js';

test('하버사인: 강남역 ↔ 역삼역 약 0.8km', () => {
  const d = haversineKm(37.4979, 127.0276, 37.5006, 127.0364);
  assert.ok(d > 0.75 && d < 0.9, `got ${d}`);
});

test('offsetMeters 로 300m 이동하면 하버사인 거리도 약 300m', () => {
  const p = offsetMeters(37.5, 127.0, 300, 0);
  assert.ok(Math.abs(haversineKm(37.5, 127.0, p.lat, p.lng) - 0.3) < 0.005);
});

test('도보 시간: 670m → 10분, 최소 1분', () => {
  assert.equal(walkingMinutes(0.67), 10);
  assert.equal(walkingMinutes(0.01), 1);
});

test('이메일/비밀번호/이름 검증', () => {
  assert.equal(validateEmail('a@b.co'), '');
  assert.notEqual(validateEmail('ab.co'), '');
  assert.equal(validatePassword('petplanet123!'), '');
  assert.notEqual(validatePassword('short1!'), '');
  assert.notEqual(validatePassword('noSpecial123'), '');
  assert.equal(validateName('김펫플'), '');
  assert.notEqual(validateName('김'), '');
});

test('몸무게 검증: 범위 / 소수 한 자리', () => {
  assert.equal(validateWeight('3.8'), '');
  assert.notEqual(validateWeight('0'), '');
  assert.notEqual(validateWeight('3.85'), '');
  assert.notEqual(validateWeight(''), '');
});

test('리뷰 검증: 별점 필수, 10~500자', () => {
  assert.deepEqual(validateReview({ rating: 5, content: '정말 좋았어요 또 갈게요!' }), {});
  assert.ok(validateReview({ rating: 0, content: '정말 좋았어요 또 갈게요!' }).rating);
  assert.ok(validateReview({ rating: 4, content: '짧음' }).content);
});

test('크기 구분과 동반 가능 여부', () => {
  assert.equal(sizeFromWeight(3.8), 'SMALL');
  assert.equal(sizeFromWeight(10), 'MEDIUM');
  assert.equal(sizeFromWeight(28.5), 'LARGE');
  assert.equal(canBring('MEDIUM', 3.8), true);
  assert.equal(canBring('SMALL', 12), false);
});

test('포맷터', () => {
  assert.equal(formatDistance(0.432), '432m');
  assert.equal(formatDistance(1.25), '1.3km');
  assert.equal(maskEmail('petplanet@gmail.com'), 'pe*******@gmail.com');
});
