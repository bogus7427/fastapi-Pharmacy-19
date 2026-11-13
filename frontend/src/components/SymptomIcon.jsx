// 증상별 아이콘 (직접 그린 2색 SVG). 색은 브랜드 청록 + 코랄 포인트.
const T = '#00a4ad'
const C = '#ff6b5e'
const L = '#b9e3e6'

const SHAPES = {
  headache: (
    <>
      <path d="M14 30a18 18 0 1 1 30 13v9H24v-7h-5a4 4 0 0 1-4-4v-5l-4-2z" fill={T} />
      <path d="M36 8l-7 12h7l-5 12 13-16h-7l5-8z" fill={C} stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  cold: (
    <>
      <rect x="26" y="6" width="12" height="36" rx="6" fill={L} />
      <circle cx="32" cy="46" r="12" fill={T} />
      <rect x="29" y="20" width="6" height="26" rx="3" fill={C} />
      <circle cx="32" cy="46" r="6" fill={C} />
      <path d="M44 14h8M44 22h6M44 30h8" stroke={T} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  stomach: (
    <>
      <path d="M26 6v12c0 6-12 8-12 22a14 14 0 0 0 14 14c14 0 12-12 20-12h6V30h-6c-6 0-10-4-10-10V6z" fill={T} />
      <path d="M22 40a6 6 0 0 0 6 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="46" cy="14" r="4" fill={C} />
      <circle cx="54" cy="22" r="2.5" fill={C} />
    </>
  ),
  allergy: (
    <>
      <g fill={T}>
        <circle cx="32" cy="16" r="9" /><circle cx="47" cy="27" r="9" /><circle cx="41" cy="45" r="9" />
        <circle cx="23" cy="45" r="9" /><circle cx="17" cy="27" r="9" />
      </g>
      <circle cx="32" cy="32" r="8" fill={C} />
      <circle cx="54" cy="10" r="2.5" fill={C} /><circle cx="8" cy="12" r="2" fill={C} /><circle cx="56" cy="50" r="2" fill={C} />
    </>
  ),
  muscle: (
    <>
      <rect x="18" y="28" width="28" height="8" fill={L} />
      <rect x="8" y="16" width="10" height="32" rx="3" fill={T} />
      <rect x="46" y="16" width="10" height="32" rx="3" fill={T} />
      <rect x="2" y="24" width="6" height="16" rx="2" fill={C} />
      <rect x="56" y="24" width="6" height="16" rx="2" fill={C} />
    </>
  ),
  wound: (
    <g transform="rotate(-40 32 32)">
      <rect x="4" y="20" width="56" height="24" rx="12" fill={T} />
      <rect x="22" y="20" width="20" height="24" fill="#fff" />
      <g fill={C}><circle cx="28" cy="27" r="2" /><circle cx="36" cy="27" r="2" /><circle cx="28" cy="37" r="2" /><circle cx="36" cy="37" r="2" /></g>
    </g>
  ),
  cough: (
    <>
      <path d="M14 22c10-6 26-6 36 0v16c-10 8-26 8-36 0z" fill={T} />
      <path d="M14 26H6m8 10H6m44-10h8m-8 10h8" stroke={L} strokeWidth="4" strokeLinecap="round" />
      <path d="M22 28h20M22 34h20" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="52" r="3" fill={C} /><circle cx="40" cy="56" r="2" fill={C} />
    </>
  ),
  vitamin: (
    <>
      <g transform="rotate(-40 28 30)">
        <rect x="4" y="19" width="48" height="22" rx="11" fill={T} />
        <path d="M28 19h13a11 11 0 0 1 0 22H28z" fill={C} />
      </g>
      <path d="M48 40v16m-8-8h16" stroke={T} strokeWidth="5" strokeLinecap="round" />
    </>
  ),
}

export default function SymptomIcon({ name, className }) {
  return (
    <svg className={className} viewBox="0 0 64 64" width="44" height="44" fill="none" aria-hidden="true">
      {SHAPES[name]}
    </svg>
  )
}
