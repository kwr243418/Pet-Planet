-- ============================================================================
-- Pet-Planet Database Schema - Full (All 18 Tables with Seed Data)
-- MySQL 8.0 / MariaDB 10.5+ Compatible
-- ============================================================================
-- Database: petplanet
-- 6 Domains: Member, Place, Hospital, Pet Hotel, Shopping, Community
-- Character Set: utf8mb4
-- Collation: utf8mb4_unicode_ci
-- ============================================================================

CREATE DATABASE IF NOT EXISTS petplanet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE petplanet;

-- Disable foreign key checks to allow proper table drop order
SET foreign_key_checks = 0;

-- ============================================================================
-- DROP TABLE ORDER (Child tables before parent tables)
-- ============================================================================
-- Respecting foreign key dependencies for safe deletion

DROP TABLE IF EXISTS place_bookmarks;
DROP TABLE IF EXISTS place_stations;
DROP TABLE IF EXISTS hotel_reservations;
DROP TABLE IF EXISTS hospital_reservations;
DROP TABLE IF EXISTS room_types;
DROP TABLE IF EXISTS pet_hotels;
DROP TABLE IF EXISTS hospitals;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS pets;
DROP TABLE IF EXISTS places;
DROP TABLE IF EXISTS product_categories;
DROP TABLE IF EXISTS place_categories;
DROP TABLE IF EXISTS stations;
DROP TABLE IF EXISTS users;

-- ============================================================================
-- CREATE TABLE ORDER (Parent tables before child tables)
-- ============================================================================
-- Respecting foreign key dependencies for safe creation

-- ============================================================================
-- DOMAIN 1: MEMBER (2 Tables)
-- ============================================================================

CREATE TABLE users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '사용자 ID',
    email VARCHAR(100) NOT NULL UNIQUE COMMENT '이메일 (고유)',
    password VARCHAR(255) NOT NULL COMMENT '비밀번호',
    name VARCHAR(50) NOT NULL COMMENT '사용자명',
    role ENUM('USER','BUSINESS','ADMIN') DEFAULT 'USER' COMMENT '역할',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',

    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자';

-- ============================================================================
-- DOMAIN 2: PLACE (5 Tables) - Part 1: Base Tables
-- ============================================================================

CREATE TABLE stations (
    station_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '역 ID',
    name VARCHAR(50) NOT NULL COMMENT '역명',
    line VARCHAR(20) NOT NULL COMMENT '호선',
    latitude DECIMAL(10,7) NOT NULL COMMENT '위도',
    longitude DECIMAL(10,7) NOT NULL COMMENT '경도',

    INDEX idx_name (name),
    INDEX idx_line (line),
    INDEX idx_coordinates (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='지하철역';

CREATE TABLE place_categories (
    category_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '카테고리 ID',
    name VARCHAR(50) NOT NULL UNIQUE COMMENT '카테고리명',

    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='장소 카테고리';

-- ============================================================================
-- DOMAIN 5: SHOPPING (5 Tables) - Part 1: Base Tables
-- ============================================================================

CREATE TABLE product_categories (
    category_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '상품 카테고리 ID',
    name VARCHAR(50) NOT NULL UNIQUE COMMENT '카테고리명',

    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='상품 카테고리';

-- ============================================================================
-- MEMBER DOMAIN (Continued) - Part 2: Child Tables
-- ============================================================================

CREATE TABLE pets (
    pet_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '반려동물 ID',
    user_id BIGINT NOT NULL COMMENT '사용자 ID',
    name VARCHAR(50) NOT NULL COMMENT '펫 이름',
    breed VARCHAR(50) COMMENT '품종',
    weight DECIMAL(5,2) COMMENT '무게(kg)',
    gender ENUM('MALE','FEMALE') COMMENT '성별',
    is_neutered BOOLEAN DEFAULT FALSE COMMENT '중성화 여부',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',

    CONSTRAINT fk_pets_user_id FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,

    INDEX idx_user_id (user_id),
    INDEX idx_name (name),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='반려동물';

-- ============================================================================
-- PLACE DOMAIN (Continued) - Part 2: Child Tables
-- ============================================================================

CREATE TABLE places (
    place_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '장소 ID',
    category_id BIGINT COMMENT '카테고리 ID',
    name VARCHAR(100) NOT NULL COMMENT '장소명',
    address VARCHAR(255) NOT NULL COMMENT '주소',
    phone VARCHAR(20) COMMENT '전화번호',
    latitude DECIMAL(10,7) NOT NULL COMMENT '위도',
    longitude DECIMAL(10,7) NOT NULL COMMENT '경도',
    description TEXT COMMENT '설명',
    allowed_size VARCHAR(50) COMMENT '허용 크기',
    indoor_outdoor VARCHAR(50) COMMENT '실내/실외',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',

    CONSTRAINT fk_places_category_id FOREIGN KEY (category_id)
        REFERENCES place_categories(category_id) ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_category_id (category_id),
    INDEX idx_name (name),
    INDEX idx_coordinates (latitude, longitude),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='반려동물 동반 가능 장소';

-- ============================================================================
-- SHOPPING DOMAIN (Continued) - Part 2: Child Tables
-- ============================================================================

CREATE TABLE products (
    product_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '상품 ID',
    category_id BIGINT COMMENT '카테고리 ID',
    name VARCHAR(100) NOT NULL COMMENT '상품명',
    price INT NOT NULL COMMENT '가격',
    stock_quantity INT DEFAULT 0 COMMENT '재고 수량',
    description TEXT COMMENT '상품 설명',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',

    CONSTRAINT fk_products_category_id FOREIGN KEY (category_id)
        REFERENCES product_categories(category_id) ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_category_id (category_id),
    INDEX idx_name (name),
    INDEX idx_price (price),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='상품';

-- ============================================================================
-- DOMAIN 3: HOSPITAL (2 Tables)
-- ============================================================================

CREATE TABLE hospitals (
    hospital_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '동물병원 ID',
    user_id BIGINT COMMENT '사업자 사용자 ID',
    name VARCHAR(100) NOT NULL COMMENT '병원명',
    address VARCHAR(255) NOT NULL COMMENT '주소',
    phone VARCHAR(20) COMMENT '전화번호',
    latitude DECIMAL(10,7) NOT NULL COMMENT '위도',
    longitude DECIMAL(10,7) NOT NULL COMMENT '경도',
    operating_hours VARCHAR(255) COMMENT '운영시간',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',

    CONSTRAINT fk_hospitals_user_id FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_user_id (user_id),
    INDEX idx_name (name),
    INDEX idx_coordinates (latitude, longitude),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='동물병원';

-- ============================================================================
-- DOMAIN 4: PET HOTEL (3 Tables) - Part 1: Base Table
-- ============================================================================

CREATE TABLE pet_hotels (
    hotel_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '펫호텔 ID',
    user_id BIGINT COMMENT '사업자 사용자 ID',
    name VARCHAR(100) NOT NULL COMMENT '호텔명',
    address VARCHAR(255) NOT NULL COMMENT '주소',
    phone VARCHAR(20) COMMENT '전화번호',
    latitude DECIMAL(10,7) NOT NULL COMMENT '위도',
    longitude DECIMAL(10,7) NOT NULL COMMENT '경도',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',

    CONSTRAINT fk_pet_hotels_user_id FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_user_id (user_id),
    INDEX idx_name (name),
    INDEX idx_coordinates (latitude, longitude),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='펫호텔';

-- ============================================================================
-- PLACE DOMAIN (Continued) - Part 3: M2M Relationship Tables
-- ============================================================================

CREATE TABLE place_stations (
    mapping_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '매핑 ID',
    place_id BIGINT NOT NULL COMMENT '장소 ID',
    station_id BIGINT NOT NULL COMMENT '역 ID',
    distance_km DECIMAL(4,2) NOT NULL COMMENT '거리(km)',

    CONSTRAINT fk_place_stations_place_id FOREIGN KEY (place_id)
        REFERENCES places(place_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_place_stations_station_id FOREIGN KEY (station_id)
        REFERENCES stations(station_id) ON DELETE CASCADE ON UPDATE CASCADE,

    UNIQUE KEY uk_place_station (place_id, station_id),
    INDEX idx_station_id (station_id),
    INDEX idx_distance (distance_km)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='장소-역 매핑';

CREATE TABLE place_bookmarks (
    bookmark_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '북마크 ID',
    user_id BIGINT NOT NULL COMMENT '사용자 ID',
    place_id BIGINT NOT NULL COMMENT '장소 ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',

    CONSTRAINT fk_place_bookmarks_user_id FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_place_bookmarks_place_id FOREIGN KEY (place_id)
        REFERENCES places(place_id) ON DELETE CASCADE ON UPDATE CASCADE,

    UNIQUE KEY uk_user_place (user_id, place_id),
    INDEX idx_place_id (place_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='장소 북마크';

-- ============================================================================
-- PET HOTEL (Continued) - Part 2: Child Tables
-- ============================================================================

CREATE TABLE room_types (
    room_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '객실 타입 ID',
    hotel_id BIGINT NOT NULL COMMENT '펫호텔 ID',
    room_name VARCHAR(50) NOT NULL COMMENT '객실명',
    price_per_night DECIMAL(10,2) NOT NULL COMMENT '1박 요금',
    max_weight DECIMAL(5,2) COMMENT '최대 무게(kg)',

    CONSTRAINT fk_room_types_hotel_id FOREIGN KEY (hotel_id)
        REFERENCES pet_hotels(hotel_id) ON DELETE CASCADE ON UPDATE CASCADE,

    INDEX idx_hotel_id (hotel_id),
    INDEX idx_price (price_per_night)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='펫호텔 객실 타입';

CREATE TABLE hotel_reservations (
    reservation_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '예약 ID',
    user_id BIGINT COMMENT '사용자 ID',
    room_id BIGINT NOT NULL COMMENT '객실 타입 ID',
    pet_id BIGINT COMMENT '반려동물 ID',
    check_in_date DATE NOT NULL COMMENT '체크인 날짜',
    check_out_date DATE NOT NULL COMMENT '체크아웃 날짜',
    status ENUM('PENDING','CONFIRMED','CANCELLED','COMPLETED') DEFAULT 'PENDING' COMMENT '예약 상태',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',

    CONSTRAINT fk_hotel_reservations_user_id FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_hotel_reservations_room_id FOREIGN KEY (room_id)
        REFERENCES room_types(room_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_hotel_reservations_pet_id FOREIGN KEY (pet_id)
        REFERENCES pets(pet_id) ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_user_id (user_id),
    INDEX idx_room_id (room_id),
    INDEX idx_pet_id (pet_id),
    INDEX idx_status (status),
    INDEX idx_check_in (check_in_date),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='펫호텔 예약';

CREATE TABLE hospital_reservations (
    reservation_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '예약 ID',
    user_id BIGINT COMMENT '사용자 ID',
    hospital_id BIGINT NOT NULL COMMENT '동물병원 ID',
    pet_id BIGINT COMMENT '반려동물 ID',
    reservation_date DATETIME NOT NULL COMMENT '예약 일시',
    status ENUM('PENDING','CONFIRMED','CANCELLED','COMPLETED') DEFAULT 'PENDING' COMMENT '예약 상태',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',

    CONSTRAINT fk_hospital_reservations_user_id FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_hospital_reservations_hospital_id FOREIGN KEY (hospital_id)
        REFERENCES hospitals(hospital_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_hospital_reservations_pet_id FOREIGN KEY (pet_id)
        REFERENCES pets(pet_id) ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_user_id (user_id),
    INDEX idx_hospital_id (hospital_id),
    INDEX idx_pet_id (pet_id),
    INDEX idx_status (status),
    INDEX idx_reservation_date (reservation_date),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='동물병원 예약';

-- ============================================================================
-- SHOPPING DOMAIN (Continued) - Part 3: Child Tables
-- ============================================================================

CREATE TABLE orders (
    order_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '주문 ID',
    user_id BIGINT NOT NULL COMMENT '사용자 ID',
    total_amount INT NOT NULL COMMENT '주문 총액',
    status ENUM('PENDING','PAID','CANCELLED','SHIPPED') DEFAULT 'PENDING' COMMENT '주문 상태',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',

    CONSTRAINT fk_orders_user_id FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,

    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='주문';

CREATE TABLE order_items (
    order_item_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '주문 항목 ID',
    order_id BIGINT NOT NULL COMMENT '주문 ID',
    product_id BIGINT COMMENT '상품 ID',
    quantity INT NOT NULL COMMENT '수량',
    price INT NOT NULL COMMENT '구매 가격',

    CONSTRAINT fk_order_items_order_id FOREIGN KEY (order_id)
        REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_order_items_product_id FOREIGN KEY (product_id)
        REFERENCES products(product_id) ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_order_id (order_id),
    INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='주문 항목';

CREATE TABLE cart_items (
    cart_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '장바구니 항목 ID',
    user_id BIGINT NOT NULL COMMENT '사용자 ID',
    product_id BIGINT NOT NULL COMMENT '상품 ID',
    quantity INT DEFAULT 1 COMMENT '수량',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',

    CONSTRAINT fk_cart_items_user_id FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_cart_items_product_id FOREIGN KEY (product_id)
        REFERENCES products(product_id) ON DELETE CASCADE ON UPDATE CASCADE,

    INDEX idx_user_id (user_id),
    INDEX idx_product_id (product_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='장바구니';

-- ============================================================================
-- DOMAIN 6: COMMUNITY (1 Table)
-- ============================================================================

CREATE TABLE reviews (
    review_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '리뷰 ID',
    user_id BIGINT NOT NULL COMMENT '사용자 ID',
    target_type ENUM('PLACE','PRODUCT') NOT NULL COMMENT '대상 타입',
    target_id BIGINT NOT NULL COMMENT '대상 ID',
    rating TINYINT NOT NULL COMMENT '평점 (1-5)',
    content TEXT COMMENT '리뷰 내용',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',

    CONSTRAINT fk_reviews_user_id FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,

    INDEX idx_user_id (user_id),
    INDEX idx_target (target_type, target_id),
    INDEX idx_rating (rating),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='리뷰';

-- Re-enable foreign key checks
SET foreign_key_checks = 1;

-- ============================================================================
-- SEED DATA (Test Data)
-- ============================================================================

-- Users (3 records)
INSERT INTO users (email, password, name, role) VALUES
('user1@petplanet.com', 'hashed_password_1', '김펫러버', 'USER'),
('business1@petplanet.com', 'hashed_password_2', '펫호텔사업가', 'BUSINESS'),
('admin@petplanet.com', 'hashed_password_3', '관리자', 'ADMIN');

-- Pets (3 records)
INSERT INTO pets (user_id, name, breed, weight, gender, is_neutered) VALUES
(1, '뽀삐', '푸들', 5.50, 'FEMALE', TRUE),
(1, '초코', '골든리트리버', 28.00, 'MALE', FALSE),
(2, '뭉치', '시추', 3.20, 'MALE', TRUE);

-- Stations (3 records)
INSERT INTO stations (name, line, latitude, longitude) VALUES
('강남역', '2호선', 37.4979, 127.0276),
('서울역', '1호선', 37.5548, 126.9707),
('홍대입구역', '2호선', 37.5565, 126.9245);

-- Place Categories (3 records)
INSERT INTO place_categories (name) VALUES
('카페'),
('공원'),
('반려동물 용품점');

-- Places (3 records)
INSERT INTO places (category_id, name, address, phone, latitude, longitude, description, allowed_size, indoor_outdoor) VALUES
(1, '펫프렌들리카페', '서울시 강남구 강남대로 1번지', '02-1234-5678', 37.4979, 127.0276, '개와 고양이 모두 환영합니다', 'SMALL~LARGE', '실내'),
(2, '남산공원', '서울시 중구 남산공원길 105', '02-3783-5900', 37.5517, 126.9884, '산책로가 잘 정비되어 있습니다', 'ALL', '실외'),
(3, '펫랜드마트', '서울시 마포구 홍대로 50번지', '02-9876-5432', 37.5565, 126.9245, '펫 용품 종합판매점', 'N/A', '실내');

-- Place Stations (3 records)
INSERT INTO place_stations (place_id, station_id, distance_km) VALUES
(1, 1, 0.30),
(2, 2, 0.50),
(3, 3, 0.20);

-- Place Bookmarks (2 records)
INSERT INTO place_bookmarks (user_id, place_id) VALUES
(1, 1),
(1, 2);

-- Hospitals (2 records)
INSERT INTO hospitals (user_id, name, address, phone, latitude, longitude, operating_hours) VALUES
(2, '강남동물의료센터', '서울시 강남구 강남대로 500번지', '02-2000-1111', 37.4985, 127.0285, '09:00-20:00'),
(2, '서울동물병원', '서울시 중구 을지로 100번지', '02-3000-2222', 37.5540, 126.9700, '09:00-21:00');

-- Hospital Reservations (2 records)
INSERT INTO hospital_reservations (user_id, hospital_id, pet_id, reservation_date, status) VALUES
(1, 1, 1, '2026-11-15 14:00:00', 'CONFIRMED'),
(1, 2, 2, '2026-11-20 10:30:00', 'PENDING');

-- Pet Hotels (2 records)
INSERT INTO pet_hotels (user_id, name, address, phone, latitude, longitude) VALUES
(2, '펫라이프호텔', '서울시 강동구 천호대로 200번지', '02-4000-3333', 37.5300, 127.1200),
(2, '럭셔리펫이웃', '서울시 송파구 올림픽로 150번지', '02-5000-4444', 37.5130, 127.1080);

-- Room Types (3 records)
INSERT INTO room_types (hotel_id, room_name, price_per_night, max_weight) VALUES
(1, '스탠다드룸', 50000.00, 10.00),
(1, '프리미엄룸', 80000.00, 20.00),
(2, '로얄스위트', 120000.00, 30.00);

-- Hotel Reservations (2 records)
INSERT INTO hotel_reservations (user_id, room_id, pet_id, check_in_date, check_out_date, status) VALUES
(1, 1, 1, '2026-11-22', '2026-11-24', 'CONFIRMED'),
(1, 2, 2, '2026-11-25', '2026-11-27', 'PENDING');

-- Product Categories (3 records)
INSERT INTO product_categories (name) VALUES
('사료'),
('장난감'),
('의류');

-- Products (3 records)
INSERT INTO products (category_id, name, price, stock_quantity, description) VALUES
(1, '프리미엄 강아지 사료', 45000, 50, '영양 만점의 고급 사료'),
(2, '공 모양 장난감', 15000, 100, '스트레스 해소용 장난감'),
(3, '겨울 강아지 옷', 35000, 30, '따뜻한 겨울 옷');

-- Cart Items (2 records)
INSERT INTO cart_items (user_id, product_id, quantity) VALUES
(1, 1, 2),
(1, 2, 1);

-- Orders (2 records)
INSERT INTO orders (user_id, total_amount, status) VALUES
(1, 105000, 'PAID'),
(1, 80000, 'PENDING');

-- Order Items (3 records)
INSERT INTO order_items (order_id, product_id, quantity, price) VALUES
(1, 1, 2, 45000),
(1, 3, 1, 35000),
(2, 2, 1, 15000);

-- Reviews (3 records)
INSERT INTO reviews (user_id, target_type, target_id, rating, content) VALUES
(1, 'PLACE', 1, 5, '매우 친절하고 깨끗한 카페입니다. 강력 추천!'),
(1, 'PRODUCT', 1, 4, '사료의 질이 좋습니다. 가격이 조금 비싼 편입니다.'),
(1, 'PLACE', 2, 5, '남산공원은 산책하기 정말 좋습니다!');

-- ============================================================================
-- End of Full Database Schema with Seed Data
-- ============================================================================
