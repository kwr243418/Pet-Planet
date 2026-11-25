# 08. SQL 쿼리집 (발표용)

> ⚠️ **2026-11-25 지하철 → 버스 · 지역별 탐색으로 바뀌었어요.** 이 문서의 지하철역 · 호선 · `stations` · `place_stations` 내용은 [09_BUS_TRANSIT](09_BUS_TRANSIT.md)이 대신해요.

백엔드는 JPA 없이 **JdbcTemplate 으로 SQL 을 직접** 써요. 아래 쿼리는 모두 실제 코드(`backend/src/main/java/com/petplanet/...`)에 들어 있는 그대로예요.
`:이름` 은 NamedParameterJdbcTemplate 의 바인딩 변수 (PreparedStatement `?` 와 같아요 → SQL 인젝션 방지).

| # | 기능 | 기법 | 파일 |
|---|---|---|---|
| 1 | 내 위치 반경 · 지역별 장소 검색 + 다중 필터 + 가까운 정류장 | 공간 함수, 동적 WHERE, 파생 테이블 조인, EXISTS, LEFT JOIN, 상관 서브쿼리, 페이지 | `place/PlaceService.java`, `transit/BusAccess.java` |
| 2 | 근처 버스 정류장 | 위·경도 범위로 먼저 좁히기(인덱스) + 정확한 거리, 파생 테이블 | `transit/BusService.java` |
| 3 | 지역 목록 (시도 → 시군구, 개수) | GROUP BY 집계 | `transit/RegionController.java` |
| 4 | 통합 리뷰 목록 · 별점 분포 | 집계, CASE, 상관 서브쿼리, COALESCE 조인 | `review/ReviewService.java` |
| 5 | 리뷰 작성 자격 | 조인 + 상태 조건 | `review/ReviewService.java` |
| 6 | 회원가입 (계정 + 반려동물) | **트랜잭션** | `user/UserService.java` |
| 7 | 진료 예약 (한 칸 1건) | **트랜잭션 + 잠금 읽기 (FOR UPDATE)** | `hospital/HospitalService.java` |
| 8 | 호텔 객실 상태 · 예약 (기간 겹침) | 구간 겹침 조건, **트랜잭션 + 잠금** | `hotel/HotelService.java` |
| 9 | 장바구니 수량 합치기 | `INSERT … ON DUPLICATE KEY UPDATE` | `shop/CartService.java` |
| 10 | 주문 = 가상 결제 | **트랜잭션: 재고 잠금 → 주문 → 차감 → 장바구니 비우기, 실패 시 전체 롤백** | `shop/OrderService.java` |
| 11 | 주문 취소 (재고 되돌리기) | 다중 테이블 UPDATE … JOIN | `shop/OrderService.java` |
| 12 | 마이페이지 활동 요약 · 탈퇴 가능 여부 | 스칼라 서브쿼리 합산 | `user/UserService.java` |
| 13 | 공공데이터 적재 | UPSERT (자연키 UNIQUE), 배치 INSERT, 트랜잭션 | `db/loader/PublicDataLoader.java` |

---

## 1. 내 위치 반경 · 지역별 장소 검색 + 다중 필터 (S02)

```sql
SELECT p.place_id, p.name, p.category_id, c.name AS category_name, p.address, p.latitude, p.longitude,
       p.allowed_size, p.indoor_outdoor, p.image_url,
       COALESCE(r.avg_rating, 0) AS avg_rating, COALESCE(r.review_count, 0) AS review_count,
       EXISTS (SELECT 1 FROM place_bookmarks b WHERE b.place_id = p.place_id AND b.user_id = :uid) AS bookmarked,
       p.sido, p.sigungu, p.nearest_stop_id, p.nearest_stop_m, p.stops_500m, bs.name AS stop_name,
       (SELECT COUNT(DISTINCT brs.route_id) FROM bus_route_stops brs WHERE brs.stop_id = p.nearest_stop_id) AS stop_route_count,
       ST_Distance_Sphere(POINT(p.longitude, p.latitude), POINT(:slng, :slat)) / 1000 AS distance_km
FROM places p
LEFT JOIN place_categories c ON c.category_id = p.category_id
LEFT JOIN (SELECT target_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
           FROM reviews WHERE target_type = 'PLACE' GROUP BY target_id) r ON r.target_id = p.place_id
LEFT JOIN bus_stops bs ON bs.stop_id = p.nearest_stop_id                                    -- 가장 가까운 버스 정류장
WHERE ST_Distance_Sphere(POINT(p.longitude, p.latitude), POINT(:slng, :slat)) <= :radiusM   -- 내 근처: 1 · 3 · 5km
  -- 또는 지역별: p.sido = :sido AND p.sigungu = :sigungu
  AND p.nearest_stop_m <= 300                         -- 정류장 300m 안 (선택)
  AND p.category_id IN (:categoryIds)                 -- 카테고리 OR
  AND p.allowed_size IN ('MEDIUM', 'LARGE')           -- 고른 크기를 "모두" 데려갈 수 있는 곳
  AND p.indoor_outdoor IN ('INDOOR', 'BOTH')          -- 실내
ORDER BY distance_km, p.place_id
LIMIT :limit OFFSET :offset;
```
- 조건은 사용자가 고른 것만 붙여요 (동적 WHERE). 같은 WHERE 로 `SELECT COUNT(*)` 를 한 번 더 해서 `totalElements` 를 만들어요.
- 리뷰 평균은 **파생 테이블**로 장소별로 한 번만 집계한 뒤 LEFT JOIN (리뷰가 없으면 0).
- 크기 필터: 소형+중형을 고르면 "둘 다 데려갈 수 있는 곳" = 최대 크기가 중형 이상 → `IN ('MEDIUM','LARGE')`.
- 가장 가까운 정류장(`nearest_stop_id` · `nearest_stop_m` · `stops_500m`)은 적재기가 미리 계산해 둔 값이라, 정류장 20만 곳과 매번 거리를 재지 않아요. `sort=transit` 은 `ORDER BY p.nearest_stop_m IS NULL, p.nearest_stop_m`.

## 2. 근처 버스 정류장 (장소 상세 "버스로 가기")

```sql
SELECT * FROM (
    SELECT s.stop_id, s.name, s.latitude, s.longitude, s.city_code, s.city_name,
           ROUND(ST_Distance_Sphere(POINT(s.longitude, s.latitude), POINT(:lng, :lat))) AS dist_m,
           (SELECT COUNT(DISTINCT brs.route_id) FROM bus_route_stops brs WHERE brs.stop_id = s.stop_id) AS route_count
    FROM bus_stops s
    WHERE s.latitude BETWEEN :lat - :dLat AND :lat + :dLat            -- 1) 위·경도 범위로 먼저 좁히고 (idx_bus_stops_coordinates)
      AND s.longitude BETWEEN :lng - :dLng AND :lng + :dLng
) t
WHERE t.dist_m <= :r                                                  -- 2) 남은 몇 곳만 정확한 구면 거리
ORDER BY t.dist_m, t.stop_id
LIMIT :limit;
```
- `dLat = r / 111,320m`, `dLng = r / (111,320m × cos 위도)` — 반경 r 을 감싸는 사각형.
- 정류장 ↔ 노선은 N:M(`bus_route_stops`)이라 노선 수는 상관 서브쿼리로 세요.

## 3. 지역 목록 (지역별 탐색의 시도 → 시군구)

```sql
SELECT sido, sigungu, COUNT(*) AS cnt
FROM places                 -- type 에 따라 hospitals · pet_hotels
WHERE sido IS NOT NULL
GROUP BY sido, sigungu;
```
- 시도 순서(서울 → … → 제주)와 시군구 가나다순 정렬은 자바에서 해요. 데이터가 있는 지역만 나와요.

## 4. 통합 리뷰 — 한 테이블에 장소·상품·병원

```sql
-- 별점 분포 (1~5점 개수) → 평균·개수도 여기서 계산
SELECT rating, COUNT(*) AS cnt FROM reviews
WHERE target_type = :t AND target_id = :id GROUP BY rating;

-- 목록: 작성자 + 함께한 반려동물(없으면 대표 반려동물) + 병원 방문일 + 대상 이름
SELECT r.review_id, u.name AS user_name, r.rating, r.content, r.created_at,
       pt.name AS pet_name, pt.breed AS pet_breed, pt.weight AS pet_weight,
       CASE WHEN r.target_type = 'HOSPITAL' THEN
            (SELECT DATE(MAX(hr.reservation_date)) FROM hospital_reservations hr
              WHERE hr.user_id = r.user_id AND hr.hospital_id = r.target_id AND hr.status = 'COMPLETED')
       END AS visit_date,
       CASE r.target_type
            WHEN 'PLACE'    THEN (SELECT name FROM places    WHERE place_id    = r.target_id)
            WHEN 'PRODUCT'  THEN (SELECT name FROM products  WHERE product_id  = r.target_id)
            WHEN 'HOSPITAL' THEN (SELECT name FROM hospitals WHERE hospital_id = r.target_id)
       END AS target_name
FROM reviews r
JOIN users u ON u.user_id = r.user_id
LEFT JOIN pets pt ON pt.pet_id = COALESCE(r.pet_id, (SELECT MIN(p2.pet_id) FROM pets p2 WHERE p2.user_id = r.user_id))
WHERE r.target_type = :t AND r.target_id = :id
ORDER BY r.created_at DESC
LIMIT :limit OFFSET :offset;
```
- `target_id` 는 대상 종류마다 다른 테이블을 가리켜서 **FK 를 걸 수 없어요** → 존재 확인은 서비스에서 (`ensureTarget`), 대상이 지워지면 리뷰도 직접 정리.
- 1인 1리뷰는 `UNIQUE(user_id, target_type, target_id)` → 위반 시 `409 DUPLICATE_REVIEW`.

## 5. 리뷰 작성 자격 (docs/05 §6)

```sql
-- 병원: 그 병원 예약이 이용완료
SELECT COUNT(*) FROM hospital_reservations
WHERE user_id = :me AND hospital_id = :id AND status = 'COMPLETED';

-- 상품: 그 상품이 든 주문이 배송완료
SELECT COUNT(*) FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.user_id = :me AND oi.product_id = :id AND o.status = 'DELIVERED';
```
없으면 `403 REVIEW_NOT_ALLOWED`. 화면은 `GET /api/reviews/eligibility` 로 [리뷰 쓰기] 버튼을 보여줄지 정해요.

## 6. 회원가입 = 계정 + 반려동물 한 트랜잭션 (S09)

```java
@Transactional
public SignupResponse signup(SignupRequest req) {
    // 1) 계정·반려동물을 전부 먼저 검증 → 하나라도 틀리면 400 (아무것도 안 넣음)
    // 2) INSERT INTO users ...          (BCrypt 로 비밀번호 암호화)
    // 3) INSERT INTO pets ... × N       (중간에 오류가 나면 users INSERT 까지 롤백)
}
```

## 7. 진료 예약 — 동시에 눌러도 한 칸에 1건 (S04)

```sql
-- @Transactional 안에서
SELECT lunch_time FROM hospitals WHERE hospital_id = :id FOR UPDATE;   -- ① 병원 행 잠금: 같은 병원 신청을 한 줄로 세움

SELECT COUNT(*) FROM hospital_reservations                              -- ② 잠금 읽기: 앞 사람이 방금 커밋한 예약까지 보임
WHERE hospital_id = :hid AND reservation_date = :at AND status IN ('PENDING', 'CONFIRMED')
FOR UPDATE;                                                             --    1건 이상이면 409 TIME_SLOT_TAKEN

INSERT INTO hospital_reservations (user_id, hospital_id, pet_id, reservation_date, status)
VALUES (:me, :hid, :pid, :at, 'PENDING');                               -- ③ 커밋하면 잠금 해제
```
**왜 ② 에도 FOR UPDATE?** InnoDB 기본 격리 수준(REPEATABLE READ)에서 보통 SELECT 는 트랜잭션 처음의 스냅샷을 읽어요.
잠금을 기다리는 동안 다른 사람이 같은 칸을 커밋해도 스냅샷에는 안 보여서 중복 예약이 생길 수 있어요.
잠금 읽기(`FOR UPDATE`)는 항상 **최신 커밋 값**을 읽기 때문에 이 문제가 없어요. (인덱스 `idx_hospital_time(hospital_id, reservation_date)` — 합의 [12])

```sql
-- 그날 마감된 시간 (S04 줄 그은 시간)
SELECT TIME_FORMAT(reservation_date, '%H:%i') AS taken
FROM hospital_reservations
WHERE hospital_id = :id AND DATE(reservation_date) = :date AND status IN ('PENDING', 'CONFIRMED');
```

## 8. 호텔 — 체중 검증 + 기간 겹침 (S05)

```sql
-- 두 기간이 겹치는 조건: 기존 체크인 < 새 체크아웃 AND 기존 체크아웃 > 새 체크인
SELECT DISTINCT hr.room_id
FROM hotel_reservations hr
JOIN room_types rt ON rt.room_id = hr.room_id
WHERE rt.hotel_id = :hid AND hr.status IN ('PENDING', 'CONFIRMED')     -- 합의 [13]: 승인대기도 막음
  AND hr.check_in_date < :out AND hr.check_out_date > :in;
```
- 객실 상태: `pets.weight > room_types.max_weight` → **OVERWEIGHT**, 겹치는 예약 → **BOOKED**, 나머지 **AVAILABLE** (+ 1박 요금 × 박수).
- 예약할 때는 진료 예약과 같은 방식으로 `room_types` 행을 `FOR UPDATE` 로 잠그고, 겹침 검사도 잠금 읽기로 한 번 더 해요.

## 9. 장바구니 — 같은 상품은 수량 합치기 (S06)

```sql
INSERT INTO cart_items (user_id, product_id, quantity) VALUES (:me, :pid, :q)
ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity);   -- UNIQUE(user_id, product_id) — 합의 [9]
```

## 10. 주문 = 가상 결제 트랜잭션 (S07, BE2 핵심)

```sql
-- @Transactional 하나 안에서
-- ① 장바구니 상품의 재고를 잠그고 읽기 (product_id 순서로 잠가서 교착 상태 방지)
SELECT p.product_id, p.name, p.price, p.stock_quantity, ci.quantity
FROM cart_items ci JOIN products p ON p.product_id = ci.product_id
WHERE ci.user_id = :me
ORDER BY p.product_id
FOR UPDATE;
-- ② 하나라도 quantity > stock_quantity → 예외 → 전체 롤백 (409 OUT_OF_STOCK, 장바구니 그대로)

-- ③ 주문 헤더
INSERT INTO orders (user_id, total_amount, receiver_name, receiver_phone, address, shipping_fee, status)
VALUES (:me, :total, :name, :phone, :address, 3000, 'ORDERED');
-- ④ 주문 상품 (구매 당시 가격을 저장 → 나중에 상품 가격이 바뀌어도 주문 금액은 그대로)
INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (:oid, :pid, :q, :price);
-- ⑤ 재고 차감 (조건부 UPDATE 로 한 번 더 안전장치 — 바뀐 행이 1이 아니면 롤백)
UPDATE products SET stock_quantity = stock_quantity - :q WHERE product_id = :pid AND stock_quantity >= :q;
-- ⑥ 장바구니 비우기
DELETE FROM cart_items WHERE user_id = :me;
```

**시연 (재고 부족 → 전체 롤백)**: 재고 2개인 "소형견 저알러지 사료"를 두 계정이 각각 2개씩 담고,
한 계정이 먼저 결제 → 다른 계정이 결제하면 409 + 주문·재고·장바구니가 하나도 안 바뀐 것을 보여줘요.

## 11. 주문 취소 — 재고 되돌리기 (S08)

```sql
SELECT user_id, status FROM orders WHERE order_id = :id FOR UPDATE;     -- ORDERED·PREPARING 만 (아니면 409 ORDER_NOT_CANCELLABLE)
UPDATE products p
JOIN order_items oi ON oi.product_id = p.product_id
SET p.stock_quantity = p.stock_quantity + oi.quantity                     -- 다중 테이블 UPDATE
WHERE oi.order_id = :id;
UPDATE orders SET status = 'CANCELLED' WHERE order_id = :id;
```

## 12. 마이페이지 활동 요약 · 탈퇴 가능 여부 (S08)

```sql
SELECT
  (SELECT COUNT(*) FROM hospital_reservations WHERE user_id = :me AND status IN ('PENDING','CONFIRMED'))
+ (SELECT COUNT(*) FROM hotel_reservations    WHERE user_id = :me AND status IN ('PENDING','CONFIRMED')) AS reservation_count,
  (SELECT COUNT(*) FROM orders          WHERE user_id = :me) AS order_count,
  (SELECT COUNT(*) FROM reviews         WHERE user_id = :me) AS review_count,
  (SELECT COUNT(*) FROM place_bookmarks WHERE user_id = :me) AS bookmark_count;
```
탈퇴: 진행 중 예약 + 배송 전 주문(`ORDERED`·`PREPARING`) 합이 0일 때만 `DELETE FROM users` → FK 에 따라
pets·찜·리뷰·장바구니·주문은 **CASCADE**, 예약의 user_id 는 **SET NULL** (병원 쪽 기록은 남김).

## 13. 공공데이터 적재 (db/loader)

```sql
INSERT INTO hospitals (license_no, name, address, phone, latitude, longitude, operating_hours)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE name = VALUES(name), address = VALUES(address),
    phone = COALESCE(VALUES(phone), phone), latitude = VALUES(latitude), longitude = VALUES(longitude),
    operating_hours = COALESCE(VALUES(operating_hours), operating_hours);
```
- 자연키 `license_no`(인허가 관리번호, UNIQUE) 로 UPSERT → 여러 번 적재해도 중복 없음. PK 는 대리키 `hospital_id` 유지 (합의 [14]).
- 500건씩 배치, 테이블마다 한 트랜잭션 (중간에 실패하면 전부 롤백).
- 좌표는 EPSG:5174(Bessel 중부원점 TM) → WGS84 로 직접 변환 (TM 역변환 + 7-파라미터 변환).

---

## 인덱스가 쓰이는 곳

| 인덱스 | 쓰는 쿼리 |
|---|---|
| `places.idx_places_region (sido, sigungu)` (병원 · 호텔도) | 1 지역별 검색, 3 지역 목록 |
| `places.idx_places_stop_m (nearest_stop_m)` | 1 정류장 300m · 정류장 가까운 순 |
| `bus_stops.idx_bus_stops_coordinates (latitude, longitude)` | 2 근처 정류장 (범위 검색) |
| `bus_route_stops.idx_bus_route_stops_stop (stop_id)` | 1 · 2 정류장을 지나는 노선 수 |
| `place_bookmarks.uk_user_place (user_id, place_id)` | 1 찜 여부(EXISTS), 찜 중복 409 |
| `reviews.idx_target (target_type, target_id)`, `uk_review_once` | 4 리뷰 목록·집계, 1인 1리뷰 |
| `hospital_reservations.idx_hospital_time (hospital_id, reservation_date)` | 7 마감 시간, 예약 중복 검사 |
| `hotel_reservations.idx_room_period (room_id, check_in_date, check_out_date)` | 8 기간 겹침 |
| `cart_items.uk_cart_user_product (user_id, product_id)` | 9 수량 합치기 |
| `hospitals.uk_hospitals_license_no`, `pet_hotels.uk_pet_hotels_license_no` | 13 적재 UPSERT |

발표 때 `EXPLAIN SELECT …` 로 위 인덱스를 타는지 보여주면 좋아요.
