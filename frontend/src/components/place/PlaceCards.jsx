import { useState } from 'react';
import { Link } from 'react-router-dom';
import { categoryMeta } from '../../utils/categories.js';
import { formatKm, INDOOR_SHORT, MAX_SIZE_SHORT } from '../../utils/format.js';
import { TinyDog } from '../illust/index.jsx';
import BookmarkButton from './BookmarkButton.jsx';

/** 카드 상단: 영문 카테고리(CAFE·DINING·STAY·PARK)를 크게 */
export function CategoryBanner({ categoryId, imageUrl, dog, height = 120, children }) {
  const meta = categoryMeta(categoryId);
  const [broken, setBroken] = useState(false); // 사진 주소가 깨지면 카테고리 단어로 대체 (Day 11)
  const showImg = imageUrl && !broken;
  return (
    <div className={`cat-banner cat-banner--${meta.tone}`} style={{ height }}>
      {showImg ? <img src={imageUrl} alt="" className="cat-banner__img" loading="lazy" onError={() => setBroken(true)} /> : <span className="cat-banner__word en">{meta.en}</span>}
      {dog && !showImg && <TinyDog size={Math.round(height * 0.62)} className="cat-banner__dog" />}
      {children}
    </div>
  );
}

/** 장소 설명 한 줄: "카페 · 소·중형 · 실내" */
export const placeMeta = (p) => [p.categoryName ?? categoryMeta(p.categoryId).label, MAX_SIZE_SHORT[p.maxSize], INDOOR_SHORT[p.indoorType]].join(' · ');

/** S02 결과 카드: 번호 · 하트 · 카테고리 · 장소명 · 카테고리/크기/실내외 · 거리 막대 + km */
export function PlaceResultCard({ place, index, radiusKm, selected, onHover, onBookmarkChange, query = '' }) {
  const ratio = Math.min(1, (place.distanceKm ?? 0) / (radiusKm || 1));
  return (
    <article className={`place-card ${selected ? 'is-selected' : ''}`} data-place-id={place.placeId} onMouseEnter={() => onHover?.(place.placeId)}>
      <Link to={`/places/${place.placeId}${query}`} className="place-card__link">
        <CategoryBanner categoryId={place.categoryId} imageUrl={place.imageUrl} height={104} />
        <div className="place-card__body">
          <h3 className="place-card__name">{place.name}</h3>
          <p className="place-card__meta">{placeMeta(place)}</p>
          {place.distanceKm != null && (
            <div className="dist">
              <span className="dist__bar">
                <i style={{ width: `${Math.max(8, ratio * 100)}%` }} />
              </span>
              <b className="dist__km en">{formatKm(place.distanceKm)}</b>
            </div>
          )}
        </div>
      </Link>
      <span className="place-card__num en">{index}</span>
      <BookmarkButton placeId={place.placeId} bookmarked={place.bookmarked} onChange={onBookmarkChange} className="place-card__heart" />
    </article>
  );
}

/** S01 "이번 역" 카드: 거리 칩 · 카테고리 · 장소명 · 크기·실내외 */
export function StationPlaceCard({ place, dog }) {
  return (
    <Link to={`/places/${place.placeId}`} className="near-card">
      <CategoryBanner categoryId={place.categoryId} imageUrl={place.imageUrl} height={170} dog={dog}>
        <span className="near-card__km en">{formatKm(place.distanceKm)}</span>
      </CategoryBanner>
      <p className="near-card__name">{place.name}</p>
      <p className="near-card__meta">{placeMeta(place).split(' · ').slice(1).join(' · ')}</p>
    </Link>
  );
}
