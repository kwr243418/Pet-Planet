import { NavLink } from 'react-router-dom';

const I = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  map: (
    <>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </>
  ),
  me: (
    <>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4 20.5c1.5-4 4.5-5.5 8-5.5s6.5 1.5 8 5.5" />
    </>
  ),
};

// 예약/쇼핑 탭은 FE2 담당 화면이 연결될 자리입니다.
const TABS = [
  { to: '/', label: '홈', icon: 'home', end: true },
  { to: '/explore', label: '장소탐색', icon: 'map' },
  { to: '/reservations', label: '예약', icon: 'calendar' },
  { to: '/shop', label: '쇼핑', icon: 'bag' },
  { to: '/mypage', label: '마이', icon: 'me' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `bottom-nav__item ${isActive ? 'is-active' : ''}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {I[t.icon]}
          </svg>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
