// 입력 폼 유효성 검사 — 각 함수는 에러 메시지(string) 또는 ''(통과)를 반환합니다.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]).{8,20}$/;

export function validateEmail(v) {
  const value = (v ?? '').trim();
  if (!value) return '이메일을 입력해 주세요.';
  if (!EMAIL_RE.test(value)) return '이메일 형식이 올바르지 않아요.';
  return '';
}

export function validatePassword(v) {
  if (!v) return '비밀번호를 입력해 주세요.';
  if (!PASSWORD_RE.test(v)) return '영문, 숫자, 특수문자를 포함해 8~20자로 입력해 주세요.';
  return '';
}

export function validatePasswordConfirm(pw, confirm) {
  if (!confirm) return '비밀번호를 한 번 더 입력해 주세요.';
  if (pw !== confirm) return '비밀번호가 일치하지 않아요.';
  return '';
}

export function validateName(v) {
  const value = (v ?? '').trim();
  if (!value) return '이름을 입력해 주세요.';
  if (value.length < 2 || value.length > 10) return '이름은 2~10자로 입력해 주세요.';
  if (!/^[가-힣a-zA-Z\s]+$/.test(value)) return '이름은 한글 또는 영문만 사용할 수 있어요.';
  return '';
}

export function validatePetName(v) {
  const value = (v ?? '').trim();
  if (!value) return '아이 이름을 알려주세요.';
  if (value.length > 12) return '이름은 12자 이내로 입력해 주세요.';
  return '';
}

export function validateBreed(v) {
  const value = (v ?? '').trim();
  if (!value) return '품종을 입력해 주세요. (모르면 "믹스")';
  if (value.length > 20) return '품종은 20자 이내로 입력해 주세요.';
  return '';
}

export function validateWeight(raw) {
  if (raw === '' || raw === null || raw === undefined) return '몸무게를 입력해 주세요.';
  const v = String(raw).replace(/\.$/, ''); // "18." 처럼 점으로 끝나도 18로 봐요
  const n = Number(v);
  if (Number.isNaN(n)) return '숫자로 입력해 주세요.';
  if (n <= 0 || n > 100) return '0.1kg ~ 100kg 사이로 입력해 주세요.';
  if (!/^\d+(\.\d)?$/.test(String(v))) return '소수점은 한 자리까지만 입력해 주세요.';
  return '';
}

export const REVIEW_MIN = 10;
export const REVIEW_MAX = 500;

export function validateReview({ rating, content }) {
  const errors = {};
  if (!rating || rating < 1 || rating > 5) errors.rating = '별점을 선택해 주세요.';
  const text = (content ?? '').trim();
  if (text.length < REVIEW_MIN) errors.content = `리뷰는 ${REVIEW_MIN}자 이상 작성해 주세요.`;
  else if (text.length > REVIEW_MAX) errors.content = `리뷰는 ${REVIEW_MAX}자 이내로 작성해 주세요.`;
  return errors;
}

/** { field: validatorFn } 맵을 받아 에러 객체를 만들어 줍니다. */
export function runValidators(values, rules) {
  const errors = {};
  for (const [field, fn] of Object.entries(rules)) {
    const msg = fn(values[field], values);
    if (msg) errors[field] = msg;
  }
  return errors;
}
