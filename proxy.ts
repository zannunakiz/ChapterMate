import { clerkMiddleware } from "@clerk/nextjs/server";

const publicPathPattern = /^\/(?:$|home(?:\/|$)|sign-in(?:\/|$)|sign-up(?:\/|$))/;

export default clerkMiddleware(async (auth, request) => {
  if (!publicPathPattern.test(request.nextUrl.pathname)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|map|txt|xml|pdf|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
