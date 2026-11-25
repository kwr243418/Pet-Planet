import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { hospitalApi, hotelApi, placeApi } from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { usePageTitle } from '../hooks/usePage.js';
import { NowStation, PageHero } from '../components/layout/Site.jsx';
import { Button, EmptyState, ErrorState, OptionGroup, Skeleton } from '../components/common/ui.jsx';
import FilterPanel, { DEFAULT_FILTERS, INDOOR_QUERY } from '../components/place/FilterPanel.jsx';
import { PlaceResultCard } from '../components/place/PlaceCards.jsx';
import MapView from '../components/map/MapView.jsx';
import OriginPicker from '../components/nearby/OriginPicker.jsx';
import RegionPicker from '../components/transit/RegionPicker.jsx';
import { HospitalCard, HotelCard } from '../components/nearby/FacilityCards.jsx';
import { readOrigin, saveOrigin } from '../utils/origin.js';
import { normalizeSido, regionLabel } from '../utils/region.js';

export const EXPLORE_STEPS = ['출발점 · 지역 선택', '주변 장소 목록', '장소 상세', '관심 장소 찜'];
const MODES = [
  { value: 'me', label: '내 근처' },
  { value: 'region', label: '지역별' },
];
const TABS = [
  { value: 'place', label: '동반 장소' },
  { value: 'hospital', label: '동물병원' },
  { value: 'hotel', label: '펫호텔' },
];
const RADIUS_OPTIONS = [1, 3, 5];
const SORTS = {
  me: [
    { value: 'distance', label: '가까운 순' },
    { value: 'transit', label: '정류장 가까운 순' },
    { value: 'reviews', label: '리뷰 많은 순' },
  ],
  region: [
    { value: 'reviews', label: '리뷰 많은 순' },
    { value: 'transit', label: '정류장 가까운 순' },
  ],
};
const MODE_KEY = 'pp-explore-mode';
const REGION_KEY = 'pp-region';
const PAGE_SIZE = { place: 8, hospital: 12, hotel: 12 };

const csv = (v) => (v ? v.split(',').filter(Boolean) : []);
const readLS = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writeLS = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* 저장 못 해도 화면은 동작 */
  }
};
/** 마지막으로 고른 지역 { sido, sigungu } */
export function readRegion() {
  try {
    const r = JSON.parse(readLS(REGION_KEY));
    return r?.sido ? r : null;
  } catch {
    return null;
  }
}

/** URL 쿼리 ↔ 화면 상태 (새로고침·뒤로가기·공유해도 같은 결과) */
function useExploreState() {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => {
    const urlMode = params.get('mode');
    const mode = urlMode === 'me' || urlMode === 'region' ? urlMode : readLS(MODE_KEY) === 'region' ? 'region' : 'me';
    const savedRegion = readRegion();
    return {
      mode,
      me: params.get('lat') && params.get('lng') ? { label: params.get('from') || '내 위치', lat: Number(params.get('lat')), lng: Number(params.get('lng')) } : readOrigin(),
      region: params.get('sido') ? { sido: normalizeSido(params.get('sido')) ?? params.get('sido'), sigungu: params.get('sigungu') || null } : savedRegion,
      tab: TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'place',
      filters: {
        categoryIds: csv(params.get('cat')).map(Number),
        sizes: csv(params.get('sizes')),
        indoor: params.get('indoor') || 'ALL',
        radiusKm: RADIUS_OPTIONS.includes(Number(params.get('r'))) ? Number(params.get('r')) : 3,
        nearStop: params.get('near') === '1',
      },
      sort: SORTS[mode].some((s) => s.value === params.get('sort')) ? params.get('sort') : SORTS[mode][0].value,
    };
  }, [params]);
  const update = useCallback(
    (patch) => {
      const n = { ...state, ...patch, filters: { ...state.filters, ...(patch.filters ?? {}) } };
      if (patch.mode && patch.mode !== state.mode && !patch.sort) n.sort = SORTS[n.mode][0].value;
      const q = { mode: n.mode };
      if (n.mode === 'me' && n.me) Object.assign(q, { lat: n.me.lat, lng: n.me.lng, from: n.me.label });
      if (n.mode === 'region' && n.region?.sido) {
        q.sido = n.region.sido;
        if (n.region.sigungu) q.sigungu = n.region.sigungu;
      }
      if (n.tab !== 'place') q.tab = n.tab;
      if (n.filters.categoryIds.length) q.cat = n.filters.categoryIds.join(',');
      if (n.filters.sizes.length) q.sizes = n.filters.sizes.join(',');
      if (n.filters.indoor !== 'ALL') q.indoor = n.filters.indoor;
      if (n.mode === 'me' && n.filters.radiusKm !== 3) q.r = n.filters.radiusKm;
      if (n.filters.nearStop) q.near = '1';
      if (n.sort !== SORTS[n.mode][0].value) q.sort = n.sort;
      setParams(q, { replace: true });
    },
    [state, setParams],
  );
  return [state, update];
}

const FETCH = { place: placeApi.search, hospital: hospitalApi.list, hotel: hotelApi.list };
const idOf = (tab, x) => (tab === 'place' ? x.placeId : tab === 'hospital' ? x.hospitalId : x.hotelId);

/** S02 주변 탐색 — [내 근처 | 지역별] 기준 동반 장소 · 동물병원 · 펫호텔 + 버스 정류장 접근성 */
export default function Explore() {
  const [{ mode, me, region, tab, filters, sort }, update] = useExploreState();
  const [selectedId, setSelectedId] = useState(null);
  const [list, setList] = useState({ items: [], page: 0, hasNext: false, total: 0 });
  const [moreLoading, setMoreLoading] = useState(false);
  const listRef = useRef(null);

  const categories = useAsync(() => placeApi.categories(), [], { initial: [] });

  // 기준: 내 근처 → 좌표 + 반경 / 지역별 → 시도 · 시군구
  const origin = mode === 'me' && me ? me : null;
  const baseQuery = mode === 'me' ? (me ? { lat: me.lat, lng: me.lng, radiusKm: filters.radiusKm } : null) : region?.sido ? { sido: region.sido, sigungu: region.sigungu ?? undefined } : null;
  const title = mode === 'me' ? (me ? `${me.label} 반경 ${filters.radiusKm}km` : '출발점을 골라 주세요') : region?.sido ? regionLabel(region) : '지역을 골라 주세요';
  usePageTitle(baseQuery ? (mode === 'me' ? `${me.label} 주변 장소` : `${regionLabel(region)} 반려동물 동반 장소`) : '주변 탐색');

  useEffect(() => writeLS(MODE_KEY, mode), [mode]);
  useEffect(() => {
    if (region?.sido) writeLS(REGION_KEY, JSON.stringify(region));
  }, [region?.sido, region?.sigungu]);

  const query = useMemo(
    () =>
      baseQuery && {
        ...baseQuery,
        nearStop: filters.nearStop || undefined,
        ...(tab === 'place'
          ? { categoryIds: filters.categoryIds, sizes: filters.sizes, indoor: INDOOR_QUERY[filters.indoor], sort }
          : {}),
        size: PAGE_SIZE[tab],
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(baseQuery), filters, sort, tab],
  );
  const queryKey = JSON.stringify([tab, query]);
  // 조건이 바뀌면 이전 결과(다른 탭의 카드 등)를 먼저 비우고, 새 결과가 오면 채워요
  useEffect(() => {
    setList({ items: [], page: 0, hasNext: false, total: 0 });
    setSelectedId(null);
  }, [queryKey]);
  const result = useAsync(() => FETCH[tab]({ ...query, page: 0 }), [queryKey], { enabled: !!query });
  useEffect(() => {
    if (result.data) setList({ items: result.data.content, page: 0, hasNext: result.data.hasNext, total: result.data.totalElements });
  }, [result.data]);

  const loadMore = async () => {
    setMoreLoading(true);
    try {
      const res = await FETCH[tab]({ ...query, page: list.page + 1 });
      setList((l) => ({ items: [...l.items, ...res.content], page: res.page, hasNext: res.hasNext, total: res.totalElements }));
    } finally {
      setMoreLoading(false);
    }
  };

  const markers = useMemo(() => {
    const m = list.items.map((x, i) => ({ id: idOf(tab, x), lat: x.lat, lng: x.lng, label: x.name, num: i + 1, kind: 'place' }));
    if (origin) m.push({ id: 'origin', lat: origin.lat, lng: origin.lng, kind: 'origin', label: origin.label });
    return m;
  }, [tab, list.items, origin?.lat, origin?.lng, origin?.label]);
  const center = useMemo(() => (origin ? { lat: origin.lat, lng: origin.lng } : null), [origin?.lat, origin?.lng]);

  const onMarkerClick = (id) => {
    setSelectedId(id);
    listRef.current?.querySelector(`[data-place-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const onBookmarkChange = (placeId, on) => setList((l) => ({ ...l, items: l.items.map((x) => (x.placeId === placeId ? { ...x, bookmarked: on } : x)) }));
  const detailQuery = mode === 'me' && me ? '?from=me' : '';
  const setMe = (o) => {
    saveOrigin(o);
    update({ mode: 'me', me: o });
  };
  const what = TABS.find((t) => t.value === tab).label;

  return (
    <>
      <PageHero
        line="E"
        en="NEARBY"
        title={'어디서 출발하든,\n같이 갈 수 있는 곳'}
        desc={'내 위치나 지역을 고르면 반려동물과 갈 수 있는 장소와 동물병원 · 펫호텔을\n가까운 버스 정류장 · 대중교통 접근성과 함께 보여 드려요.'}
      />
      <NowStation steps={EXPLORE_STEPS} current={baseQuery ? 1 : 0} />

      <div className="container explore">
        <div className="explore-mode">
          <OptionGroup size="lg" label="탐색 방법" value={mode} onChange={(m) => update({ mode: m })} options={MODES} />
        </div>
        {mode === 'me' ? <OriginPicker origin={me} onOriginChange={setMe} /> : <RegionPicker type={tab} value={region} onChange={(r) => update({ region: r })} />}

        <div className="explore-tabs">
          <OptionGroup size="lg" label="찾을 곳" value={tab} onChange={(t) => update({ tab: t })} options={TABS} />
        </div>
        <FilterPanel
          categories={categories.data ?? []}
          value={filters}
          onChange={(f) => update({ filters: f })}
          radiusOptions={mode === 'me' ? RADIUS_OPTIONS : null}
          placeFilters={tab === 'place'}
        />

        <div className="results-head">
          <h2 className="section-title">{title}</h2>
          {tab === 'place' && (
            <label className="select">
              <span className="sr-only">정렬</span>
              <select value={sort} onChange={(e) => update({ sort: e.target.value })}>
                {SORTS[mode].map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="results">
          <div className="results__list" ref={listRef}>
            {!query && (
              <EmptyState
                title={mode === 'me' ? '출발점을 먼저 골라 주세요' : '지역을 먼저 골라 주세요'}
                desc={mode === 'me' ? '현재 위치를 찾거나 시연 위치를 고르면 주변을 보여 드려요.' : '시 · 도와 시 · 군 · 구를 고르면 그 지역의 장소를 보여 드려요.'}
              />
            )}
            {result.error && <ErrorState error={result.error} onRetry={result.reload} />}
            {query && !result.error && result.loading && list.items.length === 0 && <Skeleton h={220} r={0} />}
            {query && !result.error && !result.loading && list.items.length === 0 && (
              <EmptyState
                title={`조건에 맞는 ${what}이 없어요`}
                desc={mode === 'me' ? `거리를 ${RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1]}km로 넓히거나 필터를 줄여 보세요.` : '다른 시 · 군 · 구를 고르거나 필터를 줄여 보세요.'}
                action={
                  <Button variant="outline" size="sm" onClick={() => update({ filters: { ...DEFAULT_FILTERS, radiusKm: filters.radiusKm } })}>
                    필터 초기화
                  </Button>
                }
              />
            )}
            {!result.error && list.items.length > 0 && (
              <>
                <p className="results__count">
                  <b>{list.total.toLocaleString('ko-KR')}</b>곳
                </p>
                {tab === 'place' ? (
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
                ) : (
                  <div className="facility-list">
                    {list.items.map((f, i) =>
                      tab === 'hospital' ? <HospitalCard key={f.hospitalId} hospital={f} index={i + 1} origin={origin} /> : <HotelCard key={f.hotelId} hotel={f} index={i + 1} origin={origin} />,
                    )}
                  </div>
                )}
                {list.hasNext && (
                  <Button variant="outline" block onClick={loadMore} loading={moreLoading} className="results__more">
                    {what} 더 보기
                  </Button>
                )}
              </>
            )}
          </div>
          <aside className="results__map">
            <MapView
              center={center}
              markers={markers}
              radiusKm={origin ? filters.radiusKm : null}
              selectedId={selectedId}
              onMarkerClick={onMarkerClick}
              height={520}
              label={origin ? `카카오맵 · 반경 ${filters.radiusKm}km` : `카카오맵 · ${region?.sido ? regionLabel(region) : '지역'}`}
            />
          </aside>
        </div>
      </div>
    </>
  );
}
