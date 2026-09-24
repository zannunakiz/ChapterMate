import { IBook } from "@/types";
import {
   BOOK_AUTHOR_MAX_LENGTH,
   BOOK_TITLE_MAX_LENGTH,
} from "@/lib/book-validation";
import { model, models, Schema } from "mongoose";

const BookSchema = new Schema<IBook>({
   clerkId: { type: String, required: true },
   title: { type: String, required: true, maxlength: BOOK_TITLE_MAX_LENGTH },
   slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
   author: { type: String, required: true, maxlength: BOOK_AUTHOR_MAX_LENGTH },
   persona: { type: String },
   fileURL: { type: String, required: true },
   fileBlobKey: { type: String, required: true },
   coverURL: { type: String },
   coverBlobKey: { type: String },
   fileSize: { type: Number, required: true },
   totalSegments: { type: Number, default: 0 },
}, { timestamps: true })


export const Book = models.Book || model<IBook>('Book', BookSchema)
