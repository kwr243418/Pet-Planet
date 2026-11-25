# 04. API 명세 — 회원 · 장소 (FE1 ↔ BE1)

> 공통 응답·에러·인증·enum 규칙은 [03_API_CONVENTIONS](03_API_CONVENTIONS.md)을 따라요.
> FE 목 서버(`frontend/src/mocks/mockServer.js`)가 이 명세대로 동작해서, BE API와 다른 점은 이 문서와 `frontend/src/api/index.js` 만 맞추면 돼요.
> 🆕 표시는 현재 DB(`db/schema_full.sql`)에 없는 것 → [06_DB_DECISIONS](06_DB_DECISIONS.md) 결정 필요.
> ⚠️ **2026-11-25 지하철 → 버스 전환**: §3 지하철역 API 와 `stationId` · `lines` · `nearestStation` · `nearbyStations` 는 없어졌어요. 지역 · 버스 API 는 [09_BUS_TRANSIT](09_BUS_TRANSIT.md).

## DB 칼럼 ↔ JSON 필드

응답 JSON 은 기본적으로 칼럼 이름의 camelCase 예요. 아래만 이름이 달라요.

| 테이블.칼럼 | JSON 필드 | 이유 |
|---|---|---|
| `places.latitude` / `longitude` (병원 · 호텔 · 정류장도) | `lat` / `lng` | 지도 코드에서 짧게 |
| `places.allowed_size` | `maxSize` | 값은 `SMALL`/`MEDIUM`/`LARGE` (동반 가능 최대 크기) |
| `places.indoor_outdoor` | `indoorType` | 값은 `INDOOR`/`OUTDOOR`/`BOTH` |
| `pets.is_neutered` | `neutered` | boolean |
| (계산값) 내 위치에서 거리 | `distanceKm` | 숫자 (km) |
| `nearest_stop_id` · `nearest_stop_m` · `stops_500m` + `bus_stops.name` | `busAccess` | 가장 가까운 버스 정류장 · 등급 ([09](09_BUS_TRANSIT.md) §4) |

## 1. 인증 · 회원 (users)

| Method | Path | Auth | 설명 |
|---|---|---|---|
| GET | `/auth/check-email?email=` | - | 이메일 중복 확인 → `{ "available": true }` |
| POST | `/auth/signup` | - | 🆕 계정 + 반려동물 동시 등록 (아래) |
| POST | `/auth/login` | - | 로그인 |
| GET | `/auth/me` | ✅ | 내 정보 (새로고침 시 로그인 복원) |
| POST | `/auth/password/reset` | - | 이메일+이름 일치 시 임시 비밀번호 메일 → `{ "sent": true, "email": "..." }` |
| PUT | `/users/me` | ✅ | 🆕 회원정보 수정 `{ "name": "..." }` → user |
| GET | `/users/me/summary` | ✅ | 🆕 S08 활동 요약 타일 (아래) |
| DELETE | `/users/me` | ✅ | 🆕 회원 탈퇴 → 204 / 409 WITHDRAW_BLOCKED |

### POST /auth/signup (S09 — 하나의 트랜잭션)

```jsonc
// 요청
{
  "email": "petplanet@email.com",
  "password": "petplanet123!",
  "name": "박민서",
  "role": "USER",                    // USER(일반) | BUSINESS(사업자). ADMIN 은 가입 시 선택 불가 → 400
  "pets": [                          // 1~5마리, 필수: 이름·품종·체중·성별·중성화
    { "name": "보리", "breed": "진돗개", "weight": 18, "gender": "MALE", "neutered": true, "photoUrl": null }
  ]
}
// 응답 (로그인 응답 + 생성된 pets)
{
  "accessToken": "eyJhbGciOi...",
  "user": { "userId": 1, "email": "petplanet@email.com", "name": "박민서", "role": "USER", "createdAt": "..." },
  "pets": [{ "petId": 1, "userId": 1, "name": "보리", ... }]
}
```
- users INSERT와 pets INSERT를 **한 트랜잭션**으로. 반려동물 하나라도 검증 실패하면 계정도 만들지 않음(롤백).
- 비밀번호는 단방향 암호화(BCrypt 등). 규칙: 영문+숫자+특수문자 8~20자. 이름 2~10자(한글/영문).

### GET /users/me/summary (S08 활동 요약)
```json
{ "reservationCount": 2, "orderCount": 1, "reviewCount": 2, "bookmarkCount": 3 }
```
- `reservationCount` = hospital_reservations + hotel_reservations (진행 중), `orderCount` = orders — **BE2 테이블 집계**.

## 2. 반려동물 (pets)

| Method | Path | Auth | 설명 |
|---|---|---|---|
| GET | `/pets` | ✅ | 내 반려동물 목록 (첫 번째 = 대표) |
| GET | `/pets/{petId}` | ✅ | 단건 |
| POST | `/pets` | ✅ | 추가 등록 (최대 5마리) |
| PUT | `/pets/{petId}` | ✅ | 수정 |
| DELETE | `/pets/{petId}` | ✅ | 삭제 → 204 |

```json
{ "petId": 1, "userId": 1, "name": "보리", "breed": "진돗개", "weight": 18, "gender": "MALE", "neutered": true, "photoUrl": null }
```
- `gender`: `MALE`(수컷) | `FEMALE`(암컷) — DB `ENUM('MALE','FEMALE')`, `weight`: kg 소수 1자리 — **펫 호텔 객실 `room_types.max_weight` 검증에 사용**
- 🆕 `photoUrl`: 지금 프론트는 240px 정사각 JPEG 썸네일을 **data URL**로 보내요(약 10~20KB). 이미지 업로드 API를 따로 만들지, 이대로 `MEDIUMTEXT`에 저장할지, 사진을 빼고 갈지 팀 결정 필요.

## 3. 지하철역 (stations) — 2026-11-25 삭제

지하철역 테이블과 API(`/stations`)는 지웠어요. 대신 지역 목록(`/regions`)과 버스 정류장 API(`/bus-stops/…`)를 써요 → [09_BUS_TRANSIT](09_BUS_TRANSIT.md) §5.

## 4. 장소 (places, place_categories)

| Method | Path | Auth | 설명 |
|---|---|---|---|
| GET | `/place-categories` | - | `[{ "categoryId": 1, "name": "카페" }, …]` — 🔁 카페·식당·숙소·**운동장** |
| GET | `/places` | 선택 | 다중 조건 검색 |
| GET | `/places/{placeId}` | 선택 | 상세 |

로그인 상태면 `bookmarked`를 채워 주세요 (비로그인 시 `false`).

### GET /places 쿼리

| 파라미터 | 예 | 설명 |
|---|---|---|
| lat, lng | `34.79`, `126.38` | 내 위치 기준 반경 검색 (+ `distanceKm`) |
| radiusKm | `1` \| `3` \| `5` | "출발점에서 거리" (기본 1, 최대 5) |
| sido, sigungu | `전남광주`, `목포시` | 지역별 탐색 (`전라남도` · `광주광역시` · `전남광주통합특별시`도 받아요) |
| nearStop | `true` | 버스 정류장 300m 안만 |
| categoryIds | `1,2` | 카테고리 OR (여러 개 선택) |
| sizes | `SMALL,MEDIUM` | 선택한 크기를 **모두 동반 가능한** 장소 (`max_size >= 각 크기`) |
| indoor | `INDOOR,BOTH` | 실내외 OR. 화면 "실내" = `INDOOR,BOTH`, "실외" = `OUTDOOR,BOTH`, "전체" = 생략 |
| sort | `distance` \| `reviews` \| `rating` \| `transit` | 가까운 순 / 리뷰 많은 순 / 별점 순 / 정류장 가까운 순 |
| page, size | `0`, `8` | |

```jsonc
// 목록 아이템
{
  "placeId": 1, "name": "산책길 브런치 카페", "categoryId": 1, "categoryName": "카페",
  "address": "서울 마포구 ...", "sido": "서울", "sigungu": "마포구", "lat": 37.55, "lng": 126.92,
  "maxSize": "MEDIUM",            // SMALL | MEDIUM | LARGE (동반 가능 최대 크기)
  "indoorType": "INDOOR",         // INDOOR | OUTDOOR | BOTH
  "imageUrl": null,               // 🆕 대표 사진 (없으면 프론트가 영문 카테고리 일러스트로 대체)
  "avgRating": 4.5, "reviewCount": 3, "bookmarked": false,
  "busAccess": { "stopId": "…", "stopName": "목포역", "distanceM": 120, "walkMin": 2, "stops500m": 6, "routeCount": 0, "grade": "A", "gradeLabel": "버스 정류장이 아주 가까워요" },
  "distanceKm": 0.296             // lat · lng 로 검색했을 때만
}
// 상세 = 목록 아이템 + 아래
{ "phone": "02-...", "description": "공공데이터 원문 설명", "bookmarkCount": 12 }
```
- 상세 화면의 가까운 정류장 목록 · 노선 · 실시간 도착은 `/bus-stops/nearby?lat=&lng=` 등으로 따로 불러요 ([09](09_BUS_TRANSIT.md)).
- S03 "카카오맵 길찾기"는 프론트에서 `https://map.kakao.com/link/to/{장소명},{lat},{lng}` 로 열어요 (API 불필요).

## 5. 찜 (place_bookmarks)

| Method | Path | Auth | 설명 |
|---|---|---|---|
| POST | `/places/{placeId}/bookmark` | ✅ | 찜 → `{ "placeId": 1, "bookmarked": true }` / 🔁 이미 찜이면 **409 DUPLICATE_BOOKMARK** |
| DELETE | `/places/{placeId}/bookmark` | ✅ | 찜 해제 (없어도 200) |
| GET | `/users/me/bookmarks` | ✅ | 내 찜 목록 (최근 순) — 장소 목록 아이템 + `bookmarkedAt` |

`UNIQUE(user_id, place_id)` 제약 → 위반 시 409로 변환.

## 6. 리뷰 (reviews — 통합 리뷰)

| Method | Path | Auth | 설명 |
|---|---|---|---|
| GET | `/reviews?targetType=PLACE&targetId=1&sort=latest&page=0&size=4` | 선택 | 목록 + 요약 |
| POST | `/reviews` | ✅ | 작성 (1인 1대상 1리뷰, 별점 1~5, 내용 10~500자) |
| PUT | `/reviews/{reviewId}` | ✅ | 수정 (본인만) |
| DELETE | `/reviews/{reviewId}` | ✅ | 삭제 (본인만) → 204 |
| GET | `/users/me/reviews?targetType=` | ✅ | 내가 쓴 리뷰 + `targetName`. 🔁 `targetType` 생략 시 **장소·상품 전체** (S08 통합 리뷰) |

`sort`: `latest` | `rating_desc`

```jsonc
// GET /reviews 응답
{
  "summary": { "avgRating": 4.5, "reviewCount": 3, "distribution": { "1": 0, "2": 0, "3": 1, "4": 1, "5": 1 } },
  "content": [{
    "reviewId": 10, "userId": 2, "userName": "박댕댕", "petName": "두부", "petBreed": "골든 리트리버",
    "targetType": "PLACE", "targetId": 1, "rating": 5, "content": "...",
    "createdAt": "...", "updatedAt": "...", "mine": false
  }],
  "page": 0, "size": 4, "totalElements": 3, "hasNext": false
}
```
- 상품 리뷰(`PRODUCT`)의 `targetName`은 products.name 조인으로 채워 주세요 (S08 작성한 리뷰).
- 병원 리뷰(`HOSPITAL`) 추가 여부는 팀장 문서의 "DB 연동 시 확인할 점" 참고 (FE2·BE2 영역).

## 7. SQL 예시 (BE1 참고)

```sql
-- 내 위치 반경 검색 + 다중 필터 + 가장 가까운 버스 정류장, 가까운 순 (MySQL 5.7+)
SELECT p.*, bs.name AS stop_name,
       ST_Distance_Sphere(POINT(p.longitude, p.latitude), POINT(:lng, :lat)) / 1000 AS distance_km
FROM places p
LEFT JOIN bus_stops bs ON bs.stop_id = p.nearest_stop_id
WHERE ST_Distance_Sphere(POINT(p.longitude, p.latitude), POINT(:lng, :lat)) <= :radiusM
  AND p.category_id IN (1, 2)                 -- 카테고리 (선택)
  AND p.allowed_size IN ('MEDIUM', 'LARGE')   -- 중형 선택 시: 중형 이상 가능한 곳
  AND p.indoor_outdoor IN ('INDOOR', 'BOTH')  -- 실내 선택 시
  AND p.nearest_stop_m <= 300                 -- 정류장 300m 안 (선택)
ORDER BY distance_km
LIMIT ? OFFSET ?;

-- 지역별: 전남광주 목포시, 정류장 가까운 순
SELECT p.name, p.nearest_stop_m, bs.name AS stop_name
FROM places p LEFT JOIN bus_stops bs ON bs.stop_id = p.nearest_stop_id
WHERE p.sido = '전남광주' AND p.sigungu = '목포시'
ORDER BY p.nearest_stop_m IS NULL, p.nearest_stop_m;

-- 평균 별점·리뷰 수
SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
FROM reviews WHERE target_type = 'PLACE' AND target_id = ?;

-- 마이페이지 활동 요약 (BE2 테이블 포함)
SELECT
  (SELECT COUNT(*) FROM hospital_reservations WHERE user_id = :me AND status IN ('PENDING','CONFIRMED'))
+ (SELECT COUNT(*) FROM hotel_reservations    WHERE user_id = :me AND status IN ('PENDING','CONFIRMED')) AS reservation_count,
  (SELECT COUNT(*) FROM orders          WHERE user_id = :me) AS order_count,
  (SELECT COUNT(*) FROM reviews         WHERE user_id = :me) AS review_count,
  (SELECT COUNT(*) FROM place_bookmarks WHERE user_id = :me) AS bookmark_count;
```

## 8. 구현 메모 (11/24 백엔드 `backend/`)

명세와 목 서버 응답 모양 그대로 구현했고, 아래만 더하거나 정했어요.

- 회원가입 반려동물은 **1~5마리** (0마리면 `400`). 검증 규칙은 FE `utils/validators.js` 와 같아요.
- 비밀번호 찾기: 메일 서버가 없어서 임시 비밀번호를 **서버 로그**에 남겨요. `petplanet.demo-mode: true` 면 응답에 `temporaryPassword` 도 넣어요.
- `GET /places` 는 `keyword`, `sort=rating` 도 받아요. 반경은 최대 5km. (11/25: `lines` 삭제, 지역 · 정류장 필터 추가)
- 리뷰 응답에 `petWeight`, `visitDate`(병원 리뷰 — 그 병원 이용완료 예약 날짜), `targetName` 을 더했어요.
- `GET /reviews/eligibility?targetType=&targetId=` → `{ allowed, alreadyReviewed, reason }` (리뷰 쓰기 버튼 표시용)
- 리뷰 작성 시 `petId` 를 보낼 수 있어요 (없으면 병원 리뷰는 이용완료 예약의 반려동물, 그 외는 대표 반려동물로 표시).
