import { describe, expect, it } from 'vitest'
import { GRADE5_SPRING_ENGLISH_COURSE } from '../../../src/learning/content/course-registry'
import { judgeAnswer } from '../../../src/learning/practice/answer'
import { generateEnglishQuestion } from '../../../src/learning/practice/english-generator'
import { registerEnglishCoursePackTests } from '../../helpers/english-course-pack'

registerEnglishCoursePackTests(GRADE5_SPRING_ENGLISH_COURSE)

describe('grade 5 spring english specifics', () => {
  it('accepts both declared season words for the apple-picking context', () => {
    let checked = 0
    for (let seed = 0; seed < 60; seed += 1) {
      const question = generateEnglishQuestion(
        'g5s-english-my-favourite-season-completion-v1',
        seed,
        `g5s-english-season-${seed}`,
      )
      if (!question.prompt.includes('pick apples')) continue
      checked += 1
      expect(
        judgeAnswer(question, { kind: 'sentence-completion', values: ['autumn'] }).correct,
      ).toBe(true)
      expect(judgeAnswer(question, { kind: 'sentence-completion', values: ['fall'] }).correct).toBe(
        true,
      )
      expect(
        judgeAnswer(question, { kind: 'sentence-completion', values: ['summer'] }).correct,
      ).toBe(false)
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('accepts both full and abbreviated ordinal forms for dates', () => {
    let checked = 0
    for (let seed = 0; seed < 60; seed += 1) {
      const question = generateEnglishQuestion(
        'g5s-english-when-is-the-art-show-completion-v1',
        seed,
        `g5s-english-ordinal-${seed}`,
      )
      if (!question.prompt.includes('（第四）')) continue
      checked += 1
      expect(
        judgeAnswer(question, { kind: 'sentence-completion', values: ['fourth'] }).correct,
      ).toBe(true)
      expect(judgeAnswer(question, { kind: 'sentence-completion', values: ['4th'] }).correct).toBe(
        true,
      )
      expect(
        judgeAnswer(question, { kind: 'sentence-completion', values: ['forth'] }).correct,
      ).toBe(false)
    }
    expect(checked).toBeGreaterThan(0)
  })
})
