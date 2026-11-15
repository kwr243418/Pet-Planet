import { Navigate, Outlet, useLocation } from 'react-router-dom';
import BottomNav from '../components/common/BottomNav.jsx';
import { PageLoader } from '../components/common/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/** 하단 탭이 있는 메인 레이아웃 */
export function TabLayout() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
}

/** 로그인이 필요한 화면 보호 — 비로그인 시 /login?redirect=원래경로 */
export function RequireAuth({ children }) {
  const { isLoggedIn, booting } = useAuth();
  const location = useLocation();
  if (booting) return <PageLoader />;
  if (!isLoggedIn) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  return children;
}

/** 이미 로그인한 사용자가 로그인/회원가입 화면에 오면 홈으로 */
export function GuestOnly({ children }) {
  const { isLoggedIn, booting } = useAuth();
  if (booting) return <PageLoader />;
  if (isLoggedIn) return <Navigate to="/" replace />;
  return children;
}
