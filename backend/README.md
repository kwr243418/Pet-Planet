# backend — 펫플래닛 API 서버

**Spring Boot 3.4 · Java 17 · JdbcTemplate(SQL 직접 작성) · MySQL 8**
JPA 를 쓰지 않고 SQL 을 직접 써서 쿼리를 그대로 보여줄 수 있어요 → [docs/08_SQL_QUERIES.md](../docs/08_SQL_QUERIES.md)

## 실행

### 1. DB 준비 (MySQL 8)

```bash
cd ..   # 레포 루트
mysql -u root -p < db/schema_full.sql            # 18개 테이블 (+ 옛 샘플)
mysql -u root -p < db/patch_v2_proposed.sql      # 화면에 맞춘 칼럼·ENUM·UNIQUE (docs/06 합의 1~13)
mysql -u root -p < db/patch_be2_public_data.sql  # hospitals·pet_hotels.license_no (합의 14)
mysql -u root -p < db/seed_dev_places.sql        # 지하철역 141행 + 장소 32곳
mysql -u root -p < db/seed_demo.sql              # 시연 계정 · 제휴 병원/호텔 · 상품 · 예약 · 주문 · 리뷰
# (선택) 전국 동물병원·펫호텔 공공데이터: db/loader/README.md
```
원격 DB 면 `mysql -h 주소 -P 포트 -u 계정 -p < …`

### 2. DB 접속 정보

```bash
cp src/main/resources/application-local.yml.example src/main/resources/application-local.yml
# application-local.yml 에 url · username · password 입력 (이 파일은 커밋되지 않아요)
```
또는 환경변수: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

### 3. 서버 켜기

```bash
./gradlew bootRun          # Windows: gradlew.bat bootRun
```
- 처음 한 번은 Gradle·라이브러리를 내려받느라 몇 분 걸려요. `http://localhost:8080/api/stations?line=2호선` 이 열리면 성공.
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
| `partner@petplanet.kr` | BUSINESS | 시연 병원 3곳·호텔 2곳 사업자 → 예약 승인 `PATCH …/status` |
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
├── station/       지하철역 · 노선도 · 장소 카테고리                                        │ docs/04
├── place/         장소 다중 조건 검색 · 상세 · 찜                                          │
├── review/        통합 리뷰 (장소·상품·병원) + 작성 자격                                   ┘
├── reservation/   예약 상태 흐름 · 권한                                                    ┐
├── hospital/      동물병원 · 진료 예약 (한 칸 1건, FOR UPDATE)                              │ BE2
├── hotel/         펫 호텔 · 객실 상태 3종 · 객실 예약 (기간 겹침)                          │ docs/05
└── shop/          상품 · 장바구니 · 주문 트랜잭션 · 주문 취소                              ┘
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
| 역·장소 | `GET /stations?line= \| keyword=` · `GET /stations/{id}` · `GET /place-categories` · `GET /places` · `GET /places/{id}` |
| 찜 | `POST·DELETE /places/{id}/bookmark` · `GET /users/me/bookmarks` |
| 리뷰 | `GET /reviews` · `GET /reviews/eligibility` · `POST /reviews` · `PUT·DELETE /reviews/{id}` · `GET /users/me/reviews` |
| 병원 | `GET /hospitals` · `GET /hospitals/{id}` · `GET /hospitals/{id}/available-times` · `POST /hospital-reservations` · `GET /users/me/hospital-reservations` · `PATCH /hospital-reservations/{id}/cancel \| status` |
| 호텔 | `GET /pet-hotels` · `GET /pet-hotels/{id}` · `GET /pet-hotels/{id}/rooms` · `POST /hotel-reservations` · `GET /users/me/hotel-reservations` · `PATCH /hotel-reservations/{id}/cancel \| status` |
| 쇼핑 | `GET /product-categories` · `GET /products` · `GET /products/{id}` · `GET /cart` · `POST /cart/items` · `PATCH·DELETE /cart/items/{id}` |
| 주문 | `POST /orders` · `GET /users/me/orders` · `GET /orders/{id}` · `PATCH /orders/{id}/cancel \| status` |

## 문제가 생기면

| 증상 | 확인 |
|---|---|
| `Communications link failure` | DB 주소·포트, MySQL 켜짐, 원격이면 외부 접속 허용(`bind_address`) |
| `Unknown column 'seq'` / `'image_url'` / `'license_no'` | `patch_v2_proposed.sql` · `patch_be2_public_data.sql` 을 안 돌림 |
| 로그인 401 (시드 계정) | 서버를 한 번 켜서 `{plain}` 비밀번호가 BCrypt 로 바뀌었는지 (로그에 "시드 계정 n개의 비밀번호를 BCrypt 로 바꿨어요") |
| `Unsupported class file major version` | Java 17 이상인지 `java -version` |
