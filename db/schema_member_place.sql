-- ============================================================================
-- Pet-Planet Database Schema - Part A/B: Member & Place Domains
-- MySQL 8.0 / MariaDB 10.5+ Compatible
-- ============================================================================
-- Database: petplanet
-- Character Set: utf8mb4
-- Collation: utf8mb4_unicode_ci
-- ============================================================================

CREATE DATABASE IF NOT EXISTS petplanet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE petplanet;

-- Disable foreign key checks to allow proper table drop order
SET foreign_key_checks = 0;

-- ============================================================================
-- PART A: MEMBER DOMAIN (2 Tables)
-- ============================================================================

-- Drop order: child tables before parent tables (respecting FK dependencies)
-- 1. Drop place_bookmarks (references users, places)
-- 2. Drop place_stations (references places, stations)
-- 3. Drop pets (references users)
-- 4. Drop places (references place_categories)
-- 5. Drop place_categories (no dependencies)
-- 6. Drop stations (no dependencies)
-- 7. Drop users (no dependencies)

DROP TABLE IF EXISTS place_bookmarks;
DROP TABLE IF EXISTS place_stations;
DROP TABLE IF EXISTS pets;
DROP TABLE IF EXISTS places;
DROP TABLE IF EXISTS place_categories;
DROP TABLE IF EXISTS stations;
DROP TABLE IF EXISTS users;

-- Create order: parent tables before child tables (respecting FK dependencies)
-- 1. Create users (no dependencies)
-- 2. Create stations (no dependencies)
-- 3. Create place_categories (no dependencies)
-- 4. Create pets (references users)
-- 5. Create places (references place_categories)
-- 6. Create place_stations (references places, stations)
-- 7. Create place_bookmarks (references users, places)

-- 1. users Table
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
-- PART B: PLACE DOMAIN (5 Tables)
-- ============================================================================

-- 3. stations Table (지하철역)
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

-- 4. place_categories Table
CREATE TABLE place_categories (
    category_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '카테고리 ID',
    name VARCHAR(50) NOT NULL UNIQUE COMMENT '카테고리명',

    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='장소 카테고리';

-- 2. pets Table (references users - parent already created)
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

-- 5. places Table (references place_categories - parent already created)
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

-- 6. place_stations Table (N:M 관계 - 장소와 역, both parents already created)
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

-- 7. place_bookmarks Table (N:M 관계 - 사용자와 장소 북마크, both parents already created)
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

-- Re-enable foreign key checks
SET foreign_key_checks = 1;

-- ============================================================================
-- End of Member & Place Domain Schema
-- ============================================================================
