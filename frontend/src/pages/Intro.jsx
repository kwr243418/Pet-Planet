import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePage.js';
import { IMG, LogoMark } from '../components/illust/index.jsx';

const PILLARS = [
  { title: '탐색', img: IMG.engraveSpaniel, alt: '앉아 있는 스패니얼 판화', desc: '내 위치나 가까운 지하철역에서 반려동물과 함께 갈 수 있는 곳을 찾습니다.', href: '#explore' },
  { title: '예약', img: IMG.engraveTerrier, alt: '귀를 세운 테리어 판화', desc: '주변 동물병원과 펫호텔의 빈 시간과 객실을 확인하고 예약합니다.', href: '#booking' },
  { title: '생활', img: IMG.engraveRetriever, alt: '엎드린 리트리버 판화', desc: '필요한 용품을 주문하고, 다녀온 곳의 후기를 남깁니다.', href: '#life' },
];

const STEPS = [
  { no: '01', title: '출발점 선택', desc: '내 위치를 쓰거나, 가까운 지하철역을 고릅니다.' },
  { no: '02', title: '주변 둘러보기', desc: '동반 장소 · 동물병원 · 펫호텔을 거리와 동반 조건으로 골라 봅니다.' },
  { no: '03', title: '가는 방법 · 예약', desc: '도보 · 버스 · 자동차 중 가는 방법을 고르고, 필요하면 바로 예약합니다.' },
  { no: '04', title: '주문과 후기', desc: '외출 용품을 주문하고, 다녀온 뒤 후기를 남깁니다.' },
];

const FEATURES = [
  {
    id: 'explore',
    no: '01 · 주변 탐색',
    title: '출발점을 고르면,\n갈 수 있는 곳이 보입니다.',
    img: IMG.stationPath,
    alt: '역 앞 산책로를 걷는 반려인과 강아지',
    items: ['내 위치 또는 지하철역 기준 반경 검색 (최대 5km)', '동반 장소 · 동물병원 · 펫호텔을 한 화면에서', '도보 · 버스 · 자동차 · 택시 예상 시간과 카카오맵 길찾기', '동반 크기 · 실내외 조건, 장소 찜과 1인 1회 후기'],
    to: '/explore',
    cta: '주변 탐색하기',
  },
  {
    id: 'booking',
    no: '02 · 병원 · 호텔 예약',
    title: '빈 시간과 맞는 객실을\n바로 확인합니다.',
    img: IMG.vet,
    alt: '진료대 위 강아지와 수의사의 손',
    items: ['공공데이터 기반 동물병원 · 펫호텔 정보', '동물병원은 30분 단위, 한 칸에 1건 예약', '펫호텔은 반려동물 체중에 맞는 객실만 선택', '대기 → 확정 → 완료 순으로 예약 상태 확인'],
    to: '/reservations/hospital',
    cta: '예약하러 가기',
    reverse: true,
  },
  {
    id: 'life',
    no: '03 · 펫 스토어 · 후기',
    title: '준비하고, 다녀와서,\n기록을 남깁니다.',
    img: IMG.lightStillLife,
    alt: '나무 테이블 위 산책 용품',
    items: ['사료 · 간식 · 위생용품 · 외출 용품 주문', '같은 상품을 다시 담으면 수량이 합쳐지는 장바구니', '배송완료 후 상품 후기 작성', '장소 · 병원 · 상품 후기를 마이페이지에서 한곳에'],
    to: '/shop',
    cta: '스토어 둘러보기',
  },
];

/** S00 소개 페이지 (첫 화면) — 서비스를 위에서 아래로 설명하고, 제목·버튼을 누르면 홈으로 */
export default function Intro() {
  usePageTitle(null);
  return (
    <div className="intro">
      <section className="intro-hero">
        <div className="container intro-top">
          <Link to="/home" className="logo" aria-label="펫 플래닛 홈">
            <LogoMark />
            <span className="logo__text">펫 플래닛</span>
          </Link>
          <nav className="intro-top__nav" aria-label="소개 목차">
            <a href="#about">소개</a>
            <a href="#how">이용 순서</a>
            <a href="#features">기능</a>
          </nav>
          <Link to="/home" className="intro-top__enter">
            들어가기 →
          </Link>
        </div>
        <div className="container intro-hero__inner">
          <div className="intro-hero__text">
            <h1>
              <Link to="/home" className="intro-hero__title">
                펫
                <br />
                플래닛.
              </Link>
            </h1>
            <p className="intro-hero__tag">
              대중교통으로 떠나는 <span>반려동물 통합 플랫폼</span>
            </p>
            <div className="intro-hero__actions">
              <a href="#about" className="btn btn--night btn--md">
                소개 보기
              </a>
              <Link to="/home" className="btn btn--gold btn--md">
                시작하기
              </Link>
            </div>
          </div>
          <div className="intro-hero__photo">
            <img src={IMG.heroGolden} alt="정면을 바라보는 골든 리트리버" />
          </div>
        </div>
      </section>

      <section id="about" className="intro-about">
        <div className="container intro-center">
          <img className="intro-about__art" src={IMG.engravePointerWalking} alt="" aria-hidden />
          <h2 className="intro-h2">어디서든, 반려동물과 함께 가는 길</h2>
          <span className="gold-rule" />
          <p className="intro-lead">
            반려동물과 외출하려면 갈 수 있는 장소, 가는 방법, 근처 병원과 맡길 곳을 따로따로 찾아야 합니다. 펫 플래닛은 이 정보를 출발점 하나를 기준으로 묶었습니다. 내 위치나 가까운 지하철역에서 출발해 걸어서, 버스로, 차로 갈 수 있는 동반 장소와 동물병원, 펫호텔, 필요한 용품까지 한 곳에서 이어집니다.
          </p>
          <div className="intro-pillars">
            {PILLARS.map((p) => (
              <div key={p.title} className="intro-pillar">
                <img src={p.img} alt={p.alt} />
                <h3>{p.title}</h3>
                <span className="gold-rule gold-rule--sm" />
                <p>{p.desc}</p>
                <a href={p.href} className="btn btn--line btn--sm">
                  자세히
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="intro-how">
        <div className="container intro-center">
          <p className="eyebrow eyebrow--night">이용 순서</p>
          <h2 className="intro-h2 intro-h2--night">하나의 노선처럼 이어집니다</h2>
          <span className="gold-rule" />
          <ol className="intro-steps">
            {STEPS.map((s) => (
              <li key={s.no}>
                <span className="intro-steps__dot" aria-hidden />
                <span className="intro-steps__no">{s.no}</span>
                <span className="intro-steps__title">{s.title}</span>
                <span className="intro-steps__desc">{s.desc}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="features" className="intro-features">
        <div className="container intro-center">
          <p className="eyebrow">기능</p>
          <h2 className="intro-h2">필요한 순간에 필요한 서비스</h2>
          <span className="gold-rule" />
        </div>
        {FEATURES.map((f) => (
          <div key={f.id} id={f.id} className={`container intro-feature ${f.reverse ? 'intro-feature--reverse' : ''}`}>
            <div className="intro-feature__photo">
              <img src={f.img} alt={f.alt} loading="lazy" />
            </div>
            <div className="intro-feature__text">
              <p className="eyebrow eyebrow--gold">{f.no}</p>
              <h3>{f.title}</h3>
              <span className="gold-rule gold-rule--sm" />
              <ul>
                {f.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
              <Link to={f.to} className="btn btn--line btn--sm">
                {f.cta}
              </Link>
            </div>
          </div>
        ))}
      </section>

      <section className="intro-close">
        <div className="container intro-close__inner">
          <div className="intro-close__photo">
            <img src={IMG.oldDog} alt="옆 조명을 받은 노견" loading="lazy" />
          </div>
          <div className="intro-close__text">
            <h2 className="intro-h2 intro-h2--night">
              다음 역에서
              <br />
              만나요.
            </h2>
            <span className="gold-rule" />
            <p>출발점을 고르는 것으로 시작합니다.</p>
            <Link to="/home" className="btn btn--gold btn--md">
              펫 플래닛 시작하기
            </Link>
          </div>
        </div>
        <div className="container intro-foot">
          <span>© 2026 펫 플래닛</span>
          <span>데이터베이스 수업 프로젝트 · 이미지: AI 생성</span>
        </div>
      </section>
    </div>
  );
}
