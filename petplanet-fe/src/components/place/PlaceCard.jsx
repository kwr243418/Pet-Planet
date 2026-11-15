import { Link } from 'react-router-dom';
import { categoryMeta } from '../../utils/categories.js';
import { formatDistance, formatRating, INDOOR_LABEL, SIZE_LABEL, walkingMinutesLabel } from './placeFormat.js';
import { LineBadge } from '../common/ui.jsx';
import BookmarkButton from './BookmarkButton.jsx';

/** 장소 썸네일 — 사진 대신 카테고리 이모지 + 파스텔 배경 */
export function PlaceThumb({ categoryId, size = 76, radius = 18 }) {
  const meta = categoryMeta(categoryId);
  return (
    <div className="place-thumb" style={{ width: size, height: size, borderRadius: radius, background: meta.bg }} aria-hidden>
      <span style={{ fontSize: size * 0.46 }}>{meta.emoji}</span>
      <i className="place-thumb__paw">🐾</i>
    </div>
  );
}

/** 목록용 장소 카드 (Day 4) */
export default function PlaceCard({ place, selected, onSelect, onBookmarkChange, showDistanceFrom }) {
  const meta = categoryMeta(place.categoryId);
  const st = place.nearestStation;
  return (
    <article
      className={`place-card ${selected ? 'is-selected' : ''}`}
      onMouseEnter={() => onSelect?.(place.placeId)}
      data-place-id={place.placeId}
    >
      <Link to={`/places/${place.placeId}`} className="place-card__link">
        <PlaceThumb categoryId={place.categoryId} />
        <div className="place-card__body">
          <span className="place-card__cat">{place.categoryName ?? meta.label}</span>
          <h3 className="place-card__name">{place.name}</h3>
          <div className="place-card__rating">
            <span className="star-mini">★</span>
            <b>{formatRating(place.avgRating)}</b>
            <span className="muted">({place.reviewCount})</span>
            {showDistanceFrom && place.distanceKm != null && (
              <span className="place-card__dist">
                {showDistanceFrom}에서 {formatDistance(place.distanceKm)}
              </span>
            )}
          </div>
          {st && (
            <div className="place-card__station">
              {st.lines.map((l) => (
                <LineBadge key={l} code={l} small />
              ))}
              <span>
                {st.stationName}역 도보 {walkingMinutesLabel(st.distanceKm)}
              </span>
            </div>
          )}
          <div className="place-card__tags">
            <span className="tag">{SIZE_LABEL[place.maxSize]}까지</span>
            <span className="tag tag--soft">{INDOOR_LABEL[place.indoorType]}</span>
          </div>
        </div>
      </Link>
      <BookmarkButton placeId={place.placeId} bookmarked={place.bookmarked} onChange={onBookmarkChange} className="place-card__bm" />
    </article>
  );
}

/** 가로 스크롤용 작은 카드 (홈 화면) */
export function PlaceMiniCard({ place }) {
  const meta = categoryMeta(place.categoryId);
  return (
    <Link to={`/places/${place.placeId}`} className="place-mini">
      <div className="place-mini__thumb" style={{ background: meta.bg }}>
        <span>{meta.emoji}</span>
        {place.nearestStation && (
          <span className="place-mini__station">
            <LineBadge code={place.nearestStation.lines[0]} small />
            {place.nearestStation.stationName}
          </span>
        )}
      </div>
      <p className="place-mini__name">{place.name}</p>
      <p className="place-mini__meta">
        <span className="star-mini">★</span> {formatRating(place.avgRating)} · {place.categoryName}
      </p>
    </Link>
  );
}
