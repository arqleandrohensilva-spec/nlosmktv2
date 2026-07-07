// Constantes de marca NL Arquitetos — usadas em UI, seed e system prompt.

export const LINHAS = [
  { value: "A", label: "A — Arquitetura Residencial", tom: "Foco técnico, sem improviso no canteiro." },
  { value: "B", label: "B — Interiores Residenciais", tom: "Técnico com sensibilidade, funcionalidade real de uso." },
  { value: "AB", label: "A+B — Integrado", tom: "Projeto conjunto evita incompatibilidades na obra." },
  { value: "C", label: "C — Comercial", tom: "Direto e estratégico, retorno do espaço para o negócio." },
] as const;

export type LinhaValue = (typeof LINHAS)[number]["value"];

export const FORMATOS = [
  { value: "reels", label: "Reels com fundador" },
  { value: "estatico", label: "Post estático" },
  { value: "carrossel", label: "Carrossel" },
  { value: "stories", label: "Stories" },
] as const;

export const PILARES = [
  { value: "posicionamento", label: "Posicionamento" },
  { value: "oferta", label: "Oferta" },
  { value: "marketing", label: "Marketing" },
  { value: "vendas", label: "Vendas" },
] as const;

export const STATUS = [
  { value: "rascunho", label: "Rascunho" },
  { value: "pronto", label: "Pronto" },
  { value: "publicado", label: "Publicado" },
] as const;

export const LINHA_BADGE: Record<string, string> = {
  A: "bg-[color:var(--graphite)] text-white",
  B: "bg-[color:var(--bronze)] text-white",
  AB: "bg-[color:var(--travertino)] text-white",
  C: "bg-[color:var(--bege)] text-[color:var(--graphite)] border border-[color:var(--divisoria)]",
};

export const FRASES_VALIDADAS = [
  "Construir ou reformar não precisa ser uma dor de cabeça.",
  "Com planejamento certo, você conquista a casa dos seus sonhos sem estourar o orçamento.",
  "O barato que sai caro é começar sem projeto.",
  "O seu lar não precisa ser só uma construção — ele pode refletir quem você é.",
  "A arquitetura como decisão.",
];

export const REGRAS_NUNCA = [
  "Nunca usar preto puro (#000000).",
  "Nunca prometer preço ou valor antes de qualificar o projeto.",
  "Nunca usar emoji em materiais oficiais.",
  "Nunca usar CTA de alta pressão (\"contrate agora\", \"últimas vagas\").",
  "Nunca usar superlativos vazios ou urgência artificial.",
  "Nunca usar letra maiúscula decorativa.",
  "Máximo 3 tamanhos de texto por peça.",
];

export const RADAR_DATAS = [
  { mes: 1, dia: 15, titulo: "Início do ano letivo", gancho: "Casa organizada para rotina escolar — Linha B" },
  { mes: 2, dia: 10, titulo: "Planejamento anual", gancho: "Comece o ano com projeto no papel — Linha A" },
  { mes: 3, dia: 10, titulo: "Liberação FGTS aniversário", gancho: "Como usar o FGTS na obra — Linha A" },
  { mes: 4, dia: 22, titulo: "Descobrimento do Brasil", gancho: "Arquitetura brasileira de referência — Linha A+B" },
  { mes: 5, dia: 12, titulo: "Dia das Mães", gancho: "Casa que abraça a família — Linha B" },
  { mes: 6, dia: 12, titulo: "Dia dos Namorados", gancho: "Espaço a dois — Linha B" },
  { mes: 7, dia: 10, titulo: "Férias escolares", gancho: "Aproveitar as férias para planejar a obra — Linha A" },
  { mes: 8, dia: 11, titulo: "Dia dos Pais", gancho: "O projeto que o pai sonhou — Linha A" },
  { mes: 9, dia: 21, titulo: "Início da primavera", gancho: "Renovar o interior — Linha B" },
  { mes: 10, dia: 1, titulo: "Outubro Rosa", gancho: "Ambientes que acolhem — Linha B" },
  { mes: 11, dia: 1, titulo: "Novembro Azul", gancho: "Espaço de descompressão masculino — Linha B" },
  { mes: 11, dia: 25, titulo: "Black Friday", gancho: "Por que projeto não é promoção — Linha A" },
  { mes: 12, dia: 10, titulo: "13º salário / férias", gancho: "Investir o 13º no projeto — Linha A" },
];

export const SYSTEM_PROMPT = `Você é o sistema de marketing estratégico da NL Arquitetos, escritório de arquitetura e interiores em São José dos Campos, SP. Lema institucional: "A arquitetura como decisão."

TOM DE VOZ:
- Técnico com sensibilidade estética: rigor + empatia, nunca um sem o outro
- Direto e sóbrio. Sem superlativos vazios, sem urgência artificial
- Autoridade sem arrogância: mostrar domínio técnico, não ostentação
- Nunca prometer preço ou valor antes de qualificar o projeto
- Nunca usar emoji em materiais oficiais

PERSONA DO CLIENTE (Cliente 7D):
- 30–45 anos, casado(a), muitos com filhos pequenos
- Classe média: analistas, técnicos, servidores públicos, pequenos empreendedores
- Renda familiar R$7mil–15mil/mês
- Situação: no aluguel com terreno sem saber como começar, OU tem imóvel mas insatisfeito
- Desejo: sair do aluguel, ter casa própria com orgulho, espaço que reflita sua identidade
- Decisores de compra: clareza em cada etapa, segurança financeira, confiança no profissional

REGRAS DE COPY:
- CTA sempre de baixo atrito — convite para conversa, nunca "contrate agora"
- Corpo do texto sempre alinhado à esquerda
- Itálico só para citações ou termos técnicos
- Máximo 3 tamanhos de texto por peça
- Sem letra maiúscula decorativa

LINHAS DE NEGÓCIO:
- Linha A (Arquitetura Residencial): foco técnico, "sem improviso no canteiro"
- Linha B (Interiores Residencial): técnico com sensibilidade, funcionalidade real de uso
- Linha A+B (Integrado): argumento central — projeto conjunto evita incompatibilidades na obra
- Linha C (Comercial): tom direto e estratégico, retorno do espaço para o negócio

FRASES VALIDADAS (usar quando apropriado):
- "Construir ou reformar não precisa ser uma dor de cabeça."
- "Com planejamento certo, você conquista a casa dos seus sonhos sem estourar o orçamento."
- "O barato que sai caro é começar sem projeto."
- "O seu lar não precisa ser só uma construção — ele pode refletir quem você é."
- "A arquitetura como decisão."

FORMATO DE RESPOSTA (JSON estrito, sem markdown, sem comentários):
{
  "pilar": "posicionamento" | "oferta" | "marketing" | "vendas",
  "justificativa_formato": "1-2 frases explicando por que o formato escolhido faz sentido para esta dor e linha",
  "raciocinio": "3-5 frases conectando dor da persona → pilar estratégico → formato → tom",
  "copy_roteiro": "roteiro falado para Reels de 30-40s (deixe vazio se formato não for reels)",
  "copy_legenda": "legenda completa com abertura, desenvolvimento e fechamento",
  "copy_cta": "CTA de baixo atrito, convite para conversa",
  "briefing_visual": "fundo, tipografia, composição, indicação de material do acervo"
}`;