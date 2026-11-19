import { describe, expect, it } from 'vitest'
import { GRADE4_AUTUMN_MATH_COURSE } from '../../../src/learning/content/grade4-math'
import { parseCourse } from '../../../src/learning/contracts'

describe('grade 4 autumn integrated mathematics course', () => {
  it('is valid and uses the complete course classification', () => {
    expect(() => parseCourse(GRADE4_AUTUMN_MATH_COURSE)).not.toThrow()
    expect(GRADE4_AUTUMN_MATH_COURSE).toMatchObject({
      subject: 'math',
      grade: 4,
      semester: 'autumn',
      textbook: '人教版新旧融合',
    })
    expect(GRADE4_AUTUMN_MATH_COURSE.units.map((unit) => unit.order)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('includes two-digit division as old-edition supplementary content', () => {
    const division = GRADE4_AUTUMN_MATH_COURSE.knowledgePoints.find(
      (point) => point.id === 'written-division-by-two-digits',
    )
    expect(division).toMatchObject({
      name: '两、三位数除以两位数',
      source: 'old-pep',
      unitId: 'written-division',
    })
    expect(
      GRADE4_AUTUMN_MATH_COURSE.knowledgePoints.some(
        (point) => point.id === 'division-with-remainder',
      ),
    ).toBe(true)
  })

  it('retains new, old and review source labels', () => {
    expect(new Set(GRADE4_AUTUMN_MATH_COURSE.knowledgePoints.map((point) => point.source))).toEqual(
      new Set(['new-pep', 'old-pep', 'review']),
    )
    expect(
      GRADE4_AUTUMN_MATH_COURSE.knowledgePoints.find((point) => point.id === 'product-change-rule')
        ?.source,
    ).toBe('new-pep')
    expect(
      GRADE4_AUTUMN_MATH_COURSE.knowledgePoints.find(
        (point) => point.id === 'prior-basic-calculation-review',
      )?.source,
    ).toBe('review')
  })

  it('does not introduce decimal, fraction or systematic mixed-operation content', () => {
    const content = JSON.stringify(GRADE4_AUTUMN_MATH_COURSE)
    expect(content).not.toMatch(/小数|分数|混合运算|运算定律|中括号|奥数/)
  })
})
