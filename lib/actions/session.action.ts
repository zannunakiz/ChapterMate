"use server"

import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import { Book } from "@/database/models/book.model";
import VoiceSession from "@/database/models/voice-session.model";
import connectToDatabase from "@/database/mongoose";
import { bookAccessFilter, sessionOwnerClerkId } from "@/lib/book-access";
import { EndSessionResult, StartSessionResult } from "@/types";


// Starts a voice session for `bookId`.
//
// The caller's identity is resolved server-side and never trusted from the
// client: signed-in users are recorded under their Clerk user id, signed-out
// visitors under the public sample-books id. The same access rule as the
// session page applies here, so guests can only start conversations on sample
// books while a private book stays owner-only.
export const startVoiceSession = async (bookId: string): Promise<StartSessionResult> => {
   try {
      await connectToDatabase();

      const { userId } = await auth();

      if (!mongoose.isValidObjectId(bookId)) {
         return { success: false, error: 'Book not found.' };
      }

      const book = await Book.findOne(
         { _id: bookId, ...bookAccessFilter(userId) },
         { _id: 1 },
      ).lean();

      if (!book) return { success: false, error: 'You do not have access to this book.' };

      const session = await VoiceSession.create({
         clerkId: sessionOwnerClerkId(userId),
         bookId,
         startedAt: new Date(),
         durationSeconds: 0,
      });

      return {
         success: true,
         sessionId: session._id.toString(),
      };
   } catch (e) {
      console.error('Error starting voice session', e);
      return { success: false, error: 'Failed to start voice session. Please try again later.' };
   }
};

export const endVoiceSession = async (sessionId: string, durationSeconds: number): Promise<EndSessionResult> => {
   try {
      await connectToDatabase();

      const { userId } = await auth();

      if (!mongoose.isValidObjectId(sessionId)) {
         return { success: false, error: 'Voice session not found.' };
      }

      // Scoped to the caller's own sessions (guests own the sample-books ones).
      const result = await VoiceSession.findOneAndUpdate(
         { _id: sessionId, clerkId: sessionOwnerClerkId(userId) },
         {
            endedAt: new Date(),
            durationSeconds,
         },
      );

      if (!result) return { success: false, error: 'Voice session not found.' };

      return { success: true };
   } catch (e) {
      console.error('Error ending voice session', e);
      return { success: false, error: 'Failed to end voice session. Please try again later.' };
   }
};
