
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
            "ai_questions": {
                  Row: {
                    "answer": Json | null,"answered_at": string | null,"asked_on": string,"cost_micro_usd": number,"created_at": string,"id": string,"input_tokens": number,"kind": string | null,"output_tokens": number,"question": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer"?: Json | null,"answered_at"?: string | null,"asked_on"?: string,"cost_micro_usd"?: number,"created_at"?: string,"id"?: string,"input_tokens"?: number,"kind"?: string | null,"output_tokens"?: number,"question": string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "answer"?: Json | null,"answered_at"?: string | null,"asked_on"?: string,"cost_micro_usd"?: number,"created_at"?: string,"id"?: string,"input_tokens"?: number,"kind"?: string | null,"output_tokens"?: number,"question"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_questions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"athlete_basics": {
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
                },"availability_slots": {
                  Row: {
                    "coach_id": string,"dow": number,"id": string,"minutes": number,"start_time": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coach_id": string,"dow": number,"id"?: string,"minutes": number,"start_time": string
                  }
                  Update: {
                    "coach_id"?: string,"dow"?: number,"id"?: string,"minutes"?: number,"start_time"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "availability_slots_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "coach_profiles"
      referencedColumns: ["coach_id"]
    }
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
                },"cancel_reasons": {
                  Row: {
                    "created_at": string,"engagement_id": string,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"engagement_id": string,"reason": string
                  }
                  Update: {
                    "created_at"?: string,"engagement_id"?: string,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cancel_reasons_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: true
      referencedRelation: "engagements"
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
                },"coach_profiles": {
                  Row: {
                    "agreement_accepted_at": string | null,"agreement_version": string | null,"city": string,"client_limit": number,"coach_id": string,"formats": (string)[],"headline": string,"languages": (string)[],"payout_account_id": string | null,"philosophy": string,"specialties": (string)[],"status": string,"updated_at": string,"years": number
                  }
                  ComputedFields: never
                  Insert: {
                    "agreement_accepted_at"?: string | null,"agreement_version"?: string | null,"city"?: string,"client_limit"?: number,"coach_id": string,"formats"?: (string)[],"headline"?: string,"languages"?: (string)[],"payout_account_id"?: string | null,"philosophy"?: string,"specialties"?: (string)[],"status"?: string,"updated_at"?: string,"years"?: number
                  }
                  Update: {
                    "agreement_accepted_at"?: string | null,"agreement_version"?: string | null,"city"?: string,"client_limit"?: number,"coach_id"?: string,"formats"?: (string)[],"headline"?: string,"languages"?: (string)[],"payout_account_id"?: string | null,"philosophy"?: string,"specialties"?: (string)[],"status"?: string,"updated_at"?: string,"years"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "coach_profiles_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"completions": {
                  Row: {
                    "created_at": string,"item_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"item_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"item_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "completions_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "content_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "completions_user_id_fkey"
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
                    "author_id": string | null,"created_at": string,"discipline_id": string,"dose": NonNullable<Json>,"drill_type": string | null,"duration_min": number | null,"environments": (string)[],"equipment": (string)[],"id": string,"is_sample": boolean,"kind": Database["public"]['Enums']["content_kind"],"level": Database["public"]['Enums']["content_level"],"mistakes": string,"published_at": string | null,"review_note": string | null,"reviewed_by": string | null,"safety": string,"search": unknown,"slug": string,"status": Database["public"]['Enums']["content_status"],"summary": string,"supports": (string)[],"title": string,"updated_at": string,"video_broken": boolean,"video_checked_at": string | null,"video_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"created_at"?: string,"discipline_id": string,"dose"?: NonNullable<Json>,"drill_type"?: string | null,"duration_min"?: number | null,"environments"?: (string)[],"equipment"?: (string)[],"id"?: string,"is_sample"?: boolean,"kind": Database["public"]['Enums']["content_kind"],"level"?: Database["public"]['Enums']["content_level"],"mistakes"?: string,"published_at"?: string | null,"review_note"?: string | null,"reviewed_by"?: string | null,"safety"?: string,"search"?: never,"slug": string,"status"?: Database["public"]['Enums']["content_status"],"summary"?: string,"supports"?: (string)[],"title": string,"updated_at"?: string,"video_broken"?: boolean,"video_checked_at"?: string | null,"video_id"?: string | null
                  }
                  Update: {
                    "author_id"?: string | null,"created_at"?: string,"discipline_id"?: string,"dose"?: NonNullable<Json>,"drill_type"?: string | null,"duration_min"?: number | null,"environments"?: (string)[],"equipment"?: (string)[],"id"?: string,"is_sample"?: boolean,"kind"?: Database["public"]['Enums']["content_kind"],"level"?: Database["public"]['Enums']["content_level"],"mistakes"?: string,"published_at"?: string | null,"review_note"?: string | null,"reviewed_by"?: string | null,"safety"?: string,"search"?: never,"slug"?: string,"status"?: Database["public"]['Enums']["content_status"],"summary"?: string,"supports"?: (string)[],"title"?: string,"updated_at"?: string,"video_broken"?: boolean,"video_checked_at"?: string | null,"video_id"?: string | null
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
                },"conversations": {
                  Row: {
                    "athlete_id": string | null,"coach_id": string | null,"created_at": string,"id": string,"last_message_at": string | null,"conversation_open": boolean | null
                  }
                  ComputedFields: "conversation_open"
                  Insert: {
                    "athlete_id"?: string | null,"coach_id"?: string | null,"created_at"?: string,"id"?: string,"last_message_at"?: string | null
                  }
                  Update: {
                    "athlete_id"?: string | null,"coach_id"?: string | null,"created_at"?: string,"id"?: string,"last_message_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"credentials": {
                  Row: {
                    "coach_id": string,"created_at": string,"decided_at": string | null,"decided_by": string | null,"file_path": string,"id": string,"id_number": string,"issuer": string,"note": string,"status": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coach_id": string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"file_path": string,"id"?: string,"id_number"?: string,"issuer"?: string,"note"?: string,"status"?: string,"title": string
                  }
                  Update: {
                    "coach_id"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"file_path"?: string,"id"?: string,"id_number"?: string,"issuer"?: string,"note"?: string,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "credentials_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "coach_profiles"
      referencedColumns: ["coach_id"]
    },{
      foreignKeyName: "credentials_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
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
                    "attempts": number,"claimed_at": string | null,"created_at": string,"data": NonNullable<Json>,"id": number,"sent_at": string | null,"template": string,"to_email": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"claimed_at"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"sent_at"?: string | null,"template": string,"to_email": string,"user_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"claimed_at"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"sent_at"?: string | null,"template"?: string,"to_email"?: string,"user_id"?: string | null
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
                },"email_prefs": {
                  Row: {
                    "coach_feedback": boolean,"new_lesson": boolean,"session_reminder": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coach_feedback"?: boolean,"new_lesson"?: boolean,"session_reminder"?: boolean,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "coach_feedback"?: boolean,"new_lesson"?: boolean,"session_reminder"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_prefs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"engagements": {
                  Row: {
                    "athlete_id": string | null,"cancel_at_period_end": boolean,"coach_id": string | null,"created_at": string,"days_per_week": number,"decided_at": string | null,"ended_at": string | null,"fee_bps": number,"goals": string,"id": string,"package_id": string | null,"package_kind": string,"package_title": string,"paid_through": string | null,"price_paise": number,"share_data": boolean,"start_date": string,"status": string,"engagement_opens": boolean | null
                  }
                  ComputedFields: "engagement_opens"
                  Insert: {
                    "athlete_id"?: string | null,"cancel_at_period_end"?: boolean,"coach_id"?: string | null,"created_at"?: string,"days_per_week": number,"decided_at"?: string | null,"ended_at"?: string | null,"fee_bps": number,"goals"?: string,"id"?: string,"package_id"?: string | null,"package_kind": string,"package_title": string,"paid_through"?: string | null,"price_paise": number,"share_data"?: boolean,"start_date": string,"status"?: string
                  }
                  Update: {
                    "athlete_id"?: string | null,"cancel_at_period_end"?: boolean,"coach_id"?: string | null,"created_at"?: string,"days_per_week"?: number,"decided_at"?: string | null,"ended_at"?: string | null,"fee_bps"?: number,"goals"?: string,"id"?: string,"package_id"?: string | null,"package_kind"?: string,"package_title"?: string,"paid_through"?: string | null,"price_paise"?: number,"share_data"?: boolean,"start_date"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "engagements_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "coach_profiles"
      referencedColumns: ["coach_id"]
    },{
      foreignKeyName: "engagements_package_id_fkey"
      columns: ["package_id"]
isOneToOne: false
      referencedRelation: "packages"
      referencedColumns: ["id"]
    }
                  ]
                },"enrollments": {
                  Row: {
                    "athlete_id": string,"ended_at": string | null,"engagement_id": string | null,"id": string,"invite_code": string | null,"joined_at": string,"program_id": string,"start_date": string,"status": Database["public"]['Enums']["enrollment_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "athlete_id": string,"ended_at"?: string | null,"engagement_id"?: string | null,"id"?: string,"invite_code"?: string | null,"joined_at"?: string,"program_id": string,"start_date": string,"status"?: Database["public"]['Enums']["enrollment_status"]
                  }
                  Update: {
                    "athlete_id"?: string,"ended_at"?: string | null,"engagement_id"?: string | null,"id"?: string,"invite_code"?: string | null,"joined_at"?: string,"program_id"?: string,"start_date"?: string,"status"?: Database["public"]['Enums']["enrollment_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "enrollments_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: false
      referencedRelation: "engagements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_invite_code_fkey"
      columns: ["invite_code"]
isOneToOne: false
      referencedRelation: "invites"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "enrollments_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"feedback": {
                  Row: {
                    "athlete_id": string,"body": string,"coach_id": string | null,"coach_name": string,"created_at": string,"id": string,"log_id": string | null,"program_id": string | null,"program_title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "athlete_id": string,"body": string,"coach_id"?: string | null,"coach_name"?: string,"created_at"?: string,"id"?: string,"log_id"?: string | null,"program_id"?: string | null,"program_title"?: string
                  }
                  Update: {
                    "athlete_id"?: string,"body"?: string,"coach_id"?: string | null,"coach_name"?: string,"created_at"?: string,"id"?: string,"log_id"?: string | null,"program_id"?: string | null,"program_title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "feedback_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_log_id_fkey"
      columns: ["log_id"]
isOneToOne: false
      referencedRelation: "session_logs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"feedback_replies": {
                  Row: {
                    "body": string,"created_at": string,"feedback_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"feedback_id": string,"id"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"feedback_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "feedback_replies_feedback_id_fkey"
      columns: ["feedback_id"]
isOneToOne: false
      referencedRelation: "feedback"
      referencedColumns: ["id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "code": string,"created_at": string,"program_id": string,"revoked_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"program_id": string,"revoked_at"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"program_id"?: string,"revoked_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"item_logs": {
                  Row: {
                    "effort": number | null,"id": string,"item_id": string | null,"log_id": string,"logged_at": string,"note": string,"position": number,"rounds_done": number | null,"rounds_planned": number | null,"technique": number | null,"type": Database["public"]['Enums']["prescription_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "effort"?: number | null,"id"?: string,"item_id"?: string | null,"log_id": string,"logged_at"?: string,"note"?: string,"position": number,"rounds_done"?: number | null,"rounds_planned"?: number | null,"technique"?: number | null,"type": Database["public"]['Enums']["prescription_type"]
                  }
                  Update: {
                    "effort"?: number | null,"id"?: string,"item_id"?: string | null,"log_id"?: string,"logged_at"?: string,"note"?: string,"position"?: number,"rounds_done"?: number | null,"rounds_planned"?: number | null,"technique"?: number | null,"type"?: Database["public"]['Enums']["prescription_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_logs_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "content_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_logs_log_id_fkey"
      columns: ["log_id"]
isOneToOne: false
      referencedRelation: "session_logs"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string,"conversation_id": string,"created_at": string,"id": number,"sender_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"conversation_id": string,"created_at"?: string,"id"?: never,"sender_id"?: string | null
                  }
                  Update: {
                    "body"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: never,"sender_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
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
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"id": number,"kind": string,"link": string,"read_at": string | null,"ref": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string,"created_at"?: string,"id"?: never,"kind": string,"link"?: string,"read_at"?: string | null,"ref"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: never,"kind"?: string,"link"?: string,"read_at"?: string | null,"ref"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "amount_paise": number,"created_at": string,"currency": string,"engagement_id": string,"fee_bps": number,"id": string,"kind": string,"paid_at": string | null,"period_end": string,"period_start": string,"provider_order_id": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"created_at"?: string,"currency"?: string,"engagement_id": string,"fee_bps": number,"id"?: string,"kind"?: string,"paid_at"?: string | null,"period_end": string,"period_start": string,"provider_order_id"?: string | null,"status"?: string
                  }
                  Update: {
                    "amount_paise"?: number,"created_at"?: string,"currency"?: string,"engagement_id"?: string,"fee_bps"?: number,"id"?: string,"kind"?: string,"paid_at"?: string | null,"period_end"?: string,"period_start"?: string,"provider_order_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: false
      referencedRelation: "engagements"
      referencedColumns: ["id"]
    }
                  ]
                },"packages": {
                  Row: {
                    "coach_id": string,"created_at": string,"currency": string,"id": string,"kind": string,"live": boolean,"price_paise": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coach_id": string,"created_at"?: string,"currency"?: string,"id"?: string,"kind": string,"live"?: boolean,"price_paise": number,"title": string
                  }
                  Update: {
                    "coach_id"?: string,"created_at"?: string,"currency"?: string,"id"?: string,"kind"?: string,"live"?: boolean,"price_paise"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "packages_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "coach_profiles"
      referencedColumns: ["coach_id"]
    }
                  ]
                },"pain_reports": {
                  Row: {
                    "athlete_id": string,"created_at": string,"id": string,"question_id": string | null,"reported_on": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "athlete_id": string,"created_at"?: string,"id"?: string,"question_id"?: string | null,"reported_on"?: string,"source"?: string
                  }
                  Update: {
                    "athlete_id"?: string,"created_at"?: string,"id"?: string,"question_id"?: string | null,"reported_on"?: string,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pain_reports_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pain_reports_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "ai_questions"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_events": {
                  Row: {
                    "id": number,"note": string | null,"payload": NonNullable<Json>,"provider_event_id": string,"received_at": string,"result": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"note"?: string | null,"payload": NonNullable<Json>,"provider_event_id": string,"received_at"?: string,"result"?: string | null,"type": string
                  }
                  Update: {
                    "id"?: never,"note"?: string | null,"payload"?: NonNullable<Json>,"provider_event_id"?: string,"received_at"?: string,"result"?: string | null,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payment_settings": {
                  Row: {
                    "fake_allowed": boolean,"id": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "fake_allowed"?: boolean,"id"?: boolean
                  }
                  Update: {
                    "fake_allowed"?: boolean,"id"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "amount_paise": number,"captured_at": string,"currency": string,"id": string,"order_id": string,"provider_payment_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"captured_at"?: string,"currency": string,"id"?: string,"order_id": string,"provider_payment_id": string,"status": string
                  }
                  Update: {
                    "amount_paise"?: number,"captured_at"?: string,"currency"?: string,"id"?: string,"order_id"?: string,"provider_payment_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"payouts": {
                  Row: {
                    "coach_id": string | null,"created_at": string,"fee_paise": number,"gross_paise": number,"hold_until": string,"id": string,"net_paise": number,"payment_id": string,"provider_transfer_id": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coach_id"?: string | null,"created_at"?: string,"fee_paise": number,"gross_paise": number,"hold_until": string,"id"?: string,"net_paise": number,"payment_id": string,"provider_transfer_id"?: string | null,"status"?: string
                  }
                  Update: {
                    "coach_id"?: string | null,"created_at"?: string,"fee_paise"?: number,"gross_paise"?: number,"hold_until"?: string,"id"?: string,"net_paise"?: number,"payment_id"?: string,"provider_transfer_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payouts_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payouts_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: true
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
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
                },"program_sessions": {
                  Row: {
                    "day": number,"id": string,"position": number,"title": string,"version_id": string,"week": number
                  }
                  ComputedFields: never
                  Insert: {
                    "day": number,"id"?: string,"position"?: number,"title"?: string,"version_id": string,"week": number
                  }
                  Update: {
                    "day"?: number,"id"?: string,"position"?: number,"title"?: string,"version_id"?: string,"week"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_sessions_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "program_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"program_versions": {
                  Row: {
                    "created_at": string,"effective_from": string | null,"id": string,"program_id": string,"published_at": string | null,"summary": string | null,"title": string | null,"version": number,"weeks": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"effective_from"?: string | null,"id"?: string,"program_id": string,"published_at"?: string | null,"summary"?: string | null,"title"?: string | null,"version": number,"weeks"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"effective_from"?: string | null,"id"?: string,"program_id"?: string,"published_at"?: string | null,"summary"?: string | null,"title"?: string | null,"version"?: number,"weeks"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_versions_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"programs": {
                  Row: {
                    "category_id": string,"coach_id": string | null,"created_at": string,"id": string,"show_on_profile": boolean,"summary": string,"title": string,"updated_at": string,"weeks": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"coach_id"?: string | null,"created_at"?: string,"id"?: string,"show_on_profile"?: boolean,"summary"?: string,"title": string,"updated_at"?: string,"weeks"?: number
                  }
                  Update: {
                    "category_id"?: string,"coach_id"?: string | null,"created_at"?: string,"id"?: string,"show_on_profile"?: boolean,"summary"?: string,"title"?: string,"updated_at"?: string,"weeks"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "programs_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "programs_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"saves": {
                  Row: {
                    "created_at": string,"item_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"item_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"item_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saves_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "content_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saves_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"session_items": {
                  Row: {
                    "cue": string,"id": string,"item_id": string,"position": number,"prescription": NonNullable<Json>,"session_id": string,"type": Database["public"]['Enums']["prescription_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "cue"?: string,"id"?: string,"item_id": string,"position": number,"prescription": NonNullable<Json>,"session_id": string,"type": Database["public"]['Enums']["prescription_type"]
                  }
                  Update: {
                    "cue"?: string,"id"?: string,"item_id"?: string,"position"?: number,"prescription"?: NonNullable<Json>,"session_id"?: string,"type"?: Database["public"]['Enums']["prescription_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_items_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "content_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_items_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "program_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"session_logs": {
                  Row: {
                    "athlete_id": string,"category_id": string,"completed_at": string | null,"created_at": string,"id": string,"note": string,"on_date": string,"program_id": string | null,"session_id": string | null,"started_at": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "athlete_id": string,"category_id": string,"completed_at"?: string | null,"created_at"?: string,"id"?: string,"note"?: string,"on_date": string,"program_id"?: string | null,"session_id"?: string | null,"started_at"?: string,"title"?: string
                  }
                  Update: {
                    "athlete_id"?: string,"category_id"?: string,"completed_at"?: string | null,"created_at"?: string,"id"?: string,"note"?: string,"on_date"?: string,"program_id"?: string | null,"session_id"?: string | null,"started_at"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_logs_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_logs_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_logs_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_logs_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "program_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"set_logs": {
                  Row: {
                    "id": string,"item_log_id": string,"load_kg": number | null,"logged_at": string,"reps": number,"rpe": number,"set_no": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"item_log_id": string,"load_kg"?: number | null,"logged_at"?: string,"reps": number,"rpe": number,"set_no": number
                  }
                  Update: {
                    "id"?: string,"item_log_id"?: string,"load_kg"?: number | null,"logged_at"?: string,"reps"?: number,"rpe"?: number,"set_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "set_logs_item_log_id_fkey"
      columns: ["item_log_id"]
isOneToOne: false
      referencedRelation: "item_logs"
      referencedColumns: ["id"]
    }
                  ]
                },"shortlists": {
                  Row: {
                    "athlete_id": string,"coach_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "athlete_id": string,"coach_id": string,"created_at"?: string
                  }
                  Update: {
                    "athlete_id"?: string,"coach_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shortlists_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shortlists_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "coach_profiles"
      referencedColumns: ["coach_id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "created_at": string,"engagement_id": string,"id": string,"provider_subscription_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"engagement_id": string,"id"?: string,"provider_subscription_id": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"engagement_id"?: string,"id"?: string,"provider_subscription_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: true
      referencedRelation: "engagements"
      referencedColumns: ["id"]
    }
                  ]
                },"today_extras": {
                  Row: {
                    "athlete_id": string,"created_at": string,"item_id": string,"on_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "athlete_id": string,"created_at"?: string,"item_id": string,"on_date"?: string
                  }
                  Update: {
                    "athlete_id"?: string,"created_at"?: string,"item_id"?: string,"on_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "today_extras_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "today_extras_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "content_items"
      referencedColumns: ["id"]
    }
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
            "public_credentials": {
                  Row: {
                    "coach_id": string,"decided_at": string | null,"id": string,"issuer": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                           "coach_id"?: string | null,"decided_at"?: string | null,"id"?: string | null,"issuer"?: string | null,"title"?: string | null
                         }
                        Update: {
                           "coach_id"?: string | null,"decided_at"?: string | null,"id"?: string | null,"issuer"?: string | null,"title"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "credentials_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "coach_profiles"
      referencedColumns: ["coach_id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_coach_agreement":
{ Args: { "version": string }; Returns: undefined
                           },
"add_to_today":
{ Args: { "items": (string)[] }; Returns: number
                           },
"adherence":
{ Args: { "athlete": string,"program"?: string }; Returns: {
              "completed": number,"scheduled": number
            }[]
                           },
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
"admin_pending_credentials":
{ Args: Record<PropertyKey, never>; Returns: {
              "coach_id": string,"coach_name": string,"created_at": string,"file_path": string,"id": string,"id_number": string,"issuer": string,"title": string
            }[]
                           },
"admin_set_roles":
{ Args: { "expected_roles": (Database["public"]['Enums']["app_role"])[],"new_roles": (Database["public"]['Enums']["app_role"])[],"target": string }; Returns: undefined
                           },
"ai_daily_limit":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"ai_questions_left":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"apply_payment_event":
{ Args: { "body": Json,"event_id": string,"event_type": string }; Returns: string
                           },
"apply_sport_answers":
{ Args: { "by_sport": Json,"uid": string }; Returns: undefined
                           },
"apply_subscription_event":
{ Args: { "body": Json,"ev": number,"event_type": string }; Returns: string
                           },
"assert_live_ready":
{ Args: { "coach": string }; Returns: undefined
                           },
"assign_program":
{ Args: { "engagement": string,"program": string }; Returns: {
              "created": boolean,"enrollment_id": string
            }[]
                           },
"attach_provider_order":
{ Args: { "order_": string,"provider_order": string }; Returns: string
                           },
"attach_subscription":
{ Args: { "engagement": string,"provider_subscription": string }; Returns: string
                           },
"author_names":
{ Args: { "ids": (string)[] }; Returns: {
              "display_name": string,"id": string
            }[]
                           },
"cancel_coaching":
{ Args: { "engagement": string,"reason"?: string }; Returns: string
                           },
"claim_emails":
{ Args: { "max_rows"?: number,"templates": (string)[] }; Returns: {
              "attempts": number,
"claimed_at": string | null,
"created_at": string,
"data": NonNullable<Json>,
"id": number,
"sent_at": string | null,
"template": string,
"to_email": string,
"user_id": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "email_outbox"
        isOneToOne: false
        isSetofReturn: true
      } },
"coach_can_read":
{ Args: { "athlete": string }; Returns: boolean
                           },
"coach_filter_options":
{ Args: Record<PropertyKey, never>; Returns: {
              "kind": string,"value": string
            }[]
                           },
"coach_has_room":
{ Args: { "coach": string }; Returns: boolean
                           },
"coach_is_live":
{ Args: { "coach": string }; Returns: boolean
                           },
"coach_places_taken":
{ Args: { "coach": string }; Returns: number
                           },
"coach_programs":
{ Args: { "coach": string }; Returns: {
              "enrolled_band": number,"program_id": string,"title": string,"weeks": number
            }[]
                           },
"coach_public_name":
{ Args: { "coach": string }; Returns: string
                           },
"coach_reads_body":
{ Args: { "athlete": string }; Returns: boolean
                           },
"coach_reads_program":
{ Args: { "athlete": string,"program": string }; Returns: boolean
                           },
"coach_requests":
{ Args: Record<PropertyKey, never>; Returns: {
              "athlete_name": string,"cancel_at_period_end": boolean,"created_at": string,"days_per_week": number,"engagement_id": string,"goals": string,"package_kind": string,"package_title": string,"paid_through": string,"price_paise": number,"share_data": boolean,"start_date": string,"status": string
            }[]
                           },
"coach_stats":
{ Args: { "coach": string }; Returns: {
              "adherence_pct": number,"athletes": number,"programs_finished": number,"stayed_pct": number
            }[]
                           },
"complete_about_you":
{ Args: { "birth_date": string,"first_name": string,"sports": (string)[] }; Returns: undefined
                           },
"conversation_open":
{ Args: { "cv": Omit<Database["public"]['Tables']["conversations"]['Row'], Database["public"]['Tables']["conversations"]['ComputedFields']> }; Returns: boolean
                           },
"create_program":
{ Args: { "category": string,"title": string }; Returns: string
                           },
"credential_file_locked":
{ Args: { "path": string }; Returns: boolean
                           },
"current_coach_agreement":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"decide_coach_application":
{ Args: { "application": string,"approve": boolean }; Returns: undefined
                           },
"decide_credential":
{ Args: { "approve": boolean,"credential": string,"note": string }; Returns: undefined
                           },
"decide_request":
{ Args: { "accept": boolean,"engagement": string }; Returns: undefined
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"email_wanted":
{ Args: { "person": string,"template": string }; Returns: boolean
                           },
"engagement_opens":
{ Args: { "g": Omit<Database["public"]['Tables']["engagements"]['Row'], Database["public"]['Tables']["engagements"]['ComputedFields']> }; Returns: boolean
                           },
"ever_enrolled":
{ Args: { "program": string }; Returns: boolean
                           },
"export_my_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"fee_paise":
{ Args: { "bps": number,"gross": number }; Returns: number
                           },
"find_coaches":
{ Args: { "checked_only"?: boolean,"city"?: string,"experience"?: string,"format"?: string,"ids"?: (string)[],"language"?: string,"max_paise"?: number,"min_paise"?: number,"min_rating"?: number,"sort"?: string,"specialty"?: string }; Returns: {
              "checked": boolean,"coach_city": string,"coach_id": string,"formats": (string)[],"from_paise": number,"headline": string,"languages": (string)[],"name": string,"rating": number,"review_count": number,"specialties": (string)[],"years": number
            }[]
                           },
"finish_ai_question":
{ Args: { "answer_body": Json,"answer_kind": string,"cost_micro_usd": number,"input_tokens": number,"output_tokens": number,"question_id": string }; Returns: undefined
                           },
"finish_session":
{ Args: { "on_date": string,"opened_at"?: string,"session": string }; Returns: string
                           },
"give_feedback":
{ Args: { "body": string,"enrollment": string,"log"?: string }; Returns: string
                           },
"grant_role":
{ Args: { "new_role": Database["public"]['Enums']["app_role"],"target": string }; Returns: undefined
                           },
"hard_sets_per_muscle":
{ Args: { "athlete": string,"from_date": string,"log"?: string,"to_date": string }; Returns: {
              "muscle_group": string,"muscle_id": string,"name": string,"sets": number
            }[]
                           },
"has_role":
{ Args: { "wanted": Database["public"]['Enums']["app_role"] }; Returns: boolean
                           },
"india_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"invite_info":
{ Args: { "code": string }; Returns: {
              "active": boolean,"category_id": string,"coach_name": string,"program_id": string,"published": boolean,"summary": string,"title": string,"weeks": number
            }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"join_program":
{ Args: { "code": string }; Returns: string
                           },
"leave_program":
{ Args: { "enrollment": string }; Returns: undefined
                           },
"log_body_weight":
{ Args: { "weight_kg": number }; Returns: string
                           },
"log_drill":
{ Args: { "effort": number,"item_position": number,"note": string,"on_date": string,"rounds_done": number,"session": string,"technique": number }; Returns: string
                           },
"log_set":
{ Args: { "item_position": number,"load_kg": number,"on_date": string,"reps": number,"rpe": number,"session": string,"set_no": number }; Returns: string
                           },
"mark_notifications_read":
{ Args: { "ids"?: (number)[] }; Returns: number
                           },
"mark_subscription_cancelled":
{ Args: { "subscription": string }; Returns: undefined
                           },
"money_invariants":
{ Args: Record<PropertyKey, never>; Returns: {
              "ref": string,"rule": string
            }[]
                           },
"month_period_end":
{ Args: { "start": string }; Returns: string
                           },
"my_coach_profile":
{ Args: Record<PropertyKey, never>; Returns: {
              "agreement_accepted_at": string,"agreement_version": string,"city": string,"client_limit": number,"coach_id": string,"formats": (string)[],"headline": string,"languages": (string)[],"philosophy": string,"specialties": (string)[],"status": string,"updated_at": string,"years": number
            }[]
                           },
"my_conversations":
{ Args: Record<PropertyKey, never>; Returns: {
              "can_send": boolean,"conversation_id": string,"i_am_coach": boolean,"last_message_at": string,"other_id": string,"other_is_live_coach": boolean,"other_name": string
            }[]
                           },
"my_email_prefs":
{ Args: Record<PropertyKey, never>; Returns: {
              "coach_feedback": boolean,"new_lesson": boolean,"session_reminder": boolean
            }[]
                           },
"my_programs":
{ Args: Record<PropertyKey, never>; Returns: {
              "category_id": string,"coach_name": string,"enrollment_id": string,"joined_at": string,"program_id": string,"start_date": string,"summary": string,"title": string,"version_id": string,"weeks": number
            }[]
                           },
"new_invite_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"open_conversation":
{ Args: { "engagement": string }; Returns: string
                           },
"own_draft":
{ Args: { "program": string }; Returns: string
                           },
"owns_program":
{ Args: { "program": string }; Returns: boolean
                           },
"payout_hold_days":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"platform_fee_bps":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"program_invite":
{ Args: { "program": string }; Returns: string
                           },
"program_is_published":
{ Args: { "program": string }; Returns: boolean
                           },
"program_members":
{ Args: { "program": string }; Returns: {
              "athlete_id": string,"display_name": string,"enrollment_id": string,"joined_at": string,"status": Database["public"]['Enums']["enrollment_status"]
            }[]
                           },
"publish_program":
{ Args: { "program": string }; Returns: number
                           },
"queue_coaching_emails":
{ Args: { "g": Omit<Database["public"]['Tables']["engagements"]['Row'], Database["public"]['Tables']["engagements"]['ComputedFields']>,"template_": string }; Returns: undefined
                           },
"queue_session_reminders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"record_consent":
{ Args: { "answer": boolean,"notice": string,"uid": string,"what": Database["public"]['Enums']["consent_purpose"] }; Returns: undefined
                           },
"remove_athlete":
{ Args: { "enrollment": string }; Returns: string
                           },
"reply_feedback":
{ Args: { "body": string,"feedback": string }; Returns: string
                           },
"request_coaching":
{ Args: { "days": number,"goals": string,"package": string,"share": boolean,"start": string }; Returns: string
                           },
"require_published":
{ Args: { "item": string }; Returns: string
                           },
"require_step1":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"reserve_ai_question":
{ Args: { "question": string }; Returns: string
                           },
"reset_invite":
{ Args: { "program": string }; Returns: string
                           },
"retrieve_for_ai":
{ Args: { "k"?: number,"question": string }; Returns: {
              "category_id": string,"dose": Json,"item_id": string,"kind": Database["public"]['Enums']["content_kind"],"mistakes": string,"rank": number,"safety": string,"slug": string,"steps": string,"summary": string,"title": string
            }[]
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
"save_coach_profile":
{ Args: { "city": string,"client_limit": number,"formats": (string)[],"headline": string,"languages": (string)[],"philosophy": string,"specialties": (string)[],"years": number }; Returns: undefined
                           },
"save_content_draft":
{ Args: { "discipline": string,"duration_min": number,"equipment": (string)[],"item": string,"kind": Database["public"]['Enums']["content_kind"],"level": Database["public"]['Enums']["content_level"],"mistakes": string,"muscles": (string)[],"prerequisites": (string)[],"safety": string,"steps": (string)[],"summary": string,"supports": (string)[],"title": string,"video_id": string }; Returns: string
                           },
"save_package":
{ Args: { "kind": string,"live": boolean,"package": string,"price_paise": number,"title": string }; Returns: string
                           },
"save_program_draft":
{ Args: { "program": string,"sessions": Json,"summary": string,"title": string,"weeks": number }; Returns: undefined
                           },
"save_session_note":
{ Args: { "note": string,"on_date": string,"session": string }; Returns: string
                           },
"save_training_basics":
{ Args: { "ai_consent": boolean,"days": number,"equipment": (string)[],"injury_notes": string,"notice": string,"sport_answers": Json }; Returns: undefined
                           },
"scheduled_session":
{ Args: { "on_date": string,"session": string }; Returns: {
              "category_id": string,"program_id": string,"program_title": string,"title": string
            }[]
                           },
"search_content":
{ Args: { "q": string }; Returns: {
              "author_id": string,"category_id": string,"duration_min": number,"equipment": (string)[],"is_sample": boolean,"kind": Database["public"]['Enums']["content_kind"],"level": Database["public"]['Enums']["content_level"],"rank": number,"slug": string,"supports": (string)[],"title": string
            }[]
                           },
"seed_sample_content":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"send_message":
{ Args: { "body": string,"conversation": string }; Returns: number
                           },
"set_completed":
{ Args: { "done": boolean,"item": string }; Returns: undefined
                           },
"set_email_pref":
{ Args: { "enabled": boolean,"kind": string }; Returns: undefined
                           },
"set_my_consent":
{ Args: { "granted": boolean,"purpose": Database["public"]['Enums']["consent_purpose"] }; Returns: undefined
                           },
"set_profile_live":
{ Args: { "live": boolean }; Returns: undefined
                           },
"set_program_listed":
{ Args: { "listed": boolean,"program": string }; Returns: undefined
                           },
"set_saved":
{ Args: { "item": string,"saved": boolean }; Returns: undefined
                           },
"set_slots":
{ Args: { "slots": Json }; Returns: undefined
                           },
"shortlist_coach":
{ Args: { "coach": string,"on_list": boolean }; Returns: undefined
                           },
"skill_ratings":
{ Args: { "athlete": string }; Returns: {
              "item_id": string,"logs": number,"rating": number
            }[]
                           },
"start_checkout":
{ Args: { "athlete": string,"engagement": string }; Returns: {
              "amount_paise": number,"order_id": string,"provider_order_id": string
            }[]
                           },
"submit_coach_application":
{ Args: { "category": string,"city": string,"full_name": string,"how_today": string,"work_url": string,"years": number }; Returns: undefined
                           },
"submit_content":
{ Args: { "item": string }; Returns: undefined
                           },
"submit_credential":
{ Args: { "file_path": string,"id_number"?: string,"issuer"?: string,"title": string }; Returns: string
                           },
"subscriptions_to_stop":
{ Args: Record<PropertyKey, never>; Returns: {
              "provider_subscription_id": string,"subscription_id": string
            }[]
                           },
"sweep_engagements":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"valid_prescription":
{ Args: { "p": Json,"t": Database["public"]['Enums']["prescription_type"] }; Returns: boolean
                           },
"version_in_effect":
{ Args: { "on_date": string,"program": string }; Returns: string
                           },
"withdraw_credential":
{ Args: { "credential": string }; Returns: undefined
                           },
"withdraw_my_credentials":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"withdraw_request":
{ Args: { "engagement": string }; Returns: undefined
                           }
          }
          Enums: {
            "app_role": "athlete"|"coach"|"reviewer"|"admin","application_status": "pending"|"approved"|"declined","consent_purpose": "ai_health_personalisation"|"ai_body_metrics","content_kind": "skill"|"drill"|"exercise","content_level": "beginner"|"intermediate"|"advanced","content_link_kind": "prerequisite"|"related"|"alternative","content_status": "draft"|"in_review"|"needs_changes"|"published","enrollment_status": "active"|"left"|"removed"|"ended","prescription_type": "rounds"|"time"|"sets"
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
            "app_role": ["athlete", "coach", "reviewer", "admin"],"application_status": ["pending", "approved", "declined"],"consent_purpose": ["ai_health_personalisation", "ai_body_metrics"],"content_kind": ["skill", "drill", "exercise"],"content_level": ["beginner", "intermediate", "advanced"],"content_link_kind": ["prerequisite", "related", "alternative"],"content_status": ["draft", "in_review", "needs_changes", "published"],"enrollment_status": ["active", "left", "removed", "ended"],"prescription_type": ["rounds", "time", "sets"]
          }
        }
} as const
