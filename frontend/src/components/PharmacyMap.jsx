import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'

// 영업 상태별 마커. 응급실 지도와 같은 모양(.er-marker)을 쓴다.
export function openState(p) {
  if (p.is_open_now === true) return { key: 'ok', label: '영업 중' }
  if (p.is_open_now === false) return { key: 'full', label: '영업 종료' }
  return { key: 'unknown', label: '운영시간 정보 없음' }
}

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

// 말풍선. 공공 API 에서 온 문자열은 textContent 로만 넣는다.
function popupNode(p) {
  const state = openState(p)
  const box = el('div', 'er-popup')
  box.append(el('strong', null, p.name))
  box.append(el('span', `er-popup-beds er-${state.key}`, state.label))
  if (p.today_hours) box.append(el('span', 'er-popup-class', `오늘 ${p.today_hours}`))
  if (p.address) box.append(el('span', 'er-popup-class', p.address))
  if (p.tel) {
    const tel = el('a', null, `전화 ${p.tel}`)
    tel.href = `tel:${p.tel.replace(/[^0-9]/g, '')}`
    box.append(tel)
  }
  const route = el('a', null, '길찾기 (카카오맵)')
  route.href = `https://map.kakao.com/link/to/${encodeURIComponent(p.name)},${p.lat},${p.lon}`
  route.target = '_blank'
  route.rel = 'noreferrer'
  box.append(route)
  return box
}

// 약국 지도 (응급실 지도와 같은 Leaflet + OpenStreetMap).
// items: 표시할 약국, center: 검색 기준 위치, onPick: 지도를 눌렀을 때 그 좌표로 주변 검색
export default function PharmacyMap({ items, center, onPick }) {
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const centerRef = useRef(null)
  const pickRef = useRef(onPick)
  pickRef.current = onPick

  useEffect(() => {
    const map = L.map(mapEl.current, { scrollWheelZoom: false }).setView([37.5665, 126.978], 12)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자',
    }).addTo(map)
    map.on('click', (e) => pickRef.current?.(e.latlng.lat, e.latlng.lng))
    map.on('focus', () => map.scrollWheelZoom.enable())
    map.on('blur', () => map.scrollWheelZoom.disable())
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => map.remove()
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    layerRef.current.clearLayers()
    centerRef.current?.remove()
    centerRef.current = null
    const points = []
    items.forEach((p) => {
      if (p.lat == null || p.lon == null) return
      const s = openState(p)
      const marker = L.marker([p.lat, p.lon], {
        title: p.name,
        icon: L.divIcon({
          className: '',
          html: `<span class="er-marker er-${s.key}">약</span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -16],
        }),
      })
      marker.bindPopup(() => popupNode(p))
      marker.addTo(layerRef.current)
      points.push([p.lat, p.lon])
    })
    if (center) {
      centerRef.current = L.marker([center.lat, center.lon], {
        icon: L.divIcon({ className: '', html: '<span class="er-center"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        interactive: false,
        keyboard: false,
      }).addTo(map)
      points.push([center.lat, center.lon])
    }
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 16 })
  }, [items, center])

  return (
    <div className="pharmacy-map-wrap">
      <ul className="er-legend" aria-label="지도 표시 설명">
        <li><span className="er-marker er-ok">약</span>영업 중</li>
        <li><span className="er-marker er-full">약</span>영업 종료</li>
        <li><span className="er-marker er-unknown">약</span>운영시간 정보 없음</li>
      </ul>
      <div
        className="er-map pharmacy-map"
        ref={mapEl}
        role="application"
        aria-label="약국 지도. 지도를 누르면 그 위치 주변 1km 약국을 찾습니다."
      />
      <p className="muted er-note">지도를 누르면 그 위치 주변 1km 안의 약국을 찾습니다. 지도: OpenStreetMap</p>
    </div>
  )
}
