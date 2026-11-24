// 시연 모드 — 마이페이지에 "(시연) 다음 상태로" 버튼을 보여줘요.
// 백엔드도 application.yml 의 petplanet.demo-mode: true 일 때만 본인이 예약·주문 상태를 올릴 수 있어요.
// 실제 운영처럼 숨기려면 frontend/.env 에 VITE_DEMO_MODE=false
export const DEMO_MODE = import.meta.env?.VITE_DEMO_MODE !== 'false';
