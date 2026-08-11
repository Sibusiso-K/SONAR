import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
