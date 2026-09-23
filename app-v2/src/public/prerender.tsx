import { renderToString } from "react-dom/server";
import { PublicPage } from "./PublicRouter";
import { PUBLIC_PAGE_PATHS } from "./routes";

/** Key for the not-found page in the pre-rendered map. */
export const NOT_FOUND_KEY = "*";

/**
 * Static HTML for every public page, keyed by path. The Worker places it inside
 * `#root` so crawlers that never run JavaScript still read the page; the browser
 * then renders the same page over it.
 */
export function renderPublicPages(): Record<string, string> {
  const pages: Record<string, string> = {};
  for (const path of PUBLIC_PAGE_PATHS) {
    pages[path] = renderToString(<PublicPage path={path} />);
  }
  pages[NOT_FOUND_KEY] = renderToString(<PublicPage path="/__not-found__" />);
  return pages;
}
