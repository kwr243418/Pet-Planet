// 펫플래닛 마스코트 "플래니" — 행성 고리를 두른 말랑한 강아지 (오리지널 캐릭터)
// mood: 'happy' | 'sad' | 'sleepy' | 'love'
export default function Mascot({ size = 96, mood = 'happy', className = '', title = '플래니' }) {
  const eyes = {
    happy: (
      <>
        <ellipse cx="46" cy="62" rx="4.6" ry="5.4" fill="#2b1b22" />
        <ellipse cx="74" cy="62" rx="4.6" ry="5.4" fill="#2b1b22" />
        <circle cx="47.6" cy="60" r="1.6" fill="#fff" />
        <circle cx="75.6" cy="60" r="1.6" fill="#fff" />
      </>
    ),
    love: (
      <>
        <path d="M41 60c0-3 4-4 5-1 1-3 5-2 5 1 0 3-5 6-5 6s-5-3-5-6z" fill="#f0306e" />
        <path d="M69 60c0-3 4-4 5-1 1-3 5-2 5 1 0 3-5 6-5 6s-5-3-5-6z" fill="#f0306e" />
      </>
    ),
    sad: (
      <>
        <ellipse cx="46" cy="63" rx="4.2" ry="5" fill="#2b1b22" />
        <ellipse cx="74" cy="63" rx="4.2" ry="5" fill="#2b1b22" />
        <path d="M39 53l12 4M81 53l-12 4" stroke="#2b1b22" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M82 68c0 3-2 5-3.5 5S75 71 75 68s3.5-7 3.5-7 3.5 4 3.5 7z" fill="#9fd4ff" />
      </>
    ),
    sleepy: (
      <>
        <path d="M41 63q5 4 10 0M69 63q5 4 10 0" stroke="#2b1b22" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      </>
    ),
  }[mood];

  const mouth =
    mood === 'sad' ? (
      <path d="M54 79q6-5 12 0" stroke="#2b1b22" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    ) : (
      <>
        <path d="M54 75q3 4 6 0q3 4 6 0" stroke="#2b1b22" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        {mood !== 'sleepy' && <path d="M57.5 77.5h5v3a2.5 2.5 0 0 1-5 0z" fill="#ff7aa2" />}
      </>
    );

  return (
    <svg
      className={`mascot ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={title}
    >
      <ellipse cx="60" cy="108" rx="30" ry="5" fill="#f0306e" opacity=".12" />
      {/* 뒤쪽 행성 고리 */}
      <ellipse cx="60" cy="80" rx="54" ry="12" fill="none" stroke="#ff9bb8" strokeWidth="5" />
      {/* 귀 */}
      <ellipse cx="25" cy="58" rx="12" ry="21" transform="rotate(22 25 58)" fill="#ff9bb8" />
      <ellipse cx="95" cy="58" rx="12" ry="21" transform="rotate(-22 95 58)" fill="#ff9bb8" />
      {/* 얼굴 */}
      <ellipse cx="60" cy="66" rx="38" ry="35" fill="#fff" />
      <ellipse cx="60" cy="66" rx="38" ry="35" fill="url(#pp-face)" />
      {/* 머리 위 하트 */}
      <path d="M60 36c-3-6-12-5-12 2 0 6 12 12 12 12s12-6 12-12c0-7-9-8-12-2z" fill="#f0306e" />
      {eyes}
      <ellipse cx="35" cy="74" rx="7" ry="4.5" fill="#ffc7d6" />
      <ellipse cx="85" cy="74" rx="7" ry="4.5" fill="#ffc7d6" />
      <path d="M56 69.5q4-2.5 8 0q-1 4-4 4.2q-3-.2-4-4.2z" fill="#2b1b22" />
      {mouth}
      {/* 앞쪽 행성 고리 */}
      <path d="M6 80a54 12 0 0 0 108 0" fill="none" stroke="#f0306e" strokeWidth="5" strokeLinecap="round" />
      <circle cx="104" cy="88" r="3" fill="#ffe8a3" />
      {mood === 'sleepy' && (
        <text x="92" y="30" fontSize="16" fontWeight="700" fill="#f65d8d">
          z
        </text>
      )}
      <defs>
        <radialGradient id="pp-face" cx="0.5" cy="0.35" r="0.7">
          <stop offset="0.7" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#ffe3eb" />
        </radialGradient>
      </defs>
    </svg>
  );
}
