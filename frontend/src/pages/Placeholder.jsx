import { Link } from 'react-router-dom';
import { EmptyState } from '../components/common/ui.jsx';
import { usePageTitle } from '../hooks/usePage.js';

export function NotFound() {
  usePageTitle('없는 페이지');
  return (
    <div className="container">
      <EmptyState
        title="없는 역이에요"
        desc="요청한 페이지를 찾을 수 없어요."
        action={
          <Link to="/home" className="btn btn--primary btn--md">
            홈으로 가기
          </Link>
        }
      />
    </div>
  );
}
