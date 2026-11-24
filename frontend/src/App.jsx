import { useCallback } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider, useToast } from './components/common/Toast.jsx';
import { PageLoader } from './components/common/ui.jsx';
import { SiteFooter, SiteHeader } from './components/layout/Site.jsx';
import { ErrorBoundary, OfflineBanner, ScrollToTop } from './components/layout/AppChrome.jsx';
import Home from './pages/Home.jsx';
import Explore from './pages/Explore.jsx';
import PlaceDetail from './pages/PlaceDetail.jsx';
import Signup from './pages/auth/Signup.jsx';
import Login from './pages/auth/Login.jsx';
import FindPassword from './pages/auth/FindPassword.jsx';
import MyPage from './pages/MyPage.jsx';
import PetForm from './pages/pets/PetForm.jsx';
import { NotFound } from './pages/Placeholder.jsx';
import { CartOrderPage, HospitalDetailPage, HospitalReservePage, HotelReservePage, StorePage } from './pages/fe2/Fe2Screens.jsx';

/** 로그인 필요 화면 → /login?redirect=원래경로 */
function RequireAuth({ children }) {
  const { isLoggedIn, booting } = useAuth();
  const location = useLocation();
  if (booting) return <PageLoader />;
  if (!isLoggedIn) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

function GuestOnly({ children }) {
  const { isLoggedIn, booting } = useAuth();
  if (booting) return <PageLoader />;
  return isLoggedIn ? <Navigate to="/" replace /> : children;
}

/** 공통 레이아웃: 헤더(홈은 크림, 나머지는 민트 상단과 이어지게) + 본문 + 푸터 */
function Shell() {
  const { pathname } = useLocation();
  return (
    <>
      <ScrollToTop />
      <OfflineBanner />
      <SiteHeader tone={pathname === '/' ? 'cream' : 'mint'} />
      <main>
        <ErrorBoundary resetKey={pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          {/* E 탐색선 (FE1) */}
          <Route path="/explore" element={<Explore />} />
          <Route path="/places/:placeId" element={<PlaceDetail />} />
          {/* M 마이선 (FE1: 가입·회원·반려동물·리뷰·찜 / FE2: 예약·주문 영역) */}
          <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/find-password" element={<FindPassword />} />
          <Route path="/mypage" element={<RequireAuth><MyPage /></RequireAuth>} />
          <Route path="/pets/new" element={<RequireAuth><PetForm /></RequireAuth>} />
          <Route path="/pets/:petId/edit" element={<RequireAuth><PetForm /></RequireAuth>} />
          <Route path="/bookmarks" element={<Navigate to="/mypage#bookmarks" replace />} />
          {/* R 예약선 · S 쇼핑선 (FE2) — 지금은 뼈대 화면, src/pages/fe2/ 에서 구현 */}
          <Route path="/reservations" element={<Navigate to="/reservations/hospital" replace />} />
          <Route path="/reservations/hospital" element={<HospitalReservePage />} />
          <Route path="/reservations/hotel" element={<HotelReservePage />} />
          <Route path="/hospitals/:hospitalId" element={<HospitalDetailPage />} />
          <Route path="/shop" element={<StorePage />} />
          <Route path="/cart" element={<RequireAuth><CartOrderPage /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </ErrorBoundary>
      </main>
      <SiteFooter />
    </>
  );
}

function Providers({ children }) {
  const navigate = useNavigate();
  const toast = useToast();
  const onExpired = useCallback(() => {
    toast.error('로그인이 만료됐어요. 다시 로그인해 주세요.');
    navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`, { replace: true });
  }, [navigate, toast]);
  return <AuthProvider onExpired={onExpired}>{children}</AuthProvider>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Providers>
          <Shell />
        </Providers>
      </ToastProvider>
    </BrowserRouter>
  );
}
