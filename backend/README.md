# backend — 펫플래닛 API 서버

**Spring Boot 3.4 · Java 17 · JdbcTemplate(SQL 직접 작성) · MySQL 8**
JPA 를 쓰지 않고 SQL 을 직접 써서 쿼리를 그대로 보여줄 수 있어요 → [docs/08_SQL_QUERIES.md](../docs/08_SQL_QUERIES.md)

## 실행

### 1. DB 준비 (MySQL 8)

```bash
cd ..   # 레포 루트
mysql -u root -p < db/schema_full.sql               # 21개 테이블 (+ 옛 샘플) ⚠️ 기존 테이블을 DROP 해요
mysql -u root -p < db/patch_v2_proposed.sql         # 화면에 맞춘 칼럼·ENUM·UNIQUE (docs/06 합의 1~13)
mysql -u root -p < db/patch_be2_public_data.sql     # hospitals·pet_hotels.license_no, places.source_key (합의 14)
mysql -u root -p < db/patch_bus_transit.sql         # 지하철 테이블 삭제 · 버스 테이블 · 지역/정류장 칼럼 (docs/09)
mysql -u root -p < db/patch_facility_bookmarks.sql  # 병원 · 호텔 찜 (docs/05 §9)
mysql -u root -p < db/seed_dev_places.sql           # 개발용 장소 32곳 (서울, 가상)
mysql -u root -p < db/seed_demo.sql                 # 시연 계정 · 제휴 병원/호텔(목포, 가상) · 상품 · 예약 · 주문 · 리뷰 · 찜
# (선택) 전국 동물병원 · 펫호텔 · 동반 장소 · 버스 정류장 공공데이터: db/loader/README.md
```
- 원격 DB 면 `mysql -h 주소 -P 포트 -u 계정 -p < …`
- **이미 쓰던 DB** 는 처음 3줄을 건너뛰고 `patch_bus_transit` → `patch_facility_bookmarks` → `seed_demo` 만 실행하면 돼요.
- Mac 에서 `mysql` 이 `Authentication plugin 'caching_sha2_password' cannot be loaded` 를 내면 conda(miniconda) 의 옛 mysql 이 잡힌 거예요 → `/usr/local/bin/mysql`(Homebrew: `/opt/homebrew/bin/mysql`)로 실행하거나 `echo 'alias mysql=/usr/local/bin/mysql' >> ~/.zshrc`

### 2. DB 접속 정보

```bash
cp src/main/resources/application-local.yml.example src/main/resources/application-local.yml
# application-local.yml 에 url · username · password 입력 (이 파일은 커밋되지 않아요)
```
- MySQL 8 이상이면 url 끝에 `&allowPublicKeyRetrieval=true&useSSL=false` 를 붙여요 (안 붙이면 `Public Key Retrieval is not allowed`).
- `application-local.yml` 이 **없을 때만** 환경변수 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` 가 쓰여요. 파일이 있으면 아래처럼 `SPRING_DATASOURCE_*` 로 덮어써요.

#### 팀 공용 DB 로 켜기 (파일 수정 없이 그때만)

```bash
SPRING_DATASOURCE_URL='jdbc:mysql://<팀DB주소>:3306/petplanet?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8' \
SPRING_DATASOURCE_USERNAME=<내 팀DB 계정> SPRING_DATASOURCE_PASSWORD='<팀DB 비밀번호>' ./gradlew bootRun
```
- 팀 DB 주소 · 계정 · 비밀번호는 **단톡방으로만** 받아요 (레포 · 문서에 적지 않기).
- 팀 DB 에 연결된 동안 만든 예약 · 찜 · 주문은 공용 데이터에 그대로 저장돼요. 끝나면 `Ctrl + C` 후 평소처럼 `./gradlew bootRun` 으로 로컬 DB 에 돌아와요.

#### 비밀번호가 세 가지라 헷갈려요

| 비밀번호 | 어디에 |
|---|---|
| 팀 DB 계정 비밀번호 | 팀 DB 에 SQL 실행 (`mysql -h <팀DB주소> -u <계정> -p`), 적재기, 위 `SPRING_DATASOURCE_PASSWORD` |
| 내 컴퓨터 MySQL `root` 비밀번호 | 로컬 DB 에 SQL 실행 (`mysql -u root -p`), `application-local.yml` |
| `petplanet123!` | 웹사이트 시연 계정 로그인 (`demo@petplanet.kr` 등) |

### 3. 서버 켜기

```bash
./gradlew bootRun          # Windows: gradlew.bat bootRun
```
- 처음 한 번은 Gradle·라이브러리를 내려받느라 몇 분 걸려요. `http://localhost:8080/api/regions` 가 열리면 성공.
- **서버를 한 번 켜야** 시드 계정 비밀번호(`{plain}…`)가 BCrypt 로 바뀌어서 로그인돼요.
- 테스트: `./gradlew test` (DB 없이 도는 단위 테스트)

### 4. 프론트엔드를 실제 API 에 연결

```bash
cd ../frontend
echo "VITE_USE_MOCK=false" > .env.local
npm run dev      # /api 요청이 localhost:8080 으로 프록시돼요 (vite.config.js)
```

## 시연 계정 (db/seed_demo.sql, 비밀번호 모두 `petplanet123!`)

| 이메일 | 역할 | 용도 |
|---|---|---|
| `demo@petplanet.kr` | USER | 반려동물 콩이 3.2kg · 보리 18kg, 이용완료 병원 예약·배송완료 주문 1건씩 (리뷰 작성 시연) |
| `partner@petplanet.kr` | BUSINESS | 시연 병원 3곳·호텔 2곳(목포 하당 · 옥암 · 용해, 가상) 사업자 → 예약 승인 `PATCH …/status` |
| `admin@petplanet.kr` | ADMIN | 배송 단계 변경 `PATCH /api/orders/{id}/status` |

`application.yml` 의 `petplanet.demo-mode: true` 면 예약·주문한 **본인도** 상태를 한 단계씩 올릴 수 있어요 (마이페이지 "(시연) 다음 상태로" 버튼).

## 구조

```
src/main/java/com/petplanet/
├── common/        공통 에러(ApiException → { status, code, message, errors }), 페이지, 날짜, 거리
├── auth/          JWT(HS256, JDK 만으로 구현) · 인터셉터 — Authorization: Bearer …
├── config/        CORS · BCrypt · 시드 비밀번호 변환
├── user/          회원가입(계정+반려동물 트랜잭션) · 로그인 · 내 정보 · 활동 요약 · 탈퇴      ┐
├── pet/           반려동물 CRUD                                                         │ BE1
├── transit/       지역(시도 · 시군구) · 버스 정류장 · 실시간 도착 · 접근성 등급            │ docs/04 · 09
├── place/         장소 다중 조건 검색 · 상세 · 찜                                          │
├── review/        통합 리뷰 (장소·상품·병원) + 작성 자격                                   ┘
├── reservation/   예약 상태 흐름 · 권한                                                    ┐
├── hospital/      동물병원 · 진료 예약 (한 칸 1건, FOR UPDATE)                              │ BE2
├── hotel/         펫 호텔 · 객실 상태 3종 · 객실 예약 (기간 겹침)                          │ docs/05
├── shop/          상품 · 장바구니 · 주문 트랜잭션 · 주문 취소                              │
└── facility/      병원 · 호텔 찜 · 최근 예약한 곳 (마이페이지)                              ┘
```

## 규칙 (docs/03)

- 모든 경로 `/api/...`, 포트 8080, JSON camelCase, 날짜 `2026-11-20T14:00:00+09:00`, 시간대 Asia/Seoul
- 성공은 데이터 그대로, 삭제는 204, 에러는 `{ status, code, message, errors }`
- 로그인 필요 API 는 토큰이 없거나 만료면 401 → FE 가 자동 로그아웃
- 트랜잭션: 회원가입 · 진료/호텔 예약 · 주문 생성 · 주문 취소 · 탈퇴

## API 목록

명세: [docs/04](../docs/04_API_USER_PLACE.md) (회원·장소) · [docs/05](../docs/05_API_RESERVATION_COMMERCE.md) (예약·커머스)

| 파트 | API |
|---|---|
| 인증 | `GET /auth/check-email` · `POST /auth/signup` · `POST /auth/login` · `GET /auth/me` · `POST /auth/password/reset` |
| 회원 | `PUT /users/me` · `GET /users/me/summary` · `DELETE /users/me` |
| 반려동물 | `GET·POST /pets` · `GET·PUT·DELETE /pets/{id}` |
| 지역 · 버스 | `GET /regions?type=` · `GET /bus-stops/nearby` · `GET /bus-stops/{id}/routes` · `GET /bus-stops/{id}/arrivals` |
| 장소 | `GET /place-categories` · `GET /places` (`lat·lng·radiusKm` 또는 `sido·sigungu`, `nearStop`, `sort=transit`) · `GET /places/{id}` |
| 찜 | `POST·DELETE /places/{id}/bookmark` · `GET /users/me/bookmarks` · `GET·POST·DELETE /hospitals/{id}/bookmark` · `GET·POST·DELETE /pet-hotels/{id}/bookmark` · `GET /users/me/facility-bookmarks` · `GET /users/me/recent-facilities` |
| 리뷰 | `GET /reviews` · `GET /reviews/eligibility` · `POST /reviews` · `PUT·DELETE /reviews/{id}` · `GET /users/me/reviews` |
| 병원 | `GET /hospitals` · `GET /hospitals/{id}` · `GET /hospitals/{id}/available-times` · `POST /hospital-reservations` · `GET /users/me/hospital-reservations` · `PATCH /hospital-reservations/{id}/cancel \| status` |
| 호텔 | `GET /pet-hotels` · `GET /pet-hotels/{id}` · `GET /pet-hotels/{id}/rooms` · `POST /hotel-reservations` · `GET /users/me/hotel-reservations` · `PATCH /hotel-reservations/{id}/cancel \| status` |
| 쇼핑 | `GET /product-categories` · `GET /products` · `GET /products/{id}` · `GET /cart` · `POST /cart/items` · `PATCH·DELETE /cart/items/{id}` |
| 주문 | `POST /orders` · `GET /users/me/orders` · `GET /orders/{id}` · `PATCH /orders/{id}/cancel \| status` |

## 문제가 생기면

| 증상 | 확인 |
|---|---|
| `Communications link failure` | DB 주소·포트, MySQL 켜짐, 원격이면 외부 접속 허용(`bind_address`) · 팀 DB PC 가 켜져 있는지 |
| 화면에 "잠시 후 다시 시도해 주세요." (500) | 서버 로그의 `처리하지 못한 오류` 아래를 봐요. 켤 때 `시드 비밀번호 변환을 건너뜀: Access denied` 면 DB 비밀번호가 틀린 것 |
| `Table '…_bookmarks' doesn't exist` · `Unknown column 'sido'` | `patch_facility_bookmarks.sql` · `patch_bus_transit.sql` 을 안 돌림 (Mac 이면 conda mysql 로 실행해서 실패했을 수 있어요) |
| `Access denied for user 'root'@'localhost'` | 로컬 root 비밀번호 오타 · 한/영 입력 상태 확인 |
| `Unknown column 'seq'` / `'image_url'` / `'license_no'` | `patch_v2_proposed.sql` · `patch_be2_public_data.sql` 을 안 돌림 |
| 로그인 401 (시드 계정) | 서버를 한 번 켜서 `{plain}` 비밀번호가 BCrypt 로 바뀌었는지 (로그에 "시드 계정 n개의 비밀번호를 BCrypt 로 바꿨어요") |
| `Unsupported class file major version` | Java 17 이상인지 `java -version` |
