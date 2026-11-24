import { describe, expect, it } from 'vitest'
import { judgeAnswer } from '../../src/learning/practice/answer'
import { generateEnglishQuestion } from '../../src/learning/practice/english-generator'
import {
  filterEnglishTemplates,
  getEnglishTemplate,
} from '../../src/learning/practice/english-templates'
import { generateComprehensivePaper, generateSpecialPaper } from '../../src/learning/practice/paper'
import type { Course } from '../../src/learning/types'

/** 三个学期英语课程包共用的结构与判分断言。 */
export function registerEnglishCoursePackTests(course: Course): void {
  const courseId = course.id
  const templates = filterEnglishTemplates({ courseId })

  describe(`${course.title}课程包`, () => {
    it('covers six units and every knowledge point with all four paper categories', () => {
      expect(templates).toHaveLength(30)
      expect(
        new Set(templates.map((template) => template.classification.knowledgePointId)),
      ).toEqual(new Set(course.knowledgePoints.map((point) => point.id)))
      expect(new Set(templates.map((template) => template.classification.unitId))).toEqual(
        new Set(course.units.map((unit) => unit.id)),
      )
      expect(new Set(templates.map((template) => template.paperCategory))).toEqual(
        new Set(['singleChoice', 'spelling', 'sentenceCompletion', 'situationalExpression']),
      )
      expect(templates.every((template) => template.classification.ability !== undefined)).toBe(
        true,
      )
      expect(templates.every((template) => template.classification.courseId === courseId)).toBe(
        true,
      )
    })

    it.each(templates.map((template) => [template.id, template.supportedDifficulties] as const))(
      '%s produces judge-correct answers and judge-wrong error causes',
      (templateId, difficulties) => {
        for (const difficulty of difficulties) {
          for (let seed = 0; seed < 100; seed += 1) {
            const question = generateEnglishQuestion(
              templateId,
              seed,
              `${courseId}-${seed}`,
              difficulty,
            )
            expect(question.classification.courseId).toBe(courseId)
            expect(question.resources).toHaveLength(0)
            expect(judgeAnswer(question, question.standardAnswer).correct).toBe(true)
            for (const rule of question.errorCauseRules) {
              for (const wrong of rule.answers) {
                const judgement = judgeAnswer(question, wrong)
                expect(judgement.correct).toBe(false)
                expect(judgement.cause?.id).toBe(rule.id)
              }
            }
            if (question.type === 'single-choice') {
              expect(question.options).toHaveLength(4)
              expect(new Set(question.options?.map((option) => option.text)).size).toBe(4)
            }
          }
        }
      },
    )

    it('builds a 12/6/9/3 comprehensive paper covering all three abilities', () => {
      const paper = generateComprehensivePaper({
        courseId,
        seed: 7,
        idPrefix: `${courseId}-daily`,
      })
      expect(paper.questions).toHaveLength(30)
      expect(paper.blueprint).toEqual({
        singleChoice: 12,
        spelling: 6,
        sentenceCompletion: 9,
        situationalExpression: 3,
      })
      const counts = {
        singleChoice: 0,
        spelling: 0,
        sentenceCompletion: 0,
        situationalExpression: 0,
      }
      for (const input of paper.questions) {
        counts[getEnglishTemplate(input.question.templateId).paperCategory] += 1
      }
      expect(counts).toEqual(paper.blueprint)
      const abilities = new Set(
        paper.questions.map((input) => input.question.classification.ability),
      )
      expect(abilities).toEqual(
        new Set(['english-vocabulary', 'english-sentence-grammar', 'english-situational']),
      )
      const situationUnits = new Set(
        paper.questions
          .filter(
            (input) =>
              getEnglishTemplate(input.question.templateId).paperCategory ===
              'situationalExpression',
          )
          .map((input) => input.question.classification.unitId),
      )
      expect(situationUnits.size).toBeGreaterThanOrEqual(2)
    })

    it('supports unit, knowledge point, ability and question type filters for special practice', () => {
      const unit = course.units[0]
      const byUnit = generateSpecialPaper({
        courseId,
        unitId: unit.id,
        difficulty: 'L2',
        seed: 5,
        idPrefix: `${courseId}-unit`,
      })
      expect(byUnit.questions).toHaveLength(10)
      expect(
        byUnit.questions.every((input) => input.question.classification.unitId === unit.id),
      ).toBe(true)
      const byAbility = generateSpecialPaper({
        courseId,
        ability: 'english-vocabulary',
        difficulty: 'L1',
        seed: 5,
        idPrefix: `${courseId}-vocab`,
      })
      expect(byAbility.questions).toHaveLength(10)
      expect(
        byAbility.questions.every(
          (input) => input.question.classification.ability === 'english-vocabulary',
        ),
      ).toBe(true)
      const byType = generateSpecialPaper({
        courseId,
        ability: 'english-sentence-grammar',
        questionType: 'sentence-completion',
        difficulty: 'L2',
        seed: 5,
        idPrefix: `${courseId}-sentence`,
      })
      expect(byType.questions.every((input) => input.question.type === 'sentence-completion')).toBe(
        true,
      )
      expect(() =>
        generateSpecialPaper({ courseId, difficulty: 'L2', seed: 5, idPrefix: `${courseId}-none` }),
      ).toThrow('专项练习必须选择')
      expect(() =>
        generateSpecialPaper({
          courseId,
          ability: 'english-situational',
          questionType: 'english-spelling',
          difficulty: 'L2',
          seed: 5,
          idPrefix: `${courseId}-mismatch`,
        }),
      ).toThrow('没有该题型')
    })
  })
}
