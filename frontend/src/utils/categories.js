// 장소 카테고리 화면 메타 — id는 place_categories 테이블과 맞춥니다.
// 목업: 카드 상단에 영문 카테고리(CAFE·DINING·STAY·PARK)를 크게, 배경은 민트/베이지 톤
export const CATEGORY_META = {
  1: { label: '카페', en: 'CAFE', tone: 'mint' },
  2: { label: '식당', en: 'DINING', tone: 'beige' },
  3: { label: '숙소', en: 'STAY', tone: 'beige' },
  4: { label: '운동장', en: 'PARK', tone: 'mint-soft' },
};

export function categoryMeta(id) {
  return CATEGORY_META[id] ?? { label: '기타', en: 'PLACE', tone: 'beige' };
}
