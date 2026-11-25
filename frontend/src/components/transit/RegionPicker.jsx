import { regionApi } from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';

/**
 * 지역별 탐색: 시/도 → 시/군/구 (데이터가 있는 지역만, 개수 표시)
 * type: place | hospital | hotel · value: { sido, sigungu } · onChange({ sido, sigungu })
 */
export default function RegionPicker({ type = 'place', value, onChange }) {
  const regions = useAsync(() => regionApi.list(type), [type], { initial: [] });
  const list = regions.data ?? [];
  const current = list.find((r) => r.sido === value?.sido);

  return (
    <section className="region-picker" aria-label="지역 선택">
      <p className="origin-picker__q">어느 지역을 볼까요?</p>
      <div className="region-picker__row">
        <label className="select region-picker__select">
          <span className="region-picker__label">시 · 도</span>
          <select value={value?.sido ?? ''} onChange={(e) => onChange({ sido: e.target.value || null, sigungu: null })} disabled={regions.loading && !list.length}>
            <option value="">선택</option>
            {list.map((r) => (
              <option key={r.sido} value={r.sido}>
                {r.sido} ({r.count.toLocaleString('ko-KR')})
              </option>
            ))}
            {value?.sido && !current && !regions.loading && <option value={value.sido}>{value.sido} (0)</option>}
          </select>
        </label>
        <label className="select region-picker__select">
          <span className="region-picker__label">시 · 군 · 구</span>
          <select value={value?.sigungu ?? ''} onChange={(e) => onChange({ sido: value?.sido ?? null, sigungu: e.target.value || null })} disabled={!value?.sido}>
            <option value="">{value?.sido ? '전체' : '시 · 도를 먼저 골라 주세요'}</option>
            {(current?.sigungus ?? []).map((g) => (
              <option key={g.name} value={g.name}>
                {g.name} ({g.count.toLocaleString('ko-KR')})
              </option>
            ))}
          </select>
        </label>
      </div>
      {regions.error && (
        <p className="field__error" role="alert">
          지역 목록을 불러오지 못했어요. {regions.error.message}
        </p>
      )}
      {!regions.loading && !regions.error && list.length === 0 && <p className="muted region-picker__empty">아직 지역 정보가 있는 데이터가 없어요. DB 패치(db/patch_bus_transit.sql)를 실행했는지 확인해 주세요.</p>}
    </section>
  );
}
