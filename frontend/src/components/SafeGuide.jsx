import { buildGuide } from '../guide.js'

const ICONS = {
  how: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  care: 'M12 3 2 20h20L12 3z M12 10v5 M12 17.5v.5',
  keep: 'M4 8l8-4 8 4v9l-8 4-8-4V8z M4 8l8 4 8-4 M12 12v9',
}

const GROUPS = [
  ['how', '복용법', 'guide-how'],
  ['care', '주의', 'guide-care'],
  ['keep', '보관', 'guide-keep'],
]

// 안전 복용 가이드: 원문에서 뽑은 핵심 문구를 3개 묶음의 뱃지로 보여준다.
export default function SafeGuide({ drug }) {
  const guide = buildGuide(drug)
  const groups = GROUPS.filter(([key]) => guide[key].length > 0)

  if (groups.length === 0) {
    return (
      <section className="guide">
        <h3>한눈에 보는 안전 복용 가이드</h3>
        <p className="muted">요약할 수 있는 복용 정보가 없습니다. 아래 원문을 확인하거나 약사에게 문의해 주세요.</p>
      </section>
    )
  }

  return (
    <section className="guide">
      <h3>한눈에 보는 안전 복용 가이드</h3>
      <div className="guide-grid">
        {groups.map(([key, title, cls]) => (
          <div key={key} className={`guide-group ${cls}`}>
            <p className="guide-title">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={ICONS[key]} />
              </svg>
              {title}
            </p>
            <ul>
              {guide[key].map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="muted">원문에서 자동으로 뽑은 요약입니다. 정확한 내용은 아래 원문을 확인하고, 복용 전 약사와 상담하세요.</p>
    </section>
  )
}
