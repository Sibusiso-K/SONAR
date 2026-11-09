import { formatMoney } from "@/lib/analytics";

/**
 * Plain-text prize breakdown, e.g. "Grand: $8,000; Second: $4,000".
 *
 * The schema stores `prize.breakdown` as an array of tiers. Rows that were
 * synced before that migration can still hold an object or a string, and a
 * template literal prints an object as "[object Object]", so every shape is
 * handled here instead of being stringified.
 */
export function formatPrizeBreakdown(breakdown: unknown, currency?: string): string {
  if (typeof breakdown === "string") return breakdown.trim();
  if (Array.isArray(breakdown)) {
    return breakdown
      .map((tier) => tierText(tier, currency))
      .filter(Boolean)
      .join("; ");
  }
  if (breakdown && typeof breakdown === "object") {
    return Object.entries(breakdown)
      .map(([key, value]) => {
        if (typeof value === "number")
          return tierText({ place: labelOf(key), amount: value }, currency);
        if (typeof value === "string") return `${labelOf(key)}: ${value}`.trim();
        return "";
      })
      .filter(Boolean)
      .join("; ");
  }
  return "";
}

function tierText(tier: unknown, currency?: string): string {
  if (typeof tier === "string") return tier.trim();
  if (!tier || typeof tier !== "object") return "";
  const { place, amount } = tier as { place?: unknown; amount?: unknown };
  const name = typeof place === "string" ? place.trim() : "";
  if (typeof amount === "number" && Number.isFinite(amount)) {
    const money = formatMoney(amount, currency);
    return name ? `${name}: ${money}` : money;
  }
  return name;
}

function labelOf(key: string): string {
  const spaced = key.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
