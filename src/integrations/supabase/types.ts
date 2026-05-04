export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bonus_award_verdicts: {
        Row: {
          award: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          verdict: string
        }
        Insert: {
          award: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          verdict: string
        }
        Update: {
          award?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          verdict?: string
        }
        Relationships: []
      }
      bonus_predictions: {
        Row: {
          created_at: string
          golden_ball: string | null
          group_runners_up: Json
          group_winners: Json
          id: string
          most_assists: string | null
          submitted_at: string | null
          team_progression: Json
          top_scorer: string | null
          updated_at: string
          user_id: string
          young_player: string | null
        }
        Insert: {
          created_at?: string
          golden_ball?: string | null
          group_runners_up?: Json
          group_winners?: Json
          id?: string
          most_assists?: string | null
          submitted_at?: string | null
          team_progression?: Json
          top_scorer?: string | null
          updated_at?: string
          user_id: string
          young_player?: string | null
        }
        Update: {
          created_at?: string
          golden_ball?: string | null
          group_runners_up?: Json
          group_winners?: Json
          id?: string
          most_assists?: string | null
          submitted_at?: string | null
          team_progression?: Json
          top_scorer?: string | null
          updated_at?: string
          user_id?: string
          young_player?: string | null
        }
        Relationships: []
      }
      bonus_results: {
        Row: {
          golden_ball: string | null
          group_runners_up: Json
          group_winners: Json
          id: string
          most_assists: string | null
          team_progression: Json
          top_scorer: string | null
          updated_at: string
          young_player: string | null
        }
        Insert: {
          golden_ball?: string | null
          group_runners_up?: Json
          group_winners?: Json
          id?: string
          most_assists?: string | null
          team_progression?: Json
          top_scorer?: string | null
          updated_at?: string
          young_player?: string | null
        }
        Update: {
          golden_ball?: string | null
          group_runners_up?: Json
          group_winners?: Json
          id?: string
          most_assists?: string | null
          team_progression?: Json
          top_scorer?: string | null
          updated_at?: string
          young_player?: string | null
        }
        Relationships: []
      }
      group_results: {
        Row: {
          group_name: string
          id: string
          runner_up_team_id: string | null
          updated_at: string
          winner_team_id: string | null
        }
        Insert: {
          group_name: string
          id?: string
          runner_up_team_id?: string | null
          updated_at?: string
          winner_team_id?: string | null
        }
        Update: {
          group_name?: string
          id?: string
          runner_up_team_id?: string | null
          updated_at?: string
          winner_team_id?: string | null
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          id: string
          match_date: string | null
          match_number: number
          played: boolean
          round: string
          score_a: number | null
          score_b: number | null
          team_a_id: string | null
          team_b_id: string | null
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          match_date?: string | null
          match_number: number
          played?: boolean
          round: string
          score_a?: number | null
          score_b?: number | null
          team_a_id?: string | null
          team_b_id?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          match_date?: string | null
          match_number?: number
          played?: boolean
          round?: string
          score_a?: number | null
          score_b?: number | null
          team_a_id?: string | null
          team_b_id?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          created_at: string
          id: string
          locked: boolean
          match_id: string
          predicted_score_a: number | null
          predicted_score_b: number | null
          predicted_team_through: string | null
          predicted_winner_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          locked?: boolean
          match_id: string
          predicted_score_a?: number | null
          predicted_score_b?: number | null
          predicted_team_through?: string | null
          predicted_winner_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          locked?: boolean
          match_id?: string
          predicted_score_a?: number | null
          predicted_score_b?: number | null
          predicted_team_through?: string | null
          predicted_winner_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_predicted_winner_id_fkey"
            columns: ["predicted_winner_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string
          id: string
          last_name: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      teams: {
        Row: {
          code: string
          created_at: string
          group_name: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          group_name: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          group_name?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
