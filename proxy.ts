import { clerkMiddleware } from "@clerk/nextjs/server";

// `/books`, `/books/` and the book sessions are public; deeper paths such as
// `/books/add` stay protected.
//
// Sessions are public on purpose: signed-out visitors may talk about the sample
// books. The page itself authorises every request (lib/book-access.ts) and
// redirects anything unreadable to /books.
const publicPathPattern = /^\/(?:$|books\/?$|books\/session(?:\/|$)|home(?:\/|$)|sign-in(?:\/|$)|sign-up(?:\/|$))/;

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
