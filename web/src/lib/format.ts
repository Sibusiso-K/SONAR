/**
 * Number and date formatting, in one place on purpose.
 *
 * The site used `toLocaleString("en-ZA")`. The server (Node) and the browser
 * ship different locale data for South African English: Node printed
 * `0,0 days` (decimal comma) where Chrome printed `0.0`. The server-rendered
 * HTML therefore never matched what the browser produced, which React reports
 * as a hydration error and which makes numbers visibly change format on load.
 *
 * en-GB uses a comma for thousands and a point for decimals, and that has been
 * stable across Node and every browser, so the output is the same on both
 * sides of hydration.
 */
export const LOCALE = "en-GB";

const numberFormats = new Map<number, Intl.NumberFormat>();

/** `1234567.8` -> "1,234,567.8" with a fixed number of decimal places. */
export function formatNumber(value: number, decimals = 0): string {
  let nf = numberFormats.get(decimals);
  if (!nf) {
    nf = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numberFormats.set(decimals, nf);
  }
  return nf.format(value);
}

/** `ml_competition` -> "ml competition". Entry kinds are stored as identifiers
 * and were being shown to people verbatim. */
export function kindLabel(kind: string | null | undefined): string {
  return (kind ?? "unknown").replace(/_/g, " ");
}
