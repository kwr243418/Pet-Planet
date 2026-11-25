import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { placeApi, reviewApi } from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { usePageTitle } from '../hooks/usePage.js';
import { useAuth } from '../context/AuthContext.jsx';
import { LetterBadge, NowStation } from '../components/layout/Site.jsx';
import { Button, ConfirmDialog, EmptyState, ErrorState, Skeleton, Stars, Tag } from '../components/common/ui.jsx';
import { useToast } from '../components/common/Toast.jsx';
import { HeartIcon, useBookmarkToggle } from '../components/place/BookmarkButton.jsx';
import { ReviewCard, ReviewModal } from '../components/place/Reviews.jsx';
import MapView from '../components/map/MapView.jsx';
import RouteGuide from '../components/nearby/RouteGuide.jsx';
import TransitPanel from '../components/transit/TransitPanel.jsx';
import KakaoReviewLink from '../components/transit/KakaoReviewLink.jsx';
import { readOrigin } from '../utils/origin.js';
import { categoryMeta } from '../utils/categories.js';
import { formatRating, INDOOR_LABEL, MAX_SIZE_LONG } from '../utils/format.js';
import { EXPLORE_STEPS } from './Explore.jsx';

/** S03 장소 상세 */
export default function PlaceDetail() {
  const { placeId } = useParams();
  const { data: place, error, loading, reload, setData } = useAsync(() => placeApi.get(placeId), [placeId]);
  usePageTitle(place?.name ?? (error ? '장소를 찾을 수 없어요' : '장소 상세'));
  if (loading && !place) return <DetailSkeleton />;
  if (error)
    return (
      <div className="container">
        <ErrorState error={error} onRetry={error.status === 404 ? undefined : reload} />
        {error.status === 404 && (
          <p style={{ textAlign: 'center', paddingBottom: 64 }}>
            <Link to="/explore" className="btn btn--outline btn--md">
              다른 장소 둘러보기
            </Link>
          </p>
        )}
      </div>
    );
  return <Detail key={place.placeId} place={place} setPlace={setData} />;
}

/** 상세 화면 모양 그대로의 로딩 자리 (Day 11) */
function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="장소 정보를 불러오는 중">
      <section className="detail-hero">
        <div className="container detail-hero__inner">
          <div className="detail-hero__text">
            <Skeleton h={14} w={180} r={8} />
            <Skeleton h={26} w={260} r={13} style={{ marginTop: 18 }} />
            <Skeleton h={52} w="80%" r={14} style={{ marginTop: 18 }} />
            <Skeleton h={18} w={220} r={9} style={{ marginTop: 16 }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 32 }}>
              <Skeleton h={48} w={200} r={24} />
              <Skeleton h={48} w={180} r={24} />
            </div>
          </div>
          <Skeleton h={300} r={36} />
        </div>
      </section>
      <div className="container">
        <div className="station-cards" style={{ marginTop: 72 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={170} r={36} />
          ))}
        </div>
      </div>
    </div>
  );
}

function kakaoRouteUrl(p) {
  return `https://map.kakao.com/link/to/${encodeURIComponent(p.name)},${p.lat},${p.lng}`;
}

function Detail({ place, setPlace }) {
  const meta = categoryMeta(place.categoryId);
  const [photoBroken, setPhotoBroken] = useState(false);
  // 가는 방법의 출발점: 주변 탐색에서 고른 내 위치(마지막 출발점)
  const routeOrigin = readOrigin();
  const regionQuery = place.sido ? `mode=region&sido=${encodeURIComponent(place.sido)}${place.sigungu ? `&sigungu=${encodeURIComponent(place.sigungu)}` : ''}` : null;

  const { on, pending, toggle } = useBookmarkToggle(place.placeId, place.bookmarked, (_, v) =>
    setPlace((p) => ({ ...p, bookmarked: v, bookmarkCount: p.bookmarkCount + (v ? 1 : -1) })),
  );
  const markers = useMemo(() => [{ id: place.placeId, num: 1, lat: place.lat, lng: place.lng, kind: 'place', label: place.name }], [place]);

  return (
    <>
      <section className="detail-hero">
        <div className="container detail-hero__inner">
          <div className="detail-hero__text">
            {regionQuery && (
              <nav className="crumb" aria-label="경로">
                <Link to={`/explore?mode=region&sido=${encodeURIComponent(place.sido)}`}>{place.sido}</Link>
                {place.sigungu && (
                  <>
                    <span>›</span>
                    <Link to={`/explore?${regionQuery}`}>{place.sigungu}</Link>
                  </>
                )}
                <span>›</span>
                <Link to={`/explore?${regionQuery}&cat=${place.categoryId}`}>{place.categoryName}</Link>
              </nav>
            )}
            <div className="detail-hero__chips">
              <Tag tone="white">{place.categoryName}</Tag>
              {MAX_SIZE_LONG[place.maxSize] && <Tag tone="white">{MAX_SIZE_LONG[place.maxSize]}</Tag>}
              {INDOOR_LABEL[place.indoorType] && <Tag tone="white">{INDOOR_LABEL[place.indoorType]}</Tag>}
            </div>
            <h1 className="detail-hero__name">{place.name}</h1>
            <a href="#reviews" className="detail-hero__rating">
              {place.reviewCount > 0 ? (
                <>
                  <Stars value={place.avgRating} size={18} />
                  <b className="en">{formatRating(place.avgRating)}</b>
                  <span className="muted">리뷰 {place.reviewCount}개</span>
                </>
              ) : (
                // 후기가 없을 때 0.0점 별을 보이면 평가가 나쁜 곳처럼 보여서 안내 문구로
                <span className="muted">아직 펫 플래닛 후기가 없어요 · 리뷰 0개</span>
              )}
            </a>
            <p className="detail-hero__addr muted">
              {place.address}
              {place.phone && (
                <>
                  {' · '}
                  <a href={`tel:${place.phone}`}>{place.phone}</a>
                </>
              )}
            </p>
            <div className="detail-hero__actions">
              <Button onClick={toggle} disabled={pending} aria-pressed={on} className={on ? 'is-bookmarked' : ''}>
                <HeartIcon size={18} />
                {on ? '찜한 장소예요' : '관심 장소 찜하기'}
              </Button>
              <a className="btn btn--outline btn--md" href={kakaoRouteUrl(place)} target="_blank" rel="noreferrer">
                카카오맵 길찾기
              </a>
            </div>
          </div>
          <div className={`photo-card cat-banner--${meta.tone}`}>
            {place.imageUrl && !photoBroken ? (
              <img src={place.imageUrl} alt={`${place.name} 대표 사진`} onError={() => setPhotoBroken(true)} />
            ) : (
              <>
                <img src={meta.detailImg ?? meta.img} alt={`${meta.label} 대표 이미지`} />
                <span className="photo-card__word en">{meta.en}</span>
                <span className="photo-card__note">예시 사진</span>
              </>
            )}
          </div>
        </div>
      </section>
      <NowStation steps={EXPLORE_STEPS} current={on ? 3 : 2} />

      <div className="container">
        {/* 가는 방법: 주변 탐색에서 고른 출발점 기준 어림 시간 + 카카오맵 길찾기 */}
        <section className="section">
          <RouteGuide origin={routeOrigin} dest={{ name: place.name, lat: place.lat, lng: place.lng }} />
        </section>

        {/* 버스로 가기: 가까운 정류장 · 노선 · 실시간 도착 + 반려동물 버스 이용 안내 */}
        <section className="section">
          <TransitPanel dest={{ name: place.name, lat: place.lat, lng: place.lng, busAccess: place.busAccess }} />
        </section>

        {/* 이용 안내 */}
        <section className="section">
          <h2 className="section-title section-head">이용 안내</h2>
          <div className="guide-cards">
            <div className="guide-card guide-card--mint">
              <p className="guide-card__label">동반 가능 크기</p>
              <p className="guide-card__value">{(MAX_SIZE_LONG[place.maxSize] ?? '정보 없음').replace('견', '')}</p>
            </div>
            <div className="guide-card guide-card--mint">
              <p className="guide-card__label">실내 · 실외</p>
              <p className="guide-card__value">{INDOOR_LABEL[place.indoorType] ? `${INDOOR_LABEL[place.indoorType]} 가능` : '정보 없음'}</p>
            </div>
            <div className="guide-card">
              <p className="guide-card__label">상세 설명</p>
              <p className="guide-card__desc">{place.description}</p>
            </div>
          </div>
          <div className="detail-map">
            <MapView markers={markers} selectedId={place.placeId} height={300} label="카카오맵 · 위치" />
          </div>
        </section>

        <ReviewsSection place={place} setPlace={setPlace} />

        {/* 환승 배너 → 펫 스토어 */}
        <section className="section">
          <Link to="/shop" className="transfer-banner">
            <LetterBadge letter="S" size="lg" />
            <div>
              <b>외출 준비물로 환승하기</b>
              <p className="muted">이동장 · 배변봉투 · 휴대용 물병</p>
            </div>
            <span className="transfer-banner__arrow" aria-hidden>
              →
            </span>
          </Link>
        </section>
      </div>
    </>
  );
}

function ReviewsSection({ place, setPlace }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [more, setMore] = useState(false);
  const [modal, setModal] = useState({ open: false, editing: null });
  const [deleting, setDeleting] = useState(null);
  const { isLoggedIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await reviewApi.list(place.placeId);
      setData(res);
      setPlace((p) => (p.avgRating === res.summary.avgRating && p.reviewCount === res.summary.reviewCount ? p : { ...p, ...res.summary }));
    } catch (e) {
      setError(e);
    }
  }, [place.placeId, setPlace]);
  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    setMore(true);
    try {
      const res = await reviewApi.list(place.placeId, { page: data.page + 1 });
      setData((d) => ({ ...res, content: [...d.content, ...res.content] }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setMore(false);
    }
  };

  const openWrite = () => {
    if (!isLoggedIn) {
      toast.show('리뷰는 로그인 후 쓸 수 있어요');
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    const mine = data?.content.find((r) => r.mine);
    if (mine) toast.show('이미 쓴 리뷰가 있어서 수정으로 열게요');
    setModal({ open: true, editing: mine ?? null });
  };

  return (
    <section className="section" id="reviews">
      <div className="section-head">
        <h2 className="section-title">방문 후기</h2>
        <div className="section-head__actions">
          <KakaoReviewLink name={place.name} sigungu={place.sigungu} />
          <Button size="sm" onClick={openWrite}>
            리뷰 쓰기
          </Button>
        </div>
      </div>
      <p className="review-source">펫 플래닛 회원이 남긴 후기예요. 다른 사이트의 후기는 카카오맵에서 볼 수 있어요.</p>
      {error && <ErrorState error={error} onRetry={load} />}
      {data && data.content.length === 0 && <EmptyState compact title="아직 후기가 없어요" desc="첫 번째 후기를 남겨 주세요." />}
      {data && data.content.length > 0 && (
        <>
          <div className="review-grid">
            {data.content.map((r) => (
              <ReviewCard key={r.reviewId} review={r} onEdit={(rv) => setModal({ open: true, editing: rv })} onDelete={setDeleting} />
            ))}
          </div>
          {data.hasNext && (
            <div className="review-more">
              <Button variant="outline" onClick={loadMore} loading={more}>
                후기 더 보기
              </Button>
            </div>
          )}
        </>
      )}
      <ReviewModal open={modal.open} editing={modal.editing} targetId={place.placeId} targetName={place.name} onClose={() => setModal({ open: false, editing: null })} onSaved={load} />
      <ConfirmDialog
        open={!!deleting}
        title="후기를 삭제할까요?"
        desc="삭제한 후기는 되돌릴 수 없어요."
        confirmText="삭제"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await reviewApi.remove(deleting.reviewId);
            toast.show('후기를 삭제했어요');
            setDeleting(null);
            load();
          } catch (e) {
            toast.error(e.message);
          }
        }}
      />
    </section>
  );
}
