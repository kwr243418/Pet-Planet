import { useState } from 'react';
import { Link } from 'react-router-dom';
import { categoryMeta } from '../../utils/categories.js';
import { formatKm, INDOOR_SHORT, MAX_SIZE_SHORT } from '../../utils/format.js';
import BookmarkButton from './BookmarkButton.jsx';
import TransitBadge from '../transit/TransitBadge.jsx';

/** 카드 상단: 장소 사진, 없으면 카테고리 대표 사진 + 작은 영문 라벨(CAFE·DINING·STAY·PARK) */
export function CategoryBanner({ categoryId, imageUrl, height = 120, children }) {
  const meta = categoryMeta(categoryId);
  const [broken, setBroken] = useState(false); // 사진 주소가 깨지면 카테고리 사진으로 대체 (Day 11)
  const showImg = imageUrl && !broken;
  return (
    <div className={`cat-banner cat-banner--${meta.tone}`} style={{ height }}>
      {showImg ? (
        <img src={imageUrl} alt="" className="cat-banner__img" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <>
          <img src={meta.img} alt="" className="cat-banner__img" loading="lazy" />
          <span className="cat-banner__word en">{meta.en}</span>
        </>
      )}
      {children}
    </div>
  );
}

/** 장소 설명 한 줄: "카페 · 소·중형 · 실내" */
export const placeMeta = (p) => [p.categoryName ?? categoryMeta(p.categoryId).label, MAX_SIZE_SHORT[p.maxSize], INDOOR_SHORT[p.indoorType]].filter(Boolean).join(' · ');

/** S02 결과 카드: 번호 · 하트 · 카테고리 · 장소명 · 카테고리/크기/실내외 · (내 근처) 거리 막대 + km · 버스 정류장 */
export function PlaceResultCard({ place, index, radiusKm, selected, onHover, onBookmarkChange, query = '' }) {
  const ratio = Math.min(1, (place.distanceKm ?? 0) / (radiusKm || 1));
  return (
    <article className={`place-card ${selected ? 'is-selected' : ''}`} data-place-id={place.placeId} onMouseEnter={() => onHover?.(place.placeId)}>
      <Link to={`/places/${place.placeId}${query}`} className="place-card__link">
        <CategoryBanner categoryId={place.categoryId} imageUrl={place.imageUrl} height={104} />
        <div className="place-card__body">
          <h3 className="place-card__name">{place.name}</h3>
          <p className="place-card__meta">{placeMeta(place)}</p>
          {place.distanceKm == null && place.sigungu && <p className="place-card__region">{[place.sido, place.sigungu].join(' ')}</p>}
          {place.distanceKm != null && (
            <div className="dist">
              <span className="dist__bar">
                <i style={{ width: `${Math.max(8, ratio * 100)}%` }} />
              </span>
              <b className="dist__km en">{formatKm(place.distanceKm)}</b>
            </div>
          )}
          <TransitBadge access={place.busAccess} compact />
        </div>
      </Link>
      <span className="place-card__num en">{index}</span>
      <BookmarkButton placeId={place.placeId} bookmarked={place.bookmarked} onChange={onBookmarkChange} className="place-card__heart" />
    </article>
  );
}

/** S01 홈 "다음 정류장" 카드: 거리(또는 지역) 칩 · 카테고리 · 장소명 · 크기·실내외 · 버스 정류장 */
export function NearPlaceCard({ place }) {
  return (
    <Link to={`/places/${place.placeId}`} className="near-card">
      <CategoryBanner categoryId={place.categoryId} imageUrl={place.imageUrl} height={170}>
        <span className="near-card__km en">{place.distanceKm != null ? formatKm(place.distanceKm) : place.sigungu ?? ''}</span>
      </CategoryBanner>
      <p className="near-card__name">{place.name}</p>
      <p className="near-card__meta">{placeMeta(place).split(' · ').slice(1).join(' · ')}</p>
      <TransitBadge access={place.busAccess} compact />
    </Link>
  );
}
