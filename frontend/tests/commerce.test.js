// FE2 (예약·쇼핑) 목 서버 시나리오 — 백엔드 backend/ 의 규칙(docs/05)과 같게 동작하는지 검증
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockServer } from '../src/mocks/mockServer.js';
import { slotTimes, seoulDate } from '../src/mocks/seedCommerce.js';

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
const demo = (api) => {
  const { accessToken: token } = api.handle('POST', '/auth/login', { body: { email: 'demo@petplanet.kr', password: 'petplanet123!' } });
  return (method, path, opts = {}) => api.handle(method, path, { ...opts, token });
};
const newUser = (api, email, weight = 3.2) => {
  const { accessToken: token, pets } = api.handle('POST', '/auth/signup', {
    body: { email, password: 'abcd1234!', name: '새회원', role: 'USER', pets: [{ name: '두부', breed: '말티즈', weight, gender: 'FEMALE', neutered: true }] },
  });
  return { call: (method, path, opts = {}) => api.handle(method, path, { ...opts, token }), petId: pets[0].petId };
};

test('진료 시간: 10:00~17:30 30분 단위, 점심시간 제외 (백엔드 slotTimes 와 같음)', () => {
  const s = slotTimes('13:00-14:00');
  assert.equal(s[0], '10:00');
  assert.equal(s.at(-1), '17:30');
  assert.ok(!s.includes('13:00') && !s.includes('13:30') && s.includes('14:00'));
  assert.equal(s.length, 14);
  assert.ok(!slotTimes('12:30-13:30').includes('12:30'));
});

test('동물병원: 제휴 목록·상세·시드 예약으로 내일 14:00 마감', () => {
  const api = createMockServer({ storage: mem() });
  const list = api.handle('GET', '/hospitals', { query: { partner: true } });
  assert.equal(list.totalElements, 3);
  const h1 = api.handle('GET', '/hospitals/1');
  assert.equal(h1.name, '홍대 펫메디컬센터');
  assert.equal(h1.reviewCount, 3);
  assert.ok(h1.busAccess?.stopName);
  assert.equal(h1.sido, '서울');
  const tomorrow = seoulDate(1);
  const { slots } = api.handle('GET', '/hospitals/1/available-times', { query: { date: tomorrow } });
  assert.equal(slots.find((x) => x.time === '14:00').available, false);
  assert.equal(slots.find((x) => x.time === '11:00').available, true);
  expectError(() => api.handle('GET', '/hospitals/99'), 404, 'HOSPITAL_NOT_FOUND');
});

test('진료 예약: 같은 시간 중복 409 · 취소 후 다시 가능 · 지난 시간 400', () => {
  const api = createMockServer({ storage: mem() });
  const a = newUser(api, 'a@pet.kr');
  const b = newUser(api, 'b@pet.kr');
  const when = `${seoulDate(2)}T11:00:00+09:00`;
  expectError(() => api.handle('POST', '/hospital-reservations', { body: { hospitalId: 1, petId: a.petId, reservationDate: when } }), 401);
  const r = a.call('POST', '/hospital-reservations', { body: { hospitalId: 1, petId: a.petId, reservationDate: when } });
  assert.equal(r.status, 'PENDING');
  assert.equal(r.hospitalName, '홍대 펫메디컬센터');
  expectError(() => b.call('POST', '/hospital-reservations', { body: { hospitalId: 1, petId: b.petId, reservationDate: when } }), 409, 'TIME_SLOT_TAKEN');
  expectError(() => b.call('POST', '/hospital-reservations', { body: { hospitalId: 1, petId: a.petId, reservationDate: when } }), 403); // 남의 반려동물
  expectError(() => b.call('POST', '/hospital-reservations', { body: { hospitalId: 1, petId: b.petId, reservationDate: `${seoulDate(2)}T13:00:00+09:00` } }), 400); // 점심시간
  expectError(() => b.call('POST', '/hospital-reservations', { body: { hospitalId: 1, petId: b.petId, reservationDate: `${seoulDate(-1)}T11:00:00+09:00` } }), 400);
  assert.equal(a.call('GET', '/users/me/summary').reservationCount, 1);
  expectError(() => a.call('DELETE', '/users/me'), 409, 'WITHDRAW_BLOCKED');
  a.call('PATCH', `/hospital-reservations/${r.reservationId}/cancel`);
  expectError(() => a.call('PATCH', `/hospital-reservations/${r.reservationId}/cancel`), 409, 'RESERVATION_NOT_CANCELLABLE');
  assert.equal(b.call('POST', '/hospital-reservations', { body: { hospitalId: 1, petId: b.petId, reservationDate: when } }).status, 'PENDING');
});

test('예약 상태: 시연 모드 본인 진행 PENDING→CONFIRMED→COMPLETED, 거꾸로는 409 → 이용완료 후 병원 리뷰', () => {
  const api = createMockServer({ storage: mem() });
  const a = newUser(api, 'c@pet.kr');
  const r = a.call('POST', '/hospital-reservations', { body: { hospitalId: 3, petId: a.petId, reservationDate: `${seoulDate(3)}T10:30:00+09:00` } });
  const review = { targetType: 'HOSPITAL', targetId: 3, rating: 5, content: '꼼꼼하게 봐주셔서 좋았어요!' };
  expectError(() => a.call('POST', '/reviews', { body: review }), 403, 'REVIEW_NOT_ALLOWED');
  assert.equal(a.call('GET', '/reviews/eligibility', { query: { targetType: 'HOSPITAL', targetId: 3 } }).allowed, false);
  expectError(() => a.call('PATCH', `/hospital-reservations/${r.reservationId}/status`, { body: { status: 'COMPLETED' } }), 409, 'INVALID_STATUS_CHANGE');
  a.call('PATCH', `/hospital-reservations/${r.reservationId}/status`, { body: { status: 'CONFIRMED' } });
  a.call('PATCH', `/hospital-reservations/${r.reservationId}/status`, { body: { status: 'COMPLETED' } });
  assert.equal(a.call('GET', '/reviews/eligibility', { query: { targetType: 'HOSPITAL', targetId: 3 } }).allowed, true);
  const created = a.call('POST', '/reviews', { body: { ...review, petId: a.petId } });
  assert.equal(created.petName, '두부');
  assert.equal(created.visitDate, seoulDate(3));
  expectError(() => a.call('POST', '/reviews', { body: review }), 409, 'DUPLICATE_REVIEW');
  assert.equal(a.call('GET', '/users/me/hospital-reservations')[0].reviewed, true);
  assert.equal(a.call('GET', '/users/me/reviews', { query: { targetType: 'HOSPITAL' } })[0].targetName, '신촌 해든 동물병원');
});

test('펫 호텔: 체중 초과 OVERWEIGHT · 기간 겹침 BOOKED · 예약 충돌 409', () => {
  const api = createMockServer({ storage: mem() });
  const big = newUser(api, 'big@pet.kr', 18);
  const { rooms, nights } = big.call('GET', '/pet-hotels/1/rooms', { query: { petId: big.petId, checkIn: seoulDate(3), checkOut: seoulDate(5) } });
  assert.equal(nights, 2);
  const byName = Object.fromEntries(rooms.map((x) => [x.roomName, x]));
  assert.equal(byName['미디엄 룸'].status, 'OVERWEIGHT'); // 18kg > 15kg
  assert.equal(byName['라지 룸'].status, 'AVAILABLE');
  assert.equal(byName['라지 룸'].totalPrice, 120000);
  assert.equal(byName['스위트 룸'].status, 'BOOKED'); // 시드: +2~+5일
  expectError(() => big.call('POST', '/hotel-reservations', { body: { roomId: 1, petId: big.petId, checkInDate: seoulDate(3), checkOutDate: seoulDate(5) } }), 409, 'ROOM_OVERWEIGHT');
  expectError(() => big.call('POST', '/hotel-reservations', { body: { roomId: 3, petId: big.petId, checkInDate: seoulDate(4), checkOutDate: seoulDate(6) } }), 409, 'ROOM_ALREADY_BOOKED');
  const ok = big.call('POST', '/hotel-reservations', { body: { roomId: 3, petId: big.petId, checkInDate: seoulDate(5), checkOutDate: seoulDate(7) } }); // 체크아웃 날 체크인은 겹치지 않아요
  assert.equal(ok.totalPrice, 180000);
  expectError(() => big.call('POST', '/hotel-reservations', { body: { roomId: 2, petId: big.petId, checkInDate: seoulDate(5), checkOutDate: seoulDate(5) } }), 400);
  assert.equal(api.handle('GET', '/pet-hotels', { query: { bookable: true } }).totalElements, 2);
});

test('쇼핑: 장바구니 합치기 · 재고 초과 409 · 주문 트랜잭션(재고 차감·장바구니 비움) · 취소 시 재고 복구', () => {
  const api = createMockServer({ storage: mem() });
  const u = newUser(api, 'shop@pet.kr');
  expectError(() => u.call('POST', '/cart/items', { body: { productId: 5 } }), 409, 'OUT_OF_STOCK'); // 품절
  expectError(() => u.call('POST', '/orders', { body: { receiverName: '새회원', receiverPhone: '010-1111-2222', address: '서울' } }), 400, 'CART_EMPTY');
  u.call('POST', '/cart/items', { body: { productId: 1, quantity: 1 } });
  let cart = u.call('POST', '/cart/items', { body: { productId: 1, quantity: 2 } });
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].quantity, 3);
  assert.equal(cart.totalAmount, 32000 * 3 + 3000);
  expectError(() => u.call('POST', '/cart/items', { body: { productId: 2, quantity: 3 } }), 409, 'OUT_OF_STOCK'); // 재고 2
  cart = u.call('POST', '/cart/items', { body: { productId: 2, quantity: 2 } });
  expectError(() => u.call('POST', '/orders', { body: { receiverName: '새', receiverPhone: '1234', address: '' } }), 400, 'VALIDATION_ERROR');
  const order = u.call('POST', '/orders', { body: { receiverName: '새회원', receiverPhone: '010-1111-2222', address: '서울 마포구' } });
  assert.equal(order.status, 'ORDERED');
  assert.equal(order.totalAmount, 32000 * 3 + 27000 * 2 + 3000);
  assert.equal(u.call('GET', '/cart').itemCount, 0);
  assert.equal(api.handle('GET', '/products/2').stockQuantity, 0);
  assert.equal(api.handle('GET', '/products/2').soldOut, true);
  u.call('PATCH', `/orders/${order.orderId}/cancel`);
  assert.equal(api.handle('GET', '/products/2').stockQuantity, 2);
  assert.equal(u.call('GET', '/users/me/summary').orderCount, 1);
});

test('주문 실패는 전체 롤백: 다른 사람이 먼저 사서 재고가 모자라면 아무것도 바뀌지 않아요', () => {
  const api = createMockServer({ storage: mem() });
  const a = newUser(api, 'ra@pet.kr');
  const b = newUser(api, 'rb@pet.kr');
  a.call('POST', '/cart/items', { body: { productId: 4, quantity: 1 } });
  a.call('POST', '/cart/items', { body: { productId: 2, quantity: 2 } });
  b.call('POST', '/cart/items', { body: { productId: 2, quantity: 1 } });
  b.call('POST', '/orders', { body: { receiverName: '먼저산', receiverPhone: '01022223333', address: '서울' } });
  const before = api.handle('GET', '/products/4').stockQuantity;
  expectError(() => a.call('POST', '/orders', { body: { receiverName: '늦게산', receiverPhone: '010-2222-3333', address: '서울' } }), 409, 'OUT_OF_STOCK');
  assert.equal(api.handle('GET', '/products/4').stockQuantity, before);
  assert.equal(a.call('GET', '/cart').itemCount, 2);
  assert.equal(a.call('GET', '/users/me/orders').length, 0);
});

test('배송 단계: 한 단계씩만 · 배송완료 후 상품 리뷰 가능 (데모 계정 시드는 바로 가능)', () => {
  const api = createMockServer({ storage: mem() });
  const u = newUser(api, 'ship@pet.kr');
  u.call('POST', '/cart/items', { body: { productId: 12 } });
  const o = u.call('POST', '/orders', { body: { receiverName: '새회원', receiverPhone: '010-1111-2222', address: '서울' } });
  expectError(() => u.call('PATCH', `/orders/${o.orderId}/status`, { body: { status: 'DELIVERED' } }), 409, 'INVALID_STATUS_CHANGE');
  for (const s of ['PREPARING', 'SHIPPING']) u.call('PATCH', `/orders/${o.orderId}/status`, { body: { status: s } });
  expectError(() => u.call('PATCH', `/orders/${o.orderId}/cancel`), 409, 'ORDER_NOT_CANCELLABLE');
  expectError(() => u.call('POST', '/reviews', { body: { targetType: 'PRODUCT', targetId: 12, rating: 4, content: '가볍고 물이 잘 나와요.' } }), 403, 'REVIEW_NOT_ALLOWED');
  u.call('PATCH', `/orders/${o.orderId}/status`, { body: { status: 'DELIVERED' } });
  u.call('POST', '/reviews', { body: { targetType: 'PRODUCT', targetId: 12, rating: 4, content: '가볍고 물이 잘 나와요.' } });
  assert.equal(u.call('GET', `/orders/${o.orderId}`).items[0].reviewed, true);

  const d = demo(api);
  const orders = d('GET', '/users/me/orders');
  assert.deepEqual(orders.map((x) => x.status), ['SHIPPING', 'DELIVERED']);
  assert.equal(d('GET', '/reviews/eligibility', { query: { targetType: 'PRODUCT', targetId: 10 } }).allowed, true);
  assert.equal(d('GET', '/reviews/eligibility', { query: { targetType: 'HOSPITAL', targetId: 1 } }).allowed, true);
  assert.equal(d('GET', '/users/me/hospital-reservations').length, 2);
});
