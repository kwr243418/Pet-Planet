import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ConfirmDialog, EmptyState, ErrorState, Skeleton, Tag } from '../../components/common/ui.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { orderApi, reviewApi } from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate } from '../../utils/format.js';
import ReviewFormModal from './ReviewFormModal.jsx';
import { DEMO_MODE } from './demo.js';

const ORDER_ROUTE = ['결제완료', '배송준비', '배송중', '배송완료'];
const STEP_OF = { ORDERED: 0, PREPARING: 1, SHIPPING: 2, DELIVERED: 3 };
const FLOW = ['ORDERED', 'PREPARING', 'SHIPPING', 'DELIVERED'];
const won = (n) => `${n.toLocaleString('ko-KR')}원`;

/** S08 마이페이지 › 주문 내역 — GET /api/users/me/orders, PATCH /api/orders/{id}/cancel */
export default function MyOrders({ onChanged }) {
  const toast = useToast();
  const ordersQ = useAsync(() => orderApi.mine(), []); // 최근 주문이 위로 (서버 정렬)
  const [openId, setOpenId] = useState(null); // 상세를 펼친 주문
  const [target, setTarget] = useState(null); // 취소하려는 주문
  const [cancelling, setCancelling] = useState(false);
  const [advancing, setAdvancing] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null); // 리뷰를 쓰려는 { orderId, productId, name }

  const refresh = async () => {
    await ordersQ.reload();
    onChanged?.();
  };

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      await orderApi.cancel(target.orderId); // 재고는 서버가 되돌려요
      toast.show('주문을 취소했어요');
      await refresh();
    } catch (err) {
      toast.error(err.message ?? '주문을 취소하지 못했어요.');
    } finally {
      setCancelling(false);
      setTarget(null);
    }
  };

  // (시연) 배송 단계를 한 단계 올려요 — 백엔드 petplanet.demo-mode: true 일 때 본인도 가능
  const advance = async (o) => {
    setAdvancing(o.orderId);
    try {
      await orderApi.changeStatus(o.orderId, FLOW[STEP_OF[o.status] + 1]);
      await refresh();
    } catch (err) {
      toast.error(err.message ?? '배송 단계를 바꾸지 못했어요.');
    } finally {
      setAdvancing(null);
    }
  };

  // 배송완료된 주문의 상품만 리뷰 작성 가능 (서버가 한 번 더 검사)
  const submitReview = async ({ rating, content }) => {
    await reviewApi.create({ targetType: 'PRODUCT', targetId: reviewTarget.productId, rating, content });
    toast.success('리뷰를 등록했어요');
    await refresh();
  };

  if (ordersQ.error) return <ErrorState error={ordersQ.error} onRetry={ordersQ.reload} />;
  if (!ordersQ.data) return <Skeleton h={120} />;
  const orders = ordersQ.data;

  if (orders.length === 0) {
    return (
      <EmptyState
        compact
        title="주문 내역이 없어요"
        desc="펫 스토어에서 외출 준비물을 담아 보세요."
        action={
          <Link to="/shop" className="btn btn--outline btn--md">
            펫 스토어로 가기
          </Link>
        }
      />
    );
  }

  return (
    <>
      <ul className="fe2-my-list">
        {orders.map((o) => {
          const firstName = o.firstItemName ?? o.items[0]?.name ?? '상품';
          const cancelled = o.status === 'CANCELLED';
          const cancellable = ['ORDERED', 'PREPARING'].includes(o.status);
          const delivered = o.status === 'DELIVERED';
          return (
            <li key={o.orderId} className="fe2-my-item">
              <div className="fe2-my-head">
                <b>
                  주문 {o.orderId} · {firstName}
                  {o.itemCount > 1 ? ` 외 ${o.itemCount - 1}건` : ''}
                </b>
                <b>{won(o.totalAmount)}</b>
              </div>
              <p className="fe2-my-sub">{formatDate(o.createdAt)}</p>
              {cancelled ? (
                <div>
                  <Tag tone="white">주문 취소됨</Tag>
                </div>
              ) : (
                <ol className="fe2-route" aria-label="배송 단계 노선">
                  {ORDER_ROUTE.map((s, i) => (
                    <li key={s} className={i === STEP_OF[o.status] ? 'is-on' : ''}>
                      {s}
                    </li>
                  ))}
                </ol>
              )}
              {delivered && openId !== o.orderId && <p className="fe2-my-sub">배송이 완료됐어요. [주문 상세]에서 상품별로 리뷰를 쓸 수 있어요.</p>}
              {openId === o.orderId && (
                <ul className="fe2-my-detail">
                  {o.items.map((i) => (
                    <li key={i.productId} className="fe2-my-line">
                      <span>
                        {i.name} × {i.quantity} · {won(i.lineTotal ?? i.price * i.quantity)}
                      </span>
                      {/* 배송완료된 주문의 상품만 리뷰 작성 가능 */}
                      {delivered &&
                        (i.reviewed ? (
                          <Tag tone="white">리뷰 작성 완료</Tag>
                        ) : (
                          <Button size="sm" onClick={() => setReviewTarget({ orderId: o.orderId, productId: i.productId, name: i.name })}>
                            리뷰 쓰기
                          </Button>
                        ))}
                    </li>
                  ))}
                  <li>배송비 {won(o.shippingFee)}</li>
                  <li>
                    {o.receiverName} · {o.receiverPhone}
                  </li>
                  <li>{o.address}</li>
                </ul>
              )}
              <div className="fe2-my-actions">
                <Button variant="outline" size="sm" aria-expanded={openId === o.orderId} onClick={() => setOpenId(openId === o.orderId ? null : o.orderId)}>
                  {openId === o.orderId ? '상세 닫기' : '주문 상세'}
                </Button>
                {cancellable && (
                  <Button variant="outline" size="sm" onClick={() => setTarget(o)}>
                    주문 취소
                  </Button>
                )}
                {DEMO_MODE && !cancelled && o.status !== 'DELIVERED' && (
                  <Button variant="outline" size="sm" loading={advancing === o.orderId} onClick={() => advance(o)}>
                    (시연) 배송 단계 올리기
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog open={!!target} title="주문을 취소할까요?" desc={target ? `주문 ${target.orderId} · ${won(target.totalAmount)} — 재고가 되돌려져요.` : ''} confirmText="주문 취소" loading={cancelling} onConfirm={confirmCancel} onCancel={() => setTarget(null)} />
      <ReviewFormModal open={!!reviewTarget} onClose={() => setReviewTarget(null)} targetName={reviewTarget?.name} question="상품은 어떠셨나요?" onSubmit={submitReview} />
    </>
  );
}