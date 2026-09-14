import { RefreshCw } from "lucide-react";

/**
 * A failed read must never render the same as "confirmed, genuinely empty" -
 * docs/REVIEW_2026-09-14.md, finding 6. Every route previously defaulted
 * `useQuery`'s `data` to `[]` on both loading and error, and only checked
 * `isLoading`, so a Supabase outage rendered the board's own "nothing here,
 * we've cleared it" copy - indistinguishable from an honestly empty board,
 * and silently wrong for anyone who didn't already know the outage was
 * happening. This renders the distinct third state, with retry.
 */
export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    <div className="paper-panel border-l-4 p-5" style={{ borderLeftColor: "var(--critical)" }}>
      <p className="label-caps" style={{ color: "var(--critical)" }}>
        Couldn't load this
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        A read from the database failed. This is not an empty result - retry, or check back once the
        sync is confirmed healthy.
      </p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{message}</p>
      <button
        onClick={onRetry}
        className="mt-3 flex items-center gap-1.5 border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground transition-colors hover:border-foreground"
      >
        <RefreshCw className="size-3.5" /> Retry
      </button>
    </div>
  );
}
