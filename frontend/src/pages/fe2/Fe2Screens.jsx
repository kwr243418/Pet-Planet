// FE2 작업 영역 — 예약선(R) · 쇼핑선(S) 화면 모음
// 화면마다 파일을 나눴어요. App.jsx 는 여기서 가져가요.
// API 함수: src/api/index.js 의 hospitalApi · hotelApi · shopApi · cartApi · orderApi (명세: docs/05_API_RESERVATION_COMMERCE.md)

/** S04 동물병원 진료 예약 */
export { default as HospitalReservePage } from './HospitalReservePage.jsx';

/** S04-0 동물병원 상세 · 리뷰 */
export { default as HospitalDetailPage } from './HospitalDetailPage.jsx';

/** S05 펫 호텔 객실 예약 */
export { default as HotelReservePage } from './HotelReservePage.jsx';

/** S06 펫 스토어 */
export { default as StorePage } from './StorePage.jsx';

/** S07 장바구니 · 주문서 */
export { default as CartOrderPage } from './CartOrderPage.jsx';
