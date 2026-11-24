import { describe, expect, it } from 'vitest'
import { GRADE5_AUTUMN_ENGLISH_COURSE } from '../../../src/learning/content/course-registry'
import { judgeAnswer } from '../../../src/learning/practice/answer'
import { generateEnglishQuestion } from '../../../src/learning/practice/english-generator'
import { registerEnglishCoursePackTests } from '../../helpers/english-course-pack'

registerEnglishCoursePackTests(GRADE5_AUTUMN_ENGLISH_COURSE)

describe('grade 5 autumn english specifics', () => {
  it('accepts both declared negatives for the Is there question', () => {
    let checked = 0
    for (let seed = 0; seed < 60; seed += 1) {
      const question = generateEnglishQuestion(
        'g5a-english-in-a-nature-park-completion-v1',
        seed,
        `g5a-english-negative-${seed}`,
      )
      if (!question.prompt.includes('Is there a lake?')) continue
      checked += 1
      expect(
        judgeAnswer(question, { kind: 'sentence-completion', values: ["isn't"] }).correct,
      ).toBe(true)
      expect(
        judgeAnswer(question, { kind: 'sentence-completion', values: ['is not'] }).correct,
      ).toBe(true)
      expect(
        judgeAnswer(question, { kind: 'sentence-completion', values: ["aren't"] }).correct,
      ).toBe(false)
    }
    expect(checked).toBeGreaterThan(0)
  })
})
