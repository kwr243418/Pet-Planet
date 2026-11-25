import { OptionGroup } from '../common/ui.jsx';

export const DEFAULT_FILTERS = { categoryIds: [], sizes: [], indoor: 'ALL', radiusKm: 1 };

/** 실내·실외 선택 → API indoor 값 (실내 = 실내만 + 실내·외 모두 가능한 곳) */
export const INDOOR_QUERY = { ALL: undefined, INDOOR: ['INDOOR', 'BOTH'], OUTDOOR: ['OUTDOOR', 'BOTH'] };

/** S02 필터: 카테고리(여러 개) · 동반 가능 크기 · 실내·실외 · 역에서 거리 · 초기화 */
export default function FilterPanel({ categories, value, onChange, radiusOptions = [0.5, 1], radiusLabel = '역에서 거리' }) {
  const set = (k) => (v) => onChange({ ...value, [k]: v });
  return (
    <div className="filter-panel card">
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
      <div className="filter-panel__group">
        <p className="filter-panel__label">{radiusLabel}</p>
        <OptionGroup label={radiusLabel} value={value.radiusKm} onChange={set('radiusKm')} options={radiusOptions.map((r) => ({ value: r, label: `${r}km` }))} />
      </div>
      <button type="button" className="text-link filter-panel__reset" onClick={() => onChange(DEFAULT_FILTERS)}>
        초기화
      </button>
    </div>
  );
}
