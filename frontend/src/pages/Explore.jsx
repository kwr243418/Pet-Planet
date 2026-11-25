import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { hospitalApi, hotelApi, placeApi, stationApi } from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { usePageTitle } from '../hooks/usePage.js';
import { NowStation, PageHero } from '../components/layout/Site.jsx';
import { Button, EmptyState, ErrorState, OptionGroup, Skeleton } from '../components/common/ui.jsx';
import { LineDiagram, LineSelector } from '../components/place/LinePicker.jsx';
import FilterPanel, { DEFAULT_FILTERS, INDOOR_QUERY } from '../components/place/FilterPanel.jsx';
import { PlaceResultCard } from '../components/place/PlaceCards.jsx';
import MapView from '../components/map/MapView.jsx';
import OriginPicker from '../components/nearby/OriginPicker.jsx';
import { HospitalCard, HotelCard } from '../components/nearby/FacilityCards.jsx';
import { readOrigin, saveOrigin } from '../utils/origin.js';
import { haversineKm } from '../utils/geo.js';
import { DEFAULT_LINE, EXTRA_LINES, MAIN_LINES, stationBase, stationLabel } from '../utils/subway.js';

const ALL_LINES = [...MAIN_LINES, ...EXTRA_LINES];

export const EXPLORE_STEPS = ['출발점 선택', '주변 장소 목록', '장소 상세', '관심 장소 찜'];
const MODE_KEY = 'pp-explore-mode';
// 지하철역은 걸어서 갈 거리, 내 위치(지방)는 차·버스 거리까지
const RADIUS_OPTIONS = { station: [0.5, 1], me: [1, 3, 5] };
const TABS = [
  { value: 'place', label: '동반 장소' },
  { value: 'hospital', label: '동물병원' },
  { value: 'hotel', label: '펫호텔' },
];
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
const readMode = () => {
  try {
    return localStorage.getItem(MODE_KEY);
  } catch {
    return null;
  }
};

/** URL 쿼리 ↔ 화면 상태 (새로고침·뒤로가기·공유해도 같은 결과) */
function useExploreState() {
  const [params, setParams] = useSearchParams();
  const state = useMemo(
    () => ({
      line: [params.get('line'), readLastStation()?.line].find((l) => ALL_LINES.includes(l)) ?? DEFAULT_LINE,
      stationId: params.get('stationId') ? Number(params.get('stationId')) : null,
      mode: params.get('mode') === 'me' || (!params.get('mode') && !params.get('stationId') && readMode() === 'me') ? 'me' : 'station',
      me:
        params.get('lat') && params.get('lng')
          ? { label: params.get('from') || '내 위치', lat: Number(params.get('lat')), lng: Number(params.get('lng')) }
          : readOrigin(),
      tab: TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'place',
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
      if (n.mode === 'me') {
        q.mode = 'me';
        if (n.me) Object.assign(q, { lat: n.me.lat, lng: n.me.lng, from: n.me.label });
      } else if (n.stationId) q.stationId = n.stationId;
      if (n.tab !== 'place') q.tab = n.tab;
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

/** S02 주변 탐색 — 출발점(지하철역 · 내 위치) 기준 동반 장소 · 동물병원 · 펫호텔 */
export default function Explore() {
  const [{ line, stationId, mode, me, tab, filters: rawFilters, sort }, update] = useExploreState();
  const radiusOptions = RADIUS_OPTIONS[mode];
  const filters = radiusOptions.includes(rawFilters.radiusKm) ? rawFilters : { ...rawFilters, radiusKm: mode === 'me' ? 3 : 1 };
  const [selectedId, setSelectedId] = useState(null);
  const [list, setList] = useState({ items: [], page: 0, hasNext: false, total: 0 });
  const [moreLoading, setMoreLoading] = useState(false);
  const listRef = useRef(null);

  const categories = useAsync(() => placeApi.categories(), [], { initial: [] });
  const lineStations = useAsync(() => stationApi.byLine(line), [line]);

  // 역이 없으면: 마지막 역(같은 호선) → 홍대입구 → 노선 첫 역
  useEffect(() => {
    const rows = lineStations.data;
    if (mode !== 'station' || !rows?.length || rows[0].line !== line) return;
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
  }, [lineStations.data, mode]);

  const station = mode === 'station' ? lineStations.data?.find((s) => s.stationId === stationId) ?? null : null;
  // 출발점: 지하철역 또는 내 위치 → 검색 쿼리 · 지도 중심 · 제목에 똑같이 씀
  const origin = mode === 'me' ? (me ? { ...me, kind: 'me' } : null) : station ? { label: stationLabel(station.stationName), lat: station.lat, lng: station.lng, kind: 'station' } : null;
  const originQuery = mode === 'me' ? (me ? { lat: me.lat, lng: me.lng } : null) : stationId ? { stationId } : null;
  usePageTitle(origin ? `${origin.label} 주변 장소` : '주변 탐색');
  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* 무시 */
    }
  }, [mode]);
  useEffect(() => {
    if (station) localStorage.setItem(LAST_KEY, JSON.stringify({ stationId: station.stationId, stationName: station.stationName, line: station.line, lat: station.lat, lng: station.lng }));
  }, [station]);

  const query = useMemo(
    () => ({
      ...(originQuery ?? {}),
      radiusKm: filters.radiusKm,
      categoryIds: filters.categoryIds,
      sizes: filters.sizes,
      indoor: INDOOR_QUERY[filters.indoor],
      sort,
      size: PAGE_SIZE,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(originQuery), filters, sort],
  );
  const result = useAsync(() => placeApi.search({ ...query, page: 0 }), [JSON.stringify(query)], { enabled: !!originQuery && tab === 'place' });
  const facilityQuery = originQuery ? { ...originQuery, radiusKm: filters.radiusKm, size: 20 } : null;
  const hospitals = useAsync(() => hospitalApi.list(facilityQuery), [JSON.stringify(facilityQuery)], { enabled: !!facilityQuery && tab === 'hospital' });
  const hotels = useAsync(() => hotelApi.list(facilityQuery), [JSON.stringify(facilityQuery)], { enabled: !!facilityQuery && tab === 'hotel' });
  const facilities = tab === 'hospital' ? hospitals : tab === 'hotel' ? hotels : null;
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
    const rows = tab === 'place' ? list.items.map((p) => ({ id: p.placeId, lat: p.lat, lng: p.lng, label: p.name })) : (facilities?.data?.content ?? []).map((f) => ({ id: f.hospitalId ?? f.hotelId, lat: f.lat, lng: f.lng, label: f.name }));
    const m = rows.map((r, i) => ({ ...r, num: i + 1, kind: 'place' }));
    if (station) m.push({ id: `st-${station.stationId}`, lat: station.lat, lng: station.lng, kind: 'station', label: stationBase(station.stationName) });
    else if (origin) m.push({ id: 'origin', lat: origin.lat, lng: origin.lng, kind: 'station', label: origin.label });
    return m;
  }, [tab, list.items, facilities?.data, station, origin?.lat, origin?.lng, origin?.label]);
  const center = useMemo(() => (origin ? { lat: origin.lat, lng: origin.lng } : null), [origin?.lat, origin?.lng]);

  const onMarkerClick = (id) => {
    setSelectedId(id);
    listRef.current?.querySelector(`[data-place-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const onBookmarkChange = (placeId, on) => setList((l) => ({ ...l, items: l.items.map((x) => (x.placeId === placeId ? { ...x, bookmarked: on } : x)) }));
  const detailQuery = station ? `?line=${encodeURIComponent(station.line)}&stationId=${station.stationId}` : mode === 'me' && me ? '?from=me' : '';
  const setMe = (o) => {
    saveOrigin(o);
    update({ mode: 'me', me: o });
  };

  return (
    <>
      <PageHero
        line="E"
        en="NEARBY"
        title={'어디서 출발하든,\n같이 갈 수 있는 곳'}
        desc={'내 위치나 가까운 지하철역을 출발점으로, 반려동물과 갈 수 있는 장소와\n동물병원 · 펫호텔을 거리와 가는 방법까지 함께 보여 드려요.'}
      />
      <NowStation steps={EXPLORE_STEPS} current={origin ? 1 : 0} />

      <div className="container explore">
        <OriginPicker mode={mode} onModeChange={(m) => update({ mode: m, filters: { radiusKm: m === 'me' ? 3 : 1 } })} origin={me} onOriginChange={setMe} />
        {mode === 'station' && (
          <>
            <LineSelector value={line} onChange={(l) => update({ line: l, stationId: null })} />
            {lineStations.error ? (
              <ErrorState error={lineStations.error} onRetry={lineStations.reload} />
            ) : (
              <LineDiagram stations={lineStations.data ?? []} loading={lineStations.loading && !lineStations.data} selectedId={stationId} onSelect={(s) => update({ stationId: s.stationId })} />
            )}
          </>
        )}
        <div className="explore-tabs">
          <OptionGroup size="lg" label="찾을 곳" value={tab} onChange={(t) => update({ tab: t })} options={TABS} />
        </div>
        {tab === 'place' ? (
          <FilterPanel categories={categories.data ?? []} value={filters} onChange={(f) => update({ filters: f })} radiusOptions={radiusOptions} radiusLabel={mode === 'me' ? '출발점에서 거리' : '역에서 거리'} />
        ) : (
          <div className="filter-panel filter-panel--radius">
            <div className="filter-panel__group">
              <p className="filter-panel__label">{mode === 'me' ? '출발점에서 거리' : '역에서 거리'}</p>
              <OptionGroup label="거리" value={filters.radiusKm} onChange={(r) => update({ filters: { radiusKm: r } })} options={radiusOptions.map((r) => ({ value: r, label: `${r}km` }))} />
            </div>
          </div>
        )}

        <div className="results-head">
          <h2 className="section-title">{origin ? `${origin.label} 반경 ${filters.radiusKm}km` : mode === 'me' ? '출발점을 골라 주세요' : '역을 선택해 주세요'}</h2>
          <label className="select" hidden={tab !== 'place'}>
            <span className="sr-only">정렬</span>
            <select value={sort} onChange={(e) => update({ sort: e.target.value })}>
              <option value="distance">가까운 순</option>
              <option value="reviews">리뷰 많은 순</option>
            </select>
          </label>
        </div>

        <div className="results">
          {tab !== 'place' ? (
            <div className="results__list">
              {!originQuery && <EmptyState title="출발점을 먼저 골라 주세요" desc="현재 위치를 찾거나 시연 위치를 고르면 주변을 보여 드려요." />}
              {facilities.error && <ErrorState error={facilities.error} onRetry={facilities.reload} />}
              {originQuery && !facilities.error && facilities.loading && !facilities.data && <Skeleton h={180} r={0} />}
              {facilities.data && facilities.data.content.length === 0 && (
                <EmptyState
                  title={`반경 ${filters.radiusKm}km 안에 ${tab === 'hospital' ? '동물병원' : '펫호텔'}이 없어요`}
                  desc={'거리를 넓혀 보세요.\n공공데이터를 아직 적재하지 않았다면 시연 업체만 보여요.'}
                />
              )}
              {facilities.data && facilities.data.content.length > 0 && (
                <>
                  <p className="results__count">
                    <b>{facilities.data.totalElements}</b>곳{facilities.data.totalElements > facilities.data.content.length && ` 중 가까운 ${facilities.data.content.length}곳`}
                  </p>
                  <div className="facility-list">
                    {facilities.data.content.map((f, i) =>
                      tab === 'hospital' ? <HospitalCard key={f.hospitalId} hospital={f} index={i + 1} origin={origin} /> : <HotelCard key={f.hotelId} hotel={f} index={i + 1} origin={origin} />,
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
          <div className="results__list" ref={listRef}>
            {result.error && <ErrorState error={result.error} onRetry={result.reload} />}
            {!result.error && result.loading && list.items.length === 0 && (
              <div className="results__grid">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} h={250} r={36} />
                ))}
              </div>
            )}
            {!originQuery && mode === 'me' && <EmptyState title="출발점을 먼저 골라 주세요" desc="현재 위치를 찾거나 시연 위치를 고르면 주변을 보여 드려요." />}
            {!result.error && !result.loading && originQuery && list.items.length === 0 && (
              <EmptyState
                title="조건에 맞는 장소가 없어요"
                desc={`거리를 ${radiusOptions[radiusOptions.length - 1]}km로 넓히거나\n필터를 줄여 보세요.`}
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
          )}
          <aside className="results__map">
            <MapView center={center} markers={markers} radiusKm={origin ? filters.radiusKm : null} selectedId={selectedId} onMarkerClick={onMarkerClick} height={520} label={`카카오맵 · 반경 ${filters.radiusKm}km`} />
          </aside>
        </div>
      </div>
    </>
  );
}
