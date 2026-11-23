import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { placeApi, stationApi } from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { LetterBadge } from '../components/layout/Site.jsx';
import { SubwayPoodle, TinyDog } from '../components/illust/index.jsx';
import { ErrorState, Skeleton } from '../components/common/ui.jsx';
import { StationPlaceCard } from '../components/place/PlaceCards.jsx';
import { GENDER_LABEL } from '../utils/format.js';
import { readLastStation } from './Explore.jsx';
import { DEFAULT_LINE, stationBase, stationLabel } from '../utils/subway.js';

const LINE_TILES = [
  { key: 'E', name: '탐색선', title: '역세권\n동반 장소 탐색', desc: '역 반경 1km 카페 · 식당 · 숙소 · 운동장', cta: '탐색선 타기', to: '/explore', tone: 'mint' },
  { key: 'R', name: '예약선', title: '동물병원 ·\n펫 호텔 예약', desc: '체중에 맞는 객실만 자동으로 골라줘요', cta: '예약선 타기', to: '/reservations/hospital', tone: 'mint-soft' },
  { key: 'S', name: '쇼핑선', title: '사료 · 간식 ·\n외출 용품 쇼핑', desc: '장바구니부터 배송 조회까지 한 번에', cta: '쇼핑선 타기', to: '/shop', tone: 'beige' },
  { key: 'M', name: '마이선', title: '예약 · 주문 ·\n리뷰 한곳에서', desc: '장소 후기와 상품 후기를 하나로', cta: '마이선 타기', to: '/mypage', tone: 'beige' },
];

// 체중 검증 예시용 객실 (실제 객실 데이터는 R 예약선 · room_types.max_weight)
const SAMPLE_ROOMS = [
  { name: '미디엄 룸', maxWeight: 15 },
  { name: '라지 룸', maxWeight: 30 },
];
const SAMPLE_PET = { name: '보리', breed: '진돗개', gender: 'MALE', weight: 18 };

/** S01 메인 홈 */
export default function Home() {
  const { user, primaryPet } = useAuth();
  const last = readLastStation();
  // "이번 역": 마지막으로 본 역, 없으면 홍대입구(2호선)
  const station = useAsync(async () => {
    if (last?.stationId) return stationApi.get(last.stationId).catch(() => null);
    const line2 = await stationApi.byLine(DEFAULT_LINE);
    return line2.find((s) => stationBase(s.stationName) === '홍대입구') ?? line2[0];
  }, []);
  const st = station.data;
  const near = useAsync(() => placeApi.search({ stationId: st.stationId, radiusKm: 1, sort: 'distance', size: 3 }), [st?.stationId], { enabled: !!st });

  const pet = primaryPet ?? SAMPLE_PET;
  const exploreLink = st ? `/explore?line=${encodeURIComponent(st.line)}&stationId=${st.stationId}` : '/explore';

  return (
    <div className="home">
      {/* 타이틀 */}
      <section className="home-hero">
        <div className="container">
          <div className="home-hero__meta en">
            <span>SEOUL · SUBWAY PET PLATFORM</span>
            <span>ESTD 2026</span>
          </div>
          <div className="home-hero__corners">
            <span>역세권 반려생활 플랫폼</span>
            <span>지하철역에서 시작해요</span>
          </div>
          <h1 className="home-hero__title">PET PLANET</h1>
          <div className="home-hero__corners home-hero__corners--bottom">
            <span>걸어서 1km, 우리 아이와 함께</span>
            <span>장소 · 병원 · 호텔 · 쇼핑</span>
          </div>
          <div className="home-hero__art">
            <SubwayPoodle />
            <Link to={exploreLink} className="btn btn--primary btn--md home-hero__cta">
              ↗ 우리 역 주변 찾기
            </Link>
          </div>
        </div>
      </section>

      {/* 4개 노선 소개 */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="home-lines__title en">4 LINES</h2>
            <p className="section-sub home-lines__sub">노선 4개, 계정은 하나 — 반려동물 프로필 한 번이면 모두 환승</p>
          </div>
          <div className="line-tiles">
            {LINE_TILES.map((t) => (
              <Link key={t.key} to={t.to} className={`line-tile line-tile--${t.tone}`}>
                <span className="line-tile__big en" aria-hidden>
                  {t.key}
                </span>
                <span className="line-tile__badge">
                  <LetterBadge letter={t.key} size="sm" /> {t.key} · {t.name}
                </span>
                <h3 className="line-tile__title">{t.title}</h3>
                <p className="line-tile__desc">{t.desc}</p>
                <span className="line-tile__cta">{t.cta} →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 이번 역 주변 */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="section-title">
              이번 역은
              <br />
              {st ? `${stationLabel(st.stationName)}입니다` : '…'}
            </h2>
            <Link to={exploreLink} className="btn btn--outline btn--sm">
              주변 장소 전체 보기 →
            </Link>
          </div>
          {near.error ? (
            <ErrorState error={near.error} onRetry={near.reload} />
          ) : (
            <div className="near-grid">
              {!near.data
                ? [0, 1, 2].map((i) => <Skeleton key={i} h={240} r={36} />)
                : near.data.content.map((p, i) => <StationPlaceCard key={p.placeId} place={p} dog={i === 0} />)}
            </div>
          )}
        </div>
      </section>

      {/* 체중 검증 배너 */}
      <section className="section">
        <div className="container">
          <WeightBanner pet={pet} isSample={!primaryPet} loggedIn={!!user} />
        </div>
      </section>
    </div>
  );
}

function WeightBanner({ pet, isSample, loggedIn }) {
  const rooms = useMemo(() => SAMPLE_ROOMS.map((r) => ({ ...r, ok: Number(pet.weight) <= r.maxWeight })), [pet.weight]);
  return (
    <div className="profile-banner">
      <div className="profile-banner__text">
        <p className="profile-banner__eyebrow en">ONE PROFILE</p>
        <h2 className="profile-banner__title">
          프로필 한 번이면
          <br />
          객실 체중 검증까지
        </h2>
        <p className="profile-banner__desc">등록한 체중이 펫 호텔 객실의 최대 수용 몸무게와 바로 비교돼요.</p>
        <Link to={loggedIn ? '/pets/new' : '/signup'} className="btn btn--outline btn--md profile-banner__cta">
          반려동물 등록하기
        </Link>
      </div>
      <div className="profile-banner__demo" aria-label={isSample ? '예시' : undefined}>
        <div className="pet-ticket">
          <TinyDog size={46} />
          <div>
            <b>{pet.name}</b>
            <p className="faint">
              {pet.breed} · {GENDER_LABEL[pet.gender]}
            </p>
          </div>
          <b className="pet-ticket__kg en">{pet.weight}kg</b>
        </div>
        {rooms.map((r) => (
          <div key={r.name} className={`room-row ${r.ok ? 'is-ok' : 'is-no'}`}>
            <span>
              {r.name} · 최대 {r.maxWeight}kg
            </span>
            <b>{r.ok ? '입실 가능' : '입실 불가'}</b>
          </div>
        ))}
        {isSample && <p className="profile-banner__sample">예시 · 반려동물을 등록하면 우리 아이 체중으로 보여드려요</p>}
      </div>
    </div>
  );
}
