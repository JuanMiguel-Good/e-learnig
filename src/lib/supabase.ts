import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          password_hash: string
          first_name: string
          last_name: string
          phone: string | null
          country_code: string
          role: 'admin' | 'participant'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          password_hash: string
          first_name: string
          last_name: string
          phone?: string | null
          country_code?: string
          role?: 'admin' | 'participant'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          first_name?: string
          last_name?: string
          phone?: string | null
          country_code?: string
          role?: 'admin' | 'participant'
          created_at?: string
          updated_at?: string
        }
      }
      instructors: {
        Row: {
          id: string
          name: string
          signature_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          signature_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          signature_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      courses: {
        Row: {
          id: string
          title: string
          description: string | null
          image_url: string | null
          instructor_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          image_url?: string | null
          instructor_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          image_url?: string | null
          instructor_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      modules: {
        Row: {
          id: string
          title: string
          description: string | null
          course_id: string
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          course_id: string
          order_index: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          course_id?: string
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      lessons: {
        Row: {
          id: string
          title: string
          content: string
          video_url: string
          module_id: string
          order_index: number
          duration_minutes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          video_url: string
          module_id: string
          order_index: number
          duration_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          video_url?: string
          module_id?: string
          order_index?: number
          duration_minutes?: number
          created_at?: string
          updated_at?: string
        }
      }
      course_assignments: {
        Row: {
          id: string
          user_id: string
          course_id: string
          assigned_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          assigned_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          assigned_at?: string
        }
      }
      lesson_progress: {
        Row: {
          id: string
          user_id: string
          lesson_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lesson_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lesson_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
        }
      }
      certificates: {
        Row: {
          id: string
          user_id: string
          course_id: string
          completion_date: string
          certificate_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          completion_date?: string
          certificate_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          completion_date?: string
          certificate_url?: string | null
          created_at?: string
        }
      }
    }
    Functions: {
      calculate_course_progress: {
        Args: {
          user_id_param: string
          course_id_param: string
        }
        Returns: number
      }
    }
  }
}