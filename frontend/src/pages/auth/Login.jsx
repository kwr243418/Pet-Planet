import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { Button, Field, PasswordField } from '../../components/common/ui.jsx';
import { SittingDog } from '../../components/illust/index.jsx';
import { USE_MOCK } from '../../api/client.js';
import { validateEmail } from '../../utils/validators.js';

/** 로그인/비밀번호 찾기 공통 틀 — 민트 배경 + 큰 영문 제목 + 흰 카드 */
export function AuthFrame({ en, title, children }) {
  return (
    <section className="ticket-page ticket-page--auth">
      <div className="container ticket-page__inner">
        <div className="ticket-page__side">
          <p className="ticket-page__en en">{en}</p>
          <h1 className="ticket-page__title">{title}</h1>
          <SittingDog className="ticket-page__dog" size={170} />
        </div>
        <div className="auth-card card">{children}</div>
      </div>
    </section>
  );
}

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/';

  const onChange = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: '' }));
    setFormError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = { email: validateEmail(form.email), password: form.password ? '' : '비밀번호를 입력해 주세요.' };
    setErrors(errs);
    if (errs.email || errs.password) return;
    setLoading(true);
    try {
      const user = await login(form.email.trim(), form.password);
      toast.show(`${user.name} 님, 다시 만나서 반가워요`);
      navigate(redirect, { replace: true });
    } catch (err) {
      if (err.status === 401) setFormError(err.message);
      else toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame
      en={
        <>
          WELCOME
          <br />
          ABOARD
        </>
      }
      title={
        <>
          다시 탑승하고
          <br />
          모든 노선으로 출발해요
        </>
      }
    >
      <h2 className="auth-card__title">로그인</h2>
      <form className="form-stack" onSubmit={submit} noValidate>
        <Field label="이메일 (아이디)" type="email" autoComplete="email" placeholder="petplanet@email.com" value={form.email} onChange={onChange('email')} error={errors.email} />
        <PasswordField label="비밀번호" autoComplete="current-password" placeholder="비밀번호" value={form.password} onChange={onChange('password')} error={errors.password} />
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" block loading={loading}>
          로그인
        </Button>
      </form>
      <div className="auth-card__links">
        <Link to="/find-password">비밀번호 찾기</Link>
        <span aria-hidden>·</span>
        <Link to={`/signup${params.get('redirect') ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>회원가입</Link>
      </div>
      {USE_MOCK && (
        <button type="button" className="demo-hint" onClick={() => setForm({ email: 'demo@petplanet.kr', password: 'petplanet123!' })}>
          목 서버 데모 계정 채우기 · demo@petplanet.kr / petplanet123!
        </button>
      )}
    </AuthFrame>
  );
}
