import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/index.js';
import { USE_MOCK } from '../../api/client.js';
import { Button, Field } from '../../components/common/ui.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { maskEmail } from '../../utils/format.js';
import { validateEmail, validateName } from '../../utils/validators.js';
import { AuthFrame } from './Login.jsx';

/** 비밀번호 찾기 — 이메일 + 이름 확인 후 임시 비밀번호 발송 */
export default function FindPassword() {
  const [form, setForm] = useState({ email: '', name: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    const errs = { email: validateEmail(form.email), name: validateName(form.name) };
    setErrors(errs);
    if (errs.email || errs.name) return;
    setLoading(true);
    try {
      setSentTo((await authApi.resetPassword(form.email.trim(), form.name.trim())).email);
    } catch (err) {
      if (err.status === 404) setErrors({ name: err.message });
      else toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame
      en={
        <>
          LOST
          <br />
          TICKET
        </>
      }
      title={
        <>
          비밀번호를 잊으셨나요?
          <br />
          새 승차권을 보내 드려요
        </>
      }
    >
      {sentTo ? (
        <div className="form-stack">
          <h2 className="auth-card__title">메일을 보냈어요</h2>
          <p className="muted">
            <b>{maskEmail(sentTo)}</b> 으로 임시 비밀번호를 보냈어요. 로그인 후 비밀번호를 꼭 바꿔 주세요.
          </p>
          {USE_MOCK && <p className="demo-hint demo-hint--static">목 서버 임시 비밀번호: temp1234!</p>}
          <Link to="/login" className="btn btn--primary btn--lg btn--block">
            로그인하러 가기
          </Link>
        </div>
      ) : (
        <>
          <h2 className="auth-card__title">비밀번호 찾기</h2>
          <p className="muted auth-card__desc">가입한 이메일과 이름을 입력하면 임시 비밀번호를 보내 드려요.</p>
          <form className="form-stack" onSubmit={submit} noValidate>
            <Field label="이메일 (아이디)" type="email" placeholder="petplanet@email.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} error={errors.email} />
            <Field label="이름" placeholder="가입할 때 입력한 이름" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} />
            <Button type="submit" size="lg" block loading={loading}>
              임시 비밀번호 받기
            </Button>
          </form>
          <div className="auth-card__links">
            <Link to="/login">로그인으로 돌아가기</Link>
          </div>
        </>
      )}
    </AuthFrame>
  );
}
