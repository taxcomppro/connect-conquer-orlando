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
      approved_staff_emails: {
        Row: {
          commission_eligible: boolean
          created_at: string
          display_name: string | null
          dub_partner_key: string | null
          email: string
          note: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          commission_eligible?: boolean
          created_at?: string
          display_name?: string | null
          dub_partner_key?: string | null
          email: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          commission_eligible?: boolean
          created_at?: string
          display_name?: string | null
          dub_partner_key?: string | null
          email?: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      booth_settings: {
        Row: {
          created_at: string
          dub_group_id: string | null
          dub_program_id: string | null
          dub_workspace_id: string | null
          id: boolean
          pooled_dub_key: string | null
          pooled_dub_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dub_group_id?: string | null
          dub_program_id?: string | null
          dub_workspace_id?: string | null
          id?: boolean
          pooled_dub_key?: string | null
          pooled_dub_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dub_group_id?: string | null
          dub_program_id?: string | null
          dub_workspace_id?: string | null
          id?: boolean
          pooled_dub_key?: string | null
          pooled_dub_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      card_tokens: {
        Row: {
          created_at: string
          id: string
          issued_by: string | null
          last_tap_at: string | null
          override_target_url: string | null
          profile_id: string | null
          signup_session_id: string
          status: string
          tap_count: number
          token: string
          updated_at: string
          verified_at: string | null
          written_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          issued_by?: string | null
          last_tap_at?: string | null
          override_target_url?: string | null
          profile_id?: string | null
          signup_session_id: string
          status?: string
          tap_count?: number
          token: string
          updated_at?: string
          verified_at?: string | null
          written_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          issued_by?: string | null
          last_tap_at?: string | null
          override_target_url?: string | null
          profile_id?: string | null
          signup_session_id?: string
          status?: string
          tap_count?: number
          token?: string
          updated_at?: string
          verified_at?: string | null
          written_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "connect_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_tokens_signup_session_id_fkey"
            columns: ["signup_session_id"]
            isOneToOne: false
            referencedRelation: "signup_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      connect_profiles: {
        Row: {
          bio: string | null
          city: string | null
          company: string | null
          created_at: string
          credential: string | null
          display_name: string
          email: string | null
          external_profile_id: string | null
          id: string
          migrated_at: string | null
          phone: string | null
          published: boolean
          services: string[]
          show_email: boolean
          show_location: boolean
          show_phone: boolean
          signup_session_id: string
          slug: string
          state: string | null
          title: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          bio?: string | null
          city?: string | null
          company?: string | null
          created_at?: string
          credential?: string | null
          display_name: string
          email?: string | null
          external_profile_id?: string | null
          id?: string
          migrated_at?: string | null
          phone?: string | null
          published?: boolean
          services?: string[]
          show_email?: boolean
          show_location?: boolean
          show_phone?: boolean
          signup_session_id: string
          slug: string
          state?: string | null
          title?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          bio?: string | null
          city?: string | null
          company?: string | null
          created_at?: string
          credential?: string | null
          display_name?: string
          email?: string | null
          external_profile_id?: string | null
          id?: string
          migrated_at?: string | null
          phone?: string | null
          published?: boolean
          services?: string[]
          show_email?: boolean
          show_location?: boolean
          show_phone?: boolean
          signup_session_id?: string
          slug?: string
          state?: string | null
          title?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connect_profiles_signup_session_id_fkey"
            columns: ["signup_session_id"]
            isOneToOne: false
            referencedRelation: "signup_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      join_submissions: {
        Row: {
          attendee_id: string
          company: string | null
          consent_marketing: boolean
          email: string
          full_name: string
          id: string
          interest: string | null
          lead_id: string | null
          phone: string | null
          submitted_at: string
          submitted_by: string
          title: string | null
        }
        Insert: {
          attendee_id: string
          company?: string | null
          consent_marketing?: boolean
          email: string
          full_name: string
          id?: string
          interest?: string | null
          lead_id?: string | null
          phone?: string | null
          submitted_at?: string
          submitted_by: string
          title?: string | null
        }
        Update: {
          attendee_id?: string
          company?: string | null
          consent_marketing?: boolean
          email?: string
          full_name?: string
          id?: string
          interest?: string | null
          lead_id?: string | null
          phone?: string | null
          submitted_at?: string
          submitted_by?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "join_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address1: string | null
          address2: string | null
          address3: string | null
          association: string | null
          attendee_id: string
          city: string | null
          company: string | null
          country: string | null
          country_code: string | null
          credential: string | null
          demographics: string | null
          department: string | null
          email: string | null
          event_name: string | null
          fax: string | null
          first_name: string | null
          id: string
          interests: string[]
          joined_tcpc: boolean
          last_name: string | null
          lookup_status: string
          middle_name: string | null
          nickname: string | null
          notes: string | null
          outcome: string
          phone: string | null
          postal_code: string | null
          prefix: string | null
          qualifiers: string | null
          rating: string
          scanned_at: string
          scanned_by: string
          sms_consent: boolean
          state: string | null
          suffix: string | null
          title: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address1?: string | null
          address2?: string | null
          address3?: string | null
          association?: string | null
          attendee_id: string
          city?: string | null
          company?: string | null
          country?: string | null
          country_code?: string | null
          credential?: string | null
          demographics?: string | null
          department?: string | null
          email?: string | null
          event_name?: string | null
          fax?: string | null
          first_name?: string | null
          id?: string
          interests?: string[]
          joined_tcpc?: boolean
          last_name?: string | null
          lookup_status?: string
          middle_name?: string | null
          nickname?: string | null
          notes?: string | null
          outcome?: string
          phone?: string | null
          postal_code?: string | null
          prefix?: string | null
          qualifiers?: string | null
          rating?: string
          scanned_at?: string
          scanned_by: string
          sms_consent?: boolean
          state?: string | null
          suffix?: string | null
          title?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address1?: string | null
          address2?: string | null
          address3?: string | null
          association?: string | null
          attendee_id?: string
          city?: string | null
          company?: string | null
          country?: string | null
          country_code?: string | null
          credential?: string | null
          demographics?: string | null
          department?: string | null
          email?: string | null
          event_name?: string | null
          fax?: string | null
          first_name?: string | null
          id?: string
          interests?: string[]
          joined_tcpc?: boolean
          last_name?: string | null
          lookup_status?: string
          middle_name?: string | null
          nickname?: string | null
          notes?: string | null
          outcome?: string
          phone?: string | null
          postal_code?: string | null
          prefix?: string | null
          qualifiers?: string | null
          rating?: string
          scanned_at?: string
          scanned_by?: string
          sms_consent?: boolean
          state?: string | null
          suffix?: string | null
          title?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      signup_events: {
        Row: {
          actor_label: string | null
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          signup_session_id: string
        }
        Insert: {
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          signup_session_id: string
        }
        Update: {
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          signup_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signup_events_signup_session_id_fkey"
            columns: ["signup_session_id"]
            isOneToOne: false
            referencedRelation: "signup_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_sessions: {
        Row: {
          attendee_id: string | null
          company: string | null
          created_at: string
          dub_attribution: string
          dub_code: string | null
          email: string | null
          external_member_id: string | null
          external_profile_url: string | null
          full_name: string | null
          id: string
          lead_id: string | null
          membership_confirmed_at: string | null
          membership_confirmed_by: string | null
          membership_plan: string | null
          membership_ref: string | null
          migrated_at: string | null
          notes: string | null
          phone: string | null
          rep_name: string | null
          rep_user_id: string | null
          source: string
          stage: Database["public"]["Enums"]["signup_stage"]
          title: string | null
          updated_at: string
        }
        Insert: {
          attendee_id?: string | null
          company?: string | null
          created_at?: string
          dub_attribution?: string
          dub_code?: string | null
          email?: string | null
          external_member_id?: string | null
          external_profile_url?: string | null
          full_name?: string | null
          id?: string
          lead_id?: string | null
          membership_confirmed_at?: string | null
          membership_confirmed_by?: string | null
          membership_plan?: string | null
          membership_ref?: string | null
          migrated_at?: string | null
          notes?: string | null
          phone?: string | null
          rep_name?: string | null
          rep_user_id?: string | null
          source?: string
          stage?: Database["public"]["Enums"]["signup_stage"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          attendee_id?: string | null
          company?: string | null
          created_at?: string
          dub_attribution?: string
          dub_code?: string | null
          email?: string | null
          external_member_id?: string | null
          external_profile_url?: string | null
          full_name?: string | null
          id?: string
          lead_id?: string | null
          membership_confirmed_at?: string | null
          membership_confirmed_by?: string | null
          membership_plan?: string | null
          membership_ref?: string | null
          migrated_at?: string | null
          notes?: string | null
          phone?: string | null
          rep_name?: string | null
          rep_user_id?: string | null
          source?: string
          stage?: Database["public"]["Enums"]["signup_stage"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signup_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          body: string
          created_at: string
          error: string | null
          from_number: string
          id: string
          lead_id: string
          sent_at: string
          sent_by: string | null
          status: string
          to_number: string
          twilio_sid: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          error?: string | null
          from_number: string
          id?: string
          lead_id: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          to_number: string
          twilio_sid?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          error?: string | null
          from_number?: string
          id?: string
          lead_id?: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          to_number?: string
          twilio_sid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_profiles: {
        Row: {
          booth_role: string | null
          commission_eligible: boolean
          created_at: string
          display_name: string
          dub_partner_key: string | null
          id: string
          updated_at: string
        }
        Insert: {
          booth_role?: string | null
          commission_eligible?: boolean
          created_at?: string
          display_name?: string
          dub_partner_key?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          booth_role?: string | null
          commission_eligible?: boolean
          created_at?: string
          display_name?: string
          dub_partner_key?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      app_role: "admin" | "staff"
      signup_stage:
        | "scanned"
        | "signup_sent"
        | "membership_confirmed"
        | "ready_for_card"
        | "card_issued"
        | "void"
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
      app_role: ["admin", "staff"],
      signup_stage: [
        "scanned",
        "signup_sent",
        "membership_confirmed",
        "ready_for_card",
        "card_issued",
        "void",
      ],
    },
  },
} as const
