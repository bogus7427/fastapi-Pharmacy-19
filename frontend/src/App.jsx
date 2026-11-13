import { useEffect, useRef, useState } from 'react'
import { errorMessage, recordDrugView, searchDrugs } from './api/client.js'
import DrugCard from './components/DrugCard.jsx'
import DrugDetail from './components/DrugDetail.jsx'
import EmergencyContacts from './components/EmergencyContacts.jsx'
import Hero from './components/Hero.jsx'
import PharmacyFinder from './components/PharmacyFinder.jsx'
import PhotoBanner from './components/PhotoBanner.jsx'
import PopularCarousel from './components/PopularCarousel.jsx'
import photoDetail from './assets/photos/detail.jpg'
import photoPharmacy from './assets/photos/pharmacy.jpg'

export default function App() {
  const [search, setSearch] = useState({ status: 'idle', result: null, error: null, label: '', symptom: null })
  const [detail, setDetail] = useState(null) // 상세 화면에 띄운 의약품. null 이면 메인 화면
  const [command, setCommand] = useState(null) // Hero → 약국 섹션 명령
  const abortRef = useRef(null)
  const resultsRef = useRef(null)

  // 브라우저 뒤로가기로 상세 화면을 닫을 수 있게 한다.
  useEffect(() => {
    const onPop = (e) => setDetail(e.state?.drug ?? null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const runSearch = async (query, label, symptom = null) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setSearch({ status: 'loading', result: null, error: null, label, symptom })
    try {
      const result = await searchDrugs(query, 1, controller.signal)
      setSearch({ status: 'done', result, error: null, label, symptom })
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      resultsRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    } catch (err) {
      const message = errorMessage(err)
      if (message) setSearch({ status: 'error', result: null, error: message, label, symptom })
    }
  }

  const openDetail = (drug) => {
    window.history.pushState({ drug }, '')
    setDetail(drug)
    window.scrollTo(0, 0)
    recordDrugView(drug.item_seq)
  }

  if (detail) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="topbar-inner">
            <button type="button" className="btn-ghost" onClick={() => window.history.back()}>← 목록으로</button>
            <span className="topbar-title">의약품 상세</span>
          </div>
        </header>
        <main className="container">
          <PhotoBanner
            image={photoDetail}
            eyebrow="의약품 상세"
            title="복용 전에 꼭 확인하세요"
            sub="효능, 용법, 주의사항을 한 화면에서 봅니다."
          />
          <DrugDetail drug={detail} />
          <PharmacyFinder key={detail.item_seq} drug={detail} />
          <EmergencyContacts />
          <Footer />
        </main>
      </div>
    )
  }

  const { status, result, error, label, symptom } = search

  return (
    <div className="app">
      <Hero
        onSearch={(q) => runSearch({ q }, `"${q}"`)}
        onSymptom={(s) => runSearch({ symptom: s.term }, `증상: ${s.label}`, s.term)}
        onNearby={() => setCommand({ type: 'nearby', key: Date.now() })}
        loading={status === 'loading'}
        activeSymptom={symptom}
      />

      <main className="container">
        {status !== 'idle' && (
          <section className="section" ref={resultsRef}>
            <div className="section-head">
              <h2>{label} 검색 결과</h2>
              {status === 'done' && (
                <p className="muted">{result.total.toLocaleString('ko-KR')}건 중 {result.items.length}건</p>
              )}
            </div>
            {status === 'loading' && <p className="muted" role="status">의약품을 찾는 중…</p>}
            {status === 'error' && <p className="error" role="alert">{error}</p>}
            {status === 'done' && result.notice && <p className="warn">{result.notice}</p>}
            {status === 'done' && result.items.length === 0 && (
              <p className="muted">검색된 의약품이 없습니다. 제품명의 일부만 입력하거나 증상 버튼을 눌러 보세요.</p>
            )}
            {status === 'done' && result.items.length > 0 && (
              <ul className="drug-grid">
                {result.items.map((d) => (
                  <li key={d.item_seq}><DrugCard drug={d} onOpen={openDetail} /></li>
                ))}
              </ul>
            )}
          </section>
        )}

        <PopularCarousel onOpen={openDetail} />
        <PhotoBanner
          image={photoPharmacy}
          eyebrow="전국 약국 검색"
          title="지금 문 연 약국을 찾아보세요"
          sub="운영시간과 연락처, 이용자 후기를 함께 확인할 수 있습니다."
          position="center 30%"
        />
        <PharmacyFinder command={command} />
        <EmergencyContacts />
        <Footer />
      </main>
    </div>
  )
}

function Footer() {
  return (
    <footer className="muted">
      출처: 식품의약품안전처 · 국립중앙의료원 · 건강보험심사평가원 · 행정안전부 (공공데이터포털) · 사진: Pixabay. 이 정보는 참고용이며 복용 전
      의사·약사와 상담하세요.
    </footer>
  )
}
