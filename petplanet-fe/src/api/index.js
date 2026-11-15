// 도메인별 API 함수 — 엔드포인트 명세는 docs/API_SPEC_FE1.md 참고
import { http } from './client.js';

export const authApi = {
  checkEmail: (email) => http.get('/auth/check-email', { email }),
  signup: (payload) => http.post('/auth/signup', payload),
  login: (email, password) => http.post('/auth/login', { email, password }, { skipAuthRedirect: true }),
  me: () => http.get('/auth/me', undefined, { skipAuthRedirect: true }),
  resetPassword: (email, name) => http.post('/auth/password/reset', { email, name }),
};

export const petApi = {
  list: () => http.get('/pets'),
  get: (petId) => http.get(`/pets/${petId}`),
  create: (pet) => http.post('/pets', pet),
  update: (petId, pet) => http.put(`/pets/${petId}`, pet),
  remove: (petId) => http.delete(`/pets/${petId}`),
};

export const stationApi = {
  search: (keyword, opts) => http.get('/stations', { keyword }, opts),
  get: (stationId) => http.get(`/stations/${stationId}`),
};

export const placeApi = {
  categories: () => http.get('/place-categories'),
  /** @param {{stationId?, radiusKm?, categoryIds?, lines?, sizes?, indoor?, keyword?, sort?, page?, size?}} q */
  search: (q) => http.get('/places', q),
  get: (placeId) => http.get(`/places/${placeId}`),
  bookmark: (placeId) => http.post(`/places/${placeId}/bookmark`),
  unbookmark: (placeId) => http.delete(`/places/${placeId}/bookmark`),
  myBookmarks: () => http.get('/users/me/bookmarks'),
};

export const reviewApi = {
  list: (targetId, { sort = 'latest', page = 0, size = 5, targetType = 'PLACE' } = {}) =>
    http.get('/reviews', { targetType, targetId, sort, page, size }),
  create: ({ targetId, rating, content, targetType = 'PLACE' }) => http.post('/reviews', { targetType, targetId, rating, content }),
  update: (reviewId, { rating, content }) => http.put(`/reviews/${reviewId}`, { rating, content }),
  remove: (reviewId) => http.delete(`/reviews/${reviewId}`),
  mine: (targetType = 'PLACE') => http.get('/users/me/reviews', { targetType }),
};
