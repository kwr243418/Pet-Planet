// 장소 카테고리 화면 메타(이모지/파스텔 배경) — id는 place_categories 테이블과 맞춥니다.
export const CATEGORY_META = {
  1: { emoji: '☕', bg: 'var(--peach)', label: '카페' },
  2: { emoji: '🍽️', bg: 'var(--butter)', label: '식당' },
  3: { emoji: '🏨', bg: 'var(--lilac)', label: '숙소' },
  4: { emoji: '🌳', bg: 'var(--mint)', label: '공원·야외' },
  5: { emoji: '🎨', bg: 'var(--sky)', label: '문화시설' },
};

export function categoryMeta(id) {
  return CATEGORY_META[id] ?? { emoji: '🐾', bg: 'var(--pink-100)', label: '기타' };
}
