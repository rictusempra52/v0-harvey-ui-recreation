// Supabase データベース型定義

export type Apartment = {
  id: string
  name: string
  address: string | null
  created_at: string
  updated_at: string
}

export type Document = {
  id: string
  apartment_id: string | null
  file_name: string
  file_path: string
  file_size: number | null
  ocr_status: 'pending' | 'processing' | 'completed' | 'failed'
  ocr_text: string | null
  created_at: string
  updated_at: string
}

export type ChatSession = {
  id: string
  user_id: string
  apartment_id: string | null
  title: string | null
  created_at: string
  updated_at: string
}

export type ChatMessage = {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  sources: MessageSource[] | null
  created_at: string
}

export type MessageSource = {
  title: string
  page?: string
  content?: string
  annotations?: AnnotationData[]
  fileId?: string
  blockId?: string
}

export type AnnotationData = {
  id: string
  document_id: string
  message_id: string | null
  page_number: number | null
  annotation_data: Record<string, unknown>
  created_at: string
}

// Supabase クエリ用の型
export type Database = {
  public: {
    Tables: {
      apartments: {
        Row: Apartment
        Insert: Omit<Apartment, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Apartment, 'id' | 'created_at' | 'updated_at'>>
      }
      documents: {
        Row: Document
        Insert: Omit<Document, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Document, 'id' | 'created_at' | 'updated_at'>>
      }
      chat_sessions: {
        Row: ChatSession
        Insert: Omit<ChatSession, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ChatSession, 'id' | 'created_at' | 'updated_at'>>
      }
      chat_messages: {
        Row: ChatMessage
        Insert: Omit<ChatMessage, 'id' | 'created_at'>
        Update: Partial<Omit<ChatMessage, 'id' | 'created_at'>>
      }
      annotations: {
        Row: AnnotationData
        Insert: Omit<AnnotationData, 'id' | 'created_at'>
        Update: Partial<Omit<AnnotationData, 'id' | 'created_at'>>
      }
    }
  }
}
