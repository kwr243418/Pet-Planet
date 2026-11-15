import { useMemo } from 'react';

const W = 400;
const H = 280;
const KM_PER_DEG = 111.32;

/**
 * 카카오맵 키가 없거나 로드 실패 시 쓰는 미리보기 지도 (SVG)
 * - 기준점(center)으로부터 km 단위 평면 좌표로 투영
 * - 같은 props 인터페이스를 써서 KakaoMap과 교체 가능
 */
export default function FallbackMap({ center, markers, radiusKm, selectedId, onMarkerClick, height, reason }) {
  const proj = useMemo(() => {
    const pts = markers.length ? markers : center ? [center] : [{ lat: 37.5665, lng: 126.978 }];
    const c = center ?? {
      lat: (Math.min(...pts.map((p) => p.lat)) + Math.max(...pts.map((p) => p.lat))) / 2,
      lng: (Math.min(...pts.map((p) => p.lng)) + Math.max(...pts.map((p) => p.lng))) / 2,
    };
    const cos = Math.cos((c.lat * Math.PI) / 180);
    const toKm = (p) => ({ x: (p.lng - c.lng) * KM_PER_DEG * cos, y: (p.lat - c.lat) * KM_PER_DEG });
    let half = radiusKm ? radiusKm * 1.38 : 0.6;
    for (const p of pts) {
      const k = toKm(p);
      half = Math.max(half, Math.abs(k.x) * (H / W) * 1.2, Math.abs(k.y) * 1.3);
    }
    const scale = H / 2 / half; // px per km
    return {
      c,
      scale,
      xy: (p) => {
        const k = toKm(p);
        return { x: W / 2 + k.x * scale, y: H / 2 - k.y * scale };
      },
    };
  }, [center, markers, radiusKm]);

  const places = markers.filter((m) => m.kind !== 'station');
  const stations = markers.filter((m) => m.kind === 'station');
  // 선택된 핀을 가장 위에 그리기
  const ordered = [...places].sort((a, b) => (String(a.id) === String(selectedId)) - (String(b.id) === String(selectedId)));
  const centerXY = center ? proj.xy(center) : null;

  return (
    <div className="map-box map-box--fallback" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" role="img" aria-label="장소 위치 미리보기 지도">
        <defs>
          <pattern id="pp-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0V28" fill="none" stroke="#ffe3eb" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="#fff7fa" />
        <rect width={W} height={H} fill="url(#pp-grid)" />
        {/* 장식용 길·공원 */}
        <path d={`M-10 ${H * 0.62} C ${W * 0.3} ${H * 0.5}, ${W * 0.6} ${H * 0.78}, ${W + 10} ${H * 0.6}`} stroke="#ffd6e2" strokeWidth="14" fill="none" strokeLinecap="round" />
        <path d={`M${W * 0.36} -10 C ${W * 0.42} ${H * 0.4}, ${W * 0.3} ${H * 0.7}, ${W * 0.4} ${H + 10}`} stroke="#ffe3eb" strokeWidth="10" fill="none" />
        <ellipse cx={W * 0.82} cy={H * 0.22} rx="46" ry="26" fill="#d9f5e7" />
        <ellipse cx={W * 0.12} cy={H * 0.85} rx="40" ry="22" fill="#d6ecff" opacity=".8" />

        {centerXY && radiusKm && (
          <circle cx={centerXY.x} cy={centerXY.y} r={radiusKm * proj.scale} fill="#ff9bb8" fillOpacity=".14" stroke="#f0306e" strokeOpacity=".55" strokeWidth="2" strokeDasharray="6 6" />
        )}

        {ordered.map((m) => {
          const { x, y } = proj.xy(m);
          const sel = String(m.id) === String(selectedId);
          return (
            <g
              key={`p-${m.id}`}
              transform={`translate(${x} ${y}) scale(${sel ? 1.25 : 1})`}
              className="fmap-pin"
              onClick={() => onMarkerClick?.(m.id)}
              role="button"
              tabIndex={0}
              aria-label={m.label}
              onKeyDown={(e) => e.key === 'Enter' && onMarkerClick?.(m.id)}
            >
              <path d="M0 0 C -4 -8 -15 -14 -15 -25 A15 15 0 1 1 15 -25 C 15 -14 4 -8 0 0Z" fill={sel ? '#f0306e' : '#fff'} stroke="#f0306e" strokeWidth="2.5" />
              <text x="0" y="-20" fontSize="15" textAnchor="middle">
                {m.emoji ?? '🐾'}
              </text>
              {sel && (
                <g transform="translate(0 -50)">
                  <rect x={-(m.label.length * 6.4 + 14)} y="-13" width={m.label.length * 12.8 + 28} height="24" rx="12" fill="#2b1b22" />
                  <text y="3.5" fontSize="12" fontWeight="700" fill="#fff" textAnchor="middle">
                    {m.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {stations.map((s) => {
          const { x, y } = proj.xy(s);
          const w = s.label.length * 12 + 28;
          return (
            <g key={`s-${s.id}`} pointerEvents="none" transform={`translate(${x} ${y})`}>
              <rect x={-w / 2} y="-13" width={w} height="26" rx="13" fill="#fff" stroke={s.color ?? '#f0306e'} strokeWidth="2.5" />
              <circle cx={-w / 2 + 13} cy="0" r="5" fill={s.color ?? '#f0306e'} />
              <text x={-w / 2 + 23} y="4.5" fontSize="12.5" fontWeight="800" fill="#2b1b22">
                {s.label}
              </text>
            </g>
          );
        })}

      </svg>
      <span className="map-box__note" title={reason}>
        미리보기 지도 · 카카오맵 키를 넣으면 실제 지도로 바뀌어요
      </span>
    </div>
  );
}
