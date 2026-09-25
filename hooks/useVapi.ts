'use client';

// Create hooks/useVapi.ts: the core hook. Initializes Vapi SDK, manages call lifecycle (idle, connecting, starting, listening, thinking, speaking), tracks messages array + currentMessage streaming, handles duration timer with maxDuration enforcement, session tracking via server actions

import Vapi from '@vapi-ai/web';
import { useCallback, useEffect, useRef, useState } from 'react';

import { endVoiceSession, startVoiceSession } from '@/lib/actions/session.action';
import { ASSISTANT_ID, VOICE_SETTINGS } from '@/lib/constants';
import { getVoice } from '@/lib/utils';
import { IBook, Messages } from '@/types';

export function useLatestRef<T>(value: T) {
   const ref = useRef(value);

   useEffect(() => {
      ref.current = value;
   }, [value]);

   return ref;
}

const VAPI_API_KEY = process.env.NEXT_PUBLIC_VAPI_API_KEY;
const TIMER_INTERVAL_MS = 1000;

let vapi: InstanceType<typeof Vapi>;
function getVapi() {
   if (!vapi) {
      if (!VAPI_API_KEY) {
         throw new Error('NEXT_PUBLIC_VAPI_API_KEY environment variable is not set');
      }
      vapi = new Vapi(VAPI_API_KEY);
   }
   return vapi;
}

export type CallStatus = 'idle' | 'connecting' | 'starting' | 'listening' | 'thinking' | 'speaking';

export function useVapi(book: IBook) {
   // const { limits } = useSubscription();

   const [status, setStatus] = useState<CallStatus>('idle');
   const [messages, setMessages] = useState<Messages[]>([]);
   const [currentMessage, setCurrentMessage] = useState('');
   const [currentUserMessage, setCurrentUserMessage] = useState('');
   const [duration, setDuration] = useState(0);
   const [limitError, setLimitError] = useState<string | null>(null);

   const timerRef = useRef<NodeJS.Timeout | null>(null);
   const startTimeRef = useRef<number | null>(null);
   const sessionIdRef = useRef<string | null>(null);
   const isStoppingRef = useRef(false);

   // Keep refs in sync with latest values for use in callbacks
   // const maxDurationRef = useLatestRef(limits.maxSessionMinutes * 60);
   const durationRef = useLatestRef(duration);
   // The stored persona may be a voice key, a display name or a raw voice id,
   // so resolve it through getVoice (which falls back to DEFAULT_VOICE).
   const voice = getVoice(book.persona);

    // Set up Vapi event listeners
   useEffect(() => {
      // Snapshot the ref so the cleanup reads a stable reference
      const durationSnapshotRef = durationRef;
      const handlers = {
         'call-start': () => {
            isStoppingRef.current = false;
            setStatus('starting'); // AI speaks first, wait for it
            setCurrentMessage('');
            setCurrentUserMessage('');

            // Start duration timer
            startTimeRef.current = Date.now();
            setDuration(0);
            timerRef.current = setInterval(() => {
               if (startTimeRef.current) {
                  const newDuration = Math.floor((Date.now() - startTimeRef.current) / TIMER_INTERVAL_MS);
                  setDuration(newDuration);

                  // Check duration limit
                  // if (newDuration >= maxDurationRef.current) {
                  //     getVapi().stop();
                  //     setLimitError(
                  //         `Session time limit (${Math.floor(
                  //             maxDurationRef.current / SECONDS_PER_MINUTE,
                  //         )} minutes) reached. Upgrade your plan for longer sessions.`,
                  //     );
                  // }
               }
            }, TIMER_INTERVAL_MS);
         },

         'call-end': () => {
            // Don't reset isStoppingRef here - delayed events may still fire
            setStatus('idle');
            setCurrentMessage('');
            setCurrentUserMessage('');

            // Stop timer
            if (timerRef.current) {
               clearInterval(timerRef.current);
               timerRef.current = null;
            }

            // End session tracking
            if (sessionIdRef.current) {
               endVoiceSession(sessionIdRef.current, durationRef.current).catch(() => undefined);
               sessionIdRef.current = null;
            }

            startTimeRef.current = null;
         },

         'speech-start': () => {
            if (!isStoppingRef.current) {
               setStatus('speaking');
            }
         },
         'speech-end': () => {
            if (!isStoppingRef.current) {
               // After AI finishes speaking, user can talk
               setStatus('listening');
            }
         },

         message: (message: {
            type: string;
            role: string;
            transcriptType: string;
            transcript: string;
         }) => {
            if (message.type !== 'transcript') return;

            // User finished speaking → AI is thinking
            if (message.role === 'user' && message.transcriptType === 'final') {
               if (!isStoppingRef.current) {
                  setStatus('thinking');
               }
               setCurrentUserMessage('');
            }

            // Partial user transcript → show real-time typing
            if (message.role === 'user' && message.transcriptType === 'partial') {
               setCurrentUserMessage(message.transcript);
               return;
            }

            // Partial AI transcript → show word-by-word
            if (message.role === 'assistant' && message.transcriptType === 'partial') {
               setCurrentMessage(message.transcript);
               return;
            }

            // Final transcript → add to messages
            if (message.transcriptType === 'final') {
               if (message.role === 'assistant') setCurrentMessage('');
               if (message.role === 'user') setCurrentUserMessage('');

               setMessages((prev) => {
                  const isDupe = prev.some(
                     (m) => m.role === message.role && m.content === message.transcript,
                  );
                  return isDupe ? prev : [...prev, { role: message.role, content: message.transcript }];
               });
            }
         },

         error: (error: Error) => {
            // Vapi reports the real reason inside a nested `error` payload.
            const detail = error as unknown as {
               error?: { message?: string };
               message?: string;
            };
            const reason =
               detail?.error?.message ||
               detail?.message ||
               JSON.stringify(error, Object.getOwnPropertyNames(error ?? {}));

            // Don't reset isStoppingRef here - delayed events may still fire
            setStatus('idle');
            setCurrentMessage('');
            setCurrentUserMessage('');

            // Stop timer on error
            if (timerRef.current) {
               clearInterval(timerRef.current);
               timerRef.current = null;
            }

            // End session tracking on error
            if (sessionIdRef.current) {
               endVoiceSession(sessionIdRef.current, durationRef.current).catch(() => undefined);
               sessionIdRef.current = null;
            }

            // Show user-friendly error message
            const errorMessage = (reason || '').toLowerCase();
            if (errorMessage.includes('timeout') || errorMessage.includes('silence')) {
               setLimitError('Session ended due to inactivity. Click the mic to start again.');
            } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
               setLimitError('Connection lost. Please check your internet and try again.');
            } else {
               setLimitError('Session ended unexpectedly. Click the mic to start again.');
            }

            startTimeRef.current = null;
         },
      };

      // Register all handlers
      Object.entries(handlers).forEach(([event, handler]) => {
         getVapi().on(event as keyof typeof handlers, handler as () => void);
      });

      return () => {
          // End active session on unmount
          if (sessionIdRef.current) {
            getVapi().stop();
            endVoiceSession(sessionIdRef.current, durationSnapshotRef.current).catch(() => undefined);
            sessionIdRef.current = null;
         }
         // Cleanup handlers
         Object.entries(handlers).forEach(([event, handler]) => {
            getVapi().off(event as keyof typeof handlers, handler as () => void);
         });
         if (timerRef.current) clearInterval(timerRef.current);
      };
   }, [durationRef]);

   const start = useCallback(async () => {
      setLimitError(null);
      setStatus('connecting');

      try {
         // Creates the session record and re-checks book access on the server.
         // Guests are allowed: their session is recorded under the public
         // sample-books id, so only sample books are playable while signed out.
         const result = await startVoiceSession(book._id);

         if (!result.success) {
            setLimitError(result.error || 'Session limit reached. Please upgrade your plan.');
            setStatus('idle');
            return;
         }

         sessionIdRef.current = result.sessionId || null;
         // Note: Server-returned maxDurationMinutes is informational only
         // The actual limit is enforced by useLatestRef(limits.maxSessionMinutes * 60)

         const firstMessage = `Hey, good to meet you. Quick question before we dive in - have you actually read ${book.title} yet, or are we starting fresh?`;

         await getVapi().start(ASSISTANT_ID, {
            firstMessage,
            variableValues: {
               title: book.title,
               author: book.author,
               bookId: book._id,
            },
            voice: {
               provider: '11labs' as const,
               voiceId: voice.id,
               model: 'eleven_turbo_v2_5' as const,
               stability: VOICE_SETTINGS.stability,
               similarityBoost: VOICE_SETTINGS.similarityBoost,
               style: VOICE_SETTINGS.style,
               useSpeakerBoost: VOICE_SETTINGS.useSpeakerBoost,
            },
         });
      } catch {
         setStatus('idle');
         setLimitError('Failed to start voice session. Please try again.');
      }
   }, [book._id, book.title, book.author, voice.id]);

   const stop = useCallback(() => {
      isStoppingRef.current = true;
      getVapi().stop();
   }, []);

   const clearError = useCallback(() => {
      setLimitError(null);
   }, []);

   const isActive =
      status === 'starting' ||
      status === 'listening' ||
      status === 'thinking' ||
      status === 'speaking';

   // Calculate remaining time
   // const maxDurationSeconds = limits.maxSessionMinutes * SECONDS_PER_MINUTE;
   // const remainingSeconds = Math.max(0, maxDurationSeconds - duration);
   // const showTimeWarning =
   //     isActive && remainingSeconds <= TIME_WARNING_THRESHOLD && remainingSeconds > 0;

   return {
      status,
      isActive,
      messages,
      currentMessage,
      currentUserMessage,
      duration,
      start,
      stop,
      limitError,
      clearError,
      // maxDurationSeconds,
      // remainingSeconds,
      // showTimeWarning,
   };
}

export default useVapi;
