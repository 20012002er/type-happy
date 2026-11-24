import { describe, expect, it } from 'vitest'
import { GRADE4_SPRING_ENGLISH_COURSE } from '../../../src/learning/content/course-registry'
import { judgeAnswer } from '../../../src/learning/practice/answer'
import { generateEnglishQuestion } from '../../../src/learning/practice/english-generator'
import { registerEnglishCoursePackTests } from '../../helpers/english-course-pack'

registerEnglishCoursePackTests(GRADE4_SPRING_ENGLISH_COURSE)

describe('grade 4 spring english specifics', () => {
  it('judges spelling case-insensitively and rejects declared misspellings', () => {
    const question = generateEnglishQuestion(
      'g4s-english-my-school-spelling-v1',
      0,
      'g4s-english-spelling-case',
    )
    expect(question.type).toBe('english-spelling')
    if (question.standardAnswer.kind === 'english-spelling') {
      const upper = question.standardAnswer.value.toUpperCase()
      expect(
        judgeAnswer(question, { kind: 'english-spelling', value: `  ${upper} ` }).correct,
      ).toBe(true)
    }
    for (const rule of question.errorCauseRules) {
      for (const wrong of rule.answers) {
        expect(judgeAnswer(question, wrong).correct).toBe(false)
      }
    }
  })

  it('keeps every question free of audio resources', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const question = generateEnglishQuestion(
        'g4s-english-shopping-situation-v1',
        seed,
        `g4s-english-audio-${seed}`,
      )
      expect(question.resources).toEqual([])
    }
  })
})
