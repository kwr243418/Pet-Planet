import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, EmptyState, ErrorState, Skeleton, Tag } from '../../components/common/ui.jsx';
import { LetterBadge } from '../../components/layout/Site.jsx';
import { HeartIcon } from '../../components/place/BookmarkButton.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { facilityApi } from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { regionLabel } from '../../utils/region.js';
import { reserveExploreUrl } from '../../utils/reserve.js';

const KIND_LABEL = { HOSPITAL: '동물병원', HOTEL: '펫호텔' };
/** "2026-11-28T10:30:00+09:00" → "11월 28일" (+ 시간) */
const monthDay = (iso, withTime) => {
  if (!iso) return '';
  const md = `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
  return withTime && iso.length >= 16 ? `${md} ${iso.slice(11, 16)}` : md;
};
const reserveTo = (x) => (x.kind === 'HOTEL' ? `/reservations/hotel?hotelId=${x.id}` : `/reservations/hospital?hospitalId=${x.id}`);
const infoTo = (x) => (x.kind === 'HOTEL' ? `/reservations/hotel?hotelId=${x.id}` : `/hospitals/${x.id}`);

/**
 * 마이페이지 "내 병원 · 호텔" — 다시 갈 곳을 여기서 고르고 바로 예약 화면으로
 *  · 최근 예약한 곳: hospital_reservations · hotel_reservations 를 병원/호텔별로 묶은 결과 (GET /users/me/recent-facilities)
 *  · 찜한 곳: hospital_bookmarks · hotel_bookmarks (GET /users/me/facility-bookmarks)
 */
export default function MyFacilities({ refreshKey }) {
  const toast = useToast();
  const recentQ = useAsync(() => facilityApi.recent(6), [refreshKey]);
  const favQ = useAsync(() => facilityApi.myBookmarks(), [refreshKey]);
  const [removing, setRemoving] = useState(null);

  const unbookmark = async (x) => {
    setRemoving(`${x.kind}:${x.id}`);
    try {
      await facilityApi.unbookmark(x.kind, x.id);
      toast.show('찜을 해제했어요');
      favQ.reload();
      recentQ.reload();
    } catch (err) {
      toast.error(err.message ?? '찜을 해제하지 못했어요.');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className="section two-col" id="my-facilities">
      <div className="panel card">
        <div className="panel__head">
          <h3>
            <LetterBadge letter="R" size="md" tone="mint" /> 최근 예약한 병원 · 호텔
          </h3>
          <a href="#reservations" className="text-link">
            예약 현황
          </a>
        </div>
        {recentQ.error ? (
          <ErrorState error={recentQ.error} onRetry={recentQ.reload} />
        ) : !recentQ.data ? (
          <Skeleton h={160} r={0} />
        ) : recentQ.data.length === 0 ? (
          <EmptyState compact title="아직 예약한 병원 · 호텔이 없어요" desc="한 번 예약하면 여기서 바로 다시 예약할 수 있어요." action={<Link to={reserveExploreUrl()} className="btn btn--outline btn--md">예약 가능한 곳 찾기</Link>} />
        ) : (
          <ul className="fe2-my-list">
            {recentQ.data.map((x) => (
              <li key={`${x.kind}:${x.id}`} className="fe2-my-item">
                <div className="fe2-my-head">
                  <b>
                    {x.name}
                    {x.bookmarked && (
                      <span className="fe2-fav-mark" aria-label="찜한 곳">
                        <HeartIcon size={14} />
                      </span>
                    )}
                  </b>
                  <Tag tone="white">{KIND_LABEL[x.kind]}</Tag>
                </div>
                <p className="fe2-my-sub">
                  {[x.upcoming ? `다가오는 예약 ${monthDay(x.lastAt, x.kind === 'HOSPITAL')}` : `마지막 ${x.kind === 'HOTEL' ? '체크인' : '예약'} ${monthDay(x.lastAt)}`, `총 ${x.count}회`, x.sido && regionLabel(x)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <div className="fe2-my-actions">
                  {x.reservable ? (
                    <Link to={reserveTo(x)} className="btn btn--primary btn--sm">
                      다시 예약
                    </Link>
                  ) : (
                    <span className="fe2-my-sub">지금은 온라인 예약을 받지 않아요</span>
                  )}
                  {x.kind === 'HOSPITAL' && (
                    <Link to={infoTo(x)} className="btn btn--outline btn--sm">
                      병원 정보
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel card">
        <div className="panel__head">
          <h3>
            <LetterBadge letter="R" size="md" tone="mint" /> 찜한 병원 · 호텔
          </h3>
          <Link to={reserveExploreUrl()} className="text-link">
            더 찾기
          </Link>
        </div>
        {favQ.error ? (
          <ErrorState error={favQ.error} onRetry={favQ.reload} />
        ) : !favQ.data ? (
          <Skeleton h={160} r={0} />
        ) : favQ.data.length === 0 ? (
          <EmptyState compact title="찜한 병원 · 호텔이 없어요" desc="병원 상세나 예약 화면에서 ♡ 찜하기를 누르면 여기에 모여요." action={<Link to={reserveExploreUrl()} className="btn btn--outline btn--md">예약 가능한 곳 찾기</Link>} />
        ) : (
          <ul className="fe2-my-list">
            {favQ.data.map((x) => {
              const a = x.busAccess;
              return (
                <li key={`${x.kind}:${x.id}`} className="fe2-my-item">
                  <div className="fe2-my-head">
                    <b>{x.name}</b>
                    <Tag tone="white">{KIND_LABEL[x.kind]}</Tag>
                  </div>
                  <p className="fe2-my-sub">
                    {[`찜한 날 ${monthDay(x.bookmarkedAt)}`, x.sido && regionLabel(x), a?.stopId && `${a.grade} ${a.stopName} 정류장 도보 ${a.walkMin}분`].filter(Boolean).join(' · ')}
                  </p>
                  <div className="fe2-my-actions">
                    {x.reservable ? (
                      <Link to={reserveTo(x)} className="btn btn--primary btn--sm">
                        예약하기
                      </Link>
                    ) : (
                      <Link to={infoTo(x)} className="btn btn--outline btn--sm">
                        병원 정보
                      </Link>
                    )}
                    <Button variant="outline" size="sm" loading={removing === `${x.kind}:${x.id}`} onClick={() => unbookmark(x)}>
                      찜 해제
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
