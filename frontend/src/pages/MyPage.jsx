import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { placeApi, reviewApi, userApi } from '../api/index.js';
import { USE_MOCK, resetMockDb } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { LetterBadge, NowStation, PageHero } from '../components/layout/Site.jsx';
import { StationBuildings, TinyDog } from '../components/illust/index.jsx';
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, Modal, OptionGroup, Skeleton, Stars, Tag } from '../components/common/ui.jsx';
import { useToast } from '../components/common/Toast.jsx';
import { HeartIcon } from '../components/place/BookmarkButton.jsx';
import { ReviewModal } from '../components/place/Reviews.jsx';
import { categoryMeta } from '../utils/categories.js';
import { GENDER_LABEL, ROLE_LABEL, formatKm } from '../utils/format.js';
import { lineName, stationBase } from '../utils/subway.js';
import { validateName } from '../utils/validators.js';
import MyReservations from './fe2/MyReservations.jsx';
import MyOrders from './fe2/MyOrders.jsx';

const MY_STEPS = ['회원가입', '반려동물 등록', '마이페이지', '통합 리뷰'];

/** S08 마이페이지 — 환승센터 */
export default function MyPage() {
  const { user, pets } = useAuth();
  const summary = useAsync(() => userApi.summary(), []);
  const [editOpen, setEditOpen] = useState(false);
  const s = summary.data;

  const tiles = [
    { key: 'R', label: '예약', value: s?.reservationCount, href: '#reservations', tone: 'mint-soft' },
    { key: 'S', label: '주문', value: s?.orderCount, href: '#orders', tone: 'beige' },
    { key: 'M', label: '리뷰', value: s?.reviewCount, href: '#reviews', tone: 'beige-soft' },
    { key: 'E', label: '찜한 장소', value: s?.bookmarkCount, href: '#bookmarks', tone: 'mint' },
  ];

  return (
    <>
      <PageHero
        en={
          <>
            MY
            <br />
            STATION
          </>
        }
        compact
        art={<StationBuildings />}
      >
        <h1 className="page-hero__title my-title">
          {user.name} 님의 환승센터 <Tag tone="white">{ROLE_LABEL[user.role]}</Tag>
        </h1>
        <p className="page-hero__desc">
          {user.email} ·{' '}
          <button className="text-link" onClick={() => setEditOpen(true)}>
            회원정보 수정
          </button>
        </p>
      </PageHero>
      <NowStation steps={MY_STEPS} current={2} />

      <div className="container mypage">
        {/* 활동 요약 */}
        <section className="section">
          <div className="summary-tiles">
            {tiles.map((t) => (
              <a key={t.key} href={t.href} className={`summary-tile summary-tile--${t.tone}`}>
                <span className="summary-tile__label">
                  <LetterBadge letter={t.key} size="sm" /> {t.label}
                </span>
                <b className="summary-tile__value en">{summary.loading ? '·' : t.value ?? '–'}</b>
              </a>
            ))}
          </div>
        </section>

        {/* 내 반려동물 */}
        <section className="section">
          <h2 className="section-title section-head">내 반려동물</h2>
          <div className="pet-cards">
            {pets.map((p) => (
              <Link key={p.petId} to={`/pets/${p.petId}/edit`} className="pet-card">
                <span className="pet-card__photo">{p.photoUrl ? <img src={p.photoUrl} alt="" /> : <TinyDog size={64} />}</span>
                <span className="pet-card__info">
                  <b>{p.name}</b>
                  <small>
                    {p.breed} · {GENDER_LABEL[p.gender]} · 중성화 {p.neutered ? '완료' : '안 함'}
                  </small>
                </span>
                <b className="pet-card__kg en">{p.weight}kg</b>
              </Link>
            ))}
            {pets.length < 5 && (
              <Link to="/pets/new" className="pet-card pet-card--add">
                + 반려동물 추가
              </Link>
            )}
          </div>
        </section>

        {/* 예약 · 주문 (FE2 연결 영역) */}
        <section className="section two-col">
          <div className="panel card" id="reservations">
            <div className="panel__head">
              <h3>
                <LetterBadge letter="R" size="md" tone="mint" /> 예약 현황
              </h3>
              <Link to="/reservations/hospital" className="text-link">
                새 예약
              </Link>
            </div>
            {/* FE2: hospital_reservations · hotel_reservations 목록, 상태 칩(승인대기/예약확정), [취소]/[입실 안내] */}
            <MyReservations />
          </div>
          <div className="panel card" id="orders">
            <div className="panel__head">
              <h3>
                <LetterBadge letter="S" size="md" tone="mint" /> 주문 내역
              </h3>
              <Link to="/shop" className="text-link">
                스토어
              </Link>
            </div>
            {/* FE2: orders 목록, 배송 단계 노선(결제완료→배송준비→배송중→배송완료), [주문 상세]/[주문 취소] */}
            <MyOrders />
          </div>
        </section>

        <section className="section two-col">
          <MyReviews />
          <MyBookmarks onChange={summary.reload} />
        </section>

        <Withdraw />
        {USE_MOCK && <MockReset />}
      </div>
      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
    </>
  );
}

function MyReviews() {
  const [type, setType] = useState('ALL');
  const list = useAsync(() => reviewApi.mine(type === 'ALL' ? undefined : type), [type]);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();
  return (
    <div className="panel card" id="reviews">
      <div className="panel__head">
        <h3>
          <LetterBadge letter="M" size="md" tone="mint" /> 작성한 리뷰
        </h3>
        <OptionGroup
          size="sm"
          label="리뷰 종류"
          value={type}
          onChange={setType}
          options={[
            { value: 'ALL', label: '전체' },
            { value: 'PLACE', label: '장소' },
            { value: 'PRODUCT', label: '상품' },
          ]}
        />
      </div>
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Skeleton h={90} r={20} />}
      {list.data?.length === 0 && <EmptyState compact title="작성한 리뷰가 없어요" desc="다녀온 장소나 산 상품의 후기를 남겨 보세요." />}
      <ul className="mini-list">
        {list.data?.map((r) => (
          <li key={r.reviewId} className="mini-row mini-row--review">
            <div className="mini-row__top">
              <Tag tone="mint">{r.targetType === 'PLACE' ? '장소' : '상품'}</Tag>
              {r.targetType === 'PLACE' ? (
                <Link to={`/places/${r.targetId}#reviews`} className="mini-row__title">
                  {r.targetName}
                </Link>
              ) : (
                <span className="mini-row__title">{r.targetName ?? '상품'}</span>
              )}
              <Stars value={r.rating} size={14} />
            </div>
            <p className="mini-row__text">{r.content}</p>
            <div className="mini-row__actions">
              {r.targetType === 'PLACE' && (
                <button className="btn btn--text" onClick={() => setEditing(r)}>
                  수정
                </button>
              )}
              <button className="btn btn--text" onClick={() => setDeleting(r)}>
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>
      <ReviewModal open={!!editing} editing={editing} targetId={editing?.targetId} targetName={editing?.targetName} onClose={() => setEditing(null)} onSaved={list.reload} />
      <ConfirmDialog
        open={!!deleting}
        title="리뷰를 삭제할까요?"
        desc="삭제한 리뷰는 되돌릴 수 없어요."
        confirmText="삭제"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await reviewApi.remove(deleting.reviewId);
            toast.show('리뷰를 삭제했어요');
            setDeleting(null);
            list.reload();
          } catch (e) {
            toast.error(e.message);
          }
        }}
      />
    </div>
  );
}

function MyBookmarks({ onChange }) {
  const list = useAsync(() => placeApi.myBookmarks(), []);
  const toast = useToast();
  const remove = async (p) => {
    const prev = list.data;
    list.setData((l) => l.filter((x) => x.placeId !== p.placeId));
    try {
      await placeApi.unbookmark(p.placeId);
      toast.show('찜을 해제했어요');
      onChange?.();
    } catch (e) {
      list.setData(prev);
      toast.error(e.message);
    }
  };
  return (
    <div className="panel card" id="bookmarks">
      <div className="panel__head">
        <h3>
          <LetterBadge letter="E" size="md" tone="mint" /> 찜한 장소
        </h3>
        <Link to="/explore" className="text-link">
          더 찾기
        </Link>
      </div>
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Skeleton h={90} r={20} />}
      {list.data?.length === 0 && <EmptyState compact title="찜한 장소가 없어요" desc="역 주변 장소를 둘러보고 하트를 눌러 보세요." />}
      <ul className="mini-list">
        {list.data?.map((p) => {
          const st = p.nearestStation;
          const meta = categoryMeta(p.categoryId);
          return (
            <li key={p.placeId} className="mini-row mini-row--place">
              <span className={`mini-row__cat cat-banner--${meta.tone} en`}>{meta.en}</span>
              <Link to={`/places/${p.placeId}`} className="mini-row__main">
                <b>{p.name}</b>
                <small className="muted">
                  {p.categoryName}
                  {st && ` · ${lineName(st.lines[0])} ${stationBase(st.stationName)} ${formatKm(st.distanceKm)}`}
                </small>
              </Link>
              <button className="heart-btn is-on" aria-label={`${p.name} 찜 해제`} onClick={() => remove(p)}>
                <HeartIcon />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EditProfileModal({ open, onClose }) {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const save = async () => {
    const msg = validateName(name);
    setError(msg);
    if (msg) return;
    setSaving(true);
    try {
      refreshUser(await userApi.updateMe({ name: name.trim() }));
      toast.show('회원정보를 수정했어요');
      onClose();
    } catch (e) {
      setError(e.fieldMap?.name ?? e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="회원정보 수정"
      width={460}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={save} loading={saving}>
            저장
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <Field label="이메일 (아이디)" value={user.email} disabled hint="이메일은 바꿀 수 없어요." />
        <Field label="이름" value={name} onChange={(e) => setName(e.target.value)} error={error} />
        <Field label="회원 유형" value={ROLE_LABEL[user.role]} disabled />
      </div>
    </Modal>
  );
}

function Withdraw() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  return (
    <section className="withdraw">
      <button className="text-link" onClick={() => setOpen(true)}>
        회원 탈퇴
      </button>
      <p className="muted">진행 중인 예약(승인대기 · 예약확정)이나 배송 전 주문이 있으면 탈퇴할 수 없어요. 탈퇴하면 찜 목록과 장바구니도 함께 삭제돼요.</p>
      <ConfirmDialog
        open={open}
        title="정말 탈퇴할까요?"
        desc="찜 목록과 장바구니가 삭제되고 되돌릴 수 없어요."
        confirmText="탈퇴하기"
        loading={busy}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await userApi.withdraw();
            logout();
            toast.show('탈퇴가 완료됐어요. 그동안 함께해 주셔서 고마워요');
            navigate('/', { replace: true });
          } catch (e) {
            toast.error(e.message);
            setOpen(false);
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}

function MockReset() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <p className="mock-reset">
      <button
        className="btn btn--text"
        onClick={() => {
          resetMockDb();
          logout();
          navigate('/login');
        }}
      >
        목 데이터 초기화 (개발용)
      </button>
    </p>
  );
}
