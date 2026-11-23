import { expect } from 'vitest'

export interface SceneObjectNode {
  id: string
  children?: readonly SceneObjectNode[]
}

export type SceneObjectTree = SceneObjectNode | readonly SceneObjectNode[]

export function collectSceneObjectIds(tree: SceneObjectTree): string[] {
  const ids: string[] = []
  const roots: readonly SceneObjectNode[] = Array.isArray(tree) ? tree : [tree as SceneObjectNode]

  const visit = (object: SceneObjectNode) => {
    ids.push(object.id)
    for (const child of object.children ?? []) visit(child)
  }
  for (const root of roots) visit(root)
  return ids
}

export function expectUniqueSceneObjectIds(tree: SceneObjectTree): void {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const id of collectSceneObjectIds(tree)) {
    if (seen.has(id)) duplicates.add(id)
    seen.add(id)
  }
  expect([...duplicates], `Duplicate scene object IDs: ${[...duplicates].join(', ')}`).toEqual([])
}

export function expectSceneProjection<Input, Model extends SceneObjectTree>(
  project: (input: Input) => Model,
  input: Input,
): Model {
  const originalInput = structuredClone(input)
  const first = project(input)
  expect(input).toEqual(originalInput)

  const second = project(input)
  expect(second).toEqual(first)
  expect(input).toEqual(originalInput)
  expectUniqueSceneObjectIds(first)
  return first
}
