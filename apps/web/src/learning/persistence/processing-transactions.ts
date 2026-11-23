import type { LearningRepository } from './repository'
import type { LearningSnapshot } from './snapshot'

export interface ProcessingActionRequest {
  actionId: string
  signature: string
}

export class ProcessingActionConflictError extends Error {
  constructor(actionId: string) {
    super(`操作 ID 已用于另一项加工操作：${actionId}`)
    this.name = 'ProcessingActionConflictError'
  }
}

export function transactProcessingOperation(
  repository: LearningRepository,
  expectedRevision: number,
  request: ProcessingActionRequest,
  operation: (snapshot: LearningSnapshot) => LearningSnapshot | void,
): LearningSnapshot {
  if (request.actionId.trim().length === 0) throw new Error('操作 ID 不能为空')
  if (request.signature.length === 0) throw new Error('操作签名不能为空')
  return repository.transact(expectedRevision, (snapshot) => {
    const existing = snapshot.processing.actions[request.actionId]
    if (existing !== undefined) {
      if (existing !== request.signature) throw new ProcessingActionConflictError(request.actionId)
      return snapshot
    }
    const next = operation(snapshot) ?? snapshot
    return {
      ...next,
      processing: {
        ...next.processing,
        actions: { ...next.processing.actions, [request.actionId]: request.signature },
      },
    }
  })
}
