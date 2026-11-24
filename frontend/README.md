# frontend — PET PLANET 웹

React 18 + Vite + React Router 6. UI 라이브러리 없이 팀 목업 디자인을 공통 컴포넌트로 만들었어요.
백엔드 없이도 **목(mock) 서버**로 동작하고, BE API가 준비되면 `.env.local` 한 줄로 전환해요.

## 실행

```bash
npm install
cp .env.example .env.local
npm run dev          # http://localhost:5173
npm run test:unit    # 유틸 + 시연 시나리오 통합 테스트 (추가 설치 없음)
npm run build

# 3주차 추가 (처음 한 번 npx playwright install chromium)
npm run test:e2e     # dev 서버를 켠 상태에서 — 시연 시나리오 28개 항목 브라우저 점검
npm run capture      # dev 서버를 켠 상태에서 — 발표용 화면 캡처 → docs/screenshots/
```

목 서버 데모 계정: `demo@petplanet.kr` / `petplanet123!` (로그인 화면 아래 버튼으로 자동 입력)

| 환경변수 | 설명 |
|---|---|
| `VITE_USE_MOCK` | `true` 목 서버 / `false` 실제 API (`/api` → `localhost:8080` 프록시) |
| `VITE_KAKAO_MAP_KEY` | 카카오 JavaScript 키. 카카오 개발자 콘솔 > 플랫폼 > Web 에 `http://localhost:5173` 등록. 비우면 같은 스타일 미리보기 지도 |
| `VITE_DEMO_MODE` | `true`(기본) 마이페이지에 "(시연) 다음 상태로" 버튼 — 백엔드 `petplanet.demo-mode` 와 맞추기 |
| `VITE_PROXY_TARGET` | 백엔드가 8080 이 아닐 때 (셸 환경변수) |

## 구조

```
src/
  App.jsx               라우트 (FE1 + FE2 화면)
  api/                  client.js(공통 HTTP·JWT·에러) · index.js(도메인별 API 함수)
  mocks/                seed.js(역·장소·리뷰) · mockServer.js(명세대로 응답하는 목 서버)
                        seedCommerce.js · mockCommerce.js(FE2 병원·호텔·상품·장바구니·주문 — db/seed_demo.sql 과 같은 데이터)
  context/AuthContext   useAuth(): user, pets, primaryPet, login, logout, signup …
  hooks/                useAsync(데이터 불러오기) · usePage(탭 제목·이탈 경고·첫 오류 칸 이동)
  components/
    layout/Site.jsx     SiteHeader(E·R·S·M) · SiteFooter · PageHero · NowStation · LetterBadge   ← 공통
    layout/AppChrome    ScrollToTop · OfflineBanner · ErrorBoundary                               ← 공통
    common/             ui.jsx(Button·Field·OptionGroup·Tag·Stars·Modal…) · Toast              ← 공통
    illust/             목업 스타일 SVG 일러스트                                                  ← 공통
    place/ pet/ map/    FE1 (장소 카드·노선도·필터·리뷰·찜 / 반려동물 입력 / 카카오맵)
  pages/
    Home Explore PlaceDetail MyPage auth/* pets/*     FE1
    fe2/                                             FE2 (S04-0·S04·S05·S06·S07 + 마이페이지 예약·주문 칸) — API 연결 완료
  styles/               tokens.css(색·폰트) · base · components · pages
  utils/                geo(하버사인) · validators · format · subway · categories
tests/                  node:test 단위·통합 테스트
e2e/                    demo-scenario.mjs(시연 시나리오 점검) · capture.mjs(발표용 캡처) — Playwright
docs/                   FE1_SCREEN_FLOW · FE1_TEST_CHECKLIST · FE1_WEEK3_REPORT(3주차 보고) · FE1_PRESENTATION(슬라이드 구성안·시연 대본·Q&A)
```

## FE2 화면 (API 연결 완료 · 11/24)

| 화면 | 파일 | 부르는 API |
|---|---|---|
| S04-0 병원 상세·리뷰 | `fe2/HospitalDetailPage.jsx` | `hospitalApi.get`, `reviewApi.list(…, {targetType:'HOSPITAL'})` |
| S04 진료 예약 | `fe2/HospitalReservePage.jsx` | `hospitalApi.list({partner:true})`, `availableTimes`, `reserve` |
| S05 호텔 예약 | `fe2/HotelReservePage.jsx` | `hotelApi.list({bookable:true})`, `rooms`(체중·기간 검증), `reserve` |
| S06 펫 스토어 | `fe2/StorePage.jsx` | `shopApi.categories`, `products`, `cartApi.add` |
| S07 장바구니·주문 | `fe2/CartOrderPage.jsx` | `cartApi.get/update/remove`, `orderApi.create` |
| S08 예약·주문 칸 | `fe2/MyReservations.jsx`, `fe2/MyOrders.jsx` | `myReservations`, `cancel`, `changeStatus`(시연), `orderApi.mine`, `reviewApi.create` |

- 목 서버(`VITE_USE_MOCK=true`)도 백엔드와 **같은 규칙·에러 코드**로 동작해요: 같은 진료 시간 409 `TIME_SLOT_TAKEN`, 체중 초과 `ROOM_OVERWEIGHT`, 기간 겹침 `ROOM_ALREADY_BOOKED`, 재고 부족 시 주문 전체 취소 `OUT_OF_STOCK`, 리뷰 자격 403 `REVIEW_NOT_ALLOWED` — `tests/commerce.test.js`
- 데모 계정에는 이용완료 병원 예약(→ 병원 리뷰 쓰기)과 배송완료 주문(→ 상품 리뷰 쓰기)이 미리 들어 있어요
- 목 DB 키가 `pp-mock-db-v3` 로 바뀌었어요 — 예전 목 데이터는 자동으로 새로 만들어져요

## 메모

- 목 데이터의 장소·회원·리뷰는 **가상**이에요 (지하철역 좌표·노선 순서만 실제 기준). DB 시드와 같은 값: 루트 `db/seed_dev_places.sql`
- 목 데이터는 브라우저 localStorage 에 저장돼요 → 마이페이지 아래 "목 데이터 초기화"
- 강제 에러 테스트: 콘솔에서 `localStorage.setItem('pp-mock-fail', 'network')` (또는 `'500'`), 해제는 `removeItem`
