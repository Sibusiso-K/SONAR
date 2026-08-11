export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      opportunities: {
        Row: {
          archived: boolean;
          career_track: string;
          confidence: string;
          created_at: string;
          dates: Json;
          deliverables: string | null;
          eligibility: string | null;
          format: string;
          id: string;
          kind: string;
          links: Json;
          name: string;
          next_date: string | null;
          notes: string | null;
          noticed_on: string | null;
          organiser: string;
          prize: Json;
          scope: string;
          score: number;
          scores: Json;
          source: string | null;
          tier: number;
          went_live_on: string | null;
          what_to_build: string | null;
        };
        Insert: {
          archived?: boolean;
          career_track?: string;
          confidence?: string;
          created_at?: string;
          dates?: Json;
          deliverables?: string | null;
          eligibility?: string | null;
          format?: string;
          id: string;
          kind: string;
          links?: Json;
          name: string;
          next_date?: string | null;
          notes?: string | null;
          noticed_on?: string | null;
          organiser: string;
          prize?: Json;
          scope?: string;
          score?: number;
          scores?: Json;
          source?: string | null;
          tier?: number;
          went_live_on?: string | null;
          what_to_build?: string | null;
        };
        Update: {
          archived?: boolean;
          career_track?: string;
          confidence?: string;
          created_at?: string;
          dates?: Json;
          deliverables?: string | null;
          eligibility?: string | null;
          format?: string;
          id?: string;
          kind?: string;
          links?: Json;
          name?: string;
          next_date?: string | null;
          notes?: string | null;
          noticed_on?: string | null;
          organiser?: string;
          prize?: Json;
          scope?: string;
          score?: number;
          scores?: Json;
          source?: string | null;
          tier?: number;
          went_live_on?: string | null;
          what_to_build?: string | null;
        };
        Relationships: [];
      };
      past_opportunities: {
        Row: {
          corrected: boolean;
          correction_note: string | null;
          created_at: string;
          happened_on: string | null;
          id: string;
          kind: string;
          name: string;
          note: string | null;
          organiser: string;
          outcome: string;
          placement: string | null;
        };
        Insert: {
          corrected?: boolean;
          correction_note?: string | null;
          created_at?: string;
          happened_on?: string | null;
          id: string;
          kind: string;
          name: string;
          note?: string | null;
          organiser: string;
          outcome?: string;
          placement?: string | null;
        };
        Update: {
          corrected?: boolean;
          correction_note?: string | null;
          created_at?: string;
          happened_on?: string | null;
          id?: string;
          kind?: string;
          name?: string;
          note?: string | null;
          organiser?: string;
          outcome?: string;
          placement?: string | null;
        };
        Relationships: [];
      };
      updates: {
        Row: {
          actor: string;
          actor_kind: string;
          change_kind: string;
          created_at: string;
          detail: string | null;
          id: string;
          opportunity_id: string | null;
          summary: string;
        };
        Insert: {
          actor?: string;
          actor_kind?: string;
          change_kind?: string;
          created_at?: string;
          detail?: string | null;
          id?: string;
          opportunity_id?: string | null;
          summary: string;
        };
        Update: {
          actor?: string;
          actor_kind?: string;
          change_kind?: string;
          created_at?: string;
          detail?: string | null;
          id?: string;
          opportunity_id?: string | null;
          summary?: string;
        };
        Relationships: [];
      };
      watchlist: {
        Row: {
          created_at: string;
          id: string;
          opportunity_id: string;
          watched_by: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          opportunity_id: string;
          watched_by: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          opportunity_id?: string;
          watched_by?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
