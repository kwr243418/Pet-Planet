// 장소 카테고리 화면 메타 — id는 place_categories 테이블과 맞춥니다.
// 카드 상단: 장소 사진이 없으면 카테고리 대표 사진(img) + 작은 영문 라벨
export const CATEGORY_META = {
  1: { label: '카페', en: 'CAFE', tone: 'mint', img: '/images/d1-cafe.jpg', detailImg: '/images/a4-corgi-terrace.jpg' },
  2: { label: '식당', en: 'DINING', tone: 'beige', img: '/images/d3-restaurant.jpg' },
  3: { label: '숙소', en: 'STAY', tone: 'beige', img: '/images/a5-hotel-retriever.jpg' },
  4: { label: '운동장', en: 'PARK', tone: 'mint-soft', img: '/images/d4-playground.jpg' },
  // 공공데이터 적재(--places)로 추가되는 카테고리 (seed 다음 AUTO_INCREMENT 5·6)
  5: { label: '여행지', en: 'TRAVEL', tone: 'mint-soft', img: '/images/g2-morning-path.jpg' },
  6: { label: '문화시설', en: 'CULTURE', tone: 'beige', img: '/images/c1-station-path.jpg' },
};

export function categoryMeta(id) {
  return CATEGORY_META[id] ?? { label: '기타', en: 'PLACE', tone: 'beige', img: '/images/g2-morning-path.jpg' };
}
