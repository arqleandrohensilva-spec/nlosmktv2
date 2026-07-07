import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  handle: z.string().min(1),
  nicho: z.string().optional(),
});

export type Lacuna = {
  titulo: string;
  descricao: string;
  oportunidade_nl: string;
};

export type ConcorrentesOutput = {
  posts_analisados: number;
  total_posts_encontrados: number;
  media_curtidas: number;
  media_comentarios: number;
  tom_predominante: string;
  tem_cta_alta_pressao: boolean;
  percentual_com_emoji: number;
  pilares: {
    posicionamento: number;
    oferta: number;
    marketing: number;
    vendas: number;
  };
  dores_atacadas: string[];
  palavras_recorrentes: string[];
  descricao_tom: string;
  lacunas: Lacuna[];
  resumo_executivo: string;
};

const SYSTEM_PROMPT = `Você é o analista de inteligência competitiva da NL Arquitetos, escritório de arquitetura e interiores em São José dos Campos, SP.

Analise as legendas de posts do Instagram de um concorrente e entregue um mapa estratégico completo para que a NL identifique lacunas e oportunidades de diferenciação.

CONTEXTO DA NL ARQUITETOS:
- Lema: "A arquitetura como decisão"
- Diferencial: rigor técnico + sensibilidade estética
- Cliente: 30–45 anos, classe média, terreno ou aluguel, quer sair do aluguel
- Linhas: A (Arquitetura Residencial), B (Interiores), A+B (Integrado), C (Comercial)
- Tom: técnico com empatia, sem emoji, sem urgência artificial, CTA de baixo atrito
- Nunca: preto puro, emoji, superlativo vazio, CTA de alta pressão, preço sem qualificar

CLASSIFICAÇÃO DE PILARES:
- Posicionamento: posts que constroem autoridade, mostram método, processo, filosofia
- Oferta: posts que descrevem serviços, portfólio, resultados de projetos
- Marketing: posts educativos, dicas, desmistificação, conteúdo de valor
- Vendas: posts com CTA direto, promoção, urgência, captação explícita

Responda EXCLUSIVAMENTE com JSON puro, sem markdown:
{
  "posts_analisados": número,
  "tom_predominante": "palavra-chave de 1-2 palavras",
  "tem_cta_alta_pressao": true ou false,
  "percentual_com_emoji": número de 0 a 100,
  "pilares": {
    "posicionamento": número de 0 a 100,
    "oferta": número de 0 a 100,
    "marketing": número de 0 a 100,
    "vendas": número de 0 a 100
  },
  "dores_atacadas": ["lista", "de", "dores", "identificadas"],
  "palavras_recorrentes": ["lista", "de", "palavras"],
  "descricao_tom": "parágrafo de 2-3 frases descrevendo o tom e linguagem predominante",
  "lacunas": [
    {
      "titulo": "título curto da lacuna",
      "descricao": "o que eles não fazem / deixam descoberto",
      "oportunidade_nl": "como a NL pode ocupar esse espaço com sua identidade"
    },
    { "titulo": "...", "descricao": "...", "oportunidade_nl": "..." },
    { "titulo": "...", "descricao": "...", "oportunidade_nl": "..." }
  ],
  "resumo_executivo": "2-3 frases resumindo o que o concorrente faz bem e onde falha"
}`;

export const analisarConcorrente = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<ConcorrentesOutput> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      throw new Error(
        "A chave da Anthropic (ANTHROPIC_API_KEY) não foi configurada. Adicione o secret no backend antes de analisar concorrentes.",
      );
    }

    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken || !apifyToken.trim()) {
      throw new Error(
        "A chave APIFY_API_TOKEN não foi configurada. Adicione o secret no backend antes de analisar concorrentes.",
      );
    }

    const handle = data.handle.replace(/^@+/, "").trim();

    const apifyRes = await fetch(
      "https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=" +
        encodeURIComponent(apifyToken),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrls: [`https://www.instagram.com/${handle}/`],
          resultsType: "posts",
          resultsLimit: 20,
        }),
      },
    );

    if (!apifyRes.ok) {
      throw new Error(
        "Não foi possível acessar este perfil. Verifique se o @ está correto e se a conta é pública.",
      );
    }

    const posts: any[] = await apifyRes.json();
    if (!Array.isArray(posts) || posts.length === 0) {
      throw new Error(
        "Não foi possível acessar este perfil. Verifique se o @ está correto e se a conta é pública.",
      );
    }

    const legendas = posts
      .map(
        (p: any, i: number) =>
          `Post ${i + 1} | Curtidas: ${p.likesCount ?? 0} | Comentários: ${p.commentsCount ?? 0}\n${p.caption ?? "(sem legenda)"}`,
      )
      .join("\n---\n");

    const totalPosts = posts.length;
    const mediaCurtidas = Math.round(
      posts.reduce((s, p) => s + (p.likesCount ?? 0), 0) / totalPosts,
    );
    const mediaComentarios = Math.round(
      posts.reduce((s, p) => s + (p.commentsCount ?? 0), 0) / totalPosts,
    );

    const userPrompt = `Perfil analisado: ${handle}
Nicho: ${data.nicho ?? "não informado"}

Legendas dos posts:
${legendas}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
      throw new Error(`Falha na IA (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const content: string = json?.content?.[0]?.text ?? "";
    let parsed: ConcorrentesOutput;
    try {
      parsed = JSON.parse(content);
    } catch {
      const cleaned = content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("Resposta da IA não estava em JSON válido.");
        parsed = JSON.parse(match[0]);
      }
    }
    return {
      ...parsed,
      total_posts_encontrados: totalPosts,
      media_curtidas: mediaCurtidas,
      media_comentarios: mediaComentarios,
    };
  });