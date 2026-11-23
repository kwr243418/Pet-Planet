import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { placeApi, stationApi } from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { NowStation, PageHero } from '../components/layout/Site.jsx';
import { StationBuildings } from '../components/illust/index.jsx';
import { Button, EmptyState, ErrorState, Skeleton } from '../components/common/ui.jsx';
import { LineDiagram, LineSelector } from '../components/place/LinePicker.jsx';
import FilterPanel, { DEFAULT_FILTERS, INDOOR_QUERY } from '../components/place/FilterPanel.jsx';
import { PlaceResultCard } from '../components/place/PlaceCards.jsx';
import MapView from '../components/map/MapView.jsx';
import { haversineKm } from '../utils/geo.js';
import { DEFAULT_LINE, EXTRA_LINES, MAIN_LINES, stationBase, stationLabel } from '../utils/subway.js';

const ALL_LINES = [...MAIN_LINES, ...EXTRA_LINES];

export const EXPLORE_STEPS = ['노선 · 역 선택', '역세권 장소 목록', '장소 상세', '관심 장소 찜'];
const LAST_KEY = 'pp-last-station';
const PAGE_SIZE = 8;

export function readLastStation() {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY));
  } catch {
    return null;
  }
}

const csv = (v) => (v ? v.split(',').filter(Boolean) : []);

/** URL 쿼리 ↔ 화면 상태 (새로고침·뒤로가기·공유해도 같은 결과) */
function useExploreState() {
  const [params, setParams] = useSearchParams();
  const state = useMemo(
    () => ({
      line: [params.get('line'), readLastStation()?.line].find((l) => ALL_LINES.includes(l)) ?? DEFAULT_LINE,
      stationId: params.get('stationId') ? Number(params.get('stationId')) : null,
      filters: {
        categoryIds: csv(params.get('cat')).map(Number),
        sizes: csv(params.get('sizes')),
        indoor: params.get('indoor') || 'ALL',
        radiusKm: Number(params.get('r')) || 1,
      },
      sort: params.get('sort') || 'distance',
    }),
    [params],
  );
  const update = useCallback(
    (patch) => {
      const n = { ...state, ...patch, filters: { ...state.filters, ...(patch.filters ?? {}) } };
      const q = { line: n.line };
      if (n.stationId) q.stationId = n.stationId;
      if (n.filters.categoryIds.length) q.cat = n.filters.categoryIds.join(',');
      if (n.filters.sizes.length) q.sizes = n.filters.sizes.join(',');
      if (n.filters.indoor !== 'ALL') q.indoor = n.filters.indoor;
      if (n.filters.radiusKm !== 1) q.r = n.filters.radiusKm;
      if (n.sort !== 'distance') q.sort = n.sort;
      setParams(q, { replace: true });
    },
    [state, setParams],
  );
  return [state, update];
}

/** S02 역세권 장소 탐색 */
export default function Explore() {
  const [{ line, stationId, filters, sort }, update] = useExploreState();
  const [selectedId, setSelectedId] = useState(null);
  const [list, setList] = useState({ items: [], page: 0, hasNext: false, total: 0 });
  const [moreLoading, setMoreLoading] = useState(false);
  const listRef = useRef(null);

  const categories = useAsync(() => placeApi.categories(), [], { initial: [] });
  const lineStations = useAsync(() => stationApi.byLine(line), [line]);

  // 역이 없으면: 마지막 역(같은 호선) → 홍대입구 → 노선 첫 역
  useEffect(() => {
    const rows = lineStations.data;
    if (!rows?.length || rows[0].line !== line) return;
    if (stationId && rows.some((s) => s.stationId === stationId)) return;
    // 같은 역이 이 노선에 있으면 그 역, 없으면 직전 역과 가장 가까운 역, 처음이면 홍대입구
    const last = readLastStation();
    const nearestTo = (o) => rows.reduce((a, b) => (haversineKm(o.lat, o.lng, a.lat, a.lng) <= haversineKm(o.lat, o.lng, b.lat, b.lng) ? a : b));
    const pick =
      rows.find((s) => stationBase(s.stationName) === stationBase(last?.stationName)) ??
      (last?.lat ? nearestTo(last) : null) ??
      rows.find((s) => stationBase(s.stationName) === '홍대입구') ??
      rows[Math.floor(rows.length / 2)];
    update({ stationId: pick.stationId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineStations.data]);

  const station = lineStations.data?.find((s) => s.stationId === stationId) ?? null;
  useEffect(() => {
    if (station) localStorage.setItem(LAST_KEY, JSON.stringify({ stationId: station.stationId, stationName: station.stationName, line: station.line, lat: station.lat, lng: station.lng }));
  }, [station]);

  const query = useMemo(
    () => ({
      stationId: stationId ?? undefined,
      radiusKm: filters.radiusKm,
      categoryIds: filters.categoryIds,
      sizes: filters.sizes,
      indoor: INDOOR_QUERY[filters.indoor],
      sort,
      size: PAGE_SIZE,
    }),
    [stationId, filters, sort],
  );
  const result = useAsync(() => placeApi.search({ ...query, page: 0 }), [JSON.stringify(query)], { enabled: !!stationId });
  useEffect(() => {
    if (result.data) setList({ items: result.data.content, page: 0, hasNext: result.data.hasNext, total: result.data.totalElements });
    setSelectedId(null);
  }, [result.data]);

  const loadMore = async () => {
    setMoreLoading(true);
    try {
      const res = await placeApi.search({ ...query, page: list.page + 1 });
      setList((l) => ({ items: [...l.items, ...res.content], page: res.page, hasNext: res.hasNext, total: res.totalElements }));
    } finally {
      setMoreLoading(false);
    }
  };

  const markers = useMemo(() => {
    const m = list.items.map((p, i) => ({ id: p.placeId, num: i + 1, lat: p.lat, lng: p.lng, kind: 'place', label: p.name }));
    if (station) m.push({ id: `st-${station.stationId}`, lat: station.lat, lng: station.lng, kind: 'station', label: stationBase(station.stationName) });
    return m;
  }, [list.items, station]);
  const center = useMemo(() => (station ? { lat: station.lat, lng: station.lng } : null), [station]);

  const onMarkerClick = (id) => {
    setSelectedId(id);
    listRef.current?.querySelector(`[data-place-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const onBookmarkChange = (placeId, on) => setList((l) => ({ ...l, items: l.items.map((x) => (x.placeId === placeId ? { ...x, bookmarked: on } : x)) }));
  const detailQuery = station ? `?line=${encodeURIComponent(station.line)}&stationId=${station.stationId}` : '';

  return (
    <>
      <PageHero
        line="E"
        en="EXPLORE"
        title={'역에서 걸어서 1km,\n같이 갈 수 있는 곳'}
        desc={'호선과 역을 고르면 반경 1km 안의 카페 · 식당 · 숙소 · 운동장을\n크기와 실내 · 외 조건으로 골라 드려요.'}
        art={<StationBuildings />}
      />
      <NowStation steps={EXPLORE_STEPS} current={station ? 1 : 0} />

      <div className="container explore">
        <LineSelector value={line} onChange={(l) => update({ line: l, stationId: null })} />
        {lineStations.error ? (
          <ErrorState error={lineStations.error} onRetry={lineStations.reload} />
        ) : (
          <LineDiagram stations={lineStations.data ?? []} loading={lineStations.loading && !lineStations.data} selectedId={stationId} onSelect={(s) => update({ stationId: s.stationId })} />
        )}
        <FilterPanel categories={categories.data ?? []} value={filters} onChange={(f) => update({ filters: f })} />

        <div className="results-head">
          <h2 className="section-title">{station ? `${stationLabel(station.stationName)} 반경 ${filters.radiusKm}km` : '역을 선택해 주세요'}</h2>
          <label className="select">
            <span className="sr-only">정렬</span>
            <select value={sort} onChange={(e) => update({ sort: e.target.value })}>
              <option value="distance">가까운 순</option>
              <option value="reviews">리뷰 많은 순</option>
            </select>
          </label>
        </div>

        <div className="results">
          <div className="results__list" ref={listRef}>
            {result.error && <ErrorState error={result.error} onRetry={result.reload} />}
            {!result.error && result.loading && list.items.length === 0 && (
              <div className="results__grid">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} h={250} r={36} />
                ))}
              </div>
            )}
            {!result.error && !result.loading && stationId && list.items.length === 0 && (
              <EmptyState
                title="조건에 맞는 장소가 없어요"
                desc={'거리를 1km로 넓히거나\n필터를 줄여 보세요.'}
                action={
                  <Button variant="outline" size="sm" onClick={() => update({ filters: DEFAULT_FILTERS })}>
                    필터 초기화
                  </Button>
                }
              />
            )}
            {!result.error && list.items.length > 0 && (
              <>
                <p className="results__count">
                  <b>{list.total}</b>곳
                </p>
                <div className="results__grid">
                  {list.items.map((p, i) => (
                    <PlaceResultCard
                      key={p.placeId}
                      place={p}
                      index={i + 1}
                      radiusKm={filters.radiusKm}
                      selected={selectedId === p.placeId}
                      onHover={setSelectedId}
                      onBookmarkChange={onBookmarkChange}
                      query={detailQuery}
                    />
                  ))}
                </div>
                {list.hasNext && (
                  <Button variant="outline" block onClick={loadMore} loading={moreLoading} className="results__more">
                    장소 더 보기
                  </Button>
                )}
              </>
            )}
          </div>
          <aside className="results__map">
            <MapView center={center} markers={markers} radiusKm={station ? filters.radiusKm : null} selectedId={selectedId} onMarkerClick={onMarkerClick} height={520} label={`카카오맵 · 반경 ${filters.radiusKm}km`} />
          </aside>
        </div>
      </div>
    </>
  );
}
