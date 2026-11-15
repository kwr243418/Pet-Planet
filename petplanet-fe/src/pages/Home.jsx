import { Link, useNavigate } from 'react-router-dom';
import { placeApi } from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import Header from '../components/common/Header.jsx';
import Mascot from '../components/common/Mascot.jsx';
import { ErrorState, LineBadge, Skeleton } from '../components/common/ui.jsx';
import StationSearch from '../components/place/StationSearch.jsx';
import { PlaceMiniCard } from '../components/place/PlaceCard.jsx';
import { CATEGORY_META } from '../utils/categories.js';
import { SIZE_LABEL, sizeFromWeight } from '../utils/format.js';

const HOT_STATIONS = [
  { stationId: 1, stationName: '강남', lines: ['2', 'SB'] },
  { stationId: 9, stationName: '홍대입구', lines: ['2', 'GJ', 'AR'] },
  { stationId: 16, stationName: '성수', lines: ['2'] },
  { stationId: 21, stationName: '잠실', lines: ['2', '8'] },
  { stationId: 15, stationName: '망원', lines: ['6'] },
  { stationId: 20, stationName: '한강진', lines: ['6'] },
];

export default function Home() {
  const navigate = useNavigate();
  const { user, primaryPet } = useAuth();
  const top = useAsync(() => placeApi.search({ sort: 'rating', size: 8 }), []);
  const petSize = primaryPet ? sizeFromWeight(primaryPet.weight) : null;
  const forPet = useAsync(() => placeApi.search({ sizes: petSize, sort: 'reviews', size: 8 }), [petSize], { enabled: !!petSize });

  const goStation = (st) => navigate(`/explore?stationId=${st.stationId}`);

  return (
    <div className="page home">
      <Header logo right={user ? <Link to="/bookmarks" className="icon-btn" aria-label="찜한 장소">💗</Link> : <Link to="/login" className="btn btn--soft btn--sm">로그인</Link>} />

      <div className="home__greet">
        <p className="home__hello">
          {user ? (
            <>
              <b>{primaryPet ? primaryPet.name : user.name}</b>
              {primaryPet ? '랑' : '님,'} 오늘
              <br />
              어디로 산책 갈까요?
            </>
          ) : (
            <>
              반려견이랑 지하철 타고
              <br />
              <b>어디</b> 갈까요?
            </>
          )}
        </p>
        <Mascot size={78} className="home__mascot bob" />
      </div>

      <StationSearch onSelect={goStation} />

      <div className="hot-stations">
        {HOT_STATIONS.map((s) => (
          <button key={s.stationName} className="hot-station" onClick={() => goStation(s)}>
            <LineBadge code={s.lines[0]} small />
            {s.stationName}
          </button>
        ))}
      </div>

      <section className="section">
        <div className="cat-grid">
          {Object.entries(CATEGORY_META).map(([id, m]) => (
            <Link key={id} to={`/explore?cat=${id}`} className="cat-tile">
              <span className="cat-tile__icon" style={{ background: m.bg }}>
                {m.emoji}
              </span>
              <span>{m.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <Link to={primaryPet ? '/explore' : user ? '/pets/new' : '/signup'} className="banner">
        <div>
          <p className="banner__eyebrow">{primaryPet ? `${SIZE_LABEL[petSize]} 맞춤 추천` : 'NEW'}</p>
          <p className="banner__title">
            {primaryPet ? (
              <>
                {primaryPet.name}랑 같이 갈 수 있는
                <br />
                역세권 장소만 모아봤어요
              </>
            ) : (
              <>
                반려동물 프로필 등록하고
                <br />
                맞춤 장소 추천 받기
              </>
            )}
          </p>
          <span className="banner__cta">{primaryPet ? '지도에서 보기' : '지금 등록하기'} →</span>
        </div>
        <Mascot size={92} mood="love" className="banner__mascot" />
      </Link>

      {petSize && (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">{primaryPet.name}랑 갈 수 있어요 🐾</h2>
            <Link className="section__more" to={`/explore?sizes=${petSize}`}>
              더보기
            </Link>
          </div>
          <MiniList state={forPet} />
        </section>
      )}

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">별점 높은 인기 장소 ⭐</h2>
          <Link className="section__more" to="/explore?sort=rating">
            더보기
          </Link>
        </div>
        <MiniList state={top} />
      </section>
    </div>
  );
}

function MiniList({ state }) {
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (state.loading || !state.data)
    return (
      <div className="hscroll">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} w={150} h={190} r={20} />
        ))}
      </div>
    );
  return (
    <div className="hscroll">
      {state.data.content.map((p) => (
        <PlaceMiniCard key={p.placeId} place={p} />
      ))}
    </div>
  );
}
