import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { LetterBadge, NowStation } from '../../components/layout/Site.jsx';
import { SittingDog } from '../../components/illust/index.jsx';
import { Button, Field, PasswordField } from '../../components/common/ui.jsx';
import PetFields, { EMPTY_PET, toPetPayload, validatePet } from '../../components/pet/PetFields.jsx';
import { runValidators, validateEmail, validateName, validatePassword, validatePasswordConfirm } from '../../utils/validators.js';

export const MEMBER_STEPS = ['회원가입', '반려동물 등록', '홈 환승', '마이페이지'];
const ACCOUNT_RULES = {
  email: validateEmail,
  password: validatePassword,
  passwordConfirm: (v, all) => validatePasswordConfirm(all.password, v),
  name: validateName,
  role: (v) => (v ? '' : '회원 유형을 선택해 주세요.'),
};
const ROLES = [
  { value: 'USER', title: '일반 회원', desc: '반려인 · 탐색 · 예약 · 쇼핑' },
  { value: 'BUSINESS', title: '사업자 회원', desc: '동물병원 · 펫 호텔 운영' },
];

/** S09 회원가입 · 반려동물 등록 — 계정과 첫 반려동물을 한 번에 */
export default function Signup() {
  const [account, setAccount] = useState({ email: '', password: '', passwordConfirm: '', name: '', role: 'USER' });
  const [pets, setPets] = useState([{ ...EMPTY_PET }]);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({});
  const [emailCheck, setEmailCheck] = useState({ status: 'idle', email: '' }); // idle | checking | ok | taken
  const [serverErrors, setServerErrors] = useState({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const normEmail = account.email.trim().toLowerCase();
  const accErrors = runValidators(account, ACCOUNT_RULES);
  const petErrors = pets.map(validatePet);
  const emailVerified = emailCheck.status === 'ok' && emailCheck.email === normEmail;
  const show = (k) => serverErrors[k] || ((submitted || touched[k]) && accErrors[k]) || '';

  const setAcc = (k) => (e) => {
    const v = e?.target ? e.target.value : e;
    setAccount((a) => ({ ...a, [k]: v }));
    setServerErrors((s) => ({ ...s, [k]: undefined }));
  };
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  const checkEmail = async () => {
    setTouched((t) => ({ ...t, email: true }));
    if (accErrors.email) return;
    setEmailCheck({ status: 'checking', email: normEmail });
    try {
      const { available } = await authApi.checkEmail(normEmail);
      setEmailCheck({ status: available ? 'ok' : 'taken', email: normEmail });
    } catch (e) {
      setEmailCheck({ status: 'idle', email: '' });
      toast.error(e.message);
    }
  };

  const emailMsg = show('email') || (emailCheck.status === 'taken' && emailCheck.email === normEmail ? '이미 가입된 이메일이에요.' : '');

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(accErrors).length || petErrors.some((x) => Object.keys(x).length)) {
      toast.error('입력하지 않은 항목이 있어요.');
      return;
    }
    if (!emailVerified) {
      toast.error('이메일 중복 확인을 해 주세요.');
      return;
    }
    setLoading(true);
    try {
      await signup({ email: normEmail, password: account.password, name: account.name.trim(), role: account.role, pets: pets.map(toPetPayload) });
      toast.show('가입 완료! 펫플래닛 전 노선에 탑승했어요');
      navigate(params.get('redirect') || '/', { replace: true });
    } catch (err) {
      if (err.code === 'DUPLICATE_EMAIL') setEmailCheck({ status: 'taken', email: normEmail });
      if (err.fieldErrors?.length) setServerErrors(err.fieldMap);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <NowStation steps={MEMBER_STEPS} current={step} />
      <section className="ticket-page">
        <div className="container ticket-page__inner">
          <div className="ticket-page__side">
            <p className="ticket-page__en en">
              FIRST
              <br />
              TICKET
            </p>
            <h1 className="ticket-page__title">
              계정 하나로
              <br />
              모든 노선 무제한 환승
            </h1>
            <div className="ticket" aria-label="가입 단계">
              <div className="ticket__head en">
                <span>PET PLANET</span>
                <span>ALL LINES</span>
              </div>
              <ol className="ticket__steps">
                {['계정', '반려동물', '홈 환승'].map((s, i) => (
                  <li key={s} className={i < step ? 'is-done' : i === step ? 'is-current' : ''}>
                    <span />
                    {s}
                  </li>
                ))}
              </ol>
              <div className="ticket__lines">
                {['E', 'R', 'S', 'M'].map((l) => (
                  <LetterBadge key={l} letter={l} size="md" tone="mint" />
                ))}
              </div>
            </div>
            <SittingDog className="ticket-page__dog" size={190} />
          </div>

          <form className="signup-card card" onSubmit={submit} noValidate>
            <fieldset className="signup-card__block" onFocus={() => setStep(0)}>
              <legend className="step-title">
                <span className="step-title__num en">1</span> 계정 정보
              </legend>
              <Field
                label="이메일 (아이디)"
                type="email"
                autoComplete="email"
                placeholder="petplanet@email.com"
                value={account.email}
                onChange={(e) => {
                  setAcc('email')(e);
                  if (emailCheck.status !== 'checking') setEmailCheck({ status: 'idle', email: '' });
                }}
                onBlur={blur('email')}
                error={emailMsg}
                hint={emailVerified ? '사용할 수 있는 이메일이에요' : ''}
                right={
                  <Button type="button" variant="outline" size="md" onClick={checkEmail} loading={emailCheck.status === 'checking'}>
                    중복 확인
                  </Button>
                }
              />
              <div className="grid-2">
                <PasswordField label="비밀번호" autoComplete="new-password" placeholder="영문·숫자·특수문자 8~20자" value={account.password} onChange={setAcc('password')} onBlur={blur('password')} error={show('password')} />
                <PasswordField label="비밀번호 확인" autoComplete="new-password" placeholder="한 번 더 입력" value={account.passwordConfirm} onChange={setAcc('passwordConfirm')} onBlur={blur('passwordConfirm')} error={show('passwordConfirm')} />
              </div>
              <Field label="이름" autoComplete="name" placeholder="2~10자" value={account.name} onChange={setAcc('name')} onBlur={blur('name')} error={show('name')} />
              <div className="role-cards" role="radiogroup" aria-label="회원 유형">
                {ROLES.map((r) => (
                  <label key={r.value} className={`role-card ${account.role === r.value ? 'is-on' : ''}`}>
                    <input type="radio" name="role" value={r.value} checked={account.role === r.value} onChange={() => setAcc('role')(r.value)} />
                    <span>
                      <b>{r.title}</b>
                      <small>{r.desc}</small>
                    </span>
                  </label>
                ))}
              </div>
              {show('role') && <p className="field__error">{show('role')}</p>}
            </fieldset>

            <hr className="dashed" />

            {pets.map((pet, i) => (
              <fieldset key={i} className="signup-card__block" onFocus={() => setStep(1)}>
                <legend className="step-title">
                  <span className="step-title__num en">2</span> {i === 0 ? '첫 반려동물 등록' : `반려동물 ${i + 1}`}
                  {i > 0 && (
                    <button type="button" className="btn btn--text step-title__remove" onClick={() => setPets((ps) => ps.filter((_, j) => j !== i))}>
                      삭제
                    </button>
                  )}
                </legend>
                <PetFields
                  idPrefix={`pet${i}`}
                  value={pet}
                  onChange={(v) => setPets((ps) => ps.map((p, j) => (j === i ? v : p)))}
                  errors={submitted ? petErrors[i] : {}}
                />
              </fieldset>
            ))}
            {pets.length < 5 && (
              <button type="button" className="add-more" onClick={() => setPets((ps) => [...ps, { ...EMPTY_PET }])}>
                + 반려동물 더 등록하기
              </button>
            )}

            <div className="signup-card__submit">
              <Button type="submit" size="lg" loading={loading}>
                가입하고 출발하기 →
              </Button>
              <p className="muted">
                이미 계정이 있나요? <Link to="/login" className="text-link">로그인</Link>
              </p>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
