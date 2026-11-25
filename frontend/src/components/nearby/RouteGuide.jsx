import { useState } from 'react';
import { formatKm } from '../../utils/format.js';
import { distanceFrom, formatMinutes, kakaoDirectionsUrl, PRESET_ORIGINS, saveOrigin, TRAVEL_MODES, travelMinutes } from '../../utils/origin.js';
import { petBusAdvice } from '../../utils/transit.js';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * 가는 방법: 도보 · 버스 · 자동차 · 택시 중 하나를 고르면 어림 시간을 보여 주고 카카오맵 길찾기로 연결
 * origin: { label, lat, lng } | null  ·  dest: { name, lat, lng }
 */
/** 도보가 이보다 오래 걸리면 시간 대신 "걷기엔 멀어요" (반려동물도 지쳐요) */
const WALK_LIMIT_MIN = 90;

export default function RouteGuide({ origin: initialOrigin, dest }) {
  const [origin, setOrigin] = useState(initialOrigin ?? null);
  const [modeKey, setModeKey] = useState('walk');
  const mode = TRAVEL_MODES.find((m) => m.key === modeKey);
  const km = distanceFrom(origin, dest);
  const { primaryPet } = useAuth();
  const busAdvice = petBusAdvice(primaryPet?.weight);

  const pick = (o) => {
    saveOrigin(o);
    setOrigin(o);
  };

  return (
    <section className="route-guide" aria-label="가는 방법">
      <div className="route-guide__head">
        <p className="eyebrow eyebrow--gold">가는 방법</p>
        <p className="route-guide__from">
          {origin ? (
            <>
              <b>{origin.label}</b>에서 직선거리 {formatKm(km)}
            </>
          ) : (
            '출발점을 고르면 이동 시간을 어림해 드려요'
          )}
        </p>
      </div>
      <div className="route-guide__modes" role="radiogroup" aria-label="이동 수단">
        {TRAVEL_MODES.map((m) => (
          <button key={m.key} type="button" role="radio" aria-checked={m.key === modeKey} className={`route-mode ${m.key === modeKey ? 'is-on' : ''}`} onClick={() => setModeKey(m.key)}>
            <span className="route-mode__label">{m.label}</span>
            <span className="route-mode__time">{!origin ? '—' : m.key === 'walk' && travelMinutes(km, m) > WALK_LIMIT_MIN ? '걷기엔 멀어요' : `약 ${formatMinutes(travelMinutes(km, m))}`}</span>
          </button>
        ))}
      </div>
      {!origin && (
        <div className="route-guide__presets">
          {PRESET_ORIGINS.map((p) => (
            <button key={p.key} type="button" className="btn btn--line btn--sm" onClick={() => pick(p)}>
              {p.label}에서 출발
            </button>
          ))}
        </div>
      )}
      {modeKey === 'bus' && (
        <p className={`route-guide__pet route-guide__pet--${busAdvice.level}`}>
          {primaryPet ? `${primaryPet.name}(${primaryPet.weight}kg): ` : ''}
          {busAdvice.title} — 버스는 이동장에 넣은 반려동물만 탈 수 있어요.
        </p>
      )}
      <a className="btn btn--primary btn--md route-guide__go" href={kakaoDirectionsUrl(origin, dest, mode)} target="_blank" rel="noreferrer">
        카카오맵에서 {mode.label === '택시' ? '자동차(택시)' : mode.label} 길찾기 →
      </a>
      <p className="route-guide__note">시간은 직선거리로 어림한 값이에요. 실제 경로와 버스 배차는 카카오맵에서 확인하세요.</p>
    </section>
  );
}
