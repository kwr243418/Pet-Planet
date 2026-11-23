# 02. 디자인 가이드

팀장 목업 "지하철 노선도 콘셉트"의 공통 규칙을 코드로 옮긴 거예요. 실제 값은 `frontend/src/styles/tokens.css`.

## 색 — 4색만 사용

| 이름 | 값 | 변수 | 어디에 |
|---|---|---|---|
| 메인 민트 | `#C4EBC3` | `--mint` | 페이지 상단 배경, 강조 카드, 완료 단계 |
| 짙은 초록 | `#264536` | `--green` | 글자, 주요 버튼, 현재 단계, 푸터 |
| 크림 | `#FBF8F1` | `--cream` | 페이지 배경 |
| 테라코타 | `#C8673F` | `--terra` | 포인트(하트·별점·나무), 에러 문구 |

같은 계열 톤(목업에서 추출): `--mint-soft #E2F3E0`, `--mint-deep #9FD5A3`, `--beige #EDE7D9`(선택 버튼 바탕), `--beige-soft #F4EEE2`, 흰색.
글자 흐리게는 새 색 대신 초록 투명도: `--ink-2`(72%), `--ink-3`(50%). **이 밖의 색은 쓰지 않아요** (호선 공식 색도 X).

## 폰트

| 용도 | 폰트 | 변수 |
|---|---|---|
| 한글 전체 | Gothic A1 | `--font-ko` |
| 큰 영문 제목 (EXPLORE, CLINIC, km 숫자) | Jost | `--font-en` / 클래스 `en` |
| **메인 타이틀 PET PLANET 만** | Bagel Fat One | `--font-title` |

## 레이아웃 규칙

| 항목 | 규칙 | 컴포넌트 |
|---|---|---|
| 헤더 | 로고 · 노선 메뉴 4개 · 장바구니 · 로그인, 현재 노선은 흰 배경 | 자동 (`App.jsx`) |
| 페이지 상단 | 민트 배경 + 큰 영문 제목 + 한글 제목 1줄 + 설명 1~2줄 + 일러스트 | `PageHero` |
| NOW STATION | 상단 바로 아래, 노선 단계를 역처럼, 현재 단계만 큰 원 | `NowStation` |
| 선택 버튼 | 베이지 바탕 안에 글자만, 선택된 것만 흰 알약 + 굵게. **어두운 채움으로 선택 표시 금지** | `OptionGroup` |
| 카드 | 흰 배경, 모서리 32–40px, **테두리 없음** | `.card` |
| 버튼 | **주요 동작 1개만** 짙은 초록 채움, 나머지는 테두리 | `Button` / `variant="outline"` |
| 푸터 | 짙은 초록, PET PLANET 워드마크, 출처 문구 | 자동 |

## 새 화면 만들 때 (복붙용)

```jsx
import { useState } from 'react';
import { NowStation, PageHero } from '../components/layout/Site.jsx';
import { StationBuildings } from '../components/illust/index.jsx';
import { Button, OptionGroup } from '../components/common/ui.jsx';

export default function MyScreen() {
  const [kind, setKind] = useState('hospital');
  return (
    <>
      <PageHero
        line="R"                                   // E | R | S | M
        en="CLINIC"                                // 큰 영문 제목 ('PET\nSTAY' 처럼 줄바꿈 가능)
        title={'제휴 동물병원\n진료 예약'}           // 한글 제목
        desc="반려동물과 원하는 시간을 고르면 병원으로 바로 신청돼요."
        art={<StationBuildings />}
      />
      <NowStation steps={['예약 선택', '병원 선택', '반려동물 · 일시', '신청 완료']} current={2} />
      <div className="container">
        <OptionGroup value={kind} onChange={setKind} options={[
          { value: 'hospital', label: '동물병원 진료' },
          { value: 'hotel', label: '펫 호텔' },
        ]} />
        <div className="card">…</div>
        <Button size="lg">진료 예약 신청</Button>          {/* 주요 버튼은 화면에 1개 */}
        <Button variant="outline">병원 변경</Button>
      </div>
    </>
  );
}
```

## 자주 쓰는 컴포넌트

| 컴포넌트 | 예 |
|---|---|
| `Button` | `<Button>` 주요 · `<Button variant="outline">` 보조 · `size="sm|md|lg"` · `loading` |
| `OptionGroup` | 한 개 선택 `value="A"` / 여러 개 `multiple value={['A','B']}` |
| `Field` / `PasswordField` | `label`, `error`, `hint`, `right={<Button…/>}` (입력칸 옆 버튼) |
| `Tag` | 작은 칩 `tone="beige|white|mint|green"` — 호선 칩은 `LineChip` |
| `Stars` / `StarInput` | 별점 표시 / 입력 (테라코타) |
| `Modal`, `ConfirmDialog` | 예약 모달, 삭제 확인 |
| `EmptyState`, `ErrorState`, `Skeleton` | 빈 목록 / 에러(다시 시도) / 로딩 |
| `useToast()` | `toast.show('담았어요')`, `toast.error(e.message)` |
| `LetterBadge` | E·R·S·M 원 배지 |
| `CategoryBanner` | 사진이 없을 때 큰 영문 단어(CAFE·FOOD…) 배너 |

## 사진이 없을 때

장소·상품 사진 칼럼이 아직 없어서(docs/06 [5]), 목업의 "상품 이미지" 자리는 **영문 카테고리 단어 + 톤 배경**으로 대신해요.
장소: CAFE·DINING·STAY·PARK / 상품(제안): FOOD(사료)·SNACK(간식)·CARE(위생용품)·GOODS(용품) — 목업과 같은 표기.

## 쓰지 않는 것

- 이모지 아이콘 (일러스트·영문 단어로 대신)
- 그림자 강한 카드, 테두리 선 카드
- 4색 계열 밖의 색 (빨강 에러 X → 테라코타)
