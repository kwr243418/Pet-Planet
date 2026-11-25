// 화면 표시용 포맷터 & 도메인 상수

export const SIZE_LABEL = { SMALL: '소형견', MEDIUM: '중형견', LARGE: '대형견' };
/** 장소의 동반 가능 최대 크기 → 짧은 표기 (목업: "소 · 중형견", "전 크기") */
export const MAX_SIZE_SHORT = { SMALL: '소형', MEDIUM: '소·중형', LARGE: '전 크기' };
export const MAX_SIZE_LONG = { SMALL: '소형견만', MEDIUM: '소 · 중형견', LARGE: '대형견 가능' };
export const SIZE_ORDER = { SMALL: 1, MEDIUM: 2, LARGE: 3 };
export const INDOOR_LABEL = { INDOOR: '실내 동반', OUTDOOR: '실외 동반', BOTH: '실내·외 동반' };
export const INDOOR_SHORT = { INDOOR: '실내', OUTDOOR: '실외', BOTH: '실내·외' };
export const ROLE_LABEL = { USER: '일반 회원', BUSINESS: '사업자 회원', ADMIN: '관리자' };
export const GENDER_LABEL = { MALE: '수컷', FEMALE: '암컷' }; // DB pets.gender ENUM('MALE','FEMALE')

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

/** 목업 표기: 0.3km 처럼 항상 km, 소수 1자리 */
export function formatKm(km) {
  if (km == null) return '';
  return `${Math.max(0.1, Math.round(km * 10) / 10).toFixed(1)}km`;
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

/**
 * 휴대폰 번호 자동 하이픈: 숫자만 남기고 010-1234-5678 모양으로 (최대 11자리)
 * 입력 중엔 3-4-4로 끊고, 다 입력한 10자리(011-123-4567 같은 옛 번호)는 final=true일 때 3-3-4로
 */
export function formatPhone(value, { final = false } = {}) {
  const d = String(value ?? '').replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (final && d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
