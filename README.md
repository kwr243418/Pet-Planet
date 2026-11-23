# PET PLANET 🚇🐾

> 지하철역에서 시작하는 반려생활 플랫폼 — 역 반경 1km 동반 장소 탐색 · 동물병원/펫 호텔 예약 · 펫 스토어를 한 계정으로

3주(15일) DB 프로젝트. 화면은 **지하철 노선도 콘셉트**로, 서비스를 4개 노선으로 나눠요.

| 노선 | 이름 | 화면 | FE | BE | 테이블 |
|---|---|---|---|---|---|
| **E** | 탐색선 | 메인 홈, 역세권 탐색, 장소 상세 | FE1 | BE1 | stations, places, place_categories, place_stations, place_bookmarks |
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
│   ├── 05_API_RESERVATION_COMMERCE.md   API 명세 FE2 ↔ BE2 (병원·호텔·상품·장바구니·주문) — 초안
│   ├── 06_DB_DECISIONS.md               DB 합의사항: 설계와 화면이 안 맞는 곳 13개 — 결정 칸 채우기
│   └── 07_DEMO_SCENARIO_TEST.md         시연 시나리오 5단계 + 화면별 체크리스트
├── db/                       ← MySQL 스크립트 (실행 순서는 db/README.md)
├── frontend/                 ← React 앱 (공통 레이아웃·디자인·API 클라이언트 + 화면)
├── backend/                  ← 백엔드 (스택 확정 후 여기에)
├── CONTRIBUTING.md           ← 브랜치 · 커밋 · PR 규칙
└── .github/                  ← PR · 이슈 템플릿
```

## 빠르게 실행해 보기

**프론트엔드** (백엔드 없이 목 서버로 모든 FE1 화면이 동작해요)
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev          # http://localhost:5173  (데모 계정 demo@petplanet.kr / petplanet123!)
npm run test:unit
```

**DB** (MySQL 8)
```bash
mysql -u root -p < db/schema_full.sql
mysql -u root -p < db/patch_v2_proposed.sql     # 합의 후
mysql -u root -p < db/seed_dev_places.sql       # 개발용 역·장소 데이터
```

## 지금 상태 (11/23)

| 파트 | 상태 |
|---|---|
| 공통 | 디자인 시스템·헤더/푸터·NOW STATION·API 클라이언트·로그인 상태 관리 완료 (`frontend/src/components/layout`, `common`, `api`) |
| FE1 | S01·S02·S03·S08(FE1 칸)·S09 + 로그인·비밀번호 찾기·반려동물 추가/수정 — **목 서버로 동작 완료**, 실제 API 연결 대기 |
| FE2 | S04-0·S04·S05·S06·S07 **뼈대 화면** (공통 레이아웃 + 필수 요소 자리 표시) — `frontend/src/pages/fe2/` |
| BE1 | DB 스키마 작성 (`db/schema_full.sql`, feature/be-user-place) — API 미착수 |
| BE2 | 미착수 |
| 결정 필요 | **백엔드 스택**, `docs/06_DB_DECISIONS.md` 13개 항목 |

## 팀 규칙 한 줄 요약

- `main`은 발표·제출용. 작업은 각자 `feature/*` 브랜치 → `dev`로 PR (자세히: [CONTRIBUTING.md](CONTRIBUTING.md))
- API 응답·에러 모양은 [03_API_CONVENTIONS](docs/03_API_CONVENTIONS.md)을 따르기
- 색은 민트 `#C4EBC3` · 짙은 초록 `#264536` · 크림 `#FBF8F1` · 테라코타 `#C8673F` 4색만 ([02_DESIGN_GUIDE](docs/02_DESIGN_GUIDE.md))
- DB 테이블·칼럼을 바꾸면 `docs/06_DB_DECISIONS.md`에 남기고 단톡방에 공유

## 데이터 출처

공공데이터포털 ‘전국 반려동물 동반 가능 문화시설’, 전국 지하철역 위치 정보 · 지도: 카카오맵 API
