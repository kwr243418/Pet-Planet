// 목 API — FE2 예약·쇼핑 (docs/05_API_RESERVATION_COMMERCE.md 명세 + 백엔드 backend/ 구현과 같은 응답 모양)
// mockServer.js 의 handle() 이 회원·장소 API 다음에 이 함수를 불러요. 맞는 경로가 없으면 NO_MATCH 를 돌려줘요.

import { haversineKm } from '../utils/geo.js';
import { accessFields, byStop, matchRegion, originOf } from './seedTransit.js';
import { HOSPITALS, PET_HOTELS, PRODUCT_CATEGORIES, ROOM_TYPES, SHIPPING_FEE, seoulDate, slotTimes } from './seedCommerce.js';

export const NO_MATCH = Symbol('NO_MATCH');

const ACTIVE = ['PENDING', 'CONFIRMED'];
const RESERVATION_NEXT = { PENDING: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['COMPLETED', 'CANCELLED'], COMPLETED: [], CANCELLED: [] };
const ORDER_FLOW = ['ORDERED', 'PREPARING', 'SHIPPING', 'DELIVERED'];
const PHONE_RE = /^01[016789]-?\d{3,4}-?\d{4}$/;

const page = (rows, query, defSize) => {
  const p = Math.max(0, Number(query.page) || 0);
  const size = Math.min(50, Math.max(1, Number(query.size) || defSize));
  return { content: rows.slice(p * size, p * size + size), page: p, size, totalElements: rows.length, totalPages: Math.ceil(rows.length / size), hasNext: (p + 1) * size < rows.length };
};

/** "2026-11-20T14:00:00+09:00" / "2026-11-20T14:00" → { date, time, ms } (한국 시간) */
function parseWhen(s) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.exec(String(s ?? ''));
  if (!m) return null;
  const ms = new Date(m[5] ? s : `${m[1]}T${m[2]}:00+09:00`).getTime();
  if (Number.isNaN(ms)) return null;
  const seoul = new Date(ms + 9 * 3600_000).toISOString(); // UTC+9 로 옮겨서 날짜·시각을 읽어요
  return { date: seoul.slice(0, 10), time: seoul.slice(11, 16), ms, seconds: m[3] ? Number(m[3].slice(1)) : 0 };
}
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? '')) && !Number.isNaN(new Date(`${s}T00:00:00+09:00`).getTime());
const nightsOf = (a, b) => Math.round((new Date(`${b}T00:00:00+09:00`) - new Date(`${a}T00:00:00+09:00`)) / 86400000);

export function commerceRoutes({ r, db, me, auth, query, body, save, fail, ratingOf, own }) {
  let p;
  const role = () => auth().role;

  const products = () => db.products;
  const productById = (id) => db.products.find((x) => x.productId === Number(id));
  const categoryName = (id) => PRODUCT_CATEGORIES.find((c) => c.categoryId === id)?.name ?? null;
  const toProduct = (x, detail) => ({
    productId: x.productId, categoryId: x.categoryId, categoryName: categoryName(x.categoryId), name: x.name, price: x.price,
    stockQuantity: x.stockQuantity, soldOut: x.stockQuantity <= 0, imageUrl: x.imageUrl, ...ratingOf(db, 'PRODUCT', x.productId),
    description: detail ? x.description : null,
  });

  const toHospital = (h, origin) => ({
    hospitalId: h.hospitalId, name: h.name, address: h.address, phone: h.phone, lat: h.lat, lng: h.lng, operatingHours: h.operatingHours,
    intro: h.intro, departments: h.departments, lunchTime: h.lunchTime, partner: !!h.ownerId, ...ratingOf(db, 'HOSPITAL', h.hospitalId),
    ...accessFields(h.address, h.lat, h.lng), distanceKm: origin ? Number(haversineKm(origin.lat, origin.lng, h.lat, h.lng).toFixed(3)) : null,
  });
  const hospitalOr404 = (id) => HOSPITALS.find((h) => h.hospitalId === Number(id)) ?? fail(404, 'HOSPITAL_NOT_FOUND', '존재하지 않는 동물병원이에요.');

  const roomsOf = (hotelId) => ROOM_TYPES.filter((x) => x.hotelId === hotelId).sort((a, b) => a.maxWeight - b.maxWeight || a.pricePerNight - b.pricePerNight);
  const toHotel = (h, origin, withRooms) => {
    const rooms = roomsOf(h.hotelId);
    return {
      hotelId: h.hotelId, name: h.name, address: h.address, phone: h.phone, lat: h.lat, lng: h.lng, partner: !!h.ownerId,
      roomCount: rooms.length, minPrice: rooms.length ? Math.min(...rooms.map((x) => x.pricePerNight)) : null,
      ...accessFields(h.address, h.lat, h.lng), distanceKm: origin ? Number(haversineKm(origin.lat, origin.lng, h.lat, h.lng).toFixed(3)) : null,
      rooms: withRooms ? rooms.map((x) => ({ ...x, status: null, totalPrice: null })) : null,
    };
  };
  const hotelOr404 = (id) => PET_HOTELS.find((h) => h.hotelId === Number(id)) ?? fail(404, 'HOTEL_NOT_FOUND', '존재하지 않는 펫 호텔이에요.');

  const origin = () => originOf(query, fail);
  const kwMatch = (x) => !query.keyword || x.name.includes(String(query.keyword).trim()) || x.address.includes(String(query.keyword).trim());

  const petName = (petId) => db.pets.find((x) => x.petId === petId)?.name ?? null;
  const toHospitalReservation = (x) => ({
    reservationId: x.reservationId, kind: 'HOSPITAL', hospitalId: x.hospitalId, hospitalName: hospitalOr404(x.hospitalId).name,
    petId: x.petId, petName: petName(x.petId), reservationDate: x.reservationDate, status: x.status, createdAt: x.createdAt,
    reviewed: db.reviews.some((rv) => rv.userId === x.userId && rv.targetType === 'HOSPITAL' && rv.targetId === x.hospitalId),
  });
  const toHotelReservation = (x) => {
    const room = ROOM_TYPES.find((rt) => rt.roomId === x.roomId);
    const hotel = hotelOr404(room.hotelId);
    const nights = nightsOf(x.checkInDate, x.checkOutDate);
    return {
      reservationId: x.reservationId, kind: 'HOTEL', hotelId: hotel.hotelId, hotelName: hotel.name, roomId: room.roomId, roomName: room.roomName,
      petId: x.petId, petName: petName(x.petId), checkInDate: x.checkInDate, checkOutDate: x.checkOutDate, nights,
      totalPrice: room.pricePerNight * nights, status: x.status, createdAt: x.createdAt,
    };
  };
  const reservationTransition = (x, status) => {
    if (!RESERVATION_NEXT[status]) fail(400, 'VALIDATION_ERROR', '상태는 PENDING, CONFIRMED, COMPLETED, CANCELLED 중 하나예요.');
    if (!RESERVATION_NEXT[x.status].includes(status)) fail(409, 'INVALID_STATUS_CHANGE', `지금 상태에서는 바꿀 수 없어요. (${x.status} → ${status})`);
  };
  /** 시연 모드: 관리자 · 그 병원/호텔 사업자 · 예약한 본인 */
  const canChange = (user, ownerId, reservedBy) =>
    user.role === 'ADMIN' || (user.role === 'BUSINESS' && ownerId === user.userId) || reservedBy === user.userId ||
    fail(403, 'FORBIDDEN', '예약 상태는 병원·호텔 사업자나 관리자만 바꿀 수 있어요.');

  const toCart = (userId) => {
    const items = db.cart
      .filter((c) => c.userId === userId)
      .map((c) => {
        const x = productById(c.productId);
        return { cartId: c.cartId, productId: x.productId, categoryId: x.categoryId, categoryName: categoryName(x.categoryId), name: x.name, price: x.price, quantity: c.quantity, lineTotal: x.price * c.quantity, stockQuantity: x.stockQuantity, imageUrl: x.imageUrl };
      });
    const productAmount = items.reduce((s, i) => s + i.lineTotal, 0);
    const shippingFee = items.length ? SHIPPING_FEE : 0;
    return { items, itemCount: items.length, productAmount, shippingFee, totalAmount: productAmount + shippingFee };
  };
  const ownCartItem = (user, id) => {
    const c = db.cart.find((x) => x.cartId === Number(id)) ?? fail(404, 'CART_ITEM_NOT_FOUND', '장바구니에 없는 상품이에요.');
    if (c.userId !== user.userId) fail(403, 'FORBIDDEN', '내 장바구니만 바꿀 수 있어요.');
    return c;
  };
  const toOrder = (o, userId) => {
    const items = o.items.map((i) => ({
      productId: i.productId, name: productById(i.productId)?.name ?? '판매가 끝난 상품', quantity: i.quantity, price: i.price, lineTotal: i.price * i.quantity,
      reviewed: db.reviews.some((rv) => rv.userId === userId && rv.targetType === 'PRODUCT' && rv.targetId === i.productId),
    }));
    return {
      orderId: o.orderId, status: o.status, totalAmount: o.totalAmount, shippingFee: o.shippingFee, receiverName: o.receiverName, receiverPhone: o.receiverPhone,
      address: o.address, createdAt: o.createdAt, firstItemName: items[0]?.name ?? null, itemCount: items.length, items,
    };
  };
  const ownOrder = (user, id) => {
    const o = db.orders.find((x) => x.orderId === Number(id)) ?? fail(404, 'ORDER_NOT_FOUND', '주문을 찾을 수 없어요.');
    if (o.userId !== user.userId) fail(403, 'FORBIDDEN', '내 주문만 볼 수 있어요.');
    return o;
  };

  // ===== 동물병원 =====
  if ((p = r.is('GET', '/hospitals'))) {
    const o = origin();
    let rows = HOSPITALS.filter((h) => kwMatch(h) && (String(query.partner) !== 'true' || h.ownerId)).map((h) => toHospital(h, o)).filter((h) => matchRegion(h, query, fail));
    if (o && Number(query.radiusKm) > 0) rows = rows.filter((h) => h.distanceKm <= Number(query.radiusKm));
    if (o) rows.sort((a, b) => a.distanceKm - b.distanceKm);
    else rows.sort((a, b) => !a.partner - !b.partner || byStop(a, b) || a.hospitalId - b.hospitalId); // 지역: 제휴 → 정류장 가까운 순
    return page(rows, query, 10);
  }
  if ((p = r.is('GET', '/hospitals/:id'))) return toHospital(hospitalOr404(p.id));
  if ((p = r.is('GET', '/hospitals/:id/available-times'))) {
    const h = hospitalOr404(p.id);
    if (!isDate(query.date)) fail(400, 'VALIDATION_ERROR', '날짜를 2026-11-20 모양으로 보내 주세요.', [{ field: 'date', message: '날짜 형식이 올바르지 않아요.' }]);
    const taken = new Set(db.hospitalReservations.filter((x) => x.hospitalId === h.hospitalId && ACTIVE.includes(x.status)).map((x) => parseWhen(x.reservationDate)).filter((w) => w && w.date === query.date).map((w) => w.time));
    const now = Date.now();
    const slots = slotTimes(h.lunchTime).map((time) => ({ time, available: !taken.has(time) && new Date(`${query.date}T${time}:00+09:00`).getTime() > now }));
    return { hospitalId: h.hospitalId, date: query.date, slots };
  }
  if ((p = r.is('POST', '/hospital-reservations'))) {
    const user = auth();
    const errors = [];
    if (!body.hospitalId) errors.push({ field: 'hospitalId', message: '병원을 선택해 주세요.' });
    if (!body.petId) errors.push({ field: 'petId', message: '예약할 반려동물을 선택해 주세요.' });
    const when = parseWhen(body.reservationDate);
    if (!when) errors.push({ field: 'reservationDate', message: '예약 일시를 선택해 주세요.' });
    if (errors.length) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', errors);
    const pet = own(db, user, body.petId);
    const h = hospitalOr404(body.hospitalId);
    if (when.ms <= Date.now()) fail(400, 'VALIDATION_ERROR', '지난 날짜·시간은 예약할 수 없어요.', [{ field: 'reservationDate', message: '지난 날짜·시간은 예약할 수 없어요.' }]);
    if (when.seconds !== 0 || !slotTimes(h.lunchTime).includes(when.time)) fail(400, 'VALIDATION_ERROR', '예약 가능한 시간(30분 단위)을 골라 주세요.', [{ field: 'reservationDate', message: '예약 가능한 시간(30분 단위)을 골라 주세요.' }]);
    const clash = db.hospitalReservations.some((x) => x.hospitalId === h.hospitalId && ACTIVE.includes(x.status) && (() => { const w = parseWhen(x.reservationDate); return w && w.date === when.date && w.time === when.time; })());
    if (clash) fail(409, 'TIME_SLOT_TAKEN', '이미 예약이 찬 시간이에요. 다른 시간을 골라 주세요.');
    const row = { reservationId: ++db.seq.hospitalReservation, userId: user.userId, hospitalId: h.hospitalId, petId: pet.petId, reservationDate: `${when.date}T${when.time}:00+09:00`, status: 'PENDING', createdAt: new Date().toISOString() };
    db.hospitalReservations.push(row);
    save();
    return toHospitalReservation(row);
  }
  if ((p = r.is('GET', '/users/me/hospital-reservations'))) {
    const user = auth();
    return db.hospitalReservations.filter((x) => x.userId === user.userId).sort((a, b) => b.reservationDate.localeCompare(a.reservationDate)).map(toHospitalReservation);
  }
  if ((p = r.is('PATCH', '/hospital-reservations/:id/cancel')) || (p = r.is('PATCH', '/hotel-reservations/:id/cancel'))) {
    const user = auth();
    const hotel = r.is('PATCH', '/hotel-reservations/:id/cancel');
    const list = hotel ? db.hotelReservations : db.hospitalReservations;
    const x = list.find((y) => y.reservationId === Number(p.id)) ?? fail(404, 'RESERVATION_NOT_FOUND', '예약을 찾을 수 없어요.');
    if (x.userId !== user.userId) fail(403, 'FORBIDDEN', '내 예약만 취소할 수 있어요.');
    if (!ACTIVE.includes(x.status)) fail(409, 'RESERVATION_NOT_CANCELLABLE', '취소할 수 없는 예약이에요.');
    x.status = 'CANCELLED';
    save();
    return hotel ? toHotelReservation(x) : toHospitalReservation(x);
  }
  if ((p = r.is('PATCH', '/hospital-reservations/:id/status'))) {
    const user = auth();
    const x = db.hospitalReservations.find((y) => y.reservationId === Number(p.id)) ?? fail(404, 'RESERVATION_NOT_FOUND', '예약을 찾을 수 없어요.');
    canChange(user, hospitalOr404(x.hospitalId).ownerId, x.userId);
    reservationTransition(x, body.status);
    x.status = body.status;
    save();
    return toHospitalReservation(x);
  }

  // ===== 펫 호텔 =====
  if ((p = r.is('GET', '/pet-hotels'))) {
    const o = origin();
    let rows = PET_HOTELS.filter((h) => kwMatch(h) && (String(query.bookable) !== 'true' || roomsOf(h.hotelId).length)).map((h) => toHotel(h, o, false)).filter((h) => matchRegion(h, query, fail));
    if (o && Number(query.radiusKm) > 0) rows = rows.filter((h) => h.distanceKm <= Number(query.radiusKm));
    if (o) rows.sort((a, b) => a.distanceKm - b.distanceKm);
    else rows.sort((a, b) => !a.roomCount - !b.roomCount || byStop(a, b) || a.hotelId - b.hotelId); // 지역: 예약 가능 → 정류장 가까운 순
    return page(rows, query, 10);
  }
  if ((p = r.is('GET', '/pet-hotels/:id'))) return toHotel(hotelOr404(p.id), null, true);
  if ((p = r.is('GET', '/pet-hotels/:id/rooms'))) {
    const h = hotelOr404(p.id);
    const { checkIn, checkOut } = query;
    if (!isDate(checkIn) || !isDate(checkOut)) fail(400, 'VALIDATION_ERROR', '체크인·체크아웃 날짜를 선택해 주세요.');
    if (checkIn < seoulDate(0)) fail(400, 'VALIDATION_ERROR', '지난 날짜는 예약할 수 없어요.');
    if (checkOut <= checkIn) fail(400, 'VALIDATION_ERROR', '체크아웃은 체크인 다음 날 이후여야 해요.');
    const nights = nightsOf(checkIn, checkOut);
    const pet = query.petId ? own(db, auth(), query.petId) : null;
    const rooms = roomsOf(h.hotelId).map((room) => {
      let status = 'AVAILABLE';
      if (pet && pet.weight > room.maxWeight) status = 'OVERWEIGHT';
      else if (db.hotelReservations.some((x) => x.roomId === room.roomId && ACTIVE.includes(x.status) && x.checkInDate < checkOut && x.checkOutDate > checkIn)) status = 'BOOKED';
      return { ...room, status, totalPrice: status === 'AVAILABLE' ? room.pricePerNight * nights : null };
    });
    return { hotelId: h.hotelId, checkIn, checkOut, nights, pet: pet ? { petId: pet.petId, name: pet.name, weight: pet.weight } : null, rooms };
  }
  if ((p = r.is('POST', '/hotel-reservations'))) {
    const user = auth();
    const { roomId, petId, checkInDate, checkOutDate } = body;
    if (!roomId || !petId) fail(400, 'VALIDATION_ERROR', '객실과 반려동물을 선택해 주세요.');
    if (!isDate(checkInDate) || !isDate(checkOutDate)) fail(400, 'VALIDATION_ERROR', '체크인·체크아웃 날짜를 선택해 주세요.');
    if (checkInDate < seoulDate(0)) fail(400, 'VALIDATION_ERROR', '지난 날짜는 예약할 수 없어요.');
    if (checkOutDate <= checkInDate) fail(400, 'VALIDATION_ERROR', '체크아웃은 체크인 다음 날 이후여야 해요.');
    const pet = own(db, user, petId);
    const room = ROOM_TYPES.find((x) => x.roomId === Number(roomId)) ?? fail(404, 'ROOM_NOT_FOUND', '존재하지 않는 객실이에요.');
    if (pet.weight > room.maxWeight) fail(409, 'ROOM_OVERWEIGHT', `반려동물 체중(${pet.weight}kg)이 이 객실의 최대 수용 몸무게(${room.maxWeight}kg)를 넘어요.`);
    if (db.hotelReservations.some((x) => x.roomId === room.roomId && ACTIVE.includes(x.status) && x.checkInDate < checkOutDate && x.checkOutDate > checkInDate))
      fail(409, 'ROOM_ALREADY_BOOKED', '선택한 날짜에 이미 예약이 있어요. 다른 객실이나 날짜를 골라 주세요.');
    const row = { reservationId: ++db.seq.hotelReservation, userId: user.userId, roomId: room.roomId, petId: pet.petId, checkInDate, checkOutDate, status: 'PENDING', createdAt: new Date().toISOString() };
    db.hotelReservations.push(row);
    save();
    return toHotelReservation(row);
  }
  if ((p = r.is('GET', '/users/me/hotel-reservations'))) {
    const user = auth();
    return db.hotelReservations.filter((x) => x.userId === user.userId).sort((a, b) => b.checkInDate.localeCompare(a.checkInDate)).map(toHotelReservation);
  }
  if ((p = r.is('PATCH', '/hotel-reservations/:id/status'))) {
    const user = auth();
    const x = db.hotelReservations.find((y) => y.reservationId === Number(p.id)) ?? fail(404, 'RESERVATION_NOT_FOUND', '예약을 찾을 수 없어요.');
    const room = ROOM_TYPES.find((rt) => rt.roomId === x.roomId);
    canChange(user, hotelOr404(room.hotelId).ownerId, x.userId);
    reservationTransition(x, body.status);
    x.status = body.status;
    save();
    return toHotelReservation(x);
  }

  // ===== 상품 =====
  if ((p = r.is('GET', '/product-categories'))) return PRODUCT_CATEGORIES;
  if ((p = r.is('GET', '/products'))) {
    const kw = String(query.keyword ?? '').trim();
    const rows = products()
      .filter((x) => (!query.categoryId || x.categoryId === Number(query.categoryId)) && (!kw || x.name.includes(kw)))
      .map((x) => toProduct(x, false));
    const sorters = { price_asc: (a, b) => a.price - b.price, price_desc: (a, b) => b.price - a.price, rating: (a, b) => b.avgRating - a.avgRating || b.reviewCount - a.reviewCount };
    if (sorters[query.sort]) rows.sort(sorters[query.sort]);
    return page(rows, query, 20);
  }
  if ((p = r.is('GET', '/products/:id'))) return toProduct(productById(p.id) ?? fail(404, 'PRODUCT_NOT_FOUND', '존재하지 않는 상품이에요.'), true);

  // ===== 장바구니 =====
  if ((p = r.is('GET', '/cart'))) return toCart(auth().userId);
  if ((p = r.is('POST', '/cart/items'))) {
    const user = auth();
    const x = productById(body.productId) ?? fail(404, 'PRODUCT_NOT_FOUND', '존재하지 않는 상품이에요.');
    const q = body.quantity === undefined ? 1 : Number(body.quantity);
    if (!(q >= 1 && q <= 99)) fail(400, 'VALIDATION_ERROR', '수량은 1~99개로 담아 주세요.', [{ field: 'quantity', message: '수량은 1~99개로 담아 주세요.' }]);
    if (x.stockQuantity <= 0) fail(409, 'OUT_OF_STOCK', '품절된 상품이에요.');
    const hit = db.cart.find((c) => c.userId === user.userId && c.productId === x.productId);
    if ((hit?.quantity ?? 0) + q > x.stockQuantity) fail(409, 'OUT_OF_STOCK', `재고는 ${x.stockQuantity}개까지 담을 수 있어요.`);
    if (hit) hit.quantity += q; // 같은 상품은 수량 합치기 (ON DUPLICATE KEY UPDATE)
    else db.cart.push({ cartId: ++db.seq.cart, userId: user.userId, productId: x.productId, quantity: q });
    save();
    return toCart(user.userId);
  }
  if ((p = r.is('PATCH', '/cart/items/:id'))) {
    const user = auth();
    const c = ownCartItem(user, p.id);
    const q = Number(body.quantity);
    if (!(q >= 1)) fail(400, 'VALIDATION_ERROR', '수량은 1개 이상이어야 해요.');
    const stock = productById(c.productId).stockQuantity;
    if (q > stock) fail(409, 'OUT_OF_STOCK', `재고는 ${stock}개까지예요.`);
    c.quantity = q;
    save();
    return toCart(user.userId);
  }
  if ((p = r.is('DELETE', '/cart/items/:id'))) {
    const user = auth();
    const c = ownCartItem(user, p.id);
    db.cart = db.cart.filter((x) => x !== c);
    save();
    return null;
  }

  // ===== 주문 =====
  if ((p = r.is('POST', '/orders'))) {
    const user = auth();
    const name = String(body.receiverName ?? '').trim();
    const phone = String(body.receiverPhone ?? '').trim();
    const address = String(body.address ?? '').trim();
    const errors = [];
    if (name.length < 2) errors.push({ field: 'receiverName', message: '받는 분 이름을 2자 이상 입력해 주세요.' });
    if (!PHONE_RE.test(phone)) errors.push({ field: 'receiverPhone', message: '연락처를 010-0000-0000 모양으로 입력해 주세요.' });
    if (!address) errors.push({ field: 'address', message: '배송 주소를 입력해 주세요.' });
    if (errors.length) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', errors);
    const lines = db.cart.filter((c) => c.userId === user.userId);
    if (!lines.length) fail(400, 'CART_EMPTY', '장바구니가 비어 있어요.');
    // 트랜잭션 흉내: 먼저 전부 검사하고, 하나라도 부족하면 아무것도 바꾸지 않아요
    for (const c of lines) {
      const x = productById(c.productId);
      if (c.quantity > x.stockQuantity) fail(409, 'OUT_OF_STOCK', `'${x.name}' 재고가 부족해요 (남은 수량 ${Math.max(x.stockQuantity, 0)}개). 주문이 전체 취소됐고 장바구니는 그대로예요.`);
    }
    const items = lines.map((c) => ({ productId: c.productId, quantity: c.quantity, price: productById(c.productId).price }));
    items.forEach((i) => (productById(i.productId).stockQuantity -= i.quantity));
    const order = {
      orderId: ++db.seq.order, userId: user.userId, status: 'ORDERED', receiverName: name, receiverPhone: phone, address, shippingFee: SHIPPING_FEE,
      totalAmount: items.reduce((s, i) => s + i.price * i.quantity, 0) + SHIPPING_FEE, createdAt: new Date().toISOString(), items,
    };
    db.orders.push(order);
    db.cart = db.cart.filter((c) => c.userId !== user.userId);
    save();
    return toOrder(order, user.userId);
  }
  if ((p = r.is('GET', '/users/me/orders'))) {
    const user = auth();
    return db.orders.filter((o) => o.userId === user.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.orderId - a.orderId).map((o) => toOrder(o, user.userId));
  }
  if ((p = r.is('GET', '/orders/:id'))) {
    const user = auth();
    return toOrder(ownOrder(user, p.id), user.userId);
  }
  if ((p = r.is('PATCH', '/orders/:id/cancel'))) {
    const user = auth();
    const o = ownOrder(user, p.id);
    if (!['ORDERED', 'PREPARING'].includes(o.status)) fail(409, 'ORDER_NOT_CANCELLABLE', '배송이 시작된 주문은 취소할 수 없어요.');
    o.items.forEach((i) => {
      const x = productById(i.productId);
      if (x) x.stockQuantity += i.quantity; // 재고 되돌리기
    });
    o.status = 'CANCELLED';
    save();
    return toOrder(o, user.userId);
  }
  if ((p = r.is('PATCH', '/orders/:id/status'))) {
    const user = auth();
    const o = db.orders.find((x) => x.orderId === Number(p.id)) ?? fail(404, 'ORDER_NOT_FOUND', '주문을 찾을 수 없어요.');
    if (role() !== 'ADMIN' && o.userId !== user.userId) fail(403, 'FORBIDDEN', '배송 단계는 관리자만 바꿀 수 있어요.');
    const from = ORDER_FLOW.indexOf(o.status);
    const to = ORDER_FLOW.indexOf(body.status);
    if (to < 0) fail(400, 'VALIDATION_ERROR', '상태는 PREPARING, SHIPPING, DELIVERED 중 하나예요.');
    if (from < 0 || to !== from + 1) fail(409, 'INVALID_STATUS_CHANGE', `배송 단계는 한 단계씩만 올릴 수 있어요. (${o.status} → ${body.status})`);
    o.status = body.status;
    save();
    return toOrder(o, user.userId);
  }

  return NO_MATCH;
}

/** 리뷰 작성 자격 — 병원: 그 병원 예약이 이용완료 / 상품: 그 상품이 든 주문이 배송완료 (없으면 이유, 있으면 null) */
export function reviewNotAllowedReason(db, userId, targetType, targetId) {
  if (targetType === 'HOSPITAL') {
    return db.hospitalReservations.some((x) => x.userId === userId && x.hospitalId === targetId && x.status === 'COMPLETED')
      ? null
      : '진료(이용)가 완료된 병원만 리뷰를 쓸 수 있어요.';
  }
  if (targetType === 'PRODUCT') {
    return db.orders.some((o) => o.userId === userId && o.status === 'DELIVERED' && o.items.some((i) => i.productId === targetId))
      ? null
      : '배송이 완료된 상품만 리뷰를 쓸 수 있어요.';
  }
  return null;
}

/** 병원 리뷰 카드의 방문일 — 그 병원 이용완료 예약 중 가장 최근 날짜 */
export function visitDateOf(db, userId, hospitalId) {
  const dates = db.hospitalReservations.filter((x) => x.userId === userId && x.hospitalId === hospitalId && x.status === 'COMPLETED').map((x) => x.reservationDate.slice(0, 10));
  return dates.length ? dates.sort().at(-1) : null;
}
