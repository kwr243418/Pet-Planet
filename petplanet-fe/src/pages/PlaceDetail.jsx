import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { placeApi } from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import Header from '../components/common/Header.jsx';
import { ErrorState, LineBadge, PageLoader, Stars } from '../components/common/ui.jsx';
import { useToast } from '../components/common/Toast.jsx';
import MapView from '../components/map/MapView.jsx';
import ReviewSection from '../components/place/ReviewSection.jsx';
import { useBookmarkToggle } from '../components/place/BookmarkButton.jsx';
import { categoryMeta } from '../utils/categories.js';
import { canBring, formatDistance, formatRating, INDOOR_LABEL, SIZE_LABEL, sizeFromWeight } from '../utils/format.js';
import { walkingMinutes } from '../utils/geo.js';
import { lineInfo } from '../utils/subway.js';

/** 장소 상세 (Day 7) — 기본 정보 · 인접역 · 지도 · 찜하기 · 리뷰 */
export default function PlaceDetail() {
  const { placeId } = useParams();
  const { data: place, error, loading, reload, setData } = useAsync(() => placeApi.get(placeId), [placeId]);

  if (loading && !place) return <PageLoader />;
  if (error)
    return (
      <div className="page page--no-nav">
        <Header back />
        <ErrorState error={error} onRetry={error.status === 404 ? undefined : reload} />
        {error.status === 404 && (
          <Link to="/explore" className="btn btn--outline btn--md center-self">
            다른 장소 둘러보기
          </Link>
        )}
      </div>
    );
  return <DetailBody key={place.placeId} place={place} setPlace={setData} />;
}

function DetailBody({ place, setPlace }) {
  const meta = categoryMeta(place.categoryId);
  const { primaryPet } = useAuth();
  const toast = useToast();
  const { on, toggle } = useBookmarkToggle(place.placeId, place.bookmarked, (_, v) =>
    setPlace((p) => ({ ...p, bookmarked: v, bookmarkCount: p.bookmarkCount + (v ? 1 : -1) })),
  );

  const onSummaryChange = useCallback(
    (s) => setPlace((p) => (p.avgRating === s.avgRating && p.reviewCount === s.reviewCount ? p : { ...p, avgRating: s.avgRating, reviewCount: s.reviewCount })),
    [setPlace],
  );

  const ok = primaryPet ? canBring(place.maxSize, primaryPet.weight) : null;
  const [mapOpen, setMapOpen] = useState(false);
  const markers = useMemo(() => {
    const m = [{ id: place.placeId, lat: place.lat, lng: place.lng, kind: 'place', label: place.name, emoji: meta.emoji }];
    place.nearbyStations.slice(0, 2).forEach((s) => m.push({ id: `st-${s.stationId}`, lat: s.lat, lng: s.lng, kind: 'station', label: `${s.stationName}역`, color: lineInfo(s.lines[0]).color }));
    return m;
  }, [place, meta.emoji]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: place.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('링크를 복사했어요');
      }
    } catch {
      /* 사용자가 공유 취소 */
    }
  };

  return (
    <div className="page page--flush detail">
      <div className="detail__hero" style={{ background: meta.bg }}>
        <Header back transparent right={<button className="icon-btn icon-btn--glass" onClick={share} aria-label="공유하기">↗</button>} />
        <span className="detail__emoji" aria-hidden>
          {meta.emoji}
        </span>
        <span className="detail__paws" aria-hidden>
          🐾 🐾 🐾
        </span>
      </div>

      <div className="detail__sheet">
        <div className="detail__top">
          <span className="tag tag--pink">{place.categoryName}</span>
          <h1 className="detail__name">{place.name}</h1>
          <a href="#reviews" className="detail__rating">
            <Stars value={place.avgRating} size={16} />
            <b>{formatRating(place.avgRating)}</b>
            <span className="muted">리뷰 {place.reviewCount}</span>
            <span className="muted">· 찜 {place.bookmarkCount}</span>
          </a>
        </div>

        {primaryPet && ok !== null && (
          <div className={`pet-fit ${ok ? 'is-ok' : 'is-no'}`}>
            <span className="pet-fit__icon">{ok ? '🐶' : '🥺'}</span>
            <p>
              {ok ? (
                <>
                  <b>{primaryPet.name}</b>({primaryPet.weight}kg)랑 함께 갈 수 있어요!
                </>
              ) : (
                <>
                  이곳은 <b>{SIZE_LABEL[place.maxSize]}</b>까지만 동반 가능해요. {primaryPet.name}는 {SIZE_LABEL[sizeFromWeight(primaryPet.weight)]}이라 어려울 수 있어요.
                </>
              )}
            </p>
          </div>
        )}

        <div className="info-grid">
          <div className="info-chip">
            <span>🐕</span>
            <div>
              <small>동반 가능 크기</small>
              <b>{SIZE_LABEL[place.maxSize]}까지</b>
            </div>
          </div>
          <div className="info-chip">
            <span>🏠</span>
            <div>
              <small>동반 공간</small>
              <b>{INDOOR_LABEL[place.indoorType]}</b>
            </div>
          </div>
        </div>

        <p className="detail__desc">{place.description}</p>

        <ul className="info-list">
          <li>
            <span aria-hidden>📍</span>
            {place.address}
          </li>
          <li>
            <span aria-hidden>📞</span>
            <a href={`tel:${place.phone}`}>{place.phone}</a>
          </li>
        </ul>

        <section className="section">
          <div className="section__head">
            <h2 className="section__title">가까운 지하철역 🚇</h2>
          </div>
          {place.nearbyStations.length === 0 ? (
            <p className="muted">1km 안에 지하철역이 없어요.</p>
          ) : (
            <ul className="near-stations">
              {place.nearbyStations.map((s) => (
                <li key={s.stationName}>
                  <Link to={`/explore?stationId=${s.stationId}`}>
                    <span className="near-stations__lines">
                      {s.lines.map((l) => (
                        <LineBadge key={l} code={l} small />
                      ))}
                    </span>
                    <b>{s.stationName}역</b>
                    <span className="muted">
                      {formatDistance(s.distanceKm)} · 도보 {walkingMinutes(s.distanceKm)}분
                    </span>
                    <span className="chev">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className={`detail__map ${mapOpen ? 'is-open' : ''}`}>
            <MapView markers={markers} selectedId={place.placeId} height={mapOpen ? 320 : 180} />
            <button className="detail__map-toggle" onClick={() => setMapOpen((o) => !o)}>
              {mapOpen ? '지도 접기' : '지도 크게 보기'}
            </button>
          </div>
        </section>

        <ReviewSection placeId={place.placeId} placeName={place.name} onSummaryChange={onSummaryChange} />
      </div>

      <div className="detail__cta">
        <button className={`bm-big ${on ? 'is-on' : ''}`} onClick={toggle} aria-pressed={on} aria-label={on ? '찜 해제' : '찜하기'}>
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path d="M12 20.5s-7.5-4.6-9.3-9.4C1.5 7.8 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.5 3.3 4.3 6.6-1.8 4.8-9.3 9.4-9.3 9.4z" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          <small>{place.bookmarkCount}</small>
        </button>
        <a className="btn btn--primary btn--lg detail__call" href={`tel:${place.phone}`}>
          전화로 문의하기
        </a>
      </div>
    </div>
  );
}
