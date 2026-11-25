import { useState } from 'react';
import { busApi } from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { Button, Skeleton } from '../common/ui.jsx';
import TransitBadge, { GradeLegend } from './TransitBadge.jsx';
import PetBusGuide from './PetBusGuide.jsx';

const STATUS_TEXT = {
  NO_KEY: '실시간 도착정보는 준비 중이에요 (서버에 인증키를 넣으면 보여요).',
  NO_CITY: '이 정류장은 실시간 도착정보를 제공하지 않는 지역이에요.',
  UNAVAILABLE: '실시간 도착정보를 지금 불러오지 못했어요. 잠시 후 다시 눌러 주세요.',
};

/**
 * 버스로 가기: 목적지 근처 정류장(반경 500m) · 지나가는 노선 · 실시간 도착 + 반려동물 버스 이용 안내
 * dest: { name, lat, lng, busAccess }
 */
export default function TransitPanel({ dest }) {
  const stops = useAsync(() => busApi.nearby({ lat: dest.lat, lng: dest.lng, radiusM: 500, limit: 3 }), [dest.lat, dest.lng]);
  const [openId, setOpenId] = useState(null);
  const list = stops.data ?? [];
  const selected = list.find((s) => s.stopId === openId) ?? list[0];

  return (
    <section className="transit-panel" aria-label="버스로 가기">
      <div className="transit-panel__head">
        <div>
          <p className="eyebrow eyebrow--gold">버스로 가기</p>
          <h2 className="section-title">대중교통 접근성</h2>
        </div>
        <TransitBadge access={dest.busAccess} />
      </div>
      <GradeLegend />

      {stops.loading && !stops.data && <Skeleton h={120} r={0} />}
      {stops.error && <p className="muted">정류장 정보를 불러오지 못했어요. {stops.error.message}</p>}
      {stops.data && list.length === 0 && (
        <p className="muted transit-panel__none">반경 500m 안에 버스 정류장이 없어요. 자가용이나 택시로 가는 걸 추천해요.</p>
      )}
      {list.length > 0 && (
        <div className="transit-panel__body">
          <ol className="stop-list" aria-label="가까운 버스 정류장">
            {list.map((s) => (
              <li key={s.stopId}>
                <button type="button" className={`stop-item ${selected?.stopId === s.stopId ? 'is-on' : ''}`} aria-pressed={selected?.stopId === s.stopId} onClick={() => setOpenId(s.stopId)}>
                  <b className="stop-item__name">{s.name}</b>
                  <span className="stop-item__meta">
                    {s.distanceM}m · 도보 {s.walkMin}분{s.routeCount > 0 && ` · 노선 ${s.routeCount}개`}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {selected && <StopDetail key={selected.stopId} stop={selected} />}
        </div>
      )}

      <PetBusGuide />
    </section>
  );
}

/** 선택한 정류장: 지나가는 노선 + 실시간 도착 (버튼을 눌렀을 때만 불러서 API 호출을 아껴요) */
function StopDetail({ stop }) {
  const routes = useAsync(() => busApi.routes(stop.stopId), [stop.stopId], { initial: [] });
  const [arr, setArr] = useState({ loading: false, data: null, error: null });

  const loadArrivals = async () => {
    setArr({ loading: true, data: arr.data, error: null });
    try {
      setArr({ loading: false, data: await busApi.arrivals(stop.stopId), error: null });
    } catch (e) {
      setArr({ loading: false, data: null, error: e });
    }
  };

  return (
    <div className="stop-detail">
      <p className="stop-detail__label">지나가는 노선</p>
      {routes.data?.length ? (
        <p className="stop-detail__routes">
          {routes.data.map((r) => (
            <span key={r.routeId} className="route-chip en">
              {r.routeNo}
            </span>
          ))}
        </p>
      ) : (
        <p className="muted stop-detail__empty">{routes.loading ? '노선을 불러오는 중…' : '노선 정보가 아직 없어요. 실시간 도착으로 확인해 보세요.'}</p>
      )}

      <div className="stop-detail__arrivals">
        <Button variant="outline" size="sm" loading={arr.loading} onClick={loadArrivals}>
          {arr.data ? '도착 정보 새로고침' : '실시간 도착 보기'}
        </Button>
        {arr.error && <p className="field__error">{arr.error.message}</p>}
        {arr.data && arr.data.status !== 'OK' && <p className="muted">{STATUS_TEXT[arr.data.status] ?? arr.data.message}</p>}
        {arr.data?.status === 'OK' &&
          (arr.data.arrivals.length === 0 ? (
            <p className="muted">곧 도착하는 버스가 없어요.</p>
          ) : (
            <ul className="arrival-list">
              {arr.data.arrivals.slice(0, 6).map((a, i) => (
                <li key={`${a.routeId}-${i}`}>
                  <b className="en">{a.routeNo}</b>
                  <span>{a.minutes <= 1 ? '곧 도착' : `${a.minutes}분`}</span>
                  <span className="muted">{a.remainingStops != null && `${a.remainingStops}정류장 전`}</span>
                  {a.lowFloor && <span className="arrival-list__low">저상</span>}
                </li>
              ))}
            </ul>
          ))}
        {arr.data?.status === 'OK' && <p className="arrival-list__src">자료: 국토교통부 버스도착정보 · 실제 도착은 교통 상황에 따라 달라요</p>}
      </div>
    </div>
  );
}
