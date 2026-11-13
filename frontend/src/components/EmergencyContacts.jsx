// 응급 상황에서 바로 걸 수 있는 전화번호. 휴대폰에서는 누르면 전화 앱이 열린다.
const CONTACTS = [
  { tel: '119', name: '응급 · 구급 · 화재', desc: '응급환자 이송, 응급처치 상담, 문 연 병원·약국 안내', urgent: true },
  { tel: '112', name: '경찰', desc: '범죄 · 사고 신고', urgent: true },
  { tel: '109', name: '자살예방 상담전화', desc: '24시간 위기 상담' },
  { tel: '1339', name: '질병관리청 콜센터', desc: '감염병 · 예방접종 상담' },
  { tel: '129', name: '보건복지상담센터', desc: '복지 지원 · 위기 상담' },
  { tel: '1644-6223', name: '한국의약품안전관리원', desc: '의약품 부작용 신고 · 피해구제 상담' },
  { tel: '110', name: '정부민원안내', desc: '어디에 물어볼지 모를 때' },
]

export default function EmergencyContacts() {
  return (
    <section className="section" aria-labelledby="emergency-title">
      <div className="section-head emergency-head">
        <h2 id="emergency-title">응급 연락처</h2>
        <p className="muted">생명이 위급하면 망설이지 말고 119에 먼저 전화하세요.</p>
      </div>

      <ul className="emergency-grid">
        {CONTACTS.map((c) => (
          <li key={c.tel}>
            <a
              className={c.urgent ? 'emergency emergency-urgent' : 'emergency'}
              href={`tel:${c.tel.replace(/-/g, '')}`}
              aria-label={`${c.name} ${c.tel} 전화 걸기`}
            >
              <span className="emergency-tel">{c.tel}</span>
              <span className="emergency-name">{c.name}</span>
              <span className="emergency-desc">{c.desc}</span>
            </a>
          </li>
        ))}
      </ul>

      <div className="emergency-er">
        <div>
          <strong>가까운 응급실 찾기</strong>
          <p className="muted">
            응급실 위치와 진료 가능 여부는 중앙응급의료센터 응급의료포털(E-Gen)에서 확인하거나 119에 문의하세요.
          </p>
        </div>
        <a className="btn" href="https://www.e-gen.or.kr/egen/search_emergency_room.do" target="_blank" rel="noreferrer">
          응급실 찾기 (새 창)
        </a>
      </div>
    </section>
  )
}
