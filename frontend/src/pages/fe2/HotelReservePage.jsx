import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { NowStation, PageHero } from '../../components/layout/Site.jsx';
import { StationBuildings } from '../../components/illust/index.jsx';
import { Button, EmptyState, ErrorState, OptionGroup, PageLoader, Spinner, Tag } from '../../components/common/ui.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { GENDER_LABEL } from '../../utils/format.js';
import ReserveTabs from './ReserveTabs.jsx';
import { hotelApi } from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { focusFirstInvalid, usePageTitle } from '../../hooks/usePage.js';
import './fe2.css';

const todayStr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const nightsBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
/** 'YYYY-MM-DD' 날짜에 n일을 더해요 */
const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('sv-SE');
};
const won = (n) => `${n.toLocaleString('ko-KR')}원`;
const STATUS_LABEL = { AVAILABLE: '입실 가능', OVERWEIGHT: '체중 초과로 입실 불가', BOOKED: '같은 날짜에 확정 예약 있음' };

/** 예약 상태 노선: 승인대기 → 예약확정 → 이용완료 */
function StatusRoute({ current = 0 }) {
  return (
    <ol className="fe2-route" aria-label="예약 상태 노선">
      {['승인대기', '예약확정', '이용완료'].map((s, i) => (
        <li key={s} className={i === current ? 'is-on' : ''}>
          {s}
        </li>
      ))}
    </ol>
  );
}

/** S05 펫 호텔 객실 예약 — GET /api/pet-hotels?bookable=true, /rooms (체중·기간 검증), POST /api/hotel-reservations */
export default function HotelReservePage() {
  usePageTitle('펫 호텔 예약');
  const toast = useToast();
  const { isLoggedIn, booting, pets } = useAuth();
  const [params] = useSearchParams();
  const [hotelId, setHotelId] = useState(() => Number(params.get('hotelId')) || null); // 주변 탐색에서 고른 호텔
  const [petId, setPetId] = useState(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const hotelsQ = useAsync(() => hotelApi.list({ bookable: true, size: 20 }).then((r) => r.content), []);
  const hotels = hotelsQ.data ?? [];
  const hotel = hotels.find((h) => h.hotelId === hotelId) ?? hotels[0];
  const pet = pets.find((p) => p.petId === petId);
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const ready = !!hotel && !!pet && nights >= 1;
  // 서버가 반려동물 체중 vs 최대 수용 몸무게, 기간 겹침을 계산해서 AVAILABLE | OVERWEIGHT | BOOKED 로 알려줘요
  const roomsQ = useAsync(() => hotelApi.rooms(hotel.hotelId, { petId, checkIn, checkOut }), [hotel?.hotelId, petId, checkIn, checkOut], { enabled: ready });
  const rooms = ready ? roomsQ.data?.rooms ?? [] : [];
  const room = rooms.find((r) => r.roomId === roomId);

  const reset = () => {
    setDone(null);
    setRoomId(null);
    setErrors({});
    if (ready) roomsQ.reload();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const next = {};
    if (!petId) next.pet = '예약할 반려동물을 선택해 주세요.';
    if (!checkIn || !checkOut) next.date = '체크인과 체크아웃 날짜를 모두 선택해 주세요.';
    else if (!roomId) next.room = '입실 가능한 객실을 선택해 주세요.';
    setErrors(next);
    if (Object.keys(next).length) {
      focusFirstInvalid();
      return;
    }
    setSubmitting(true);
    try {
      setDone(await hotelApi.reserve({ roomId, petId, checkInDate: checkIn, checkOutDate: checkOut }));
    } catch (err) {
      toast.error(err.message ?? '예약을 신청하지 못했어요.');
      setRoomId(null);
      roomsQ.reload(); // ROOM_ALREADY_BOOKED / ROOM_OVERWEIGHT → 최신 상태로
    } finally {
      setSubmitting(false);
    }
  };

  const hero = (
    <>
      <PageHero line="R" photo="/images/a5-hotel-retriever.jpg" en={'PET\nSTAY'} title={'체중에 맞는 객실만\n골라 보여드려요'} desc={'등록한 반려동물의 체중을 객실의 최대 수용 몸무게와 자동으로 비교하고,\n이미 확정된 예약과 겹치는 날짜는 막아 드려요.'} art={<StationBuildings />} />
      <NowStation steps={['예약 선택', '호텔 선택', '객실 · 체중 검증', '예약 완료']} current={done ? 3 : 2} />
    </>
  );

  if (booting || (hotelsQ.loading && !hotelsQ.data)) return <PageLoader />;

  if (!isLoggedIn) {
    return (
      <>
        {hero}
        <div className="container fe2">
          <ReserveTabs />
          <EmptyState title="로그인이 필요해요" desc="내 반려동물의 체중으로 객실을 확인하려면 먼저 로그인해 주세요." action={<Link to="/login?redirect=%2Freservations%2Fhotel" className="btn btn--primary btn--md">로그인하기</Link>} />
        </div>
      </>
    );
  }

  if (done) {
    return (
      <>
        {hero}
        <div className="container fe2">
          <section className="card fe2-ticket">
            <h2 className="fe2-step-title">객실 예약을 신청했어요</h2>
            <dl className="fe2-info">
              <dt>호텔</dt>
              <dd>
                {done.hotelName} · {done.roomName}
              </dd>
              <dt>반려동물</dt>
              <dd>{done.petName}</dd>
              <dt>기간</dt>
              <dd>
                {done.checkInDate} ~ {done.checkOutDate} ({done.nights}박)
              </dd>
              <dt>합계</dt>
              <dd>{won(done.totalPrice)}</dd>
            </dl>
            <StatusRoute current={0} />
            <p className="fe2-note">호텔이 승인하면 예약이 확정돼요. 승인 전에는 마이페이지에서 취소할 수 있어요.</p>
            <Link to="/mypage" className="btn btn--primary btn--lg btn--block">
              마이페이지에서 보기
            </Link>
            <Button variant="outline" block onClick={reset}>
              다른 예약 하기
            </Button>
          </section>
        </div>
      </>
    );
  }

  if (hotelsQ.error || !hotel) {
    return (
      <>
        {hero}
        <div className="container fe2">
          <ReserveTabs />
          {hotelsQ.error ? <ErrorState error={hotelsQ.error} onRetry={hotelsQ.reload} /> : <EmptyState title="예약할 수 있는 펫 호텔이 없어요" desc="객실이 등록된 호텔이 없어요. db/seed_demo.sql 로 시연용 호텔을 넣었는지 확인해 주세요." />}
        </div>
      </>
    );
  }

  const stop = hotel.busAccess;

  return (
    <>
      {hero}
      <div className="container fe2">
        <ReserveTabs />
        <form className="fe2-form" onSubmit={submit} noValidate>
          {/* 호텔 정보 */}
          <section className="card fe2-section">
            <h2 className="fe2-step-title">호텔 선택</h2>
            <OptionGroup
              label="호텔"
              value={hotel.hotelId}
              onChange={(v) => {
                setHotelId(v);
                setRoomId(null);
              }}
              options={hotels.map((h) => ({ value: h.hotelId, label: h.name }))}
            />
            <p className="fe2-note">
              {[hotel.address, hotel.phone, stop?.stopId && `${stop.stopName} 정류장 도보 ${stop.walkMin}분`, hotel.minPrice && `1박 ${won(hotel.minPrice)}부터`].filter(Boolean).join(' · ')}
            </p>
          </section>

          {/* 1. 반려동물 */}
          <section className="card fe2-section">
            <h2 className="fe2-step-title">1. 반려동물</h2>
            {pets.length === 0 ? (
              <EmptyState compact title="등록된 반려동물이 없어요" action={<Link to="/pets/new" className="btn btn--outline btn--md">반려동물 등록</Link>} />
            ) : (
              <div className="fe2-pets" role="radiogroup" aria-label="반려동물 선택">
                {pets.map((p) => (
                  <button
                    key={p.petId}
                    type="button"
                    role="radio"
                    aria-checked={petId === p.petId}
                    className={`fe2-pet ${petId === p.petId ? 'is-on' : ''}`}
                    onClick={() => {
                      setPetId(p.petId);
                      setRoomId(null);
                    }}
                  >
                    <b>{p.name}</b>
                    <span>
                      {p.breed} · {GENDER_LABEL[p.gender]}
                    </span>
                    <strong className="fe2-pet__weight en">{p.weight}kg</strong>
                  </button>
                ))}
              </div>
            )}
            {errors.pet && <p className="fe2-error" role="alert">{errors.pet}</p>}
          </section>

          {/* 2. 기간 */}
          <section className="card fe2-section">
            <h2 className="fe2-step-title">2. 기간</h2>
            <div className="fe2-dates">
              <label className="fe2-date-label">
                체크인
                <input
                  className="fe2-date"
                  type="date"
                  min={todayStr()}
                  value={checkIn}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    if (checkOut && checkOut <= e.target.value) setCheckOut('');
                    setRoomId(null);
                  }}
                />
              </label>
              <label className="fe2-date-label">
                체크아웃
                <input
                  className="fe2-date"
                  type="date"
                  min={checkIn ? addDays(checkIn, 1) : addDays(todayStr(), 1)}
                  disabled={!checkIn}
                  value={checkOut}
                  onChange={(e) => {
                    setCheckOut(e.target.value);
                    setRoomId(null);
                  }}
                />
              </label>
              {nights >= 1 && <Tag tone="mint">{nights}박</Tag>}
            </div>
            {errors.date && <p className="fe2-error" role="alert">{errors.date}</p>}
          </section>

          {/* 3. 객실 목록 */}
          <section className="card fe2-section">
            <h2 className="fe2-step-title">3. 객실 선택</h2>
            {!ready ? (
              <p className="fe2-note">반려동물과 기간을 고르면 체중에 맞는 객실이 나타나요.</p>
            ) : roomsQ.error ? (
              <ErrorState error={roomsQ.error} onRetry={roomsQ.reload} />
            ) : roomsQ.loading && !roomsQ.data ? (
              <Spinner />
            ) : rooms.length === 0 ? (
              <p className="fe2-note">이 호텔에는 등록된 객실이 없어요.</p>
            ) : (
              <div className="fe2-rooms" role="radiogroup" aria-label="객실 선택">
                {rooms.map((r) => {
                  const ok = r.status === 'AVAILABLE';
                  return (
                    <button
                      key={r.roomId}
                      type="button"
                      role="radio"
                      aria-checked={roomId === r.roomId}
                      disabled={!ok}
                      className={`fe2-room ${roomId === r.roomId ? 'is-on' : ''} ${ok ? '' : 'is-off'}`}
                      onClick={() => setRoomId(r.roomId)}
                    >
                      <b>{r.roomName}</b>
                      <span className="fe2-room__max en">최대 {r.maxWeight}kg</span>
                      <span>1박 {won(r.pricePerNight)}</span>
                      <span className={ok ? 'fe2-room__ok' : 'fe2-room__no'}>{STATUS_LABEL[r.status]}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {errors.room && <p className="fe2-error" role="alert">{errors.room}</p>}
          </section>

          {/* 예약 확인 */}
          <section className="card fe2-ticket">
            <h2 className="fe2-step-title">예약 확인</h2>
            <dl className="fe2-info">
              <dt>호텔</dt>
              <dd>{hotel.name}</dd>
              <dt>객실</dt>
              <dd>{room ? room.roomName : '선택해 주세요'}</dd>
              <dt>반려동물</dt>
              <dd>{pet ? `${pet.name} (${pet.weight}kg)` : '선택해 주세요'}</dd>
              <dt>기간</dt>
              <dd>{nights >= 1 ? `${checkIn} ~ ${checkOut} (${nights}박)` : '선택해 주세요'}</dd>
              <dt>합계</dt>
              <dd>{room ? `${won(room.pricePerNight)} × ${nights}박 = ${won(room.totalPrice)}` : '-'}</dd>
            </dl>
            {room && (
              <ul className="fe2-checks" aria-label="검증 결과">
                <li>
                  체중 {pet.weight}kg ≤ 최대 수용 {room.maxWeight}kg <Tag tone="mint">통과</Tag>
                </li>
                <li>
                  같은 기간에 겹치는 예약 없음 <Tag tone="mint">통과</Tag>
                </li>
              </ul>
            )}
            <StatusRoute current={0} />
            <Button type="submit" size="lg" block loading={submitting}>
              객실 예약 신청
            </Button>
          </section>
        </form>
      </div>
    </>
  );
}