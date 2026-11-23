import { useEffect, useRef, useState } from 'react';
import { OptionGroup, Skeleton } from '../common/ui.jsx';
import { EXTRA_LINES, MAIN_LINES, lineName, stationBase } from '../../utils/subway.js';

/** 호선 선택: 1–9호선 중 1개 + 전체 노선 보기 */
export function LineSelector({ value, onChange }) {
  const [all, setAll] = useState(EXTRA_LINES.includes(value));
  const lines = all ? [...MAIN_LINES, ...EXTRA_LINES] : MAIN_LINES;
  return (
    <div className="line-select">
      <span className="line-select__label">호선</span>
      <OptionGroup label="호선 선택" value={value} onChange={onChange} options={lines.map((l) => ({ value: l, label: lineName(l) }))} />
      <button type="button" className="text-link" onClick={() => setAll((a) => !a)} aria-expanded={all}>
        {all ? '기본 노선만' : '전체 노선 보기'}
      </button>
    </div>
  );
}

/** 선택한 호선의 역을 노선도 형태로 — 선택된 역만 크게 */
export function LineDiagram({ stations, loading, selectedId, onSelect }) {
  const scroller = useRef(null);

  // 선택한 역이 가운데 오도록 스크롤
  useEffect(() => {
    const el = scroller.current?.querySelector('.is-selected');
    if (el && scroller.current) {
      const box = scroller.current;
      box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
    }
  }, [selectedId, stations]);

  if (loading) return <Skeleton h={128} r={36} />;
  return (
    <div className="line-diagram card" ref={scroller}>
      <ol className="line-diagram__track" role="radiogroup" aria-label="역 선택">
        {stations.map((s) => {
          const on = s.stationId === selectedId;
          return (
            <li key={s.stationId} className={`line-diagram__stop ${on ? 'is-selected' : ''}`}>
              <button type="button" role="radio" aria-checked={on} onClick={() => onSelect(s)}>
                <span className="line-diagram__dot" />
                <span className="line-diagram__name">{stationBase(s.stationName)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
