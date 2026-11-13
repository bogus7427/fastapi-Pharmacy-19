import { useEffect, useRef, useState } from 'react'
import { errorMessage, nearbyPharmacies, searchPharmacies } from '../api/client.js'
import imgNearby from '../assets/quick-nearby.svg'
import PharmacyCard from './PharmacyCard.jsx'

const SIDO = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시',
  '울산광역시', '세종특별자치시', '경기도', '강원특별자치도', '충청북도', '충청남도',
  '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
]
const PAGE_SIZE = 10

// "내 주변 열린 약국" 섹션. drug 가 있으면(상세 화면) 그 약을 살 약국을 찾는 용도로 문구가 바뀐다.
export default function PharmacyFinder({ drug, command }) {
  const [form, setForm] = useState({ sido: '서울특별시', sigungu: '', name: '' })
  const [state, setState] = useState({ status: 'idle', items: [], total: 0, page: 1, warnings: [], error: null, mode: null })
  const [openOnly, setOpenOnly] = useState(false)
  const abortRef = useRef(null)
  const sectionRef = useRef(null)
  const handledRef = useRef(null)

  const run = async (mode, loader, page = 1) => {
    abortRef.current?.abort() // 이전 요청 취소 (늦게 온 응답이 화면을 덮어쓰지 않도록)
    const controller = new AbortController()
    abortRef.current = controller
    setState((s) => ({ ...s, status: 'loading', error: null, mode, page }))
    try {
      const data = await loader(controller.signal)
      setState({ status: 'done', items: data.items, total: data.total, page, warnings: data.warnings, error: null, mode })
    } catch (err) {
      const message = errorMessage(err)
      if (message) setState((s) => ({ ...s, status: 'error', error: message }))
    }
  }

  const searchRegion = (page = 1) =>
    run('region', (signal) => searchPharmacies({ ...form, page, size: PAGE_SIZE }, signal), page)

  const searchNearby = () => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, status: 'error', error: '이 브라우저는 위치 기능을 지원하지 않습니다. 지역으로 검색해 주세요.' }))
      return
    }
    setState((s) => ({ ...s, status: 'loading', error: null }))
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => run('nearby', (signal) => nearbyPharmacies(coords.latitude, coords.longitude, 1000, signal)),
      () => setState((s) => ({ ...s, status: 'error', error: '위치를 확인하지 못했습니다. 브라우저의 위치 권한을 허용하거나 지역으로 검색해 주세요.' })),
      { timeout: 10000 },
    )
  }

  // Hero 의 "내 주변 열린 약국 보기" 버튼 처리 (같은 명령을 두 번 실행하지 않도록 key 로 구분)
  useEffect(() => {
    if (!command || handledRef.current === command.key) return
    handledRef.current = command.key
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    sectionRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    if (command.type === 'nearby') {
      setOpenOnly(true)
      searchNearby()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command])

  const onSubmit = (e) => {
    e.preventDefault()
    searchRegion(1)
  }

  // 영업 중인 약국을 위로 올린다. (같은 상태끼리는 원래 순서 = 거리순/이름순 유지)
  const order = (p) => (p.is_open_now === true ? 0 : p.is_open_now === false ? 2 : 1)
  const sorted = [...state.items].sort((a, b) => order(a) - order(b))
  const visible = openOnly ? sorted.filter((p) => p.is_open_now === true) : sorted
  const lastPage = Math.max(1, Math.ceil(state.total / PAGE_SIZE))

  return (
    <section className="section finder" ref={sectionRef}>
      <div className="section-head">
        <h2>{drug ? '이 약을 살 수 있는 약국 찾기' : '내 주변 열린 약국'}</h2>
        <p className="muted">
          {drug
            ? '약국별 실시간 재고와 판매가는 공공데이터로 제공되지 않습니다. 후기를 참고하고 전화로 확인해 주세요.'
            : '지금 문을 연 약국과 심야·휴일에 운영하는 약국을 확인하세요.'}
        </p>
      </div>

      <form className="finder-form" onSubmit={onSubmit}>
        <button type="button" onClick={searchNearby} disabled={state.status === 'loading'}>
          내 위치로 찾기 (1km)
        </button>
        <select value={form.sido} onChange={(e) => setForm({ ...form, sido: e.target.value })} aria-label="시·도">
          <option value="">전국</option>
          {SIDO.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          value={form.sigungu}
          onChange={(e) => setForm({ ...form, sigungu: e.target.value })}
          placeholder="시·군·구 (예: 강남구)"
          aria-label="시·군·구"
          maxLength={20}
        />
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="약국 이름 (선택)"
          aria-label="약국 이름"
          maxLength={30}
        />
        <button type="submit" className="btn-ghost" disabled={state.status === 'loading' || !(form.sido || form.sigungu || form.name)}>
          지역 검색
        </button>
      </form>

      <label className="check">
        <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
        지금 영업 중인 약국만 보기
      </label>

      {state.status === 'idle' && (
        <div className="empty-cta">
          <img src={imgNearby} alt="" width="56" height="56" />
          <p>
            <strong>가까운 약국을 찾아볼까요?</strong>
            <br />
            <span className="muted">「내 위치로 찾기」를 누르거나 지역을 입력해 검색하세요.</span>
          </p>
        </div>
      )}
      {state.status === 'loading' && <p className="muted" role="status">약국 정보를 불러오는 중…</p>}
      {state.status === 'error' && <p className="error" role="alert">{state.error}</p>}
      {state.warnings.map((w) => (
        <p key={w} className="warn">{w}</p>
      ))}

      {state.status === 'done' && state.items.length === 0 && (
        <p className="muted">조건에 맞는 약국이 없습니다. 시·군·구 이름을 확인하거나 범위를 넓혀 보세요.</p>
      )}

      {state.status === 'done' && state.items.length > 0 && (
        <>
          <p className="muted">
            {state.mode === 'nearby' ? '내 주변 1km' : '검색 결과'} {state.total.toLocaleString('ko-KR')}곳
            {openOnly && ` · 이 중 지금 영업 중 ${visible.length}곳 표시`}
          </p>
          {visible.length === 0 && (
            <p className="muted">지금 영업 중인 약국이 없습니다. 필터를 끄면 전체 약국을 볼 수 있습니다.</p>
          )}
          <ul className="pharmacy-list">
            {visible.map((p) => (
              <PharmacyCard key={p.id || p.name + p.address} pharmacy={p} drugName={drug?.name} />
            ))}
          </ul>
          {state.mode === 'region' && lastPage > 1 && (
            <nav className="pager" aria-label="페이지">
              <button type="button" disabled={state.page <= 1} onClick={() => searchRegion(state.page - 1)}>이전</button>
              <span>{state.page} / {lastPage}</span>
              <button type="button" disabled={state.page >= lastPage} onClick={() => searchRegion(state.page + 1)}>다음</button>
            </nav>
          )}
        </>
      )}
    </section>
  )
}
