import { useState } from 'react';
import { Link } from 'react-router-dom';
import { NowStation, PageHero } from '../../components/layout/Site.jsx';
import { StationBuildings } from '../../components/illust/index.jsx';
import { Button, EmptyState, ErrorState, Field, PageLoader, Tag } from '../../components/common/ui.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { cartApi, orderApi } from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { focusFirstInvalid, usePageTitle } from '../../hooks/usePage.js';
import './fe2.css';

const CATEGORY_WORD = { 1: 'FOOD', 2: 'SNACK', 3: 'CARE', 4: 'GOODS' };
const won = (n) => `${n.toLocaleString('ko-KR')}원`;
const PHONE_RE = /^01[016789]-?\d{3,4}-?\d{4}$/;
const ORDER_ROUTE = ['결제완료', '배송준비', '배송중', '배송완료'];

/** 배송 노선: 결제완료 → 배송준비 → 배송중 → 배송완료 */
function DeliveryRoute({ current = 0 }) {
  return (
    <ol className="fe2-route" aria-label="배송 단계 노선">
      {ORDER_ROUTE.map((s, i) => (
        <li key={s} className={i === current ? 'is-on' : ''}>
          {s}
        </li>
      ))}
    </ol>
  );
}

/** S07 장바구니 · 주문서 — GET /api/cart, PATCH·DELETE /api/cart/items/{id}, POST /api/orders (트랜잭션) */
export default function CartOrderPage() {
  usePageTitle('장바구니 · 주문서');
  const toast = useToast();
  const { user } = useAuth();
  const cartQ = useAsync(() => cartApi.get(), []);
  const cart = cartQ.data;
  const [form, setForm] = useState(() => ({ receiverName: user?.name ?? '', receiverPhone: '', address: '' }));
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(null); // 바꾸는 중인 cartId
  const [paying, setPaying] = useState(false);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const changeQty = async (item, delta) => {
    const next = item.quantity + delta;
    if (next < 1 || busy) return;
    if (next > item.stockQuantity) {
      toast.show(`재고는 ${item.stockQuantity}개까지예요`);
      return;
    }
    setBusy(item.cartId);
    try {
      cartQ.setData(await cartApi.update(item.cartId, next));
    } catch (err) {
      toast.error(err.message ?? '수량을 바꾸지 못했어요.');
      cartQ.reload();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (item) => {
    setBusy(item.cartId);
    try {
      await cartApi.remove(item.cartId);
      await cartQ.reload();
      toast.show('장바구니에서 뺐어요');
    } catch (err) {
      toast.error(err.message ?? '장바구니에서 빼지 못했어요.');
    } finally {
      setBusy(null);
    }
  };

  const findAddress = () => {
    // 실제 주소 검색은 API 연결 때 붙여요. 지금은 예시 주소를 채워 줘요.
    setForm((f) => ({ ...f, address: '서울 마포구 양화로 00 (예시 주소)' }));
    toast.show('예시 주소를 넣었어요');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (paying) return;
    const next = {};
    if (form.receiverName.trim().length < 2) next.receiverName = '받는 분 이름을 2자 이상 입력해 주세요.';
    if (!PHONE_RE.test(form.receiverPhone.trim())) next.receiverPhone = '연락처를 010-0000-0000 모양으로 입력해 주세요.';
    if (!form.address.trim()) next.address = '배송 주소를 입력해 주세요.';
    setErrors(next);
    if (Object.keys(next).length) {
      focusFirstInvalid();
      return;
    }
    setPaying(true);
    try {
      setDone(await orderApi.create({ receiverName: form.receiverName.trim(), receiverPhone: form.receiverPhone.trim(), address: form.address.trim() }));
    } catch (err) {
      if (err.fieldErrors?.length) {
        setErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.field, f.message])));
        focusFirstInvalid();
      }
      toast.error(err.message ?? '주문하지 못했어요.'); // 재고 부족이면 주문 전체 취소, 장바구니는 그대로
      cartQ.reload();
    } finally {
      setPaying(false);
    }
  };

  const hero = (
    <>
      <PageHero line="S" en="ORDER" compact title="장바구니 · 주문서" desc="담은 상품을 확인하고 배송 정보를 입력해 가상 결제해요." art={<StationBuildings />} />
      <NowStation steps={['상품 목록', '장바구니', '주문서', '주문 완료']} current={done ? 3 : 2} />
    </>
  );

  if (done) {
    return (
      <>
        {hero}
        <div className="container fe2">
          <section className="card fe2-ticket">
            <h2 className="fe2-step-title">주문이 완료됐어요</h2>
            <dl className="fe2-info">
              <dt>주문번호</dt>
              <dd>{done.orderId}</dd>
              <dt>상품</dt>
              <dd>
                {done.items.map((i) => (
                  <span key={i.productId} className="fe2-order-item">
                    {i.name} × {i.quantity}
                  </span>
                ))}
              </dd>
              <dt>받는 분</dt>
              <dd>
                {done.receiverName} · {done.receiverPhone}
              </dd>
              <dt>배송지</dt>
              <dd>{done.address}</dd>
              <dt>결제 금액</dt>
              <dd>{won(done.totalAmount)} (배송비 {won(done.shippingFee)} 포함)</dd>
            </dl>
            <DeliveryRoute current={0} />
            <p className="fe2-note">배송이 시작되기 전까지는 마이페이지에서 주문을 취소할 수 있어요.</p>
            <Link to="/mypage" className="btn btn--primary btn--lg btn--block">
              마이페이지에서 보기
            </Link>
            <Link to="/shop" className="btn btn--outline btn--md btn--block">
              쇼핑 계속하기
            </Link>
          </section>
        </div>
      </>
    );
  }

  if (cartQ.error && !cart) {
    return (
      <>
        {hero}
        <div className="container fe2">
          <ErrorState error={cartQ.error} onRetry={cartQ.reload} />
        </div>
      </>
    );
  }

  if (!cart) {
    return (
      <>
        {hero}
        <PageLoader />
      </>
    );
  }

  if (cart.items.length === 0) {
    return (
      <>
        {hero}
        <div className="container fe2">
          <EmptyState title="장바구니가 비었어요" desc="펫 스토어에서 필요한 상품을 담아 보세요." action={<Link to="/shop" className="btn btn--primary btn--md">펫 스토어로 가기</Link>} />
        </div>
      </>
    );
  }

  return (
    <>
      {hero}
      <div className="container fe2">
        <div className="fe2-cart">
          {/* 장바구니 목록 */}
          <section aria-label="장바구니 목록">
            <ul className="fe2-cart__list">
              {cart.items.map((item) => (
                <li key={item.cartId} className="fe2-line card">
                  <div className="fe2-line__banner">
                    <span className="en">{CATEGORY_WORD[item.categoryId]}</span>
                  </div>
                  <div className="fe2-line__body">
                    <div>
                      <Tag>{item.categoryName}</Tag>
                    </div>
                    <b>{item.name}</b>
                    <span className="fe2-note">
                      단가 {won(item.price)}
                      {item.stockQuantity <= 5 ? ` · 재고 ${item.stockQuantity}개 남음` : ''}
                    </span>
                    <div className="fe2-qty" role="group" aria-label={`${item.name} 수량`}>
                      <button type="button" aria-label="수량 줄이기" disabled={item.quantity <= 1 || busy === item.cartId} onClick={() => changeQty(item, -1)}>
                        −
                      </button>
                      <output aria-live="polite">{item.quantity}</output>
                      <button type="button" aria-label="수량 늘리기" disabled={busy === item.cartId} onClick={() => changeQty(item, 1)}>
                        +
                      </button>
                    </div>
                  </div>
                  <div className="fe2-line__side">
                    <b>{won(item.lineTotal)}</b>
                    <Button variant="outline" size="sm" loading={busy === item.cartId} onClick={() => remove(item)}>
                      빼기
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Link to="/shop" className="text-link">
              ← 쇼핑 계속하기
            </Link>
          </section>

          {/* 배송 정보 + 결제 금액 */}
          <form className="fe2-checkout" onSubmit={submit} noValidate>
            <section className="card fe2-section">
              <h2 className="fe2-step-title">배송 정보</h2>
              <Field label="받는 분" placeholder="이름" value={form.receiverName} onChange={setField('receiverName')} error={errors.receiverName} />
              <Field label="연락처" placeholder="010-0000-0000" inputMode="tel" value={form.receiverPhone} onChange={setField('receiverPhone')} error={errors.receiverPhone} />
              <Field
                label="주소"
                placeholder="배송 주소"
                value={form.address}
                onChange={setField('address')}
                error={errors.address}
                right={
                  <Button type="button" variant="outline" onClick={findAddress}>
                    주소 찾기
                  </Button>
                }
              />
            </section>

            <section className="card fe2-section">
              <h2 className="fe2-step-title">결제 금액</h2>
              <dl className="fe2-sum">
                <dt>상품 금액</dt>
                <dd>{won(cart.productAmount)}</dd>
                <dt>배송비</dt>
                <dd>{won(cart.shippingFee)}</dd>
              </dl>
              <p className="fe2-total">
                <span>총 결제 금액</span>
                <b className="en">{won(cart.totalAmount)}</b>
              </p>
              <Button type="submit" size="lg" block loading={paying}>
                가상 결제하기
              </Button>
              <p className="fe2-note">재고가 부족하면 주문 전체가 취소되고, 장바구니는 그대로 남아요.</p>
            </section>
          </form>
        </div>
      </div>
    </>
  );
}