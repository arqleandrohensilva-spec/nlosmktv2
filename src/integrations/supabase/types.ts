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
      analises_concorrentes: {
        Row: {
          created_at: string
          handle: string
          id: string
          legendas_brutas: string
          nicho: string | null
          resultado: Json
        }
        Insert: {
          created_at?: string
          handle: string
          id?: string
          legendas_brutas: string
          nicho?: string | null
          resultado: Json
        }
        Update: {
          created_at?: string
          handle?: string
          id?: string
          legendas_brutas?: string
          nicho?: string | null
          resultado?: Json
        }
        Relationships: []
      }
      biblioteca_imagens: {
        Row: {
          ambiente: string | null
          conteudos_gerados: Json | null
          copies: Json | null
          created_at: string
          descricao_tecnica: string | null
          id: string
          linha: string
          nome_arquivo: string
          projeto_id: string | null
          status_publicacao: string
          tags: string[]
          tipo: string
          ultima_vez_usada: string | null
          url_storage: string
          vezes_usada: number
        }
        Insert: {
          ambiente?: string | null
          conteudos_gerados?: Json | null
          copies?: Json | null
          created_at?: string
          descricao_tecnica?: string | null
          id?: string
          linha: string
          nome_arquivo: string
          projeto_id?: string | null
          status_publicacao?: string
          tags?: string[]
          tipo: string
          ultima_vez_usada?: string | null
          url_storage: string
          vezes_usada?: number
        }
        Update: {
          ambiente?: string | null
          conteudos_gerados?: Json | null
          copies?: Json | null
          created_at?: string
          descricao_tecnica?: string | null
          id?: string
          linha?: string
          nome_arquivo?: string
          projeto_id?: string | null
          status_publicacao?: string
          tags?: string[]
          tipo?: string
          ultima_vez_usada?: string | null
          url_storage?: string
          vezes_usada?: number
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_imagens_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          chave: string
          id: string
          updated_at: string
          valor: string
        }
        Insert: {
          chave: string
          id?: string
          updated_at?: string
          valor: string
        }
        Update: {
          chave?: string
          id?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      dores: {
        Row: {
          categoria: string
          created_at: string
          descricao: string | null
          id: string
          titulo: string
          ultima_vez_usada: string | null
          vezes_usada: number
        }
        Insert: {
          categoria: string
          created_at?: string
          descricao?: string | null
          id?: string
          titulo: string
          ultima_vez_usada?: string | null
          vezes_usada?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          titulo?: string
          ultima_vez_usada?: string | null
          vezes_usada?: number
        }
        Relationships: []
      }
      objecoes: {
        Row: {
          categoria: string | null
          created_at: string
          id: string
          post_id: string | null
          respondida: boolean
          texto: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          respondida?: boolean
          texto: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          respondida?: boolean
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "objecoes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      performance: {
        Row: {
          comentarios: number
          compartilhamentos: number
          curtidas: number
          id: string
          post_id: string
          registrado_em: string
          salvamentos: number
          views: number
        }
        Insert: {
          comentarios?: number
          compartilhamentos?: number
          curtidas?: number
          id?: string
          post_id: string
          registrado_em?: string
          salvamentos?: number
          views?: number
        }
        Update: {
          comentarios?: number
          compartilhamentos?: number
          curtidas?: number
          id?: string
          post_id?: string
          registrado_em?: string
          salvamentos?: number
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          ano: number | null
          briefing_visual: string | null
          copy_cta: string | null
          copy_legenda: string | null
          copy_roteiro: string | null
          created_at: string
          data_publicacao: string | null
          dor_id: string | null
          formato: string
          id: string
          linha: string
          mes: number | null
          observacao: string | null
          pilar: string | null
          raciocinio: Json | null
          semana: number | null
          status: string
        }
        Insert: {
          ano?: number | null
          briefing_visual?: string | null
          copy_cta?: string | null
          copy_legenda?: string | null
          copy_roteiro?: string | null
          created_at?: string
          data_publicacao?: string | null
          dor_id?: string | null
          formato: string
          id?: string
          linha: string
          mes?: number | null
          observacao?: string | null
          pilar?: string | null
          raciocinio?: Json | null
          semana?: number | null
          status?: string
        }
        Update: {
          ano?: number | null
          briefing_visual?: string | null
          copy_cta?: string | null
          copy_legenda?: string | null
          copy_roteiro?: string | null
          created_at?: string
          data_publicacao?: string | null
          dor_id?: string | null
          formato?: string
          id?: string
          linha?: string
          mes?: number | null
          observacao?: string | null
          pilar?: string | null
          raciocinio?: Json | null
          semana?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_dor_id_fkey"
            columns: ["dor_id"]
            isOneToOne: false
            referencedRelation: "dores"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          linha: string
          nome: string
          status: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          linha: string
          nome: string
          status?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          linha?: string
          nome?: string
          status?: string
        }
        Relationships: []
      }
      uso_ia: {
        Row: {
          created_at: string
          custo_brl: number
          custo_usd: number
          detalhes: Json | null
          id: string
          modelo: string
          modulo: string
          operacao: string
          tokens_input: number
          tokens_output: number
        }
        Insert: {
          created_at?: string
          custo_brl?: number
          custo_usd?: number
          detalhes?: Json | null
          id?: string
          modelo?: string
          modulo: string
          operacao: string
          tokens_input?: number
          tokens_output?: number
        }
        Update: {
          created_at?: string
          custo_brl?: number
          custo_usd?: number
          detalhes?: Json | null
          id?: string
          modelo?: string
          modulo?: string
          operacao?: string
          tokens_input?: number
          tokens_output?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
