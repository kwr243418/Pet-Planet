import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { reviewApi } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatRating, formatRelative } from '../../utils/format.js';
import { Button, ConfirmDialog, EmptyState, ErrorState, Skeleton, Stars } from '../common/ui.jsx';
import { useToast } from '../common/Toast.jsx';
import ReviewFormSheet from './ReviewFormSheet.jsx';

const SORTS = [
  { value: 'latest', label: '최신순' },
  { value: 'rating_desc', label: '별점 높은순' },
  { value: 'rating_asc', label: '별점 낮은순' },
];

/** 장소 리뷰 영역: 평균/분포 + 목록 + 작성/수정/삭제 (Day 8) */
export default function ReviewSection({ placeId, placeName, onSummaryChange }) {
  const [sort, setSort] = useState('latest');
  const [data, setData] = useState(null); // { summary, content, hasNext, page }
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const { isLoggedIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reviewApi.list(placeId, { sort, page: 0 });
      setData(res);
      onSummaryChange?.(res.summary);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [placeId, sort, onSummaryChange]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    setMoreLoading(true);
    try {
      const res = await reviewApi.list(placeId, { sort, page: data.page + 1 });
      setData((d) => ({ ...res, content: [...d.content, ...res.content] }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setMoreLoading(false);
    }
  };

  const openWrite = () => {
    if (!isLoggedIn) {
      toast.show('리뷰는 로그인 후 작성할 수 있어요');
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    const mine = data?.content.find((r) => r.mine);
    if (mine) {
      toast.show('이미 작성한 리뷰가 있어서 수정 화면으로 열게요');
      setEditing(mine);
    } else setEditing(null);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    try {
      await reviewApi.remove(deleting.reviewId);
      toast.success('리뷰를 삭제했어요');
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const s = data?.summary;
  const maxDist = s ? Math.max(1, ...Object.values(s.distribution)) : 1;

  return (
    <section className="section" id="reviews">
      <div className="section__head">
        <h2 className="section__title">
          리뷰 <span className="count-pill">{s?.reviewCount ?? 0}</span>
        </h2>
        <Button size="sm" variant="soft" onClick={openWrite}>
          ✏️ 리뷰 쓰기
        </Button>
      </div>

      {loading && !data && (
        <div className="stack">
          <Skeleton h={96} r={20} />
          <Skeleton h={80} r={16} />
          <Skeleton h={80} r={16} />
        </div>
      )}
      {error && <ErrorState error={error} onRetry={load} />}

      {data && !error && (
        <>
          <div className="review-summary">
            <div className="review-summary__avg">
              <b>{formatRating(s.avgRating)}</b>
              <Stars value={s.avgRating} size={16} />
              <span className="muted">{s.reviewCount}개의 리뷰</span>
            </div>
            <ul className="review-summary__bars">
              {[5, 4, 3, 2, 1].map((n) => (
                <li key={n}>
                  <span>{n}점</span>
                  <i>
                    <em style={{ width: `${(s.distribution[n] / maxDist) * 100}%` }} />
                  </i>
                  <span className="muted">{s.distribution[n]}</span>
                </li>
              ))}
            </ul>
          </div>

          {data.content.length > 0 && (
            <div className="review-sort" role="radiogroup" aria-label="리뷰 정렬">
              {SORTS.map((o) => (
                <button key={o.value} role="radio" aria-checked={sort === o.value} className={sort === o.value ? 'is-on' : ''} onClick={() => setSort(o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {data.content.length === 0 ? (
            <EmptyState title="아직 리뷰가 없어요" desc={'첫 번째 리뷰를 남겨 주시면\n다른 반려인들에게 큰 도움이 돼요!'} mood="happy" />
          ) : (
            <ul className="review-list">
              {data.content.map((r) => (
                <li key={r.reviewId} className={`review-item ${r.mine ? 'is-mine' : ''}`}>
                  <div className="review-item__head">
                    <span className="review-item__avatar" aria-hidden>
                      {r.petName ? r.petName[0] : '🐾'}
                    </span>
                    <div>
                      <p className="review-item__who">
                        {r.userName}
                        {r.mine && <span className="me-badge">내 리뷰</span>}
                      </p>
                      <p className="review-item__pet muted">{r.petName ? `${r.petName} · ${r.petBreed}` : '반려인'}</p>
                    </div>
                    <span className="review-item__date muted">{formatRelative(r.createdAt)}</span>
                  </div>
                  <Stars value={r.rating} size={14} />
                  <p className="review-item__content">{r.content}</p>
                  {r.mine && (
                    <div className="review-item__actions">
                      <button
                        onClick={() => {
                          setEditing(r);
                          setFormOpen(true);
                        }}
                      >
                        수정
                      </button>
                      <button onClick={() => setDeleting(r)}>삭제</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {data.hasNext && (
            <Button variant="outline" size="md" block onClick={loadMore} loading={moreLoading}>
              리뷰 더 보기
            </Button>
          )}
        </>
      )}

      <ReviewFormSheet open={formOpen} onClose={() => setFormOpen(false)} placeId={placeId} placeName={placeName} editing={editing} onSaved={load} />
      <ConfirmDialog
        open={!!deleting}
        danger
        title="리뷰를 삭제할까요?"
        desc="삭제한 리뷰는 되돌릴 수 없어요."
        confirmText="삭제"
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}
