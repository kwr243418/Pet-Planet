// 예약선(R): 상단 메뉴 "병원 · 호텔" = 탐색 화면의 동물병원 · 펫호텔 탭 (처음엔 "예약 가능만" 필터가 켜져 있어요)
//   · 탭이 곧 노선이에요: 동반 장소 탭 = 탐색선(주변 탐색), 동물병원 · 펫호텔 탭 = 예약선(병원 · 호텔)
//   · "예약 가능만" 칩은 예약선 안의 필터라서 꺼도 예약선에 머물러요
// 병원 · 호텔은 여기서 찾고 → 상세 → 예약 화면으로 이어져요 (예약 화면에서 병원을 따로 고르지 않아요)

/** 예약 가능한 병원(tab=hospital) · 호텔(tab=hotel)만 보는 주변 탐색 주소 */
export const reserveExploreUrl = (tab = 'hospital') => `/explore?tab=${tab}&book=1`;

/** 탐색 화면이 "예약선"인지 = 동물병원 · 펫호텔 탭 (메뉴 밑줄 · 제목을 예약선으로) */
export const isReserveTab = (tab) => tab === 'hospital' || tab === 'hotel';
export function isReserveExplore(pathname, search) {
  return pathname === '/explore' && isReserveTab(new URLSearchParams(search).get('tab'));
}

export const RESERVE_STEPS = {
  hospital: ['예약 가능 목록', '병원 상세', '반려동물 · 일시', '신청 완료'],
  hotel: ['예약 가능 목록', '호텔 선택', '반려동물 · 객실', '신청 완료'],
};
