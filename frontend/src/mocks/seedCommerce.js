// FE2(예약·쇼핑) 목 데이터 — db/seed_demo.sql 과 같은 가상 병원·호텔·상품 (목 모드와 실제 API 화면이 같게)
// ⚠️ 모두 가상 데이터예요. 날짜는 "오늘" 기준으로 만들어서 언제 열어도 시연이 돼요.
// 사용자·반려동물은 seed.js 의 SEED_USERS / SEED_PETS (1 = 데모 계정 박민서, 5 = 사업자 한바둑)

const OWNER_ID = 5; // seed.js 의 BUSINESS 계정 — 시연 병원·호텔 사업자

export const HOSPITALS = [
  {
    hospitalId: 1, ownerId: OWNER_ID, name: '펫플래닛 하당 동물병원', address: '전남광주통합특별시 목포시 하당로 000 (시연용)', phone: '061-000-0001',
    lat: 34.8107, lng: 126.4207, operatingHours: '평일 09:00-19:00 / 토 10:00-15:00 / 휴무: 일요일·공휴일',
    intro: '내과·외과·피부과·치과 진료를 한 곳에서 받을 수 있는 시연용 제휴 동물병원이에요. 예약하면 대기 없이 진료받을 수 있어요.',
    departments: ['내과', '외과', '피부과', '치과'], lunchTime: '13:00-14:00',
  },
  {
    hospitalId: 2, ownerId: OWNER_ID, name: '펫플래닛 옥암 동물병원', address: '전남광주통합특별시 목포시 옥암로 000 (시연용)', phone: '061-000-0002',
    lat: 34.8125, lng: 126.4447, operatingHours: '매일 10:00-20:00 / 휴무: 연중무휴',
    intro: '소형견·고양이 진료에 강점이 있는 시연용 제휴 병원이에요. 예방접종과 건강검진 예약이 많아요.',
    departments: ['내과', '예방접종', '건강검진'], lunchTime: '12:30-13:30',
  },
  {
    hospitalId: 3, ownerId: OWNER_ID, name: '펫플래닛 용해 동물병원', address: '전남광주통합특별시 목포시 용해로 000 (시연용)', phone: '061-000-0003',
    lat: 34.82, lng: 126.408, operatingHours: '평일 09:30-18:30 / 토 09:30-13:00 / 휴무: 일요일',
    intro: '정형외과·안과 진료가 가능한 시연용 제휴 병원이에요.',
    departments: ['내과', '외과', '안과'], lunchTime: '13:00-14:00',
  },
];

export const PET_HOTELS = [
  { hotelId: 1, ownerId: OWNER_ID, name: '펫플래닛 스테이 하당', address: '전남광주통합특별시 목포시 평화로 000 (시연용)', phone: '061-000-0101', lat: 34.808, lng: 126.423 },
  { hotelId: 2, ownerId: OWNER_ID, name: '펫플래닛 펫호텔 옥암', address: '전남광주통합특별시 목포시 남악로 000 (시연용)', phone: '061-000-0102', lat: 34.815, lng: 126.448 },
];

// 객실 (최대 수용 몸무게 maxWeight kg) — docs/07: 미디엄 15kg / 라지 30kg
export const ROOM_TYPES = [
  { roomId: 1, hotelId: 1, roomName: '미디엄 룸', pricePerNight: 45000, maxWeight: 15 },
  { roomId: 2, hotelId: 1, roomName: '라지 룸', pricePerNight: 60000, maxWeight: 30 },
  { roomId: 3, hotelId: 1, roomName: '스위트 룸', pricePerNight: 90000, maxWeight: 40 },
  { roomId: 4, hotelId: 2, roomName: '스몰 룸', pricePerNight: 35000, maxWeight: 7 },
  { roomId: 5, hotelId: 2, roomName: '미디엄 룸', pricePerNight: 48000, maxWeight: 15 },
  { roomId: 6, hotelId: 2, roomName: '라지 룸', pricePerNight: 65000, maxWeight: 30 },
];

export const PRODUCT_CATEGORIES = [
  { categoryId: 1, name: '사료' },
  { categoryId: 2, name: '간식' },
  { categoryId: 3, name: '위생용품' },
  { categoryId: 4, name: '용품' },
];

// stockQuantity 는 목 DB 에 복사해서 주문 때 줄어들어요
export const PRODUCTS = [
  { productId: 1, categoryId: 1, name: '그레인프리 연어 사료 2kg', price: 32000, stockQuantity: 24, imageUrl: null, description: '곡물을 뺀 연어 단일 단백질 사료. 알러지가 있는 아이에게 추천해요.' },
  { productId: 2, categoryId: 1, name: '소형견 저알러지 사료 1.5kg', price: 27000, stockQuantity: 2, imageUrl: null, description: '작은 알갱이로 소형견이 먹기 쉬워요. (재고 적음 시연용)' },
  { productId: 3, categoryId: 1, name: '시니어 관절 케어 사료 3kg', price: 45000, stockQuantity: 15, imageUrl: null, description: '글루코사민이 들어간 7세 이상 시니어용 사료예요.' },
  { productId: 4, categoryId: 2, name: '무첨가 닭가슴살 육포', price: 8500, stockQuantity: 40, imageUrl: null, description: '닭가슴살 100%, 첨가물 없이 저온 건조했어요.' },
  { productId: 5, categoryId: 2, name: '덴탈 껌 15개입', price: 6900, stockQuantity: 0, imageUrl: null, description: '하루 하나로 치석 관리. (품절 시연용)' },
  { productId: 6, categoryId: 2, name: '고구마 말랭이 200g', price: 7500, stockQuantity: 30, imageUrl: null, description: '국내산 고구마를 쪄서 말렸어요.' },
  { productId: 7, categoryId: 3, name: '배변패드 100매', price: 15000, stockQuantity: 60, imageUrl: null, description: '흡수력이 좋은 두꺼운 패드예요.' },
  { productId: 8, categoryId: 3, name: '저자극 샴푸 300ml', price: 12000, stockQuantity: 18, imageUrl: null, description: '피부가 예민한 아이도 쓸 수 있는 약산성 샴푸예요.' },
  { productId: 9, categoryId: 3, name: '귀 세정제 120ml', price: 9800, stockQuantity: 25, imageUrl: null, description: '산책 후 귀 청소용.' },
  { productId: 10, categoryId: 4, name: '대중교통용 소프트 이동장', price: 49000, stockQuantity: 12, imageUrl: null, description: '대중교통 규정에 맞춘 크기의 가벼운 이동장이에요.' },
  { productId: 11, categoryId: 4, name: '산책용 하네스 (소형)', price: 18000, stockQuantity: 5, imageUrl: null, description: '가슴을 감싸는 H형 하네스.' },
  { productId: 12, categoryId: 4, name: '접이식 휴대 물병', price: 11000, stockQuantity: 35, imageUrl: null, description: '산책·버스 이동 중에 물을 줄 수 있는 휴대 물병이에요.' },
];

export const SHIPPING_FEE = 3000;

// ---------- 날짜 도우미 (한국 시간 기준 YYYY-MM-DD) ----------
const seoulDate = (offsetDays = 0, now = new Date()) =>
  new Date(now.getTime() + offsetDays * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const at = (offsetDays, hhmm, now) => `${seoulDate(offsetDays, now)}T${hhmm}:00+09:00`;

/** 예약·주문·리뷰 시드 — 목 DB 를 새로 만들 때 "오늘" 기준으로 만들어요 */
export function commerceSeed(now = new Date()) {
  const hospitalReservations = [
    // 데모 계정(1): 이용완료 → 병원 리뷰 작성 가능 / 예약확정
    { reservationId: 1, userId: 1, hospitalId: 1, petId: 1, reservationDate: at(-7, '14:00', now), status: 'COMPLETED', createdAt: at(-9, '10:00', now) },
    { reservationId: 2, userId: 1, hospitalId: 2, petId: 2, reservationDate: at(3, '10:30', now), status: 'CONFIRMED', createdAt: at(-1, '10:00', now) },
    // 다른 이용자: 이용완료 (리뷰 근거) + 내일 14:00·15:00 마감 (S04 줄 그은 시간)
    { reservationId: 3, userId: 2, hospitalId: 1, petId: 3, reservationDate: at(-20, '11:00', now), status: 'COMPLETED', createdAt: at(-22, '10:00', now) },
    { reservationId: 4, userId: 3, hospitalId: 1, petId: 4, reservationDate: at(-15, '15:30', now), status: 'COMPLETED', createdAt: at(-17, '10:00', now) },
    { reservationId: 5, userId: 4, hospitalId: 1, petId: 5, reservationDate: at(-9, '10:00', now), status: 'COMPLETED', createdAt: at(-11, '10:00', now) },
    { reservationId: 6, userId: 2, hospitalId: 2, petId: 3, reservationDate: at(-12, '16:00', now), status: 'COMPLETED', createdAt: at(-14, '10:00', now) },
    { reservationId: 7, userId: 3, hospitalId: 1, petId: 4, reservationDate: at(1, '14:00', now), status: 'CONFIRMED', createdAt: at(-2, '10:00', now) },
    { reservationId: 8, userId: 4, hospitalId: 1, petId: 5, reservationDate: at(1, '15:00', now), status: 'PENDING', createdAt: at(-1, '11:00', now) },
  ];
  const hotelReservations = [
    // 스위트 룸 +2~+5일 예약확정 → BOOKED, 라지 룸 +10~+12일 승인대기
    { reservationId: 1, userId: 3, roomId: 3, petId: 4, checkInDate: seoulDate(2, now), checkOutDate: seoulDate(5, now), status: 'CONFIRMED', createdAt: at(-3, '10:00', now) },
    { reservationId: 2, userId: 4, roomId: 2, petId: 5, checkInDate: seoulDate(10, now), checkOutDate: seoulDate(12, now), status: 'PENDING', createdAt: at(-1, '10:00', now) },
    // 데모 계정: 지난달 1박 이용완료 → 마이페이지 "최근 예약한 병원 · 호텔"
    { reservationId: 3, userId: 1, roomId: 1, petId: 1, checkInDate: seoulDate(-40, now), checkOutDate: seoulDate(-39, now), status: 'COMPLETED', createdAt: at(-45, '10:00', now) },
  ];
  // 데모 계정의 병원 · 호텔 찜 (db/seed_demo.sql 과 같음)
  const hospitalBookmarks = [
    { bookmarkId: 1, userId: 1, hospitalId: 1, createdAt: at(-15, '10:00', now) },
    { bookmarkId: 2, userId: 1, hospitalId: 3, createdAt: at(-23, '10:00', now) },
  ];
  const hotelBookmarks = [{ bookmarkId: 1, userId: 1, hotelId: 2, createdAt: at(-35, '10:00', now) }];
  const orders = [
    // 데모 계정: 배송완료(→ 상품 리뷰 작성 가능) · 배송중
    { orderId: 1, userId: 1, status: 'DELIVERED', receiverName: '박민서', receiverPhone: '010-1234-5678', address: '전남광주통합특별시 목포시 하당로 000 (시연용)', shippingFee: SHIPPING_FEE, createdAt: at(-10, '12:00', now),
      items: [{ productId: 1, quantity: 1, price: 32000 }, { productId: 10, quantity: 1, price: 49000 }] },
    { orderId: 2, userId: 1, status: 'SHIPPING', receiverName: '박민서', receiverPhone: '010-1234-5678', address: '전남광주통합특별시 목포시 하당로 000 (시연용)', shippingFee: SHIPPING_FEE, createdAt: at(-1, '12:00', now),
      items: [{ productId: 7, quantity: 2, price: 15000 }] },
    { orderId: 3, userId: 2, status: 'DELIVERED', receiverName: '박댕댕', receiverPhone: '010-0000-0002', address: '전남광주통합특별시 목포시 (시연용)', shippingFee: SHIPPING_FEE, createdAt: at(-25, '12:00', now),
      items: [{ productId: 1, quantity: 1, price: 32000 }, { productId: 4, quantity: 1, price: 8500 }] },
    { orderId: 4, userId: 3, status: 'DELIVERED', receiverName: '정꼬리', receiverPhone: '010-0000-0003', address: '전남광주통합특별시 목포시 (시연용)', shippingFee: SHIPPING_FEE, createdAt: at(-18, '12:00', now),
      items: [{ productId: 10, quantity: 1, price: 49000 }, { productId: 6, quantity: 1, price: 7500 }] },
  ].map((o) => ({ ...o, totalAmount: o.items.reduce((s, i) => s + i.price * i.quantity, 0) + o.shippingFee }));
  const review = (reviewId, userId, targetType, targetId, petId, rating, content, daysAgo) => {
    const createdAt = at(-daysAgo, '18:00', now);
    return { reviewId, userId, targetType, targetId, petId, rating, content, createdAt, updatedAt: createdAt };
  };
  const reviews = [
    review(5001, 2, 'HOSPITAL', 1, 3, 5, '선생님이 차분하게 설명해 주셔서 믿음이 갔어요. 대기 없이 바로 진료받았어요.', 19),
    review(5002, 3, 'HOSPITAL', 1, 4, 4, '예약 시간에 맞춰 진료받았어요. 대형견도 편하게 기다릴 공간이 있었어요.', 14),
    review(5003, 4, 'HOSPITAL', 1, 5, 5, '피부 알레르기 치료를 꼼꼼하게 해 주셨어요. 다음 예약도 여기로 할게요.', 8),
    review(5004, 2, 'HOSPITAL', 2, 3, 4, '예방접종 받으러 갔는데 친절했어요. 주차는 조금 불편해요.', 11),
    review(5005, 2, 'PRODUCT', 1, 3, 5, '알러지 있는 두부도 잘 먹어요. 변 상태도 좋아졌어요.', 20),
    review(5006, 2, 'PRODUCT', 4, 3, 4, '산책 보상 간식으로 딱이에요. 조금 딱딱해서 잘라서 줘요.', 20),
    review(5007, 3, 'PRODUCT', 10, 4, 5, '버스 탈 때 들고 다니기 가볍고 튼튼해요. 소형견용으로 추천해요.', 15),
    review(5008, 3, 'PRODUCT', 6, 4, 4, '달지 않고 쫀득해서 잘 먹어요.', 15),
  ];
  return { hospitalReservations, hotelReservations, hospitalBookmarks, hotelBookmarks, orders, reviews };
}

/** 진료 예약 시간: 10:00~17:30, 30분 단위, 점심시간(기본 13:00-14:00) 제외 — 백엔드 HospitalService.slotTimes 와 같음 */
export function slotTimes(lunchTime = '13:00-14:00') {
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const [ls, le] = (lunchTime || '13:00-14:00').replace('~', '-').split('-').map((s) => s.trim());
  const lunch = /^\d\d:\d\d$/.test(ls ?? '') && /^\d\d:\d\d$/.test(le ?? '') ? [toMin(ls), toMin(le)] : null;
  const out = [];
  for (let m = 10 * 60; m <= 17 * 60 + 30; m += 30) {
    if (lunch && m >= lunch[0] && m < lunch[1]) continue;
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
}

export { seoulDate };
