import heroPhoto from '../assets/photos/hero-pills.jpg'
import imgNearby from '../assets/quick-nearby.svg'
import SearchBar from './SearchBar.jsx'
import SymptomIcon from './SymptomIcon.jsx'

// term = e약은요 '효능' 검색어
export const SYMPTOMS = [
  { icon: 'headache', label: '두통', term: '두통' },
  { icon: 'cold', label: '감기', term: '감기' },
  { icon: 'stomach', label: '소화불량', term: '소화불량' },
  { icon: 'allergy', label: '알레르기', term: '알레르기' },
  { icon: 'muscle', label: '근육통', term: '근육통' },
  { icon: 'wound', label: '상처', term: '상처' },
  { icon: 'cough', label: '기침', term: '기침' },
  { icon: 'vitamin', label: '영양제', term: '비타민' },
]

// 메인 상단: 메디컬 사진 배경(Pixabay) + 약 검색창 + 증상별 퀵 버튼.
// 타일은 순서대로 떠오르며 등장하고, 호버 시 들리면서 아이콘이 커지고 하단 바가 차오른다. (CSS: .quick)
export default function Hero({ onSearch, onSymptom, onNearby, loading, activeSymptom }) {
  return (
    <section className="hero">
      <img className="hero-photo" src={heroPhoto} alt="" width="1280" height="853" fetchPriority="high" />
      <div className="hero-inner">
        <div className="hero-top">
          <div className="hero-copy">
            <p className="hero-eyebrow">의약품 · 전국 약국 검색</p>
            <h1>필요한 약, 문 연 약국을 바로 찾으세요</h1>
            <p className="hero-sub">
              약 이름이나 증상으로 복용 정보를 확인하고, 가까운 약국의 운영시간과 연락처를 한 번에 봅니다.
            </p>
            <div className="hero-actions">
              <button type="button" className="hero-cta" onClick={onNearby}>
                <img src={imgNearby} alt="" width="28" height="28" />
                내 주변 열린 약국 보기
              </button>
              <a className="hero-cta hero-cta-er" href="#er-map">
                <span className="hero-cta-cross" aria-hidden="true" />
                응급실 찾기
              </a>
            </div>
          </div>
        </div>

        <SearchBar onSearch={onSearch} loading={loading} />

        <div>
          <h2 className="hero-label">증상으로 찾기</h2>
          <ul className="quick-list">
            {SYMPTOMS.map((s, i) => (
              <li key={s.term} style={{ '--i': i }}>
                <button
                  type="button"
                  className={activeSymptom === s.term ? 'quick quick-on' : 'quick'}
                  onClick={() => onSymptom(s)}
                  aria-pressed={activeSymptom === s.term}
                >
                  <span className="quick-label">{s.label}</span>
                  <SymptomIcon name={s.icon} className="quick-img" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
