import { useEffect, useState } from 'react'
import { A11y, Keyboard, Navigation } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import 'swiper/css/navigation'
import { errorMessage, popularDrugs } from '../api/client.js'
import DrugCard from './DrugCard.jsx'

// 많이 찾는 의약품: 이 서비스의 상세 조회 수 순위. 조회 기록이 없으면 대표 상비약이 채워진다.
export default function PopularCarousel({ onOpen }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    popularDrugs(controller.signal)
      .then(setData)
      .catch((err) => {
        const message = errorMessage(err)
        if (message) setError(message)
      })
    return () => controller.abort()
  }, [])

  return (
    <section className="section">
      <div className="section-head">
        <h2>지금 많이 찾는 의약품</h2>
        <p className="muted">
          {data && !data.based_on_views
            ? '아직 조회 기록이 없어 대표 상비약을 보여드립니다. 조회가 쌓이면 순위가 바뀝니다.'
            : '이 서비스에서 많이 조회된 순서입니다.'}
        </p>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {!data && !error && (
        <div className="carousel-skeleton" role="status" aria-label="불러오는 중">
          {Array.from({ length: 5 }, (_, i) => <span key={i} />)}
        </div>
      )}

      {data && (
        <Swiper
          className="carousel"
          modules={[Navigation, Keyboard, A11y]}
          navigation
          keyboard
          slidesPerView="auto"
          spaceBetween={14}
          slidesPerGroupAuto
        >
          {data.items.map((item) => (
            <SwiperSlide key={item.drug.item_seq} className="carousel-slide">
              <DrugCard drug={item.drug} rank={item.rank} onOpen={onOpen} />
            </SwiperSlide>
          ))}
        </Swiper>
      )}
    </section>
  )
}
