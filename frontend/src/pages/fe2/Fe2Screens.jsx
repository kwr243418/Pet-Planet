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
export function HospitalReservePage() {
  return (
    <>
      <PageHero line="R" en="CLINIC" title={'제휴 동물병원\n진료 예약'} desc={'반려동물과 원하는 시간을 고르면 병원으로 바로 신청돼요.\n병원이 승인하면 예약이 확정됩니다.'} art={<StationBuildings />} />
      <NowStation steps={['예약 선택', '병원 선택', '반려동물 · 일시', '신청 완료']} current={2} />
      <div className="container fe2">
        <ReserveTabs />
        <div className="blueprint-grid">
          <Blueprint title="선택한 병원" items={['병원명, 가까운 역 거리, 영업시간', '[★ 별점 · 리뷰 보기] → S04-0 (/hospitals/:id)', '[병원 변경]']} data="hospitals" />
          <Blueprint title="1. 반려동물" items={['내 반려동물 카드(이름·품종·성별·체중) 중 1개 선택', '반려동물 목록: useAuth().pets']} data="pets" />
          <Blueprint title="2. 일시" items={['달력 — 지난 날짜 비활성', '시간 버튼 — 예약 찬 시간은 줄 긋고 비활성']} data="hospital_reservations (같은 병원·같은 일시)" />
          <Blueprint title="예약 확인 (승차권)" items={['병원·반려동물·일시 요약', '예약 상태 노선: 승인대기 → 예약확정 → 이용완료', '취소 안내', '[진료 예약 신청] (주요 버튼)']} data="hospital_reservations.status PENDING → CONFIRMED → COMPLETED / CANCELLED" />
        </div>
      </div>
    </>
  );
}

/** S04-0 동물병원 상세 · 리뷰 */
export function HospitalDetailPage() {
  const { hospitalId } = useParams();
  return (
    <>
      <PageHero line="R" en="CLINIC" compact title={`동물병원 상세 #${hospitalId}`} desc="병원 정보와 방문 리뷰를 먼저 확인하는 화면이에요." art={<TinyDog size={140} />}>
        <p className="page-hero__desc">
          <Link to="/reservations/hospital" className="text-link">
            병원 · 호텔 예약 › 동물병원
          </Link>
        </p>
      </PageHero>
      <NowStation steps={['예약 선택', '병원 상세', '반려동물 · 일시', '신청 완료']} current={1} />
      <div className="container fe2">
        <div className="blueprint-grid">
          <Blueprint title="병원 헤더" items={['병원명, 제휴 병원·가까운 역 칩', '평균 별점(★ 4.8 / 5.0) + 리뷰 수를 크게', '진료시간, 주소, 전화번호']} data="hospitals, reviews 집계(AVG·COUNT)" />
          <Blueprint title="탭" items={['[병원 소개 · 진료 안내] / [방문 리뷰 (개수)]', '처음에는 리뷰 탭이 열림']} />
          <Blueprint
            title="리뷰 탭"
            items={['평균 별점 + 별점 분포(5–1점 막대)', '정렬: 최신순 / 별점 높은순', '리뷰 카드: 닉네임·별점·방문 날짜·반려동물 품종·체중·후기', '[리뷰 더보기]', '재사용: components/place/Reviews.jsx 의 ReviewCard · ReviewModal']}
            data="reviews (target_type = HOSPITAL — DB 추가 필요)"
          />
          <Blueprint title="소개 탭" items={['병원 소개, 진료 과목 칩', '요일별 진료시간·점심시간', '오시는 길(가까운 역·거리), 예약 안내']} data="hospitals (소개·진료과목·점심시간 칼럼 추가 여부 결정 필요)" />
          <Blueprint title="하단 고정 바" items={['스크롤해도 항상 보임', '병원명, 별점·리뷰 수, [진료 예약하기]']} />
          <Blueprint title="예약 모달" items={['반려동물 선택, 날짜 선택, 시간 선택(마감 시간 비활성)', '선택 요약, [취소]·[예약 신청]', '완료 화면: 현재 상태 승인대기, [마이페이지에서 보기]', '재사용: components/common/ui.jsx 의 Modal']} data="hospital_reservations" />
        </div>
      </div>
    </>
  );
}

/** S05 펫 호텔 객실 예약 */
export function HotelReservePage() {
  return (
    <>
      <PageHero line="R" en={'PET\nSTAY'} title={'체중에 맞는 객실만\n골라 보여드려요'} desc={'등록한 반려동물의 체중을 객실의 최대 수용 몸무게와 자동으로 비교하고,\n이미 확정된 예약과 겹치는 날짜는 막아 드려요.'} art={<StationBuildings />} />
      <NowStation steps={['예약 선택', '호텔 선택', '객실 · 체중 검증', '예약 완료']} current={2} />
      <div className="container fe2">
        <ReserveTabs />
        <div className="blueprint-grid">
          <Blueprint title="호텔 정보" items={['호텔명, 주소, 전화번호, 가까운 역 거리']} data="pet_hotels" />
          <Blueprint title="1. 반려동물" items={['반려동물 선택', '체중(kg)을 크게 표시']} data="pets.weight" />
          <Blueprint title="2. 기간" items={['체크인·체크아웃 범위 달력', '‘○박’ 표시']} />
          <Blueprint title="3. 객실 목록" items={['객실명, 1박 가격, 최대 수용 몸무게(크게)', '상태 3종: 입실 가능 / 체중 초과로 입실 불가 / 같은 날짜에 확정 예약 있음']} data="room_types.max_weight, hotel_reservations (기간 중복 검사)" />
          <Blueprint title="예약 확인" wide items={['객실·기간·반려동물', '1박 가격 × 박수 = 합계', '검증 결과: 체중 ≤ 최대 수용 / 중복 예약 없음', '[객실 예약 신청] (주요 버튼)']} data="hotel_reservations" />
        </div>
      </div>
    </>
  );
}

/** S06 펫 스토어 */
export function StorePage() {
  return (
    <>
      <PageHero line="S" en={'PET\nMART'} title={'외출 준비물,\n여기서 한 번에'} desc={'사료 · 간식 · 위생용품 · 외출 용품을 장바구니에 담아 주문하고,\n배송 단계를 노선처럼 확인하세요.'} art={<StationBuildings />} />
      <NowStation steps={['상품 목록', '장바구니', '주문서', '주문 완료']} current={0} />
      <div className="container fe2">
        <OptionGroup size="lg" label="상품 카테고리" value="ALL" onChange={() => {}} options={['전체', '사료', '간식', '위생용품', '용품'].map((c, i) => ({ value: i ? c : 'ALL', label: c }))} />
        <div className="blueprint-grid">
          <Blueprint title="카테고리 · 검색" items={['전체 · 사료 · 간식 · 위생용품 · 용품 (한 번에 1개) — 위 버튼은 모양만 연결됨', '상품 이름 검색창 + [검색]']} data="product_categories" />
          <Blueprint title="상품 카드" items={['상품 이미지(없으면 FOOD·SNACK·CARE·GOODS 영문 배너 — CategoryBanner 참고)', '카테고리, 상품명, 가격', '재고 적을 때 ‘재고 ○개 남음’', '[장바구니 담기]']} data="products (price, stock_quantity)" />
          <Blueprint title="품절 상품" items={['‘품절’ 표시', '담기 버튼 비활성 → [재입고 알림 받기]']} />
          <Blueprint title="장바구니 바 (하단)" items={['담은 상품 수', '‘같은 상품을 다시 담으면 수량이 합쳐져요’ 안내', '[장바구니로 →]']} data="cart_items (user_id + product_id 유일)" />
        </div>
      </div>
    </>
  );
}

/** S07 장바구니 · 주문서 */
export function CartOrderPage() {
  return (
    <>
      <PageHero line="S" en="ORDER" compact title="장바구니 · 주문서" desc="담은 상품을 확인하고 배송 정보를 입력해 가상 결제해요." art={<StationBuildings />} />
      <NowStation steps={['상품 목록', '장바구니', '주문서', '주문 완료']} current={2} />
      <div className="container fe2">
        <div className="blueprint-grid">
          <Blueprint title="장바구니 목록" items={['상품 이미지, 카테고리, 상품명, 단가', '수량 조절(− / +), 상품별 합계', '재고 적을 때 재고 표시', '[쇼핑 계속하기]']} data="cart_items, products" />
          <Blueprint title="배송 정보" items={['받는 분, 연락처', '주소 + [주소 찾기]']} data="orders (배송 정보 칼럼 추가 필요)" />
          <Blueprint title="결제 금액 (TOTAL)" items={['상품 금액, 배송비', '총 결제 금액(크게)', '[가상 결제하기] (주요 버튼)', '재고 차감·롤백 안내: 재고 부족 시 주문 전체 취소, 장바구니는 유지']} data="orders, order_items, products.stock_quantity (트랜잭션)" />
          <Blueprint title="배송 노선 (주문 완료 후)" items={['결제완료 → 배송준비 → 배송중 → 배송완료', '배송 시작 전까지 주문취소 가능 안내', '재사용: components/layout/Site.jsx 의 NowStation 모양']} data="orders.status ORDERED → PREPARING → SHIPPING → DELIVERED / CANCELLED" />
        </div>
      </div>
    </>
  );
}
