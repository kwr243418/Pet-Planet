import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import Header from '../../components/common/Header.jsx';
import { Button, Field, PasswordField } from '../../components/common/ui.jsx';
import { runValidators, validateEmail, validateName, validatePassword, validatePasswordConfirm } from '../../utils/validators.js';

const RULES = {
  email: validateEmail,
  password: validatePassword,
  passwordConfirm: (v, all) => validatePasswordConfirm(all.password, v),
  name: validateName,
};

/** 회원가입 (Day 3) — 이메일 중복확인, 실시간 유효성 검사, 약관 동의 */
export default function Signup() {
  const [form, setForm] = useState({ email: '', password: '', passwordConfirm: '', name: '' });
  const [touched, setTouched] = useState({});
  const [emailCheck, setEmailCheck] = useState({ status: 'idle', checkedEmail: '' }); // idle | checking | ok | taken
  const [agree, setAgree] = useState({ terms: false, privacy: false });
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const errors = runValidators(form, RULES);
  const show = (k) => (touched[k] ? errors[k] : '');
  const emailVerified = emailCheck.status === 'ok' && emailCheck.checkedEmail === form.email.trim().toLowerCase();

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const onBlur = (e) => setTouched((t) => ({ ...t, [e.target.name]: true }));

  const checkEmail = async () => {
    setTouched((t) => ({ ...t, email: true }));
    if (errors.email) return;
    setEmailCheck({ status: 'checking' });
    try {
      const { available } = await authApi.checkEmail(form.email.trim().toLowerCase());
      setEmailCheck({ status: available ? 'ok' : 'taken', checkedEmail: form.email.trim().toLowerCase() });
    } catch (e) {
      setEmailCheck({ status: 'idle' });
      toast.error(e.message);
    }
  };

  const emailMsg =
    show('email') ||
    (emailCheck.status === 'taken' && emailCheck.checkedEmail === form.email.trim().toLowerCase() ? '이미 가입된 이메일이에요.' : '');

  const canSubmit = !Object.keys(errors).length && emailVerified && agree.terms && agree.privacy;

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true, passwordConfirm: true, name: true });
    if (!emailVerified) {
      toast.show('이메일 중복확인을 해 주세요');
      return;
    }
    if (!canSubmit) return;
    setLoading(true);
    try {
      await signup({ email: form.email.trim().toLowerCase(), password: form.password, name: form.name.trim() });
      toast.success('가입을 환영해요! 🎉');
      const redirect = params.get('redirect');
      navigate(`/pets/new?from=signup${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}`, { replace: true });
    } catch (err) {
      if (err.code === 'DUPLICATE_EMAIL') setEmailCheck({ status: 'taken', checkedEmail: form.email.trim().toLowerCase() });
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page--no-nav">
      <Header back title="회원가입" />
      <p className="page-lead">
        반가워요! 🐾
        <br />
        <b>펫플래닛</b> 가족이 되어 주세요
      </p>
      <form className="stack" onSubmit={submit} noValidate>
        <Field
          label="이메일"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="petplanet@email.com"
          value={form.email}
          onChange={(e) => {
            onChange(e);
            setEmailCheck((c) => (c.status === 'checking' ? c : { status: 'idle' }));
          }}
          onBlur={onBlur}
          error={emailMsg}
          hint={emailVerified ? '사용할 수 있는 이메일이에요 ✓' : ''}
          right={
            <Button type="button" variant={emailVerified ? 'soft' : 'outline'} size="sm" onClick={checkEmail} loading={emailCheck.status === 'checking'}>
              {emailVerified ? '확인완료' : '중복확인'}
            </Button>
          }
        />
        <PasswordField
          label="비밀번호"
          name="password"
          autoComplete="new-password"
          placeholder="영문·숫자·특수문자 포함 8~20자"
          value={form.password}
          onChange={onChange}
          onBlur={onBlur}
          error={show('password')}
          hint={touched.password && !errors.password ? '안전한 비밀번호예요 ✓' : ''}
        />
        <PasswordField
          label="비밀번호 확인"
          name="passwordConfirm"
          autoComplete="new-password"
          placeholder="비밀번호를 한 번 더 입력"
          value={form.passwordConfirm}
          onChange={onChange}
          onBlur={onBlur}
          error={show('passwordConfirm')}
          hint={touched.passwordConfirm && !errors.passwordConfirm ? '비밀번호가 일치해요 ✓' : ''}
        />
        <Field label="이름" name="name" autoComplete="name" placeholder="2~10자" value={form.name} onChange={onChange} onBlur={onBlur} error={show('name')} />

        <div className="agree">
          <label className="check check--all">
            <input
              type="checkbox"
              checked={agree.terms && agree.privacy}
              onChange={(e) => setAgree({ terms: e.target.checked, privacy: e.target.checked })}
            />
            <span>전체 동의</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={agree.terms} onChange={(e) => setAgree((a) => ({ ...a, terms: e.target.checked }))} />
            <span>[필수] 서비스 이용약관 동의</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={agree.privacy} onChange={(e) => setAgree((a) => ({ ...a, privacy: e.target.checked }))} />
            <span>[필수] 개인정보 수집·이용 동의</span>
          </label>
        </div>

        {Object.keys(touched).length === 4 && !(agree.terms && agree.privacy) && (
          <p className="field__error">필수 약관에 동의해 주세요.</p>
        )}
        <Button type="submit" block loading={loading}>
          가입하기
        </Button>
      </form>
    </div>
  );
}
