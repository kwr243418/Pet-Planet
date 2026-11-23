import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { LogoMark } from '../illust/index.jsx';

export const LINES_NAV = [
  { key: 'E', label: '역세권 탐색', short: '탐색', name: '탐색선', to: '/explore', match: ['/explore', '/places'] },
  { key: 'R', label: '병원 · 호텔', short: '예약', name: '예약선', to: '/reservations/hospital', match: ['/reservations', '/hospitals'] },
  { key: 'S', label: '펫 스토어', short: '스토어', name: '쇼핑선', to: '/shop', match: ['/shop', '/cart'] },
  { key: 'M', label: '마이페이지', short: '마이', name: '마이선', to: '/mypage', match: ['/mypage', '/signup', '/pets'] },
];

/** 노선 글자 원 배지 (E·R·S·M) */
export function LetterBadge({ letter, size = 'md', tone = 'green' }) {
  return <span className={`letter letter--${size} letter--${tone}`}>{letter}</span>;
}

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="PET PLANET 홈">
      <LogoMark />
      <span className="logo__text">PET PLANET</span>
    </Link>
  );
}

/** 공통 헤더: 로고 · 노선 메뉴 4개 · 장바구니 · 로그인. 현재 노선은 흰 배경 */
export function SiteHeader({ tone = 'mint' }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className={`site-header site-header--${tone}`}>
      <div className="container site-header__inner">
        <Logo />
        <nav className="line-nav" aria-label="노선 메뉴">
          {LINES_NAV.map((l) => {
            const active = l.match.some((m) => pathname.startsWith(m));
            return (
              <NavLink key={l.key} to={l.to} className={`line-nav__item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                <LetterBadge letter={l.key} size="sm" />
                <span className="line-nav__long">{l.label}</span>
                <span className="line-nav__short">{l.short}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="site-header__right">
          <Link to="/cart" className="icon-btn" aria-label="장바구니">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.4a1 1 0 0 0 1-.8L20 8H6.2" />
              <circle cx="9.5" cy="20" r="1.3" />
              <circle cx="17.5" cy="20" r="1.3" />
            </svg>
          </Link>
          {user ? (
            <div className="user-menu">
              <Link to="/mypage" className="user-menu__name">
                {user.name} 님
              </Link>
              <button
                className="btn btn--primary btn--sm"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                로그아웃
              </button>
            </div>
          ) : (
            <Link to={`/login?redirect=${encodeURIComponent(pathname)}`} className="btn btn--primary btn--sm">
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/** 공통 푸터: 짙은 초록 · 워드마크 · 공공데이터·카카오맵 출처 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p className="site-footer__mark en">PET PLANET</p>
        <div className="site-footer__row">
          <p className="site-footer__src">
            장소 · 역 데이터: 공공데이터포털 ‘전국 반려동물 동반 가능 문화시설’, 전국 지하철역 위치 정보 · 지도: 카카오맵 API
          </p>
          <div className="site-footer__lines" aria-hidden>
            {LINES_NAV.map((l) => (
              <LetterBadge key={l.key} letter={l.key} size="lg" tone="mint" />
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/** 페이지 상단: 민트 배경 + 큰 영문 제목 + 한글 제목 1줄 + 설명 + 일러스트 */
export function PageHero({ line, en, title, desc, art, children, compact }) {
  const l = LINES_NAV.find((x) => x.key === line);
  return (
    <section className={`page-hero ${compact ? 'page-hero--compact' : ''}`}>
      <div className="container page-hero__inner">
        <div className="page-hero__text">
          {l && (
            <p className="page-hero__line">
              <LetterBadge letter={l.key} size="sm" /> {l.name}
            </p>
          )}
          {en && <p className="page-hero__en en">{en}</p>}
          {title && <h1 className="page-hero__title">{title}</h1>}
          {desc && <p className="page-hero__desc">{desc}</p>}
          {children}
        </div>
        {art && <div className="page-hero__art">{art}</div>}
      </div>
    </section>
  );
}

/**
 * NOW STATION 표시줄 — 노선 단계를 역처럼 표시, 현재 단계만 큰 원(짙은 초록)
 * steps: string[], current: index
 */
export function NowStation({ steps, current }) {
  return (
    <div className="now-station" aria-label={`진행 단계: ${steps[current]}`}>
      <div className="container now-station__inner">
        <p className="now-station__label en">
          NOW
          <br />
          STATION
        </p>
        <ol className="now-station__track">
          {steps.map((s, i) => (
            <li key={s} className={`now-station__stop ${i < current ? 'is-done' : ''} ${i === current ? 'is-current' : ''}`} aria-current={i === current ? 'step' : undefined}>
              <span className="now-station__dot" />
              <span className="now-station__name">{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
