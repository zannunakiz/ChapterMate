"use server";

import { auth } from "@clerk/nextjs/server";
import { del } from "@vercel/blob";
import BookSegment from "@/database/models/book-segment.model";
import { Book } from "@/database/models/book.model";
import { connectToDatabase } from "@/database/mongoose";
import { CreateBook, TextSegment } from "@/types";
import { bookAccessFilter } from "@/lib/book-access";
import { USER_MAX_BOOK } from "@/lib/constants";
import mongoose from "mongoose";
import { escapeRegex, generateSlug, serializeData, splitIntoSegments } from "../utils";


export const getAllBooks = async () => {
   try {
      await connectToDatabase()

      const books = await Book.find().sort({ createdAt: -1 }).lean()

      return {
         success: true,
         data: serializeData(books)
      }

   } catch (error) {
      console.error("error Get All Books", error)
      return { success: false, error }
   }
}


// Books belonging to a single signed-in user.
export const getUserBooks = async (clerkId: string) => {
   try {
      await connectToDatabase()

      const books = await Book.find({ clerkId }).sort({ createdAt: -1 }).lean()

      return {
         success: true,
         data: serializeData(books)
      }

   } catch (error) {
      console.error("error Get User Books", error)
      return { success: false, error }
   }
}

/**
 * Deletes a book owned by the signed-in Clerk user, along with its searchable
 * segments and uploaded file assets. The owner is always resolved server-side;
 * the client never supplies a Clerk ID.
 */
export const deleteBook = async (slug: string) => {
   try {
      const { userId } = await auth();

      if (!userId) return { success: false, error: "You need to log in." };
      if (!slug || slug.length > 200) return { success: false, error: "Book not found." };

      await connectToDatabase();

      // Atomically restrict the delete to the authenticated user's book. This
      // also prevents deletion of public sample books and other users' books.
      const book = await Book.findOneAndDelete({ slug, clerkId: userId }).lean();

      if (!book) return { success: false, error: "Book not found." };

      await BookSegment.deleteMany({ bookId: book._id, clerkId: userId });

      const blobUrls = [book.fileURL, book.coverURL].filter(
         (url): url is string => Boolean(url),
      );

      if (blobUrls.length > 0) {
         try {
            await del(blobUrls);
         } catch (error) {
            // The book itself is already deleted. Do not expose provider errors
            // to the browser or turn a successful ownership-scoped deletion
            // into a false failure because blob cleanup needs attention.
            console.error("Error deleting book blobs", error);
         }
      }

      return { success: true };
   } catch (error) {
      console.error("Error deleting book", error);
      return { success: false, error: "Unable to delete this book. Please try again." };
   }
}


export const checkBookExist = async (title: string) => {
   try {
      await connectToDatabase()

      const slug = generateSlug(title)

      const existingBook = await Book.findOne({ slug }).lean()

      if (existingBook) {
         return {
            exists: true, book: serializeData(existingBook)
         }
      }

   } catch (error) {
      console.error("Error checking book exists")
      return {
         exists: false, error
      }
   }
}

export const createBook = async (data: CreateBook) => {
   try {
      const { userId } = await auth();

      // Do not trust a Clerk id supplied from the browser. This keeps both the
      // ownership and the per-user library limit enforceable at the server
      // boundary even if a client bypasses the add-book page.
      if (!userId) {
         return { success: false, error: "You need to log in." };
      }

      if (data.clerkId !== userId) {
         return { success: false, error: "You cannot create a book for another user." };
      }

      await connectToDatabase();

      const slug = generateSlug(data.title)

      const existingBook = await Book.findOne({ slug }).lean()

      if (existingBook) {
         return {
            success: true,
            data: serializeData(existingBook),
            alreadyExists: true
         }
      }

      const bookCount = await Book.countDocuments({ clerkId: userId });

      if (bookCount >= USER_MAX_BOOK) {
         return {
            success: false,
            error: `You have reached your ${USER_MAX_BOOK}-book limit.`,
         };
      }

      const book = await Book.create({ ...data, clerkId: userId, slug, totalSegments: 0 })

      return {
         success: true,
         data: serializeData(book)
      }

   } catch (error) {
      console.error("Error at createBook book.action.ts", error)
      return {
         error
      }
   }
}

export const getBookBySlug = async (slug: string) => {
   try {
      await connectToDatabase()

      const book = await Book.findOne({ slug }).lean()

      if (!book) return { success: false, data: null }

      return {
         success: true,
         data: serializeData(book)
      }
   } catch (error) {
      console.error("Error at getBookBySlug book.action.ts", error)
      return { success: false, data: null }
   }
}

// Session-page lookup: resolves a book the viewer is allowed to talk to.
//
// The access rule is applied inside the query (see bookAccessFilter), so books
// the viewer must not see are never read out of the database. Signed-out
// visitors only match the public sample books; signed-in users also match their
// own books. Anything else (missing book or no permission) resolves to
// `{ success: false, data: null }` and the page redirects to /books.
export const getBookForSession = async (slug: string, userId?: string | null) => {
   try {
      await connectToDatabase()

      const book = await Book.findOne({ slug, ...bookAccessFilter(userId) }).lean()

      if (!book) return { success: false, data: null }

      return {
         success: true,
         data: serializeData(book)
      }
   } catch (error) {
      console.error("Error at getBookForSession book.action.ts", error)
      return { success: false, data: null }
   }
}

// Saves the parsed book content as searchable segments.
// Accepts either a raw string (segments it here) or pre-parsed TextSegment[] from parsePDFFile.
export const saveBookSegments = async (
   bookId: string,
   clerkId: string,
   content: string | TextSegment[],
) => {
   try {
      await connectToDatabase();

      if (!content || (typeof content === 'string' && content.trim().length === 0) || (Array.isArray(content) && content.length === 0)) {
         return { success: false, error: 'Book content is empty' };
      }

      const bookObjectId = new mongoose.Types.ObjectId(bookId);

      // Remove any previously saved segments for this book (idempotent re-upload)
      await BookSegment.deleteMany({ bookId: bookObjectId });

      const parsedSegments: TextSegment[] =
         typeof content === 'string' ? splitIntoSegments(content) : content;

      if (parsedSegments.length === 0) {
         return { success: false, error: 'No segments generated from content' };
      }

      await BookSegment.insertMany(
         parsedSegments.map((segment) => ({
            clerkId,
            bookId: bookObjectId,
            content: segment.text,
            segmentIndex: segment.segmentIndex,
            wordCount: segment.wordCount,
         })),
      );

      await Book.updateOne({ _id: bookObjectId }, { totalSegments: parsedSegments.length });

      console.log(`Saved ${parsedSegments.length} segments for book ${bookId}`);

      return {
         success: true,
         data: { count: parsedSegments.length },
      };
   } catch (error) {
      console.error('Error at saveBookSegments book.action.ts', error);
      return {
         success: false,
         error: (error as Error).message,
      };
   }
};

// Common English words that carry no meaning for retrieval — filtered out of search queries
const STOPWORDS = new Set([
   'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one',
   'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old',
   'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too',
   'use', 'what', 'when', 'where', 'which', 'while', 'who', 'why', 'will', 'with',
   'about', 'does', 'book', 'author', 'talks', 'talk', 'says', 'said', 'tell', 'tells',
   'mention', 'mentions', 'write', 'writes', 'chapter', 'part', 'section', 'please',
   'from', 'this', 'that', 'these', 'those', 'there', 'their', 'they', 'them', 'then',
   'than', 'have', 'had', 'been', 'being', 'into', 'just', 'like', 'some', 'such',
   'only', 'also', 'very', 'much', 'more', 'most', 'many', 'make', 'made', 'want',
   'know', 'think', 'thing', 'things', 'really', 'actually', 'maybe', 'yeah', 'okay',
   'read', 'reading', 'remember', 'question', 'anything', 'something', 'everything',
]);

// Extract meaningful keywords from a conversational query (e.g. from Vapi voice input)
function extractKeywords(query: string): string[] {
   const words = query
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));

   // Deduplicate
   return [...new Set(words)];
}

// Searches book segments using MongoDB text search with keyword-based regex fallback
export const searchBookSegments = async (bookId: string, query: string, limit: number = 5) => {
   try {
      await connectToDatabase();

      console.log(`Searching for: "${query}" in book ${bookId}`);

      const bookObjectId = new mongoose.Types.ObjectId(bookId);
      const keywords = extractKeywords(query);

      console.log(`Extracted keywords: [${keywords.join(', ')}]`);

      if (keywords.length === 0) {
         return { success: true, data: [] };
      }

      const projection = '_id bookId content segmentIndex pageNumber wordCount';

      // Try MongoDB text search first (requires text index) using meaningful keywords only
      let segments: Record<string, unknown>[] = [];
      try {
         segments = await BookSegment.find({
            bookId: bookObjectId,
            $text: { $search: keywords.join(' ') },
         })
            .select(projection)
            .sort({ score: { $meta: 'textScore' } })
            .limit(limit)
            .lean();
      } catch {
         // Text index may not exist — fall through to regex fallback
         segments = [];
      }

      // Fallback: regex search. Prefer segments matching the MOST keywords,
      // not just the first ones by segment order.
      if (segments.length === 0) {
         const keywordRegexes = keywords.map((k) => new RegExp(escapeRegex(k), 'i'));

         // 1st pass: segments containing ALL keywords (most specific)
         segments = await BookSegment.find({
            bookId: bookObjectId,
            $and: keywordRegexes.map((regex) => ({ content: { $regex: regex } })),
         })
            .select(projection)
            .sort({ segmentIndex: 1 })
            .limit(limit)
            .lean();

         // 2nd pass: segments containing ANY keyword, ranked by how many keywords match
         if (segments.length === 0) {
            const anyMatches = await BookSegment.find({
               bookId: bookObjectId,
               $or: keywordRegexes.map((regex) => ({ content: { $regex: regex } })),
            })
               .select(projection)
               .lean();

            segments = anyMatches
               .map((segment) => {
                  const content = String((segment as { content?: string }).content ?? '').toLowerCase();
                  const matchCount = keywordRegexes.filter((regex) => regex.test(content)).length;
                  return { segment, matchCount };
               })
               .sort((a, b) => b.matchCount - a.matchCount)
               .slice(0, limit)
               .map(({ segment }) => segment);
         }
      }

      console.log(`Search complete. Found ${segments.length} results`);

      return {
         success: true,
         data: serializeData(segments),
      };
   } catch (error) {
      console.error('Error searching segments:', error);
      return {
         success: false,
         error: (error as Error).message,
         data: [],
      };
   }
};
