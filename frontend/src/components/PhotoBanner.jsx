// 사진 위에 제목을 얹는 가로 배너. 사진은 장식용이라 alt 를 비운다.
// 사진 출처: Pixabay (https://pixabay.com) — Pixabay Content License
export default function PhotoBanner({ image, eyebrow, title, sub, position = 'center' }) {
  return (
    <div className="photo-banner">
      <img src={image} alt="" loading="lazy" decoding="async" style={{ objectPosition: position }} />
      <div className="photo-banner-text">
        {eyebrow && <p className="photo-banner-eyebrow">{eyebrow}</p>}
        <p className="photo-banner-title">{title}</p>
        {sub && <p className="photo-banner-sub">{sub}</p>}
      </div>
    </div>
  )
}
