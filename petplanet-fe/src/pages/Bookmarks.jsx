import { Link } from 'react-router-dom';
import { placeApi } from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import Header from '../components/common/Header.jsx';
import { EmptyState, ErrorState, Skeleton } from '../components/common/ui.jsx';
import PlaceCard from '../components/place/PlaceCard.jsx';

/** 찜한 장소 목록 (Day 7) — 하트를 다시 누르면 목록에서 빠짐 */
export default function Bookmarks() {
  const { data, error, loading, reload, setData } = useAsync(() => placeApi.myBookmarks(), []);

  const onChange = (placeId, on) => {
    if (!on) setData((list) => list.filter((p) => p.placeId !== placeId));
  };

  return (
    <div className="page">
      <Header back title="찜한 장소" />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && (
        <div className="stack">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={118} r={20} />
          ))}
        </div>
      )}
      {data && data.length === 0 && (
        <EmptyState
          title="아직 찜한 장소가 없어요"
          desc={'마음에 드는 장소의 하트를 누르면\n여기에 모아둘게요 💗'}
          action={
            <Link to="/explore" className="btn btn--primary btn--md">
              장소 둘러보기
            </Link>
          }
        />
      )}
      {data && data.length > 0 && (
        <>
          <p className="list-count">
            총 <b>{data.length}</b>곳을 찜했어요
          </p>
          <div className="stack">
            {data.map((p) => (
              <PlaceCard key={p.placeId} place={p} onBookmarkChange={onChange} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
