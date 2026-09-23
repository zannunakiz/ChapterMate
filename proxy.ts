import { clerkMiddleware } from "@clerk/nextjs/server";

// `/books` and `/books/` are public; deeper paths such as `/books/add` stay protected.
const publicPathPattern = /^\/(?:$|books\/?$|home(?:\/|$)|sign-in(?:\/|$)|sign-up(?:\/|$)|api\/health(?:\/|$))/;

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
