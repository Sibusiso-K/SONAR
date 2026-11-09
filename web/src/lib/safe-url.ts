/**
 * Link hrefs on the board come from data (organiser pages, registration
 * links) that passes through a database and, eventually, a scraping
 * pipeline. A `javascript:` or `data:` URL in that data would execute when
 * clicked, so every data-driven href goes through this first.
 *
 * Only absolute http(s) URLs are allowed. Anything else (including relative
 * paths, `mailto:` and protocol-relative `//host` forms) returns undefined
 * and the caller renders plain text instead of a link.
 */
export function safeHref(raw: string | null | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return undefined;
  }
  return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
}
