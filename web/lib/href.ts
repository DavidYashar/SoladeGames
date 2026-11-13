/**
 * Route helper for the static demo.
 *
 * The demo build exports with `trailingSlash: true`, so every page is written as
 * `.../index.html` and only resolves with the slash. The client router does not add it,
 * so a push to `/games/pinball` fetches a path that does not exist and the navigation
 * dies silently. Every internal link goes through here.
 */
export function href(path: string): string {
  if (process.env.NEXT_PUBLIC_DEMO !== "1") return path;
  if (path === "/" || path.endsWith("/")) return path;
  return `${path}/`;
}
