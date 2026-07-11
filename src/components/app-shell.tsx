import { useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import { supabaseExternal } from "@/lib/supabaseExternal";
import {
  LayoutDashboard,
  PenTool,
  Image as ImageIcon,
  Radar,
  TrendingUp,
  BadgeCheck,
  Settings,
} from "lucide-react";
import Sidebar, { type NavEntry } from "./CleanSidebar";

const navItems: NavEntry[] = [
  { type: "item", label: "Dashboard", to: "/", icon: LayoutDashboard },
  {
    type: "section",
    label: "Copy",
    icon: PenTool,
    children: [
      { label: "Motor de Copy", to: "/copy" },
      { label: "Reescrever", to: "/reescrever" },
      { label: "Kit de Publicação", to: "/kit-publicacao" },
    ],
  },
  {
    type: "section",
    label: "Conteúdo",
    icon: ImageIcon,
    children: [
      { label: "Estudos de Caso", to: "/estudos-de-caso" },
      { label: "Biblioteca Visual", to: "/biblioteca" },
      { label: "Calendário Editorial", to: "/calendario" },
    ],
  },
  {
    type: "section",
    label: "Inteligência",
    icon: Radar,
    children: [
      { label: "Radar de Concorrentes", to: "/concorrentes" },
      { label: "Radar de Mercado", to: "/radar-mercado" },
      { label: "Radar de Oportunidade", to: "/radar" },
    ],
  },
  {
    type: "section",
    label: "Vendas",
    icon: TrendingUp,
    children: [
      { label: "Banco de Objeções", to: "/objecoes" },
      { label: "Performance", to: "/performance" },
      { label: "CRM de Prospecção", to: "/prospeccao" },
    ],
  },
  {
    type: "section",
    label: "Marca",
    icon: BadgeCheck,
    children: [
      { label: "Detector de Régua", to: "/validar" },
      { label: "Biblioteca de Marca", to: "/marca" },
    ],
  },
  {
    type: "section",
    label: "Configurações",
    icon: Settings,
    children: [
      { label: "Custos IA", to: "/custos" },
      { label: "Integrações", to: "/configuracoes" },
    ],
  },
];

function deriveUser(email: string | null | undefined): { name: string; role?: string; initials?: string } | undefined {
  if (!email) return undefined;
  const local = email.split("@")[0] ?? email;
  const name = local.charAt(0).toUpperCase() + local.slice(1);
  const initials = name.slice(0, 2).toUpperCase();
  return { name, role: "NL Arquitetos", initials };
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabaseExternal.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabaseExternal.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const user = deriveUser(email);

  async function handleLogout() {
    await supabaseExternal.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen w-full bg-white">
      <Sidebar
        items={navItems}
        currentPath={pathname}
        onNavigate={(to) => navigate({ to })}
        logoText="NL"
        title="NL OS MKT"
        user={user}
        onLogout={handleLogout}
        onCollapsedChange={setCollapsed}
      />
      <main
        className="min-h-screen transition-all duration-300"
        style={{ marginLeft: collapsed ? 64 : 230 }}
      >
        {children}
      </main>
    </div>
  );
}