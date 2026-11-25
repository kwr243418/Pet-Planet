import { OptionGroup } from '../common/ui.jsx';
import { NEAR_STOP_M } from '../../utils/transit.js';

export const DEFAULT_FILTERS = { categoryIds: [], sizes: [], indoor: 'ALL', radiusKm: 3, nearStop: false };

/** 실내·실외 선택 → API indoor 값 (실내 = 실내만 + 실내·외 모두 가능한 곳) */
export const INDOOR_QUERY = { ALL: undefined, INDOOR: ['INDOOR', 'BOTH'], OUTDOOR: ['OUTDOOR', 'BOTH'] };

/**
 * S02 필터: 카테고리(여러 개) · 동반 가능 크기 · 실내·실외 · 출발점에서 거리 · 버스 정류장 근처만 · 초기화
 * placeFilters=false 면 거리 · 정류장 필터만 (동물병원 · 펫호텔 탭)
 * radiusOptions 가 없으면(지역별 탐색) 거리 필터를 숨겨요
 */
export default function FilterPanel({ categories = [], value, onChange, radiusOptions, radiusLabel = '출발점에서 거리', placeFilters = true }) {
  const set = (k) => (v) => onChange({ ...value, [k]: v });
  return (
    <div className={`filter-panel card ${placeFilters ? '' : 'filter-panel--radius'}`}>
      {placeFilters && (
        <>
          <div className="filter-panel__group">
            <p className="filter-panel__label">카테고리</p>
            <OptionGroup multiple label="카테고리" value={value.categoryIds} onChange={set('categoryIds')} size="sm" options={categories.map((c) => ({ value: c.categoryId, label: c.name }))} />
          </div>
          <div className="filter-panel__group">
            <p className="filter-panel__label">동반 가능 크기</p>
            <OptionGroup
              multiple
              label="동반 가능 크기"
              value={value.sizes}
              onChange={set('sizes')}
              options={[
                { value: 'SMALL', label: '소형' },
                { value: 'MEDIUM', label: '중형' },
                { value: 'LARGE', label: '대형' },
              ]}
            />
          </div>
          <div className="filter-panel__group">
            <p className="filter-panel__label">실내 · 실외</p>
            <OptionGroup
              label="실내 실외"
              value={value.indoor}
              onChange={set('indoor')}
              options={[
                { value: 'ALL', label: '전체' },
                { value: 'INDOOR', label: '실내' },
                { value: 'OUTDOOR', label: '실외' },
              ]}
            />
          </div>
        </>
      )}
      {radiusOptions && (
        <div className="filter-panel__group">
          <p className="filter-panel__label">{radiusLabel}</p>
          <OptionGroup label={radiusLabel} value={value.radiusKm} onChange={set('radiusKm')} options={radiusOptions.map((r) => ({ value: r, label: `${r}km` }))} />
        </div>
      )}
      <div className="filter-panel__group">
        <p className="filter-panel__label">대중교통</p>
        <OptionGroup
          label="대중교통"
          value={value.nearStop ? 'near' : 'all'}
          onChange={(v) => onChange({ ...value, nearStop: v === 'near' })}
          options={[
            { value: 'all', label: '전체' },
            { value: 'near', label: `정류장 ${NEAR_STOP_M}m 안` },
          ]}
        />
      </div>
      <button type="button" className="text-link filter-panel__reset" onClick={() => onChange({ ...DEFAULT_FILTERS, radiusKm: value.radiusKm })}>
        초기화
      </button>
    </div>
  );
}
