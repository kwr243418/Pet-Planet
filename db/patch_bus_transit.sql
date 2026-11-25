-- ============================================================================
-- 지하철 → 버스 · 지역별 탐색 (2026-11-25, BE2) — 설명: docs/09_BUS_TRANSIT.md
-- 실행 순서: schema_full.sql → patch_v2_proposed.sql → patch_be2_public_data.sql → (이 파일)
--            → seed_dev_places.sql → seed_demo.sql → 적재기 (db/loader/README.md)
--
-- 1) 지하철 테이블(stations · place_stations)을 지워요.
-- 2) 버스 테이블(bus_stops · bus_routes · bus_route_stops)을 만들어요. (schema_full.sql 로 새로 만든 DB 에는 이미 있어요)
-- 3) places · hospitals · pet_hotels 에 지역(sido · sigungu)과 대중교통 접근성 칼럼을 더해요.
--    · sido / sigungu  : 주소 첫 두 단어 (전남광주 / 목포시) → 지역별 탐색 필터
--    · nearest_stop_id : 가장 가까운 버스 정류장 (적재기가 미리 계산)
--    · nearest_stop_m  : 그 정류장까지 직선거리(m)
--    · stops_500m      : 반경 500m 안 정류장 수
-- 4) 지금 들어 있는 행의 지역을 주소로 채워요. 정류장 칼럼은 적재기(--bus-stops / --access)가 채워요.
--
-- ⚠️ ALTER 는 두 번 실행하면 "Duplicate column" 에러가 나요. 이미 추가된 칼럼이면 그 줄만 빼고 실행하세요.
--    (적재기를 먼저 돌렸다면 적재기가 칼럼을 이미 만들었을 수 있어요)
-- ============================================================================
USE petplanet;

-- ----------------------------------------------------------------------------
-- 1) 지하철 테이블 삭제 (자식 → 부모 순서)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS place_stations;
DROP TABLE IF EXISTS stations;

-- ----------------------------------------------------------------------------
-- 2) 버스 테이블
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bus_stops (
    stop_id VARCHAR(30) PRIMARY KEY COMMENT '정류장 ID (국토교통부 정류장번호)',
    name VARCHAR(100) NOT NULL COMMENT '정류장명',
    latitude DECIMAL(10,7) NOT NULL COMMENT '위도',
    longitude DECIMAL(10,7) NOT NULL COMMENT '경도',
    city_code VARCHAR(10) COMMENT '도시코드 (실시간 도착정보 조회에 필요)',
    city_name VARCHAR(30) COMMENT '도시명',
    collected_at DATE COMMENT '정보 수집일',

    INDEX idx_bus_stops_coordinates (latitude, longitude),
    INDEX idx_bus_stops_city (city_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='버스 정류장';

CREATE TABLE IF NOT EXISTS bus_routes (
    route_id VARCHAR(30) PRIMARY KEY COMMENT '노선 ID',
    route_no VARCHAR(30) NOT NULL COMMENT '노선번호 (예: 1-2)',
    route_name VARCHAR(100) COMMENT '노선명',
    sido VARCHAR(20) COMMENT '시/도',
    sigungu VARCHAR(30) COMMENT '시/군/구',

    INDEX idx_bus_routes_region (sido, sigungu),
    INDEX idx_bus_routes_no (route_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='버스 노선';

CREATE TABLE IF NOT EXISTS bus_route_stops (
    route_id VARCHAR(30) NOT NULL COMMENT '노선 ID',
    stop_seq INT NOT NULL COMMENT '노선 안 정류장 순번',
    stop_id VARCHAR(30) NOT NULL COMMENT '정류장 ID',

    PRIMARY KEY (route_id, stop_seq),
    CONSTRAINT fk_bus_route_stops_route_id FOREIGN KEY (route_id)
        REFERENCES bus_routes(route_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bus_route_stops_stop_id FOREIGN KEY (stop_id)
        REFERENCES bus_stops(stop_id) ON DELETE CASCADE ON UPDATE CASCADE,

    INDEX idx_bus_route_stops_stop (stop_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='노선별 경유 정류장';

-- ----------------------------------------------------------------------------
-- 3) 지역 · 대중교통 접근성 칼럼
-- ----------------------------------------------------------------------------
ALTER TABLE places
    ADD COLUMN sido VARCHAR(20) NULL COMMENT '시/도 (짧은 이름: 서울 · 전남광주)' AFTER address,
    ADD COLUMN sigungu VARCHAR(30) NULL COMMENT '시/군/구 (목포시 · 무안군)' AFTER sido,
    ADD COLUMN nearest_stop_id VARCHAR(30) NULL COMMENT '가장 가까운 버스 정류장' AFTER longitude,
    ADD COLUMN nearest_stop_m INT NULL COMMENT '가장 가까운 정류장까지 직선거리(m)' AFTER nearest_stop_id,
    ADD COLUMN stops_500m SMALLINT NULL COMMENT '반경 500m 안 정류장 수' AFTER nearest_stop_m,
    ADD INDEX idx_places_region (sido, sigungu),
    ADD INDEX idx_places_stop_m (nearest_stop_m),
    ADD CONSTRAINT fk_places_nearest_stop FOREIGN KEY (nearest_stop_id)
        REFERENCES bus_stops(stop_id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE hospitals
    ADD COLUMN sido VARCHAR(20) NULL COMMENT '시/도 (짧은 이름: 서울 · 전남광주)' AFTER address,
    ADD COLUMN sigungu VARCHAR(30) NULL COMMENT '시/군/구 (목포시 · 무안군)' AFTER sido,
    ADD COLUMN nearest_stop_id VARCHAR(30) NULL COMMENT '가장 가까운 버스 정류장' AFTER longitude,
    ADD COLUMN nearest_stop_m INT NULL COMMENT '가장 가까운 정류장까지 직선거리(m)' AFTER nearest_stop_id,
    ADD COLUMN stops_500m SMALLINT NULL COMMENT '반경 500m 안 정류장 수' AFTER nearest_stop_m,
    ADD INDEX idx_hospitals_region (sido, sigungu),
    ADD CONSTRAINT fk_hospitals_nearest_stop FOREIGN KEY (nearest_stop_id)
        REFERENCES bus_stops(stop_id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE pet_hotels
    ADD COLUMN sido VARCHAR(20) NULL COMMENT '시/도 (짧은 이름: 서울 · 전남광주)' AFTER address,
    ADD COLUMN sigungu VARCHAR(30) NULL COMMENT '시/군/구 (목포시 · 무안군)' AFTER sido,
    ADD COLUMN nearest_stop_id VARCHAR(30) NULL COMMENT '가장 가까운 버스 정류장' AFTER longitude,
    ADD COLUMN nearest_stop_m INT NULL COMMENT '가장 가까운 정류장까지 직선거리(m)' AFTER nearest_stop_id,
    ADD COLUMN stops_500m SMALLINT NULL COMMENT '반경 500m 안 정류장 수' AFTER nearest_stop_m,
    ADD INDEX idx_pet_hotels_region (sido, sigungu),
    ADD CONSTRAINT fk_pet_hotels_nearest_stop FOREIGN KEY (nearest_stop_id)
        REFERENCES bus_stops(stop_id) ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 4) 지역 채우기: 주소 첫 단어 → 시/도 짧은 이름, 둘째 단어가 시·군·구로 끝나면 시/군/구
--    (적재기 --access 와 백엔드 Region.parse 가 같은 규칙이에요. 세종은 시/군/구가 없어서 '세종시')
-- ----------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS sido_alias;
CREATE TEMPORARY TABLE sido_alias (alias VARCHAR(20) PRIMARY KEY, sido VARCHAR(20) NOT NULL);
INSERT INTO sido_alias (alias, sido) VALUES
('서울특별시', '서울'), ('서울시', '서울'), ('서울', '서울'),
('부산광역시', '부산'), ('부산시', '부산'), ('부산', '부산'),
('대구광역시', '대구'), ('대구시', '대구'), ('대구', '대구'),
('인천광역시', '인천'), ('인천시', '인천'), ('인천', '인천'),
('대전광역시', '대전'), ('대전시', '대전'), ('대전', '대전'),
('울산광역시', '울산'), ('울산시', '울산'), ('울산', '울산'),
('세종특별자치시', '세종'), ('세종시', '세종'), ('세종', '세종'),
('경기도', '경기'), ('경기', '경기'),
('강원특별자치도', '강원'), ('강원도', '강원'), ('강원', '강원'),
('충청북도', '충북'), ('충북', '충북'),
('충청남도', '충남'), ('충남', '충남'),
('전북특별자치도', '전북'), ('전라북도', '전북'), ('전북', '전북'),
-- 2026-07-01 전남 · 광주 → 전남광주통합특별시 (예전 주소도 같은 지역)
('전남광주통합특별시', '전남광주'), ('전남광주특별시', '전남광주'), ('광주특별시', '전남광주'), ('전남광주', '전남광주'),
('전라남도', '전남광주'), ('전남', '전남광주'), ('광주광역시', '전남광주'), ('광주', '전남광주'),
('경상북도', '경북'), ('경북', '경북'),
('경상남도', '경남'), ('경남', '경남'),
('제주특별자치도', '제주'), ('제주도', '제주'), ('제주', '제주');

UPDATE places p JOIN sido_alias a ON a.alias = SUBSTRING_INDEX(TRIM(p.address), ' ', 1)
SET p.sido = a.sido,
    p.sigungu = CASE
        WHEN a.sido = '세종' THEN '세종시'
        WHEN SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(p.address), ' ', 2), ' ', -1) REGEXP '(시|군|구)$'
            THEN SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(p.address), ' ', 2), ' ', -1)
    END
WHERE p.place_id > 0;

UPDATE hospitals h JOIN sido_alias a ON a.alias = SUBSTRING_INDEX(TRIM(h.address), ' ', 1)
SET h.sido = a.sido,
    h.sigungu = CASE
        WHEN a.sido = '세종' THEN '세종시'
        WHEN SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(h.address), ' ', 2), ' ', -1) REGEXP '(시|군|구)$'
            THEN SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(h.address), ' ', 2), ' ', -1)
    END
WHERE h.hospital_id > 0;

UPDATE pet_hotels ht JOIN sido_alias a ON a.alias = SUBSTRING_INDEX(TRIM(ht.address), ' ', 1)
SET ht.sido = a.sido,
    ht.sigungu = CASE
        WHEN a.sido = '세종' THEN '세종시'
        WHEN SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(ht.address), ' ', 2), ' ', -1) REGEXP '(시|군|구)$'
            THEN SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(ht.address), ' ', 2), ' ', -1)
    END
WHERE ht.hotel_id > 0;

DROP TEMPORARY TABLE IF EXISTS sido_alias;

-- 확인
-- SELECT sido, sigungu, COUNT(*) FROM places GROUP BY sido, sigungu ORDER BY sido, sigungu;
-- SELECT COUNT(*) FROM bus_stops;
