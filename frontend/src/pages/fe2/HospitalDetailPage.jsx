import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { NowStation, PageHero } from '../../components/layout/Site.jsx';
import { TinyDog } from '../../components/illust/index.jsx';
import { Button, EmptyState, OptionGroup, Stars, Tag } from '../../components/common/ui.jsx';
import { ReviewCard } from '../../components/place/Reviews.jsx';
import { formatDate } from '../../utils/format.js';
import { HOSPITALS, HOSPITAL_REVIEWS } from './mockData.js';
import './fe2.css';

const PAGE_SIZE = 3;

/** S04-0 동물병원 상세 · 리뷰 */
export default function HospitalDetailPage() {
  const { hospitalId } = useParams();
  const hospital = HOSPITALS.find((h) => h.hospitalId === Number(hospitalId));
  const [tab, setTab] = useState('reviews'); // 처음에는 리뷰 탭
  const [sort, setSort] = useState('latest');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const reviews = useMemo(() => HOSPITAL_REVIEWS.filter((r) => r.hospitalId === Number(hospitalId)), [hospitalId]);
  const sorted = useMemo(
    () => [...reviews].sort((a, b) => (sort === 'rating' ? b.rating - a.rating : new Date(b.createdAt) - new Date(a.createdAt))),
    [reviews, sort],
  );

  if (!hospital) {
    return (
      <div className="container fe2">
        <EmptyState title="병원을 찾을 수 없어요" desc="주소가 올바른지 확인해 주세요." action={<Link to="/reservations/hospital" className="btn btn--outline btn--md">예약 화면으로</Link>} />
      </div>
    );
  }

  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((r) => dist[r.rating]++);
  const station = hospital.nearestStation;

  return (
    <>
      <PageHero line="R" en="CLINIC" compact title={hospital.name} desc="병원 정보와 방문 리뷰를 먼저 확인하는 화면이에요." art={<TinyDog size={140} />}>
        <p className="page-hero__desc">
          <Link to="/reservations/hospital" className="text-link">
            병원 · 호텔 예약 › 동물병원
          </Link>
        </p>
      </PageHero>
      <NowStation steps={['예약 선택', '병원 상세', '반려동물 · 일시', '신청 완료']} current={1} />

      <div className="container fe2">
        {/* 병원 헤더 */}
        <section className="card fe2-hospital">
          <div className="fe2-hospital__tags">
            <Tag tone="mint">제휴 병원</Tag>
            {station && (
              <Tag>
                {station.stationName}역 {station.distanceKm}km
              </Tag>
            )}
          </div>
          <h2 className="fe2-hospital__name">{hospital.name}</h2>
          <div className="fe2-hospital__rating">
            <span className="fe2-hospital__score en">{avg.toFixed(1)}</span>
            <span className="fe2-hospital__max">/ 5.0</span>
            <Stars value={avg} size={20} />
            <span className="fe2-hospital__count">리뷰 {count}개</span>
          </div>
          <dl className="fe2-info">
            <dt>진료시간</dt>
            <dd>{hospital.operatingHours}</dd>
            <dt>주소</dt>
            <dd>{hospital.address}</dd>
            <dt>전화번호</dt>
            <dd>{hospital.phone}</dd>
          </dl>
        </section>

        {/* 탭 */}
        <div className="fe2-tabs">
          <OptionGroup
            size="lg"
            label="병원 정보 탭"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'reviews', label: `방문 리뷰 (${count})` },
              { value: 'info', label: '병원 소개 · 진료 안내' },
            ]}
          />
        </div>

        {tab === 'reviews' ? (
          <section className="card fe2-reviews">
            <div className="fe2-reviews__top">
              <div className="fe2-dist" aria-label="별점 분포">
                {[5, 4, 3, 2, 1].map((n) => (
                  <div key={n} className="fe2-dist__row">
                    <span>{n}점</span>
                    <span className="fe2-dist__bar">
                      <span style={{ width: `${count ? (dist[n] / count) * 100 : 0}%` }} />
                    </span>
                    <span>{dist[n]}</span>
                  </div>
                ))}
              </div>
              <OptionGroup
                label="리뷰 정렬"
                value={sort}
                onChange={(v) => {
                  setSort(v);
                  setVisible(PAGE_SIZE);
                }}
                options={[
                  { value: 'latest', label: '최신순' },
                  { value: 'rating', label: '별점 높은순' },
                ]}
              />
            </div>
            {count === 0 ? (
              <EmptyState compact title="아직 방문 리뷰가 없어요" desc="진료를 받은 뒤 첫 리뷰를 남겨 보세요." />
            ) : (
              <div className="fe2-reviews__list">
                {sorted.slice(0, visible).map((r) => (
                  <div key={r.reviewId}>
                    <ReviewCard review={r} />
                    <p className="fe2-review-meta">
                      방문 {formatDate(r.visitDate)} · {r.petBreed} {r.petWeight}kg
                    </p>
                  </div>
                ))}
              </div>
            )}
            {visible < sorted.length && (
              <Button variant="outline" block onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                리뷰 더보기
              </Button>
            )}
          </section>
        ) : (
          <section className="card fe2-about">
            <h3>병원 소개</h3>
            <p>{hospital.intro}</p>
            <h3>진료 과목</h3>
            <div className="fe2-about__chips">
              {hospital.departments.map((d) => (
                <Tag key={d}>{d}</Tag>
              ))}
            </div>
            <h3>진료시간</h3>
            <p>
              {hospital.operatingHours}
              <br />
              점심시간 {hospital.lunchTime}
            </p>
            <h3>오시는 길</h3>
            <p>
              {station ? `${station.lines.join(', ')} ${station.stationName}역에서 약 ${station.distanceKm}km` : hospital.address}
              <br />
              {hospital.address}
            </p>
            <h3>예약 안내</h3>
            <p>예약을 신청하면 병원이 승인한 뒤 확정돼요. 승인 전에는 마이페이지에서 취소할 수 있어요.</p>
          </section>
        )}

        {/* 하단 고정 바 */}
        <div className="fe2-cartbar" role="region" aria-label="진료 예약">
          <p>
            <b>{hospital.name}</b>
            <span>
              별점 {avg.toFixed(1)} · 리뷰 {count}개
            </span>
          </p>
          <Link to={`/reservations/hospital?hospitalId=${hospital.hospitalId}`} className="btn btn--primary btn--md">
            진료 예약하기
          </Link>
        </div>
      </div>
    </>
  );
}