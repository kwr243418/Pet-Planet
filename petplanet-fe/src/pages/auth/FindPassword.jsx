import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/index.js';
import Header from '../../components/common/Header.jsx';
import Mascot from '../../components/common/Mascot.jsx';
import { Button, Field } from '../../components/common/ui.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { maskEmail } from '../../utils/format.js';
import { USE_MOCK } from '../../api/client.js';
import { validateEmail, validateName } from '../../utils/validators.js';

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
      const res = await authApi.resetPassword(form.email.trim(), form.name.trim());
      setSentTo(res.email);
    } catch (err) {
      if (err.status === 404) setErrors({ name: err.message });
      else toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <div className="page page--no-nav">
        <Header back="/login" title="비밀번호 찾기" />
        <div className="state" style={{ paddingTop: 60 }}>
          <Mascot size={120} mood="love" />
          <p className="state__title">메일을 보냈어요!</p>
          <p className="state__desc">
            <b>{maskEmail(sentTo)}</b> 으로{'\n'}임시 비밀번호를 보내드렸어요.{'\n'}로그인 후 비밀번호를 꼭 변경해 주세요.
          </p>
          {USE_MOCK && <p className="demo-hint demo-hint--static">🧪 목 서버 임시 비밀번호: temp1234!</p>}
          <Link to="/login" className="btn btn--primary btn--lg btn--block" style={{ marginTop: 12 }}>
            로그인하러 가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--no-nav">
      <Header back title="비밀번호 찾기" />
      <p className="page-lead">
        가입한 <b>이메일</b>과 <b>이름</b>을 입력하면
        <br />
        임시 비밀번호를 보내드려요
      </p>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="이메일" name="email" type="email" placeholder="petplanet@email.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} error={errors.email} />
        <Field label="이름" name="name" placeholder="가입 시 입력한 이름" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} />
        <Button type="submit" block loading={loading}>
          임시 비밀번호 받기
        </Button>
      </form>
    </div>
  );
}
