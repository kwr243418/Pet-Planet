-- ============================================================================
-- Pet-Planet DB 수정 제안 v2 — 팀 목업 "화면별 필수 요소" 반영
-- 실행 순서: schema_full.sql → (이 파일) → seed_dev_places.sql
-- MySQL 8.0 기준
--
-- ⚠️ "제안"이에요. BE1·BE2가 docs/06_DB_DECISIONS.md 를 보고 항목별로 결정한 뒤,
--    채택한 항목은 schema_full.sql 에 합치고 이 파일은 지워도 돼요.
--    각 [번호]는 docs/06_DB_DECISIONS.md 의 번호와 같아요. 빼고 싶은 항목은 그 블록만 지우고 실행하세요.
-- ============================================================================
USE petplanet;

-- ----------------------------------------------------------------------------
-- [1] stations.seq — S02 노선도(당산–합정–홍대입구–신촌…)를 그리려면 노선 내 순서가 필요 (BE1)
-- ----------------------------------------------------------------------------
ALTER TABLE stations
    ADD COLUMN seq INT NULL COMMENT '노선 내 역 순서 (노선도 표시용)' AFTER line,
    ADD INDEX idx_line_seq (line, seq);

-- ----------------------------------------------------------------------------
-- [3] places.allowed_size / indoor_outdoor 값 고정 + [5] 대표 사진 (BE1)
--     지금은 VARCHAR 라 'SMALL~LARGE', 'ALL', '실내' 처럼 제각각 → 필터 SQL 이 어려움
--     기존 값을 먼저 정리한 뒤 ENUM 으로 바꿔요. (Workbench safe update 모드 대비 WHERE 키 조건)
-- ----------------------------------------------------------------------------
UPDATE places SET allowed_size = CASE
        WHEN allowed_size IN ('SMALL', 'MEDIUM', 'LARGE') THEN allowed_size
        WHEN allowed_size LIKE '%LARGE%' OR allowed_size IN ('ALL', '전체', '대형', '대형견') THEN 'LARGE'
        WHEN allowed_size LIKE '%MEDIUM%' OR allowed_size IN ('중형', '중형견') THEN 'MEDIUM'
        WHEN allowed_size LIKE '%SMALL%' OR allowed_size IN ('소형', '소형견') THEN 'SMALL'
        ELSE NULL
    END
WHERE place_id > 0;

UPDATE places SET indoor_outdoor = CASE
        WHEN indoor_outdoor IN ('INDOOR', 'OUTDOOR', 'BOTH') THEN indoor_outdoor
        WHEN indoor_outdoor IN ('실내외', '실내·외', '실내/실외', '실내외 모두', '모두') THEN 'BOTH'
        WHEN indoor_outdoor IN ('실내') THEN 'INDOOR'
        WHEN indoor_outdoor IN ('실외', '야외') THEN 'OUTDOOR'
        ELSE NULL
    END
WHERE place_id > 0;

ALTER TABLE places
    MODIFY allowed_size ENUM('SMALL', 'MEDIUM', 'LARGE') NULL COMMENT '동반 가능 최대 크기',
    MODIFY indoor_outdoor ENUM('INDOOR', 'OUTDOOR', 'BOTH') NULL COMMENT '동반 가능 공간',
    ADD COLUMN image_url VARCHAR(500) NULL COMMENT '대표 사진 URL (없으면 화면에서 카테고리 일러스트)' AFTER description;

-- ----------------------------------------------------------------------------
-- [6] pets — S09 필수값(이름·품종·체중·성별·중성화) NOT NULL + [5] 사진 (BE1)
--     photo_url: 프론트가 지금 240px 썸네일을 data URL(약 10~30KB)로 보내요.
--     이미지 업로드 API 를 만들면 VARCHAR(500) 로 바꾸면 돼요.
-- ----------------------------------------------------------------------------
ALTER TABLE pets
    MODIFY breed VARCHAR(50) NOT NULL COMMENT '품종',
    MODIFY weight DECIMAL(5,2) NOT NULL COMMENT '무게(kg) — 호텔 room_types.max_weight 검증',
    MODIFY gender ENUM('MALE', 'FEMALE') NOT NULL COMMENT '성별',
    MODIFY is_neutered BOOLEAN NOT NULL DEFAULT FALSE COMMENT '중성화 여부',
    ADD COLUMN photo_url MEDIUMTEXT NULL COMMENT '사진 (URL 또는 작은 썸네일 data URL)' AFTER is_neutered;

-- ----------------------------------------------------------------------------
-- [7] reviews — 병원 리뷰(S04-0), 리뷰의 반려동물 정보, 1인 1리뷰, 수정일시 (BE2)
--     UNIQUE 는 "같은 대상에 한 사람이 리뷰 1개". 병원을 여러 번 방문할 때마다 쓰게 하려면
--     uk_review_once 대신 reservation_id 칼럼을 두는 방식으로 바꿔야 해요 (합의 필요).
-- ----------------------------------------------------------------------------
ALTER TABLE reviews
    MODIFY target_type ENUM('PLACE', 'PRODUCT', 'HOSPITAL') NOT NULL COMMENT '대상 타입',
    ADD COLUMN pet_id BIGINT NULL COMMENT '함께 이용한 반려동물 (리뷰 카드의 품종·체중)' AFTER target_id,
    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시' AFTER created_at,
    ADD CONSTRAINT fk_reviews_pet_id FOREIGN KEY (pet_id)
        REFERENCES pets(pet_id) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD UNIQUE KEY uk_review_once (user_id, target_type, target_id);

-- ----------------------------------------------------------------------------
-- [8] orders — 목업 배송 노선(결제완료→배송준비→배송중→배송완료)과 상태값 맞추기 + 배송 정보 (BE2)
--     기존: PENDING / PAID / CANCELLED / SHIPPED → 제안: ORDERED / PREPARING / SHIPPING / DELIVERED / CANCELLED
--     기존 행을 옮기려고 잠깐 두 값을 모두 허용한 뒤 바꿔요.
-- ----------------------------------------------------------------------------
ALTER TABLE orders
    MODIFY status ENUM('PENDING', 'PAID', 'SHIPPED', 'ORDERED', 'PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED') DEFAULT 'ORDERED' COMMENT '주문 상태';

UPDATE orders SET status = CASE status
        WHEN 'PENDING' THEN 'ORDERED'
        WHEN 'PAID' THEN 'ORDERED'
        WHEN 'SHIPPED' THEN 'SHIPPING'
        ELSE status
    END
WHERE order_id > 0;

ALTER TABLE orders
    MODIFY status ENUM('ORDERED', 'PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'ORDERED' COMMENT '주문 상태',
    ADD COLUMN receiver_name VARCHAR(50) NULL COMMENT '받는 분' AFTER total_amount,
    ADD COLUMN receiver_phone VARCHAR(20) NULL COMMENT '연락처' AFTER receiver_name,
    ADD COLUMN address VARCHAR(255) NULL COMMENT '배송 주소' AFTER receiver_phone,
    ADD COLUMN shipping_fee INT NOT NULL DEFAULT 0 COMMENT '배송비' AFTER address;

-- ----------------------------------------------------------------------------
-- [9] cart_items — "같은 상품을 다시 담으면 수량이 합쳐져요" (S06) (BE2)
--     INSERT ... ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity) 로 구현 가능
-- ----------------------------------------------------------------------------
ALTER TABLE cart_items
    ADD UNIQUE KEY uk_cart_user_product (user_id, product_id);

-- ----------------------------------------------------------------------------
-- [5] products 이미지 + [10] 상품 카테고리 (S06: 전체·사료·간식·위생용품·용품) (BE2)
--     기존 '장난감'·'의류' 정리(용품으로 합칠지)는 BE2 가 결정하고 상품 category_id 도 같이 옮겨 주세요.
-- ----------------------------------------------------------------------------
ALTER TABLE products
    ADD COLUMN image_url VARCHAR(500) NULL COMMENT '상품 이미지 URL' AFTER description;

INSERT IGNORE INTO product_categories (name) VALUES ('사료'), ('간식'), ('위생용품'), ('용품');

-- ----------------------------------------------------------------------------
-- [11] hospitals — S04-0 소개 탭(병원 소개·진료 과목·점심시간). 화면에서 빼기로 하면 이 블록 삭제 (BE2)
-- ----------------------------------------------------------------------------
ALTER TABLE hospitals
    ADD COLUMN intro TEXT NULL COMMENT '병원 소개' AFTER operating_hours,
    ADD COLUMN departments VARCHAR(255) NULL COMMENT '진료 과목 (쉼표 구분)' AFTER intro,
    ADD COLUMN lunch_time VARCHAR(50) NULL COMMENT '점심시간 (예: 13:00-14:00)' AFTER departments;

-- ----------------------------------------------------------------------------
-- [12][13] 예약 중복 검사용 인덱스 (BE2)
--     병원: 같은 병원·같은 일시 예약이 있으면 '마감' / 호텔: 같은 객실·겹치는 기간 확인
-- ----------------------------------------------------------------------------
ALTER TABLE hospital_reservations
    ADD INDEX idx_hospital_time (hospital_id, reservation_date);

ALTER TABLE hotel_reservations
    ADD INDEX idx_room_period (room_id, check_in_date, check_out_date);

-- ============================================================================
-- End of patch v2 (proposed)
-- ============================================================================
