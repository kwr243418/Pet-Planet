# PublicDataLoader — 동물병원 · 펫호텔 공공데이터 적재 (BE2)

행정안전부 인허가 CSV에서 **영업 중인 업체 전국 전체**를 골라 `hospitals`, `pet_hotels`에 저장해요.
병원은 한국문화정보원 데이터에 같은 업체가 있으면 **영업시간 · 휴무일**을 `operating_hours` 한 칸에
`월~금 10:00~20:00 / 휴무: 매주 일요일` 처럼 합쳐 저장해요. 호텔은 영업시간을 저장하지 않아요.

| 단계 | 내용 |
|---|---|
| 필터 | `영업상태명 = 영업/정상` 만. 좌표가 없는 행은 위도·경도가 NOT NULL 이라 건너뜀 |
| 좌표 | EPSG:5174(보정계수 없는 Bessel 중부원점 TM) → WGS84 위도·경도 (카카오맵 좌표) |
| 영업시간 매칭 (병원만) | ① 이름이 같고 150m 이내 ② 도로명주소가 같고 이름이 서로 포함되며 300m 이내 → 가장 가까운 곳 |
| 저장 | `license_no`(인허가 관리번호) 기준 UPSERT — 여러 번 실행해도 중복 없음, 테이블마다 한 트랜잭션 |

## 준비물

1. **Java 11 이상** — `java -version` 으로 확인
2. **MySQL JDBC 드라이버** — 이 폴더에 받기
   ```bash
   curl -O https://repo1.maven.org/maven2/com/mysql/mysql-connector-j/9.1.0/mysql-connector-j-9.1.0.jar
   ```
3. **데이터 CSV 3개** — 이 폴더에 두기 (`.gitignore` 로 커밋 안 됨)

   | 파일 | 출처 |
   |---|---|
   | 동물병원 인허가 | https://www.data.go.kr/data/15155679/standard.do |
   | 동물위탁관리업 인허가 | https://www.data.go.kr/data/15107029/fileData.do |
   | 한국문화정보원 반려동물 동반 가능 문화시설 (병원 영업시간용) | https://www.data.go.kr/data/15111389/fileData.do |

## 실행

```bash
cd db/loader

# 1) 먼저 DB 없이 결과만 확인
java -cp mysql-connector-j-9.1.0.jar PublicDataLoader.java \
     --hospital 동물병원.csv --hotel 동물위탁관리업.csv --kcisa 한국문화정보원.csv --dry-run

# 2) DB 에 저장 — 주소 · 포트 · DB 이름 · 아이디 · 비밀번호를 물어봐요
java -cp mysql-connector-j-9.1.0.jar PublicDataLoader.java \
     --hospital 동물병원.csv --hotel 동물위탁관리업.csv --kcisa 한국문화정보원.csv
```

- 파일 이름은 실제 받은 이름으로 바꿔 주세요. 한글·공백이 있으면 `"…"` 로 감싸기.
  `InvalidPathException: Malformed input` 이 나오면 파일 이름을 영어로 바꿔 주세요 (예: `hospital.csv`).
- 접속 정보를 미리 줄 수도 있어요: `--host 1.2.3.4 --port 3306 --db petplanet --user be2` (비밀번호는 항상 입력)
- DB 에 바로 넣기 어려우면 `--sql-out public_data.sql` 로 SQL 파일을 만들고, `db/patch_be2_public_data.sql` 실행 후 그 파일을 실행하면 돼요.
- 실행하면 `hospitals.license_no`, `pet_hotels.license_no` 칼럼(UNIQUE)이 없을 때 자동으로 추가돼요 (`db/patch_be2_public_data.sql` 과 같은 내용).
  `hospital_id` · `hotel_id` 는 그대로 AUTO_INCREMENT 예요. 관리번호(18자리)는 자바스크립트 숫자 범위를 넘어서 PK·API ID 로 쓰지 않아요.

## 주변 탐색용 동반 장소 적재 (`--places`, 11/25 추가)

한국문화정보원 파일에서 **반려동물 동반 가능 = Y** 인 카페 · 식당 · 숙소(펜션·호텔) · 여행지 · 문화시설(박물관·미술관·문예회관)을 `places`에 넣어요.
약국 · 병원 · 용품 · 미용 · 위탁은 "장소"가 아니라 넣지 않아요. (11/25 지하철 매핑은 없앴고, 가까운 버스 정류장은 아래 `--bus-stops` / `--access` 가 계산해요.)

```bash
cd db/loader
java -cp mysql-connector-j-9.1.0.jar PublicDataLoader.java --kcisa kcisa.csv --places --dry-run   # 결과만 확인
java -cp mysql-connector-j-9.1.0.jar PublicDataLoader.java --kcisa kcisa.csv --places             # DB 저장
```

- 같은 시설은 `places.source_key` = MD5(시설명|주소)로 찾아 갱신해요 (여러 번 실행해도 중복 없음).
- 카테고리 `여행지`, `문화시설`이 없으면 자동으로 추가돼요.
- 입장 가능 크기 → `allowed_size`(SMALL · MEDIUM · LARGE), 실내/실외 여부 → `indoor_outdoor`(INDOOR · OUTDOOR · BOTH).
- ⚠️ `seed_dev_places.sql`은 places를 모두 지우고 다시 넣어요 → **seed 다음에** 적재기를 실행하세요.
- 11/25 받은 파일 기준: 동반 가능 67,839행 중 장소 카테고리 약 2,380곳, 목포시 · 무안군 19곳(카페 5 · 여행지 13 · 펜션 1).

## 버스 정류장 적재 (`--bus-stops`) · 지역 · 가까운 정류장 계산 (`--access`) — 11/25 추가

지하철을 버리고 버스로 바꿨어요 ([docs/09_BUS_TRANSIT.md](../../docs/09_BUS_TRANSIT.md)).

1. 공공데이터포털에서 **국토교통부_전국 버스정류장 위치정보** CSV 를 받아 이 폴더에 `bus_stops.csv` 로 두기 (로그인 없이 다운로드, 약 20만 행)
2. 먼저 dry-run 으로 확인 — 칼럼 이름 · 서울 포함 여부 · 목포역/국립목포대학교 근처 정류장 · 목포/무안 동반 장소 등급이 나와요
   ```bash
   java -cp mysql-connector-j-9.1.0.jar PublicDataLoader.java --bus-stops bus_stops.csv --kcisa kcisa.csv --places --dry-run
   ```
3. DB 저장 — 정류장 저장 뒤 places · hospitals · pet_hotels 의 지역(`sido`, `sigungu`)과 가장 가까운 정류장(`nearest_stop_id`, `nearest_stop_m`, `stops_500m`)을 다시 계산해요
   ```bash
   java -cp mysql-connector-j-9.1.0.jar PublicDataLoader.java --bus-stops bus_stops.csv
   ```

- 칼럼 · 테이블이 없으면 적재기가 만들어요 (`db/patch_bus_transit.sql` 과 같은 내용, 여러 번 실행해도 안전). 단, 지하철 테이블 삭제는 패치 SQL 로만 해요.
- 정류장 ID(`정류장번호`) 기준 UPSERT → 다시 실행해도 중복 없음. 칼럼 이름이 조금 달라도(`정류소명`, `GPS_LATI` …) 찾아요.
- 장소 · 병원 · 호텔을 새로 넣으면(`--hospital` · `--hotel` · `--places`) 지역 · 가까운 정류장 계산도 자동으로 해요. 따로 다시 하려면 `--access`.
- 가장 가까운 정류장은 2km 안에서만 찾아요. 0.01° 격자로 나눠 두고 주변 칸만 봐서 몇 초면 끝나요.
- `--bus-routes`(버스노선별 경유정류장 API)는 활용 가이드 PDF 의 요청 형식을 확인한 뒤 추가할 예정이에요.

## 결과 (2026-11-24 받은 파일 기준, dry-run)

| | 전체 행 | 저장 | 영업 아님 | 좌표 없음 | 한국문화정보원 매칭 | 영업시간 있음 |
|---|---|---|---|---|---|---|
| 병원 | 10,676 | **5,268** | 5,174 | 234 | 3,387 | **2,626** |
| 호텔(위탁관리업) | 10,169 | **5,776** | 4,100 | 293 | – | – (저장 안 함) |

- 좌표 검증: 같은 이름의 병원 3,901곳을 한국문화정보원 WGS84 좌표와 비교 → 거리 중앙값 4.6m
- 위탁관리업 주소는 원본에서 상세 주소가 `*` 로 가려져 있어요 (개인정보 비식별 조치)
- 위탁관리업에는 호텔링을 하는 **동물병원·미용실·애견카페도 포함**돼요 (법적으로 같은 업종)
- 진료과목 · 소개 · 점심시간 · 객실 정보는 공공데이터에 없어서 비워 둬요 → 시연 업체만 직접 입력
