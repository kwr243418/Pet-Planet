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
| `VITE_PROXY_TARGET` | 백엔드가 8080 이 아닐 때 (셸 환경변수) |

## 구조

```
src/
  App.jsx               라우트 (FE1 화면 + FE2 뼈대 화면)
  api/                  client.js(공통 HTTP·JWT·에러) · index.js(도메인별 API 함수 — FE2 함수 자리 포함)
  mocks/                seed.js(역·장소·리뷰) · mockServer.js(명세대로 응답하는 목 서버)
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
    fe2/Fe2Screens.jsx                               FE2 뼈대 (S04-0·S04·S05·S06·S07)
  styles/               tokens.css(색·폰트) · base · components · pages
  utils/                geo(하버사인) · validators · format · subway · categories
tests/                  node:test 단위·통합 테스트
e2e/                    demo-scenario.mjs(시연 시나리오 점검) · capture.mjs(발표용 캡처) — Playwright
docs/                   FE1_SCREEN_FLOW · FE1_TEST_CHECKLIST · FE1_WEEK3_REPORT(3주차 보고) · FE1_PRESENTATION(슬라이드 구성안·시연 대본·Q&A)
```

## FE2 시작하기

1. `src/pages/fe2/Fe2Screens.jsx` 에 화면별 뼈대가 있어요. 각 `<Blueprint>` 점선 칸이 목업 필수 요소예요 → 실제 컴포넌트로 바꿔 끼우기 (파일을 화면별로 나눠도 좋아요)
2. API 함수는 `src/api/index.js` 아래쪽 `hospitalApi` · `hotelApi` · `shopApi` · `cartApi` · `orderApi` (명세: 루트 `docs/05_API_RESERVATION_COMMERCE.md`)
3. 백엔드 전에 화면을 돌려 보려면 `src/mocks/mockServer.js` 의 `handle()` 에 같은 방식으로 핸들러 추가
4. 공통 컴포넌트 사용법: 루트 `docs/02_DESIGN_GUIDE.md`
5. 마이페이지 예약·주문 칸: `pages/MyPage.jsx` 의 `id="reservations"`, `id="orders"` 부분 교체

## 메모

- 목 데이터의 장소·회원·리뷰는 **가상**이에요 (지하철역 좌표·노선 순서만 실제 기준). DB 시드와 같은 값: 루트 `db/seed_dev_places.sql`
- 목 데이터는 브라우저 localStorage 에 저장돼요 → 마이페이지 아래 "목 데이터 초기화"
- 강제 에러 테스트: 콘솔에서 `localStorage.setItem('pp-mock-fail', 'network')` (또는 `'500'`), 해제는 `removeItem`
