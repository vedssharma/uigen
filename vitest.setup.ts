// Fix for jose library Uint8Array issue with JSDOM
// See: https://github.com/panva/jose/issues/671

import { beforeAll } from 'vitest'

beforeAll(() => {
  // Ensure global Uint8Array is properly set up for jose library
  if (typeof global !== 'undefined') {
    global.Uint8Array = Uint8Array
  }
})