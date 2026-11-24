// 앱 공통 동작 (3주차 Day 11: 예외 처리 화면 개선)
import { Component, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TinyDog } from '../illust/index.jsx';

/** 페이지 이동 시 맨 위로 (같은 화면에서 필터만 바뀔 때는 그대로, #앵커는 그 위치로) */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

/** 인터넷 연결이 끊기면 화면 위에 안내 띠 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="offline-banner" role="alert">
      인터넷 연결이 끊겼어요. 연결되면 다시 시도해 주세요.
    </div>
  );
}

/** 화면 코드에서 예기치 못한 오류가 나도 흰 화면 대신 안내 (경로가 바뀌면 다시 그림) */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, key: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container">
        <div className="state state--page" role="alert">
          <TinyDog size={88} mood="sad" />
          <p className="state__title">화면을 그리다 문제가 생겼어요</p>
          <p className="state__desc">잠시 후 다시 시도해 주세요. 계속되면 새로고침해 주세요.</p>
          <div className="state__actions">
            <button className="btn btn--outline btn--sm" onClick={() => this.setState({ error: null })}>
              다시 시도
            </button>
            <a className="btn btn--primary btn--sm" href="/">
              홈으로
            </a>
          </div>
        </div>
      </div>
    );
  }
}
