import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Mascot from '../components/common/Mascot.jsx';
import { Button } from '../components/common/ui.jsx';
import { Logo } from '../components/common/Header.jsx';

export const ONBOARDED_KEY = 'pp-onboarded';

const SLIDES = [
  {
    title: '지하철역 근처\n애견동반 장소 찾기',
    desc: '역 이름만 검색하면 걸어서 갈 수 있는\n카페·식당·공원을 한눈에 보여드려요',
    deco: ['🚇', '☕', '🌳', '🍽️'],
    mood: 'happy',
  },
  {
    title: '우리 아이 크기에\n딱 맞는 곳만 쏙',
    desc: '반려동물 프로필을 등록하면\n함께 갈 수 있는 곳인지 바로 알려드려요',
    deco: ['🐶', '📏', '💗', '✔️'],
    mood: 'love',
  },
  {
    title: '찜하고, 리뷰 남기고\n예약까지 한 번에',
    desc: '마음에 드는 장소는 찜해두고\n병원·호텔 예약과 쇼핑도 펫플래닛에서!',
    deco: ['💝', '⭐', '🏥', '🛍️'],
    mood: 'happy',
  },
];

/** 스플래시 + 워크스루 (CAKE U 레퍼런스 구성 참고) */
export default function Onboarding() {
  const [splash, setSplash] = useState(true);
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 1400);
    return () => clearTimeout(t);
  }, []);

  const finish = (to) => {
    localStorage.setItem(ONBOARDED_KEY, '1');
    navigate(to, { replace: true });
  };

  if (splash) {
    return (
      <div className="splash" onClick={() => setSplash(false)}>
        <div className="splash__inner">
          <Logo size={40} />
          <p className="splash__copy">우리 아이랑 지하철 타고 어디 갈까?</p>
        </div>
        <Mascot size={150} className="splash__mascot bob" />
        <div className="splash__wave" />
      </div>
    );
  }

  const s = SLIDES[idx];
  const last = idx === SLIDES.length - 1;
  return (
    <div className="walk">
      <button className="walk__skip" onClick={() => finish('/login')}>
        건너뛰기
      </button>
      <div className="walk__art" key={idx}>
        <div className="walk__blob" />
        {s.deco.map((d, i) => (
          <span key={d} className={`walk__deco walk__deco--${i}`}>
            {d}
          </span>
        ))}
        <Mascot size={170} mood={s.mood} className="walk__mascot" />
      </div>
      <div className="walk__text" key={`t${idx}`}>
        <h1 className="walk__title">{s.title}</h1>
        <p className="walk__desc">{s.desc}</p>
      </div>
      <div className="walk__dots" role="tablist" aria-label="소개 페이지">
        {SLIDES.map((_, i) => (
          <button key={i} role="tab" aria-selected={i === idx} aria-label={`${i + 1}번째 소개`} className={i === idx ? 'is-on' : ''} onClick={() => setIdx(i)} />
        ))}
      </div>
      <div className="walk__cta">
        <Button block onClick={() => (last ? finish('/login') : setIdx(idx + 1))}>
          {last ? '시작하기' : '다음'}
        </Button>
        {last && (
          <button className="walk__browse" onClick={() => finish('/')}>
            로그인 없이 둘러볼게요
          </button>
        )}
      </div>
    </div>
  );
}
