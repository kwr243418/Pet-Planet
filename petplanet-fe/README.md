# 🐾 펫플래닛 프론트엔드 — FE1 (회원 / 장소 UI)

지하철역 기반 애견동반 장소 탐색 서비스 **펫플래닛**의 프론트엔드입니다.
라즈베리 핑크 톤 + 마스코트 "플래니"(행성 고리를 두른 강아지)로 귀엽게 꾸몄어요.

- React 18 + Vite + React Router 6 (UI 라이브러리 없이 공통 컴포넌트 직접 구현)
- 백엔드 없이도 **목(mock) 서버**로 모든 화면이 동작 → BE1 API 준비되면 `.env` 한 줄로 전환
- 카카오맵 연동 (키가 없으면 미리보기 SVG 지도로 자동 대체)

## 실행

```bash
npm install
cp .env.example .env.local   # 필요하면 값 수정
npm run dev                  # http://localhost:5173
npm run test:unit            # 유틸 + 시연 시나리오 통합 테스트 (추가 설치 없음)
```

목 서버 데모 계정: `demo@petplanet.kr` / `petplanet123!` (로그인 화면 하단 버튼으로 자동 입력)

| 환경변수 | 설명 |
|---|---|
| `VITE_USE_MOCK` | `true`면 목 서버, `false`면 실제 API (`/api` → `localhost:8080` 프록시) |
| `VITE_KAKAO_MAP_KEY` | 카카오 JavaScript 키. 카카오 개발자 콘솔 > 플랫폼 > Web에 `http://localhost:5173` 등록 필요 |
| `VITE_PROXY_TARGET` | 백엔드 주소가 8080이 아닐 때 (셸 환경변수로 지정) |

## 1~2주차 FE1 진행 내역

| 일차 | 계획 (일정표) | 결과물 |
|---|---|---|
| Day 1 | 프레임워크·공통 UI·라우터 세팅 | Vite+React 구조, 디자인 토큰(`styles/tokens.css`), 공통 컴포넌트(`components/common/ui.jsx`: Button, Field, Chip, Stars, Sheet, Dialog, Toast, Skeleton, Empty/Error 상태 등), 라우터·로그인 가드(`App.jsx`, `layouts/`), 스플래시·워크스루, API 명세 초안(`docs/API_SPEC_FE1.md`) |
| Day 2 | 회원/장소 화면 흐름도 | `docs/SCREEN_FLOW.md` (Mermaid 흐름도 + 라우트 표 + 와이어프레임) |
| Day 3 | 회원가입/로그인, 반려동물 프로필 UI | 로그인·회원가입(이메일 중복확인, 실시간 검증, 약관)·비밀번호 찾기·반려동물 등록/수정/삭제, 시드 데이터(`mocks/seed.js`) |
| Day 4 | 지하철역 검색 컴포넌트, 장소 카드 | `StationSearch`(디바운스, 키보드 탐색, 최근 검색, 호선 배지), `PlaceCard`, 홈 화면 |
| Day 5 | API 연동 & 예외 처리 | `api/client.js` — JWT 첨부, 에러 규격 통일(`ApiError`), 401 자동 로그아웃, 네트워크/500 처리, 목↔실제 API 전환 |
| Day 6 | 카카오맵 + 역/장소 마커 | `KakaoMap`(SDK 동적 로드, 커스텀 마커, 반경 1km 원, 화면 맞춤) + `FallbackMap`, 마커↔목록 연동 |
| Day 7 | 장소 상세 + 찜 토글 | `PlaceDetail`(인접역·지도·반려동물 동반 가능 여부), 낙관적 업데이트 찜 버튼, 찜 목록 |
| Day 8 | 리뷰 작성 팝업 + 리뷰 목록 | `ReviewFormSheet`(별점·빠른 태그·10~500자 검증), `ReviewSection`(평균·분포·정렬·더보기·수정·삭제), 마이페이지 내 리뷰 |
| Day 9 | 카테고리·호선별 다중 필터 | `FilterSheet`(카테고리·호선·크기·실내외), 필터 상태 URL 동기화, 적용 칩, 정렬 |
| Day 10 | 통합 UI 테스트 | `tests/flow.test.js`(시연 시나리오 E2E, 목 서버), `docs/TEST_CHECKLIST_DAY10.md` |

## 폴더 구조

```
src/
  api/          client.js(공통 HTTP·에러), index.js(도메인별 API 함수)
  mocks/        seed.js(역·장소·리뷰 시드), mockServer.js(명세대로 동작하는 목 서버)
  components/
    common/     ui.jsx, Header, BottomNav, Toast, Mascot
    place/      StationSearch, PlaceCard, BookmarkButton, FilterSheet, ReviewSection, ReviewFormSheet
    map/        MapView(선택), KakaoMap, FallbackMap
  context/      AuthContext(로그인 상태·반려동물)
  hooks/        useAsync, useDebounce
  layouts/      TabLayout, RequireAuth, GuestOnly
  pages/        Onboarding, Home, Explore, PlaceDetail, Bookmarks, MyPage, auth/*, pets/PetForm
  styles/       tokens.css, global.css, components.css, pages.css
  utils/        geo(하버사인), validators, format, subway(호선 색), categories
docs/           API_SPEC_FE1.md, SCREEN_FLOW.md, TEST_CHECKLIST_DAY10.md
tests/          node:test 단위/통합 테스트
```
