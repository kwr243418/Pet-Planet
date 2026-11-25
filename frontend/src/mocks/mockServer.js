// 목(mock) API 서버 — docs/04_API_USER_PLACE.md (레포 루트) 명세 그대로 동작합니다.
// BE API가 준비되면 VITE_USE_MOCK=false 로 바꾸기만 하면 같은 화면이 실제 API로 동작해요.

import { haversineKm } from '../utils/geo.js';
import { STATIONS, PLACE_CATEGORIES, PLACES, SEED_USERS, SEED_PETS, SEED_REVIEWS, SEED_BOOKMARKS } from './seed.js';
import { HOSPITALS, PRODUCTS, commerceSeed } from './seedCommerce.js';
import { NO_MATCH, commerceRoutes, reviewNotAllowedReason, visitDateOf } from './mockCommerce.js';

const DB_KEY = 'pp-mock-db-v3'; // v3: FE2 예약·쇼핑 데이터 추가
export const NEARBY_KM = 1; // place_stations 매핑 기준 반경

// ---------- 저장소 (브라우저: localStorage / 테스트: 메모리) ----------
const memoryStore = new Map();
const hasLS = () => typeof localStorage !== 'undefined';
const defaultStorage = {
  getItem: (k) => (hasLS() ? localStorage.getItem(k) : memoryStore.get(k) ?? null),
  setItem: (k, v) => (hasLS() ? localStorage.setItem(k, v) : memoryStore.set(k, v)),
};

function freshDb() {
  const commerce = commerceSeed();
  return {
    users: structuredClone(SEED_USERS),
    pets: structuredClone(SEED_PETS),
    reviews: [...structuredClone(SEED_REVIEWS), ...commerce.reviews],
    bookmarks: structuredClone(SEED_BOOKMARKS),
    // FE2 (예약·쇼핑) — 재고가 줄어들어서 상품도 DB 에 복사
    products: structuredClone(PRODUCTS),
    hospitalReservations: commerce.hospitalReservations,
    hotelReservations: commerce.hotelReservations,
    orders: commerce.orders,
    cart: [],
    seq: { user: 100, pet: 100, review: 6000, bookmark: 100, hospitalReservation: 100, hotelReservation: 100, order: 100, cart: 100 },
  };
}

// place_stations: 장소별 반경 1km 이내 역 (BE1이 하버사인으로 미리 계산해 저장하는 테이블과 동일)
export const PLACE_STATIONS = (() => {
  const rows = [];
  let id = 1;
  for (const p of PLACES) {
    for (const s of STATIONS) {
      const d = haversineKm(p.lat, p.lng, s.lat, s.lng);
      if (d <= NEARBY_KM) rows.push({ mappingId: id++, placeId: p.placeId, stationId: s.stationId, distanceKm: Number(d.toFixed(3)) });
    }
  }
  return rows;
})();

export class MockHttpError extends Error {
  constructor(status, code, message, fieldErrors) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}
const fail = (status, code, message, fieldErrors) => {
  throw new MockHttpError(status, code, message, fieldErrors);
};

const encodeToken = (userId) => `mock.${btoa(JSON.stringify({ uid: userId, iat: Date.now() }))}`;
function decodeToken(token) {
  try {
    if (!token?.startsWith('mock.')) return null;
    return JSON.parse(atob(token.slice(5))).uid;
  } catch {
    return null;
  }
}

// ---------- 조회 헬퍼 ----------
const stationById = new Map(STATIONS.map((s) => [s.stationId, s]));
const categoryById = new Map(PLACE_CATEGORIES.map((c) => [c.categoryId, c]));
const SIZE_ORDER = { SMALL: 1, MEDIUM: 2, LARGE: 3 };
const linesOf = (name) => STATIONS.filter((s) => s.stationName === name).map((s) => s.line);

/** 역 단건 응답: 선택한 호선 행 + 이 역을 지나는 모든 호선 */
const toStation = (s) => ({ stationId: s.stationId, stationName: s.stationName, line: s.line, seq: s.seq, lat: s.lat, lng: s.lng, lines: linesOf(s.stationName) });

function groupStations(rows) {
  const map = new Map();
  for (const s of rows) {
    if (!map.has(s.stationName)) map.set(s.stationName, { ...toStation(s), distanceKm: s.distanceKm });
  }
  return [...map.values()];
}

/** 장소의 인접역(역 이름 기준으로 묶음, 가까운 순) */
function nearbyStationsOf(placeId) {
  const rows = PLACE_STATIONS.filter((m) => m.placeId === placeId)
    .map((m) => ({ ...stationById.get(m.stationId), distanceKm: m.distanceKm }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return groupStations(rows);
}

function ratingOf(db, targetType, targetId) {
  const list = db.reviews.filter((r) => r.targetType === targetType && r.targetId === targetId);
  const sum = list.reduce((a, r) => a + r.rating, 0);
  return { avgRating: list.length ? Number((sum / list.length).toFixed(1)) : 0, reviewCount: list.length };
}

function toPlaceSummary(db, p, { userId, origin } = {}) {
  const near = nearbyStationsOf(p.placeId);
  return {
    placeId: p.placeId,
    name: p.name,
    categoryId: p.categoryId,
    categoryName: categoryById.get(p.categoryId)?.name,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    maxSize: p.maxSize,
    indoorType: p.indoorType,
    imageUrl: p.imageUrl,
    ...ratingOf(db, 'PLACE', p.placeId),
    bookmarked: !!userId && db.bookmarks.some((b) => b.userId === userId && b.placeId === p.placeId),
    nearestStation: near[0] ?? null,
    distanceKm: origin ? Number(haversineKm(origin.lat, origin.lng, p.lat, p.lng).toFixed(3)) : null,
  };
}

const csv = (v, map = (x) => x) =>
  v === undefined || v === null || v === '' ? [] : String(v).split(',').filter(Boolean).map(map);

/**
 * 다중 조건 장소 검색 (BE1 "다중 조건 장소 검색 SQL"에 대응)
 * query: stationId | lat+lng(내 위치), radiusKm(0.5~5), categoryIds, sizes, indoor, lines, keyword, sort(distance|reviews|rating), page, size
 */
export function searchPlaces(db, query = {}, userId) {
  const categoryIds = csv(query.categoryIds, Number);
  const lines = csv(query.lines);
  const sizes = csv(query.sizes);
  const indoor = csv(query.indoor);
  const keyword = (query.keyword ?? '').trim();
  const radiusKm = Math.min(Number(query.radiusKm) || NEARBY_KM, 5);
  const page = Math.max(0, Number(query.page) || 0);
  const size = Math.min(50, Math.max(1, Number(query.size) || 10));

  let origin = null;
  if (query.lat != null && query.lng != null) {
    // 내 위치 기준 (백엔드 Origin.resolve 와 같은 규칙)
    origin = { stationId: 0, stationName: '내 위치', lat: Number(query.lat), lng: Number(query.lng) };
  } else if (query.stationId) {
    origin = stationById.get(Number(query.stationId));
    if (!origin) fail(404, 'STATION_NOT_FOUND', '존재하지 않는 지하철역이에요.');
  }

  const rows = PLACES.filter((p) => {
    if (categoryIds.length && !categoryIds.includes(p.categoryId)) return false;
    if (sizes.length && !sizes.every((s) => SIZE_ORDER[s] <= SIZE_ORDER[p.maxSize])) return false;
    if (indoor.length && !indoor.includes(p.indoorType)) return false;
    if (keyword && !(p.name.includes(keyword) || p.address.includes(keyword))) return false;
    if (origin && haversineKm(origin.lat, origin.lng, p.lat, p.lng) > radiusKm) return false;
    if (lines.length) {
      const near = PLACE_STATIONS.filter((m) => m.placeId === p.placeId).map((m) => stationById.get(m.stationId).line);
      if (!near.some((l) => lines.includes(l))) return false;
    }
    return true;
  }).map((p) => toPlaceSummary(db, p, { userId, origin }));

  const sort = query.sort || (origin ? 'distance' : 'reviews');
  const sorters = {
    distance: (a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0),
    reviews: (a, b) => b.reviewCount - a.reviewCount || b.avgRating - a.avgRating,
    rating: (a, b) => b.avgRating - a.avgRating || b.reviewCount - a.reviewCount,
  };
  rows.sort(sorters[sort] ?? sorters.reviews);

  const totalElements = rows.length;
  return {
    content: rows.slice(page * size, page * size + size),
    page,
    size,
    totalElements,
    totalPages: Math.ceil(totalElements / size),
    hasNext: (page + 1) * size < totalElements,
  };
}

function route(method, path) {
  const m = (pattern) => {
    const keys = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'))}$`);
    const hit = path.match(re);
    if (!hit) return null;
    return Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(hit[i + 1])]));
  };
  return { is: (meth, pattern) => (meth === method ? m(pattern) : null) };
}

export function createMockServer({ storage = defaultStorage } = {}) {
  let db;
  const load = () => {
    if (db) return db;
    try {
      db = JSON.parse(storage.getItem(DB_KEY)) || freshDb();
    } catch {
      db = freshDb();
    }
    return db;
  };
  const save = () => storage.setItem(DB_KEY, JSON.stringify(db));

  function handle(method, path, { query = {}, body = {}, token } = {}) {
    load();
    const r = route(method.toUpperCase(), path);
    const uid = decodeToken(token);
    const me = uid ? db.users.find((u) => u.userId === uid) : null;
    const auth = () => me ?? fail(401, 'UNAUTHORIZED', '로그인이 필요해요.');
    const publicUser = (u) => ({ userId: u.userId, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt });
    let p;

    // ===== 인증 =====
    if ((p = r.is('GET', '/auth/check-email'))) {
      return { available: !db.users.some((u) => u.email === String(query.email).trim().toLowerCase()) };
    }
    if ((p = r.is('POST', '/auth/signup'))) {
      // 계정 + 첫 반려동물을 하나의 트랜잭션으로 등록 (하나라도 실패하면 아무것도 저장 안 함)
      const email = String(body.email ?? '').trim().toLowerCase();
      const errors = [];
      if (!email) errors.push({ field: 'email', message: '이메일은 필수예요.' });
      if (!body.password) errors.push({ field: 'password', message: '비밀번호는 필수예요.' });
      if (!String(body.name ?? '').trim()) errors.push({ field: 'name', message: '이름은 필수예요.' });
      if (!['USER', 'BUSINESS'].includes(body.role)) errors.push({ field: 'role', message: '회원 유형을 선택해 주세요.' });
      const pets = Array.isArray(body.pets) ? body.pets : [];
      if (pets.length > 5) errors.push({ field: 'pets', message: '반려동물은 최대 5마리까지 등록할 수 있어요.' });
      const petRows = [];
      pets.forEach((pet, i) => {
        try {
          petRows.push(pickPet(pet));
        } catch (e) {
          (e.fieldErrors ?? []).forEach((fe) => errors.push({ field: `pets[${i}].${fe.field}`, message: fe.message }));
        }
      });
      if (errors.length) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', errors);
      if (db.users.some((u) => u.email === email))
        fail(409, 'DUPLICATE_EMAIL', '이미 가입된 이메일이에요.', [{ field: 'email', message: '이미 가입된 이메일이에요.' }]);
      const user = { userId: ++db.seq.user, email, password: body.password, name: body.name.trim(), role: body.role, createdAt: new Date().toISOString() };
      db.users.push(user);
      const created = petRows.map((row) => ({ petId: ++db.seq.pet, userId: user.userId, ...row }));
      db.pets.push(...created);
      save();
      return { accessToken: encodeToken(user.userId), user: publicUser(user), pets: created };
    }
    if ((p = r.is('POST', '/auth/login'))) {
      const user = db.users.find((u) => u.email === String(body.email ?? '').trim().toLowerCase());
      if (!user || user.password !== body.password) fail(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 일치하지 않아요.');
      return { accessToken: encodeToken(user.userId), user: publicUser(user) };
    }
    if ((p = r.is('GET', '/auth/me'))) return publicUser(auth());
    if ((p = r.is('POST', '/auth/password/reset'))) {
      const user = db.users.find((u) => u.email === String(body.email ?? '').trim().toLowerCase() && u.name === String(body.name ?? '').trim());
      if (!user) fail(404, 'USER_NOT_FOUND', '입력하신 정보와 일치하는 회원이 없어요.');
      user.password = 'temp1234!';
      save();
      return { sent: true, email: user.email };
    }

    // ===== 내 정보 (마이페이지) =====
    if ((p = r.is('PUT', '/users/me'))) {
      const user = auth();
      const name = String(body.name ?? '').trim();
      if (name.length < 2 || name.length > 10) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', [{ field: 'name', message: '이름은 2~10자로 입력해 주세요.' }]);
      user.name = name;
      save();
      return publicUser(user);
    }
    if ((p = r.is('GET', '/users/me/summary'))) {
      const user = auth();
      const active = (x) => x.userId === user.userId && ['PENDING', 'CONFIRMED'].includes(x.status);
      return {
        reservationCount: db.hospitalReservations.filter(active).length + db.hotelReservations.filter(active).length,
        orderCount: db.orders.filter((x) => x.userId === user.userId).length,
        reviewCount: db.reviews.filter((x) => x.userId === user.userId).length,
        bookmarkCount: db.bookmarks.filter((x) => x.userId === user.userId).length,
      };
    }
    if ((p = r.is('DELETE', '/users/me'))) {
      const user = auth();
      // 진행 중 예약(승인대기·예약확정) / 배송 전 주문(결제완료·배송준비)이 있으면 409 WITHDRAW_BLOCKED
      const blocking =
        [...db.hospitalReservations, ...db.hotelReservations].some((x) => x.userId === user.userId && ['PENDING', 'CONFIRMED'].includes(x.status)) ||
        db.orders.some((x) => x.userId === user.userId && ['ORDERED', 'PREPARING'].includes(x.status));
      if (body?.simulateBlocked || blocking) fail(409, 'WITHDRAW_BLOCKED', '진행 중인 예약이나 배송 전 주문이 있어 탈퇴할 수 없어요.');
      db.users = db.users.filter((u) => u !== user);
      db.pets = db.pets.filter((x) => x.userId !== user.userId);
      db.bookmarks = db.bookmarks.filter((x) => x.userId !== user.userId);
      db.reviews = db.reviews.filter((x) => x.userId !== user.userId);
      db.cart = db.cart.filter((x) => x.userId !== user.userId);
      db.orders = db.orders.filter((x) => x.userId !== user.userId);
      save();
      return null;
    }

    // ===== 반려동물 =====
    if ((p = r.is('GET', '/pets'))) return db.pets.filter((x) => x.userId === auth().userId);
    if ((p = r.is('POST', '/pets'))) {
      const owner = auth();
      if (db.pets.filter((x) => x.userId === owner.userId).length >= 5) fail(400, 'PET_LIMIT', '반려동물은 최대 5마리까지 등록할 수 있어요.');
      const pet = { petId: ++db.seq.pet, userId: owner.userId, ...pickPet(body) };
      db.pets.push(pet);
      save();
      return pet;
    }
    if ((p = r.is('GET', '/pets/:id'))) return ownPet(db, auth(), p.id);
    if ((p = r.is('PUT', '/pets/:id'))) {
      const pet = ownPet(db, auth(), p.id);
      Object.assign(pet, pickPet(body));
      save();
      return pet;
    }
    if ((p = r.is('DELETE', '/pets/:id'))) {
      const pet = ownPet(db, auth(), p.id);
      db.pets = db.pets.filter((x) => x !== pet);
      save();
      return null;
    }

    // ===== 지하철역 =====
    if ((p = r.is('GET', '/stations'))) {
      if (query.line) {
        // 노선도용: 해당 호선의 역을 순서대로
        return STATIONS.filter((s) => s.line === String(query.line)).sort((a, b) => a.seq - b.seq).map(toStation);
      }
      const kw = String(query.keyword ?? '').trim().replace(/역$/, '');
      if (!kw) return [];
      return groupStations(STATIONS.filter((s) => s.stationName.replace(/역$/, '').includes(kw))).slice(0, 10);
    }
    if ((p = r.is('GET', '/stations/:id'))) {
      const s = stationById.get(Number(p.id)) ?? fail(404, 'STATION_NOT_FOUND', '존재하지 않는 지하철역이에요.');
      return toStation(s);
    }
    if ((p = r.is('GET', '/place-categories'))) return PLACE_CATEGORIES;

    // ===== 장소 =====
    if ((p = r.is('GET', '/places'))) return searchPlaces(db, query, me?.userId);
    if ((p = r.is('GET', '/places/:id'))) {
      const place = PLACES.find((x) => x.placeId === Number(p.id)) ?? fail(404, 'PLACE_NOT_FOUND', '존재하지 않거나 삭제된 장소예요.');
      return {
        ...toPlaceSummary(db, place, { userId: me?.userId }),
        phone: place.phone,
        description: place.description,
        nearbyStations: nearbyStationsOf(place.placeId),
        bookmarkCount: db.bookmarks.filter((b) => b.placeId === place.placeId).length,
      };
    }
    if ((p = r.is('POST', '/places/:id/bookmark'))) {
      const user = auth();
      const placeId = Number(p.id);
      if (!PLACES.some((x) => x.placeId === placeId)) fail(404, 'PLACE_NOT_FOUND', '존재하지 않는 장소예요.');
      if (db.bookmarks.some((b) => b.userId === user.userId && b.placeId === placeId))
        fail(409, 'DUPLICATE_BOOKMARK', '이미 찜한 장소예요.');
      db.bookmarks.push({ bookmarkId: ++db.seq.bookmark, userId: user.userId, placeId, createdAt: new Date().toISOString() });
      save();
      return { placeId, bookmarked: true };
    }
    if ((p = r.is('DELETE', '/places/:id/bookmark'))) {
      const user = auth();
      const placeId = Number(p.id);
      db.bookmarks = db.bookmarks.filter((b) => !(b.userId === user.userId && b.placeId === placeId));
      save();
      return { placeId, bookmarked: false };
    }
    if ((p = r.is('GET', '/users/me/bookmarks'))) {
      const user = auth();
      return db.bookmarks
        .filter((b) => b.userId === user.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((b) => ({ ...toPlaceSummary(db, PLACES.find((x) => x.placeId === b.placeId), { userId: user.userId }), bookmarkedAt: b.createdAt }));
    }

    // ===== 리뷰 (통합 reviews 테이블) =====
    if ((p = r.is('GET', '/reviews'))) {
      const targetType = query.targetType ?? 'PLACE';
      const targetId = Number(query.targetId);
      const all = db.reviews.filter((x) => x.targetType === targetType && x.targetId === targetId);
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      all.forEach((x) => distribution[x.rating]++);
      const sort = query.sort ?? 'latest';
      const sorted = [...all].sort((a, b) =>
        sort === 'rating_desc' ? b.rating - a.rating || b.createdAt.localeCompare(a.createdAt) : b.createdAt.localeCompare(a.createdAt),
      );
      const page = Number(query.page) || 0;
      const size = Number(query.size) || 4;
      return {
        summary: { ...ratingOf(db, targetType, targetId), distribution },
        content: sorted.slice(page * size, page * size + size).map((x) => toReview(db, x, me?.userId)),
        page,
        size,
        totalElements: all.length,
        hasNext: (page + 1) * size < all.length,
      };
    }
    if ((p = r.is('POST', '/reviews'))) {
      const user = auth();
      const { targetType = 'PLACE', targetId, rating, content, petId } = body;
      if (!['PLACE', 'PRODUCT', 'HOSPITAL'].includes(targetType)) fail(400, 'VALIDATION_ERROR', '리뷰 대상은 PLACE, PRODUCT, HOSPITAL 중 하나예요.');
      validateReviewBody(rating, content);
      const tid = Number(targetId);
      if (targetType === 'PLACE' && !PLACES.some((x) => x.placeId === tid)) fail(404, 'PLACE_NOT_FOUND', '존재하지 않는 장소예요.');
      if (targetType === 'PRODUCT' && !db.products.some((x) => x.productId === tid)) fail(404, 'PRODUCT_NOT_FOUND', '리뷰할 대상을 찾을 수 없어요.');
      if (targetType === 'HOSPITAL' && !HOSPITALS.some((x) => x.hospitalId === tid)) fail(404, 'HOSPITAL_NOT_FOUND', '리뷰할 대상을 찾을 수 없어요.');
      const notAllowed = reviewNotAllowedReason(db, user.userId, targetType, tid);
      if (notAllowed) fail(403, 'REVIEW_NOT_ALLOWED', notAllowed);
      if (db.reviews.some((x) => x.userId === user.userId && x.targetType === targetType && x.targetId === tid))
        fail(409, 'DUPLICATE_REVIEW', `${{ PRODUCT: '이 상품', HOSPITAL: '이 병원' }[targetType] ?? '이 장소'}에는 이미 리뷰를 남기셨어요. 기존 리뷰를 수정해 주세요.`);
      if (petId !== undefined && petId !== null) ownPet(db, user, petId);
      const now = new Date().toISOString();
      const review = { reviewId: ++db.seq.review, userId: user.userId, targetType, targetId: tid, petId: petId ? Number(petId) : null, rating: Number(rating), content: content.trim(), createdAt: now, updatedAt: now };
      db.reviews.push(review);
      save();
      return toReview(db, review, user.userId);
    }
    if ((p = r.is('PUT', '/reviews/:id'))) {
      const review = ownReview(db, auth(), p.id);
      validateReviewBody(body.rating, body.content);
      Object.assign(review, { rating: Number(body.rating), content: body.content.trim(), updatedAt: new Date().toISOString() });
      save();
      return toReview(db, review, review.userId);
    }
    if ((p = r.is('DELETE', '/reviews/:id'))) {
      const review = ownReview(db, auth(), p.id);
      db.reviews = db.reviews.filter((x) => x !== review);
      save();
      return null;
    }
    if ((p = r.is('GET', '/users/me/reviews'))) {
      const user = auth();
      return db.reviews
        .filter((x) => x.userId === user.userId && (!query.targetType || x.targetType === query.targetType))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((x) => ({
          ...toReview(db, x, user.userId),
          targetName:
            x.targetType === 'PLACE'
              ? PLACES.find((pl) => pl.placeId === x.targetId)?.name
              : x.targetType === 'PRODUCT'
                ? db.products.find((pr) => pr.productId === x.targetId)?.name
                : HOSPITALS.find((h) => h.hospitalId === x.targetId)?.name ?? null,
        }));
    }

    if ((p = r.is('GET', '/reviews/eligibility'))) {
      const targetType = query.targetType ?? 'PLACE';
      const targetId = Number(query.targetId);
      if (!me) return { targetType, targetId, allowed: false, alreadyReviewed: false, reason: '로그인이 필요해요.' };
      const already = db.reviews.some((x) => x.userId === me.userId && x.targetType === targetType && x.targetId === targetId);
      const reason = already ? '이미 리뷰를 남기셨어요.' : reviewNotAllowedReason(db, me.userId, targetType, targetId);
      return { targetType, targetId, allowed: !reason, alreadyReviewed: already, reason };
    }

    // ===== FE2: 병원 · 호텔 · 상품 · 장바구니 · 주문 (mockCommerce.js) =====
    const commerce = commerceRoutes({ r, db, me, auth, query, body, save, fail, ratingOf, own: ownPet });
    if (commerce !== NO_MATCH) return commerce;

    fail(404, 'NOT_FOUND', `목 서버에 없는 API예요: ${method} ${path}`);
  }

  return {
    handle,
    reset: () => {
      db = freshDb();
      save();
    },
  };
}

function pickPet(body = {}) {
  const name = String(body.name ?? '').trim();
  const breed = String(body.breed ?? '').trim();
  const weight = Number(body.weight);
  const errors = [];
  if (!name) errors.push({ field: 'name', message: '이름은 필수예요.' });
  if (!breed) errors.push({ field: 'breed', message: '품종은 필수예요.' });
  if (!(weight > 0 && weight <= 100)) errors.push({ field: 'weight', message: '체중은 0.1~100kg이어야 해요.' });
  if (!['MALE', 'FEMALE'].includes(body.gender)) errors.push({ field: 'gender', message: '성별을 선택해 주세요.' });
  if (typeof body.neutered !== 'boolean') errors.push({ field: 'neutered', message: '중성화 여부를 선택해 주세요.' });
  if (errors.length) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', errors);
  return { name, breed, weight, gender: body.gender, neutered: body.neutered, photoUrl: body.photoUrl ?? null };
}

function ownPet(db, user, id) {
  const pet = db.pets.find((x) => x.petId === Number(id));
  if (!pet) fail(404, 'PET_NOT_FOUND', '반려동물 정보를 찾을 수 없어요.');
  if (pet.userId !== user.userId) fail(403, 'FORBIDDEN', '내 반려동물만 수정할 수 있어요.');
  return pet;
}

function ownReview(db, user, id) {
  const review = db.reviews.find((x) => x.reviewId === Number(id));
  if (!review) fail(404, 'REVIEW_NOT_FOUND', '리뷰를 찾을 수 없어요.');
  if (review.userId !== user.userId) fail(403, 'FORBIDDEN', '내가 쓴 리뷰만 수정·삭제할 수 있어요.');
  return review;
}

function validateReviewBody(rating, content) {
  const errors = [];
  if (!(Number(rating) >= 1 && Number(rating) <= 5)) errors.push({ field: 'rating', message: '별점은 1~5점이에요.' });
  const len = String(content ?? '').trim().length;
  if (len < 10 || len > 500) errors.push({ field: 'content', message: '리뷰는 10~500자로 작성해 주세요.' });
  if (errors.length) fail(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', errors);
}

function toReview(db, r, myId) {
  const author = db.users.find((u) => u.userId === r.userId);
  // 함께한 반려동물 (리뷰의 petId, 없으면 작성자의 대표 반려동물)
  const pet = (r.petId && db.pets.find((x) => x.petId === r.petId)) || db.pets.find((x) => x.userId === r.userId);
  return {
    reviewId: r.reviewId,
    userId: r.userId,
    userName: author?.name ?? '탈퇴한 회원',
    petName: pet?.name ?? null,
    petBreed: pet?.breed ?? null,
    petWeight: pet?.weight ?? null,
    visitDate: r.targetType === 'HOSPITAL' ? visitDateOf(db, r.userId, r.targetId) : null,
    targetType: r.targetType,
    targetId: r.targetId,
    rating: r.rating,
    content: r.content,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    mine: r.userId === myId,
  };
}
