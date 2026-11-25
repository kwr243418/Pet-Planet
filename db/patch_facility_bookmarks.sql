-- ============================================================================
-- 동물병원 · 펫호텔 찜 (2026-11-25, BE2)
-- 실행 순서: … → patch_bus_transit.sql → (이 파일) → seed_dev_places.sql → seed_demo.sql
--           schema_full.sql 로 새로 만든 DB 에는 이미 있어요 (IF NOT EXISTS 라 다시 실행해도 괜찮아요)
--
-- place_bookmarks 와 같은 N:M 구조예요.
--   · UNIQUE(user_id, 대상 ID) → 같은 곳을 두 번 찜하면 DB가 막고, API는 409 DUPLICATE_BOOKMARK
--   · 회원 탈퇴 · 병원/호텔 삭제 시 함께 지워져요 (ON DELETE CASCADE)
--
-- 마이페이지 "최근 예약한 병원 · 호텔" 은 새 테이블 없이 hospital_reservations · hotel_reservations 를
-- GROUP BY 로 묶어서 만들어요 (backend: FacilityService.recent)
-- ============================================================================
USE petplanet;

CREATE TABLE IF NOT EXISTS hospital_bookmarks (
    bookmark_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '찜 ID',
    user_id BIGINT NOT NULL COMMENT '사용자 ID',
    hospital_id BIGINT NOT NULL COMMENT '동물병원 ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '찜한 일시',

    CONSTRAINT fk_hospital_bookmarks_user_id FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_hospital_bookmarks_hospital_id FOREIGN KEY (hospital_id)
        REFERENCES hospitals(hospital_id) ON DELETE CASCADE ON UPDATE CASCADE,

    UNIQUE KEY uk_user_hospital (user_id, hospital_id),
    INDEX idx_hospital_bookmarks_hospital (hospital_id),
    INDEX idx_hospital_bookmarks_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='동물병원 찜';

CREATE TABLE IF NOT EXISTS hotel_bookmarks (
    bookmark_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '찜 ID',
    user_id BIGINT NOT NULL COMMENT '사용자 ID',
    hotel_id BIGINT NOT NULL COMMENT '펫호텔 ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '찜한 일시',

    CONSTRAINT fk_hotel_bookmarks_user_id FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_hotel_bookmarks_hotel_id FOREIGN KEY (hotel_id)
        REFERENCES pet_hotels(hotel_id) ON DELETE CASCADE ON UPDATE CASCADE,

    UNIQUE KEY uk_user_hotel (user_id, hotel_id),
    INDEX idx_hotel_bookmarks_hotel (hotel_id),
    INDEX idx_hotel_bookmarks_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='펫호텔 찜';

-- 확인
-- SHOW CREATE TABLE hospital_bookmarks;
-- SELECT COUNT(*) FROM hospital_bookmarks; SELECT COUNT(*) FROM hotel_bookmarks;
