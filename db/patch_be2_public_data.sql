-- ============================================================================
-- BE2 공공데이터 적재용 칼럼 추가 (hospitals, pet_hotels)
-- db/loader/PublicDataLoader.java 가 실행할 때 없으면 자동으로 추가해요.
-- 이 파일은 --sql-out 으로 만든 SQL 을 직접 실행할 때, 그리고 ERD·문서 기준용이에요.
-- 실행 순서: schema_full.sql → patch_v2_proposed.sql → (이 파일)
-- ⚠️ 이미 칼럼이 있으면 "Duplicate column" 에러가 나요 → 그 줄만 빼고 실행하세요.
-- ============================================================================
USE petplanet;

-- license_no: 공공데이터 인허가 관리번호 (18자리, 예: 300000001019950002)
--   · hospital_id / hotel_id(대리키)는 그대로 두고, 관리번호(자연키)는 따로 UNIQUE 로 저장
--   · 다시 적재해도 관리번호로 같은 업체를 찾아 갱신 → 중복 없음
--   · 직접 넣은 시연용 업체는 NULL (UNIQUE 는 NULL 끼리 충돌하지 않아요)
-- 영업시간·휴무일은 기존 hospitals.operating_hours 한 칸에 "월~금 10:00~20:00 / 휴무: 매주 일요일" 형태로 저장
ALTER TABLE hospitals
    ADD COLUMN license_no VARCHAR(20) NULL COMMENT '공공데이터 인허가 관리번호 (직접 넣은 업체는 NULL)' AFTER user_id,
    ADD UNIQUE KEY uk_hospitals_license_no (license_no);

ALTER TABLE pet_hotels
    ADD COLUMN license_no VARCHAR(20) NULL COMMENT '공공데이터 인허가 관리번호 (직접 넣은 업체는 NULL)' AFTER user_id,
    ADD UNIQUE KEY uk_pet_hotels_license_no (license_no);

-- ----------------------------------------------------------------------------
-- 주변 탐색용 동반 장소 (PublicDataLoader --kcisa kcisa.csv --places)
-- source_key: MD5(시설명|주소) — 한국문화정보원 데이터에는 관리번호가 없어서 이름+주소로 같은 시설을 찾아요
--   · 다시 적재해도 중복 없이 갱신 · 직접 넣은 시연용 장소(seed_dev_places.sql)는 NULL
-- ⚠️ seed_dev_places.sql 은 places 를 모두 지우고 다시 넣어요 → 적재기는 seed 다음에 실행하세요.
-- ----------------------------------------------------------------------------
ALTER TABLE places
    ADD COLUMN source_key CHAR(32) NULL COMMENT '공공데이터 출처 키 MD5(시설명|주소) (직접 넣은 장소는 NULL)' AFTER indoor_outdoor,
    ADD UNIQUE KEY uk_places_source_key (source_key);

-- 한국문화정보원 카테고리 → 우리 카테고리: 카페 · 식당 · 숙소(펜션·호텔) · 여행지 · 문화시설(박물관·미술관·문예회관)
INSERT IGNORE INTO place_categories (name) VALUES ('여행지'), ('문화시설');
