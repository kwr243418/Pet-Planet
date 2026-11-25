# 03. API 공통 규격

> ⚠️ **2026-11-25 지하철 → 버스 · 지역별 탐색으로 바뀌었어요.** 이 문서의 지하철역 · 호선 · `stations` · `place_stations` 내용은 [09_BUS_TRANSIT](09_BUS_TRANSIT.md)이 대신해요.

모든 API(BE1·BE2)가 같은 모양으로 응답해야 FE가 한 군데(`frontend/src/api/client.js`)에서 처리할 수 있어요.
백엔드 스택이 정해져도 이 규격은 그대로예요.

## 기본

| 항목 | 규칙 |
|---|---|
| 주소 | `/api/...` (개발 중 FE는 `http://localhost:5173` → 백엔드 `http://localhost:8080` 으로 프록시) |
| 형식 | JSON, UTF-8 |
| 필드 이름 | **camelCase** (`placeId`, `createdAt`). DB 칼럼은 snake_case 그대로 두고 응답 만들 때 바꿔요 |
| 날짜 | 날짜+시간 `2026-11-20T14:00:00+09:00` (ISO-8601) / 날짜만 `2026-11-20` |
| 시간대 | Asia/Seoul 로 통일 (DB 연결·서버 모두) |
| 금액 | 원 단위 정수 (`32000`) |
| 성공 응답 | 데이터를 **그대로** 돌려줘요 (`{ "success": true, "data": … }` 로 감싸지 않음) |
| 삭제 성공 | `204 No Content` (본문 없음) |
| CORS | 개발 중 `http://localhost:5173` 허용 (프록시 쓰면 필요 없음) |

## 인증

- 로그인·회원가입 성공 시 `accessToken`(JWT) 발급
- 로그인이 필요한 API: 요청 헤더 `Authorization: Bearer {accessToken}`
- 토큰 없음·만료 → `401` → FE가 자동으로 로그아웃 후 로그인 화면으로 이동
- 비밀번호는 단방향 암호화(BCrypt 등) — `users.password VARCHAR(255)`
- 권한: `role` = `USER` | `BUSINESS` | `ADMIN` (가입 화면에서는 USER/BUSINESS 만 선택)

## 목록 · 페이지

요청: `?page=0&size=10` (page는 0부터)

```json
{
  "content": [ … ],
  "page": 0,
  "size": 10,
  "totalElements": 32,
  "totalPages": 4,
  "hasNext": true
}
```
여러 값 필터는 콤마로: `?categoryIds=1,2&sizes=SMALL,MEDIUM`

## 에러 — 모든 4xx · 5xx 같은 모양

```json
{
  "status": 409,
  "code": "DUPLICATE_EMAIL",
  "message": "이미 가입된 이메일이에요.",
  "errors": [{ "field": "email", "message": "이미 가입된 이메일이에요." }]
}
```

- `message`: **사용자에게 그대로 보여줄 한국어 문장** (FE가 토스트·입력칸 아래에 그대로 표시)
- `errors`: 입력값 검증 실패일 때만. `field`는 요청 JSON 필드 이름 (배열이면 `pets[0].weight`)
- `code`: 대문자 스네이크. 공통 코드 + 파트별 코드

| HTTP | code | 상황 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 입력값 검증 실패 (`errors` 포함) |
| 401 | `UNAUTHORIZED` | 토큰 없음·만료 |
| 401 | `INVALID_CREDENTIALS` | 로그인 실패 |
| 403 | `FORBIDDEN` | 남의 데이터 수정·삭제 |
| 404 | `{대상}_NOT_FOUND` | `PLACE_NOT_FOUND`, `HOSPITAL_NOT_FOUND` … |
| 409 | `DUPLICATE_*` / 업무 규칙 | 중복·충돌 (아래 파트별 표) |
| 500 | `INTERNAL_ERROR` | 서버 오류 — message 는 "잠시 후 다시 시도해 주세요." 정도로 |

파트별 409 코드: `DUPLICATE_EMAIL`, `DUPLICATE_BOOKMARK`, `DUPLICATE_REVIEW`, `WITHDRAW_BLOCKED` (docs/04) / `TIME_SLOT_TAKEN`, `ROOM_OVERWEIGHT`, `ROOM_ALREADY_BOOKED`, `OUT_OF_STOCK`, `ORDER_NOT_CANCELLABLE`, `REVIEW_NOT_ALLOWED` (docs/05)

## 공통 enum 값 (DB ↔ API ↔ 화면)

DB ENUM 값과 API 값을 **똑같이** 써요. 화면 표시는 FE가 바꿔요.

| 대상 | 값 | 화면 표시 |
|---|---|---|
| `users.role` | `USER` · `BUSINESS` · `ADMIN` | 일반 회원 · 사업자 회원 · 관리자 |
| `pets.gender` | `MALE` · `FEMALE` | 수컷 · 암컷 |
| `places.allowed_size` | `SMALL` · `MEDIUM` · `LARGE` (동반 가능 **최대** 크기) | 소형견만 · 소·중형견 · 대형견 가능 |
| `places.indoor_outdoor` | `INDOOR` · `OUTDOOR` · `BOTH` | 실내 · 실외 · 실내·외 |
| `reviews.target_type` | `PLACE` · `PRODUCT` · `HOSPITAL`(제안) | 장소 · 상품 · 병원 |
| 예약 `status` (병원·호텔) | `PENDING` · `CONFIRMED` · `COMPLETED` · `CANCELLED` | 승인대기 · 예약확정 · 이용완료 · 취소 |
| `orders.status` (제안) | `ORDERED` · `PREPARING` · `SHIPPING` · `DELIVERED` · `CANCELLED` | 결제완료 · 배송준비 · 배송중 · 배송완료 · 주문취소 |
| `stations.line` | `1호선` … `9호선`, `신분당선`, `수인분당선`, `경의중앙선`, `공항철도` | 그대로 |

크기 기준(체중): 소형 < 10kg ≤ 중형 ≤ 25kg < 대형

## FE 목 서버

`frontend/.env.local` 의 `VITE_USE_MOCK=true` 면 백엔드 없이 `frontend/src/mocks/mockServer.js` 가 이 규격대로 응답해요.
BE API가 준비되면 `false` 로 바꾸기만 하면 같은 화면이 실제 API로 동작해요. FE2도 같은 방식으로 목 핸들러를 추가하면 돼요.
