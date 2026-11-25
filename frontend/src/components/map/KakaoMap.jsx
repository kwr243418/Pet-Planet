import { useEffect, useRef, useState } from 'react';
import { offsetMeters } from '../../utils/geo.js';

let kakaoPromise = null;

/** 카카오맵 JS SDK 동적 로드 (autoload=false → kakao.maps.load 콜백) · services: 좌표 → 주소(건물명) 변환에 씀 */
export function loadKakaoMaps(appKey, timeoutMs = 7000) {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao);
  if (kakaoPromise) return kakaoPromise;
  kakaoPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      kakaoPromise = null;
      reject(new Error('카카오맵 SDK 응답 시간 초과 (앱 키·도메인 등록 확인)'));
    }, timeoutMs);
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&libraries=services&autoload=false`;
    s.async = true;
    s.onload = () => {
      if (!window.kakao?.maps) {
        clearTimeout(timer);
        kakaoPromise = null;
        reject(new Error('카카오맵 SDK 초기화 실패'));
        return;
      }
      window.kakao.maps.load(() => {
        clearTimeout(timer);
        resolve(window.kakao);
      });
    };
    s.onerror = () => {
      clearTimeout(timer);
      kakaoPromise = null;
      reject(new Error('카카오맵 SDK 로드 실패'));
    };
    document.head.appendChild(s);
  });
  return kakaoPromise;
}

function pinElement(m, onClick) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = m.kind === 'origin' ? 'kmap-station' : 'kmap-pin';
  el.dataset.id = m.id;
  el.setAttribute('aria-label', m.label);
  if (m.kind === 'origin') {
    el.innerHTML = `<span class="kmap-station__dot"></span><span class="kmap-station__name">${escapeHtml(m.label)}</span>`;
  } else {
    el.innerHTML = `<span class="kmap-pin__num">${m.num ?? ''}</span><span class="kmap-pin__name">${escapeHtml(m.label)}</span>`;
    el.addEventListener('click', () => onClick?.(m.id));
  }
  return el;
}

const escapeHtml = (s = '') => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * 카카오맵 (Day 6) — 출발점/장소 마커 + 반경 원
 * markers: [{ id, lat, lng, kind: 'place'|'origin', label, num }]
 */
export default function KakaoMap({ appKey, center, markers, radiusKm, selectedId, onMarkerClick, onFail, height, label }) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const layers = useRef([]);
  const clickRef = useRef(onMarkerClick);
  const [ready, setReady] = useState(false);
  clickRef.current = onMarkerClick;

  useEffect(() => {
    let alive = true;
    loadKakaoMaps(appKey)
      .then((kakao) => {
        if (!alive || !el.current) return;
        const c = center ?? markers[0] ?? { lat: 37.5665, lng: 126.978 };
        mapRef.current = new kakao.maps.Map(el.current, { center: new kakao.maps.LatLng(c.lat, c.lng), level: 5 });
        mapRef.current.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        setReady(true);
      })
      .catch((e) => alive && onFail?.(e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appKey]);

  // 마커·반경 원 그리기 + 화면 맞춤
  useEffect(() => {
    if (!ready) return;
    const { kakao } = window;
    const map = mapRef.current;
    layers.current.forEach((l) => l.setMap(null));
    layers.current = [];
    const bounds = new kakao.maps.LatLngBounds();

    if (center && radiusKm) {
      const circle = new kakao.maps.Circle({
        center: new kakao.maps.LatLng(center.lat, center.lng),
        radius: radiusKm * 1000,
        strokeWeight: 1.5,
        strokeColor: '#8A6A3B',
        strokeOpacity: 0.8,
        strokeStyle: 'dash',
        fillColor: '#C9A26B',
        fillOpacity: 0.08,
      });
      circle.setMap(map);
      layers.current.push(circle);
      const ne = offsetMeters(center.lat, center.lng, radiusKm * 1000, radiusKm * 1000);
      const sw = offsetMeters(center.lat, center.lng, -radiusKm * 1000, -radiusKm * 1000);
      bounds.extend(new kakao.maps.LatLng(ne.lat, ne.lng));
      bounds.extend(new kakao.maps.LatLng(sw.lat, sw.lng));
    }

    for (const m of markers) {
      const pos = new kakao.maps.LatLng(m.lat, m.lng);
      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        content: pinElement(m, (id) => clickRef.current?.(id)),
        yAnchor: 0.5,
        zIndex: m.kind === 'origin' ? 3 : 2,
        clickable: true,
      });
      overlay.setMap(map);
      layers.current.push(overlay);
      bounds.extend(pos);
    }
    if (!bounds.isEmpty()) map.setBounds(bounds, 30, 30, 30, 30);
  }, [ready, markers, center, radiusKm]);

  // 선택된 마커 강조 + 이동
  useEffect(() => {
    if (!ready) return;
    el.current.querySelectorAll('.kmap-pin').forEach((p) => p.classList.toggle('is-selected', String(p.dataset.id) === String(selectedId)));
    const m = markers.find((x) => String(x.id) === String(selectedId));
    if (m) mapRef.current.panTo(new window.kakao.maps.LatLng(m.lat, m.lng));
  }, [ready, selectedId, markers]);

  return (
    <div className="map-box" style={{ height }}>
      <div ref={el} style={{ width: '100%', height: '100%' }} />
      {label && <span className="map-box__label">{label}</span>}
    </div>
  );
}
