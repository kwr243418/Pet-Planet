import { Link } from 'react-router-dom';
import Header from '../components/common/Header.jsx';
import { EmptyState } from '../components/common/ui.jsx';

/** FE2(예약/쇼핑) 화면이 연결될 자리 — FE2 브랜치 머지 시 App.jsx 라우트만 교체하면 됩니다. */
export function ComingSoon({ title }) {
  return (
    <div className="page">
      <Header title={title} />
      <EmptyState title="곧 만나요!" desc={`${title} 화면을 열심히 준비하고 있어요 🐾`} mood="happy" />
    </div>
  );
}

export function NotFound() {
  return (
    <div className="page page--no-nav">
      <Header back />
      <EmptyState
        title="길을 잃었어요"
        desc="요청한 페이지를 찾을 수 없어요."
        mood="sad"
        action={
          <Link to="/" className="btn btn--primary btn--md">
            홈으로 가기
          </Link>
        }
      />
    </div>
  );
}
