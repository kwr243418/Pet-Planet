# 펫플래닛 API 명세 (FE1 ↔ BE1 연동 초안)

> Day 1 "API 명세 구조 논의" 산출물. FE1(회원/장소 UI)이 사용하는 엔드포인트입니다.
> 프론트의 목 서버(`src/mocks/mockServer.js`)가 이 명세 그대로 동작하므로, BE1 구현과 다른 부분은 **이 문서와 `src/api/index.js`만** 맞추면 됩니다.

## 공통 규칙

| 항목 | 규칙 |
|---|---|
| Base URL | `/api` (vite dev 서버가 `http://localhost:8080` 으로 프록시) |
| 인증 | `Authorization: Bearer {accessToken}` (JWT) |
| JSON 필드명 | camelCase (`placeId`, `avgRating` …) — DB 컬럼은 snake_case여도 응답 DTO는 camelCase |
| 날짜 | ISO-8601 문자열 (`2026-11-16T05:15:00+09:00`) |
| 페이지 | `page`(0부터), `size` → 응답 `{ content, page, size, totalElements, totalPages, hasNext }` |
| 목록 필터 다중값 | 콤마 구분: `categoryIds=1,2&lines=2,SB` |

### 에러 응답 (모든 4xx/5xx 공통)

```json
{
  "status": 409,
  "code": "DUPLICATE_EMAIL",
  "message": "이미 가입된 이메일이에요.",
  "errors": [{ "field": "email", "message": "이미 가입된 이메일이에요." }]
}
```

- `message`는 **사용자에게 그대로 보여줄 문장**으로 내려주세요 (프론트가 토스트/폼 아래에 표시).
- `errors`는 필드 검증 실패 시에만. 프론트는 `field` 이름으로 해당 입력칸 아래에 표시합니다.
- 401 → 프론트가 토큰 삭제 후 로그인 화면으로 이동.

| code | status | 상황 |
|---|---|---|
| VALIDATION_ERROR | 400 | 입력값 검증 실패 (`errors` 포함) |
| UNAUTHORIZED | 401 | 토큰 없음/만료 |
| INVALID_CREDENTIALS | 401 | 로그인 실패 |
| FORBIDDEN | 403 | 남의 반려동물·리뷰 수정/삭제 |
| USER_NOT_FOUND / PLACE_NOT_FOUND / STATION_NOT_FOUND / PET_NOT_FOUND / REVIEW_NOT_FOUND | 404 | |
| DUPLICATE_EMAIL | 409 | 회원가입 이메일 중복 |
| DUPLICATE_REVIEW | 409 | 같은 장소에 리뷰 2번 |
| PET_LIMIT | 400 | 반려동물 5마리 초과 |

---

## 1. 인증 (users)

| Method | Path | Auth | 설명 |
|---|---|---|---|
| GET | `/auth/check-email?email=` | - | 이메일 중복확인 → `{ "available": true }` |
| POST | `/auth/signup` | - | 회원가입 → 로그인 응답과 동일 |
| POST | `/auth/login` | - | 로그인 |
| GET | `/auth/me` | ✅ | 내 정보 (새로고침 시 로그인 복원용) |
| POST | `/auth/password/reset` | - | 이메일+이름 일치 시 임시 비밀번호 메일 발송 → `{ "sent": true, "email": "..." }` |

```jsonc
// POST /auth/signup  요청
{ "email": "petplanet@email.com", "password": "petplanet123!", "name": "김펫플" }
// POST /auth/login   요청
{ "email": "petplanet@email.com", "password": "petplanet123!" }
// 응답 (signup/login 공통)
{
  "accessToken": "eyJhbGciOi...",
  "user": { "userId": 1, "email": "petplanet@email.com", "name": "김펫플", "role": "USER", "createdAt": "..." }
}
```

비밀번호 규칙(프론트 검증과 동일하게): 영문+숫자+특수문자, 8~20자. 이름 2~10자(한글/영문).

## 2. 반려동물 (pets)

| Method | Path | Auth | 설명 |
|---|---|---|---|
| GET | `/pets` | ✅ | 내 반려동물 목록 (첫 번째 = 대표) |
| GET | `/pets/{petId}` | ✅ | 단건 |
| POST | `/pets` | ✅ | 등록 (최대 5마리) |
| PUT | `/pets/{petId}` | ✅ | 수정 |
| DELETE | `/pets/{petId}` | ✅ | 삭제 → 204 |

```json
{ "petId": 1, "userId": 1, "name": "콩이", "breed": "말티즈", "weight": 3.8, "gender": "F", "neutered": true }
```
- `gender`: `M` | `F`, `weight`: kg (소수 1자리)
- 크기 구분은 프론트가 계산: 소형 <10kg, 중형 10~25kg, 대형 >25kg

## 3. 지하철역 (stations)

| Method | Path | 설명 |
|---|---|---|
| GET | `/stations?keyword=강남` | 역 이름 부분일치 검색 (끝의 "역"은 무시), 최대 10개 |
| GET | `/stations/{stationId}` | 단건 |

stations 테이블은 **역 1행 = 역이름 + 호선 1개** 구조이므로, 응답은 **역 이름으로 묶어서** 호선을 배열로 주세요.

```json
[{ "stationId": 1, "stationName": "강남", "lines": ["2", "SB"], "lat": 37.4979, "lng": 127.0276 }]
```
```sql
-- 예시 (MySQL 8) ※ LINES 는 MySQL 예약어라 별칭으로 쓰면 에러 → line_codes 사용
SELECT MIN(station_id) AS station_id, station_name,
       GROUP_CONCAT(line ORDER BY line) AS line_codes,   -- "2,SB" 문자열 → DTO에서 split(",") 해서 배열로
       AVG(lat) AS lat, AVG(lng) AS lng
FROM stations WHERE station_name LIKE CONCAT('%', ?, '%')
GROUP BY station_name LIMIT 10;
```
호선 코드: `1`~`9`, `SB`(신분당), `SU`(수인분당), `GJ`(경의중앙), `AR`(공항철도) — 공공데이터 원본 값과 다르면 매핑표 공유 부탁드려요.

## 4. 장소 (places, place_categories, place_stations)

| Method | Path | Auth | 설명 |
|---|---|---|---|
| GET | `/place-categories` | - | `[{ "categoryId": 1, "name": "카페" }]` |
| GET | `/places` | 선택 | 다중 조건 검색 (아래) |
| GET | `/places/{placeId}` | 선택 | 상세 |

로그인 상태면 `bookmarked`를 채워 주세요 (비로그인 시 `false`).

### GET /places 쿼리

| 파라미터 | 예 | 설명 |
|---|---|---|
| stationId | `1` | 이 역 기준 반경 검색 (+ `distanceKm` 계산) |
| radiusKm | `1` | 기본 1, 최대 3 |
| categoryIds | `1,2` | 카테고리 OR |
| lines | `2,6` | 장소의 인접역(place_stations, 1km) 중 하나라도 해당 호선이면 포함 |
| sizes | `LARGE` | 이 크기를 **동반 가능한** 장소 (`max_size >= LARGE`) |
| indoor | `BOTH,INDOOR` | 실내외 구분 OR |
| keyword | `카페` | 이름/주소 부분일치 |
| sort | `distance` \| `rating` \| `reviews` \| `name` | stationId 있으면 기본 `distance`, 없으면 `rating` |
| page, size | `0`, `10` | |

```jsonc
// 목록 아이템
{
  "placeId": 1, "name": "멍멍살롱 카페", "categoryId": 1, "categoryName": "카페",
  "address": "서울 강남구 ...", "lat": 37.49, "lng": 127.03,
  "maxSize": "MEDIUM",            // SMALL | MEDIUM | LARGE  (동반 가능 최대 크기)
  "indoorType": "BOTH",           // INDOOR | OUTDOOR | BOTH
  "avgRating": 4.8, "reviewCount": 5, "bookmarked": true,
  "nearestStation": { "stationId": 1, "stationName": "강남", "lines": ["2","SB"], "distanceKm": 0.36 },
  "distanceKm": 0.36              // stationId 로 검색했을 때만
}
// 상세 = 목록 아이템 + 아래 필드
{ "phone": "02-...", "description": "...", "bookmarkCount": 12,
  "nearbyStations": [{ "stationId": 1, "stationName": "강남", "lines": ["2","SB"], "lat": 37.4979, "lng": 127.0276, "distanceKm": 0.36 }] }
```

> places 테이블의 "동반 가능 크기", "실내·외 동반 여부" 컬럼 값을 위 enum으로 맞춰 주시면 됩니다.

## 5. 찜 (place_bookmarks)

| Method | Path | Auth | 설명 |
|---|---|---|---|
| POST | `/places/{placeId}/bookmark` | ✅ | 찜 (이미 찜이면 그대로 200 — 멱등) → `{ "placeId": 1, "bookmarked": true }` |
| DELETE | `/places/{placeId}/bookmark` | ✅ | 찜 해제 (없어도 200) |
| GET | `/users/me/bookmarks` | ✅ | 내 찜 목록 (최근 찜한 순) — 장소 목록 아이템 + `bookmarkedAt` |

`UNIQUE(user_id, place_id)` 제약 추천.

## 6. 리뷰 (reviews — 통합 리뷰, FE1은 targetType=PLACE)

| Method | Path | Auth | 설명 |
|---|---|---|---|
| GET | `/reviews?targetType=PLACE&targetId=1&sort=latest&page=0&size=5` | 선택 | 목록 + 요약 |
| POST | `/reviews` | ✅ | 작성 (1인 1장소 1리뷰, 별점 1~5, 내용 10~500자) |
| PUT | `/reviews/{reviewId}` | ✅ | 수정 (본인만) |
| DELETE | `/reviews/{reviewId}` | ✅ | 삭제 (본인만) → 204 |
| GET | `/users/me/reviews?targetType=PLACE` | ✅ | 내가 쓴 리뷰 + `targetName` |

`sort`: `latest` | `rating_desc` | `rating_asc`

```jsonc
// GET /reviews 응답
{
  "summary": { "avgRating": 4.8, "reviewCount": 5, "distribution": { "1": 0, "2": 0, "3": 0, "4": 1, "5": 4 } },
  "content": [{
    "reviewId": 10, "userId": 2, "userName": "박댕댕", "petName": "보리", "petBreed": "골든 리트리버",
    "targetType": "PLACE", "targetId": 1, "rating": 5, "content": "...",
    "createdAt": "...", "updatedAt": "...", "mine": false
  }],
  "page": 0, "size": 5, "totalElements": 5, "hasNext": false
}
// POST /reviews 요청
{ "targetType": "PLACE", "targetId": 1, "rating": 5, "content": "열 글자 이상 리뷰" }
```

`petName/petBreed`는 작성자의 대표(첫 번째) 반려동물. 평균 별점 집계 쿼리 예:
```sql
SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
FROM reviews WHERE target_type = 'PLACE' AND target_id = ?;
```

---

## 7. MySQL 사용 시 체크 (BE 참고)

| 항목 | 내용 |
|---|---|
| 문자셋 | DB/테이블 모두 **`utf8mb4` / `utf8mb4_0900_ai_ci`**. 리뷰 빠른 태그에 이모지(💧🐕🚇)가 들어가서 `utf8`(3바이트)이면 저장 시 에러 |
| 예약어 | `lines` 는 예약어 → 컬럼/별칭에 쓰지 말 것 (`line`, `line_codes` 사용) |
| GROUP_CONCAT | 결과가 문자열 → 응답 DTO에서 배열(`["2","SB"]`)로 변환. 기본 길이 1024 제한(`group_concat_max_len`) |
| boolean | `TINYINT(1)` → JSON에서는 `true/false` 로 (예: `neutered`) |
| enum | `max_size ENUM('SMALL','MEDIUM','LARGE')`, `indoor_type ENUM('INDOOR','OUTDOOR','BOTH')`, `target_type ENUM('PLACE','PRODUCT', ...)` 처럼 응답 값과 동일하게 |
| 숫자 | `ROUND(AVG(rating),1)` 은 DECIMAL → JSON 문자열 `"4.8"` 이 아니라 숫자 `4.8` 로 직렬화 |
| 시간 | `DATETIME` + 서버/커넥션 타임존 `Asia/Seoul` 통일, 응답은 ISO-8601 |
| 중복 방지 | `UNIQUE(user_id, place_id)` (찜), `UNIQUE(user_id, target_type, target_id)` (리뷰 1인 1개) → 위반 시 409로 변환 |

반경 검색은 place_stations에 미리 저장한 거리를 쓰면 되고, 역 기준 실시간 거리가 필요하면 MySQL 내장 함수로 계산할 수 있어요.
```sql
-- 강남역(stationId=?) 기준 1km 이내 장소, 거리순 (MySQL 5.7+)
SELECT p.*, ST_Distance_Sphere(POINT(p.lng, p.lat), POINT(s.lng, s.lat)) / 1000 AS distance_km
FROM places p JOIN stations s ON s.station_id = ?
HAVING distance_km <= 1
ORDER BY distance_km;
```
