import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { Button, Field, PasswordField } from '../../components/common/ui.jsx';
import Mascot from '../../components/common/Mascot.jsx';
import { Logo } from '../../components/common/Header.jsx';
import Header from '../../components/common/Header.jsx';
import { USE_MOCK } from '../../api/client.js';
import { validateEmail } from '../../utils/validators.js';

/** 로그인 (Day 3 UI · Day 5 API 연동/예외 처리) */
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

  const onChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((er) => ({ ...er, [e.target.name]: '' }));
    setFormError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {
      email: validateEmail(form.email),
      password: form.password ? '' : '비밀번호를 입력해 주세요.',
    };
    setErrors(errs);
    if (errs.email || errs.password) return;
    setLoading(true);
    try {
      const user = await login(form.email.trim(), form.password);
      toast.success(`${user.name}님, 반가워요!`);
      navigate(redirect, { replace: true });
    } catch (err) {
      // 401: 계정 불일치 → 폼 하단 메시지 / 그 외(네트워크·서버) → 토스트
      if (err.status === 401) setFormError(err.message);
      else toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page--no-nav auth">
      <Header back="/" transparent />
      <div className="auth__hero">
        <Mascot size={92} mood="love" className="bob" />
        <Logo size={32} />
        <p className="auth__sub">우리 아이랑 갈 곳, 펫플래닛에서 찾아요</p>
      </div>

      <form className="stack" onSubmit={submit} noValidate>
        <Field label="이메일" name="email" type="email" autoComplete="email" placeholder="petplanet@email.com" value={form.email} onChange={onChange} error={errors.email} />
        <PasswordField label="비밀번호" name="password" autoComplete="current-password" placeholder="비밀번호 입력" value={form.password} onChange={onChange} error={errors.password} />
        {formError && (
          <p className="form-error" role="alert">
            🥺 {formError}
          </p>
        )}
        <Button type="submit" block loading={loading}>
          로그인
        </Button>
      </form>

      <div className="auth__links">
        <Link to="/find-password">비밀번호 찾기</Link>
        <span aria-hidden>|</span>
        <Link to={`/signup${params.get('redirect') ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>회원가입</Link>
      </div>

      {USE_MOCK && (
        <button type="button" className="demo-hint" onClick={() => setForm({ email: 'demo@petplanet.kr', password: 'petplanet123!' })}>
          🧪 목 서버 데모 계정 채우기 <small>demo@petplanet.kr / petplanet123!</small>
        </button>
      )}
    </div>
  );
}
