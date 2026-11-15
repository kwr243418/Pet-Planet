import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { placeApi, stationApi } from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import Header from '../components/common/Header.jsx';
import { Button, Chip, EmptyState, ErrorState, LineBadge, Skeleton } from '../components/common/ui.jsx';
import StationSearch from '../components/place/StationSearch.jsx';
import PlaceCard from '../components/place/PlaceCard.jsx';
import FilterSheet, { countFilters, toggleIn } from '../components/place/FilterSheet.jsx';
import MapView from '../components/map/MapView.jsx';
import { categoryMeta } from '../utils/categories.js';
import { lineInfo } from '../utils/subway.js';
import { SIZE_LABEL, INDOOR_LABEL, sizeFromWeight } from '../utils/format.js';

const RADIUS_KM = 1;
const PAGE_SIZE = 10;
const SORTS = [
  { value: 'distance', label: '가까운순', needsStation: true },
  { value: 'rating', label: '별점순' },
  { value: 'reviews', label: '리뷰 많은순' },
];

const csv = (v) => (v ? v.split(',').filter(Boolean) : []);

/** URL 쿼리 ↔ 필터 상태 (뒤로가기·공유해도 같은 검색 결과) */
function useExploreParams() {
  const [params, setParams] = useSearchParams();
  const state = useMemo(
    () => ({
      stationId: params.get('stationId') ? Number(params.get('stationId')) : null,
      filters: {
        categoryIds: csv(params.get('cat')).map(Number),
        lines: csv(params.get('lines')),
        sizes: csv(params.get('sizes')),
        indoor: csv(params.get('indoor')),
      },
      sort: params.get('sort'),
    }),
    [params],
  );
  const update = useCallback(
    (patch) => {
      const next = { ...state, ...patch, filters: { ...state.filters, ...(patch.filters ?? {}) } };
      const q = {};
      if (next.stationId) q.stationId = next.stationId;
      if (next.filters.categoryIds.length) q.cat = next.filters.categoryIds.join(',');
      if (next.filters.lines.length) q.lines = next.filters.lines.join(',');
      if (next.filters.sizes.length) q.sizes = next.filters.sizes.join(',');
      if (next.filters.indoor.length) q.indoor = next.filters.indoor.join(',');
      if (next.sort) q.sort = next.sort;
      setParams(q, { replace: true });
    },
    [state, setParams],
  );
  return [state, update];
}

/** 장소 탐색 — 역 검색(Day 4) + 지도 마커(Day 6) + 다중 필터(Day 9) */
export default function Explore() {
  const [{ stationId, filters, sort: sortParam }, update] = useExploreParams();
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [pages, setPages] = useState({ items: [], page: 0, hasNext: false, total: 0 });
  const [moreLoading, setMoreLoading] = useState(false);
  const listRef = useRef(null);
  const { primaryPet } = useAuth();

  const sort = sortParam || (stationId ? 'distance' : 'rating');
  const categories = useAsync(() => placeApi.categories(), [], { initial: [] });
  const station = useAsync(() => stationApi.get(stationId), [stationId], { enabled: !!stationId });

  const query = useMemo(
    () => ({
      stationId: stationId ?? undefined,
      radiusKm: stationId ? RADIUS_KM : undefined,
      categoryIds: filters.categoryIds,
      lines: filters.lines,
      sizes: filters.sizes,
      indoor: filters.indoor,
      sort,
      size: PAGE_SIZE,
    }),
    [stationId, filters, sort],
  );
  const queryKey = JSON.stringify(query);

  const result = useAsync(() => placeApi.search({ ...query, page: 0 }), [queryKey]);
  useEffect(() => {
    if (result.data) setPages({ items: result.data.content, page: 0, hasNext: result.data.hasNext, total: result.data.totalElements });
    setSelectedId(null);
  }, [result.data]);

  const loadMore = async () => {
    setMoreLoading(true);
    try {
      const res = await placeApi.search({ ...query, page: pages.page + 1 });
      setPages((p) => ({ items: [...p.items, ...res.content], page: res.page, hasNext: res.hasNext, total: res.totalElements }));
    } catch {
      /* 실패 시 버튼 유지 → 다시 누를 수 있음 */
    } finally {
      setMoreLoading(false);
    }
  };

  const st = stationId ? station.data : null;
  const markers = useMemo(() => {
    const m = pages.items.map((p) => ({ id: p.placeId, lat: p.lat, lng: p.lng, kind: 'place', label: p.name, emoji: categoryMeta(p.categoryId).emoji }));
    if (st) m.push({ id: `st-${st.stationId}`, lat: st.lat, lng: st.lng, kind: 'station', label: `${st.stationName}역`, color: lineInfo(st.lines[0]).color });
    return m;
  }, [pages.items, st]);
  const center = useMemo(() => (st ? { lat: st.lat, lng: st.lng } : null), [st]);

  const onMarkerClick = (id) => {
    setSelectedId(id);
    listRef.current?.querySelector(`[data-place-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const onBookmarkChange = (placeId, on) => setPages((p) => ({ ...p, items: p.items.map((x) => (x.placeId === placeId ? { ...x, bookmarked: on } : x)) }));

  const activeCount = countFilters(filters);
  const petSize = primaryPet ? sizeFromWeight(primaryPet.weight) : null;
  const petSizeHint = petSize && `${primaryPet.name}는 ${SIZE_LABEL[petSize]}이에요. ${SIZE_LABEL[petSize]}을 선택하면 함께 갈 수 있는 곳만 보여요.`;

  return (
    <div className="page explore">
      <Header title="장소 탐색" />
      <StationSearch onSelect={(s) => update({ stationId: s.stationId, sort: null })} />

      {st && (
        <div className="cur-station">
          <span className="cur-station__lines">
            {st.lines.map((l) => (
              <LineBadge key={l} code={l} />
            ))}
          </span>
          <b>{st.stationName}역</b>
          <span className="muted">반경 {RADIUS_KM}km</span>
          <button className="cur-station__clear" onClick={() => update({ stationId: null, sort: null })} aria-label="역 선택 해제">
            ✕
          </button>
        </div>
      )}

      <div className="filter-bar">
        <button className={`filter-btn ${activeCount ? 'is-on' : ''}`} onClick={() => setFilterOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          필터{activeCount > 0 && <em>{activeCount}</em>}
        </button>
        {(categories.data ?? []).map((c) => (
          <Chip key={c.categoryId} active={filters.categoryIds.includes(c.categoryId)} onClick={() => update({ filters: { categoryIds: toggleIn(filters.categoryIds, c.categoryId) } })}>
            {categoryMeta(c.categoryId).emoji} {c.name}
          </Chip>
        ))}
      </div>

      {(filters.lines.length > 0 || filters.sizes.length > 0 || filters.indoor.length > 0) && (
        <div className="applied">
          {filters.lines.map((l) => (
            <button key={l} className="applied__item" onClick={() => update({ filters: { lines: toggleIn(filters.lines, l) } })}>
              <LineBadge code={l} small /> {lineInfo(l).name} ✕
            </button>
          ))}
          {filters.sizes.map((s) => (
            <button key={s} className="applied__item" onClick={() => update({ filters: { sizes: toggleIn(filters.sizes, s) } })}>
              🐶 {SIZE_LABEL[s]} ✕
            </button>
          ))}
          {filters.indoor.map((s) => (
            <button key={s} className="applied__item" onClick={() => update({ filters: { indoor: toggleIn(filters.indoor, s) } })}>
              {INDOOR_LABEL[s]} ✕
            </button>
          ))}
        </div>
      )}

      <div className="explore__map">
        <MapView center={center} markers={markers} radiusKm={st ? RADIUS_KM : null} selectedId={selectedId} onMarkerClick={onMarkerClick} height={260} />
      </div>

      {!stationId && (
        <p className="explore__tip">
          🚇 역을 검색하면 <b>반경 1km</b> 안의 애견동반 장소만 골라 보여드려요
        </p>
      )}

      <div className="list-head">
        <p>
          {result.loading ? '찾는 중…' : (
            <>
              <b>{pages.total}</b>곳의 장소
            </>
          )}
        </p>
        <div className="sort-tabs" role="radiogroup" aria-label="정렬">
          {SORTS.filter((s) => !s.needsStation || stationId).map((s) => (
            <button key={s.value} role="radio" aria-checked={sort === s.value} className={sort === s.value ? 'is-on' : ''} onClick={() => update({ sort: s.value })}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={listRef} className="stack">
        {result.error && <ErrorState error={result.error} onRetry={result.reload} />}
        {!result.error && result.loading && pages.items.length === 0 && [0, 1, 2].map((i) => <Skeleton key={i} h={118} r={20} />)}
        {!result.error && !result.loading && pages.items.length === 0 && (
          <EmptyState
            title="조건에 맞는 장소가 없어요"
            desc={stationId ? '필터를 줄이거나 다른 역을 검색해 보세요' : '필터를 조금 줄여 보세요'}
            action={
              activeCount > 0 && (
                <Button variant="outline" size="md" onClick={() => update({ filters: { categoryIds: [], lines: [], sizes: [], indoor: [] } })}>
                  필터 초기화
                </Button>
              )
            }
          />
        )}
        {!result.error &&
          pages.items.map((p) => (
            <PlaceCard
              key={p.placeId}
              place={p}
              selected={selectedId === p.placeId}
              onSelect={setSelectedId}
              onBookmarkChange={onBookmarkChange}
              showDistanceFrom={st ? `${st.stationName}역` : null}
            />
          ))}
        {pages.hasNext && !result.loading && (
          <Button variant="outline" size="md" block onClick={loadMore} loading={moreLoading}>
            장소 더 보기
          </Button>
        )}
      </div>

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filters}
        categories={categories.data ?? []}
        petSizeHint={petSizeHint}
        onApply={(f) => update({ filters: f })}
      />
    </div>
  );
}
