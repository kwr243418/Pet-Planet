import { stopLine } from '../../utils/transit.js';

/**
 * 대중교통 접근성 한 줄: [A] 목포역 앞 정류장 도보 2분
 * busAccess 가 없으면(정류장 계산 전) 아무것도 안 그려요.
 */
export default function TransitBadge({ access, compact }) {
  if (!access) return null;
  return (
    <p className={`transit-badge transit-badge--${access.grade} ${compact ? 'transit-badge--compact' : ''}`} title={access.gradeLabel}>
      <span className="transit-badge__grade en" aria-label={`대중교통 접근성 ${access.grade}등급`}>
        {access.grade}
      </span>
      <span className="transit-badge__text">
        {stopLine(access)}
        {!compact && access.routeCount > 0 && <span className="transit-badge__routes"> · 노선 {access.routeCount}개</span>}
      </span>
    </p>
  );
}

/** 등급 설명 (A~D) — 필터 옆 · 상세 화면 */
export function GradeLegend() {
  return (
    <ul className="grade-legend" aria-label="대중교통 접근성 등급">
      <li>
        <b className="en">A</b> 정류장 200m 안 · 노선 많음
      </li>
      <li>
        <b className="en">B</b> 정류장 400m 안
      </li>
      <li>
        <b className="en">C</b> 정류장 800m 안
      </li>
      <li>
        <b className="en">D</b> 800m 넘게 멀어요
      </li>
    </ul>
  );
}
