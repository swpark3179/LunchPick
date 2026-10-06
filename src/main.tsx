import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import ErrorBoundary, { AppCrash } from './components/ErrorBoundary';
import { toastError } from './store/uiStore';
import './styles/global.css';

// 이벤트 핸들러·비동기 코드의 예외는 ErrorBoundary 가 못 잡으니 토스트로라도 알린다.
window.addEventListener('unhandledrejection', (e) => toastError(e.reason, '예상치 못한 오류'));
window.addEventListener('error', (e) => toastError(e.error ?? e.message, '예상치 못한 오류'));

const root = document.getElementById('root');
if (!root) throw new Error('#root 를 찾을 수 없습니다');

createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary fallback={(error) => <AppCrash error={error} />}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
