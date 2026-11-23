import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 비동기 데이터 로딩 공통 훅 — { data, error, loading, reload, setData }
 * deps가 바뀌면 다시 요청하고, 이전 요청의 늦은 응답은 무시합니다(경쟁 상태 방지).
 */
export function useAsync(fn, deps = [], { enabled = true, initial = null } = {}) {
  const [state, setState] = useState({ data: initial, error: null, loading: enabled });
  const reqId = useRef(0);

  const run = useCallback(async () => {
    const id = ++reqId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      if (id === reqId.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (id === reqId.current) setState((s) => ({ ...s, error, loading: false }));
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (enabled) run();
    else setState((s) => ({ ...s, loading: false }));
  }, [run, enabled]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
}
