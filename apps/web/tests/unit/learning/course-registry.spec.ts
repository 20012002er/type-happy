import { describe, expect, it } from 'vitest'
import {
  COURSE_AVAILABILITY,
  COURSE_REGISTRY,
  DEFAULT_COURSE_ID,
  GRADE4_SPRING_ENGLISH_COURSE,
  GRADE4_SPRING_MATH_COURSE,
  GRADE5_AUTUMN_ENGLISH_COURSE,
  GRADE5_AUTUMN_MATH_COURSE,
  GRADE5_SPRING_ENGLISH_COURSE,
  GRADE5_SPRING_MATH_COURSE,
  getCourseAvailability,
  getCourseById,
} from '../../../src/learning/content/course-registry'
import { GRADE4_AUTUMN_MATH_COURSE } from '../../../src/learning/content/grade4-math'
import { parseCourse } from '../../../src/learning/contracts'
import type { Course, LearningAbility } from '../../../src/learning/types'

const NEW_COURSES = [
  { prefix: 'g4s-', course: GRADE4_SPRING_MATH_COURSE },
  { prefix: 'g5a-', course: GRADE5_AUTUMN_MATH_COURSE },
  { prefix: 'g5s-', course: GRADE5_SPRING_MATH_COURSE },
  { prefix: 'g4s-', course: GRADE4_SPRING_ENGLISH_COURSE },
  { prefix: 'g5a-', course: GRADE5_AUTUMN_ENGLISH_COURSE },
  { prefix: 'g5s-', course: GRADE5_SPRING_ENGLISH_COURSE },
] as const

const MATH_SCOPES = [
  {
    courseId: 'pep-grade4-spring-math',
    units: [
      '四则运算',
      '运算定律',
      '小数的意义和性质',
      '小数加法和减法',
      '三角形',
      '观察物体与图形运动',
      '平均数与条形统计图',
      '综合应用',
    ],
  },
  {
    courseId: 'pep-grade5-autumn-math',
    units: ['小数乘法', '小数除法', '位置', '可能性', '简易方程', '多边形面积', '植树问题'],
  },
  {
    courseId: 'pep-grade5-spring-math',
    units: [
      '因数与倍数',
      '长方体和正方体',
      '分数的意义和性质',
      '分数加法和减法',
      '图形运动',
      '折线统计图',
      '找次品',
    ],
  },
] as const

const ENGLISH_SCOPES = [
  {
    courseId: 'pep-grade4-spring-english',
    units: ['My school', 'What time is it?', 'Weather', 'At the farm', 'My clothes', 'Shopping'],
  },
  {
    courseId: 'pep-grade5-autumn-english',
    units: [
      "What's he like?",
      'My week',
      'What would you like?',
      'What can you do?',
      'There is a big bed',
      'In a nature park',
    ],
  },
  {
    courseId: 'pep-grade5-spring-english',
    units: [
      'My day',
      'My favourite season',
      'My school calendar',
      'When is the art show?',
      'Whose dog is it?',
      'Work quietly!',
    ],
  },
] as const

function requireCourse(courseId: string): Course {
  const course = getCourseById(courseId)
  if (!course) throw new Error(`Missing test course: ${courseId}`)
  return course
}

describe('course registry', () => {
  it('registers the legacy course and six new courses in the required order', () => {
    expect(DEFAULT_COURSE_ID).toBe('pep-grade4-autumn-integrated-math')
    expect(COURSE_REGISTRY.map((course) => course.id)).toEqual([
      'pep-grade4-autumn-integrated-math',
      'pep-grade4-spring-math',
      'pep-grade5-autumn-math',
      'pep-grade5-spring-math',
      'pep-grade4-spring-english',
      'pep-grade5-autumn-english',
      'pep-grade5-spring-english',
    ])
    expect(new Set(COURSE_REGISTRY.map((course) => course.id)).size).toBe(7)
  })

  it('keeps the legacy course object, unit IDs and knowledge point IDs unchanged', () => {
    expect(COURSE_REGISTRY[0]).toBe(GRADE4_AUTUMN_MATH_COURSE)
    expect(GRADE4_AUTUMN_MATH_COURSE).toMatchObject({
      id: 'pep-grade4-autumn-integrated-math',
      title: '人教版四上综合计算（新旧融合）',
      textbook: '人教版新旧融合',
    })
    expect(GRADE4_AUTUMN_MATH_COURSE.units.map((unit) => unit.id)).toEqual([
      'oral-calculation',
      'written-multiplication',
      'written-division',
      'change-rules',
      'estimation-verification',
      'prior-review',
    ])
    expect(GRADE4_AUTUMN_MATH_COURSE.knowledgePoints.map((point) => point.id)).toEqual([
      'oral-multiplication-by-one-digit',
      'oral-multiplication-by-tens',
      'oral-division-by-tens',
      'written-multiplication-two-digits',
      'written-multiplication-three-by-two',
      'written-multiplication-with-zero',
      'written-division-by-two-digits',
      'trial-quotient-and-adjustment',
      'division-with-remainder',
      'product-change-rule',
      'quotient-change-rule',
      'multiplication-estimation',
      'division-estimation-verification',
      'prior-basic-calculation-review',
    ])
  })

  it('parses all six complete new courses with versioned PEP metadata', () => {
    expect(NEW_COURSES).toHaveLength(6)
    for (const { course } of NEW_COURSES) {
      expect(() => parseCourse(course)).not.toThrow()
      expect(parseCourse(course)).toEqual(course)
      expect(course).toMatchObject({ version: 1, textbook: '人教版 PEP' })
    }
  })

  it('keeps unit orders consecutive and every knowledge point reference valid', () => {
    for (const course of COURSE_REGISTRY) {
      expect(course.units.map((unit) => unit.order)).toEqual(
        course.units.map((_, index) => index + 1),
      )
      expect(new Set(course.units.map((unit) => unit.id)).size).toBe(course.units.length)
      for (const unit of course.units) {
        expect(course.knowledgePoints.some((point) => point.unitId === unit.id)).toBe(true)
      }
      for (const point of course.knowledgePoints) {
        expect(point.courseId).toBe(course.id)
        expect(course.units.some((unit) => unit.id === point.unitId)).toBe(true)
      }
    }
  })

  it('uses unique semester-prefixed new IDs without colliding with legacy IDs', () => {
    const legacyIds = new Set([
      ...GRADE4_AUTUMN_MATH_COURSE.units.map((unit) => unit.id),
      ...GRADE4_AUTUMN_MATH_COURSE.knowledgePoints.map((point) => point.id),
    ])
    const allNewIds: string[] = []

    for (const { prefix, course } of NEW_COURSES) {
      const ids = [
        ...course.units.map((unit) => unit.id),
        ...course.knowledgePoints.map((point) => point.id),
      ]
      for (const id of ids) {
        expect(id.startsWith(prefix)).toBe(true)
        expect(legacyIds.has(id)).toBe(false)
      }
      allNewIds.push(...ids)
    }

    expect(new Set(allNewIds).size).toBe(allNewIds.length)
  })

  it.each(MATH_SCOPES.map((scope) => [scope.courseId, scope.units] as const))(
    'covers the complete PRD mathematics scope for %s',
    (courseId, units) => {
      expect(requireCourse(courseId).units.map((unit) => unit.title)).toEqual(units)
    },
  )

  it.each(ENGLISH_SCOPES.map((scope) => [scope.courseId, scope.units] as const))(
    'covers all six PRD English themes for %s',
    (courseId, units) => {
      expect(requireCourse(courseId).units.map((unit) => unit.title)).toEqual(units)
    },
  )

  it('assigns a subject-appropriate ability to every new knowledge point', () => {
    const mathAbilities: readonly LearningAbility[] = [
      'math-calculation',
      'math-concept',
      'math-application',
    ]
    const englishAbilities: readonly LearningAbility[] = [
      'english-vocabulary',
      'english-sentence-grammar',
      'english-situational',
    ]

    for (const { course } of NEW_COURSES) {
      const expectedAbilities = course.subject === 'math' ? mathAbilities : englishAbilities
      for (const point of course.knowledgePoints) {
        expect(point.ability).toBeDefined()
        expect(expectedAbilities).toContain(point.ability)
      }
    }
  })

  it('provides vocabulary, sentence grammar and situational coverage in every English unit', () => {
    const englishCourses = [
      GRADE4_SPRING_ENGLISH_COURSE,
      GRADE5_AUTUMN_ENGLISH_COURSE,
      GRADE5_SPRING_ENGLISH_COURSE,
    ]

    for (const course of englishCourses) {
      expect(course.units).toHaveLength(6)
      for (const unit of course.units) {
        const abilities = course.knowledgePoints
          .filter((point) => point.unitId === unit.id)
          .map((point) => point.ability)
        expect(new Set(abilities)).toEqual(
          new Set(['english-vocabulary', 'english-sentence-grammar', 'english-situational']),
        )
      }
    }
  })
})

describe('course availability and queries', () => {
  it('projects four available math courses, three available English courses and reserved G4 autumn English', () => {
    expect(COURSE_AVAILABILITY).toHaveLength(8)
    expect(
      COURSE_AVAILABILITY.filter((entry) => entry.subject === 'math' && entry.available),
    ).toHaveLength(4)
    expect(
      COURSE_AVAILABILITY.filter((entry) => entry.subject === 'english' && entry.available),
    ).toHaveLength(3)
    expect(COURSE_AVAILABILITY.filter((entry) => !entry.available)).toEqual([
      {
        grade: 4,
        semester: 'autumn',
        subject: 'english',
        courseId: 'pep-grade4-autumn-english',
        available: false,
        unavailableReason: '该学期暂未开放英语',
      },
    ])
    expect(new Set(COURSE_AVAILABILITY.map((entry) => entry.courseId)).size).toBe(8)
  })

  it('finds every registered course by ID and returns undefined for unknown IDs', () => {
    for (const course of COURSE_REGISTRY) {
      expect(getCourseById(course.id)).toBe(course)
    }
    expect(getCourseById('unknown-course')).toBeUndefined()
    expect(getCourseById('pep-grade4-autumn-english')).toBeUndefined()
  })

  it('finds every semester and subject availability entry', () => {
    for (const availability of COURSE_AVAILABILITY) {
      expect(
        getCourseAvailability(availability.grade, availability.semester, availability.subject),
      ).toBe(availability)
    }
    expect(getCourseAvailability(4, 'spring', 'math')?.courseId).toBe('pep-grade4-spring-math')
    expect(getCourseAvailability(5, 'autumn', 'english')?.courseId).toBe(
      'pep-grade5-autumn-english',
    )
    expect(getCourseAvailability(4, 'autumn', 'english')?.unavailableReason).toBe(
      '该学期暂未开放英语',
    )
  })

  it('returns undefined for unknown availability queries', () => {
    expect(getCourseAvailability(3, 'autumn', 'math')).toBeUndefined()
    expect(getCourseAvailability(6, 'spring', 'english')).toBeUndefined()
  })
})
