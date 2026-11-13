import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 30000 })

// 백엔드 오류({detail:{code,message}})를 화면에 그대로 보여줄 수 있는 문장으로 바꾼다.
export function errorMessage(err) {
  if (axios.isCancel(err)) return null
  const detail = err.response?.data?.detail
  if (detail?.message) return detail.message
  if (err.code === 'ECONNABORTED') return '응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.'
  if (!err.response) return '서버에 연결할 수 없습니다. 백엔드(8010)가 실행 중인지 확인해 주세요.'
  return `요청을 처리하지 못했습니다. (HTTP ${err.response.status})`
}

// query = { q: 제품명 } 또는 { symptom: 증상 }
export const searchDrugs = (query, page = 1, signal) =>
  api.get('/drugs', { params: { ...query, page }, signal }).then((r) => r.data)

export const popularDrugs = (signal) => api.get('/drugs/popular', { signal }).then((r) => r.data)
export const recordDrugView = (itemSeq) => api.post(`/drugs/${itemSeq}/view`).catch(() => {}) // 집계 실패는 무시

export const listReviews = (key, signal) => api.get('/reviews', { params: { key }, signal }).then((r) => r.data)
export const createReview = (body) => api.post('/reviews', body).then((r) => r.data)
export const deleteReview = (id, password) => api.post(`/reviews/${id}/delete`, { password })

export const searchPharmacies = (params, signal) =>
  api.get('/pharmacies', { params, signal }).then((r) => r.data)

export const nearbyPharmacies = (lat, lon, radius = 1000, signal) =>
  api.get('/pharmacies/nearby', { params: { lat, lon, radius }, signal }).then((r) => r.data)
