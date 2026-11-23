import { Link } from 'react-router-dom';
import { EmptyState } from '../components/common/ui.jsx';

export function NotFound() {
  return (
    <div className="container">
      <EmptyState
        title="없는 역이에요"
        desc="요청한 페이지를 찾을 수 없어요."
        action={
          <Link to="/" className="btn btn--primary btn--md">
            홈으로 가기
          </Link>
        }
      />
    </div>
  );
}
