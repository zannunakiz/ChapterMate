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
    // Clerk's auto-proxy (production key + *.vercel.app host) serves Clerk JS and
    // the whole Frontend API from this origin under `/__clerk`, and
    // `clerkMiddleware` is the handler that proxies it. This entry must come
    // first and bypass the static-asset exclusions below, because those exclude
    // `.js`: without it `/__clerk/npm/@clerk/clerk-js@6/dist/clerk.browser.js`
    // never reaches the middleware, 404s, and Clerk throws
    // `failed_to_load_clerk_js` (0m12dw...js → ClerkProvider.getEntryChunks).
    "/__clerk/:path*",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|map|txt|xml|pdf|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
