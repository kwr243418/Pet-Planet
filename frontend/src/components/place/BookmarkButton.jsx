import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { placeApi } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../common/Toast.jsx';

/**
 * 찜하기 토글 — 낙관적 업데이트(실패 시 되돌림), 비로그인 시 로그인 화면으로
 * 같은 장소 중복 찜 불가: 서버가 409 DUPLICATE_BOOKMARK 를 주면 이미 찜된 상태로 맞춥니다.
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
      toast.show('로그인하면 관심 장소를 찜할 수 있어요');
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
      toast.show(next ? '관심 장소에 담았어요' : '찜을 해제했어요');
    } catch (err) {
      if (err.code === 'DUPLICATE_BOOKMARK') {
        setOn(true);
        onChange?.(placeId, true);
      } else {
        setOn(!next);
        toast.error(err.message ?? '찜하기에 실패했어요.');
      }
    } finally {
      setPending(false);
    }
  };
  return { on, pending, toggle };
}

export const HeartIcon = ({ size = 20 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
    <path d="M12 20.5s-7.5-4.6-9.3-9.4C1.5 7.8 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.5 3.3 4.3 6.6-1.8 4.8-9.3 9.4-9.3 9.4z" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

/** 카드 위 원형 하트 버튼 */
export default function BookmarkButton({ placeId, bookmarked, onChange, className = '' }) {
  const { on, toggle } = useBookmarkToggle(placeId, bookmarked, onChange);
  return (
    <button type="button" className={`heart-btn ${on ? 'is-on' : ''} ${className}`} aria-pressed={on} aria-label={on ? '찜 해제' : '관심 장소 찜하기'} onClick={toggle}>
      <HeartIcon />
    </button>
  );
}
