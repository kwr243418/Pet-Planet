// 상품 사진 (DB에 image_url이 없을 때 쓰는 시연용 이미지 · AI 생성)
// 상품과 맞는 사진이 있으면 그 사진을, 없으면 카테고리별 판화 일러스트를 씁니다.
const BY_PRODUCT_ID = {
  1: '/images/e1-salmon-food.jpg', // 그레인프리 연어 사료 2kg
  2: '/images/e5-beef-food.jpg', // 소형견 저알러지 사료 1.5kg
  4: '/images/e2-jerky.jpg', // 무첨가 닭가슴살 육포
  5: '/images/e6-dental-chew.jpg', // 덴탈 껌 15개입
};

const ENGRAVING_BY_CATEGORY = {
  1: '/images/b4-retriever-lying.jpg',
  2: '/images/b2-spaniel.jpg',
  3: '/images/b3-terrier.jpg',
  4: '/images/b5-pointer-standing.jpg',
};

/** { src, engraving } — engraving이면 흰 바탕에 전체가 보이게(contain) 그립니다 */
export function productImage(product) {
  if (product?.imageUrl) return { src: product.imageUrl, engraving: false };
  const photo = BY_PRODUCT_ID[product?.productId];
  if (photo) return { src: photo, engraving: false };
  return { src: ENGRAVING_BY_CATEGORY[product?.categoryId] ?? '/images/b1-pointer-walking.jpg', engraving: true };
}
