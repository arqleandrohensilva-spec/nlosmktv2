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
      antes_depois: {
        Row: {
          ambiente: string | null
          conteudos: Json | null
          created_at: string
          descricao_transformacao: string | null
          id: string
          imagem_antes_id: string | null
          imagem_depois_id: string | null
          linha: string
          nome: string
          projeto_id: string | null
          status_publicacao: Json
        }
        Insert: {
          ambiente?: string | null
          conteudos?: Json | null
          created_at?: string
          descricao_transformacao?: string | null
          id?: string
          imagem_antes_id?: string | null
          imagem_depois_id?: string | null
          linha: string
          nome: string
          projeto_id?: string | null
          status_publicacao?: Json
        }
        Update: {
          ambiente?: string | null
          conteudos?: Json | null
          created_at?: string
          descricao_transformacao?: string | null
          id?: string
          imagem_antes_id?: string | null
          imagem_depois_id?: string | null
          linha?: string
          nome?: string
          projeto_id?: string | null
          status_publicacao?: Json
        }
        Relationships: [
          {
            foreignKeyName: "antes_depois_imagem_antes_id_fkey"
            columns: ["imagem_antes_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_imagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antes_depois_imagem_depois_id_fkey"
            columns: ["imagem_depois_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_imagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antes_depois_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
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
          status_canais: Json
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
          status_canais?: Json
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
          status_canais?: Json
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
      estudos_caso: {
        Row: {
          cidade: string | null
          conteudos: Json | null
          created_at: string
          detalhe_tecnico: string | null
          id: string
          imagens_ids: string[]
          linha: string
          nome_projeto: string
          partido: string
          problema: string
          restricoes: string | null
          resultado: string
          solucoes: string[]
          status: string
        }
        Insert: {
          cidade?: string | null
          conteudos?: Json | null
          created_at?: string
          detalhe_tecnico?: string | null
          id?: string
          imagens_ids?: string[]
          linha: string
          nome_projeto: string
          partido: string
          problema: string
          restricoes?: string | null
          resultado: string
          solucoes?: string[]
          status?: string
        }
        Update: {
          cidade?: string | null
          conteudos?: Json | null
          created_at?: string
          detalhe_tecnico?: string | null
          id?: string
          imagens_ids?: string[]
          linha?: string
          nome_projeto?: string
          partido?: string
          problema?: string
          restricoes?: string | null
          resultado?: string
          solucoes?: string[]
          status?: string
        }
        Relationships: []
      }
      lancamentos: {
        Row: {
          bairro: string | null
          cidade: string
          construtora: string | null
          conteudos: Json | null
          created_at: string
          data_lancamento: string | null
          descricao: string | null
          faixa_preco: string | null
          id: string
          nome: string
          notas: string | null
          oportunidade_linha: string | null
          status: string | null
          tipo: string
          url_fonte: string | null
        }
        Insert: {
          bairro?: string | null
          cidade: string
          construtora?: string | null
          conteudos?: Json | null
          created_at?: string
          data_lancamento?: string | null
          descricao?: string | null
          faixa_preco?: string | null
          id?: string
          nome: string
          notas?: string | null
          oportunidade_linha?: string | null
          status?: string | null
          tipo: string
          url_fonte?: string | null
        }
        Update: {
          bairro?: string | null
          cidade?: string
          construtora?: string | null
          conteudos?: Json | null
          created_at?: string
          data_lancamento?: string | null
          descricao?: string | null
          faixa_preco?: string | null
          id?: string
          nome?: string
          notas?: string | null
          oportunidade_linha?: string | null
          status?: string | null
          tipo?: string
          url_fonte?: string | null
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
      prospeccao_historico: {
        Row: {
          created_at: string
          data_evento: string | null
          descricao: string
          id: string
          owner_id: string | null
          prospeccao_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          data_evento?: string | null
          descricao: string
          id?: string
          owner_id?: string | null
          prospeccao_id?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          data_evento?: string | null
          descricao?: string
          id?: string
          owner_id?: string | null
          prospeccao_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_historico_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccoes: {
        Row: {
          canal_abordagem: string | null
          cargo: string | null
          created_at: string
          data_followup: string | null
          data_primeiro_contato: string | null
          email: string | null
          empresa: string | null
          id: string
          instagram: string | null
          lancamento_id: string | null
          linha_interesse: string | null
          mensagem_enviada: string | null
          nome_contato: string | null
          notas: string | null
          origem: string
          owner_id: string | null
          potencial: string | null
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          canal_abordagem?: string | null
          cargo?: string | null
          created_at?: string
          data_followup?: string | null
          data_primeiro_contato?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          instagram?: string | null
          lancamento_id?: string | null
          linha_interesse?: string | null
          mensagem_enviada?: string | null
          nome_contato?: string | null
          notas?: string | null
          origem: string
          owner_id?: string | null
          potencial?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          canal_abordagem?: string | null
          cargo?: string | null
          created_at?: string
          data_followup?: string | null
          data_primeiro_contato?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          instagram?: string | null
          lancamento_id?: string | null
          linha_interesse?: string | null
          mensagem_enviada?: string | null
          nome_contato?: string | null
          notas?: string | null
          origem?: string
          owner_id?: string | null
          potencial?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospeccoes_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_buscas: {
        Row: {
          created_at: string
          id: string
          novos_lancamentos: number | null
          resultados_encontrados: number | null
          resumo: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          novos_lancamentos?: number | null
          resultados_encontrados?: number | null
          resumo?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          novos_lancamentos?: number | null
          resultados_encontrados?: number | null
          resumo?: string | null
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
