// 공통 HTTP 클라이언트
// - JWT 자동 첨부 (Authorization: Bearer ...)
// - 에러 응답 규격 통일: ApiError { status, code, message, fieldErrors }
// - VITE_USE_MOCK=true 이면 목 서버로 라우팅 (화면 코드는 동일)

import { createMockServer, MockHttpError } from '../mocks/mockServer.js';

const env = import.meta.env ?? {};
export const USE_MOCK = String(env.VITE_USE_MOCK ?? 'true') !== 'false';
const API_BASE = env.VITE_API_BASE ?? '/api';
const TOKEN_KEY = 'pp-access-token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor({ status = 0, code = 'UNKNOWN', message = '알 수 없는 오류가 발생했어요.', fieldErrors = [] } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors ?? [];
  }

  /** [{field, message}] → { field: message } */
  get fieldMap() {
    return Object.fromEntries(this.fieldErrors.map((e) => [e.field, e.message]));
  }
}

const FRIENDLY = {
  0: '서버에 연결할 수 없어요. 네트워크 상태를 확인해 주세요.',
  401: '로그인이 필요해요.',
  403: '권한이 없어요.',
  404: '요청한 정보를 찾을 수 없어요.',
  500: '서버에 잠시 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
};

/** 401 발생 시 AuthContext가 구독해서 로그아웃 처리 */
export const AUTH_EXPIRED_EVENT = 'pp:auth-expired';

let mock;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mockFetch(method, path, { query, body }) {
  mock ??= createMockServer();
  await sleep(180 + Math.random() * 260);
  // 예외 처리 테스트용 스위치: localStorage.setItem('pp-mock-fail', 'network' | '500')
  const forced = localStorage.getItem('pp-mock-fail');
  if (forced === 'network') throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: FRIENDLY[0] });
  if (forced === '500') throw new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: FRIENDLY[500] });
  try {
    return structuredClone(mock.handle(method, path, { query, body, token: tokenStore.get() }));
  } catch (e) {
    if (e instanceof MockHttpError) throw new ApiError(e);
    console.error('[mock]', e);
    throw new ApiError({ status: 500, code: 'MOCK_ERROR', message: FRIENDLY[500] });
  }
}

function buildQuery(query = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

async function realFetch(method, path, { query, body, signal }) {
  const headers = { Accept: 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: FRIENDLY[0] });
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError({
      status: res.status,
      code: data?.code ?? `HTTP_${res.status}`,
      message: data?.message ?? FRIENDLY[res.status] ?? FRIENDLY[500],
      fieldErrors: data?.errors ?? data?.fieldErrors ?? [],
    });
  }
  return data;
}

export async function request(method, path, opts = {}) {
  try {
    return USE_MOCK ? await mockFetch(method, path, opts) : await realFetch(method, path, opts);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && tokenStore.get() && !opts.skipAuthRedirect) {
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
    throw e;
  }
}

export const http = {
  get: (path, query, opts) => request('GET', path, { ...opts, query }),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  delete: (path, opts) => request('DELETE', path, opts),
};

/** 개발용: 목 DB 초기화 */
export function resetMockDb() {
  mock ??= createMockServer();
  mock.reset();
}
