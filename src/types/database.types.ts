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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      card_addresses: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          card_id: string
          city: string | null
          country: string | null
          created_at: string
          id: string
          is_primary: boolean
          label: string
          postal_code: string | null
          state_region: string | null
          user_id: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          card_id: string
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string
          postal_code?: string | null
          state_region?: string | null
          user_id: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          card_id?: string
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string
          postal_code?: string | null
          state_region?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_addresses_card_owner_fk"
            columns: ["card_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      card_emails: {
        Row: {
          card_id: string
          created_at: string
          email: string
          id: string
          is_primary: boolean
          label: string
          normalized_email: string | null
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          email: string
          id?: string
          is_primary?: boolean
          label?: string
          normalized_email?: string | null
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          email?: string
          id?: string
          is_primary?: boolean
          label?: string
          normalized_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_emails_card_owner_fk"
            columns: ["card_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      card_images: {
        Row: {
          byte_size: number | null
          card_id: string
          created_at: string
          height: number | null
          id: string
          mime_type: string
          sha256: string | null
          side: string
          storage_path: string
          user_id: string
          width: number | null
        }
        Insert: {
          byte_size?: number | null
          card_id: string
          created_at?: string
          height?: number | null
          id?: string
          mime_type: string
          sha256?: string | null
          side: string
          storage_path: string
          user_id: string
          width?: number | null
        }
        Update: {
          byte_size?: number | null
          card_id?: string
          created_at?: string
          height?: number | null
          id?: string
          mime_type?: string
          sha256?: string | null
          side?: string
          storage_path?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "card_images_card_owner_fk"
            columns: ["card_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      card_phone_numbers: {
        Row: {
          card_id: string
          created_at: string
          id: string
          is_primary: boolean
          label: string
          normalized_phone: string | null
          phone_number: string
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string
          normalized_phone?: string | null
          phone_number: string
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string
          normalized_phone?: string | null
          phone_number?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_phone_numbers_card_owner_fk"
            columns: ["card_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      card_tags: {
        Row: {
          card_id: string
          created_at: string
          tag_id: string
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          tag_id: string
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_tags_card_owner_fk"
            columns: ["card_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "card_tags_tag_owner_fk"
            columns: ["tag_id", "user_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      card_websites: {
        Row: {
          card_id: string
          created_at: string
          id: string
          is_primary: boolean
          label: string
          url: string
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string
          url: string
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_websites_card_owner_fk"
            columns: ["card_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      cards: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          company: string | null
          contact_photo_path: string | null
          country: string | null
          created_at: string
          department: string | null
          display_name: string | null
          duplicate_of_id: string | null
          extraction_confidence: number | null
          extraction_model: string | null
          extraction_provider: string | null
          extraction_quality: Json
          first_name: string | null
          id: string
          is_favorite: boolean
          job_title: string | null
          last_exported_to_contacts_at: string | null
          last_name: string | null
          middle_name: string | null
          notes: string | null
          postal_code: string | null
          primary_email: string | null
          primary_phone: string | null
          raw_extracted_text: string | null
          search_vector: unknown
          source_back_image_path: string | null
          source_front_image_path: string | null
          source_hash: string | null
          state_region: string | null
          status: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company?: string | null
          contact_photo_path?: string | null
          country?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          duplicate_of_id?: string | null
          extraction_confidence?: number | null
          extraction_model?: string | null
          extraction_provider?: string | null
          extraction_quality?: Json
          first_name?: string | null
          id?: string
          is_favorite?: boolean
          job_title?: string | null
          last_exported_to_contacts_at?: string | null
          last_name?: string | null
          middle_name?: string | null
          notes?: string | null
          postal_code?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          raw_extracted_text?: string | null
          search_vector?: unknown
          source_back_image_path?: string | null
          source_front_image_path?: string | null
          source_hash?: string | null
          state_region?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company?: string | null
          contact_photo_path?: string | null
          country?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          duplicate_of_id?: string | null
          extraction_confidence?: number | null
          extraction_model?: string | null
          extraction_provider?: string | null
          extraction_quality?: Json
          first_name?: string | null
          id?: string
          is_favorite?: boolean
          job_title?: string | null
          last_exported_to_contacts_at?: string | null
          last_name?: string | null
          middle_name?: string | null
          notes?: string | null
          postal_code?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          raw_extracted_text?: string | null
          search_vector?: unknown
          source_back_image_path?: string | null
          source_front_image_path?: string | null
          source_hash?: string | null
          state_region?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_duplicate_owner_fk"
            columns: ["duplicate_of_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          attempt_count: number
          card_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          model: string | null
          next_retry_at: string | null
          payload: Json
          provider: string | null
          result: Json | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          card_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          model?: string | null
          next_retry_at?: string | null
          payload?: Json
          provider?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          card_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          model?: string | null
          next_retry_at?: string | null
          payload?: Json
          provider?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_card_owner_fk"
            columns: ["card_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_entitlements: {
        Row: {
          created_at: string
          disabled_features: string[]
          policy_version: number
          tier: string
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          disabled_features?: string[]
          policy_version?: number
          tier?: string
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          disabled_features?: string[]
          policy_version?: number
          tier?: string
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          selected_ai_model: string | null
          selected_ai_provider: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          selected_ai_model?: string | null
          selected_ai_provider?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          selected_ai_model?: string | null
          selected_ai_provider?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_ai_credentials: {
        Row: {
          auth_tag: string
          created_at: string
          encrypted_key: string
          id: string
          iv: string
          key_suffix: string
          provider: 'openai' | 'gemini'
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_tag: string
          created_at?: string
          encrypted_key: string
          id?: string
          iv: string
          key_suffix: string
          provider: 'openai' | 'gemini'
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_tag?: string
          created_at?: string
          encrypted_key?: string
          id?: string
          iv?: string
          key_suffix?: string
          provider?: 'openai' | 'gemini'
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_cards: {
        Args: { page_offset?: number; page_size?: number; search_query: string }
        Returns: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          company: string | null
          country: string | null
          created_at: string
          department: string | null
          display_name: string | null
          duplicate_of_id: string | null
          extraction_confidence: number | null
          extraction_model: string | null
          extraction_provider: string | null
          extraction_quality: Json
          first_name: string | null
          id: string
          is_favorite: boolean
          job_title: string | null
          last_exported_to_contacts_at: string | null
          last_name: string | null
          middle_name: string | null
          notes: string | null
          postal_code: string | null
          primary_email: string | null
          primary_phone: string | null
          raw_extracted_text: string | null
          search_vector: unknown
          source_back_image_path: string | null
          source_front_image_path: string | null
          source_hash: string | null
          state_region: string | null
          status: string
          updated_at: string
          user_id: string
          website: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "cards"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
