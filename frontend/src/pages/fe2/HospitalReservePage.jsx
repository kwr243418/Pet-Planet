import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { NowStation, PageHero } from '../../components/layout/Site.jsx';
import { StationBuildings } from '../../components/illust/index.jsx';
import { Button, EmptyState, OptionGroup, PageLoader } from '../../components/common/ui.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { GENDER_LABEL } from '../../utils/format.js';
import ReserveTabs from './ReserveTabs.jsx';
import { HOSPITALS, createHospitalReservation, getAvailableTimes } from './mockData.js';
import './fe2.css';

const todayStr = () => new Date().toLocaleDateString('sv-SE'); // 2026-11-24 모양
const nowTime = () => new Date().toTimeString().slice(0, 5); // 14:05 모양

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

/** S04 동물병원 진료 예약 */
export default function HospitalReservePage() {
  const toast = useToast();
  const { isLoggedIn, booting, pets } = useAuth();
  const [params] = useSearchParams();
  const [hospitalId, setHospitalId] = useState(Number(params.get('hospitalId')) || HOSPITALS[0].hospitalId);
  const [petId, setPetId] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(null);
  const [version, setVersion] = useState(0); // 시간 목록을 다시 계산하려고 쓰는 숫자

  const hospital = HOSPITALS.find((h) => h.hospitalId === hospitalId);
  const pet = pets.find((p) => p.petId === petId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const slots = useMemo(() => (date ? getAvailableTimes(hospitalId, date) : []), [hospitalId, date, version]);
  const isPast = (t) => date === todayStr() && t <= nowTime();

  const reset = () => {
    setDone(null);
    setTime('');
    setErrors({});
    setVersion((v) => v + 1);
  };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!petId) next.pet = '예약할 반려동물을 선택해 주세요.';
    if (!date) next.date = '날짜를 선택해 주세요.';
    else if (!time) next.time = '시간을 선택해 주세요.';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      setDone(createHospitalReservation({ hospitalId, petId, petName: pet.name, reservationDate: `${date}T${time}:00+09:00` }));
    } catch (err) {
      toast.error(err.message);
      setTime('');
      setVersion((v) => v + 1);
    }
  };

  const hero = (
    <>
      <PageHero line="R" en="CLINIC" title={'제휴 동물병원\n진료 예약'} desc={'반려동물과 원하는 시간을 고르면 병원으로 바로 신청돼요.\n병원이 승인하면 예약이 확정됩니다.'} art={<StationBuildings />} />
      <NowStation steps={['예약 선택', '병원 선택', '반려동물 · 일시', '신청 완료']} current={done ? 3 : 2} />
    </>
  );

  if (booting) return <PageLoader />;

  if (!isLoggedIn) {
    return (
      <>
        {hero}
        <div className="container fe2">
          <ReserveTabs />
          <EmptyState title="로그인이 필요해요" desc="내 반려동물을 골라 예약하려면 먼저 로그인해 주세요." action={<Link to="/login?redirect=%2Freservations%2Fhospital" className="btn btn--primary btn--md">로그인하기</Link>} />
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
            <h2 className="fe2-step-title">진료 예약을 신청했어요</h2>
            <dl className="fe2-info">
              <dt>병원</dt>
              <dd>{done.hospitalName}</dd>
              <dt>반려동물</dt>
              <dd>{done.petName}</dd>
              <dt>일시</dt>
              <dd>
                {done.reservationDate.slice(0, 10)} {done.reservationDate.slice(11, 16)}
              </dd>
            </dl>
            <StatusRoute current={0} />
            <p className="fe2-note">병원이 승인하면 예약이 확정돼요. 승인 전에는 마이페이지에서 취소할 수 있어요.</p>
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

  return (
    <>
      {hero}
      <div className="container fe2">
        <ReserveTabs />
        <form className="fe2-form" onSubmit={submit} noValidate>
          {/* 1. 병원 */}
          <section className="card fe2-section">
            <h2 className="fe2-step-title">1. 병원 선택</h2>
            <OptionGroup
              label="병원"
              value={hospitalId}
              onChange={(v) => {
                setHospitalId(v);
                setTime('');
              }}
              options={HOSPITALS.map((h) => ({ value: h.hospitalId, label: h.name }))}
            />
            <p className="fe2-note">
              {hospital.nearestStation.stationName}역 {hospital.nearestStation.distanceKm}km · {hospital.operatingHours}
              {'  '}
              <Link to={`/hospitals/${hospital.hospitalId}`} className="text-link">
                별점 · 리뷰 보기
              </Link>
            </p>
          </section>

          {/* 2. 반려동물 */}
          <section className="card fe2-section">
            <h2 className="fe2-step-title">2. 반려동물</h2>
            {pets.length === 0 ? (
              <EmptyState compact title="등록된 반려동물이 없어요" action={<Link to="/pets/new" className="btn btn--outline btn--md">반려동물 등록</Link>} />
            ) : (
              <div className="fe2-pets" role="radiogroup" aria-label="반려동물 선택">
                {pets.map((p) => (
                  <button key={p.petId} type="button" role="radio" aria-checked={petId === p.petId} className={`fe2-pet ${petId === p.petId ? 'is-on' : ''}`} onClick={() => setPetId(p.petId)}>
                    <b>{p.name}</b>
                    <span>
                      {p.breed} · {GENDER_LABEL[p.gender]} · {p.weight}kg
                    </span>
                  </button>
                ))}
              </div>
            )}
            {errors.pet && <p className="fe2-error" role="alert">{errors.pet}</p>}
          </section>

          {/* 3. 일시 */}
          <section className="card fe2-section">
            <h2 className="fe2-step-title">3. 일시</h2>
            <label className="fe2-date-label">
              날짜
              <input
                className="fe2-date"
                type="date"
                min={todayStr()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime('');
                }}
              />
            </label>
            {errors.date && <p className="fe2-error" role="alert">{errors.date}</p>}
            {date && (
              <>
                <div className="fe2-slots" role="group" aria-label="시간 선택">
                  {slots.map((s) => {
                    const off = !s.available || isPast(s.time);
                    return (
                      <button key={s.time} type="button" className={`fe2-slot ${time === s.time ? 'is-on' : ''}`} disabled={off} aria-pressed={time === s.time} onClick={() => setTime(s.time)}>
                        {s.time}
                      </button>
                    );
                  })}
                </div>
                <p className="fe2-note">줄이 그어진 시간은 이미 예약이 찼어요.</p>
              </>
            )}
            {errors.time && <p className="fe2-error" role="alert">{errors.time}</p>}
          </section>

          {/* 예약 확인 (승차권) */}
          <section className="card fe2-ticket">
            <h2 className="fe2-step-title">예약 확인</h2>
            <dl className="fe2-info">
              <dt>병원</dt>
              <dd>{hospital.name}</dd>
              <dt>반려동물</dt>
              <dd>{pet ? `${pet.name} (${pet.breed} · ${pet.weight}kg)` : '선택해 주세요'}</dd>
              <dt>일시</dt>
              <dd>{date && time ? `${date} ${time}` : '선택해 주세요'}</dd>
            </dl>
            <StatusRoute current={0} />
            <p className="fe2-note">신청하면 승인대기 상태가 되고, 병원이 승인하면 예약이 확정돼요. 취소는 마이페이지에서 할 수 있어요.</p>
            <Button type="submit" size="lg" block>
              진료 예약 신청
            </Button>
          </section>
        </form>
      </div>
    </>
  );
}