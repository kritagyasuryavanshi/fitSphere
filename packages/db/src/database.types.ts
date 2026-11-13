
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "athlete_basics": {
                  Row: {
                    "days_per_week": number,"equipment": (string)[],"injury_notes": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "days_per_week": number,"equipment"?: (string)[],"injury_notes"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "days_per_week"?: number,"equipment"?: (string)[],"injury_notes"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "athlete_basics_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"athlete_prefs": {
                  Row: {
                    "answers": NonNullable<Json>,"category_id": string,"created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answers"?: NonNullable<Json>,"category_id": string,"created_at"?: string,"user_id": string
                  }
                  Update: {
                    "answers"?: NonNullable<Json>,"category_id"?: string,"created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "athlete_prefs_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "athlete_prefs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"id": number,"target_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"target_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"target_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"body_metrics": {
                  Row: {
                    "height_cm": number | null,"id": string,"measured_at": string,"user_id": string,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "height_cm"?: number | null,"id"?: string,"measured_at"?: string,"user_id": string,"weight_kg"?: number | null
                  }
                  Update: {
                    "height_cm"?: number | null,"id"?: string,"measured_at"?: string,"user_id"?: string,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "body_metrics_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "id": string,"is_live": boolean,"name": string,"sort": number,"tagline": string,"uses_muscles": boolean,"uses_supports": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"is_live"?: boolean,"name": string,"sort"?: number,"tagline"?: string,"uses_muscles"?: boolean,"uses_supports"?: boolean
                  }
                  Update: {
                    "id"?: string,"is_live"?: boolean,"name"?: string,"sort"?: number,"tagline"?: string,"uses_muscles"?: boolean,"uses_supports"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"coach_applications": {
                  Row: {
                    "category_id": string,"city": string,"created_at": string,"decided_at": string | null,"decided_by": string | null,"full_name": string,"how_today": string,"id": string,"status": Database["public"]['Enums']["application_status"],"user_id": string,"work_url": string,"years_coaching": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"city": string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"full_name": string,"how_today"?: string,"id"?: string,"status"?: Database["public"]['Enums']["application_status"],"user_id": string,"work_url"?: string,"years_coaching": number
                  }
                  Update: {
                    "category_id"?: string,"city"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"full_name"?: string,"how_today"?: string,"id"?: string,"status"?: Database["public"]['Enums']["application_status"],"user_id"?: string,"work_url"?: string,"years_coaching"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "coach_applications_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coach_applications_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coach_applications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"consent_notices": {
                  Row: {
                    "created_at": string,"is_current": boolean,"purpose": Database["public"]['Enums']["consent_purpose"],"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"is_current"?: boolean,"purpose": Database["public"]['Enums']["consent_purpose"],"version": string
                  }
                  Update: {
                    "created_at"?: string,"is_current"?: boolean,"purpose"?: Database["public"]['Enums']["consent_purpose"],"version"?: string
                  }
                  Relationships: [
                    
                  ]
                },"consents": {
                  Row: {
                    "created_at": string,"granted": boolean,"id": string,"notice_version": string,"purpose": Database["public"]['Enums']["consent_purpose"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"granted": boolean,"id"?: string,"notice_version"?: string,"purpose": Database["public"]['Enums']["consent_purpose"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"granted"?: boolean,"id"?: string,"notice_version"?: string,"purpose"?: Database["public"]['Enums']["consent_purpose"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consents_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"content_items": {
                  Row: {
                    "author_id": string | null,"created_at": string,"discipline_id": string,"dose": NonNullable<Json>,"drill_type": string | null,"duration_min": number | null,"environments": (string)[],"equipment": (string)[],"id": string,"is_sample": boolean,"kind": Database["public"]['Enums']["content_kind"],"level": Database["public"]['Enums']["content_level"],"mistakes": string,"published_at": string | null,"review_note": string | null,"reviewed_by": string | null,"safety": string,"slug": string,"status": Database["public"]['Enums']["content_status"],"summary": string,"supports": (string)[],"title": string,"updated_at": string,"video_broken": boolean,"video_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"created_at"?: string,"discipline_id": string,"dose"?: NonNullable<Json>,"drill_type"?: string | null,"duration_min"?: number | null,"environments"?: (string)[],"equipment"?: (string)[],"id"?: string,"is_sample"?: boolean,"kind": Database["public"]['Enums']["content_kind"],"level"?: Database["public"]['Enums']["content_level"],"mistakes"?: string,"published_at"?: string | null,"review_note"?: string | null,"reviewed_by"?: string | null,"safety"?: string,"slug": string,"status"?: Database["public"]['Enums']["content_status"],"summary"?: string,"supports"?: (string)[],"title": string,"updated_at"?: string,"video_broken"?: boolean,"video_id"?: string | null
                  }
                  Update: {
                    "author_id"?: string | null,"created_at"?: string,"discipline_id"?: string,"dose"?: NonNullable<Json>,"drill_type"?: string | null,"duration_min"?: number | null,"environments"?: (string)[],"equipment"?: (string)[],"id"?: string,"is_sample"?: boolean,"kind"?: Database["public"]['Enums']["content_kind"],"level"?: Database["public"]['Enums']["content_level"],"mistakes"?: string,"published_at"?: string | null,"review_note"?: string | null,"reviewed_by"?: string | null,"safety"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["content_status"],"summary"?: string,"supports"?: (string)[],"title"?: string,"updated_at"?: string,"video_broken"?: boolean,"video_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_items_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_items_discipline_id_fkey"
      columns: ["discipline_id"]
isOneToOne: false
      referencedRelation: "disciplines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_items_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"content_links": {
                  Row: {
                    "from_id": string,"kind": Database["public"]['Enums']["content_link_kind"],"sort": number,"to_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "from_id": string,"kind": Database["public"]['Enums']["content_link_kind"],"sort"?: number,"to_id": string
                  }
                  Update: {
                    "from_id"?: string,"kind"?: Database["public"]['Enums']["content_link_kind"],"sort"?: number,"to_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_links_from_id_fkey"
      columns: ["from_id"]
isOneToOne: false
      referencedRelation: "content_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_links_to_id_fkey"
      columns: ["to_id"]
isOneToOne: false
      referencedRelation: "content_items"
      referencedColumns: ["id"]
    }
                  ]
                },"content_muscles": {
                  Row: {
                    "is_primary": boolean,"item_id": string,"muscle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "is_primary"?: boolean,"item_id": string,"muscle_id": string
                  }
                  Update: {
                    "is_primary"?: boolean,"item_id"?: string,"muscle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_muscles_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "content_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_muscles_muscle_id_fkey"
      columns: ["muscle_id"]
isOneToOne: false
      referencedRelation: "muscles"
      referencedColumns: ["id"]
    }
                  ]
                },"content_steps": {
                  Row: {
                    "body": string,"item_id": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"item_id": string,"position": number
                  }
                  Update: {
                    "body"?: string,"item_id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_steps_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "content_items"
      referencedColumns: ["id"]
    }
                  ]
                },"disciplines": {
                  Row: {
                    "category_id": string,"id": string,"name": string,"slug": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"id"?: string,"name": string,"slug": string,"sort"?: number
                  }
                  Update: {
                    "category_id"?: string,"id"?: string,"name"?: string,"slug"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "disciplines_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"email_outbox": {
                  Row: {
                    "created_at": string,"data": NonNullable<Json>,"id": number,"sent_at": string | null,"template": string,"to_email": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"sent_at"?: string | null,"template": string,"to_email": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"sent_at"?: string | null,"template"?: string,"to_email"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_outbox_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"muscles": {
                  Row: {
                    "id": string,"muscle_group": string,"name": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"muscle_group": string,"name": string,"sort"?: number
                  }
                  Update: {
                    "id"?: string,"muscle_group"?: string,"name"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"date_of_birth": string | null,"display_name": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date_of_birth"?: string | null,"display_name"?: string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"date_of_birth"?: string | null,"display_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"granted_by": string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"granted_by"?: string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"granted_by"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_list_applications":
{ Args: Record<PropertyKey, never>; Returns: {
              "city": string,"email": string,"full_name": string,"how_today": string,"id": string,"sport": string,"user_id": string,"work_url": string,"years_coaching": number
            }[]
                           },
"admin_list_people":
{ Args: { "search": string }; Returns: {
              "display_name": string,"email": string,"id": string,"joined": string,"roles": (Database["public"]['Enums']["app_role"])[]
            }[]
                           },
"admin_set_roles":
{ Args: { "expected_roles": (Database["public"]['Enums']["app_role"])[],"new_roles": (Database["public"]['Enums']["app_role"])[],"target": string }; Returns: undefined
                           },
"apply_sport_answers":
{ Args: { "by_sport": Json,"uid": string }; Returns: undefined
                           },
"complete_about_you":
{ Args: { "birth_date": string,"first_name": string,"sports": (string)[] }; Returns: undefined
                           },
"decide_coach_application":
{ Args: { "application": string,"approve": boolean }; Returns: undefined
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"export_my_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"grant_role":
{ Args: { "new_role": Database["public"]['Enums']["app_role"],"target": string }; Returns: undefined
                           },
"has_role":
{ Args: { "wanted": Database["public"]['Enums']["app_role"] }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"record_consent":
{ Args: { "answer": boolean,"notice": string,"uid": string,"what": Database["public"]['Enums']["consent_purpose"] }; Returns: undefined
                           },
"require_step1":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"review_content":
{ Args: { "approve": boolean,"item": string,"note": string }; Returns: undefined
                           },
"revoke_role":
{ Args: { "old_role": Database["public"]['Enums']["app_role"],"target": string }; Returns: undefined
                           },
"save_body_metrics":
{ Args: { "ai_consent": boolean,"height_cm": number,"notice": string,"sport_answers": Json,"weight_kg": number }; Returns: undefined
                           },
"save_training_basics":
{ Args: { "ai_consent": boolean,"days": number,"equipment": (string)[],"injury_notes": string,"notice": string,"sport_answers": Json }; Returns: undefined
                           },
"seed_sample_content":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"set_my_consent":
{ Args: { "granted": boolean,"purpose": Database["public"]['Enums']["consent_purpose"] }; Returns: undefined
                           },
"submit_coach_application":
{ Args: { "category": string,"city": string,"full_name": string,"how_today": string,"work_url": string,"years": number }; Returns: undefined
                           },
"submit_content":
{ Args: { "item": string }; Returns: undefined
                           }
          }
          Enums: {
            "app_role": "athlete"|"coach"|"reviewer"|"admin","application_status": "pending"|"approved"|"declined","consent_purpose": "ai_health_personalisation"|"ai_body_metrics","content_kind": "skill"|"drill"|"exercise","content_level": "beginner"|"intermediate"|"advanced","content_link_kind": "prerequisite"|"related"|"alternative","content_status": "draft"|"in_review"|"needs_changes"|"published"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["athlete", "coach", "reviewer", "admin"],"application_status": ["pending", "approved", "declined"],"consent_purpose": ["ai_health_personalisation", "ai_body_metrics"],"content_kind": ["skill", "drill", "exercise"],"content_level": ["beginner", "intermediate", "advanced"],"content_link_kind": ["prerequisite", "related", "alternative"],"content_status": ["draft", "in_review", "needs_changes", "published"]
          }
        }
} as const
