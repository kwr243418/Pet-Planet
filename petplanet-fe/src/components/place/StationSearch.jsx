import { useEffect, useId, useRef, useState } from 'react';
import { stationApi } from '../../api/index.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { LineBadge, Spinner } from '../common/ui.jsx';

const RECENT_KEY = 'pp-recent-stations';
const readRecent = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) ?? [];
  } catch {
    return [];
  }
};

/**
 * 지하철역 검색 자동완성 (Day 4)
 * - 입력 250ms 디바운스 후 /stations?keyword= 호출
 * - ↑/↓/Enter/Esc 키보드 탐색, 최근 검색 역 표시
 */
export default function StationSearch({ onSelect, autoFocus, placeholder = '어느 역 근처로 갈까요? (예: 강남)' }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState(readRecent);
  const keyword = useDebounce(text.trim(), 250);
  const listId = useId();
  const boxRef = useRef(null);

  useEffect(() => {
    if (!keyword) {
      setItems([]);
      setError(null);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    stationApi
      .search(keyword)
      .then((res) => alive && (setItems(res), setError(null), setActive(res.length ? 0 : -1)))
      .catch((e) => alive && (setItems([]), setError(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [keyword]);

  useEffect(() => {
    const close = (e) => !boxRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = (st) => {
    const next = [st, ...recent.filter((r) => r.stationName !== st.stationName)].slice(0, 5);
    setRecent(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    setText('');
    setOpen(false);
    onSelect(st);
  };

  const list = keyword ? items : recent;

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(list.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && list[active]) {
      e.preventDefault();
      choose(list[active]);
    } else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="st-search" ref={boxRef}>
      <div className="st-search__box">
        <span className="st-search__icon" aria-hidden>
          🚇
        </span>
        <input
          className="st-search__input"
          value={text}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="지하철역 검색"
        />
        {loading ? <Spinner size={18} /> : text && <button className="icon-btn icon-btn--sm" onClick={() => setText('')} aria-label="지우기">✕</button>}
      </div>

      {open && (keyword || recent.length > 0) && (
        <div className="st-search__pop" id={listId} role="listbox">
          {!keyword && <p className="st-search__label">최근 검색한 역</p>}
          {error && <p className="st-search__empty">🥺 {error.message}</p>}
          {keyword && !loading && !error && items.length === 0 && (
            <p className="st-search__empty">‘{keyword}’ 역을 찾지 못했어요. 역 이름을 다시 확인해 주세요.</p>
          )}
          {list.map((st, i) => (
            <button
              key={st.stationName}
              role="option"
              aria-selected={i === active}
              className={`st-search__item ${i === active ? 'is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(st)}
            >
              <span className="st-search__lines">
                {st.lines.map((l) => (
                  <LineBadge key={l} code={l} small />
                ))}
              </span>
              <span className="st-search__name">{highlight(st.stationName, keyword)}역</span>
              {!keyword && <span className="st-search__recent">↺</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function highlight(name, kw) {
  const k = kw?.replace(/역$/, '');
  if (!k || !name.includes(k)) return name;
  const i = name.indexOf(k);
  return (
    <>
      {name.slice(0, i)}
      <mark>{k}</mark>
      {name.slice(i + k.length)}
    </>
  );
}
