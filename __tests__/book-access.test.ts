import {
  bookAccessFilter,
  canAccessBook,
  sessionOwnerClerkId,
} from '@/lib/book-access'
import { SAMPLE_BOOKS_CLERK_ID } from '@/lib/constants'

describe('book access policy', () => {
  it.each([undefined, null])('allows a signed-out visitor to open a sample book', (userId) => {
    expect(canAccessBook({ clerkId: SAMPLE_BOOKS_CLERK_ID }, userId)).toBe(true)
  })

  it('denies a signed-out visitor access to a private book', () => {
    expect(canAccessBook({ clerkId: 'owner-1' })).toBe(false)
    expect(bookAccessFilter()).toEqual({ clerkId: SAMPLE_BOOKS_CLERK_ID })
  })

  it('allows an owner, but not another signed-in user, to open a private book', () => {
    expect(canAccessBook({ clerkId: 'owner-1' }, 'owner-1')).toBe(true)
    expect(canAccessBook({ clerkId: 'owner-1' }, 'other-user')).toBe(false)
    expect(bookAccessFilter('owner-1')).toEqual({
      $or: [{ clerkId: SAMPLE_BOOKS_CLERK_ID }, { clerkId: 'owner-1' }],
    })
  })

  it('attributes guest voice sessions to the sample-books owner', () => {
    expect(sessionOwnerClerkId()).toBe(SAMPLE_BOOKS_CLERK_ID)
    expect(sessionOwnerClerkId('owner-1')).toBe('owner-1')
  })
})
