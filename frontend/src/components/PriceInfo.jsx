// 가격 표시 + 가격이 없을 때의 대체 UI.
// 공공데이터에는 약국별 판매가가 없으므로 price 는 대부분 null 이다.
// 그 경우 빈칸 대신 "왜 없는지"와 "대신 볼 수 있는 정보(약 종류·복용 정보)"를 보여준다.
export default function PriceInfo({ drug }) {
  if (typeof drug.price === 'number' && drug.price > 0) {
    return (
      <div className="price">
        <span className="price-label">참고 가격</span>
        <strong>{drug.price.toLocaleString('ko-KR')}원</strong>
      </div>
    )
  }

  const available = [
    drug.efficacy && '효능·효과',
    drug.usage && '용법·용량',
    (drug.warning || drug.caution) && '복용 주의사항',
  ].filter(Boolean)

  return (
    <div className="price price-none">
      <span className="price-label">가격 정보 없음</span>
      <p>{drug.price_note || '가격 정보가 제공되지 않는 의약품입니다.'}</p>
      <p className="muted">
        {available.length > 0
          ? `대신 ${available.join(', ')} 정보를 아래에서 확인할 수 있습니다. 정확한 가격은 약국에 전화로 문의하세요.`
          : '정확한 가격은 약국에 전화로 문의하세요.'}
      </p>
    </div>
  )
}
