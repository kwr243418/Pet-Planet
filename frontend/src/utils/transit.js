// 대중교통(버스) 접근성 · 반려동물 버스 이용 안내 · 카카오맵 후기 링크 — docs/09_BUS_TRANSIT.md
// 등급 규칙은 백엔드 transit/BusAccess.java 와 같아요.

/** "정류장 근처만" 필터 기준 (m) */
export const NEAR_STOP_M = 300;

/** 도보 4.5km/h(분당 75m) · 길 우회 1.25배 */
export const walkMinutes = (m) => (m == null ? null : Math.max(1, Math.ceil((m * 1.25) / 75)));

/**
 * 거리 점수 200m 3 · 400m 2 · 800m 1 · 그 밖 0
 * + 1점: 노선 5개 이상 (노선 정보가 아직 없으면 반경 500m 정류장 4곳 이상)
 * 4점 A · 3점 B · 1~2점 C · 0점(800m 넘음 · 정류장 없음) D
 */
export function accessGrade(meters, stops500m, routeCount) {
  if (meters == null) return 'D';
  let pts = meters <= 200 ? 3 : meters <= 400 ? 2 : meters <= 800 ? 1 : 0;
  const wellServed = routeCount > 0 ? routeCount >= 5 : (stops500m ?? 0) >= 4;
  if (pts > 0 && wellServed) pts += 1;
  return pts >= 4 ? 'A' : pts === 3 ? 'B' : pts >= 1 ? 'C' : 'D';
}

export const GRADE_LABEL = {
  A: '버스 정류장이 아주 가까워요',
  B: '버스로 가기 편해요',
  C: '정류장까지 조금 걸어요',
  D: '버스보다 차량 이동을 추천해요',
};

/** 백엔드 응답과 같은 모양 { stopId, stopName, distanceM, walkMin, stops500m, routeCount, grade, gradeLabel } */
export function busAccessOf(stop, meters, stops500m, routeCount) {
  const grade = accessGrade(stop ? meters : null, stops500m, routeCount);
  return {
    stopId: stop?.stopId ?? null,
    stopName: stop?.name ?? null,
    distanceM: stop ? meters : null,
    walkMin: stop ? walkMinutes(meters) : null,
    stops500m,
    routeCount: routeCount ?? null,
    grade,
    gradeLabel: GRADE_LABEL[grade],
  };
}

/** 카드 한 줄: "목포역 정류장 도보 3분" */
export const stopLine = (a) => (a?.stopId ? `${a.stopName} 정류장 도보 ${a.walkMin}분` : '2km 안에 버스 정류장 없음');

// ─────────────────────────────────────────────────────────────
// 반려동물과 버스 타기 (윤리 · 규정 검토 결과, docs/09 §반려동물 버스 이용)
// ─────────────────────────────────────────────────────────────

/** 펫 플래닛 참고 기준 (운수회사 약관 · 기사 판단이 우선) */
export const CARRIER_OK_KG = 5;
export const CARRIER_HARD_KG = 10;

/** 체중으로 버스 이용 안내 단계: ok · caution · no (체중을 모르면 unknown) */
export function petBusAdvice(weightKg) {
  const w = Number(weightKg);
  if (!(w > 0)) {
    return { level: 'unknown', title: '이동장에 넣으면 탈 수 있어요', desc: '반려동물을 등록하면 체중에 맞춰 안내해 드려요.' };
  }
  if (w <= CARRIER_OK_KG) {
    return { level: 'ok', title: '이동장에 넣으면 버스를 탈 수 있어요', desc: `${w}kg이면 대부분 휴대용 이동장에 들어가요. 혼잡하면 기사님이 거절할 수 있어요.` };
  }
  if (w <= CARRIER_HARD_KG) {
    return {
      level: 'caution',
      title: '이동장 크기 · 무게를 먼저 확인하세요',
      desc: `${w}kg이면 이동장까지 합친 크기 · 무게가 운수회사 기준을 넘을 수 있어요. 탑승 전에 버스 회사에 확인해 주세요.`,
    };
  }
  return {
    level: 'no',
    title: '버스보다 자가용 · 펫택시를 추천해요',
    desc: `${w}kg이면 버스에 들고 탈 수 있는 이동장에 넣기 어려워요. 반려동물도, 다른 승객도 편한 방법으로 이동해 주세요.`,
  };
}

/** 이용 수칙 (모든 화면 공통) */
export const BUS_RULES = [
  '시내 · 시외버스는 전용 이동장(케이지)에 넣은 반려동물만 탈 수 있어요.',
  '이동장 문을 닫고 무릎 위나 발밑에 두세요. 좌석이나 통로에 올려 두지 않아요.',
  '출퇴근 · 등하교 시간처럼 붐빌 때는 피하고, 배변 패드와 탈취제를 챙기세요.',
  '동물을 무서워하거나 알레르기가 있는 승객이 있으면 자리를 옮겨 주세요.',
];

/** 장애인 보조견 — 이동장 규정과 별개로 탑승을 거부할 수 없어요 (장애인복지법 제40조) */
export const ASSISTANCE_DOG_NOTE = '장애인 보조견은 이동장 없이 탈 수 있고, 정당한 사유 없이 거부할 수 없어요 (장애인복지법 제40조).';

// ─────────────────────────────────────────────────────────────
// 카카오맵 후기 — 카카오는 리뷰 API 를 주지 않아서 카카오맵 검색 결과로 링크해요 (내용을 가져오거나 저장하지 않음)
// ─────────────────────────────────────────────────────────────
export function kakaoPlaceSearchUrl(name, sigungu) {
  const q = [sigungu, name].filter(Boolean).join(' ');
  return `https://map.kakao.com/link/search/${encodeURIComponent(q)}`;
}
