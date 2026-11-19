import { defineFixture } from '../helpers/fixtures'

export const createEmptyVersionedSnapshot = defineFixture(() => ({
  schemaVersion: 1,
  revision: 0,
  payload: {},
}))

export const malformedJsonFixtures = ['', '{', '{"schemaVersion":'] as const
