export function defineFixture<T>(factory: () => T): () => T {
  const fixture = factory()
  return () => structuredClone(fixture)
}
