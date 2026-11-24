import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { NowStation, PageHero } from '../../components/layout/Site.jsx';
import { StationBuildings } from '../../components/illust/index.jsx';
import { Button, EmptyState, ErrorState, OptionGroup, PageLoader, Spinner } from '../../components/common/ui.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { GENDER_LABEL } from '../../utils/format.js';
import ReserveTabs from './ReserveTabs.jsx';
import { hospitalApi } from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { focusFirstInvalid, usePageTitle } from '../../hooks/usePage.js';
import './fe2.css';

const todayStr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); // 2026-11-24 모양 (한국 시간)

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

/** S04 동물병원 진료 예약 — GET /api/hospitals?partner=true, /available-times, POST /api/hospital-reservations */
export default function HospitalReservePage() {
  usePageTitle('동물병원 진료 예약');
  const toast = useToast();
  const { isLoggedIn, booting, pets } = useAuth();
  const [params] = useSearchParams();
  const wanted = Number(params.get('hospitalId')) || null;
  const [hospitalId, setHospitalId] = useState(wanted);
  const [petId, setPetId] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // 제휴 병원 목록 (+ 상세 화면에서 넘어온 병원이 목록에 없으면 따로 불러와 맨 앞에)
  const hospitalsQ = useAsync(async () => {
    const { content } = await hospitalApi.list({ partner: true, size: 20 });
    if (wanted && !content.some((h) => h.hospitalId === wanted)) {
      try {
        content.unshift(await hospitalApi.get(wanted));
      } catch {
        /* 없는 병원이면 무시 */
      }
    }
    return content;
  }, [wanted]);
  const hospitals = hospitalsQ.data ?? [];
  const hospital = hospitals.find((h) => h.hospitalId === hospitalId) ?? hospitals[0];
  const pet = pets.find((p) => p.petId === petId);
  const slotsQ = useAsync(() => hospitalApi.availableTimes(hospital.hospitalId, date), [hospital?.hospitalId, date], { enabled: !!hospital && !!date, initial: null });
  const slots = date ? slotsQ.data?.slots ?? [] : [];

  const reset = () => {
    setDone(null);
    setTime('');
    setErrors({});
    if (date) slotsQ.reload();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const next = {};
    if (!petId) next.pet = '예약할 반려동물을 선택해 주세요.';
    if (!date) next.date = '날짜를 선택해 주세요.';
    else if (!time) next.time = '시간을 선택해 주세요.';
    setErrors(next);
    if (Object.keys(next).length) {
      focusFirstInvalid();
      return;
    }
    setSubmitting(true);
    try {
      setDone(await hospitalApi.reserve({ hospitalId: hospital.hospitalId, petId, reservationDate: `${date}T${time}:00+09:00` }));
    } catch (err) {
      toast.error(err.message ?? '예약을 신청하지 못했어요.');
      if (err.code === 'TIME_SLOT_TAKEN' || err.status === 400) {
        setTime('');
        slotsQ.reload(); // 다른 사람이 먼저 잡은 시간 → 목록 새로고침
      }
    } finally {
      setSubmitting(false);
    }
  };

  const hero = (
    <>
      <PageHero line="R" en="CLINIC" title={'제휴 동물병원\n진료 예약'} desc={'반려동물과 원하는 시간을 고르면 병원으로 바로 신청돼요.\n병원이 승인하면 예약이 확정됩니다.'} art={<StationBuildings />} />
      <NowStation steps={['예약 선택', '병원 선택', '반려동물 · 일시', '신청 완료']} current={done ? 3 : 2} />
    </>
  );

  if (booting || (hospitalsQ.loading && !hospitalsQ.data)) return <PageLoader />;

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

  if (hospitalsQ.error || !hospital) {
    return (
      <>
        {hero}
        <div className="container fe2">
          <ReserveTabs />
          {hospitalsQ.error ? <ErrorState error={hospitalsQ.error} onRetry={hospitalsQ.reload} /> : <EmptyState title="예약할 수 있는 제휴 병원이 없어요" desc="db/seed_demo.sql 로 시연용 병원을 넣었는지 확인해 주세요." />}
        </div>
      </>
    );
  }

  const station = hospital.nearestStation;

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
              value={hospital.hospitalId}
              onChange={(v) => {
                setHospitalId(v);
                setTime('');
              }}
              options={hospitals.map((h) => ({ value: h.hospitalId, label: h.name }))}
            />
            <p className="fe2-note">
              {[station && `${station.stationName}역 ${station.distanceKm}km`, hospital.operatingHours, hospital.lunchTime && `점심 ${hospital.lunchTime}`].filter(Boolean).join(' · ')}
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
            {date && slotsQ.loading && !slotsQ.data && <Spinner />}
            {date && slotsQ.error && <ErrorState error={slotsQ.error} onRetry={slotsQ.reload} />}
            {date && slots.length > 0 && (
              <>
                <div className="fe2-slots" role="group" aria-label="시간 선택">
                  {slots.map((s) => {
                    const off = !s.available; // 서버가 마감·지난 시간을 available=false 로 알려줘요
                    return (
                      <button key={s.time} type="button" className={`fe2-slot ${time === s.time ? 'is-on' : ''}`} disabled={off} aria-pressed={time === s.time} onClick={() => setTime(s.time)}>
                        {s.time}
                      </button>
                    );
                  })}
                </div>
                <p className="fe2-note">줄이 그어진 시간은 이미 예약이 찼거나 지난 시간이에요.</p>
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
            <Button type="submit" size="lg" block loading={submitting}>
              진료 예약 신청
            </Button>
          </section>
        </form>
      </div>
    </>
  );
}