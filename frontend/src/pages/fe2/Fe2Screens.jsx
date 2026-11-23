// ⚙️ FE2 작업 영역 — 예약선(R) · 쇼핑선(S) 화면 뼈대
// 공통 레이아웃(헤더·상단·NOW STATION·푸터)은 이미 연결돼 있어요.
// 각 <Blueprint> 블록을 실제 컴포넌트로 바꿔 끼우면 됩니다. 필수 요소는 팀장님 "화면별 필수 요소 정리" 기준.
// API 함수: src/api/index.js 의 hospitalApi · hotelApi · shopApi · cartApi · orderApi (명세: docs/05_API_RESERVATION_COMMERCE.md (레포 루트))
import { Link, useLocation, useParams } from 'react-router-dom';
import { NowStation, PageHero } from '../../components/layout/Site.jsx';
import { StationBuildings, TinyDog } from '../../components/illust/index.jsx';
import { OptionGroup } from '../../components/common/ui.jsx';
import { useNavigate } from 'react-router-dom';

/** 아직 구현되지 않은 영역 표시 (점선 카드 + 필수 요소 목록) */
function Blueprint({ title, items, data, wide }) {
  return (
    <section className={`blueprint ${wide ? 'blueprint--wide' : ''}`}>
      <p className="blueprint__tag en">TODO · FE2</p>
      <h3 className="blueprint__title">{title}</h3>
      <ul className="blueprint__list">
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
      {data && <p className="blueprint__data">연결 데이터 · {data}</p>}
    </section>
  );
}

/** [동물병원 진료] / [펫 호텔] 예약 종류 탭 */
function ReserveTabs() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <OptionGroup
      size="lg"
      label="예약 종류"
      value={pathname.startsWith('/reservations/hotel') ? 'hotel' : 'hospital'}
      onChange={(v) => navigate(`/reservations/${v}`)}
      options={[
        { value: 'hospital', label: '동물병원 진료' },
        { value: 'hotel', label: '펫 호텔' },
      ]}
    />
  );
}

/** S04 동물병원 진료 예약 */

export { default as HospitalReservePage } from './HospitalReservePage.jsx';

/** S04-0 동물병원 상세 · 리뷰 */

export { default as HospitalDetailPage } from './HospitalDetailPage.jsx';

/** S05 펫 호텔 객실 예약 */

export { default as HotelReservePage } from './HotelReservePage.jsx';

/** S06 펫 스토어 */
export { default as StorePage } from './StorePage.jsx';

/** S07 장바구니 · 주문서 */

export { default as CartOrderPage } from './CartOrderPage.jsx';
