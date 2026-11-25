// 일러스트 → 판화 일러스트 · 실사 사진 (다크 & 화이트 에디토리얼 개편)
// 예전 컴포넌트 이름과 props는 그대로 두어서 화면 코드는 고치지 않아도 됩니다.
// 이미지 원본: frontend/public/images/ (AI 생성 이미지, 1600px JPEG)

export const IMG = {
  heroGolden: '/images/a1-golden.jpg',
  oldDog: '/images/a2-old-dog.jpg',
  spaniel: '/images/a3-spaniel.jpg',
  terraceCorgi: '/images/a4-corgi-terrace.jpg',
  hotelRetriever: '/images/a5-hotel-retriever.jpg',
  darkStillLife: '/images/a6-dark-stilllife.jpg',
  engravePointerWalking: '/images/b1-pointer-walking.jpg',
  engraveSpaniel: '/images/b2-spaniel.jpg',
  engraveTerrier: '/images/b3-terrier.jpg',
  engraveRetriever: '/images/b4-retriever-lying.jpg',
  engravePointerStanding: '/images/b5-pointer-standing.jpg',
  stationPath: '/images/c1-station-path.jpg',
  vet: '/images/c2-vet.jpg',
  lightStillLife: '/images/c3-light-stilllife.jpg',
  cafe: '/images/d1-cafe.jpg',
  restaurant: '/images/d3-restaurant.jpg',
  playground: '/images/d4-playground.jpg',
  morningPath: '/images/g2-morning-path.jpg',
  shiba: '/images/f1-shiba.jpg',
};

/** S01 홈 상단: 정면을 바라보는 골든 리트리버 (검정 배경 실사) */
export function SubwayPoodle({ className }) {
  return <img className={`illust-photo ${className ?? ''}`} src={IMG.heroGolden} alt="정면을 바라보는 골든 리트리버" />;
}

/** 사진이 없을 때의 대체 그림: 걷는 포인터 판화 */
export function StationBuildings({ className }) {
  return <img className={`illust-engrave ${className ?? ''}`} src={IMG.engravePointerWalking} alt="" aria-hidden />;
}

/** 가입 · 로그인 · 반려동물 등록 화면: 앉아 있는 스패니얼 판화 */
export function SittingDog({ className, size = 200 }) {
  return <img className={`illust-engrave ${className ?? ''}`} src={IMG.engraveSpaniel} alt="" aria-hidden style={{ width: size * 1.4, height: size, objectFit: 'contain' }} />;
}

/** 작은 강아지 (카드 · 반려동물 사진 자리 · 빈 화면): 판화 일러스트 */
export function TinyDog({ className, size = 64, mood = 'happy' }) {
  const src = mood === 'sad' ? IMG.engraveRetriever : IMG.engraveTerrier;
  return (
    <img
      className={`illust-engrave illust-engrave--tiny ${className ?? ''}`}
      src={src}
      alt="강아지"
      width={Math.round(size * 1.5)}
      height={size}
      style={{ width: Math.round(size * 1.5), height: size, objectFit: 'contain' }}
    />
  );
}

/** 로고 아이콘: 노선 위의 역 (금색 선 + 사각 역 표시) */
export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden>
      <path d="M1 14h26" stroke="#C9A26B" strokeWidth="1" />
      <rect x="9.5" y="9.5" width="9" height="9" fill="#1C1B19" stroke="#C9A26B" strokeWidth="1" />
    </svg>
  );
}
