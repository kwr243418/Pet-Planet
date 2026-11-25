import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { facilityApi } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../common/Toast.jsx';
import { HeartIcon } from '../place/BookmarkButton.jsx';

/**
 * 병원 · 호텔 찜 버튼 — 장소 찜(BookmarkButton)과 같은 방식: 낙관적 업데이트, 비로그인이면 로그인 화면으로,
 * 409 DUPLICATE_BOOKMARK 면 이미 찜한 상태로 맞춰요. 찜 목록은 마이페이지 "찜한 병원 · 호텔"에 모여요.
 * kind: 'HOSPITAL' | 'HOTEL', tone: 'night'(검정 바 위) | 'light', icon: 목록 카드용 원형 하트(장소 카드와 같은 모양)
 * initial 을 주면 서버에 다시 묻지 않아요 (목록은 내 찜 목록을 한 번만 불러서 넘겨줘요)
 */
export default function FacilityHeart({ kind, id, tone = 'light', icon = false, className = '', initial, onChange }) {
  const { isLoggedIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [on, setOn] = useState(!!initial);
  const [pending, setPending] = useState(false);
  const what = kind === 'HOTEL' ? '호텔' : '병원';

  useEffect(() => {
    if (initial !== undefined) {
      setOn(!!initial);
      return undefined;
    }
    if (!isLoggedIn || !id) return undefined;
    let alive = true;
    facilityApi
      .bookmarkState(kind, id)
      .then((r) => alive && setOn(!!r.bookmarked))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [kind, id, isLoggedIn, initial]);

  const toggle = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!isLoggedIn) {
      toast.show(`로그인하면 ${what}을 찜할 수 있어요`);
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    if (pending) return;
    const next = !on;
    setOn(next);
    setPending(true);
    try {
      await (next ? facilityApi.bookmark(kind, id) : facilityApi.unbookmark(kind, id));
      onChange?.(next);
      toast.show(next ? `찜한 ${what}에 담았어요 · 마이페이지에서 볼 수 있어요` : '찜을 해제했어요');
    } catch (err) {
      if (err.code === 'DUPLICATE_BOOKMARK') {
        setOn(true);
        onChange?.(true);
      } else {
        setOn(!next);
        toast.error(err.message ?? '찜하기에 실패했어요.');
      }
    } finally {
      setPending(false);
    }
  };

  if (icon) {
    return (
      <button type="button" className={`heart-btn ${on ? 'is-on' : ''} ${className}`} aria-pressed={on} aria-label={on ? `${what} 찜 해제` : `${what} 찜하기`} onClick={toggle} disabled={pending}>
        <HeartIcon />
      </button>
    );
  }
  return (
    <button type="button" className={`btn btn--md facility-heart facility-heart--${tone} ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={toggle} disabled={pending}>
      <HeartIcon size={16} />
      {on ? '찜한 ' + what : '찜하기'}
    </button>
  );
}
