import placeholder from '../assets/quick-drug.svg'

// 검색 결과 그리드와 인기 캐러셀에서 함께 쓰는 의약품 카드. rank 가 있으면 순위 숫자를 크게 보여준다.
export default function DrugCard({ drug, rank, onOpen }) {
  return (
    <button type="button" className="drug-card" onClick={() => onOpen(drug)}>
      <span className="drug-card-media">
        {drug.image ? (
          <img
            src={drug.image}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = placeholder
              e.currentTarget.classList.add('is-placeholder')
            }}
          />
        ) : (
          <img src={placeholder} alt="" className="is-placeholder" />
        )}
        {rank != null && <span className="drug-card-rank" aria-label={`${rank}위`}>{rank}</span>}
      </span>
      <span className="drug-card-body">
        <span className="drug-card-name">{drug.name}</span>
        <span className="muted">{drug.company || '제조사 정보 없음'}</span>
        {drug.efficacy && <span className="drug-card-desc">{drug.efficacy}</span>}
      </span>
    </button>
  )
}
