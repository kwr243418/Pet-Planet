import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, petApi } from '../api/index.js';
import { AUTH_EXPIRED_EVENT, tokenStore } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children, onExpired }) {
  const [user, setUser] = useState(null);
  const [pets, setPets] = useState([]);
  const [booting, setBooting] = useState(!!tokenStore.get());

  const loadPets = useCallback(async () => {
    try {
      setPets(await petApi.list());
    } catch {
      setPets([]);
    }
  }, []);

  // 새로고침 시 토큰으로 로그인 상태 복원
  useEffect(() => {
    if (!tokenStore.get()) return;
    authApi
      .me()
      .then((me) => {
        setUser(me);
        return loadPets();
      })
      .catch(() => tokenStore.clear())
      .finally(() => setBooting(false));
  }, [loadPets]);

  // 토큰 만료(401) → 로그아웃
  useEffect(() => {
    const handler = () => {
      setUser(null);
      setPets([]);
      onExpired?.();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, [onExpired]);

  const applySession = useCallback(
    async ({ accessToken, user: u }) => {
      tokenStore.set(accessToken);
      setUser(u);
      await loadPets();
      return u;
    },
    [loadPets],
  );

  const login = useCallback(async (email, password) => applySession(await authApi.login(email, password)), [applySession]);
  const signup = useCallback(async (payload) => applySession(await authApi.signup(payload)), [applySession]);
  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setPets([]);
  }, []);

  const value = useMemo(
    () => ({ user, pets, primaryPet: pets[0] ?? null, isLoggedIn: !!user, booting, login, signup, logout, reloadPets: loadPets }),
    [user, pets, booting, login, signup, logout, loadPets],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
