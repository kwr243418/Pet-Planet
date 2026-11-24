// 도메인별 API 함수 — 엔드포인트 명세는 docs/04_API_USER_PLACE.md (레포 루트) 참고
import { http } from './client.js';

export const authApi = {
  checkEmail: (email) => http.get('/auth/check-email', { email }),
  /** 계정 + 첫 반려동물(들)을 한 번에 등록: { email, password, name, role, pets: [...] } */
  signup: (payload) => http.post('/auth/signup', payload),
  login: (email, password) => http.post('/auth/login', { email, password }, { skipAuthRedirect: true }),
  me: () => http.get('/auth/me', undefined, { skipAuthRedirect: true }),
  resetPassword: (email, name) => http.post('/auth/password/reset', { email, name }),
};

export const userApi = {
  updateMe: (payload) => http.put('/users/me', payload),
  summary: () => http.get('/users/me/summary'),
  withdraw: () => http.delete('/users/me'),
};

export const petApi = {
  list: () => http.get('/pets'),
  get: (petId) => http.get(`/pets/${petId}`),
  create: (pet) => http.post('/pets', pet),
  update: (petId, pet) => http.put(`/pets/${petId}`, pet),
  remove: (petId) => http.delete(`/pets/${petId}`),
};

export const stationApi = {
  /** 노선도: 호선의 역을 순서대로 */
  byLine: (line) => http.get('/stations', { line }),
  search: (keyword) => http.get('/stations', { keyword }),
  get: (stationId) => http.get(`/stations/${stationId}`),
};

export const placeApi = {
  categories: () => http.get('/place-categories'),
  /** @param {{stationId?, radiusKm?, categoryIds?, sizes?, indoor?, sort?, page?, size?}} q */
  search: (q) => http.get('/places', q),
  get: (placeId) => http.get(`/places/${placeId}`),
  bookmark: (placeId) => http.post(`/places/${placeId}/bookmark`),
  unbookmark: (placeId) => http.delete(`/places/${placeId}/bookmark`),
  myBookmarks: () => http.get('/users/me/bookmarks'),
};

export const reviewApi = {
  list: (targetId, { sort = 'latest', page = 0, size = 4, targetType = 'PLACE' } = {}) =>
    http.get('/reviews', { targetType, targetId, sort, page, size }),
  create: ({ targetId, rating, content, targetType = 'PLACE', petId }) => http.post('/reviews', { targetType, targetId, rating, content, petId }),
  // 작성 자격: 병원은 이용완료 예약, 상품은 배송완료 주문이 있어야 해요 → { allowed, alreadyReviewed, reason }
  eligibility: (targetType, targetId) => http.get('/reviews/eligibility', { targetType, targetId }),
  update: (reviewId, { rating, content }) => http.put(`/reviews/${reviewId}`, { rating, content }),
  remove: (reviewId) => http.delete(`/reviews/${reviewId}`),
  /** targetType 생략 시 장소·상품 리뷰 모두 */
  mine: (targetType) => http.get('/users/me/reviews', { targetType }),
};

// ─────────────────────────────────────────────────────────────
// ⚙️ FE2 영역 (R 예약선 · S 쇼핑선) — 명세: docs/05_API_RESERVATION_COMMERCE.md (레포 루트)
// 목 서버(src/mocks/mockServer.js)에는 아직 없어서 호출하면 404가 나요. FE2가 목 핸들러를 추가하거나 BE2 API에 연결하세요.
// ─────────────────────────────────────────────────────────────

export const hospitalApi = {
  list: (q) => http.get('/hospitals', q), // { stationId?, keyword?, page?, size? }
  get: (hospitalId) => http.get(`/hospitals/${hospitalId}`),
  availableTimes: (hospitalId, date) => http.get(`/hospitals/${hospitalId}/available-times`, { date }),
  reserve: ({ hospitalId, petId, reservationDate }) => http.post('/hospital-reservations', { hospitalId, petId, reservationDate }),
  myReservations: () => http.get('/users/me/hospital-reservations'),
  cancel: (reservationId) => http.patch(`/hospital-reservations/${reservationId}/cancel`),
  // 사업자·관리자 (시연 모드에서는 예약한 본인도): PENDING→CONFIRMED→COMPLETED
  changeStatus: (reservationId, status) => http.patch(`/hospital-reservations/${reservationId}/status`, { status }),
};

export const hotelApi = {
  list: (q) => http.get('/pet-hotels', q),
  get: (hotelId) => http.get(`/pet-hotels/${hotelId}`),
  /** 객실별 상태: AVAILABLE | OVERWEIGHT | BOOKED */
  rooms: (hotelId, { petId, checkIn, checkOut }) => http.get(`/pet-hotels/${hotelId}/rooms`, { petId, checkIn, checkOut }),
  reserve: ({ roomId, petId, checkInDate, checkOutDate }) => http.post('/hotel-reservations', { roomId, petId, checkInDate, checkOutDate }),
  myReservations: () => http.get('/users/me/hotel-reservations'),
  cancel: (reservationId) => http.patch(`/hotel-reservations/${reservationId}/cancel`),
  changeStatus: (reservationId, status) => http.patch(`/hotel-reservations/${reservationId}/status`, { status }),
};

export const shopApi = {
  categories: () => http.get('/product-categories'),
  products: (q) => http.get('/products', q), // { categoryId?, keyword?, page?, size? }
  product: (productId) => http.get(`/products/${productId}`),
};

export const cartApi = {
  get: () => http.get('/cart'),
  add: (productId, quantity = 1) => http.post('/cart/items', { productId, quantity }), // 같은 상품은 수량 합침
  update: (cartId, quantity) => http.patch(`/cart/items/${cartId}`, { quantity }),
  remove: (cartId) => http.delete(`/cart/items/${cartId}`),
};

export const orderApi = {
  /** 가상 결제 = 주문 생성 (재고 차감·장바구니 비우기를 한 트랜잭션으로) */
  create: ({ receiverName, receiverPhone, address }) => http.post('/orders', { receiverName, receiverPhone, address }),
  mine: () => http.get('/users/me/orders'),
  get: (orderId) => http.get(`/orders/${orderId}`),
  cancel: (orderId) => http.patch(`/orders/${orderId}/cancel`),
  // 관리자 (시연 모드에서는 주문한 본인도): ORDERED→PREPARING→SHIPPING→DELIVERED 한 단계씩
  changeStatus: (orderId, status) => http.patch(`/orders/${orderId}/status`, { status }),
};
