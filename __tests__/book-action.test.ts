const authMock = jest.fn()
const connectMock = jest.fn()
const findOneMock = jest.fn()
const countDocumentsMock = jest.fn()
const createMock = jest.fn()

jest.mock('@clerk/nextjs/server', () => ({ auth: authMock }))
jest.mock('@/database/mongoose', () => ({
  __esModule: true,
  default: connectMock,
  connectToDatabase: connectMock,
}))
jest.mock('@/database/models/book.model', () => ({
  Book: {
    findOne: findOneMock,
    countDocuments: countDocumentsMock,
    create: createMock,
  },
}))
jest.mock('@/database/models/book-segment.model', () => ({ __esModule: true, default: {} }))
jest.mock('@vercel/blob', () => ({ del: jest.fn() }))
jest.mock('@/lib/utils', () => ({
  escapeRegex: (value: string) => value,
  generateSlug: (title: string) => title.toLowerCase().replace(/\s+/g, '-'),
  serializeData: <T>(value: T) => value,
  splitIntoSegments: jest.fn(),
}))

import { createBook } from '@/lib/actions/book.action'
import { USER_MAX_BOOK } from '@/lib/constants'

const validBook = {
  clerkId: 'user-1',
  title: 'A New Book',
  author: 'Author',
  fileURL: 'https://example.test/book.pdf',
  fileBlobKey: 'book.pdf',
  fileSize: 123,
}

describe('createBook', () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: 'user-1' })
    connectMock.mockResolvedValue(undefined)
    findOneMock.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) })
    countDocumentsMock.mockResolvedValue(0)
    createMock.mockResolvedValue({ _id: 'book-1', ...validBook })
  })

  it('rejects a signed-out caller without opening a database connection', async () => {
    authMock.mockResolvedValue({ userId: null })

    await expect(createBook(validBook)).resolves.toEqual({
      success: false,
      error: 'You need to log in.',
    })
    expect(connectMock).not.toHaveBeenCalled()
  })

  it('rejects a client attempting to create a book for another user', async () => {
    await expect(createBook({ ...validBook, clerkId: 'victim-user' })).resolves.toEqual({
      success: false,
      error: 'You cannot create a book for another user.',
    })
    expect(connectMock).not.toHaveBeenCalled()
  })

  it('refuses the eleventh book and does not write to the database', async () => {
    countDocumentsMock.mockResolvedValue(USER_MAX_BOOK)

    await expect(createBook(validBook)).resolves.toEqual({
      success: false,
      error: `You have reached your ${USER_MAX_BOOK}-book limit.`,
    })
    expect(createMock).not.toHaveBeenCalled()
  })

  it('creates a book below the limit using the authenticated owner id', async () => {
    const result = await createBook(validBook)

    expect(result).toMatchObject({ success: true, data: { _id: 'book-1' } })
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      clerkId: 'user-1',
      slug: 'a-new-book',
      totalSegments: 0,
    }))
  })

  it('returns the existing book instead of creating a duplicate slug', async () => {
    const existingBook = { _id: 'existing-1', slug: 'a-new-book' }
    findOneMock.mockReturnValue({ lean: jest.fn().mockResolvedValue(existingBook) })

    await expect(createBook(validBook)).resolves.toEqual({
      success: true,
      data: existingBook,
      alreadyExists: true,
    })
    expect(countDocumentsMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
  })
})
