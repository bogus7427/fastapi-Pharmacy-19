// 복용 정보 원문(자유 서술)에서 "식후 30분", "1일 3회" 같은 핵심 문구를 뽑아 뱃지로 만든다.
// 원칙: 잘못 요약하느니 보여주지 않는다. 연령별로 용량이 여러 개면 숫자를 고르지 않고 "원문 확인"으로 안내한다.

const uniq = (list) => [...new Set(list.map((s) => s.replace(/\s+/g, ' ').trim()))]
const all = (text, re) => uniq([...text.matchAll(re)].map((m) => m[0]))

function howBadges(usage) {
  const out = []

  const timing = all(usage, /(식사\s?(전|후)|식후|식전|식간)(\s?\d+\s?분)?(\s?(이내|전|후))?/g)
  timing.slice(0, 2).forEach((t) => out.push(t))
  // "공복시를 피해 복용" 은 공복 복용의 반대이므로 따로 구분한다.
  if (/공복[^.\n]{0,8}피/.test(usage)) out.push('공복 피하기')
  else if (/공복/.test(usage)) out.push('공복 관련 안내 · 원문 확인')
  const bedtime = usage.match(/취침\s?(전|시)/)
  if (bedtime) out.push(bedtime[0])

  const doses = all(usage, /1회\s?\d+(\s?[~∼-]\s?\d+)?\s?(정|캡슐|포|병|환|mL|ml|밀리리터)/g)
  const freqMatches = [...usage.matchAll(/1일\s?\d+(\s?[~∼-]\s?\d+)?\s?회/g)]
  const freqs = uniq(freqMatches.map((m) => m[0]))
  const ages = all(usage, /만\s?\d+\s?세/g)
  const varies = doses.length > 1 || freqs.length > 1 || ages.length > 1

  if (varies) {
    out.push('연령·체중별 용량 다름 · 원문 확인')
  } else {
    if (doses[0]) out.push(doses[0])
    if (freqMatches[0]) {
      // "1일 5회를 초과하지 않습니다" 는 복용 횟수가 아니라 상한이다.
      const after = usage.slice(freqMatches[0].index, freqMatches[0].index + 30)
      out.push(/초과|넘지|까지|이상\s?복용하지/.test(after) ? freqs[0].replace('1일', '1일 최대') : freqs[0])
    }
    const age = usage.match(/만\s?\d+\s?세\s?(이상|미만|이하)/)
    if (age) out.push(age[0])
  }

  const interval = usage.match(/\d+(\s?[~∼-]\s?\d+)?\s?시간\s?(마다|간격)/)
  if (interval) out.push(interval[0].replace('마다', ' 간격').replace(/\s+/g, ' '))
  const gap = usage.match(/복용\s?간격은?\s?(\d+)\s?시간\s?이상/)
  if (gap) out.push(`복용 간격 ${gap[1]}시간 이상`)
  return uniq(out)
}

const CARE_RULES = [
  [/음주|알코올|술을|술\s?마/, '음주 시 주의'],
  [/임부|임신|수유/, '임신·수유 중 상담'],
  [/운전|기계\s?조작/, '운전·기계 조작 주의'],
  [/졸음/, '졸음 주의'],
  [/소아|어린이|영아|유아/, '어린이 복용 전 확인'],
  [/고령자|노인/, '고령자 주의'],
  [/간장애|간질환|간\s?손상|간기능/, '간 질환 시 상담'],
  [/신장|콩팥/, '신장 질환 시 상담'],
  [/위궤양|위장출혈|소화성궤양|위장관\s?출혈/, '위장 질환 시 상담'],
]

const KEEP_RULES = [
  [/냉장|냉소/, '냉장 보관'],
  [/실온/, '실온 보관'],
  [/습기/, '습기 피하기'],
  [/빛|차광|직사광선/, '빛 피하기'],
  [/어린이의?\s?손/, '어린이 손 닿지 않게'],
]

export function buildGuide(drug) {
  const warn = `${drug.warning || ''} ${drug.caution || ''}`
  const care = CARE_RULES.filter(([re]) => re.test(warn)).map(([, label]) => label)
  if (drug.interaction) care.push('함께 먹는 약 확인')
  return {
    how: howBadges(drug.usage || ''),
    care,
    keep: KEEP_RULES.filter(([re]) => re.test(drug.storage || '')).map(([, label]) => label),
  }
}
