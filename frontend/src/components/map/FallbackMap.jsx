import { useEffect, useMemo, useRef, useState } from 'react';

const KM_PER_DEG = 111.32;

/** 컨테이너 실제 크기를 재서 viewBox 를 맞춤 (가로로 긴 지도에서도 왜곡·과확대 없음) */
function useBoxSize(height) {
  const ref = useRef(null);
  const [w, setW] = useState(400);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w, height];
}

/**
 * 카카오맵 키가 없거나 로드 실패 시 쓰는 미리보기 지도 (목업 스타일 SVG)
 * markers: [{ id, lat, lng, kind: 'place'|'station', label, num }]
 */
export default function FallbackMap({ center, markers, radiusKm, selectedId, onMarkerClick, height, label, reason }) {
  const [boxRef, W, H] = useBoxSize(height);
  const proj = useMemo(() => {
    const pts = markers.length ? markers : center ? [center] : [{ lat: 37.5665, lng: 126.978 }];
    const c = center ?? {
      lat: (Math.min(...pts.map((p) => p.lat)) + Math.max(...pts.map((p) => p.lat))) / 2,
      lng: (Math.min(...pts.map((p) => p.lng)) + Math.max(...pts.map((p) => p.lng))) / 2,
    };
    const cos = Math.cos((c.lat * Math.PI) / 180);
    const toKm = (p) => ({ x: (p.lng - c.lng) * KM_PER_DEG * cos, y: (p.lat - c.lat) * KM_PER_DEG });
    // 화면 반쪽 크기(px)에 들어갈 km 범위 → px/km 배율
    let scale = Infinity;
    const fit = (km, px, pad = 44) => km > 0 && (scale = Math.min(scale, (px - pad) / km));
    if (radiusKm) fit(radiusKm, Math.min(W, H) / 2);
    for (const p of pts) {
      const k = toKm(p);
      fit(Math.abs(k.x), W / 2);
      fit(Math.abs(k.y), H / 2, 72); // 위쪽에 선택 핀 이름표 자리
    }
    if (!Number.isFinite(scale)) scale = Math.min(W, H) / 2 / 0.5;
    scale = Math.min(scale, 900); // 마커가 1개뿐일 때 과도한 확대 방지
    return { scale, xy: (p) => ({ x: W / 2 + toKm(p).x * scale, y: H / 2 - toKm(p).y * scale }) };
  }, [center, markers, radiusKm, W, H]);

  const places = markers.filter((m) => m.kind !== 'station');
  const stations = markers.filter((m) => m.kind === 'station');
  const sel = (m) => String(m.id) === String(selectedId);
  const ordered = [...places].sort((a, b) => sel(a) - sel(b));
  const c = center ? proj.xy(center) : stations[0] ? proj.xy(stations[0]) : { x: W / 2, y: H / 2 };

  return (
    <div className="map-box map-box--fallback" style={{ height }} ref={boxRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label="장소 위치 지도">
        <rect width={W} height={H} fill="#c4ebc3" />
        {/* 블록 & 도로 */}
        {[0.17, 0.38, 0.62, 0.83].map((f) => (
          <rect key={`v${f}`} x={W * f} y="0" width="16" height={H} fill="#e2f3e0" />
        ))}
        {[0.15, 0.7].map((f) => (
          <rect key={`h${f}`} x="0" y={H * f} width={W} height="16" fill="#e2f3e0" />
        ))}
        {/* 지하철 노선 (역을 지나는 굵은 선) */}
        <rect x="0" y={c.y - 7} width={W} height="14" rx="7" fill="#264536" />
        {radiusKm && <circle cx={c.x} cy={c.y} r={radiusKm * proj.scale} fill="#ffffff" fillOpacity=".18" stroke="#264536" strokeWidth="2" strokeDasharray="5 6" />}

        {stations.map((s) => {
          const { x, y } = proj.xy(s);
          const w = s.label.length * 13 + 28;
          return (
            <g key={`s-${s.id}`} pointerEvents="none">
              <circle cx={x} cy={y} r="15" fill="#c4ebc3" stroke="#264536" strokeWidth="6" />
              <rect x={x - w / 2} y={y + 22} width={w} height="26" rx="13" fill="#fff" />
              <text x={x} y={y + 39.5} fontSize="13" fontWeight="800" fill="#264536" textAnchor="middle">
                {s.label}
              </text>
            </g>
          );
        })}

        {ordered.map((m) => {
          const { x, y } = proj.xy(m);
          const on = sel(m);
          return (
            <g
              key={`p-${m.id}`}
              className="fmap-pin"
              transform={`translate(${x} ${y})`}
              onClick={() => onMarkerClick?.(m.id)}
              role="button"
              tabIndex={0}
              aria-label={`${m.num ?? ''} ${m.label}`}
              onKeyDown={(e) => e.key === 'Enter' && onMarkerClick?.(m.id)}
            >
              <circle r={on ? 18 : 14} fill={on ? '#264536' : '#fff'} stroke="#264536" strokeWidth="3" />
              <text y={on ? 5.5 : 5} fontSize={on ? 15 : 13} fontWeight="800" fill={on ? '#fff' : '#264536'} textAnchor="middle" fontFamily="Jost, sans-serif">
                {m.num ?? '•'}
              </text>
              {on && (
                <g transform="translate(0 -32)">
                  <rect x={-(m.label.length * 6.6 + 14)} y="-14" width={m.label.length * 13.2 + 28} height="26" rx="13" fill="#264536" />
                  <text y="4" fontSize="12.5" fontWeight="700" fill="#fff" textAnchor="middle">
                    {m.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      {label && <span className="map-box__label">{label}</span>}
      <span className="map-box__note" title={reason}>
        미리보기 지도 · 카카오맵 키 설정 시 실제 지도
      </span>
    </div>
  );
}
