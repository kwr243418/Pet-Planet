// 화면 표시용 포맷터 & 도메인 상수

export const SIZE_LABEL = { SMALL: '소형견', MEDIUM: '중형견', LARGE: '대형견' };
export const SIZE_ORDER = { SMALL: 1, MEDIUM: 2, LARGE: 3 };
export const INDOOR_LABEL = { INDOOR: '실내 동반', OUTDOOR: '실외만 동반', BOTH: '실내·외 동반' };
export const GENDER_LABEL = { M: '남아', F: '여아' };

/** 몸무게(kg) → 크기 구분 (소형 <10kg, 중형 10~25kg, 대형 >25kg) */
export function sizeFromWeight(kg) {
  const n = Number(kg);
  if (!n) return null;
  if (n < 10) return 'SMALL';
  if (n <= 25) return 'MEDIUM';
  return 'LARGE';
}

/** 장소의 동반 가능 최대 크기로 이 아이가 함께 갈 수 있는지 */
export function canBring(placeMaxSize, petWeightKg) {
  const petSize = sizeFromWeight(petWeightKg);
  if (!placeMaxSize || !petSize) return null;
  return SIZE_ORDER[petSize] <= SIZE_ORDER[placeMaxSize];
}

export function formatDistance(km) {
  if (km == null) return '';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

export function formatRating(r) {
  if (r == null || Number.isNaN(Number(r))) return '0.0';
  return Number(r).toFixed(1);
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function formatRelative(iso, now = Date.now()) {
  const diff = Math.floor((now - new Date(iso).getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  return formatDate(iso);
}

/** 이메일 마스킹: petplanet@gmail.com → pe*******@gmail.com */
export function maskEmail(email = '') {
  const [id, domain] = email.split('@');
  if (!domain) return email;
  return `${id.slice(0, 2)}${'*'.repeat(Math.max(1, id.length - 2))}@${domain}`;
}
