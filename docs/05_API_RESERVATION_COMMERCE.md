# 05. API 명세 — 예약 · 커머스 (FE2 ↔ BE2) · 초안

> ⚠️ **초안**이에요. 팀장 목업 필수 요소(S04-0·S04·S05·S06·S07·S08)와 현재 DB(`db/schema_full.sql`)를 기준으로 FE1이 뼈대를 잡았어요.
> FE2·BE2가 확정하면서 자유롭게 고쳐 주세요. 공통 규칙은 [03_API_CONVENTIONS](03_API_CONVENTIONS.md).
> FE 쪽 함수 자리는 이미 있어요: `frontend/src/api/index.js` → `hospitalApi`, `hotelApi`, `shopApi`, `cartApi`, `orderApi`
> 🆕 = DB 변경 필요 → [06_DB_DECISIONS](06_DB_DECISIONS.md)

## 1. 동물병원 (hospitals, hospital_reservations) — S04-0 · S04

| Method | Path | Auth | 설명 |
|---|---|---|---|
| GET | `/hospitals?stationId=&keyword=&page=&size=` | - | 제휴 병원 목록 (역 기준이면 거리순) |
| GET | `/hospitals/{hospitalId}` | - | 병원 상세 (S04-0 헤더·소개 탭) |
| GET | `/hospitals/{hospitalId}/available-times?date=2026-11-20` | - | 그날 시간 버튼 목록 + 마감 여부 |
| POST | `/hospital-reservations` | ✅ | 진료 예약 신청 → `PENDING` |
| GET | `/users/me/hospital-reservations` | ✅ | 내 병원 예약 (S08) |
| PATCH | `/hospital-reservations/{id}/cancel` | ✅ | 취소 (`PENDING`·`CONFIRMED`만) |
| PATCH | `/hospital-reservations/{id}/status` | BUSINESS | 병원이 승인/완료 처리 `{ "status": "CONFIRMED" }` (시연용) |

```jsonc
// GET /hospitals/1
{
  "hospitalId": 1, "name": "동물메디컬센터", "address": "서울 마포구 ○○로 00", "phone": "02-000-0000",
  "lat": 37.556, "lng": 126.923,
  "operatingHours": "평일 09:00-19:00 / 토 10:00-15:00 / 일 휴진",
  "intro": "…", "departments": ["내과", "외과", "피부과"], "lunchTime": "13:00-14:00",   // 🆕 소개 탭
  "avgRating": 4.8, "reviewCount": 15,
  "nearestStation": { "stationId": 10, "stationName": "홍대입구", "lines": ["2호선"], "distanceKm": 0.4 }
}
// GET /hospitals/1/available-times?date=2026-11-20
{ "date": "2026-11-20", "slots": [ { "time": "14:00", "available": true }, { "time": "14:30", "available": false } ] }
// POST /hospital-reservations
{ "hospitalId": 1, "petId": 3, "reservationDate": "2026-11-20T14:00:00+09:00" }
// → 201
{ "reservationId": 7, "status": "PENDING", "hospitalName": "동물메디컬센터", "petName": "콩이", "reservationDate": "…" }
```

**규칙**
- 지난 날짜·시간은 예약 불가 (`400 VALIDATION_ERROR`)
- 같은 병원·같은 일시에 `PENDING`/`CONFIRMED` 예약이 있으면 마감 → `409 TIME_SLOT_TAKEN` (시간당 정원 1명, 30분 단위 — 합의 [12])
- 내 반려동물만 선택 가능 (`403 FORBIDDEN`)

```sql
-- 마감된 시간 (그날)
SELECT TIME_FORMAT(reservation_date, '%H:%i') AS taken
FROM hospital_reservations
WHERE hospital_id = ? AND DATE(reservation_date) = ? AND status IN ('PENDING', 'CONFIRMED');
```

## 2. 펫 호텔 (pet_hotels, room_types, hotel_reservations) — S05

| Method | Path | Auth | 설명 |
|---|---|---|---|
| GET | `/pet-hotels?stationId=&page=&size=` | - | 호텔 목록 |
| GET | `/pet-hotels/{hotelId}` | - | 호텔 정보 |
| GET | `/pet-hotels/{hotelId}/rooms?petId=&checkIn=&checkOut=` | ✅ | 객실 목록 + **상태 3종** |
| POST | `/hotel-reservations` | ✅ | 객실 예약 신청 → `PENDING` |
| GET | `/users/me/hotel-reservations` | ✅ | 내 호텔 예약 (S08) |
| PATCH | `/hotel-reservations/{id}/cancel` | ✅ | 취소 |

```jsonc
// GET /pet-hotels/1/rooms?petId=2&checkIn=2026-11-20&checkOut=2026-11-22
{
  "nights": 2,
  "pet": { "petId": 2, "name": "보리", "weight": 18 },
  "rooms": [
    { "roomId": 1, "roomName": "미디엄 룸", "pricePerNight": 45000, "maxWeight": 15, "status": "OVERWEIGHT" },
    { "roomId": 2, "roomName": "라지 룸",   "pricePerNight": 60000, "maxWeight": 30, "status": "AVAILABLE", "totalPrice": 120000 },
    { "roomId": 3, "roomName": "스위트 룸", "pricePerNight": 90000, "maxWeight": 40, "status": "BOOKED" }
  ]
}
// POST /hotel-reservations
{ "roomId": 2, "petId": 2, "checkInDate": "2026-11-20", "checkOutDate": "2026-11-22" }
```

**규칙 (서버에서 다시 검사)**
- `pets.weight > room_types.max_weight` → `409 ROOM_OVERWEIGHT`
- 같은 객실에 기간이 겹치는 예약 → `409 ROOM_ALREADY_BOOKED` (어떤 상태를 막을지 합의 [13], 목업 문구는 "확정 예약 있음")
- 체크아웃 > 체크인, 지난 날짜 불가

```sql
-- 기간 겹침 검사: 기존 체크인 < 새 체크아웃 AND 기존 체크아웃 > 새 체크인
SELECT COUNT(*) FROM hotel_reservations
WHERE room_id = ? AND status IN ('CONFIRMED')          -- 합의에 따라 'PENDING' 포함
  AND check_in_date < ? AND check_out_date > ?;
```

## 3. 상품 (product_categories, products) — S06

| Method | Path | 설명 |
|---|---|---|
| GET | `/product-categories` | `[{ "categoryId": 1, "name": "사료" }, …]` — 화면: 전체·사료·간식·위생용품·용품 |
| GET | `/products?categoryId=&keyword=&page=&size=` | 상품 목록 (이름 검색) |
| GET | `/products/{productId}` | 상품 상세 |

```jsonc
{ "productId": 1, "categoryId": 1, "categoryName": "사료", "name": "그레인프리 연어 사료 2kg",
  "price": 32000, "stockQuantity": 3, "soldOut": false, "imageUrl": null,   // 🆕 imageUrl
  "avgRating": 4.5, "reviewCount": 8 }
```
- 화면: `stockQuantity` 가 적으면(예: 5개 이하) "재고 ○개 남음", 0이면 품절·담기 비활성

## 4. 장바구니 (cart_items) — S06 · S07

| Method | Path | Auth | 설명 |
|---|---|---|---|
| GET | `/cart` | ✅ | 내 장바구니 + 합계 |
| POST | `/cart/items` | ✅ | 담기 `{ productId, quantity }` — **같은 상품이면 수량 합침** |
| PATCH | `/cart/items/{cartId}` | ✅ | 수량 변경 `{ quantity }` (1 이상, 재고 이하) |
| DELETE | `/cart/items/{cartId}` | ✅ | 빼기 |

```jsonc
// GET /cart
{
  "items": [
    { "cartId": 5, "productId": 7, "name": "지하철용 소프트 이동장", "categoryName": "용품",
      "price": 49000, "quantity": 1, "lineTotal": 49000, "stockQuantity": 12, "imageUrl": null }
  ],
  "itemCount": 2, "productAmount": 86000, "shippingFee": 3000, "totalAmount": 89000
}
```
```sql
-- 같은 상품 수량 합치기 (🆕 UNIQUE(user_id, product_id) 필요)
INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity);
```

## 5. 주문 (orders, order_items) — S07 · S08

| Method | Path | Auth | 설명 |
|---|---|---|---|
| POST | `/orders` | ✅ | **가상 결제 = 주문 생성** (장바구니 전체) |
| GET | `/users/me/orders` | ✅ | 내 주문 목록 (S08) |
| GET | `/orders/{orderId}` | ✅ | 주문 상세 |
| PATCH | `/orders/{orderId}/cancel` | ✅ | 주문 취소 — `SHIPPING` 전까지만 (`409 ORDER_NOT_CANCELLABLE`) |
| PATCH | `/orders/{orderId}/status` | ADMIN | 배송 단계 진행 (시연용) |

```jsonc
// POST /orders  🆕 배송 정보 칼럼
{ "receiverName": "박민서", "receiverPhone": "010-0000-0000", "address": "서울 마포구 …" }
// → 201
{ "orderId": 12, "status": "ORDERED", "totalAmount": 89000, "shippingFee": 3000,
  "items": [{ "productId": 7, "name": "지하철용 소프트 이동장", "quantity": 1, "price": 49000 }],
  "createdAt": "…" }
// GET /users/me/orders 아이템 (S08: 주문번호·날짜·대표 상품 외 ○건·금액·배송 단계)
{ "orderId": 12, "createdAt": "…", "firstItemName": "지하철용 소프트 이동장", "itemCount": 2, "totalAmount": 89000, "status": "SHIPPING" }
```

**주문 트랜잭션 (BE2 핵심)** — 하나의 트랜잭션에서:
1. 장바구니 상품 재고를 `SELECT … FOR UPDATE` 로 잠그고 확인
2. 하나라도 재고 부족 → **전체 롤백**, `409 OUT_OF_STOCK` (장바구니는 그대로 유지)
3. `orders` INSERT → `order_items` INSERT (구매 당시 가격 저장)
4. `products.stock_quantity` 차감
5. `cart_items` 비우기
6. 주문 취소 시 재고 되돌리기

상태: `ORDERED`(결제완료) → `PREPARING`(배송준비) → `SHIPPING`(배송중) → `DELIVERED`(배송완료) / `CANCELLED` 🆕

## 6. 리뷰 (reviews — 공통, docs/04 §6 와 같은 API)

- 상품 리뷰: `targetType=PRODUCT`, 병원 리뷰: `targetType=HOSPITAL` 🆕
- **작성 자격**: 병원 = 해당 병원 예약이 `COMPLETED`, 상품 = 해당 상품 주문이 `DELIVERED` → 아니면 `403 REVIEW_NOT_ALLOWED`
- S04-0 리뷰 카드의 "반려동물 품종·체중": 리뷰에 `petId` 🆕 를 받거나 예약의 `pet_id` 로 조인
- 응답의 `distribution`(별점 분포)·`sort=rating_desc` 는 이미 공통 리뷰 API에 있어요

## 7. 마이페이지 (S08) 에서 쓰는 것

| 칸 | API |
|---|---|
| 활동 요약 예약·주문 수 | `GET /users/me/summary` (BE1 API, BE2 테이블 집계 — docs/04 §1) |
| 예약 현황 | `GET /users/me/hospital-reservations` + `GET /users/me/hotel-reservations` → 상태 칩, [취소] / [입실 안내] |
| 주문 내역 | `GET /users/me/orders` → 배송 단계 노선, [주문 상세] / [주문 취소] |
| 탈퇴 가능 여부 | `DELETE /users/me` 가 진행 중 예약(`PENDING`·`CONFIRMED`)·배송 전 주문(`ORDERED`·`PREPARING`)이 있으면 `409 WITHDRAW_BLOCKED` |
