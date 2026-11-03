import { configure } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())

// Role queries on the full storefront layout can exceed the 1s default on a busy machine.
configure({ asyncUtilTimeout: 5000 })
