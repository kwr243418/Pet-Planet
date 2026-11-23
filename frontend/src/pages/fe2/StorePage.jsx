import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { NowStation, PageHero } from '../../components/layout/Site.jsx';
import { StationBuildings } from '../../components/illust/index.jsx';
import { Button, EmptyState, OptionGroup, Stars, Tag } from '../../components/common/ui.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { PRODUCTS, PRODUCT_CATEGORIES, addToCart, getCart } from './mockData.js';
import './fe2.css';

// 사진이 없을 때 쓰는 영문 배너 (docs/02_DESIGN_GUIDE.md)
const CATEGORY_WORD = { 1: 'FOOD', 2: 'SNACK', 3: 'CARE', 4: 'GOODS' };
const won = (n) => `${n.toLocaleString('ko-KR')}원`;

function ProductCard({ product, onAdd, onNotify }) {
  const lowStock = !product.soldOut && product.stockQuantity <= 5;
  return (
    <article className="fe2-product card">
      <div className="fe2-product__banner">
        {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="en">{CATEGORY_WORD[product.categoryId]}</span>}
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
      <Button variant="outline" block disabled={product.soldOut} onClick={() => onAdd(product)}>
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

/** S06 펫 스토어 */
export default function StorePage() {
  const toast = useToast();
  const [category, setCategory] = useState('ALL');
  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [cartKinds, setCartKinds] = useState(() => getCart().itemCount); // 담은 상품 종류 수 (장바구니는 mockData.js 에 저장돼요)

  const products = useMemo(
    () => PRODUCTS.filter((p) => (category === 'ALL' || p.categoryId === category) && p.name.includes(keyword.trim())),
    [category, keyword],
  );

  const handleAdd = (p) => {
    addToCart(p.productId); // 같은 상품을 다시 담으면 수량이 합쳐져요
    setCartKinds(getCart().itemCount);
    toast.success('장바구니에 담았어요');
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
            options={[{ value: 'ALL', label: '전체' }, ...PRODUCT_CATEGORIES.map((c) => ({ value: c.categoryId, label: c.name }))]}
          />
          <form className="fe2-search" onSubmit={search}>
            <input className="fe2-search__input" type="search" aria-label="상품 이름 검색" placeholder="상품 이름 검색" value={input} onChange={(e) => setInput(e.target.value)} />
            <Button type="submit" variant="outline">
              검색
            </Button>
          </form>
        </div>

        {products.length === 0 ? (
          <EmptyState title="조건에 맞는 상품이 없어요" desc="다른 카테고리나 검색어로 찾아보세요." />
        ) : (
          <div className="fe2-product-grid">
            {products.map((p) => (
              <ProductCard key={p.productId} product={p} onAdd={handleAdd} onNotify={notifyRestock} />
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