import { isFeatureEnabled } from '@/lib/feature-flags'

describe('feature flag parsing', () => {
  it.each(['true', 'TRUE', '1', 'yes', 'on'])('enables supported value %s', (value) => {
    expect(isFeatureEnabled(value)).toBe(true)
  })

  it.each(['false', '0', 'no', 'off', 'invalid'])('disables unsupported value %s', (value) => {
    expect(isFeatureEnabled(value, true)).toBe(false)
  })

  it('uses the supplied fallback for missing and blank values', () => {
    expect(isFeatureEnabled(undefined, true)).toBe(true)
    expect(isFeatureEnabled('   ', false)).toBe(false)
  })
})
