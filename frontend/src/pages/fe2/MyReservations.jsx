import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ConfirmDialog, EmptyState, ErrorState, Skeleton, Tag } from '../../components/common/ui.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { hospitalApi, hotelApi, reviewApi } from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import ReviewFormModal from './ReviewFormModal.jsx';
import { DEMO_MODE } from './demo.js';

const STATUS_LABEL = { PENDING: '승인대기', CONFIRMED: '예약확정', COMPLETED: '이용완료', CANCELLED: '취소됨' };
const STATUS_TONE = { PENDING: 'beige', CONFIRMED: 'mint', COMPLETED: 'white', CANCELLED: 'white' };
const NEXT_STATUS = { PENDING: 'CONFIRMED', CONFIRMED: 'COMPLETED' }; // 승인대기 → 예약확정 → 이용완료
const won = (n) => `${n.toLocaleString('ko-KR')}원`;
const apiOf = (kind) => (kind === 'hospital' ? hospitalApi : hotelApi);

/** 병원·호텔 예약을 한 목록으로 (가까운 날짜가 위로) */
function toRows(hospital = [], hotel = []) {
  return [
    ...hospital.map((r) => ({
      key: `h${r.reservationId}`,
      kind: 'hospital',
      id: r.reservationId,
      hospitalId: r.hospitalId,
      petId: r.petId,
      title: `${r.hospitalName} 진료`,
      hospitalName: r.hospitalName,
      sortKey: r.reservationDate,
      when: `${r.reservationDate.slice(0, 10)} ${r.reservationDate.slice(11, 16)}`,
      petName: r.petName,
      status: r.status,
      reviewed: !!r.reviewed,
    })),
    ...hotel.map((r) => ({
      key: `t${r.reservationId}`,
      kind: 'hotel',
      id: r.reservationId,
      title: `${r.hotelName} · ${r.roomName}`,
      sortKey: r.checkInDate,
      when: `${r.checkInDate} ~ ${r.checkOutDate} (${r.nights}박)`,
      petName: r.petName,
      status: r.status,
      price: won(r.totalPrice),
    })),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

/** S08 마이페이지 › 예약 현황 (병원 + 호텔) — GET /api/users/me/hospital-reservations · hotel-reservations */
export default function MyReservations({ onChanged }) {
  const toast = useToast();
  const listQ = useAsync(async () => {
    const [hospital, hotel] = await Promise.all([hospitalApi.myReservations(), hotelApi.myReservations()]);
    return toRows(hospital, hotel);
  }, []);
  const [target, setTarget] = useState(null); // 취소하려는 예약
  const [cancelling, setCancelling] = useState(false);
  const [advancing, setAdvancing] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null); // 리뷰를 쓰려는 병원 예약

  const refresh = async () => {
    await listQ.reload();
    onChanged?.(); // 마이페이지 요약 숫자 갱신
  };

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      await apiOf(target.kind).cancel(target.id);
      toast.show('예약을 취소했어요');
      await refresh();
    } catch (err) {
      toast.error(err.message ?? '예약을 취소하지 못했어요.');
    } finally {
      setCancelling(false);
      setTarget(null);
    }
  };

  // (시연) 병원·호텔이 승인하는 것처럼 상태를 한 단계 올려요 — 백엔드 petplanet.demo-mode: true 일 때 본인도 가능
  const advance = async (row) => {
    setAdvancing(row.key);
    try {
      await apiOf(row.kind).changeStatus(row.id, NEXT_STATUS[row.status]);
      await refresh();
    } catch (err) {
      toast.error(err.message ?? '상태를 바꾸지 못했어요.');
    } finally {
      setAdvancing(null);
    }
  };

  // 이용완료된 병원 예약만 리뷰 작성 가능 (서버가 한 번 더 검사: 403 REVIEW_NOT_ALLOWED / 409 DUPLICATE_REVIEW)
  const submitReview = async ({ rating, content }) => {
    await reviewApi.create({ targetType: 'HOSPITAL', targetId: reviewTarget.hospitalId, rating, content, petId: reviewTarget.petId });
    toast.success('리뷰를 등록했어요');
    await refresh();
  };

  if (listQ.error) return <ErrorState error={listQ.error} onRetry={listQ.reload} />;
  if (!listQ.data) return <Skeleton h={120} />;
  const rows = listQ.data;

  return (
    <>
      {rows.length === 0 ? (
        <EmptyState
          compact
          title="예약 내역이 없어요"
          desc="동물병원 진료나 펫 호텔을 예약해 보세요."
          action={
            <Link to="/reservations/hospital" className="btn btn--outline btn--md">
              예약하러 가기
            </Link>
          }
        />
      ) : (
        <ul className="fe2-my-list">
          {rows.map((row) => (
            <li key={row.key} className="fe2-my-item">
              <div className="fe2-my-head">
                <b>{row.title}</b>
                <Tag tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Tag>
              </div>
              <p className="fe2-my-sub">
                {row.when}
                {row.petName ? ` · ${row.petName}` : ''}
                {row.price ? ` · ${row.price}` : ''}
              </p>
              <div className="fe2-my-actions">
                {['PENDING', 'CONFIRMED'].includes(row.status) && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setTarget(row)}>
                      예약 취소
                    </Button>
                    {DEMO_MODE && (
                      <Button variant="outline" size="sm" loading={advancing === row.key} onClick={() => advance(row)}>
                        (시연) {STATUS_LABEL[NEXT_STATUS[row.status]]}로
                      </Button>
                    )}
                  </>
                )}
                {row.kind === 'hospital' &&
                  row.status === 'COMPLETED' &&
                  (row.reviewed ? (
                    <>
                      <Tag tone="white">리뷰 작성 완료</Tag>
                      <Link to={`/hospitals/${row.hospitalId}`} className="text-link">
                        병원 리뷰 보기
                      </Link>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => setReviewTarget(row)}>
                      리뷰 쓰기
                    </Button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!target}
        title="예약을 취소할까요?"
        desc={target ? `${target.title} · ${target.when}` : ''}
        confirmText="예약 취소"
        loading={cancelling}
        onConfirm={confirmCancel}
        onCancel={() => setTarget(null)}
      />
      <ReviewFormModal open={!!reviewTarget} onClose={() => setReviewTarget(null)} targetName={reviewTarget?.hospitalName} question="진료는 어떠셨나요?" onSubmit={submitReview} />
    </>
  );
}
