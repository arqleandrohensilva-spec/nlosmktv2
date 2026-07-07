import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { LINHAS, FRASES_VALIDADAS, REGRAS_NUNCA } from "@/lib/nl-brand";

export const Route = createFileRoute("/marca")({
  component: Marca,
});

const CORES = [
  { nome: "Deep Graphite", hex: "#3A3A3A", uso: "Texto principal, títulos, base" },
  { nome: "Branco Papel", hex: "#FFFFFF", uso: "Fundo padrão" },
  { nome: "Bronze Mineral", hex: "#8B7355", uso: "Acento, máx. 15% da tela" },
  { nome: "Bege Areia", hex: "#E8E4DF", uso: "Cards premium, seções editoriais" },
  { nome: "Gelo", hex: "#F5F5F5", uso: "Fundos secundários, inputs" },
  { nome: "Travertino", hex: "#B5A48A", uso: "Bordas suaves, ícones inativos" },
  { nome: "Cinza Divisória", hex: "#D1D1D1", uso: "Separadores, linhas de tabela" },
];

const PERSONA = {
  idade: "30–45 anos",
  perfil: "Casado(a), muitos com filhos pequenos. Classe média — analistas, técnicos, servidores públicos, pequenos empreendedores.",
  renda: "R$ 7.000 – R$ 15.000 / mês",
  situacao: "No aluguel com terreno sem saber como começar, OU tem imóvel mas insatisfeito.",
  desejo: "Sair do aluguel, ter casa própria com orgulho, espaço que reflita sua identidade.",
  decisores: [
    "Clareza em cada etapa do projeto",
    "Segurança financeira ao longo da obra",
    "Confiança no profissional",
  ],
};

function Marca() {
  return (
    <>
      <PageHeader
        eyebrow="Biblioteca de marca"
        title="Régua NL Arquitetos"
        description="Referência visual e verbal. Somente leitura — para consulta antes de qualquer peça."
      />
      <div className="px-4 md:px-10 py-8 space-y-10">
        <Section title="Paleta de cores">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CORES.map((c) => (
              <div key={c.hex} className="border border-[color:var(--divisoria)] rounded-lg overflow-hidden bg-white">
                <div
                  className="h-24"
                  style={{
                    backgroundColor: c.hex,
                    borderBottom: c.hex === "#FFFFFF" ? "1px solid #D1D1D1" : "none",
                  }}
                />
                <div className="p-3">
                  <div className="font-serif text-sm text-[color:var(--graphite)]">{c.nome}</div>
                  <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mt-1">{c.hex}</div>
                  <div className="text-xs text-[color:var(--muted-foreground)] mt-2">{c.uso}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tipografia">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-[color:var(--divisoria)] rounded-lg bg-white p-5">
              <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">TÍTULOS · GEORGIA</div>
              <div className="font-serif text-3xl mt-3 text-[color:var(--graphite)]">A arquitetura como decisão.</div>
            </div>
            <div className="border border-[color:var(--divisoria)] rounded-lg bg-white p-5">
              <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">CORPO · INTER</div>
              <div className="mt-3 text-sm text-[color:var(--graphite)]">
                O barato que sai caro é começar sem projeto. Este é o corpo padrão da interface.
              </div>
            </div>
            <div className="border border-[color:var(--divisoria)] rounded-lg bg-white p-5">
              <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">TÉCNICO · COURIER</div>
              <div className="font-mono text-xs mt-3 text-[color:var(--bronze)]">CÓDIGO · LINHA A · #8B7355</div>
            </div>
          </div>
        </Section>

        <Section title="Persona — Cliente 7D">
          <div className="border border-[color:var(--divisoria)] rounded-lg bg-[color:var(--bege)] p-6 space-y-3 text-sm">
            <PersonaRow k="Idade" v={PERSONA.idade} />
            <PersonaRow k="Perfil" v={PERSONA.perfil} />
            <PersonaRow k="Renda" v={PERSONA.renda} />
            <PersonaRow k="Situação" v={PERSONA.situacao} />
            <PersonaRow k="Desejo" v={PERSONA.desejo} />
            <PersonaRow k="Decisores" v={PERSONA.decisores.join(" · ")} />
          </div>
        </Section>

        <Section title="Linhas de negócio">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {LINHAS.map((l) => (
              <div key={l.value} className="border border-[color:var(--divisoria)] rounded-lg bg-white p-5">
                <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">LINHA {l.value}</div>
                <div className="font-serif text-lg mt-2 text-[color:var(--graphite)]">{l.label.split(" — ")[1]}</div>
                <div className="text-sm text-[color:var(--muted-foreground)] mt-2">{l.tom}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Frases validadas">
          <ul className="space-y-3">
            {FRASES_VALIDADAS.map((f) => (
              <li
                key={f}
                className="border-l-2 border-[color:var(--bronze)] pl-4 italic text-[color:var(--graphite)] font-serif text-lg"
              >
                "{f}"
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Nunca fazer">
          <ul className="space-y-2">
            {REGRAS_NUNCA.map((r) => (
              <li key={r} className="text-sm text-[color:var(--graphite)] flex items-start gap-2">
                <span className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mt-1">✕</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-4">
        {title.toUpperCase()}
      </div>
      {children}
    </section>
  );
}

function PersonaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-1 md:gap-4">
      <dt className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">{k.toUpperCase()}</dt>
      <dd className="text-[color:var(--graphite)]">{v}</dd>
    </div>
  );
}