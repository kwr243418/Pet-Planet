import { Link } from 'react-router-dom';
import { formatKm } from '../../utils/format.js';
import { formatMinutes, kakaoDirectionsUrl, TRAVEL_MODES, travelMinutes } from '../../utils/origin.js';
import TransitBadge from '../transit/TransitBadge.jsx';

const WALK = TRAVEL_MODES.find((m) => m.key === 'walk');
const CAR = TRAVEL_MODES.find((m) => m.key === 'car');

/** "1.2km · 도보 17분 · 자동차 4분" */
function TravelLine({ km }) {
  if (km == null) return null;
  return (
    <p className="facility-card__travel">
      {formatKm(km)} · 도보 {formatMinutes(travelMinutes(km, WALK))} · 자동차 {formatMinutes(travelMinutes(km, CAR))}
    </p>
  );
}

/** 주변 동물병원 카드: 제휴 병원은 예약, 나머지는 병원 정보 · 길찾기 */
export function HospitalCard({ hospital: h, index, origin }) {
  return (
    <article className="facility-card">
      <span className="facility-card__num en">{index}</span>
      <div className="facility-card__body">
        <p className="facility-card__kind">
          동물병원{h.partner && <span className="facility-card__badge">예약 가능</span>}
        </p>
        <h3 className="facility-card__name">{h.name}</h3>
        <p className="facility-card__addr">{h.address}</p>
        {h.operatingHours && <p className="facility-card__hours">{h.operatingHours}</p>}
        <TravelLine km={h.distanceKm} />
        <TransitBadge access={h.busAccess} compact />
      </div>
      <div className="facility-card__actions">
        <Link to={`/hospitals/${h.hospitalId}`} className={`btn btn--sm ${h.partner ? 'btn--primary' : 'btn--line'}`}>
          {h.partner ? '진료 예약' : '병원 정보'}
        </Link>
        <a className="btn btn--line btn--sm" href={kakaoDirectionsUrl(origin, { name: h.name, lat: h.lat, lng: h.lng })} target="_blank" rel="noreferrer">
          길찾기
        </a>
      </div>
    </article>
  );
}

/** 주변 펫호텔 카드: 객실이 등록된 곳만 예약, 나머지는 전화 · 길찾기 */
export function HotelCard({ hotel: h, index, origin }) {
  const bookable = (h.roomCount ?? 0) > 0;
  return (
    <article className="facility-card">
      <span className="facility-card__num en">{index}</span>
      <div className="facility-card__body">
        <p className="facility-card__kind">
          펫호텔 · 위탁{bookable && <span className="facility-card__badge">예약 가능</span>}
        </p>
        <h3 className="facility-card__name">{h.name}</h3>
        <p className="facility-card__addr">{h.address}</p>
        {bookable && h.minPrice != null && <p className="facility-card__hours">1박 {h.minPrice.toLocaleString('ko-KR')}원부터</p>}
        <TravelLine km={h.distanceKm} />
        <TransitBadge access={h.busAccess} compact />
      </div>
      <div className="facility-card__actions">
        {bookable ? (
          <Link to={`/reservations/hotel?hotelId=${h.hotelId}`} className="btn btn--primary btn--sm">
            객실 보기
          </Link>
        ) : (
          h.phone && (
            <a href={`tel:${h.phone}`} className="btn btn--line btn--sm">
              전화 문의
            </a>
          )
        )}
        <a className="btn btn--line btn--sm" href={kakaoDirectionsUrl(origin, { name: h.name, lat: h.lat, lng: h.lng })} target="_blank" rel="noreferrer">
          길찾기
        </a>
      </div>
    </article>
  );
}
