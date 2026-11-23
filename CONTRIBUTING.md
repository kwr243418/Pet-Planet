# 협업 규칙 (브랜치 · 커밋 · PR)

## 브랜치

```
main ─────────────── 발표·제출용 (직접 push 금지)
  └─ dev ──────────── 통합 브랜치 (Day 5·10·13 통합 점검 기준)
       ├─ feature/fe-user-map            FE1  회원·장소 화면
       ├─ feature/fe-reservation-shop    FE2  예약·쇼핑 화면
       ├─ feature/be-user-place          BE1  회원·장소 API·DB
       └─ feature/be-reservation-commerce BE2 예약·커머스 API·DB
```

- 레포에 이미 만들어 둔 브랜치 이름 그대로 써요.
- 큰 기능은 내 브랜치에서 한 번 더 나눠도 돼요: `feature/fe-user-map-review` 처럼.
- `main`에는 직접 올리지 않아요. `dev`가 안정되면 팀장이 `dev → main` PR로 합쳐요.

### 작업 순서

```bash
# 1. 처음 한 번
git clone https://github.com/kwr243418/Pet-Planet.git
cd Pet-Planet
git checkout feature/fe-user-map        # 내 브랜치

# 2. 작업 시작 전 — dev 최신 내용 받기
git fetch origin
git merge origin/dev                    # 충돌 나면 해결 후 커밋

# 3. 작업 → 커밋 → 올리기
git add .
git commit -m "feat: 장소 상세 찜하기 버튼"
git push origin feature/fe-user-map

# 4. GitHub에서 PR 만들기: feature/fe-user-map → dev
```

## 커밋 메시지

`종류: 무엇을` 한 줄, 한글로 써도 돼요.

| 종류 | 언제 |
|---|---|
| `feat` | 새 기능·화면 |
| `fix` | 버그 수정 |
| `db` | 테이블·SQL·시드 데이터 |
| `docs` | 문서 |
| `style` | 디자인·CSS (기능 변화 없음) |
| `refactor` | 동작은 같고 코드 정리 |
| `chore` | 설정·패키지 |

예: `feat: 역세권 탐색 0.5km 필터`, `db: stations에 seq 칼럼 추가`, `fix: 찜 중복 시 409 처리`

## PR

- 제목은 커밋 규칙과 같게, 본문은 템플릿(`.github/pull_request_template.md`) 채우기
- **리뷰어 1명 이상** 확인 후 머지 (FE끼리, BE끼리 서로 봐 주기)
- API 모양을 바꿨으면 `docs/04` 또는 `docs/05`도 같은 PR에서 고치기
- DB를 바꿨으면 `docs/06_DB_DECISIONS.md`에 결정 기록

## 폴더별 담당

| 폴더 | 담당 | 다른 사람이 고칠 때 |
|---|---|---|
| `frontend/src/components/layout`, `common`, `styles`, `api/client.js` | FE 공통 (FE1이 만듦) | PR에 FE 둘 다 리뷰 |
| `frontend/src/pages/` (fe2 제외), `components/place`, `pet`, `map` | FE1 | |
| `frontend/src/pages/fe2/` (+ 새로 만드는 R·S 컴포넌트) | FE2 | |
| `db/` | BE1·BE2 | 테이블 담당자 확인 |
| `backend/` | BE1·BE2 | |
| `docs/` | 모두 | 자기 파트 문서는 자기가 |

## 하지 말 것

- `.env.local`, API 키, 비밀번호를 커밋하지 않기 (`.gitignore`에 들어 있어요)
- `node_modules`, 빌드 결과물(`dist`, `build`) 커밋하지 않기
- 다른 사람 브랜치에 직접 push 하지 않기
