import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { reviewApi } from '../api/index.js';
import { USE_MOCK, resetMockDb } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import Header from '../components/common/Header.jsx';
import Mascot from '../components/common/Mascot.jsx';
import { ConfirmDialog, Stars } from '../components/common/ui.jsx';
import { useToast } from '../components/common/Toast.jsx';
import { GENDER_LABEL, SIZE_LABEL, formatDate, sizeFromWeight } from '../utils/format.js';

export default function MyPage() {
  const { user, pets, logout } = useAuth();
  const [confirmOut, setConfirmOut] = useState(false);
  const myReviews = useAsync(() => reviewApi.mine(), []);
  const navigate = useNavigate();
  const toast = useToast();

  return (
    <div className="page mypage">
      <Header title="마이페이지" />

      <div className="profile-card">
        <Mascot size={64} mood="love" />
        <div>
          <p className="profile-card__name">{user.name}님</p>
          <p className="muted">{user.email}</p>
        </div>
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">우리 아이들 🐾</h2>
          {pets.length < 5 && (
            <Link to="/pets/new" className="section__more">
              + 추가
            </Link>
          )}
        </div>
        {pets.length === 0 ? (
          <Link to="/pets/new" className="pet-empty">
            <span>🐶</span>
            <div>
              <b>반려동물을 등록해 주세요</b>
              <p className="muted">크기에 맞는 장소를 추천해 드려요</p>
            </div>
            <span className="chev">›</span>
          </Link>
        ) : (
          <div className="hscroll">
            {pets.map((p, i) => (
              <Link key={p.petId} to={`/pets/${p.petId}/edit`} className="pet-card">
                {i === 0 && <span className="pet-card__badge">대표</span>}
                <span className="pet-card__face">{p.name[0]}</span>
                <b>{p.name}</b>
                <span className="muted">{p.breed}</span>
                <span className="pet-card__meta">
                  {GENDER_LABEL[p.gender]} · {p.weight}kg · {SIZE_LABEL[sizeFromWeight(p.weight)]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <ul className="menu-list">
          <li>
            <Link to="/bookmarks">
              💗 찜한 장소 <span className="chev">›</span>
            </Link>
          </li>
          <li>
            <Link to="/reservations">
              📅 내 예약 내역 <span className="chev">›</span>
            </Link>
          </li>
          <li>
            <Link to="/shop">
              🛍️ 내 주문 내역 <span className="chev">›</span>
            </Link>
          </li>
        </ul>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">내가 쓴 장소 리뷰 ✏️</h2>
        </div>
        {myReviews.data?.length ? (
          <ul className="my-reviews">
            {myReviews.data.map((r) => (
              <li key={r.reviewId}>
                <Link to={`/places/${r.targetId}#reviews`}>
                  <b>{r.targetName}</b>
                  <Stars value={r.rating} size={12} />
                  <p>{r.content}</p>
                  <small className="muted">{formatDate(r.createdAt)}</small>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">{myReviews.loading ? '불러오는 중…' : '아직 작성한 리뷰가 없어요.'}</p>
        )}
      </section>

      <div className="mypage__foot">
        <button className="btn btn--text" onClick={() => setConfirmOut(true)}>
          로그아웃
        </button>
        {USE_MOCK && (
          <button
            className="btn btn--text"
            onClick={() => {
              resetMockDb();
              logout();
              toast.show('목 데이터를 초기화했어요');
              navigate('/login');
            }}
          >
            🧪 목 데이터 초기화
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOut}
        title="로그아웃할까요?"
        confirmText="로그아웃"
        onCancel={() => setConfirmOut(false)}
        onConfirm={() => {
          logout();
          toast.show('또 만나요! 🐾');
          navigate('/');
        }}
      />
    </div>
  );
}
