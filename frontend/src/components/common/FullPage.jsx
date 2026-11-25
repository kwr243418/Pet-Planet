import { useEffect, useRef, useState } from 'react';

/**
 * 한 화면씩 넘기는 소개형 페이지 (홈 · 첫 화면)
 * - 각 구역(.fp)이 화면 높이를 꽉 채우고, 스크롤하면 구역 시작점에 가볍게 맞춰져요
 * - 구역 아래 "아래로" 버튼, 첫 화면은 몇 초 뒤 자동으로 다음 구역으로 (손대면 취소)
 */
export function useFullPage() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('fp-snap');
    return () => root.classList.remove('fp-snap');
  }, []);
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function scrollToNext(from) {
  let next = from?.closest('.fp')?.nextElementSibling;
  while (next && !next.classList.contains('fp')) next = next.nextElementSibling;
  next?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

/** 구역 아래 "아래로" 버튼 · auto(ms)를 주면 그 시간 뒤 자동으로 내려가요 */
export function NextCue({ label = '아래로', auto = 0, tone = 'night' }) {
  const ref = useRef(null);
  const [counting, setCounting] = useState(false);

  useEffect(() => {
    if (!auto || reducedMotion() || window.scrollY > 40) return undefined;
    setCounting(true);
    const timer = setTimeout(() => {
      stop();
      if (window.scrollY <= 40) scrollToNext(ref.current);
    }, auto);
    // 사용자가 손대면(휠 · 터치 · 키 · 클릭 · 직접 스크롤) 자동 이동 취소
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    const onScroll = () => window.scrollY > 40 && stop();
    function stop() {
      clearTimeout(timer);
      setCounting(false);
      events.forEach((e) => window.removeEventListener(e, stop));
      window.removeEventListener('scroll', onScroll);
    }
    events.forEach((e) => window.addEventListener(e, stop, { passive: true }));
    window.addEventListener('scroll', onScroll, { passive: true });
    return stop;
  }, [auto]);

  return (
    <button ref={ref} type="button" className={`fp-cue fp-cue--${tone}`} onClick={() => scrollToNext(ref.current)} aria-label={`${label} 보기`}>
      <span className="fp-cue__label">{label}</span>
      <span className="fp-cue__arrow" aria-hidden>
        ↓
      </span>
      {counting && <span className="fp-cue__timer" style={{ animationDuration: `${auto}ms` }} aria-hidden />}
    </button>
  );
}
