import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ConfirmDialog, EmptyState, Tag } from '../../components/common/ui.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { USE_MOCK } from '../../api/client.js';
import ReviewFormModal from './ReviewFormModal.jsx';
import { HOSPITAL_RESERVATIONS, HOTEL_RESERVATIONS, advanceReservation, cancelReservation, createHospitalReview } from './mockData.js';

const STATUS_LABEL = { PENDING: '승인대기', CONFIRMED: '예약확정', COMPLETED: '이용완료', CANCELLED: '취소됨' };
const STATUS_TONE = { PENDING: 'beige', CONFIRMED: 'mint', COMPLETED: 'white', CANCELLED: 'white' };
const won = (n) => `${n.toLocaleString('ko-KR')}원`;

/** S08 마이페이지 › 예약 현황 (병원 + 호텔) */
export default function MyReservations() {
  const toast = useToast();
  const { pets } = useAuth();
  const [, setVersion] = useState(0); // 목록을 다시 그리려고 쓰는 숫자
  const refresh = () => setVersion((v) => v + 1);
  const [target, setTarget] = useState(null); // 취소하려는 예약
  const [reviewTarget, setReviewTarget] = useState(null); // 리뷰를 쓰려는 병원 예약

  const rows = [
    ...HOSPITAL_RESERVATIONS.map((r) => ({
      key: `h${r.reservationId}`,
      kind: 'hospital',
      id: r.reservationId,
      hospitalId: r.hospitalId,
      petId: r.petId,
      title: `${r.hospitalName} 진료`,
      hospitalName: r.hospitalName,
      when: `${r.reservationDate.slice(0, 10)} ${r.reservationDate.slice(11, 16)}`,
      petName: r.petName,
      status: r.status,
      reviewed: !!r.reviewed,
    })),
    ...HOTEL_RESERVATIONS.map((r) => ({
      key: `t${r.reservationId}`,
      kind: 'hotel',
      id: r.reservationId,
      title: `${r.hotelName} · ${r.roomName}`,
      when: `${r.checkInDate} ~ ${r.checkOutDate} (${r.nights}박)`,
      petName: r.petName,
      status: r.status,
      price: won(r.totalPrice),
    })),
  ];

  const confirmCancel = () => {
    try {
      cancelReservation(target.kind, target.id);
      toast.show('예약을 취소했어요');
    } catch (err) {
      toast.error(err.message);
    }
    setTarget(null);
    refresh();
  };

  const submitReview = ({ rating, content }) => {
    createHospitalReview({ reservationId: reviewTarget.id, rating, content, pet: pets.find((p) => p.petId === reviewTarget.petId) });
    toast.success('리뷰를 등록했어요');
    refresh();
  };

  return (
    <>
      {rows.length === 0 ? (
        <EmptyState compact title="진행 중인 예약이 없어요" desc="동물병원 진료나 펫 호텔을 예약해 보세요." />
      ) : (
        <ul className="fe2-my-list">
          {rows.map((row) => (
            <li key={row.key} className="fe2-my-item">
              <div className="fe2-my-head">
                <b>{row.title}</b>
                <Tag tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Tag>
              </div>
              <p className="fe2-my-sub">
                {row.when} · {row.petName}
                {row.price ? ` · ${row.price}` : ''}
              </p>
              <div className="fe2-my-actions">
                {['PENDING', 'CONFIRMED'].includes(row.status) && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setTarget(row)}>
                      예약 취소
                    </Button>
                    {USE_MOCK && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          advanceReservation(row.kind, row.id);
                          refresh();
                        }}
                      >
                        (시연) 다음 상태로
                      </Button>
                    )}
                  </>
                )}
                {/* 이용완료된 병원 예약만 리뷰 작성 가능 */}
                {row.kind === 'hospital' && row.status === 'COMPLETED' &&
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
      <ConfirmDialog open={!!target} title="예약을 취소할까요?" desc={target ? `${target.title} · ${target.when}` : ''} confirmText="예약 취소" onConfirm={confirmCancel} onCancel={() => setTarget(null)} />
      <ReviewFormModal open={!!reviewTarget} onClose={() => setReviewTarget(null)} targetName={reviewTarget?.hospitalName} question="진료는 어떠셨나요?" onSubmit={submitReview} />
    </>
  );
}