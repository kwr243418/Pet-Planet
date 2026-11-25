# 06. DB 합의사항

> ⚠️ **2026-11-25 지하철 → 버스 · 지역별 탐색으로 바뀌었어요.** 이 문서의 지하철역 · 호선 · `stations` · `place_stations` 내용은 [09_BUS_TRANSIT](09_BUS_TRANSIT.md)이 대신해요.

현재 스키마(`db/schema_full.sql`, BE1 작성)와 팀장 목업 화면 사이에 안 맞는 곳을 모았어요.
**[결정] 칸을 채우고**, 채택한 항목은 `db/patch_v2_proposed.sql` 의 같은 번호 블록을 실행(또는 `schema_full.sql` 에 반영)하면 돼요.
출처: 팀장 "화면별 필수 요소 정리 › DB 연동 시 확인할 점" + FE1이 화면 만들며 찾은 것.

| # | 테이블 | 지금 | 문제 (어느 화면) | 제안 (patch_v2) | 담당 | 결정 |
|---|---|---|---|---|---|---|
| 1 | stations | `name, line, 위경도`만 | S02 노선도를 순서대로 그릴 수 없음 | `seq INT` (노선 내 순서) 추가. 공공데이터 역번호/순서로 채우기 | BE1 | ✅ 채택 (11/24 BE1): `seq` 추가 — `seed_dev_places.sql` 에 실제 운행 순서로 채움. 백엔드 노선도 API 가 사용 |
| 2 | stations | 샘플이 `'강남역'`, `'2호선'` | 역 이름 표기 통일 필요 | 이름은 `'강남'`(역 빼기) 권장, 호선은 `'2호선'` 그대로. FE는 둘 다 처리돼요 | BE1 | ✅ 채택 (11/24 BE1): 이름은 `'홍대입구'`(역 빼기), 호선 `'2호선'`. 검색은 끝의 '역'을 떼고 찾음 |
| 3 | places | `allowed_size`, `indoor_outdoor` 가 VARCHAR, 샘플 값 `'SMALL~LARGE'`, `'ALL'`, `'실내'` | S02 필터 SQL 을 짤 수 없음 | ENUM 으로: `SMALL/MEDIUM/LARGE`(최대 크기), `INDOOR/OUTDOOR/BOTH`. 공공데이터 원문 → 값 변환은 적재 스크립트에서 | BE1 | ✅ 채택 (11/24 BE1): ENUM `SMALL/MEDIUM/LARGE`, `INDOOR/OUTDOOR/BOTH` — patch [3] 그대로 |
| 4 | place_categories | 샘플: 카페·공원·반려동물 용품점 | S02 필터는 **카페·식당·숙소·운동장** | 4종으로 맞추고 공공데이터 분류 → 4종 매핑표 만들기 | BE1 | ✅ 채택 (11/24 BE1): 카페·식당·숙소·운동장 4종 (`seed_dev_places.sql`) |
| 5 | places · pets · products | 사진 칼럼 없음 | S03 대표 사진, S09 반려동물 사진, S06 상품 이미지 | `image_url VARCHAR(500)`, `pets.photo_url MEDIUMTEXT`(작은 썸네일 data URL — 업로드 API 만들면 VARCHAR) | BE1·BE2 | ✅ 채택 (11/24): `places.image_url`, `products.image_url`, `pets.photo_url MEDIUMTEXT`(썸네일 data URL, 최대 500KB) — patch [5] |
| 6 | pets | breed·weight·gender 가 NULL 허용 | S09 필수: 이름·품종·체중·성별·중성화. 체중 없으면 호텔 검증 불가 | NOT NULL 로 | BE1 | ✅ 채택 (11/24 BE1): NOT NULL — 백엔드도 같은 규칙으로 검증 (이름 12자·품종 20자·체중 0.1~100kg 소수 1자리) |
| 7 | reviews | target_type `PLACE/PRODUCT`, 중복 제약 없음, pet_id·수정일 없음 | S04-0 병원 리뷰 저장 불가 / 1인 1리뷰 / 리뷰 카드 품종·체중 | `HOSPITAL` 추가, `pet_id`, `updated_at`, `UNIQUE(user_id, target_type, target_id)`. 병원을 여러 번 방문해 매번 쓰게 할지 결정 (그럼 UNIQUE 대신 `reservation_id`) | BE2 | ✅ 채택 (11/24 BE2): `HOSPITAL`·`pet_id`·`updated_at` 추가 + `UNIQUE(user_id, target_type, target_id)` 1인 1리뷰. 방문마다 리뷰는 안 함 |
| 8 | orders | status `PENDING/PAID/CANCELLED/SHIPPED`, 배송 정보 없음 | S07 배송 노선 결제완료→배송준비→배송중→배송완료, 받는 분·연락처·주소, 배송비 | status `ORDERED/PREPARING/SHIPPING/DELIVERED/CANCELLED`, `receiver_name`, `receiver_phone`, `address`, `shipping_fee` | BE2 | ✅ 채택 (11/24 BE2): patch [8] 그대로 |
| 9 | cart_items | 같은 상품 여러 행 가능 | S06 "같은 상품은 수량이 합쳐져요" | `UNIQUE(user_id, product_id)` + `ON DUPLICATE KEY UPDATE` | BE2 | ✅ 채택 (11/24 BE2): 담기 API는 `ON DUPLICATE KEY UPDATE`로 수량 합침 |
| 10 | product_categories | 샘플: 사료·장난감·의류 | S06 탭: 전체·사료·간식·위생용품·용품 | 4종으로 맞추기 (장난감·의류 → 용품?) | BE2 | ✅ 채택 (11/24 BE2): 사료·간식·위생용품·용품 4종. 장난감·의류 상품은 용품으로 옮기고 두 카테고리 삭제 (BE2 시드에서 처리) |
| 11 | hospitals | 영업시간만 | S04-0 소개 탭: 병원 소개·진료 과목·점심시간 | `intro`, `departments`, `lunch_time` 추가 **또는** 화면에서 빼기 | BE2·FE2 | ✅ 칼럼 추가 (11/24 BE2): patch [11] 그대로, 소개 탭 유지 — FE2 확인 필요 |
| 12 | hospital_reservations | 시간 정원 규칙 없음 | S04 "예약 찬 시간은 줄 긋고 비활성" | 30분 단위, 시간당 1건(`PENDING`·`CONFIRMED`)이면 마감 + 인덱스 | BE2 | ✅ 채택 (11/24 BE2): 30분 단위, 같은 병원·같은 일시에 `PENDING`·`CONFIRMED` 1건이면 마감 → `409 TIME_SLOT_TAKEN` |
| 13 | hotel_reservations | 기간 중복 규칙 없음 | S05 "같은 날짜에 확정 예약 있음" | 겹치는 기간 검사. `CONFIRMED` 만 막을지 `PENDING` 도 막을지 결정 + 인덱스 | BE2 | ✅ 채택 (11/24 BE2): `PENDING`·`CONFIRMED` **둘 다** 막음 (대기 예약 두 건이 모두 확정되는 이중 예약 방지) → `409 ROOM_ALREADY_BOOKED` |
| 14 | hospitals · pet_hotels | 직접 넣은 샘플 2곳씩뿐 | 전국 실제 병원·호텔로 S04·S05 목록과 역 근처 검색 | `license_no VARCHAR(20) UNIQUE`(인허가 관리번호) 추가 — `db/patch_be2_public_data.sql`, 적재기 `db/loader/` | BE2 | ✅ 채택 (11/24 BE2): 영업 중 병원 5,268·호텔(위탁관리업) 5,776곳. 영업시간·휴무일은 `operating_hours` 한 칸에 "… / 휴무: …" (병원만, 2,626곳). 호텔 영업시간·리뷰 시드 없음. PK 는 `hospital_id`·`hotel_id` 유지 (관리번호 18자리는 JS 숫자 범위 초과). 공용 DB 연결 안 돼 적재 대기 |

## 그 밖에 같이 정할 것

| 주제 | 현재 | 확인할 점 |
|---|---|---|
| 회원 탈퇴 | `users` 를 지우면 pets·찜·리뷰가 **CASCADE 삭제** | ✅ (11/24) 진행 중 예약·배송 전 주문이 있으면 `409 WITHDRAW_BLOCKED`, 없으면 실제 삭제 — 리뷰·장바구니·주문은 CASCADE, 예약의 user_id 는 SET NULL |
| 회원가입 | users, pets 따로 INSERT | ✅ (11/24) `POST /auth/signup` 하나의 `@Transactional` — 반려동물 1~5마리 |
| 문자셋 | `utf8mb4_unicode_ci` ✅ | 그대로 |
| 예약어 | – | MySQL 에서 `lines` 는 예약어 — 별칭·칼럼 이름으로 쓰지 않기 |
| 테이블 수 | 일정표는 16개, 스키마는 18개(room_types 등) | ERD·발표 자료 숫자 맞추기 |
| 시드 데이터 | schema_full 끝에 샘플 몇 줄 | ✅ (11/24) 역·장소 `db/seed_dev_places.sql`, 시연 계정·제휴 병원/호텔·상품·예약·주문·리뷰 `db/seed_demo.sql`, 전국 병원·호텔 `db/loader` |
