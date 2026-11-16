import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { keepLocally, localDebriefs, type Debrief } from "@/lib/debrief";
import type { Opportunity, PastOpportunity, UpdateRow, WatchRow } from "@/lib/sonar-types";

export function useOpportunities() {
  return useQuery({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("archived", false);
      if (error) throw error;
      return (data ?? []) as unknown as Opportunity[];
    },
  });
}

export function usePastOpportunities() {
  return useQuery({
    queryKey: ["past_opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("past_opportunities")
        .select("*")
        .order("happened_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PastOpportunity[];
    },
  });
}

export function useUpdates() {
  return useQuery({
    queryKey: ["updates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("updates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as UpdateRow[];
    },
  });
}

export function useWatchlist() {
  return useQuery({
    queryKey: ["watchlist"],
    queryFn: async () => {
      const { data, error } = await supabase.from("watchlist").select("*");
      if (error) throw error;
      return (data ?? []) as unknown as WatchRow[];
    },
  });
}

export function useToggleWatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      opportunityId: string;
      who: string;
      watching: boolean;
      name: string;
    }) => {
      if (args.watching) {
        const { error } = await supabase
          .from("watchlist")
          .delete()
          .eq("opportunity_id", args.opportunityId)
          .eq("watched_by", args.who);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("watchlist")
          .insert({ opportunity_id: args.opportunityId, watched_by: args.who });
        if (error) throw error;
      }
      await supabase.from("updates").insert({
        opportunity_id: args.opportunityId,
        actor: args.who,
        actor_kind: "human",
        change_kind: "watch",
        summary: `${args.who} ${args.watching ? "stopped watching" : "started watching"} ${args.name}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlist"] });
      qc.invalidateQueries({ queryKey: ["updates"] });
    },
  });
}

function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Debriefs from the database plus any this browser is still holding. A failed
 * read (most likely: the `debriefs` table has not been migrated yet) is not
 * an error for the page; it just means only this device's are shown, and
 * `fromDatabase` says which case it is.
 */
export function useDebriefs({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["debriefs"],
    enabled,
    queryFn: async () => {
      const local = localDebriefs(browserStorage());
      // The generated types predate this table.
      const { data, error } = await (
        supabase as unknown as {
          from: (t: string) => {
            select: (c: string) => {
              order: (
                c: string,
                o: { ascending: boolean },
              ) => Promise<{ data: unknown; error: { message: string } | null }>;
            };
          };
        }
      )
        .from("debriefs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return { rows: local, fromDatabase: false };
      const remote = (data ?? []) as Debrief[];
      const seen = new Set(remote.map((d) => d.id));
      return { rows: [...local.filter((d) => !seen.has(d.id)), ...remote], fromDatabase: true };
    },
  });
}

function stripClientTime(d: Debrief): Omit<Debrief, "created_at"> {
  const { created_at: _ignored, ...rest } = d;
  return rest;
}

/** Save a debrief. Resolves to where it ended up, never throws: losing what
 * someone just typed is the one outcome this must not have. */
export function useFileDebrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: Debrief): Promise<"database" | "device"> => {
      const { error } = await (
        supabase as unknown as {
          from: (t: string) => { insert: (row: unknown) => Promise<{ error: unknown }> };
        }
      )
        .from("debriefs")
        // created_at is left to the database: a browser must not be able to
        // backdate a debrief. The local copy below keeps the device's clock.
        .insert(stripClientTime(d));
      if (!error) return "database";
      keepLocally(browserStorage(), d);
      return "device";
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debriefs"] }),
  });
}
