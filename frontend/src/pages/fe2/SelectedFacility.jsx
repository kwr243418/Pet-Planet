import { Link } from 'react-router-dom';
import { Tag } from '../../components/common/ui.jsx';
import TransitBadge from '../../components/transit/TransitBadge.jsx';
import FacilityHeart from '../../components/facility/FacilityHeart.jsx';
import { regionLabel } from '../../utils/region.js';
import { reserveExploreUrl } from '../../utils/reserve.js';

/**
 * 예약 화면 첫 칸: 주변 탐색 · 상세 · 마이페이지에서 고르고 들어온 병원/호텔 요약.
 * 예약 화면에서는 병원을 다시 고르지 않고, 바꾸려면 "다른 병원 찾기"로 주변 탐색(예약 가능만)에 돌아가요.
 */
export default function SelectedFacility({ kind, facility, meta, detailTo }) {
  const isHotel = kind === 'HOTEL';
  const region = facility.sido ? regionLabel({ sido: facility.sido, sigungu: facility.sigungu }) : null;
  return (
    <div className="fe2-selected">
      <div className="fe2-selected__main">
        <div className="fe2-selected__tags">
          <Tag tone="white">{isHotel ? '예약 가능 호텔' : '제휴 병원'}</Tag>
          {region && <Tag tone="white">{region}</Tag>}
        </div>
        <p className="fe2-selected__name">{facility.name}</p>
        <TransitBadge access={facility.busAccess} />
        {meta && <p className="fe2-selected__meta">{meta}</p>}
      </div>
      <div className="fe2-selected__side">
        <FacilityHeart kind={kind} id={isHotel ? facility.hotelId : facility.hospitalId} />
        <Link to={reserveExploreUrl(isHotel ? 'hotel' : 'hospital')} className="btn btn--outline btn--sm">
          다른 {isHotel ? '호텔' : '병원'} 찾기 →
        </Link>
        {detailTo && (
          <Link to={detailTo} className="text-link fe2-selected__link">
            병원 정보 · 리뷰 보기
          </Link>
        )}
      </div>
    </div>
  );
}
