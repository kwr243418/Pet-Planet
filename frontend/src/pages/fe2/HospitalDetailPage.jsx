import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { NowStation, PageHero } from '../../components/layout/Site.jsx';
import { TinyDog } from '../../components/illust/index.jsx';
import { Button, EmptyState, ErrorState, OptionGroup, PageLoader, Stars, Tag } from '../../components/common/ui.jsx';
import { ReviewCard } from '../../components/place/Reviews.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { hospitalApi, reviewApi } from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { usePageTitle } from '../../hooks/usePage.js';
import { formatDate } from '../../utils/format.js';
import RouteGuide from '../../components/nearby/RouteGuide.jsx';
import { readOrigin } from '../../utils/origin.js';
import './fe2.css';

const PAGE_SIZE = 3;

/** S04-0 동물병원 상세 · 리뷰 — GET /api/hospitals/{id}, GET /api/reviews?targetType=HOSPITAL */
export default function HospitalDetailPage() {
  const { hospitalId } = useParams();
  const toast = useToast();
  const [tab, setTab] = useState('reviews'); // 처음에는 리뷰 탭
  const [sort, setSort] = useState('latest');
  const [more, setMore] = useState({ items: [], page: 0, hasNext: false, loading: false });

  const hospitalQ = useAsync(() => hospitalApi.get(hospitalId), [hospitalId]);
  const reviewsQ = useAsync(async () => {
    const res = await reviewApi.list(hospitalId, { targetType: 'HOSPITAL', sort: sort === 'rating' ? 'rating_desc' : 'latest', page: 0, size: PAGE_SIZE });
    setMore({ items: [], page: 0, hasNext: res.hasNext, loading: false });
    return res;
  }, [hospitalId, sort]);
  const hospital = hospitalQ.data;
  usePageTitle(hospital?.name ?? '동물병원 상세');

  const loadMore = async () => {
    setMore((m) => ({ ...m, loading: true }));
    try {
      const res = await reviewApi.list(hospitalId, { targetType: 'HOSPITAL', sort: sort === 'rating' ? 'rating_desc' : 'latest', page: more.page + 1, size: PAGE_SIZE });
      setMore((m) => ({ items: [...m.items, ...res.content], page: m.page + 1, hasNext: res.hasNext, loading: false }));
    } catch (err) {
      setMore((m) => ({ ...m, loading: false }));
      toast.error(err.message ?? '리뷰를 더 불러오지 못했어요.');
    }
  };

  if (hospitalQ.error) {
    return (
      <div className="container fe2">
        {hospitalQ.error.status === 404 ? (
          <EmptyState title="병원을 찾을 수 없어요" desc="주소가 올바른지 확인해 주세요." action={<Link to="/reservations/hospital" className="btn btn--outline btn--md">예약 화면으로</Link>} />
        ) : (
          <ErrorState error={hospitalQ.error} onRetry={hospitalQ.reload} />
        )}
      </div>
    );
  }
  if (!hospital) return <PageLoader />;

  const summary = reviewsQ.data?.summary;
  const count = summary?.reviewCount ?? hospital.reviewCount ?? 0;
  const avg = summary?.avgRating ?? hospital.avgRating ?? 0;
  const dist = summary?.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const shown = [...(reviewsQ.data?.content ?? []), ...more.items];
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
            {hospital.partner && <Tag tone="mint">제휴 병원</Tag>}
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
            <dd>{hospital.operatingHours ?? '병원에 문의해 주세요'}</dd>
            <dt>주소</dt>
            <dd>{hospital.address}</dd>
            <dt>전화번호</dt>
            <dd>{hospital.phone ?? '-'}</dd>
          </dl>
        </section>

        {/* 가는 방법 (주변 탐색에서 고른 출발점 기준) */}
        <RouteGuide origin={readOrigin()} dest={{ name: hospital.name, lat: hospital.lat, lng: hospital.lng }} />

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
                onChange={setSort}
                options={[
                  { value: 'latest', label: '최신순' },
                  { value: 'rating', label: '별점 높은순' },
                ]}
              />
            </div>
            {reviewsQ.error ? (
              <ErrorState error={reviewsQ.error} onRetry={reviewsQ.reload} />
            ) : reviewsQ.loading && !reviewsQ.data ? (
              <PageLoader />
            ) : count === 0 ? (
              <EmptyState compact title="아직 방문 리뷰가 없어요" desc="진료를 받은 뒤 첫 리뷰를 남겨 보세요." />
            ) : (
              <div className="fe2-reviews__list">
                {shown.map((r) => (
                  <div key={r.reviewId}>
                    <ReviewCard review={r} />
                    {(r.visitDate || r.petBreed) && (
                      <p className="fe2-review-meta">
                        {[r.visitDate && `방문 ${formatDate(r.visitDate)}`, r.petBreed && `${r.petBreed}${r.petWeight ? ` ${r.petWeight}kg` : ''}`].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {more.hasNext && (
              <Button variant="outline" block loading={more.loading} onClick={loadMore}>
                리뷰 더보기
              </Button>
            )}
          </section>
        ) : (
          <section className="card fe2-about">
            <h3>병원 소개</h3>
            <p>{hospital.intro ?? '병원 소개가 아직 등록되지 않았어요.'}</p>
            <h3>진료 과목</h3>
            <div className="fe2-about__chips">
              {(hospital.departments ?? []).length === 0 && <span className="fe2-note">병원에 문의해 주세요</span>}
              {(hospital.departments ?? []).map((d) => (
                <Tag key={d}>{d}</Tag>
              ))}
            </div>
            <h3>진료시간</h3>
            <p>
              {hospital.operatingHours ?? '병원에 문의해 주세요'}
              <br />
              점심시간 {hospital.lunchTime ?? '13:00-14:00'}
            </p>
            <h3>오시는 길</h3>
            <p>
              {station ? `${(station.lines ?? [station.line]).join(', ')} ${station.stationName}역에서 약 ${station.distanceKm}km` : '가까운 지하철역 정보가 없어요'}
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