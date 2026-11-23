export type ResourceLoad<T> = (uri: string) => Promise<T> | T

export interface ResourceFailureLoader<T> {
  load(uri: string): Promise<T>
  failNext(uri: string, error?: Error): void
}

export function createResourceFailureLoader<T>(
  loadResource: ResourceLoad<T>,
): ResourceFailureLoader<T> {
  const failures = new Map<string, Error[]>()

  return {
    async load(uri) {
      const queue = failures.get(uri)
      const failure = queue?.shift()
      if (queue?.length === 0) failures.delete(uri)
      if (failure) throw failure
      return loadResource(uri)
    },

    failNext(uri, error = new Error(`Injected resource failure: ${uri}`)) {
      const queue = failures.get(uri) ?? []
      queue.push(error)
      failures.set(uri, queue)
    },
  }
}
