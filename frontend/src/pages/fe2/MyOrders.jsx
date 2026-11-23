import { useState } from 'react';
import { Button, ConfirmDialog, EmptyState, Tag } from '../../components/common/ui.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { USE_MOCK } from '../../api/client.js';
import { formatDate } from '../../utils/format.js';
import ReviewFormModal from './ReviewFormModal.jsx';
import { ORDERS, advanceOrder, cancelOrder, createProductReview } from './mockData.js';

const ORDER_ROUTE = ['결제완료', '배송준비', '배송중', '배송완료'];
const STEP_OF = { ORDERED: 0, PREPARING: 1, SHIPPING: 2, DELIVERED: 3 };
const won = (n) => `${n.toLocaleString('ko-KR')}원`;

/** S08 마이페이지 › 주문 내역 */
export default function MyOrders() {
  const toast = useToast();
  const [, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  const [openId, setOpenId] = useState(null); // 상세를 펼친 주문
  const [target, setTarget] = useState(null); // 취소하려는 주문
  const [reviewTarget, setReviewTarget] = useState(null); // 리뷰를 쓰려는 { orderId, productId, name }

  const orders = [...ORDERS].reverse(); // 최근 주문이 위로

  const confirmCancel = () => {
    try {
      cancelOrder(target.orderId);
      toast.show('주문을 취소했어요');
    } catch (err) {
      toast.error(err.message);
    }
    setTarget(null);
    refresh();
  };

  const submitReview = ({ rating, content }) => {
    createProductReview({ orderId: reviewTarget.orderId, productId: reviewTarget.productId, rating, content });
    toast.success('리뷰를 등록했어요');
    refresh();
  };

  if (orders.length === 0) {
    return <EmptyState compact title="주문 내역이 없어요" desc="펫 스토어에서 외출 준비물을 담아 보세요." />;
  }

  return (
    <>
      <ul className="fe2-my-list">
        {orders.map((o) => {
          const first = o.items[0];
          const cancelled = o.status === 'CANCELLED';
          const cancellable = ['ORDERED', 'PREPARING'].includes(o.status);
          const delivered = o.status === 'DELIVERED';
          return (
            <li key={o.orderId} className="fe2-my-item">
              <div className="fe2-my-head">
                <b>
                  주문 {o.orderId} · {first.name}
                  {o.items.length > 1 ? ` 외 ${o.items.length - 1}건` : ''}
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
                        {i.name} × {i.quantity} · {won(i.price * i.quantity)}
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
                {USE_MOCK && !cancelled && o.status !== 'DELIVERED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      advanceOrder(o.orderId);
                      refresh();
                    }}
                  >
                    (시연) 배송 단계 올리기
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog open={!!target} title="주문을 취소할까요?" desc={target ? `주문 ${target.orderId} · ${won(target.totalAmount)} — 재고가 되돌려져요.` : ''} confirmText="주문 취소" onConfirm={confirmCancel} onCancel={() => setTarget(null)} />
      <ReviewFormModal open={!!reviewTarget} onClose={() => setReviewTarget(null)} targetName={reviewTarget?.name} question="상품은 어떠셨나요?" onSubmit={submitReview} />
    </>
  );
}