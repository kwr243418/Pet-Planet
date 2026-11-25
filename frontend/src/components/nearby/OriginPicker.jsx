import { useState } from 'react';
import { Button, OptionGroup } from '../common/ui.jsx';
import { PRESET_ORIGINS, locateMe } from '../../utils/origin.js';

/** 주변 탐색 출발점: [지하철역 | 내 위치] + 현재 위치 찾기 · 시연 위치 */
export default function OriginPicker({ mode, onModeChange, origin, onOriginChange }) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  const locate = async () => {
    setLocating(true);
    setError('');
    try {
      onOriginChange(await locateMe());
    } catch (e) {
      setError(e.message);
    } finally {
      setLocating(false);
    }
  };

  return (
    <section className="origin-picker" aria-label="출발점 선택">
      <div className="origin-picker__row">
        <p className="origin-picker__q">어디서 출발할까요?</p>
        <OptionGroup
          size="lg"
          label="출발점"
          value={mode}
          onChange={onModeChange}
          options={[
            { value: 'station', label: '지하철역' },
            { value: 'me', label: '내 위치' },
          ]}
        />
      </div>
      {mode === 'me' && (
        <div className="origin-picker__me">
          <Button variant="primary" size="md" loading={locating} onClick={locate}>
            현재 위치 찾기
          </Button>
          {PRESET_ORIGINS.map((p) => (
            <Button key={p.key} variant="outline" size="md" aria-pressed={origin?.label === p.label} onClick={() => onOriginChange(p)}>
              {p.label} 기준
            </Button>
          ))}
          <p className="origin-picker__now" aria-live="polite">
            {origin ? (
              <>
                출발점 <b>{origin.label}</b>
              </>
            ) : (
              '현재 위치를 찾거나 시연 위치를 골라 주세요'
            )}
          </p>
          {error && (
            <p className="field__error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
