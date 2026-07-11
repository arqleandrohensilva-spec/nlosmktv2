import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
import {
  LayoutDashboard,
  Sparkles,
  Calendar,
  Shield,
  BarChart3,
  BookOpen,
  Radar,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Crosshair,
  DollarSign,
  RefreshCw,
  Send,
  Image as ImageIcon,
  MapPin,
  UserCheck,
  Settings,
} from "lucide-react";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/copy", label: "Motor de Copy IA", icon: Sparkles },
      { to: "/reescrever", label: "Reescritor", icon: RefreshCw },
      { to: "/kit-publicacao", label: "Kit de Publicação", icon: Send },
      { to: "/estudos-de-caso", label: "Estudos de Caso", icon: BookOpen },
    ],
  },
  {
    label: "GESTÃO",
    items: [
      { to: "/calendario", label: "Calendário Editorial", icon: Calendar },
      { to: "/performance", label: "Performance", icon: BarChart3 },
      { to: "/objecoes", label: "Banco de Objeções", icon: Shield },
    ],
  },
  {
    label: "INTELIGÊNCIA",
    items: [
      { to: "/biblioteca", label: "Biblioteca Visual", icon: ImageIcon },
      { to: "/concorrentes", label: "Radar de Concorrentes", icon: Crosshair },
      { to: "/radar-mercado", label: "Radar de Mercado", icon: MapPin },
      { to: "/radar", label: "Radar de Oportunidade", icon: Radar },
      { to: "/validar", label: "Validar Peça", icon: ShieldCheck },
    ],
  },
  {
    label: "PROSPECÇÃO",
    items: [
      { to: "/prospeccao", label: "CRM · Prospecção", icon: UserCheck },
    ],
  },
];

const FOOTER_ITEMS: NavItem[] = [
  { to: "/custos", label: "Custos IA", icon: DollarSign },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

const STORAGE_KEY = "nl_mkt_sidebar_collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const { data: followupsVencidos } = useQuery({
    queryKey: ["sidebar-followups-vencidos"],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data } = await (supabase as any)
        .from("mkt_prospeccoes")
        .select("id")
        .lt("data_followup", hoje)
        .not("data_followup", "is", null)
        .not("status", "in", "(parceria_ativa,sem_interesse,arquivado)");
      return (data ?? []).length as number;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const sidebarWidth = collapsed ? 64 : 230;

  return (
    <div className="min-h-screen w-full bg-white">
      {/* Sidebar desktop (fixed) */}
      <aside
        className="hidden md:flex md:flex-col fixed inset-y-0 left-0 z-40 bg-[#0F0F0F] text-white border-r border-white/5 transition-all duration-300"
        style={{ width: sidebarWidth }}
      >
        <SidebarInner
          pathname={pathname}
          onNavigate={() => {}}
          collapsed={collapsed}
          badges={{ "/prospeccao": followupsVencidos ?? 0 }}
        />
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className="absolute -right-3 top-20 h-6 w-6 flex items-center justify-center bg-[#8B7355] text-white hover:bg-[#a08560] transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </button>
      </aside>

      {/* Main column */}
      <div
        className="flex flex-col min-w-0 min-h-screen transition-all duration-300 md:ml-[var(--nl-sidebar-w,230px)]"
        style={{ ["--nl-sidebar-w" as never]: `${sidebarWidth}px` }}
      >
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-[color:var(--divisoria)] bg-white px-4 py-3">
          <div>
            <div className="font-serif text-lg text-[color:var(--graphite)] leading-none">NL OS MKT</div>
            <div className="font-mono text-[10px] text-[color:var(--bronze)] mt-0.5 tracking-widest">
              NL ARQUITETOS
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className="p-2 text-[color:var(--graphite)]"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        {/* Mobile drawer */}
        {open && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="w-64 bg-[#0F0F0F] text-white flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
                <div className="font-serif text-lg">NL OS MKT</div>
                <button onClick={() => setOpen(false)} aria-label="Fechar menu" className="p-1">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarInner pathname={pathname} onNavigate={() => setOpen(false)} noHeader collapsed={false} />
            </div>
            <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
          </div>
        )}

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

function SidebarInner({
  pathname,
  onNavigate,
  noHeader,
  collapsed,
  badges,
}: {
  pathname: string;
  onNavigate: () => void;
  noHeader?: boolean;
  collapsed: boolean;
  badges?: Record<string, number>;
}) {
  return (
    <div className="flex flex-1 flex-col">
      {!noHeader && (
        <div className={`flex items-center gap-3 border-b border-white/5 ${collapsed ? "px-3 py-5 justify-center" : "px-5 py-5"}`}>
          <div
            className="flex items-center justify-center bg-[#8B7355] text-white shrink-0"
            style={{ width: 40, height: 40, fontFamily: "Georgia, serif", fontSize: 20 }}
          >
            NL
          </div>
          {!collapsed && (
            <div className="text-white font-bold uppercase tracking-[0.15em] text-sm">
              NL OS MKT
            </div>
          )}
        </div>
      )}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label ?? `g-${gi}`}>
            {gi > 0 && <div className="border-t border-white/5 mx-3 my-2" />}
            {group.label && !collapsed && (
              <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-white/30 px-3 mt-4 mb-1">
                {group.label}
              </div>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onNavigate}
                badge={badges?.[item.to] ?? 0}
              />
            ))}
          </div>
        ))}
      </nav>
      <div className={`border-t border-white/5 ${collapsed ? "px-2 py-4" : "px-2 py-4"}`}>
        <div className="mb-3">
          {FOOTER_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
              badge={0}
              dense
            />
          ))}
        </div>
        <div className={`flex items-center gap-3 px-3 ${collapsed ? "justify-center px-0" : ""}`}>
          <div
            className="flex items-center justify-center border border-[#8B7355]/40 text-[#8B7355] shrink-0"
            style={{ width: 36, height: 36, fontFamily: "Georgia, serif", fontSize: 12, fontWeight: 600 }}
          >
            NL
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-white text-[11px] leading-tight">NL Arquitetos</div>
              <div className="text-[#8B7355]/60 uppercase tracking-widest text-[9px] mt-0.5">MKT</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
  badge,
  dense,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
  badge: number;
  dense?: boolean;
}) {
  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
  const Icon = item.icon;
  const padY = dense ? "py-2" : "py-3";
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={`group relative flex items-center gap-3 border-l-2 transition-colors ${
        collapsed ? `justify-center px-0 ${padY}` : `px-5 ${padY}`
      } ${
        active
          ? "border-[#8B7355] bg-[#8B7355]/15 text-white"
          : "border-transparent text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} />
      {!collapsed && (
        <span className="text-[10px] uppercase tracking-[0.4em] font-bold">{item.label}</span>
      )}
      {badge > 0 && !collapsed && (
        <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">
          {badge}
        </span>
      )}
      {badge > 0 && collapsed && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-600" />
      )}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded bg-[#0F0F0F] border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.3em] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
          {item.label}
        </span>
      )}
    </Link>
  );
}