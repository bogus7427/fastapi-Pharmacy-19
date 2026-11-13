import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { errorMessage, nearbyEmergency, searchEmergency } from '../api/client.js'

const SIDO = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시',
  '울산광역시', '세종특별자치시', '경기도', '강원특별자치도', '충청북도', '충청남도',
  '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
]

// 가용 병상으로 상태를 나눈다. 실시간 정보를 내지 않는 기관은 '정보 없음'.
function bedState(room) {
  if (!room.has_realtime || room.beds_available == null) return { key: 'unknown', label: '병상 정보 없음', mark: '?' }
  if (room.beds_available > 0) return { key: 'ok', label: `가용 ${room.beds_available}병상`, mark: String(room.beds_available) }
  return { key: 'full', label: '가용 병상 없음', mark: '0' }
}

const timeOf = (iso) => (iso ? iso.slice(11, 16) : null)
const routeUrl = (r) => `https://map.kakao.com/link/to/${encodeURIComponent(r.name)},${r.lat},${r.lon}`

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

// 마커 말풍선. 공공 API 에서 온 문자열을 textContent 로만 넣는다.
function popupNode(room) {
  const state = bedState(room)
  const box = el('div', 'er-popup')
  box.append(el('strong', null, room.name), el('span', 'er-popup-class', room.er_class))
  box.append(el('span', `er-popup-beds er-${state.key}`, state.label))
  if (room.tel) {
    const tel = el('a', null, `전화 ${room.tel}`)
    tel.href = `tel:${room.tel.replace(/[^0-9]/g, '')}`
    box.append(tel)
  }
  const route = el('a', null, '길찾기 (카카오맵)')
  route.href = routeUrl(room)
  route.target = '_blank'
  route.rel = 'noreferrer'
  box.append(route)
  return box
}

// 응급실 지도. 지역 검색, 내 위치 검색, 지도를 눌러 그 지점 주변 검색을 지원한다.
export default function EmergencyMap() {
  const [form, setForm] = useState({ sido: '서울특별시', sigungu: '' })
  const [state, setState] = useState({ status: 'idle', items: [], warnings: [], error: null, title: '' })
  const [selected, setSelected] = useState(null)
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const markersRef = useRef(new Map())
  const centerRef = useRef(null)
  const abortRef = useRef(null)
  const nearbyRef = useRef(null)

  const run = async (title, loader) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setSelected(null)
    setState((s) => ({ ...s, status: 'loading', error: null }))
    try {
      const data = await loader(controller.signal)
      setState({ status: 'done', items: data.items, warnings: data.warnings, error: null, title })
    } catch (err) {
      const message = errorMessage(err)
      if (message) setState((s) => ({ ...s, status: 'error', error: message }))
    }
  }

  const showCenter = (lat, lon) => {
    centerRef.current?.remove()
    centerRef.current = L.marker([lat, lon], {
      icon: L.divIcon({ className: '', html: '<span class="er-center"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      interactive: false,
      keyboard: false,
    }).addTo(mapRef.current)
  }

  const searchRegion = () => {
    centerRef.current?.remove()
    centerRef.current = null
    run(`${form.sido} ${form.sigungu}`.trim(), (signal) => searchEmergency(form, signal))
  }

  const searchNearby = (lat, lon, title) => {
    showCenter(lat, lon)
    run(title, (signal) => nearbyEmergency(lat, lon, signal))
  }
  nearbyRef.current = searchNearby

  const searchMine = () => {
    const fail = (error) => setState((s) => ({ ...s, status: 'error', error }))
    if (!navigator.geolocation || !window.isSecureContext) {
      fail('이 주소에서는 브라우저가 위치 기능을 허용하지 않습니다. 지도에서 원하는 위치를 누르면 그 주변 응급실을 찾습니다.')
      return
    }
    setState((s) => ({ ...s, status: 'loading', error: null }))
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => searchNearby(coords.latitude, coords.longitude, '내 위치에서 가까운 순'),
      () => fail('위치를 확인하지 못했습니다. 위치 권한을 허용하거나, 지도에서 원하는 위치를 눌러 주세요.'),
      { timeout: 10000 },
    )
  }

  // 지도 생성 (한 번만)
  useEffect(() => {
    const map = L.map(mapEl.current, { scrollWheelZoom: false }).setView([37.5665, 126.978], 11)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자',
    }).addTo(map)
    map.on('click', (e) => nearbyRef.current(e.latlng.lat, e.latlng.lng, '선택한 위치에서 가까운 순'))
    map.on('focus', () => map.scrollWheelZoom.enable())
    map.on('blur', () => map.scrollWheelZoom.disable())
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    searchRegion() // 처음에는 서울을 보여 준다
    return () => {
      abortRef.current?.abort()
      map.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visible = onlyAvailable ? state.items.filter((r) => bedState(r).key === 'ok') : state.items

  // 목록이 바뀌면 마커를 다시 그린다
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    layerRef.current.clearLayers()
    markersRef.current.clear()
    visible.forEach((room) => {
      const s = bedState(room)
      const marker = L.marker([room.lat, room.lon], {
        title: room.name,
        icon: L.divIcon({
          className: '',
          html: `<span class="er-marker er-${s.key}">${s.mark}</span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -16],
        }),
      })
      marker.bindPopup(() => popupNode(room))
      marker.on('click', () => setSelected(room.id))
      marker.addTo(layerRef.current)
      markersRef.current.set(room.id, marker)
    })
    const points = visible.map((r) => [r.lat, r.lon])
    if (centerRef.current) points.push(centerRef.current.getLatLng())
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 14 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.items, onlyAvailable])

  const focusRoom = (room) => {
    setSelected(room.id)
    mapRef.current.setView([room.lat, room.lon], Math.max(mapRef.current.getZoom(), 14))
    markersRef.current.get(room.id)?.openPopup()
  }

  const latest = state.items.map((r) => r.updated_at).filter(Boolean).sort().at(-1)

  return (
    <section className="section" id="er-map" aria-labelledby="er-map-title">
      <div className="section-head emergency-head">
        <h2 id="er-map-title">응급실 찾기</h2>
        <p className="muted">
          응급실 위치와 실시간 가용 병상을 지도에서 확인하세요. 병상 수는 병원이 입력한 값이라 실제와 다를 수 있으니, 출발 전에
          전화로 확인하거나 119에 문의하세요.
        </p>
      </div>

      <form
        className="finder-form"
        onSubmit={(e) => {
          e.preventDefault()
          searchRegion()
        }}
      >
        <button type="button" onClick={searchMine} disabled={state.status === 'loading'}>내 위치로 찾기</button>
        <select value={form.sido} onChange={(e) => setForm({ ...form, sido: e.target.value })} aria-label="시·도">
          {SIDO.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          value={form.sigungu}
          onChange={(e) => setForm({ ...form, sigungu: e.target.value })}
          placeholder="시·군·구 (예: 종로구)"
          aria-label="시·군·구"
          maxLength={20}
        />
        <button type="submit" className="btn-ghost" disabled={state.status === 'loading'}>지역 검색</button>
      </form>

      <div className="er-toolbar">
        <label className="check">
          <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
          가용 병상이 있는 곳만 보기
        </label>
        <ul className="er-legend" aria-label="지도 표시 설명">
          <li><span className="er-marker er-ok">5</span>가용 병상 수</li>
          <li><span className="er-marker er-full">0</span>병상 없음</li>
          <li><span className="er-marker er-unknown">?</span>정보 없음</li>
        </ul>
      </div>

      {state.status === 'error' && <p className="error" role="alert">{state.error}</p>}
      {state.warnings.map((w) => (
        <p key={w} className="warn">{w}</p>
      ))}

      <div className="er-layout">
        <div className="er-map" ref={mapEl} role="application" aria-label="응급실 지도. 지도를 누르면 그 위치 주변 응급실을 찾습니다." />

        <div className="er-side">
          <p className="muted" role="status">
            {state.status === 'loading' && '응급실 정보를 불러오는 중…'}
            {state.status === 'done' &&
              `${state.title} · ${visible.length}곳${latest ? ` · 병상 ${timeOf(latest)} 기준` : ''}`}
          </p>
          {state.status === 'done' && visible.length === 0 && (
            <p className="muted">조건에 맞는 응급실이 없습니다. 시·군·구를 지우거나 필터를 꺼 보세요.</p>
          )}
          <ul className="er-list">
            {visible.map((room) => {
              const s = bedState(room)
              return (
                <li key={room.id} className={selected === room.id ? 'er-item er-item-on' : 'er-item'}>
                  <button type="button" className="er-item-main" onClick={() => focusRoom(room)}>
                    <span className={`er-marker er-${s.key}`} aria-hidden="true">{s.mark}</span>
                    <span className="er-item-text">
                      <strong>{room.name}</strong>
                      <span className="muted">
                        {room.er_class}
                        {room.distance_km != null && ` · ${room.distance_km.toFixed(1)}km`}
                      </span>
                      <span className={`er-beds er-text-${s.key}`}>
                        {s.label}
                        {s.key !== 'unknown' && room.beds_total != null && ` / 전체 ${room.beds_total}`}
                      </span>
                    </span>
                  </button>
                  <div className="er-item-actions">
                    {room.tel && <a className="btn" href={`tel:${room.tel.replace(/[^0-9]/g, '')}`}>전화 {room.tel}</a>}
                    <a className="btn btn-ghost" href={routeUrl(room)} target="_blank" rel="noreferrer">길찾기</a>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
      <p className="muted er-note">
        지도를 누르면 그 위치에서 가까운 응급실 20곳을 찾습니다. 출처: 국립중앙의료원 응급의료기관 정보 · 지도: OpenStreetMap
      </p>
    </section>
  )
}
