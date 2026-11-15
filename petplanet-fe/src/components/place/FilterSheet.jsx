import { useEffect, useState } from 'react';
import { LINES } from '../../utils/subway.js';
import { Button, Chip, LineBadge, Sheet } from '../common/ui.jsx';
import { categoryMeta } from '../../utils/categories.js';

export const EMPTY_FILTERS = { categoryIds: [], lines: [], sizes: [], indoor: [] };

const SIZES = [
  { value: 'SMALL', label: '소형견', desc: '10kg 미만' },
  { value: 'MEDIUM', label: '중형견', desc: '10~25kg' },
  { value: 'LARGE', label: '대형견', desc: '25kg 초과' },
];
const INDOORS = [
  { value: 'BOTH', label: '실내·외 모두' },
  { value: 'INDOOR', label: '실내 동반' },
  { value: 'OUTDOOR', label: '실외만' },
];

export const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function countFilters(f) {
  return f.categoryIds.length + f.lines.length + f.sizes.length + f.indoor.length;
}

/** 다중 필터 바텀시트 (Day 9): 카테고리 · 지하철 호선 · 우리 아이 크기 · 실내외 */
export default function FilterSheet({ open, onClose, value, onApply, categories, petSizeHint }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const set = (key, v) => setDraft((d) => ({ ...d, [key]: toggleIn(d[key], v) }));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="필터"
      footer={
        <>
          <Button variant="ghost" size="lg" onClick={() => setDraft(EMPTY_FILTERS)} style={{ flex: '0 0 110px' }}>
            초기화
          </Button>
          <Button
            block
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            {countFilters(draft) ? `${countFilters(draft)}개 조건으로 보기` : '전체 보기'}
          </Button>
        </>
      }
    >
      <fieldset className="filter-group">
        <legend>카테고리</legend>
        <div className="chip-wrap">
          {categories.map((c) => (
            <Chip key={c.categoryId} active={draft.categoryIds.includes(c.categoryId)} onClick={() => set('categoryIds', c.categoryId)}>
              {categoryMeta(c.categoryId).emoji} {c.name}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>지하철 호선</legend>
        <p className="filter-group__desc">선택한 호선 역에서 1km 안에 있는 장소만 보여요</p>
        <div className="chip-wrap">
          {LINES.map((l) => (
            <Chip key={l.code} active={draft.lines.includes(l.code)} color={l.color} onClick={() => set('lines', l.code)}>
              {!draft.lines.includes(l.code) && <LineBadge code={l.code} small />}
              {l.name}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>우리 아이 크기</legend>
        {petSizeHint && <p className="filter-group__desc">💡 {petSizeHint}</p>}
        <div className="size-cards">
          {SIZES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={draft.sizes.includes(s.value)}
              className={`size-card ${draft.sizes.includes(s.value) ? 'is-on' : ''}`}
              onClick={() => set('sizes', s.value)}
            >
              <span className={`size-card__dog size-card__dog--${s.value.toLowerCase()}`}>🐶</span>
              <b>{s.label}</b>
              <small>{s.desc}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>동반 공간</legend>
        <div className="chip-wrap">
          {INDOORS.map((o) => (
            <Chip key={o.value} active={draft.indoor.includes(o.value)} onClick={() => set('indoor', o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>
      </fieldset>
    </Sheet>
  );
}
