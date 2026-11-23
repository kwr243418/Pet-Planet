// FE2 임시 가짜 데이터 — 모양은 docs/05_API_RESERVATION_COMMERCE.md §3 응답과 같게 맞춰 둠
// API 연결 때 이 파일 대신 shopApi 호출로 바꾸면 됨

export const PRODUCT_CATEGORIES = [
  { categoryId: 1, name: '사료' },
  { categoryId: 2, name: '간식' },
  { categoryId: 3, name: '위생용품' },
  { categoryId: 4, name: '용품' },
];

export const PRODUCTS = [
  { productId: 1, categoryId: 1, categoryName: '사료', name: '그레인프리 연어 사료 2kg', price: 32000, stockQuantity: 24, soldOut: false, imageUrl: null, avgRating: 4.5, reviewCount: 8 },
  { productId: 2, categoryId: 1, categoryName: '사료', name: '소형견 저알러지 사료 1.5kg', price: 27000, stockQuantity: 3, soldOut: false, imageUrl: null, avgRating: 4.2, reviewCount: 5 },
  { productId: 3, categoryId: 2, categoryName: '간식', name: '무첨가 닭가슴살 육포', price: 8500, stockQuantity: 40, soldOut: false, imageUrl: null, avgRating: 4.8, reviewCount: 12 },
  { productId: 4, categoryId: 2, categoryName: '간식', name: '덴탈 껌 15개입', price: 6900, stockQuantity: 0, soldOut: true, imageUrl: null, avgRating: 4.0, reviewCount: 3 },
  { productId: 5, categoryId: 3, categoryName: '위생용품', name: '배변패드 100매', price: 15000, stockQuantity: 60, soldOut: false, imageUrl: null, avgRating: 4.6, reviewCount: 20 },
  { productId: 6, categoryId: 3, categoryName: '위생용품', name: '저자극 샴푸 300ml', price: 12000, stockQuantity: 18, soldOut: false, imageUrl: null, avgRating: 4.3, reviewCount: 7 },
  { productId: 7, categoryId: 4, categoryName: '용품', name: '지하철용 소프트 이동장', price: 49000, stockQuantity: 12, soldOut: false, imageUrl: null, avgRating: 4.7, reviewCount: 9 },
  { productId: 8, categoryId: 4, categoryName: '용품', name: '산책용 하네스 (소형)', price: 18000, stockQuantity: 5, soldOut: false, imageUrl: null, avgRating: 4.4, reviewCount: 6 },
];

export const HOSPITALS = [
  {
    hospitalId: 1,
    name: '동물메디컬센터',
    address: '서울 마포구 양화로 00',
    phone: '02-000-0000',
    operatingHours: '평일 09:00-19:00 / 토 10:00-15:00 / 일 휴진',
    lunchTime: '13:00-14:00',
    intro: '내과·외과·피부과 진료를 한 곳에서 받을 수 있는 제휴 동물병원이에요. 예약하면 대기 시간을 줄일 수 있어요.',
    departments: ['내과', '외과', '피부과', '치과'],
    nearestStation: { stationName: '홍대입구', lines: ['2호선'], distanceKm: 0.4 },
  },
  {
    hospitalId: 2,
    name: '해든 동물병원',
    address: '서울 강남구 테헤란로 00',
    phone: '02-111-1111',
    operatingHours: '평일 10:00-20:00 / 토 10:00-17:00 / 일 휴진',
    lunchTime: '14:00-15:00',
    intro: '소형견과 고양이 진료에 강점이 있는 병원이에요.',
    departments: ['내과', '건강검진'],
    nearestStation: { stationName: '강남', lines: ['2호선'], distanceKm: 0.6 },
  },
];

export const HOSPITAL_REVIEWS = [
  { reviewId: 1, hospitalId: 1, userName: '콩이맘', rating: 5, content: '선생님이 차분하게 설명해 주셔서 믿음이 갔어요.', createdAt: '2026-11-20T10:00:00+09:00', visitDate: '2026-11-19', petBreed: '푸들', petWeight: 3.2, mine: false },
  { reviewId: 2, hospitalId: 1, userName: '보리아빠', rating: 4, content: '예약 시간에 맞춰 바로 진료받았어요. 주차가 조금 불편해요.', createdAt: '2026-11-18T15:30:00+09:00', visitDate: '2026-11-18', petBreed: '골든 리트리버', petWeight: 28, mine: false },
  { reviewId: 3, hospitalId: 1, userName: '모카', rating: 5, content: '피부 알레르기 치료를 꼼꼼하게 해 주셨어요.', createdAt: '2026-11-15T11:20:00+09:00', visitDate: '2026-11-14', petBreed: '웰시코기', petWeight: 12.4, mine: false },
  { reviewId: 4, hospitalId: 1, userName: '라떼', rating: 3, content: '진료는 좋았는데 대기실이 좁아서 아쉬웠어요.', createdAt: '2026-11-10T09:10:00+09:00', visitDate: '2026-11-09', petBreed: '비숑 프리제', petWeight: 6.2, mine: false },
  { reviewId: 5, hospitalId: 1, userName: '바둑이', rating: 5, content: '건강검진 결과를 자세히 알려주셔서 좋았어요.', createdAt: '2026-11-05T14:00:00+09:00', visitDate: '2026-11-04', petBreed: '믹스', petWeight: 9.1, mine: false },
  { reviewId: 6, hospitalId: 2, userName: '두부', rating: 4, content: '고양이도 스트레스 덜 받게 진료해 주셨어요.', createdAt: '2026-11-17T16:00:00+09:00', visitDate: '2026-11-16', petBreed: '코리안 숏헤어', petWeight: 4.1, mine: false },
];

// ---------- 병원 예약 (S04) ----------
// 30분 단위, 점심시간(13:00-14:00) 제외
export const TIME_SLOTS = ['10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];

// 이 화면에서 신청한 예약 (새로고침하면 사라져요 — API 연결 전 임시)
export const HOSPITAL_RESERVATIONS = [];

// 날짜마다 일부 시간은 이미 예약이 찬 것으로 보이게 만드는 가짜 규칙
const seedTaken = (hospitalId, date, i) => {
  const code = [...`${hospitalId}${date}`].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return (code + i * 7) % 5 === 0;
};

/** 그날의 시간 버튼 목록 + 마감 여부 (docs/05 GET /hospitals/{id}/available-times 와 같은 모양) */
export function getAvailableTimes(hospitalId, date) {
  const mine = HOSPITAL_RESERVATIONS.filter((r) => r.hospitalId === hospitalId && r.reservationDate.startsWith(date) && r.status !== 'CANCELLED').map((r) => r.reservationDate.slice(11, 16));
  return TIME_SLOTS.map((time, i) => ({ time, available: !seedTaken(hospitalId, date, i) && !mine.includes(time) }));
}

/** 진료 예약 신청 (docs/05 POST /hospital-reservations 와 같은 모양으로 응답) */
export function createHospitalReservation({ hospitalId, petId, petName, reservationDate }) {
  const date = reservationDate.slice(0, 10);
  const time = reservationDate.slice(11, 16);
  const slot = getAvailableTimes(hospitalId, date).find((s) => s.time === time);
  if (!slot?.available) {
    const e = new Error('이미 예약이 찬 시간이에요. 다른 시간을 골라 주세요.');
    e.code = 'TIME_SLOT_TAKEN';
    throw e;
  }
  const hospital = HOSPITALS.find((h) => h.hospitalId === hospitalId);
  const row = { reservationId: HOSPITAL_RESERVATIONS.length + 1, hospitalId, hospitalName: hospital.name, petId, petName, reservationDate, status: 'PENDING' };
  HOSPITAL_RESERVATIONS.push(row);
  return row;
}

// ---------- 펫 호텔 (S05) ----------
const todayStr = () => new Date().toLocaleDateString('sv-SE');
/** 'YYYY-MM-DD' 날짜에 n일을 더해요 */
export const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('sv-SE');
};

export const PET_HOTELS = [
  { hotelId: 1, name: '멍냥 스테이', address: '서울 마포구 와우산로 00', phone: '02-222-0000', nearestStation: { stationName: '홍대입구', distanceKm: 0.5 } },
  { hotelId: 2, name: '포근 펫호텔', address: '서울 강남구 논현로 00', phone: '02-333-0000', nearestStation: { stationName: '강남', distanceKm: 0.7 } },
];

// 객실 (최대 수용 몸무게 maxWeight kg)
export const ROOM_TYPES = [
  { roomId: 1, hotelId: 1, roomName: '미디엄 룸', pricePerNight: 45000, maxWeight: 15 },
  { roomId: 2, hotelId: 1, roomName: '라지 룸', pricePerNight: 60000, maxWeight: 30 },
  { roomId: 3, hotelId: 1, roomName: '스위트 룸', pricePerNight: 90000, maxWeight: 40 },
  { roomId: 4, hotelId: 2, roomName: '미디엄 룸', pricePerNight: 48000, maxWeight: 15 },
  { roomId: 5, hotelId: 2, roomName: '라지 룸', pricePerNight: 65000, maxWeight: 30 },
];

// 이 화면에서 신청한 예약 (새로고침하면 사라져요 — API 연결 전 임시)
export const HOTEL_RESERVATIONS = [];

// 이미 예약이 있는 것으로 보이게 하는 가짜 예약 (오늘 기준이라 날짜가 지나도 계속 쓸 수 있어요)
const seedBookings = () => [
  { roomId: 3, checkInDate: addDays(todayStr(), 2), checkOutDate: addDays(todayStr(), 5) },
  { roomId: 2, checkInDate: addDays(todayStr(), 10), checkOutDate: addDays(todayStr(), 12) },
  { roomId: 5, checkInDate: addDays(todayStr(), 3), checkOutDate: addDays(todayStr(), 6) },
];

const nightsOf = (checkIn, checkOut) => Math.round((new Date(`${checkOut}T00:00:00`) - new Date(`${checkIn}T00:00:00`)) / 86400000);

// 기간 겹침: 기존 체크인 < 새 체크아웃 AND 기존 체크아웃 > 새 체크인 (docs/05 §2)
const isBooked = (roomId, checkIn, checkOut) =>
  [...seedBookings(), ...HOTEL_RESERVATIONS.filter((r) => r.status !== 'CANCELLED')].some((b) => b.roomId === roomId && b.checkInDate < checkOut && b.checkOutDate > checkIn);

/** 객실 목록 + 상태 3종 AVAILABLE | OVERWEIGHT | BOOKED (docs/05 GET /pet-hotels/{id}/rooms 와 같은 모양) */
export function getHotelRooms({ hotelId, petWeight, checkIn, checkOut }) {
  const nights = nightsOf(checkIn, checkOut);
  return ROOM_TYPES.filter((r) => r.hotelId === hotelId).map((r) => {
    let status = 'AVAILABLE';
    if (petWeight > r.maxWeight) status = 'OVERWEIGHT';
    else if (isBooked(r.roomId, checkIn, checkOut)) status = 'BOOKED';
    return { ...r, status, totalPrice: status === 'AVAILABLE' ? r.pricePerNight * nights : null };
  });
}

/** 객실 예약 신청 — 서버처럼 한 번 더 검사해요 (docs/05 POST /hotel-reservations) */
export function createHotelReservation({ roomId, petId, petName, petWeight, checkInDate, checkOutDate }) {
  const room = ROOM_TYPES.find((r) => r.roomId === roomId);
  const fail = (code, message) => Object.assign(new Error(message), { code });
  if (petWeight > room.maxWeight) throw fail('ROOM_OVERWEIGHT', '반려동물 체중이 이 객실의 최대 수용 몸무게를 넘어요.');
  if (isBooked(roomId, checkInDate, checkOutDate)) throw fail('ROOM_ALREADY_BOOKED', '선택한 날짜에 이미 예약이 있어요. 다른 객실이나 날짜를 골라 주세요.');
  const hotel = PET_HOTELS.find((h) => h.hotelId === room.hotelId);
  const nights = nightsOf(checkInDate, checkOutDate);
  const row = {
    reservationId: HOTEL_RESERVATIONS.length + 1,
    roomId,
    hotelName: hotel.name,
    roomName: room.roomName,
    petId,
    petName,
    checkInDate,
    checkOutDate,
    nights,
    totalPrice: room.pricePerNight * nights,
    status: 'PENDING',
  };
  HOTEL_RESERVATIONS.push(row);
  return row;
}

// ---------- 장바구니 · 주문 (S06 · S07) ----------
const SHIPPING_FEE = 3000;
const makeError = (code, message) => Object.assign(new Error(message), { code });

export const CART = []; // { cartId, productId, quantity } — 새로고침하면 사라져요 (API 연결 전 임시)
export const ORDERS = [];
let cartSeq = 1;

/** 장바구니 담기 — 같은 상품이면 수량을 합쳐요 (재고까지만) */
export function addToCart(productId, quantity = 1) {
  const p = PRODUCTS.find((x) => x.productId === productId);
  if (!p || p.soldOut) throw makeError('OUT_OF_STOCK', '품절된 상품이에요.');
  const hit = CART.find((i) => i.productId === productId);
  if (hit) hit.quantity = Math.min(hit.quantity + quantity, p.stockQuantity);
  else CART.push({ cartId: cartSeq++, productId, quantity: Math.min(quantity, p.stockQuantity) });
}

/** 내 장바구니 + 합계 (docs/05 GET /cart 와 같은 모양) */
export function getCart() {
  const items = CART.map((c) => {
    const p = PRODUCTS.find((x) => x.productId === c.productId);
    return {
      cartId: c.cartId,
      productId: p.productId,
      categoryId: p.categoryId,
      categoryName: p.categoryName,
      name: p.name,
      price: p.price,
      quantity: c.quantity,
      lineTotal: p.price * c.quantity,
      stockQuantity: p.stockQuantity,
      imageUrl: p.imageUrl,
    };
  });
  const productAmount = items.reduce((s, i) => s + i.lineTotal, 0);
  const shippingFee = items.length ? SHIPPING_FEE : 0;
  return { items, itemCount: items.length, productAmount, shippingFee, totalAmount: productAmount + shippingFee };
}

export function updateCartItem(cartId, quantity) {
  const item = CART.find((i) => i.cartId === cartId);
  const p = PRODUCTS.find((x) => x.productId === item.productId);
  item.quantity = Math.max(1, Math.min(quantity, p.stockQuantity));
}

export function removeCartItem(cartId) {
  const idx = CART.findIndex((i) => i.cartId === cartId);
  if (idx >= 0) CART.splice(idx, 1);
}

/** 가상 결제 = 주문 생성. 하나라도 재고가 부족하면 전체 취소, 장바구니는 그대로 (docs/05 §5 트랜잭션 규칙) */
export function createOrder({ receiverName, receiverPhone, address }) {
  const cart = getCart();
  if (!cart.items.length) throw makeError('CART_EMPTY', '장바구니가 비어 있어요.');
  const short = cart.items.find((i) => i.quantity > i.stockQuantity);
  if (short) throw makeError('OUT_OF_STOCK', `'${short.name}' 재고가 부족해요. 주문이 전체 취소됐고 장바구니는 그대로예요.`);
  // 여기부터는 모두 성공: 재고 차감 → 주문 만들기 → 장바구니 비우기
  cart.items.forEach((i) => {
    const p = PRODUCTS.find((x) => x.productId === i.productId);
    p.stockQuantity -= i.quantity;
    p.soldOut = p.stockQuantity === 0;
  });
  const order = {
    orderId: ORDERS.length + 1,
    status: 'ORDERED',
    receiverName,
    receiverPhone,
    address,
    totalAmount: cart.totalAmount,
    shippingFee: cart.shippingFee,
    items: cart.items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, price: i.price })),
    createdAt: new Date().toISOString(),
  };
  ORDERS.push(order);
  CART.length = 0;
  return order;
}

// ---------- 마이페이지 (S08): 예약 취소 · 주문 취소 · 시연용 상태 변경 ----------
const RESERVATION_FLOW = ['PENDING', 'CONFIRMED', 'COMPLETED']; // 승인대기 → 예약확정 → 이용완료
const ORDER_FLOW = ['ORDERED', 'PREPARING', 'SHIPPING', 'DELIVERED']; // 결제완료 → 배송준비 → 배송중 → 배송완료
const reservationList = (kind) => (kind === 'hospital' ? HOSPITAL_RESERVATIONS : HOTEL_RESERVATIONS);

/** 예약 취소 — 승인대기·예약확정만 (docs/05 PATCH .../cancel) */
export function cancelReservation(kind, reservationId) {
  const r = reservationList(kind).find((x) => x.reservationId === reservationId);
  if (!r || !['PENDING', 'CONFIRMED'].includes(r.status)) throw makeError('RESERVATION_NOT_CANCELLABLE', '취소할 수 없는 예약이에요.');
  r.status = 'CANCELLED';
}

/** (시연용) 병원·호텔이 승인하는 것처럼 상태를 한 단계 올려요 */
export function advanceReservation(kind, reservationId) {
  const r = reservationList(kind).find((x) => x.reservationId === reservationId);
  const i = r ? RESERVATION_FLOW.indexOf(r.status) : -1;
  if (i >= 0 && i < RESERVATION_FLOW.length - 1) r.status = RESERVATION_FLOW[i + 1];
}

/** 주문 취소 — 배송 시작 전까지만, 재고는 되돌려요 (docs/05 §5) */
export function cancelOrder(orderId) {
  const o = ORDERS.find((x) => x.orderId === orderId);
  if (!o || !['ORDERED', 'PREPARING'].includes(o.status)) throw makeError('ORDER_NOT_CANCELLABLE', '배송이 시작된 주문은 취소할 수 없어요.');
  o.items.forEach((i) => {
    const p = PRODUCTS.find((x) => x.productId === i.productId);
    p.stockQuantity += i.quantity;
    p.soldOut = false;
  });
  o.status = 'CANCELLED';
}

/** (시연용) 배송 단계를 한 단계 올려요 */
export function advanceOrder(orderId) {
  const o = ORDERS.find((x) => x.orderId === orderId);
  const i = o ? ORDER_FLOW.indexOf(o.status) : -1;
  if (i >= 0 && i < ORDER_FLOW.length - 1) o.status = ORDER_FLOW[i + 1];
}

// ---------- 리뷰 · 별점 (S04-0 · S06 · S08) ----------
export const PRODUCT_REVIEWS = [];
let reviewSeq = 100;

/** 병원 리뷰 — 이용완료(COMPLETED)된 예약만, 예약 1건에 1번 (docs/05 §6) */
export function createHospitalReview({ reservationId, rating, content, pet }) {
  const r = HOSPITAL_RESERVATIONS.find((x) => x.reservationId === reservationId);
  if (!r || r.status !== 'COMPLETED') throw makeError('REVIEW_NOT_ALLOWED', '이용이 완료된 예약만 리뷰를 쓸 수 있어요.');
  if (r.reviewed) throw makeError('REVIEW_DUPLICATE', '이미 리뷰를 작성한 예약이에요.');
  const review = {
    reviewId: ++reviewSeq,
    hospitalId: r.hospitalId,
    userName: '나',
    rating,
    content,
    createdAt: new Date().toISOString(),
    visitDate: r.reservationDate.slice(0, 10),
    petBreed: pet?.breed ?? '-',
    petWeight: pet?.weight ?? 0,
    mine: true,
  };
  HOSPITAL_REVIEWS.push(review);
  r.reviewed = true;
  return review;
}

/** 상품 리뷰 — 배송완료(DELIVERED)된 주문의 상품만, 주문 상품 1개에 1번. 상품 평균 별점·리뷰 수도 갱신해요 */
export function createProductReview({ orderId, productId, rating, content }) {
  const o = ORDERS.find((x) => x.orderId === orderId);
  const item = o?.items.find((i) => i.productId === productId);
  if (!o || !item || o.status !== 'DELIVERED') throw makeError('REVIEW_NOT_ALLOWED', '배송이 완료된 상품만 리뷰를 쓸 수 있어요.');
  if (item.reviewed) throw makeError('REVIEW_DUPLICATE', '이미 리뷰를 작성한 상품이에요.');
  const p = PRODUCTS.find((x) => x.productId === productId);
  PRODUCT_REVIEWS.push({ reviewId: ++reviewSeq, productId, userName: '나', rating, content, createdAt: new Date().toISOString(), mine: true });
  p.avgRating = Math.round(((p.avgRating * p.reviewCount + rating) / (p.reviewCount + 1)) * 10) / 10;
  p.reviewCount += 1;
  item.reviewed = true;
}