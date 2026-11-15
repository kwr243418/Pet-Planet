import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { placeApi } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../common/Toast.jsx';

/**
 * 찜하기(북마크) 토글 (Day 7)
 * - 낙관적 업데이트: 누르는 즉시 하트를 바꾸고, 실패하면 원래대로 되돌림
 * - 비로그인 시 로그인 화면으로 이동 (돌아올 경로 유지)
 */
export function useBookmarkToggle(placeId, initial, onChange) {
  const [on, setOn] = useState(!!initial);
  const [pending, setPending] = useState(false);
  const { isLoggedIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => setOn(!!initial), [initial]);

  const toggle = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!isLoggedIn) {
      toast.show('로그인하고 마음에 드는 장소를 찜해 보세요!');
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    if (pending) return;
    const next = !on;
    setOn(next);
    setPending(true);
    try {
      await (next ? placeApi.bookmark(placeId) : placeApi.unbookmark(placeId));
      onChange?.(placeId, next);
      if (next) toast.success('찜 목록에 담았어요');
    } catch (err) {
      setOn(!next);
      toast.error(err.message ?? '찜하기에 실패했어요.');
    } finally {
      setPending(false);
    }
  };

  return { on, pending, toggle };
}

export default function BookmarkButton({ placeId, bookmarked, onChange, className = '', size = 'md' }) {
  const { on, toggle } = useBookmarkToggle(placeId, bookmarked, onChange);
  return (
    <button
      type="button"
      className={`bm-btn bm-btn--${size} ${on ? 'is-on' : ''} ${className}`}
      aria-pressed={on}
      aria-label={on ? '찜 해제' : '찜하기'}
      onClick={toggle}
    >
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path
          d="M12 20.5s-7.5-4.6-9.3-9.4C1.5 7.8 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.5 3.3 4.3 6.6-1.8 4.8-9.3 9.4-9.3 9.4z"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
