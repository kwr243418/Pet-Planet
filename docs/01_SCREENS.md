# 01. 화면 담당표

팀장 목업 10개 화면(S01–S09, S04-0) + 목업에는 없지만 필요한 보조 화면.
상태: ✅ 완료(목 서버) · 🧱 뼈대만 · ⬜ 미착수

| ID | 화면 | 경로 | 노선 | FE | BE | 주요 테이블 | 주요 API (docs/04·05) | 상태 |
|---|---|---|---|---|---|---|---|---|
| S01 | 메인 홈 | `/` | – | FE1 | BE1 | stations, places, place_stations, pets | `GET /stations?line=`, `GET /places` | ✅ |
| S02 | 역세권 장소 탐색 | `/explore` | E | FE1 | BE1 | stations, places, place_categories, place_stations, place_bookmarks | `GET /stations?line=`, `GET /places`, `POST/DELETE /places/{id}/bookmark` | ✅ |
| S03 | 장소 상세 | `/places/:placeId` | E | FE1 | BE1·BE2 | places, place_stations, place_bookmarks, reviews(PLACE) | `GET /places/{id}`, `GET/POST/PUT/DELETE /reviews` | ✅ |
| S04-0 | 동물병원 상세 · 리뷰 | `/hospitals/:hospitalId` | R | FE2 | BE2 | hospitals, pets, hospital_reservations, reviews(HOSPITAL) | `GET /hospitals/{id}`, `GET /reviews?targetType=HOSPITAL` | 🧱 |
| S04 | 동물병원 진료 예약 | `/reservations/hospital` | R | FE2 | BE2 | hospitals, pets, hospital_reservations | `GET /hospitals/{id}/available-times`, `POST /hospital-reservations` | 🧱 |
| S05 | 펫 호텔 객실 예약 | `/reservations/hotel` | R | FE2 | BE2 | pet_hotels, room_types, pets, hotel_reservations | `GET /pet-hotels/{id}/rooms`, `POST /hotel-reservations` | 🧱 |
| S06 | 펫 스토어 | `/shop` | S | FE2 | BE2 | product_categories, products, cart_items | `GET /products`, `POST /cart/items` | 🧱 |
| S07 | 장바구니 · 주문서 | `/cart` | S | FE2 | BE2 | cart_items, orders, order_items, products | `GET /cart`, `POST /orders` | 🧱 |
| S08 | 마이페이지 | `/mypage` | M | **FE1 + FE2** | BE1·BE2 | users, pets, reviews, place_bookmarks / hospital·hotel_reservations, orders | `GET /users/me/summary` 외 | ✅ FE1 칸 · 🧱 예약·주문 칸 |
| S09 | 회원가입 · 반려동물 등록 | `/signup` | M | FE1 | BE1 | users, pets | `POST /auth/signup` | ✅ |
| – | 로그인 | `/login` | M | FE1 | BE1 | users | `POST /auth/login` | ✅ |
| – | 비밀번호 찾기 | `/find-password` | M | FE1 | BE1 | users | `POST /auth/password/reset` | ✅ |
| – | 반려동물 추가 · 수정 | `/pets/new`, `/pets/:petId/edit` | M | FE1 | BE1 | pets | `POST/PUT/DELETE /pets` | ✅ |

## S08 마이페이지 나눔

한 화면에 두 파트가 섞여 있어서 칸 단위로 나눴어요. 화면 틀은 FE1이 만들어 뒀어요(`frontend/src/pages/MyPage.jsx`).

| 칸 | 담당 | 비고 |
|---|---|---|
| 회원 정보 · 회원정보 수정 · 회원 탈퇴 | FE1 / BE1 | 탈퇴 가능 여부는 BE2 예약·주문 상태도 확인 |
| 활동 요약 타일 4개 | FE1 / BE1 (+BE2 집계) | `GET /users/me/summary` — 예약·주문 수는 BE2 테이블 |
| 내 반려동물 | FE1 / BE1 | |
| 작성한 리뷰 (장소·상품) | FE1 / BE2 | reviews 는 BE2 테이블, 장소 리뷰 화면은 FE1 |
| 찜한 장소 | FE1 / BE1 | |
| **예약 현황** | **FE2 / BE2** | `MyPage.jsx` 의 `id="reservations"` 칸을 교체 |
| **주문 내역** | **FE2 / BE2** | `MyPage.jsx` 의 `id="orders"` 칸을 교체 |

## 공통으로 쓰는 것 (FE)

| 파일 | 내용 |
|---|---|
| `components/layout/Site.jsx` | 헤더(E·R·S·M), 푸터, `PageHero`, `NowStation`, `LetterBadge` |
| `components/common/ui.jsx` | `Button`, `Field`, `OptionGroup`, `Tag`, `Stars`, `StarInput`, `Modal`, `ConfirmDialog`, `EmptyState`, `ErrorState`, `Skeleton` |
| `components/common/Toast.jsx` | `useToast()` |
| `components/illust/index.jsx` | 일러스트 SVG (지하철 푸들, 역 앞 건물, 강아지) |
| `components/place/Reviews.jsx` | `ReviewCard`, `ReviewModal` — 병원·상품 리뷰에도 재사용 가능 |
| `context/AuthContext.jsx` | `useAuth()` → `user`, `pets`, `primaryPet`, `login`, `logout` … |
| `api/client.js` | `http.get/post/put/patch/delete`, 에러 → `ApiError` |
| `hooks/useAsync.js` | 데이터 불러오기 (`data`, `error`, `loading`, `reload`) |
