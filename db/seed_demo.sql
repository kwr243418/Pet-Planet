-- ============================================================================
-- Pet-Planet 시연용 데이터 (BE2) — 시연 시나리오 docs/07 에 맞춘 계정 · 반려동물 · 제휴 병원/호텔 · 상품 · 예약 · 주문 · 리뷰
-- 실행 순서: schema_full.sql → patch_v2_proposed.sql → seed_dev_places.sql → (이 파일) → (선택) db/loader 공공데이터 적재
-- 여러 번 실행해도 돼요. 이 파일이 만든 데이터와 schema_full.sql 의 옛 샘플만 지우고 다시 넣어요.
--
-- ⚠️ 병원·호텔·리뷰는 모두 "가상" 데이터예요 (실제 업체가 아님). 공공데이터로 넣은 실제 병원·호텔에는 리뷰를 넣지 않아요.
-- ⚠️ 계정 비밀번호는 '{plain}…' 으로 넣어요. 백엔드 서버를 한 번 켜면 BCrypt 로 바뀌어서 그때부터 로그인돼요.
--
-- 시연 계정 (비밀번호 모두 petplanet123!)
--   demo@petplanet.com     김펫러버  USER      반려동물 콩이(푸들 3.2kg) · 보리(진돗개 18kg) — 호텔 체중 검증 시연
--   partner@petplanet.com  홍대사장  BUSINESS  시연 병원 3곳 · 호텔 2곳의 사업자 (예약 승인)
--   admin@petplanet.com    관리자    ADMIN     배송 단계 변경
--   review1~3@petplanet.com                    다른 이용자 (병원·상품·장소 리뷰 작성자)
-- ============================================================================
USE petplanet;
SET NAMES utf8mb4;

-- ----------------------------------------------------------------------------
-- 0. 지우기 — 시연 계정(→ CASCADE 로 반려동물·찜·리뷰·장바구니·주문), schema_full 옛 샘플, 이 파일의 병원·호텔
-- ----------------------------------------------------------------------------
DELETE FROM users WHERE email IN (
    'demo@petplanet.com', 'partner@petplanet.com', 'admin@petplanet.com',
    'review1@petplanet.com', 'review2@petplanet.com', 'review3@petplanet.com',
    'user1@petplanet.com', 'business1@petplanet.com');

-- 병원·호텔: 이 파일과 schema_full 샘플만 (이름 + 주소로 골라서, 공공데이터 업체는 건드리지 않음)
DELETE FROM hospitals WHERE (name, address) IN (
    ('강남동물의료센터', '서울시 강남구 강남대로 500번지'),
    ('서울동물병원', '서울시 중구 을지로 100번지'),
    ('홍대 펫메디컬센터', '서울 마포구 양화로 000 (시연용)'),
    ('연남 우리동물병원', '서울 마포구 동교로 000 (시연용)'),
    ('신촌 해든 동물병원', '서울 서대문구 연세로 000 (시연용)'));
DELETE FROM pet_hotels WHERE (name, address) IN (
    ('펫라이프호텔', '서울시 강동구 천호대로 200번지'),
    ('럭셔리펫이웃', '서울시 송파구 올림픽로 150번지'),
    ('멍냥 스테이 홍대', '서울 마포구 와우산로 000 (시연용)'),
    ('포근 펫호텔 합정', '서울 마포구 토정로 000 (시연용)'));

-- 지운 병원의 리뷰 정리 (reviews.target_id 는 여러 테이블을 가리켜서 FK 가 없어요 → 직접 지워야 해요)
DELETE FROM reviews WHERE review_id > 0 AND target_type = 'HOSPITAL'
  AND target_id NOT IN (SELECT hospital_id FROM hospitals);

-- 상품은 시연용이 전부라 통째로 다시 넣어요 (order_items.product_id 는 SET NULL, cart_items 는 CASCADE)
DELETE FROM reviews WHERE review_id > 0 AND target_type = 'PRODUCT';
DELETE FROM products WHERE product_id > 0;
DELETE FROM product_categories WHERE category_id > 0;

-- ----------------------------------------------------------------------------
-- 1. 계정 · 반려동물
-- ----------------------------------------------------------------------------
INSERT INTO users (email, password, name, role) VALUES ('demo@petplanet.com', '{plain}petplanet123!', '김펫러버', 'USER');
SET @demo := LAST_INSERT_ID();
INSERT INTO users (email, password, name, role) VALUES ('partner@petplanet.com', '{plain}petplanet123!', '홍대사장', 'BUSINESS');
SET @partner := LAST_INSERT_ID();
INSERT INTO users (email, password, name, role) VALUES ('admin@petplanet.com', '{plain}petplanet123!', '관리자', 'ADMIN');
INSERT INTO users (email, password, name, role) VALUES ('review1@petplanet.com', '{plain}petplanet123!', '콩이맘', 'USER');
SET @r1 := LAST_INSERT_ID();
INSERT INTO users (email, password, name, role) VALUES ('review2@petplanet.com', '{plain}petplanet123!', '보리아빠', 'USER');
SET @r2 := LAST_INSERT_ID();
INSERT INTO users (email, password, name, role) VALUES ('review3@petplanet.com', '{plain}petplanet123!', '모카언니', 'USER');
SET @r3 := LAST_INSERT_ID();

INSERT INTO pets (user_id, name, breed, weight, gender, is_neutered) VALUES (@demo, '콩이', '푸들', 3.2, 'FEMALE', TRUE);
SET @kong := LAST_INSERT_ID();
INSERT INTO pets (user_id, name, breed, weight, gender, is_neutered) VALUES (@demo, '보리', '진돗개', 18.0, 'MALE', TRUE);
SET @bori := LAST_INSERT_ID();
INSERT INTO pets (user_id, name, breed, weight, gender, is_neutered) VALUES (@r1, '두부', '비숑 프리제', 6.2, 'MALE', TRUE);
SET @p1 := LAST_INSERT_ID();
INSERT INTO pets (user_id, name, breed, weight, gender, is_neutered) VALUES (@r2, '라떼', '골든 리트리버', 28.0, 'FEMALE', TRUE);
SET @p2 := LAST_INSERT_ID();
INSERT INTO pets (user_id, name, breed, weight, gender, is_neutered) VALUES (@r3, '모카', '웰시코기', 12.4, 'MALE', FALSE);
SET @p3 := LAST_INSERT_ID();

-- ----------------------------------------------------------------------------
-- 2. 제휴 동물병원 (가상) — 홍대입구·신촌 근처, 사업자 = partner
-- ----------------------------------------------------------------------------
INSERT INTO hospitals (user_id, name, address, phone, latitude, longitude, operating_hours, intro, departments, lunch_time) VALUES
(@partner, '홍대 펫메디컬센터', '서울 마포구 양화로 000 (시연용)', '02-000-0001', 37.5566000, 126.9228000,
 '평일 09:00-19:00 / 토 10:00-15:00 / 휴무: 일요일·공휴일',
 '내과·외과·피부과·치과 진료를 한 곳에서 받을 수 있는 시연용 제휴 동물병원이에요. 예약하면 대기 없이 진료받을 수 있어요.',
 '내과,외과,피부과,치과', '13:00-14:00');
SET @h1 := LAST_INSERT_ID();
INSERT INTO hospitals (user_id, name, address, phone, latitude, longitude, operating_hours, intro, departments, lunch_time) VALUES
(@partner, '연남 우리동물병원', '서울 마포구 동교로 000 (시연용)', '02-000-0002', 37.5610000, 126.9232000,
 '매일 10:00-20:00 / 휴무: 연중무휴',
 '소형견·고양이 진료에 강점이 있는 시연용 제휴 병원이에요. 예방접종과 건강검진 예약이 많아요.',
 '내과,예방접종,건강검진', '12:30-13:30');
SET @h2 := LAST_INSERT_ID();
INSERT INTO hospitals (user_id, name, address, phone, latitude, longitude, operating_hours, intro, departments, lunch_time) VALUES
(@partner, '신촌 해든 동물병원', '서울 서대문구 연세로 000 (시연용)', '02-000-0003', 37.5559000, 126.9375000,
 '평일 09:30-18:30 / 토 09:30-13:00 / 휴무: 일요일',
 '정형외과·안과 진료가 가능한 시연용 제휴 병원이에요.',
 '내과,외과,안과', '13:00-14:00');
SET @h3 := LAST_INSERT_ID();

-- ----------------------------------------------------------------------------
-- 3. 제휴 펫 호텔 (가상) + 객실 — docs/07: 미디엄 15kg / 라지 30kg
-- ----------------------------------------------------------------------------
INSERT INTO pet_hotels (user_id, name, address, phone, latitude, longitude) VALUES
(@partner, '멍냥 스테이 홍대', '서울 마포구 와우산로 000 (시연용)', '02-000-0101', 37.5585000, 126.9262000);
SET @t1 := LAST_INSERT_ID();
INSERT INTO pet_hotels (user_id, name, address, phone, latitude, longitude) VALUES
(@partner, '포근 펫호텔 합정', '서울 마포구 토정로 000 (시연용)', '02-000-0102', 37.5500000, 126.9150000);
SET @t2 := LAST_INSERT_ID();

INSERT INTO room_types (hotel_id, room_name, price_per_night, max_weight) VALUES (@t1, '미디엄 룸', 45000, 15);
SET @room_m := LAST_INSERT_ID();
INSERT INTO room_types (hotel_id, room_name, price_per_night, max_weight) VALUES (@t1, '라지 룸', 60000, 30);
SET @room_l := LAST_INSERT_ID();
INSERT INTO room_types (hotel_id, room_name, price_per_night, max_weight) VALUES (@t1, '스위트 룸', 90000, 40);
SET @room_s := LAST_INSERT_ID();
INSERT INTO room_types (hotel_id, room_name, price_per_night, max_weight) VALUES
(@t2, '스몰 룸', 35000, 7),
(@t2, '미디엄 룸', 48000, 15),
(@t2, '라지 룸', 65000, 30);

-- ----------------------------------------------------------------------------
-- 4. 상품 카테고리 4종 (합의 [10]) · 상품 — 재고 적음(2개)·품절(0개) 포함
-- ----------------------------------------------------------------------------
INSERT INTO product_categories (category_id, name) VALUES (1, '사료'), (2, '간식'), (3, '위생용품'), (4, '용품');

INSERT INTO products (product_id, category_id, name, price, stock_quantity, description) VALUES
(1, 1, '그레인프리 연어 사료 2kg', 32000, 24, '곡물을 뺀 연어 단일 단백질 사료. 알러지가 있는 아이에게 추천해요.'),
(2, 1, '소형견 저알러지 사료 1.5kg', 27000, 2, '작은 알갱이로 소형견이 먹기 쉬워요. (재고 적음 시연용)'),
(3, 1, '시니어 관절 케어 사료 3kg', 45000, 15, '글루코사민이 들어간 7세 이상 시니어용 사료예요.'),
(4, 2, '무첨가 닭가슴살 육포', 8500, 40, '닭가슴살 100%, 첨가물 없이 저온 건조했어요.'),
(5, 2, '덴탈 껌 15개입', 6900, 0, '하루 하나로 치석 관리. (품절 시연용)'),
(6, 2, '고구마 말랭이 200g', 7500, 30, '국내산 고구마를 쪄서 말렸어요.'),
(7, 3, '배변패드 100매', 15000, 60, '흡수력이 좋은 두꺼운 패드예요.'),
(8, 3, '저자극 샴푸 300ml', 12000, 18, '피부가 예민한 아이도 쓸 수 있는 약산성 샴푸예요.'),
(9, 3, '귀 세정제 120ml', 9800, 25, '산책 후 귀 청소용.'),
(10, 4, '지하철용 소프트 이동장', 49000, 12, '대중교통 규정에 맞춘 크기의 가벼운 이동장이에요.'),
(11, 4, '산책용 하네스 (소형)', 18000, 5, '가슴을 감싸는 H형 하네스.'),
(12, 4, '접이식 휴대 물병', 11000, 35, '산책·지하철 이동 중에 물을 줄 수 있는 휴대 물병이에요.');

-- ----------------------------------------------------------------------------
-- 5. 예약 — 날짜는 오늘 기준이라 언제 실행해도 시연이 돼요
-- ----------------------------------------------------------------------------
-- 시연 계정: 이용완료(→ 병원 리뷰 작성 가능) 1건 + 예약확정 1건
INSERT INTO hospital_reservations (user_id, hospital_id, pet_id, reservation_date, status) VALUES
(@demo, @h1, @kong, TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '14:00:00'), 'COMPLETED'),
(@demo, @h2, @bori, TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '10:30:00'), 'CONFIRMED');
-- 다른 이용자: 이용완료 (아래 병원 리뷰의 근거) + 내일 오후 마감된 시간 2칸 (S04 "줄 그은 시간" 시연)
INSERT INTO hospital_reservations (user_id, hospital_id, pet_id, reservation_date, status) VALUES
(@r1, @h1, @p1, TIMESTAMP(CURDATE() - INTERVAL 20 DAY, '11:00:00'), 'COMPLETED'),
(@r2, @h1, @p2, TIMESTAMP(CURDATE() - INTERVAL 15 DAY, '15:30:00'), 'COMPLETED'),
(@r3, @h1, @p3, TIMESTAMP(CURDATE() - INTERVAL 9 DAY, '10:00:00'), 'COMPLETED'),
(@r1, @h2, @p1, TIMESTAMP(CURDATE() - INTERVAL 12 DAY, '16:00:00'), 'COMPLETED'),
(@r2, @h1, @p2, TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '14:00:00'), 'CONFIRMED'),
(@r3, @h1, @p3, TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '15:00:00'), 'PENDING');

-- 호텔: 스위트 룸은 +2~+5일 예약확정 (→ 그 기간에 BOOKED), 라지 룸은 +10~+12일 승인대기
INSERT INTO hotel_reservations (user_id, room_id, pet_id, check_in_date, check_out_date, status) VALUES
(@r2, @room_s, @p2, CURDATE() + INTERVAL 2 DAY, CURDATE() + INTERVAL 5 DAY, 'CONFIRMED'),
(@r3, @room_l, @p3, CURDATE() + INTERVAL 10 DAY, CURDATE() + INTERVAL 12 DAY, 'PENDING'),
(@r1, @room_m, @p1, CURDATE() - INTERVAL 30 DAY, CURDATE() - INTERVAL 28 DAY, 'COMPLETED');

-- ----------------------------------------------------------------------------
-- 6. 주문 — 시연 계정: 배송완료 1건(→ 상품 리뷰 작성 가능) · 배송중 1건
-- ----------------------------------------------------------------------------
INSERT INTO orders (user_id, total_amount, receiver_name, receiver_phone, address, shipping_fee, status, created_at) VALUES
(@demo, 32000 + 49000 + 3000, '김펫러버', '010-1234-5678', '서울 마포구 양화로 000 (시연용)', 3000, 'DELIVERED', NOW() - INTERVAL 10 DAY);
SET @o1 := LAST_INSERT_ID();
INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (@o1, 1, 1, 32000), (@o1, 10, 1, 49000);

INSERT INTO orders (user_id, total_amount, receiver_name, receiver_phone, address, shipping_fee, status, created_at) VALUES
(@demo, 15000 * 2 + 3000, '김펫러버', '010-1234-5678', '서울 마포구 양화로 000 (시연용)', 3000, 'SHIPPING', NOW() - INTERVAL 1 DAY);
SET @o2 := LAST_INSERT_ID();
INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (@o2, 7, 2, 15000);

-- 다른 이용자: 배송완료 주문 (아래 상품 리뷰의 근거)
INSERT INTO orders (user_id, total_amount, receiver_name, receiver_phone, address, shipping_fee, status, created_at) VALUES
(@r1, 32000 + 8500 + 3000, '콩이맘', '010-0000-0001', '서울 마포구 (시연용)', 3000, 'DELIVERED', NOW() - INTERVAL 25 DAY);
SET @o3 := LAST_INSERT_ID();
INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (@o3, 1, 1, 32000), (@o3, 4, 1, 8500);
INSERT INTO orders (user_id, total_amount, receiver_name, receiver_phone, address, shipping_fee, status, created_at) VALUES
(@r2, 49000 + 7500 + 3000, '보리아빠', '010-0000-0002', '서울 마포구 (시연용)', 3000, 'DELIVERED', NOW() - INTERVAL 18 DAY);
SET @o4 := LAST_INSERT_ID();
INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (@o4, 10, 1, 49000), (@o4, 6, 1, 7500);

-- ----------------------------------------------------------------------------
-- 7. 리뷰 (모두 가상) — 병원 리뷰는 이용완료 예약이 있는 사람만, 상품 리뷰는 배송완료 주문이 있는 사람만
--    시연 계정은 리뷰를 비워 둬서, 발표 중에 직접 쓰는 장면을 보여줄 수 있어요 (병원 → 홍대 펫메디컬센터, 상품 → 연어 사료·이동장)
-- ----------------------------------------------------------------------------
INSERT INTO reviews (user_id, target_type, target_id, pet_id, rating, content, created_at) VALUES
(@r1, 'HOSPITAL', @h1, @p1, 5, '선생님이 차분하게 설명해 주셔서 믿음이 갔어요. 대기 없이 바로 진료받았어요.', NOW() - INTERVAL 19 DAY),
(@r2, 'HOSPITAL', @h1, @p2, 4, '예약 시간에 맞춰 진료받았어요. 대형견도 편하게 기다릴 공간이 있었어요.', NOW() - INTERVAL 14 DAY),
(@r3, 'HOSPITAL', @h1, @p3, 5, '피부 알레르기 치료를 꼼꼼하게 해 주셨어요. 다음 예약도 여기로 할게요.', NOW() - INTERVAL 8 DAY),
(@r1, 'HOSPITAL', @h2, @p1, 4, '예방접종 받으러 갔는데 친절했어요. 주차는 조금 불편해요.', NOW() - INTERVAL 11 DAY),
(@r1, 'PRODUCT', 1, @p1, 5, '알러지 있는 두부도 잘 먹어요. 변 상태도 좋아졌어요.', NOW() - INTERVAL 20 DAY),
(@r1, 'PRODUCT', 4, @p1, 4, '산책 보상 간식으로 딱이에요. 조금 딱딱해서 잘라서 줘요.', NOW() - INTERVAL 20 DAY),
(@r2, 'PRODUCT', 10, @p2, 5, '지하철 탈 때 들고 다니기 가볍고 튼튼해요. 소형견용으로 추천해요.', NOW() - INTERVAL 15 DAY),
(@r2, 'PRODUCT', 6, @p2, 4, '달지 않고 쫀득해서 잘 먹어요.', NOW() - INTERVAL 15 DAY),
-- 장소 리뷰 (seed_dev_places 의 홍대입구 근처 장소 1·3번)
(@r1, 'PLACE', 1, @p1, 5, '경의선숲길 산책하고 들르기 좋아요. 물그릇도 바로 챙겨 주세요.', NOW() - INTERVAL 6 DAY),
(@r2, 'PLACE', 1, @p2, 4, '대형견도 테라스석은 괜찮았어요. 주말엔 자리가 금방 차요.', NOW() - INTERVAL 4 DAY),
(@r3, 'PLACE', 3, @p3, 5, '소형견 쿠션 좌석이 있어서 편했어요. 디저트도 맛있어요.', NOW() - INTERVAL 2 DAY);

-- 시드 리뷰는 수정한 적 없게 (updated_at 을 직접 넣으면 ON UPDATE CURRENT_TIMESTAMP 가 덮어쓰지 않아요)
UPDATE reviews SET updated_at = created_at WHERE review_id > 0 AND user_id IN (@r1, @r2, @r3);
