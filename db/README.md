# db — MySQL 스크립트

> 2026-11-25: 지하철(`stations` · `place_stations`)을 지우고 버스 · 지역별 탐색으로 바꿨어요 → [docs/09_BUS_TRANSIT.md](../docs/09_BUS_TRANSIT.md)

| 파일 | 내용 | 작성 |
|---|---|---|
| `schema_full.sql` | 전체 19개 테이블 DDL + 샘플 데이터 (DB를 **새로 만들어요** — 기존 테이블 DROP) | BE1 원본 + 11/25 버스 테이블 |
| `patch_v2_proposed.sql` | 목업 화면에 맞춘 **수정 제안** (번호 = `docs/06_DB_DECISIONS.md` 번호) | FE1 제안 → BE1·BE2 확인 |
| `patch_be2_public_data.sql` | 공공데이터 적재용 칼럼 (`license_no`, `places.source_key`) | BE2 |
| `patch_bus_transit.sql` | 지하철 테이블 삭제 · 버스 테이블 · 지역(`sido`,`sigungu`) · 가까운 정류장 칼럼 | BE2 (11/25) |
| `seed_dev_places.sql` | 개발용 카테고리 4종 · 서울 가상 장소 32곳 | 프론트 목 서버와 같은 데이터 |
| `seed_demo.sql` | 시연 계정 · 제휴 병원/호텔 · 상품 · 예약 · 주문 · 리뷰 (가상) | BE2 |
| `loader/` | 공공데이터 적재기 (병원 · 호텔 · 동반 장소 · 버스 정류장) | BE2 |

## 실행 순서 (MySQL 8)

```bash
mysql -u root -p < db/schema_full.sql
mysql -u root -p < db/patch_v2_proposed.sql
mysql -u root -p < db/patch_be2_public_data.sql
mysql -u root -p < db/patch_bus_transit.sql
mysql -u root -p < db/seed_dev_places.sql
mysql -u root -p < db/seed_demo.sql
# 공공데이터 → db/loader/README.md
```
MySQL Workbench 라면 파일을 열고 ⚡(Execute) — safe update 모드에서도 돌아가게 `WHERE 키 > 0` 을 붙여 뒀어요.
이미 쓰던 DB 는 `patch_bus_transit.sql` 만 실행하면 돼요 (ALTER 는 두 번 실행하면 "Duplicate column" — 그 줄만 빼고).

## 주의

- 장소 시드는 **가상**이에요. 실제 장소는 적재기 `--places` 로 넣어요.
- 스키마를 바꾸면 `docs/06_DB_DECISIONS.md` 결정 칸과 `docs/04`·`05`·`09` API 명세도 같이 고쳐 주세요.

## 확인용 쿼리

```sql
-- 지역별 장소 수
SELECT sido, sigungu, COUNT(*) FROM places GROUP BY sido, sigungu ORDER BY sido, sigungu;

-- 전남 목포시 장소 + 가장 가까운 버스 정류장, 정류장 가까운 순
SELECT p.name, bs.name AS stop_name, p.nearest_stop_m, p.stops_500m
FROM places p LEFT JOIN bus_stops bs ON bs.stop_id = p.nearest_stop_id
WHERE p.sido = '전남' AND p.sigungu = '목포시'
ORDER BY p.nearest_stop_m IS NULL, p.nearest_stop_m;

-- 좌표 반경 500m 버스 정류장 (위·경도 범위로 먼저 좁혀 인덱스 사용)
SELECT stop_id, name, ROUND(ST_Distance_Sphere(POINT(longitude, latitude), POINT(126.3866, 34.7914))) AS dist_m
FROM bus_stops
WHERE latitude BETWEEN 34.7914 - 0.0045 AND 34.7914 + 0.0045
  AND longitude BETWEEN 126.3866 - 0.0055 AND 126.3866 + 0.0055
HAVING dist_m <= 500 ORDER BY dist_m;
```
