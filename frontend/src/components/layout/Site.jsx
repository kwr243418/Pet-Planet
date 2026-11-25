import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { IMG, LogoMark } from '../illust/index.jsx';

export const LINES_NAV = [
  { key: 'E', label: '주변 탐색', short: '탐색', name: '탐색선', to: '/explore', match: ['/explore', '/places'] },
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
    <Link to="/home" className="logo" aria-label="펫 플래닛 홈">
      <LogoMark />
      <span className="logo__text">펫 플래닛</span>
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
                  navigate('/home');
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

/** 공통 푸터: 검정 면 · 워드마크 · 공공데이터·카카오맵 출처 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__row">
          <p className="site-footer__mark">
            <LogoMark size={22} /> 펫 플래닛
          </p>
          <nav className="site-footer__nav" aria-label="푸터 메뉴">
            {LINES_NAV.map((l) => (
              <Link key={l.key} to={l.to}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="site-footer__src">
          데이터: 공공데이터포털 — 한국문화정보원 ‘반려동물 동반 가능 문화시설’, 행정안전부 동물병원 · 동물위탁관리업 인허가, 국토교통부 버스정류장 위치 · 버스도착정보
          <br />
          지도 · 길찾기 · 후기 링크: 카카오맵 · 위치는 주변 검색에만 쓰고 저장하지 않아요 · 이미지: AI 생성
        </p>
      </div>
    </footer>
  );
}

// 노선별 상단 사진 (photo 로 바꿀 수 있어요)
const HERO_PHOTO = { E: IMG.stationPath, R: IMG.vet, S: IMG.darkStillLife, M: IMG.spaniel };

/** 페이지 상단: 검정 면 + 작은 영문 라벨 + 명조 제목 + 금색 선 + 설명 + 오른쪽 사진
 *  art(예전 SVG 일러스트)는 더 이상 그리지 않고, 노선별 사진(photo)을 씁니다. */
export function PageHero({ line, en, title, desc, photo, children, compact }) {
  const l = LINES_NAV.find((x) => x.key === line);
  const src = photo === undefined ? HERO_PHOTO[line] ?? IMG.spaniel : photo;
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
        {src && (
          <div className="page-hero__art">
            <img src={src} alt="" />
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * NEXT STOP 표시줄 — 단계를 버스 노선의 정류장처럼 표시, 현재 단계만 크게
 * steps: string[], current: index
 */
export function NowStation({ steps, current }) {
  return (
    <div className="now-station" aria-label={`진행 단계: ${steps[current]}`}>
      <div className="container now-station__inner">
        <p className="now-station__label en">
          NEXT
          <br />
          STOP
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
