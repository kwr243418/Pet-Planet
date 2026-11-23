# db — MySQL 스크립트

| 파일 | 내용 | 작성 |
|---|---|---|
| `schema_full.sql` | 전체 18개 테이블 DDL + 샘플 데이터 (DB를 **새로 만들어요** — 기존 테이블 DROP) | BE1 (feature/be-user-place, 11/10) 원본 그대로 |
| `patch_v2_proposed.sql` | 목업 화면에 맞춘 **수정 제안** (번호 = `docs/06_DB_DECISIONS.md` 번호) | FE1 제안 → BE1·BE2 확인 필요 |
| `seed_dev_places.sql` | 개발용 지하철역 141행(노선 순서 포함) · 카테고리 4종 · 가상 장소 32곳 · 장소-역 매핑 | 프론트 목 서버와 같은 데이터 |

## 실행 순서 (MySQL 8)

```bash
mysql -u root -p < db/schema_full.sql
mysql -u root -p < db/patch_v2_proposed.sql     # 합의한 블록만 남기고
mysql -u root -p < db/seed_dev_places.sql        # patch 의 [1] stations.seq · [3] ENUM 이 먼저 필요
```
MySQL Workbench 라면 파일을 열고 ⚡(Execute) — safe update 모드에서도 돌아가게 `WHERE 키 > 0` 을 붙여 뒀어요.

## 주의

- `patch_v2_proposed.sql`·`seed_dev_places.sql` 은 MySQL 문법으로 작성했지만 **실제 MySQL 서버에서 아직 실행해 보지 않았어요.** 처음 돌릴 때 에러가 나면 그 블록만 고쳐 주세요.
- 장소 데이터는 **가상**이에요. 공공데이터 적재 스크립트가 준비되면 `seed_dev_places.sql` 대신 그걸로 채워요. (지하철역 좌표는 실제 근사값이라 계속 써도 돼요.)
- 스키마를 바꾸면 `docs/06_DB_DECISIONS.md` 결정 칸과 `docs/04`·`05` API 명세도 같이 고쳐 주세요.

## 확인용 쿼리

```sql
-- 2호선 노선도
SELECT seq, name FROM stations WHERE line = '2호선' ORDER BY seq;

-- 홍대입구(2호선) 반경 1km 장소, 가까운 순 → 0.30 / 0.57 / 0.71 / 0.89 / 0.96 km (5곳)
SELECT p.name, c.name AS category, p.allowed_size, p.indoor_outdoor, ps.distance_km
FROM place_stations ps
JOIN stations s ON s.station_id = ps.station_id
JOIN places p ON p.place_id = ps.place_id
JOIN place_categories c ON c.category_id = p.category_id
WHERE s.name = '홍대입구' AND s.line = '2호선'
ORDER BY ps.distance_km;
```
