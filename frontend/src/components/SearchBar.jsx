import { useState } from 'react'

export default function SearchBar({ onSearch, loading }) {
  const [keyword, setKeyword] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const q = keyword.trim()
    if (q) onSearch(q)
  }

  return (
    <form className="searchbar" onSubmit={submit} role="search">
      <input
        id="drug-search"
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="약 이름을 입력하세요 (예: 타이레놀)"
        aria-label="의약품 이름"
        maxLength={50}
      />
      <button type="submit" disabled={loading || !keyword.trim()}>
        {loading ? '검색 중…' : '검색'}
      </button>
    </form>
  )
}
