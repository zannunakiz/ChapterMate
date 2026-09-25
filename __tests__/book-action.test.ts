const authMock = jest.fn()
const connectMock = jest.fn()
const findOneMock = jest.fn()
const countDocumentsMock = jest.fn()
const createMock = jest.fn()
const existsMock = jest.fn()
const updateOneMock = jest.fn()

const segmentFindMock = jest.fn()
const segmentSelectMock = jest.fn()
const segmentSortMock = jest.fn()
const segmentLimitMock = jest.fn()
const segmentLeanMock = jest.fn()
const segmentDeleteManyMock = jest.fn()
const segmentInsertManyMock = jest.fn()

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
    exists: existsMock,
    updateOne: updateOneMock,
  },
}))
jest.mock('@/database/models/book-segment.model', () => ({
  __esModule: true,
  default: {
    find: segmentFindMock,
    deleteMany: segmentDeleteManyMock,
    insertMany: segmentInsertManyMock,
  },
}))
jest.mock('@vercel/blob', () => ({ del: jest.fn() }))
jest.mock('@/lib/utils', () => ({
  escapeRegex: (value: string) => value,
  generateSlug: (title: string) => title.toLowerCase().replace(/\s+/g, '-'),
  serializeData: <T>(value: T) => value,
  splitIntoSegments: jest.fn(() => [
    { text: 'segment one', segmentIndex: 0, wordCount: 2 },
  ]),
}))

import {
  checkBookExist,
  createBook,
  saveBookSegments,
  searchBookSegments,
} from '@/lib/actions/book.action'
import { SAMPLE_BOOKS_CLERK_ID, USER_MAX_BOOK } from '@/lib/constants'

const BOOK_OID = '507f1f77bcf86cd799439011'

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
    existsMock.mockResolvedValue(null)
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

  it('reports a taken slug without echoing the other user book document', async () => {
    existsMock.mockResolvedValue({ _id: 'someone-elses-book' })

    await expect(createBook(validBook)).resolves.toEqual({
      success: true,
      alreadyExists: true,
    })
    expect(countDocumentsMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
  })
})

describe('checkBookExist', () => {
  beforeEach(() => {
    connectMock.mockResolvedValue(undefined)
  })

  it('returns only the boolean, never the matching book document', async () => {
    existsMock.mockResolvedValue({ _id: 'someone-elses-book' })

    const result = await checkBookExist('A New Book')

    expect(result).toEqual({ exists: true })
    expect(result).not.toHaveProperty('book')
  })

  it('reports a free title as not existing', async () => {
    existsMock.mockResolvedValue(null)

    await expect(checkBookExist('A New Book')).resolves.toEqual({ exists: false })
  })
})

describe('saveBookSegments', () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: 'user-1' })
    connectMock.mockResolvedValue(undefined)
    findOneMock.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: BOOK_OID, clerkId: 'user-1' }),
    })
    segmentDeleteManyMock.mockResolvedValue({ deletedCount: 0 })
    segmentInsertManyMock.mockResolvedValue([{ _id: 'segment-1' }])
    updateOneMock.mockResolvedValue({ modifiedCount: 1 })
  })

  it('refuses a signed-out caller without touching the database', async () => {
    authMock.mockResolvedValue({ userId: null })

    await expect(saveBookSegments(BOOK_OID, 'some book text')).resolves.toEqual({
      success: false,
      error: 'You need to log in.',
    })
    expect(segmentDeleteManyMock).not.toHaveBeenCalled()
    expect(segmentInsertManyMock).not.toHaveBeenCalled()
  })

  it('never deletes the segments of a book owned by another user', async () => {
    findOneMock.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) })

    await expect(saveBookSegments(BOOK_OID, 'some book text')).resolves.toEqual({
      success: false,
      error: 'Book not found.',
    })
    expect(findOneMock).toHaveBeenCalledWith(
      { _id: expect.anything(), clerkId: 'user-1' },
      { _id: 1 },
    )
    expect(segmentDeleteManyMock).not.toHaveBeenCalled()
    expect(segmentInsertManyMock).not.toHaveBeenCalled()
  })

  it('writes the segments for the authenticated owner of the book', async () => {
    await expect(saveBookSegments(BOOK_OID, 'some book text')).resolves.toEqual({
      success: true,
      data: { count: 1 },
    })

    expect(segmentInsertManyMock).toHaveBeenCalledWith([
      {
        clerkId: 'user-1',
        bookId: expect.anything(),
        content: 'segment one',
        segmentIndex: 0,
        wordCount: 2,
      },
    ])
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: expect.anything(), clerkId: 'user-1' },
      { totalSegments: 1 },
    )
  })

  it('rejects a malformed book id before any write', async () => {
    await expect(saveBookSegments('not-an-object-id', 'some book text')).resolves.toEqual({
      success: false,
      error: 'Book not found.',
    })
    expect(findOneMock).not.toHaveBeenCalled()
  })
})

describe('searchBookSegments', () => {
  beforeEach(() => {
    connectMock.mockResolvedValue(undefined)
    segmentFindMock.mockReturnValue({ select: segmentSelectMock })
    segmentSelectMock.mockReturnValue({ sort: segmentSortMock, lean: segmentLeanMock })
    segmentSortMock.mockReturnValue({ limit: segmentLimitMock })
    segmentLimitMock.mockReturnValue({ lean: segmentLeanMock })
    segmentLeanMock.mockResolvedValue([])
  })

  it('reads nothing when the book is not readable by the caller', async () => {
    findOneMock.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) })

    await expect(searchBookSegments(BOOK_OID, 'dragons', 5, 'user-1')).resolves.toEqual({
      success: false,
      error: 'Book not found',
      data: [],
    })
    expect(segmentFindMock).not.toHaveBeenCalled()
  })

  it('scopes the access check to the caller own books plus the sample books', async () => {
    findOneMock.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: BOOK_OID }) })

    await searchBookSegments(BOOK_OID, 'dragons', 5, 'user-1')

    expect(findOneMock).toHaveBeenCalledWith(
      {
        _id: expect.anything(),
        $or: [{ clerkId: SAMPLE_BOOKS_CLERK_ID }, { clerkId: 'user-1' }],
      },
      { _id: 1 },
    )
  })

  it('limits signed-out visitors to the public sample books', async () => {
    findOneMock.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) })

    await searchBookSegments(BOOK_OID, 'dragons', 5, null)

    expect(findOneMock).toHaveBeenCalledWith(
      { _id: expect.anything(), clerkId: SAMPLE_BOOKS_CLERK_ID },
      { _id: 1 },
    )
  })

  it('rejects a malformed book id without hitting the database', async () => {
    await expect(searchBookSegments('not-an-object-id', 'dragons', 5, 'user-1')).resolves.toEqual({
      success: false,
      error: 'Book not found',
      data: [],
    })
    expect(findOneMock).not.toHaveBeenCalled()
  })

  it('returns the matched segments for a readable book', async () => {
    findOneMock.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: BOOK_OID }) })
    segmentLeanMock.mockResolvedValue([
      { _id: 'segment-1', content: 'dragons are real' },
    ])

    await expect(searchBookSegments(BOOK_OID, 'dragons', 5, 'user-1')).resolves.toEqual({
      success: true,
      data: [{ _id: 'segment-1', content: 'dragons are real' }],
    })
  })
})
