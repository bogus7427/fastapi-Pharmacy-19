import { useEffect, useState } from 'react'
import { createReview, deleteReview, errorMessage, listReviews } from '../api/client.js'

// 저장 시각은 UTC 문자열("YYYY-MM-DD HH:MM:SS")이다.
const formatDate = (utc) =>
  new Date(utc.replace(' ', 'T') + 'Z').toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })

const won = (n) => `${n.toLocaleString('ko-KR')}원`

// 약국 카드 안에서 펼쳐지는 후기 영역: 약별 요약 → 후기 목록 → 작성 폼.
export default function ReviewPanel({ pharmacy, drugName, onCountChange }) {
  const cleanDrug = (drugName || '').replace(/^\[샘플\]\s*/, '')
  const [data, setData] = useState(null) // { items, total, summary }
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ drug_name: cleanDrug, in_stock: true, price: '', comment: '', nickname: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const load = async (signal) => {
    try {
      const res = await listReviews(pharmacy.review_key, signal)
      setData(res)
      setError(null)
      onCountChange?.(res.total)
    } catch (err) {
      const message = errorMessage(err)
      if (message) setError(message)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pharmacy.review_key])

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await createReview({
        pharmacy_key: pharmacy.review_key,
        pharmacy_name: pharmacy.name,
        drug_name: form.drug_name,
        in_stock: form.in_stock,
        price: form.in_stock && form.price !== '' ? Number(form.price) : null,
        comment: form.comment,
        nickname: form.nickname,
        password: form.password,
      })
      setForm({ ...form, price: '', comment: '', password: '' }) // 닉네임·약 이름은 이어서 쓰기 편하게 유지
      await load()
    } catch (err) {
      setFormError(errorMessage(err) || '후기를 등록하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    const password = window.prompt('작성할 때 입력한 비밀번호를 입력하세요.')
    if (!password) return
    try {
      await deleteReview(id, password)
      await load()
    } catch (err) {
      window.alert(errorMessage(err) || '삭제하지 못했습니다.')
    }
  }

  // 선택한 약에 대한 후기를 위로 올린다.
  const items = data
    ? [...data.items].sort((a, b) => (b.drug_name === cleanDrug) - (a.drug_name === cleanDrug))
    : []

  return (
    <div className="reviews">
      <p className="muted">
        방문자가 직접 남긴 제보입니다. 재고와 가격은 달라질 수 있으니 방문 전 전화로 확인하세요.
      </p>

      {error && <p className="error" role="alert">{error}</p>}
      {!data && !error && <p className="muted" role="status">후기를 불러오는 중…</p>}

      {data?.summary.length > 0 && (
        <ul className="review-summary" aria-label="약별 제보 요약">
          {data.summary.map((s) => (
            <li key={s.drug_name} className={s.has >= s.none ? 'badge badge-ok' : 'badge badge-none'}>
              {s.drug_name} · 있음 {s.has} / 없음 {s.none}
              {s.last_price != null && ` · 최근 ${won(s.last_price)}`}
            </li>
          ))}
        </ul>
      )}

      {data && data.items.length === 0 && (
        <p className="muted">아직 후기가 없습니다. 이 약국에서 약을 구입했다면 첫 제보를 남겨 주세요.</p>
      )}

      {items.length > 0 && (
        <ul className="review-list">
          {items.map((r) => (
            <li key={r.id} className={r.in_stock ? 'review has' : 'review none'}>
              <div className="review-head">
                <strong>{r.drug_name}</strong>
                <span className={r.in_stock ? 'badge badge-ok' : 'badge badge-none'}>{r.in_stock ? '있었음' : '없었음'}</span>
                {r.price != null && <span>{won(r.price)}</span>}
              </div>
              {r.comment && <p>{r.comment}</p>}
              <span className="muted">
                {r.nickname} · {formatDate(r.created_at)} ·{' '}
                <button type="button" className="link-btn" onClick={() => remove(r.id)}>삭제</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form className="review-form" onSubmit={submit}>
        <label className="wide">
          약 이름
          <input value={form.drug_name} onChange={set('drug_name')} required maxLength={60} placeholder="예: 타이레놀정500밀리그람" />
        </label>
        <label>
          재고
          <select value={form.in_stock ? '1' : '0'} onChange={(e) => setForm({ ...form, in_stock: e.target.value === '1' })}>
            <option value="1">있었어요</option>
            <option value="0">없었어요</option>
          </select>
        </label>
        <label>
          가격 (선택, 원)
          <input type="number" inputMode="numeric" min="0" max="10000000" step="10" value={form.price} onChange={set('price')}
            disabled={!form.in_stock} placeholder="예: 3000" />
        </label>
        <label className="wide">
          한마디 (선택)
          <textarea value={form.comment} onChange={set('comment')} maxLength={500} placeholder="예: 10정짜리만 있었고 약사님이 친절했어요." />
        </label>
        <label>
          닉네임
          <input value={form.nickname} onChange={set('nickname')} required maxLength={20} autoComplete="nickname" />
        </label>
        <label>
          비밀번호 (삭제용, 4자 이상)
          <input type="password" value={form.password} onChange={set('password')} required minLength={4} maxLength={40} autoComplete="new-password" />
        </label>
        {formError && <p className="error wide" role="alert">{formError}</p>}
        <button type="submit" className="wide" disabled={saving} style={{ justifyContent: 'center' }}>
          {saving ? '등록 중…' : '후기 등록'}
        </button>
      </form>
    </div>
  )
}
