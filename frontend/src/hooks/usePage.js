// 화면 공통 UX 훅 (3주차 Day 11~12)
import { useEffect } from 'react';

const SITE = 'PET PLANET';

/** 브라우저 탭 제목: "장소 탐색 · PET PLANET" */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : `${SITE} · 역세권 반려생활 플랫폼`;
  }, [title]);
}

/** 작성 중인 내용이 있을 때 새로고침·탭 닫기 전에 브라우저 확인창 */
export function useUnsavedGuard(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}

/**
 * 제출 실패 시 첫 번째 오류 칸으로 스크롤 + 포커스
 * (에러 상태가 그려진 다음 프레임에 찾아야 해서 requestAnimationFrame 두 번)
 */
export function focusFirstInvalid(root = document) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const el = root.querySelector('[aria-invalid="true"], .field__error');
      if (!el) return;
      const target = el.matches('input, textarea, select, button') ? el : el.closest('.field, fieldset, div')?.querySelector('input, textarea, button') ?? el;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus?.({ preventScroll: true });
    }),
  );
}
