import { IVoiceSession } from "@/types";
import { model, models, Schema } from "mongoose";

const voiceSessionSchema = new Schema<IVoiceSession>({
   clerkId: { type: String, required: true, index: true },
   bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
   startedAt: { type: Date, required: true, default: Date.now },
   endedAt: { type: Date },
   durationSeconds: { type: Number, default: 0, required: true },
}, { timestamps: true })

const VoiceSession = models.VoiceSession || model<IVoiceSession>('VoiceSession', voiceSessionSchema)

export default VoiceSession;
