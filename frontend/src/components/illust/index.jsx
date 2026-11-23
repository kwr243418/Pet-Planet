// 목업 스타일의 플랫 일러스트 (오리지널 SVG) — 팔레트 색만 사용
const G = '#264536';
const MINT = '#c4ebc3';
const MINT_DEEP = '#9fd5a3';
const MINT_SOFT = '#e2f3e0';
const CREAM = '#fbf8f1';
const BEIGE = '#ede7d9';
const TERRA = '#c8673f';
const FUR = '#f0c895';
const FUR_DEEP = '#d29962';
const FUR_LIGHT = '#f7e6cc';

const Heart = ({ x, y, s = 1, o = 1 }) => (
  <path
    transform={`translate(${x} ${y}) scale(${s})`}
    d="M0 6C-3-1-13 0-13 8c0 7 13 14 13 14s13-7 13-14C13 0 3-1 0 6z"
    fill={TERRA}
    opacity={o}
  />
);

const Tree = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-3" y="0" width="6" height="26" rx="3" fill={G} />
    <circle cx="0" cy="-4" r="15" fill={TERRA} />
    <circle cx="-6" cy="-9" r="4" fill="#d98a66" />
  </g>
);

/** S01 메인: 지하철 창문에 기대는 푸들 (강아지 60 · 지하철 30 · 부가 10) */
export function SubwayPoodle({ className }) {
  return (
    <svg className={className} viewBox="0 0 1000 420" role="img" aria-label="지하철 창문에 기대어 밖을 보는 푸들">
      {/* 지하철 차체 */}
      <rect x="20" y="250" width="960" height="190" rx="40" fill={MINT} />
      <rect x="20" y="250" width="960" height="34" rx="17" fill={MINT_DEEP} />
      <rect x="60" y="300" width="150" height="80" rx="22" fill={G} />
      <rect x="790" y="300" width="150" height="80" rx="22" fill={G} />
      <rect x="84" y="314" width="40" height="8" rx="4" fill={MINT_DEEP} opacity=".6" />
      <rect x="814" y="314" width="40" height="8" rx="4" fill={MINT_DEEP} opacity=".6" />
      <rect x="250" y="236" width="90" height="16" rx="8" fill={TERRA} opacity=".75" />
      <rect x="660" y="236" width="90" height="16" rx="8" fill={TERRA} opacity=".75" />
      {/* 가운데 창문 */}
      <rect x="320" y="282" width="360" height="130" rx="26" fill={G} />
      {/* 부가 요소: 나무, 하트 */}
      <Tree x={70} y={230} s={1.15} />
      <Tree x={108} y={248} s={0.8} />
      <Tree x={930} y={232} s={1.15} />
      <Tree x={895} y={250} s={0.8} />
      <Heart x={258} y={150} s={1.2} />
      <Heart x={735} y={98} s={1.6} />
      <Heart x={790} y={180} s={1} o={0.8} />

      {/* 푸들 */}
      <g>
        {/* 귀 */}
        <ellipse cx="358" cy="240" rx="54" ry="96" fill={FUR_DEEP} />
        <ellipse cx="642" cy="240" rx="54" ry="96" fill={FUR_DEEP} />
        {[...Array(5)].map((_, i) => (
          <circle key={`le${i}`} cx={340 + (i % 2) * 34} cy={170 + i * 34} r="26" fill={FUR_DEEP} />
        ))}
        {[...Array(5)].map((_, i) => (
          <circle key={`re${i}`} cx={626 + (i % 2) * 34} cy={170 + i * 34} r="26" fill={FUR_DEEP} />
        ))}
        {/* 얼굴 */}
        <ellipse cx="500" cy="210" rx="148" ry="150" fill={FUR} />
        {/* 곱슬 머리 */}
        {[
          [430, 78, 40], [500, 62, 46], [570, 78, 40], [395, 118, 34], [605, 118, 34], [460, 108, 32], [540, 108, 32], [500, 118, 28],
        ].map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={FUR} />
        ))}
        {[[470, 88], [530, 88], [500, 70], [430, 120], [570, 120]].map(([cx, cy]) => (
          <circle key={`d${cx}${cy}`} cx={cx} cy={cy} r="11" fill={FUR_DEEP} opacity=".35" />
        ))}
        {/* 주둥이 */}
        <ellipse cx="500" cy="268" rx="78" ry="58" fill={FUR_LIGHT} />
        {/* 눈 */}
        <ellipse cx="438" cy="214" rx="21" ry="23" fill={G} />
        <ellipse cx="562" cy="214" rx="21" ry="23" fill={G} />
        <circle cx="446" cy="206" r="7" fill="#fff" />
        <circle cx="570" cy="206" r="7" fill="#fff" />
        {/* 볼 */}
        <ellipse cx="405" cy="262" rx="26" ry="15" fill={TERRA} opacity=".28" />
        <ellipse cx="595" cy="262" rx="26" ry="15" fill={TERRA} opacity=".28" />
        {/* 코·입 */}
        <path d="M478 246q22-12 44 0q-4 20-22 22q-18-2-22-22z" fill={G} />
        <path d="M500 268v12M500 280q-14 14-26 2M500 280q14 14 26 2" stroke={G} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M490 288h20v12a10 10 0 0 1-20 0z" fill={TERRA} />
      </g>
      {/* 창틀에 올린 앞발 */}
      <rect x="320" y="330" width="360" height="22" rx="11" fill={MINT_SOFT} />
      <ellipse cx="420" cy="336" rx="46" ry="26" fill={FUR_LIGHT} />
      <ellipse cx="580" cy="336" rx="46" ry="26" fill={FUR_LIGHT} />
      <path d="M404 330v14M420 328v16M436 330v14M564 330v14M580 328v16M596 330v14" stroke={FUR_DEEP} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** 탐색선·마이페이지 상단: 역 앞 건물 3채 + 작은 강아지 */
export function StationBuildings({ className }) {
  const win = (x, y, w = 26, h = 40) => <path d={`M${x} ${y + h}V${y + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y + h}z`} fill={G} />;
  return (
    <svg className={className} viewBox="0 0 520 300" role="img" aria-label="역 앞 거리의 건물들과 강아지">
      <ellipse cx="270" cy="282" rx="250" ry="14" fill={MINT_DEEP} opacity=".7" />
      {/* 건물 1 */}
      <path d="M70 120h120v160H70z" fill={BEIGE} />
      <path d="M190 120l18-14v160l-18 14z" fill="#dcd4c2" />
      <path d="M70 120l18-14h120l-18 14z" fill="#f6f2e8" />
      {win(92, 150)}
      {win(140, 150)}
      <rect x="108" y="220" width="44" height="60" rx="4" fill={G} />
      {/* 건물 2 (가운데, 가장 높음) */}
      <path d="M215 60h140v220H215z" fill="#fff" />
      <path d="M355 60l20-16v220l-20 16z" fill="#e6e0d2" />
      <path d="M215 60l20-16h140l-20 16z" fill="#f6f2e8" />
      {win(238, 88)}
      {win(298, 88)}
      {win(238, 150)}
      {win(298, 150)}
      <rect x="215" y="206" width="140" height="10" fill={MINT} />
      <rect x="262" y="226" width="46" height="54" rx="4" fill={G} />
      {/* 건물 3 */}
      <path d="M380 128h110v152H380z" fill={BEIGE} />
      <path d="M490 128l16-12v152l-16 12z" fill="#dcd4c2" />
      <path d="M380 128l16-12h110l-16 12z" fill="#f6f2e8" />
      {win(398, 156)}
      {win(446, 156)}
      <rect x="380" y="216" width="110" height="12" fill={TERRA} />
      <rect x="400" y="240" width="70" height="40" rx="3" fill={MINT_SOFT} />
      {/* 나무 */}
      <Tree x={40} y={250} s={1.2} />
      <Tree x={500} y={250} s={1.1} />
      {/* 강아지 */}
      <g transform="translate(300 252)">
        <ellipse cx="0" cy="22" rx="20" ry="4" fill={G} opacity=".15" />
        <path d="M-14 20c0-14 6-22 14-22s14 8 14 22z" fill={CREAM} />
        <circle cx="0" cy="-8" r="12" fill={CREAM} />
        <ellipse cx="-10" cy="-8" rx="5" ry="9" fill={TERRA} transform="rotate(18 -10 -8)" />
        <ellipse cx="10" cy="-8" rx="5" ry="9" fill={FUR_DEEP} transform="rotate(-18 10 -8)" />
        <circle cx="-4" cy="-8" r="1.8" fill={G} />
        <circle cx="4" cy="-8" r="1.8" fill={G} />
        <ellipse cx="0" cy="-3" rx="2.4" ry="1.8" fill={G} />
        <rect x="-8" y="2" width="16" height="4" rx="2" fill={TERRA} />
      </g>
    </svg>
  );
}

/** 옆모습으로 앉은 강아지 (회원가입) */
export function SittingDog({ className, size = 200 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="앉아 있는 강아지">
      <ellipse cx="100" cy="186" rx="76" ry="10" fill={MINT_DEEP} />
      <path d="M40 182c-10-30-6-70 24-86 22-12 52-4 62 22 8 22 4 48-6 64z" fill={FUR_LIGHT} />
      <path d="M44 120c-22-6-34 10-26 26" stroke={FUR_LIGHT} strokeWidth="16" fill="none" strokeLinecap="round" />
      <rect x="94" y="134" width="16" height="48" rx="8" fill={FUR} />
      <path d="M86 92c-6-26 10-50 38-50h30c16 0 26 10 26 22 0 14-12 22-26 22h-30c-6 12-20 16-38 6z" fill={FUR_LIGHT} />
      <path d="M92 50c-10-14-2-30 16-28 12 2 16 16 10 30z" fill={TERRA} />
      <circle cx="176" cy="60" r="7" fill={G} />
      <circle cx="140" cy="58" r="4" fill={G} />
      <rect x="84" y="90" width="50" height="12" rx="6" fill={TERRA} />
      <circle cx="110" cy="108" r="7" fill="#fff" stroke={FUR} strokeWidth="2" />
    </svg>
  );
}

/** 작은 정면 강아지 (카드·반려동물 카드·빈 화면) */
export function TinyDog({ className, size = 64, mood = 'happy' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="강아지">
      <ellipse cx="32" cy="58" rx="18" ry="3.5" fill={G} opacity=".12" />
      <path d="M17 57c0-14 6-22 15-22s15 8 15 22z" fill={FUR_LIGHT} />
      <circle cx="32" cy="27" r="15" fill={FUR_LIGHT} />
      <ellipse cx="18" cy="27" rx="6" ry="11" fill={TERRA} transform="rotate(14 18 27)" />
      <ellipse cx="46" cy="27" rx="6" ry="11" fill={FUR_DEEP} transform="rotate(-14 46 27)" />
      {mood === 'sad' ? (
        <path d="M24 27q3-2 6 0M34 27q3-2 6 0" stroke={G} strokeWidth="2" fill="none" strokeLinecap="round" />
      ) : (
        <>
          <circle cx="27" cy="26" r="2.2" fill={G} />
          <circle cx="37" cy="26" r="2.2" fill={G} />
        </>
      )}
      <ellipse cx="32" cy="32" rx="3" ry="2.2" fill={G} />
      {mood === 'sad' ? (
        <path d="M28 38q4-3 8 0" stroke={G} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M32 34v2M32 36q-3 3-5 0M32 36q3 3 5 0" stroke={G} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      )}
      <rect x="24" y="41" width="16" height="4" rx="2" fill={TERRA} />
    </svg>
  );
}

/** 로고 아이콘: 짙은 초록 원 + 발바닥 */
export function LogoMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="16" fill={G} />
      <g fill={CREAM}>
        <ellipse cx="16" cy="19.5" rx="5.2" ry="4.4" />
        <circle cx="9.8" cy="13.4" r="2.4" />
        <circle cx="13.6" cy="9.6" r="2.4" />
        <circle cx="18.4" cy="9.6" r="2.4" />
        <circle cx="22.2" cy="13.4" r="2.4" />
      </g>
    </svg>
  );
}
