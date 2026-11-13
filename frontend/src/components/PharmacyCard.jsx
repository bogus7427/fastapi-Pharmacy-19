import { useState } from 'react'
import ReviewPanel from './ReviewPanel.jsx'

function OpenBadge({ isOpen }) {
  if (isOpen === true) return <span className="badge badge-open">영업 중</span>
  if (isOpen === false) return <span className="badge badge-closed">영업 종료</span>
  return <span className="badge">운영시간 미확인</span>
}

export default function PharmacyCard({ pharmacy: p, drugName }) {
  const [showReviews, setShowReviews] = useState(false)
  const [count, setCount] = useState(p.review_count ?? 0)
  const tel = (p.tel || '').replace(/[^0-9+]/g, '')
  // 심야: 오늘 22시 이후까지(또는 자정 넘어) 운영. 휴일: 일요일·공휴일 운영시간이 등록됨.
  const close = p.today_hours?.match(/~(\d{2}):/)?.[1]
  const isNight = close != null && (Number(close) >= 22 || Number(close) <= 5)
  const isHoliday = p.hours?.some((h) => h.day === '일' || h.day === '공휴일')
  const mapUrl =
    p.lat && p.lon
      ? `https://map.kakao.com/link/map/${encodeURIComponent(p.name)},${p.lat},${p.lon}`
      : null

  return (
    <li className="card pharmacy">
      <div className="pharmacy-head">
        <h3>{p.name}</h3>
        <div className="badges">
          <OpenBadge isOpen={p.is_open_now} />
          {isNight && <span className="badge badge-night">심야 운영</span>}
          {isHoliday && <span className="badge badge-holiday">휴일 운영</span>}
          {p.license_status && <span className="badge badge-ok">인허가 {p.license_status}</span>}
        </div>
      </div>

      <p>{p.address || '주소 정보 없음'}</p>
      <p className="muted">
        {p.distance_m != null && <>약 {p.distance_m.toLocaleString('ko-KR')}m · </>}
        {p.today_hours ? `오늘 ${p.today_hours}` : '오늘 운영시간 정보 없음'}
      </p>

      {p.hours?.length > 0 && (
        <details>
          <summary>요일별 운영시간</summary>
          <ul className="hours">
            {p.hours.map((h) => (
              <li key={h.day}>
                <span>{h.day}</span> {h.open}~{h.close}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="actions">
        {tel ? (
          <a className="btn" href={`tel:${tel}`}>
            {drugName ? '전화로 재고·가격 문의' : '전화하기'} ({p.tel})
          </a>
        ) : (
          <span className="muted">전화번호 정보 없음</span>
        )}
        {mapUrl && (
          <a className="btn btn-ghost" href={mapUrl} target="_blank" rel="noreferrer">
            지도 보기
          </a>
        )}
        <button type="button" className="btn-ghost" onClick={() => setShowReviews((v) => !v)} aria-expanded={showReviews}>
          {showReviews ? '후기 닫기' : `후기·보유 약 제보 ${count}건`}
        </button>
      </div>

      {showReviews && <ReviewPanel pharmacy={p} drugName={drugName} onCountChange={setCount} />}
    </li>
  )
}
