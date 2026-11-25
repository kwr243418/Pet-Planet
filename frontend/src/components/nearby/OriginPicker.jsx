import { useState } from 'react';
import { Button } from '../common/ui.jsx';
import { locateMe } from '../../utils/origin.js';

/** 내 근처 탐색의 출발점: 현재 위치 찾기 */
export default function OriginPicker({ origin, onOriginChange }) {
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
      <p className="origin-picker__q">어디서 출발할까요?</p>
      <div className="origin-picker__me">
        <Button variant="primary" size="md" loading={locating} onClick={locate}>
          현재 위치 찾기
        </Button>
        <p className="origin-picker__now" aria-live="polite">
          {origin ? (
            <>
              출발점 <b>{origin.label}</b>
            </>
          ) : (
            '현재 위치를 찾아 주세요'
          )}
        </p>
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
      </div>
      <p className="origin-picker__privacy">위치는 주변 검색에만 쓰고 서버에 저장하지 않아요. 마지막 출발점은 이 브라우저에만 기억해요.</p>
    </section>
  );
}
