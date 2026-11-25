import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { NowStation, PageHero } from '../../components/layout/Site.jsx';
import { StationBuildings } from '../../components/illust/index.jsx';
import { Button, EmptyState, ErrorState, OptionGroup, Skeleton, Stars, Tag } from '../../components/common/ui.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { cartApi, shopApi } from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { usePageTitle } from '../../hooks/usePage.js';
import { productImage } from '../../utils/productImages.js';
import './fe2.css';

// 사진이 없을 때 쓰는 영문 배너 (docs/02_DESIGN_GUIDE.md)
const CATEGORY_WORD = { 1: 'FOOD', 2: 'SNACK', 3: 'CARE', 4: 'GOODS' };
const won = (n) => `${n.toLocaleString('ko-KR')}원`;

function ProductCard({ product, onAdd, onNotify, adding }) {
  const lowStock = !product.soldOut && product.stockQuantity <= 5;
  const image = productImage(product);
  return (
    <article className="fe2-product card">
      <div className={`fe2-product__banner ${image.engraving ? 'is-engraving' : ''}`}>
        <img src={image.src} alt="" loading="lazy" />
        {image.engraving && <span className="en">{CATEGORY_WORD[product.categoryId]}</span>}
        {product.soldOut && <span className="fe2-product__soldout">품절</span>}
      </div>
      <div>
        <Tag>{product.categoryName}</Tag>
      </div>
      <h3 className="fe2-product__name">{product.name}</h3>
      <div className="fe2-product__rating">
        <Stars value={product.avgRating} size={14} />
        <span>
          {product.avgRating.toFixed(1)} ({product.reviewCount})
        </span>
      </div>
      <p className="fe2-product__price">{won(product.price)}</p>
      {lowStock && <p className="fe2-product__stock">재고 {product.stockQuantity}개 남음</p>}
      <Button variant="outline" block disabled={product.soldOut} loading={adding} onClick={() => onAdd(product)}>
        {product.soldOut ? '품절' : '장바구니 담기'}
      </Button>
      {product.soldOut && (
        <Button variant="outline" size="sm" block onClick={() => onNotify(product)}>
          재입고 알림 받기
        </Button>
      )}
    </article>
  );
}

const SORT_OPTIONS = [
  { value: 'latest', label: '최신순' },
  { value: 'rating', label: '평점순' },
  { value: 'price_asc', label: '낮은 가격순' },
  { value: 'price_desc', label: '높은 가격순' },
];

/** S06 펫 스토어 — GET /api/product-categories, /api/products, POST /api/cart/items */
export default function StorePage() {
  usePageTitle('펫 스토어');
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn } = useAuth();
  const [category, setCategory] = useState('ALL');
  const [sort, setSort] = useState('latest');
  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [adding, setAdding] = useState(null);

  const categories = useAsync(() => shopApi.categories(), [], { initial: [] });
  const list = useAsync(
    () => shopApi.products({ categoryId: category === 'ALL' ? undefined : category, keyword: keyword.trim() || undefined, sort, size: 50 }),
    [category, keyword, sort],
  );
  // 담은 상품 종류 수 — 로그인했을 때만 서버 장바구니를 읽어요
  const cart = useAsync(() => cartApi.get(), [isLoggedIn], { enabled: isLoggedIn });
  const cartKinds = isLoggedIn ? cart.data?.itemCount ?? 0 : 0;
  const products = list.data?.content ?? [];

  const handleAdd = async (p) => {
    if (!isLoggedIn) {
      toast.show('로그인하면 장바구니에 담을 수 있어요');
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    setAdding(p.productId);
    try {
      const next = await cartApi.add(p.productId, 1); // 같은 상품을 다시 담으면 수량이 합쳐져요
      cart.setData(next);
      toast.success('장바구니에 담았어요');
    } catch (err) {
      toast.error(err.message ?? '장바구니에 담지 못했어요.');
      if (err.code === 'OUT_OF_STOCK') list.reload();
    } finally {
      setAdding(null);
    }
  };

  const notifyRestock = () => toast.show('재입고되면 알려드릴게요');

  const search = (e) => {
    e.preventDefault();
    setKeyword(input);
  };

  return (
    <>
      <PageHero line="S" en={'PET\nMART'} title={'외출 준비물,\n여기서 한 번에'} desc={'사료 · 간식 · 위생용품 · 외출 용품을 장바구니에 담아 주문하고,\n배송 단계를 노선처럼 확인하세요.'} art={<StationBuildings />} />
      <NowStation steps={['상품 목록', '장바구니', '주문서', '주문 완료']} current={0} />
      <div className="container fe2">
        <div className="fe2-toolbar">
          <OptionGroup
            size="lg"
            label="상품 카테고리"
            value={category}
            onChange={setCategory}
            options={[{ value: 'ALL', label: '전체' }, ...(categories.data ?? []).map((c) => ({ value: c.categoryId, label: c.name }))]}
          />
          <OptionGroup label="정렬" value={sort} onChange={setSort} options={SORT_OPTIONS} />
          <form className="fe2-search" onSubmit={search}>
            <input className="fe2-search__input" type="search" aria-label="상품 이름 검색" placeholder="상품 이름 검색" value={input} onChange={(e) => setInput(e.target.value)} />
            <Button type="submit" variant="outline">
              검색
            </Button>
          </form>
        </div>

        {list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : list.loading && !list.data ? (
          <div className="fe2-product-grid" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} h={300} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState title="조건에 맞는 상품이 없어요" desc="다른 카테고리나 검색어로 찾아보세요." />
        ) : (
          <div className="fe2-product-grid">
            {products.map((p) => (
              <ProductCard key={p.productId} product={p} onAdd={handleAdd} onNotify={notifyRestock} adding={adding === p.productId} />
            ))}
          </div>
        )}

        <div className="fe2-cartbar" role="region" aria-label="장바구니 요약">
          <p>
            담은 상품 <b>{cartKinds}</b>종<span>같은 상품을 다시 담으면 수량이 합쳐져요</span>
          </p>
          <Link to="/cart" className="btn btn--primary btn--md">
            장바구니로 →
          </Link>
        </div>
      </div>
    </>
  );
}