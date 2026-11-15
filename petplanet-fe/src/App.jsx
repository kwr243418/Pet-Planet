import { useCallback } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider, useToast } from './components/common/Toast.jsx';
import { GuestOnly, RequireAuth, TabLayout } from './layouts/AppLayout.jsx';
import Onboarding, { ONBOARDED_KEY } from './pages/Onboarding.jsx';
import Login from './pages/auth/Login.jsx';
import Signup from './pages/auth/Signup.jsx';
import FindPassword from './pages/auth/FindPassword.jsx';
import PetForm from './pages/pets/PetForm.jsx';
import Home from './pages/Home.jsx';
import Explore from './pages/Explore.jsx';
import PlaceDetail from './pages/PlaceDetail.jsx';
import Bookmarks from './pages/Bookmarks.jsx';
import MyPage from './pages/MyPage.jsx';
import { ComingSoon, NotFound } from './pages/Placeholder.jsx';

/** 첫 방문이면 온보딩으로 */
function FirstVisitGate({ children }) {
  return localStorage.getItem(ONBOARDED_KEY) ? children : <Navigate to="/onboarding" replace />;
}

/** 토큰 만료 시 로그인 화면으로 보내기 위해 Router 안쪽에서 AuthProvider 구성 */
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
          <div className="app-frame">
            <Routes>
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
              <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
              <Route path="/find-password" element={<FindPassword />} />
              <Route path="/pets/new" element={<RequireAuth><PetForm /></RequireAuth>} />
              <Route path="/pets/:petId/edit" element={<RequireAuth><PetForm /></RequireAuth>} />

              <Route element={<TabLayout />}>
                <Route path="/" element={<FirstVisitGate><Home /></FirstVisitGate>} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/places/:placeId" element={<PlaceDetail />} />
                <Route path="/bookmarks" element={<RequireAuth><Bookmarks /></RequireAuth>} />
                <Route path="/mypage" element={<RequireAuth><MyPage /></RequireAuth>} />
                {/* ↓ FE2 담당 화면 연결 지점 */}
                <Route path="/reservations/*" element={<ComingSoon title="예약" />} />
                <Route path="/shop/*" element={<ComingSoon title="쇼핑" />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </Providers>
      </ToastProvider>
    </BrowserRouter>
  );
}
