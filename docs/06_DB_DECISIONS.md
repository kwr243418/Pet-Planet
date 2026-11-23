# 06. DB 합의사항

현재 스키마(`db/schema_full.sql`, BE1 작성)와 팀장 목업 화면 사이에 안 맞는 곳을 모았어요.
**[결정] 칸을 채우고**, 채택한 항목은 `db/patch_v2_proposed.sql` 의 같은 번호 블록을 실행(또는 `schema_full.sql` 에 반영)하면 돼요.
출처: 팀장 "화면별 필수 요소 정리 › DB 연동 시 확인할 점" + FE1이 화면 만들며 찾은 것.

| # | 테이블 | 지금 | 문제 (어느 화면) | 제안 (patch_v2) | 담당 | 결정 |
|---|---|---|---|---|---|---|
| 1 | stations | `name, line, 위경도`만 | S02 노선도를 순서대로 그릴 수 없음 | `seq INT` (노선 내 순서) 추가. 공공데이터 역번호/순서로 채우기 | BE1 | |
| 2 | stations | 샘플이 `'강남역'`, `'2호선'` | 역 이름 표기 통일 필요 | 이름은 `'강남'`(역 빼기) 권장, 호선은 `'2호선'` 그대로. FE는 둘 다 처리돼요 | BE1 | |
| 3 | places | `allowed_size`, `indoor_outdoor` 가 VARCHAR, 샘플 값 `'SMALL~LARGE'`, `'ALL'`, `'실내'` | S02 필터 SQL 을 짤 수 없음 | ENUM 으로: `SMALL/MEDIUM/LARGE`(최대 크기), `INDOOR/OUTDOOR/BOTH`. 공공데이터 원문 → 값 변환은 적재 스크립트에서 | BE1 | |
| 4 | place_categories | 샘플: 카페·공원·반려동물 용품점 | S02 필터는 **카페·식당·숙소·운동장** | 4종으로 맞추고 공공데이터 분류 → 4종 매핑표 만들기 | BE1 | |
| 5 | places · pets · products | 사진 칼럼 없음 | S03 대표 사진, S09 반려동물 사진, S06 상품 이미지 | `image_url VARCHAR(500)`, `pets.photo_url MEDIUMTEXT`(작은 썸네일 data URL — 업로드 API 만들면 VARCHAR) | BE1·BE2 | |
| 6 | pets | breed·weight·gender 가 NULL 허용 | S09 필수: 이름·품종·체중·성별·중성화. 체중 없으면 호텔 검증 불가 | NOT NULL 로 | BE1 | |
| 7 | reviews | target_type `PLACE/PRODUCT`, 중복 제약 없음, pet_id·수정일 없음 | S04-0 병원 리뷰 저장 불가 / 1인 1리뷰 / 리뷰 카드 품종·체중 | `HOSPITAL` 추가, `pet_id`, `updated_at`, `UNIQUE(user_id, target_type, target_id)`. 병원을 여러 번 방문해 매번 쓰게 할지 결정 (그럼 UNIQUE 대신 `reservation_id`) | BE2 | |
| 8 | orders | status `PENDING/PAID/CANCELLED/SHIPPED`, 배송 정보 없음 | S07 배송 노선 결제완료→배송준비→배송중→배송완료, 받는 분·연락처·주소, 배송비 | status `ORDERED/PREPARING/SHIPPING/DELIVERED/CANCELLED`, `receiver_name`, `receiver_phone`, `address`, `shipping_fee` | BE2 | |
| 9 | cart_items | 같은 상품 여러 행 가능 | S06 "같은 상품은 수량이 합쳐져요" | `UNIQUE(user_id, product_id)` + `ON DUPLICATE KEY UPDATE` | BE2 | |
| 10 | product_categories | 샘플: 사료·장난감·의류 | S06 탭: 전체·사료·간식·위생용품·용품 | 4종으로 맞추기 (장난감·의류 → 용품?) | BE2 | |
| 11 | hospitals | 영업시간만 | S04-0 소개 탭: 병원 소개·진료 과목·점심시간 | `intro`, `departments`, `lunch_time` 추가 **또는** 화면에서 빼기 | BE2·FE2 | |
| 12 | hospital_reservations | 시간 정원 규칙 없음 | S04 "예약 찬 시간은 줄 긋고 비활성" | 30분 단위, 시간당 1건(`PENDING`·`CONFIRMED`)이면 마감 + 인덱스 | BE2 | |
| 13 | hotel_reservations | 기간 중복 규칙 없음 | S05 "같은 날짜에 확정 예약 있음" | 겹치는 기간 검사. `CONFIRMED` 만 막을지 `PENDING` 도 막을지 결정 + 인덱스 | BE2 | |

## 그 밖에 같이 정할 것

| 주제 | 현재 | 확인할 점 |
|---|---|---|
| 회원 탈퇴 | `users` 를 지우면 pets·찜·리뷰가 **CASCADE 삭제** | 목업: "진행 중 예약·배송 전 주문 있으면 탈퇴 불가, 찜·장바구니 삭제". 리뷰는 남길지("탈퇴한 회원") 지울지? 실제 삭제 대신 `deleted_at` 소프트 삭제도 가능 |
| 회원가입 | users, pets 따로 INSERT | S09 는 계정+첫 반려동물을 **한 트랜잭션**으로 (`POST /auth/signup` 에 `pets` 배열) |
| 문자셋 | `utf8mb4_unicode_ci` ✅ | 그대로 |
| 예약어 | – | MySQL 에서 `lines` 는 예약어 — 별칭·칼럼 이름으로 쓰지 않기 |
| 테이블 수 | 일정표는 16개, 스키마는 18개(room_types 등) | ERD·발표 자료 숫자 맞추기 |
| 시드 데이터 | schema_full 끝에 샘플 몇 줄 | 역·장소는 `db/seed_dev_places.sql`(가상 장소 32곳 + 실제 좌표 역 141행) 사용 가능. 공공데이터 적재 후 교체 |
