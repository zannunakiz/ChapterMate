"use server"

import { MAX_FILE_SIZE } from "@/lib/upload-constants";
import { auth } from "@clerk/nextjs/server";
import { handleUpload, HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
   const token = process.env.BLOB_READ_WRITE_TOKEN

   if (!token) throw new Error("Missing Vercel Blob Token")

   const body = (await request.json()) as HandleUploadBody

   try {
      const jsonResponse = await handleUpload({
         token,
         body,
         request,
         onBeforeGenerateToken: async () => {
            const { userId } = await auth()

            if (!userId) {
               throw new Error("Unauthorized: User not authenticated")
            }

            return {
               allowedContentTypes: ['application/pdf'],
               addRandomSuffix: true,
               maximumSizeInBytes: MAX_FILE_SIZE,
               tokenPayload: JSON.stringify({ userId })
            }
         },
         onUploadCompleted: async () => {},
      })


      return NextResponse.json(jsonResponse)

   } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occured during upload blob"
      const status = message.includes("Unauthorized") ? 401 : 500;
      return NextResponse.json({ error: message }, { status })
   }
}
