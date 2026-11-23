# backend

> **스택 미정** — 정해지면 이 폴더에 프로젝트를 만들어 주세요 (예: Spring Boot `backend/` 바로 아래에 `build.gradle`).

## 스택이 뭐든 지켜야 할 것

| 항목 | 기준 문서 |
|---|---|
| 응답·에러·인증·페이지·enum 모양 | [docs/03_API_CONVENTIONS.md](../docs/03_API_CONVENTIONS.md) |
| 회원·장소 API (BE1) | [docs/04_API_USER_PLACE.md](../docs/04_API_USER_PLACE.md) |
| 예약·커머스 API (BE2) | [docs/05_API_RESERVATION_COMMERCE.md](../docs/05_API_RESERVATION_COMMERCE.md) |
| DB | [db/](../db) · [docs/06_DB_DECISIONS.md](../docs/06_DB_DECISIONS.md) |

## 시작할 때 체크리스트

- [ ] 서버 포트 `8080` (FE 개발 서버가 `/api` 를 여기로 프록시 — 다르면 FE `VITE_PROXY_TARGET`)
- [ ] 모든 API 경로 앞에 `/api`
- [ ] DB 연결 정보는 커밋하지 않는 파일에 (`application-local.yml`, `.env` — `.gitignore`에 들어 있어요), 예시 파일만 커밋
- [ ] 공통 에러 응답 `{ status, code, message, errors }` — 예외 처리를 한 곳에서
- [ ] JSON camelCase, 날짜 ISO-8601, 시간대 Asia/Seoul
- [ ] JWT: `Authorization: Bearer …`, 만료 시 401
- [ ] 비밀번호 BCrypt
- [ ] 트랜잭션이 필요한 곳: 회원가입(users+pets), 예약 생성(중복 검사), 주문 생성(재고 차감·장바구니 비우기)
- [ ] CORS: `http://localhost:5173` (프록시 쓰면 생략 가능)

## FE와 맞춰 보는 법

FE 는 `VITE_USE_MOCK=false` 로 바꾸면 바로 실제 API 를 불러요. 목 서버(`frontend/src/mocks/mockServer.js`)가 명세대로 응답하니,
같은 요청을 BE 에 보내서 응답 모양이 같은지 비교하면 돼요.
