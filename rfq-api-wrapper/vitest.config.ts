import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      SPREAD_BPS: '0',
      MIN_SPREAD_BPS: '0',
      VOLATILITY_MULTIPLIER: '0',
      MAX_SPREAD_BPS: '100'
    }
  },
})
