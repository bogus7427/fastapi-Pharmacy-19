import PriceInfo from './PriceInfo.jsx'
import SafeGuide from './SafeGuide.jsx'

const SECTIONS = [
  ['efficacy', '효능·효과'],
  ['usage', '용법·용량'],
  ['warning', '복용 전 꼭 알아야 할 경고'],
  ['caution', '복용 주의사항'],
  ['interaction', '함께 복용 시 주의할 약·음식'],
  ['side_effect', '이상반응'],
  ['storage', '보관 방법'],
]

export default function DrugDetail({ drug }) {
  const filled = SECTIONS.filter(([key]) => drug[key])

  return (
    <article className="card drug-detail">
      <header className="drug-head">
        {drug.image && <img src={drug.image} alt="" loading="lazy" />}
        <div>
          <h1>{drug.name}</h1>
          <p className="muted">{drug.company}</p>
        </div>
      </header>

      <SafeGuide drug={drug} />
      <PriceInfo drug={drug} />

      {filled.length === 0 ? (
        <p className="muted">이 의약품은 등록된 복용 정보가 없습니다. 약사에게 직접 문의해 주세요.</p>
      ) : (
        <dl>
          {filled.map(([key, label]) => (
            <div key={key} className={key === 'warning' ? 'section-text section-warn' : 'section-text'}>
              <dt>{label}</dt>
              <dd>{drug[key]}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  )
}
