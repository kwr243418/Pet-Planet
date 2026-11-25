// 주소 → 지역(시/도 짧은 이름, 시/군/구). 백엔드 transit/Region.java · db/patch_bus_transit.sql · 적재기와 같은 규칙
// "전라남도 목포시 …" · "전남광주통합특별시 목포시 …" → { sido: '전남광주', sigungu: '목포시' } · "세종특별자치시 …" → { sido: '세종', sigungu: '세종시' }
// 2026-07-01 전남 · 광주가 전남광주통합특별시로 합쳐져서 예전 주소와 새 주소를 같은 지역으로 묶어요.

export const SIDO_ORDER = ['서울', '부산', '대구', '인천', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남광주', '경북', '경남', '제주'];

const ALIAS = {
  서울: ['서울특별시', '서울시', '서울'],
  부산: ['부산광역시', '부산시', '부산'],
  대구: ['대구광역시', '대구시', '대구'],
  인천: ['인천광역시', '인천시', '인천'],
  대전: ['대전광역시', '대전시', '대전'],
  울산: ['울산광역시', '울산시', '울산'],
  세종: ['세종특별자치시', '세종시', '세종'],
  경기: ['경기도', '경기'],
  강원: ['강원특별자치도', '강원도', '강원'],
  충북: ['충청북도', '충북'],
  충남: ['충청남도', '충남'],
  전북: ['전북특별자치도', '전라북도', '전북'],
  전남광주: ['전남광주통합특별시', '전남광주특별시', '광주특별시', '전남광주', '전라남도', '전남', '광주광역시', '광주'],
  경북: ['경상북도', '경북'],
  경남: ['경상남도', '경남'],
  제주: ['제주특별자치도', '제주도', '제주'],
};
const SIDO_OF = Object.fromEntries(Object.entries(ALIAS).flatMap(([sido, names]) => names.map((n) => [n, sido])));

export function parseRegion(address) {
  const t = String(address ?? '').trim().split(/\s+/);
  const sido = SIDO_OF[t[0]] ?? null;
  if (!sido) return { sido: null, sigungu: null };
  if (sido === '세종') return { sido, sigungu: '세종시' };
  const second = t[1] ?? '';
  return { sido, sigungu: /(시|군|구)$/.test(second) ? second : null };
}

export const normalizeSido = (s) => SIDO_OF[String(s ?? '').trim()] ?? null;

/** "전남 목포시" · "서울 마포구" */
export const regionLabel = (r) => [r?.sido, r?.sigungu].filter(Boolean).join(' ');
