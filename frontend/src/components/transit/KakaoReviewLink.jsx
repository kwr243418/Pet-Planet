import { kakaoPlaceSearchUrl } from '../../utils/transit.js';

/**
 * 카카오맵 후기 보기 — 카카오는 리뷰 API 를 주지 않아서(제휴 · 비영리도 불가) 카카오맵 검색 결과로 링크만 해요.
 * 후기 내용을 가져오거나 저장하지 않고, 새 탭으로 열어 카카오맵 화면에서 보게 해요. (docs/09 §법적 검토)
 */
export default function KakaoReviewLink({ name, sigungu, className = 'btn btn--line btn--sm' }) {
  return (
    <a className={className} href={kakaoPlaceSearchUrl(name, sigungu)} target="_blank" rel="noopener noreferrer" title="외부 사이트(카카오맵)로 이동해요">
      카카오맵에서 후기 보기 ↗
    </a>
  );
}
