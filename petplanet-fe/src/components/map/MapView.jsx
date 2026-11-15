import { useState } from 'react';
import KakaoMap from './KakaoMap.jsx';
import FallbackMap from './FallbackMap.jsx';

const KAKAO_KEY = (import.meta.env ?? {}).VITE_KAKAO_MAP_KEY;

/** 키가 있으면 카카오맵, 없거나 실패하면 미리보기 지도 */
export default function MapView({ height = 280, ...props }) {
  const [failReason, setFailReason] = useState(KAKAO_KEY ? null : 'VITE_KAKAO_MAP_KEY 미설정');
  if (failReason) return <FallbackMap {...props} height={height} reason={failReason} />;
  return (
    <KakaoMap
      {...props}
      height={height}
      appKey={KAKAO_KEY}
      onFail={(e) => {
        console.warn('[KakaoMap]', e.message);
        setFailReason(e.message);
      }}
    />
  );
}
