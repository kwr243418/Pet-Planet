import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/theme.css'; // UX/UI 개편: 가장 마지막에 불러와 기존 스타일 위에 덮어씁니다

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
