import type { Answer } from '../../learning/types'

export interface AnswerFormValue {
  answer: string
  quotient: string
  remainder: string
  numerator?: string
  denominator?: string
  unit?: string
  optionId?: string
  blanks?: readonly string[]
}

export function emptyAnswerForm(): AnswerFormValue {
  return {
    answer: '',
    quotient: '',
    remainder: '',
    numerator: '',
    denominator: '',
    unit: '',
    optionId: '',
    blanks: [],
  }
}

export function formFromAnswer(answer?: Answer): AnswerFormValue {
  const form = emptyAnswerForm()
  if (!answer) return form
  switch (answer.kind) {
    case 'number':
      form.answer = String(answer.value)
      break
    case 'quotient-remainder':
      form.quotient = String(answer.quotient)
      form.remainder = String(answer.remainder)
      break
    case 'fill-blanks':
    case 'sentence-completion':
      form.blanks = [...answer.values]
      break
    case 'word-problem':
      form.answer = String(answer.value)
      form.unit = answer.unit ?? ''
      break
    case 'fraction':
      form.numerator = String(answer.numerator)
      form.denominator = String(answer.denominator)
      break
    case 'english-spelling':
      form.answer = answer.value
      break
    case 'single-choice':
      // 选择题订正会换成新情境变式，必须重新选择，不沿用旧选项。
      break
  }
  return form
}
