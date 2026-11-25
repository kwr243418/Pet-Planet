# PET PLANET

> 대중교통(버스)으로 갈 수 있는 곳을 찾는 반려생활 플랫폼 — 내 근처 · 지역별 동반 장소 탐색 + 가까운 버스 정류장 · 노선 · 실시간 도착 · 동물병원/펫 호텔 예약 · 펫 스토어를 한 계정으로
> (2026-11-25 지하철 → 버스 · 지역별 탐색으로 전환: [docs/09](docs/09_BUS_TRANSIT.md))

3주(15일) DB 프로젝트. 화면은 **노선도 콘셉트**로, 서비스를 4개 노선으로 분리.

| 노선 | 이름 | 화면 | FE | BE | 테이블 |
|---|---|---|---|---|---|
| **E** | 탐색선 | 메인 홈, 내 근처 · 지역별 탐색, 장소 상세 | FE1 | BE1 (+BE2: 버스 · 지역) | places, place_categories, place_bookmarks, bus_stops, bus_routes, bus_route_stops |
| **R** | 예약선 | 동물병원 상세·예약, 펫 호텔 예약 | FE2 | BE2 | hospitals, hospital_reservations, pet_hotels, room_types, hotel_reservations |
| **S** | 쇼핑선 | 펫 스토어, 장바구니·주문서 | FE2 | BE2 | products, product_categories, cart_items, orders, order_items |
| **M** | 마이선 | 회원가입, 마이페이지 | FE1 (+FE2: 예약·주문 칸) | BE1 (+BE2) | users, pets, reviews |

## 폴더 구조

```
.
├── docs/                     ← 팀 공통 문서 (먼저 읽기)
│   ├── 01_SCREENS.md                    화면 담당표: 경로 · 담당 · 테이블 · API · 진행 상태
│   ├── 02_DESIGN_GUIDE.md               디자인 가이드: 색 · 폰트 · 공통 컴포넌트 (팀장 목업 규칙)
│   ├── 03_API_CONVENTIONS.md            API 공통 규격: 응답 · 에러 · 인증 · 페이지 · enum 값
│   ├── 04_API_USER_PLACE.md             API 명세 FE1 ↔ BE1 (회원·반려동물·역·장소·찜·리뷰)
│   ├── 05_API_RESERVATION_COMMERCE.md   API 명세 FE2 ↔ BE2 (병원·호텔·상품·장바구니·주문)
│   ├── 06_DB_DECISIONS.md               DB 합의사항 (설계와 화면이 안 맞는 곳 + 결정)
│   ├── 07_DEMO_SCENARIO_TEST.md         시연 시나리오 5단계 + 화면별 체크리스트
│   └── 08_SQL_QUERIES.md                핵심 SQL 모음 (다중 조건 검색·예약 충돌·주문 트랜잭션 등) — 발표용
├── db/                       ← MySQL 스크립트 + 공공데이터 로더(db/loader)
├── frontend/                 ← React + Vite 앱 (전 화면, 목 서버 포함)
├── backend/                  ← Spring Boot 3 · Java 17 · JdbcTemplate API 서버 (backend/README.md)
├── CONTRIBUTING.md           ← 브랜치 · 커밋 · PR 규칙
└── .github/                  ← PR · 이슈 템플릿
```

## 빠르게 실행해 보기

### A. 프론트만 (백엔드·DB 없이 — 브라우저 안 목 서버)

```bash
cd frontend
npm install
cp .env.example .env.local      # VITE_USE_MOCK=true
npm run dev                     # http://localhost:5173  데모 계정 demo@petplanet.kr / petplanet123!
npm run test:unit               # node:test 23개
```

### B. 실제 DB + 백엔드 + 프론트

```bash
# 1) DB (MySQL 8) — 레포 루트에서, 이 순서대로
mysql -u root -p < db/schema_full.sql            # ⚠️ 테이블을 DROP 후 다시 만들어요 (공용 DB면 팀에 먼저 공유)
mysql -u root -p < db/patch_v2_proposed.sql
mysql -u root -p < db/patch_be2_public_data.sql
mysql -u root -p < db/patch_bus_transit.sql      # 지하철 테이블 삭제 · 버스 테이블 · 지역/정류장 칼럼
mysql -u root -p < db/seed_dev_places.sql        # 장소 (서울 시연용)
mysql -u root -p < db/seed_demo.sql              # 시연 계정·제휴 병원/호텔·상품·예약·주문·리뷰
# (선택) 전국 동물병원·펫호텔·동반 장소·버스 정류장 공공데이터 → db/loader/README.md

# 2) 백엔드 (http://localhost:8080)
cd backend
cp src/main/resources/application-local.yml.example src/main/resources/application-local.yml   # DB 주소·계정 입력
./gradlew bootRun

# 3) 프론트 (다른 터미널)
cd frontend
echo "VITE_USE_MOCK=false" > .env.local          # /api → localhost:8080 프록시
npm run dev
```

시연 계정 (seed_demo.sql, 비밀번호 모두 `petplanet123!`) — `demo@petplanet.kr` 일반 · `partner@petplanet.kr` 사업자 · `admin@petplanet.kr` 관리자 (목 서버와 같은 데모 계정).
원격 DB는 `mysql -h 주소 -P 포트 -u 계정 -p < …` 로 같은 순서. 자세한 설명·문제 해결: [backend/README.md](backend/README.md)

## 지금 상태 (11/24)

| 파트 | 상태 |
|---|---|
| 공통 | 디자인 시스템·헤더/푸터·NOW STATION·API 클라이언트·로그인 상태 관리 완료 |
| FE1 | S01·S02·S03·S08·S09 + 로그인·비밀번호 찾기·반려동물 추가/수정 — 완료 (목 서버·실제 API 같은 코드) |
| FE2 | S04-0·S04·S05·S06·S07 + 마이페이지 예약·주문 칸 — **API 연결 완료** (`frontend/src/pages/fe2/`) |
| BE1 | 회원·반려동물·역·장소(다중 조건 검색)·찜·리뷰 API 구현 (`backend/`) |
| BE2 | 병원·호텔 예약(시간 충돌·체중 검증·기간 겹침), 상품·장바구니·주문(트랜잭션·재고) API, 시연 시드, 공공데이터 로더 |
| 확인 필요 | 실제 MySQL + `./gradlew bootRun` 으로 끝까지 돌려 보기 (빌드·테스트는 통과: `./gradlew test`, `npm run build`, 단위 테스트 23개 — 11/24) → [07 체크리스트](docs/07_DEMO_SCENARIO_TEST.md) |

## 팀 규칙 한 줄 요약

- `main`은 발표·제출용. 작업은 각자 `feature/*` 브랜치 → `dev`로 PR (자세히: [CONTRIBUTING.md](CONTRIBUTING.md))
- API 응답·에러 모양은 [03_API_CONVENTIONS](docs/03_API_CONVENTIONS.md)을 따르기
- 색은 민트 `#C4EBC3` · 짙은 초록 `#264536` · 크림 `#FBF8F1` · 테라코타 `#C8673F` 4색만 ([02_DESIGN_GUIDE](docs/02_DESIGN_GUIDE.md))
- DB 테이블·칼럼을 바꾸면 `docs/06_DB_DECISIONS.md`에 남기고 단톡방에 공유

## 데이터 출처

공공데이터포털 ‘전국 반려동물 동반 가능 문화시설’(한국문화정보원), 지방행정 인허가 데이터(동물병원·동물위탁관리업), 국토교통부 전국 버스정류장 위치정보 · 버스노선별 경유정류장 · (TAGO) 버스도착정보 · 지도 · 길찾기 · 후기 링크: 카카오맵
시연용 제휴 병원·호텔·상품·회원·리뷰는 **가상 데이터**예요 (`db/seed_demo.sql`, 주소에 “시연용” 표시).
