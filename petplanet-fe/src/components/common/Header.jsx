import { useNavigate } from 'react-router-dom';

export function Logo({ size = 22 }) {
  return (
    <span className="logo" style={{ fontSize: size }}>
      Pet
      <svg className="logo__dot" viewBox="0 0 64 64" width="0.8em" height="0.8em" aria-hidden>
        <g fill="currentColor">
          <ellipse cx="32" cy="42" rx="13" ry="11" />
          <circle cx="15" cy="27" r="6.5" />
          <circle cx="25" cy="16" r="6.5" />
          <circle cx="39" cy="16" r="6.5" />
          <circle cx="49" cy="27" r="6.5" />
        </g>
      </svg>
      Planet
    </span>
  );
}

/** 상단 헤더 — back: 뒤로가기 버튼, title: 가운데 제목, right: 우측 슬롯 */
export default function Header({ title, back, right, transparent, logo }) {
  const navigate = useNavigate();
  return (
    <header className={`header ${transparent ? 'header--transparent' : ''}`}>
      <div className="header__left">
        {back && (
          <button
            className="icon-btn"
            aria-label="뒤로 가기"
            onClick={() => (typeof back === 'string' ? navigate(back) : window.history.length > 1 ? navigate(-1) : navigate('/'))}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        {logo && <Logo />}
      </div>
      {title ? <h1 className="header__title">{title}</h1> : <span />}
      <div className="header__right">{right}</div>
    </header>
  );
}
