// 예약선(R): 상단 메뉴 "병원 · 호텔" = 주변 탐색의 동물병원 · 펫호텔 탭 + "예약 가능만" 필터
// 병원 · 호텔은 주변 탐색에서 찾고 → 상세 → 예약 화면으로 이어져요 (예약 화면에서 병원을 따로 고르지 않아요)

/** 예약 가능한 병원(tab=hospital) · 호텔(tab=hotel)만 보는 주변 탐색 주소 */
export const reserveExploreUrl = (tab = 'hospital') => `/explore?tab=${tab}&book=1`;

/** 주변 탐색 URL 이 "예약선" 화면인지 (메뉴 밑줄 · 제목을 예약선으로) */
export function isReserveExplore(pathname, search) {
  if (pathname !== '/explore') return false;
  const q = new URLSearchParams(search);
  return q.get('book') === '1' && (q.get('tab') === 'hospital' || q.get('tab') === 'hotel');
}

export const RESERVE_STEPS = {
  hospital: ['예약 가능 목록', '병원 상세', '반려동물 · 일시', '신청 완료'],
  hotel: ['예약 가능 목록', '호텔 선택', '반려동물 · 객실', '신청 완료'],
};
