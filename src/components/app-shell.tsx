import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
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
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/copy", label: "Motor de Copy IA", icon: Sparkles },
  { to: "/calendario", label: "Calendário Editorial", icon: Calendar },
  { to: "/objecoes", label: "Banco de Objeções", icon: Shield },
  { to: "/performance", label: "Performance", icon: BarChart3 },
  { to: "/marca", label: "Biblioteca de Marca", icon: BookOpen },
  { to: "/radar", label: "Radar de Oportunidade", icon: Radar },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <SidebarInner pathname={pathname} onNavigate={() => {}} />
      </aside>

      {/* Header mobile */}
      <div className="flex-1 flex flex-col min-w-0">
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
            <div className="w-64 bg-sidebar text-sidebar-foreground flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
                <div className="font-serif text-lg">NL OS MKT</div>
                <button onClick={() => setOpen(false)} aria-label="Fechar menu" className="p-1">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarInner pathname={pathname} onNavigate={() => setOpen(false)} noHeader />
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
}: {
  pathname: string;
  onNavigate: () => void;
  noHeader?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col">
      {!noHeader && (
        <div className="px-6 py-6 border-b border-sidebar-border">
          <div className="font-serif text-xl leading-none">NL OS MKT</div>
          <div className="font-mono text-[10px] mt-2 tracking-widest text-[color:var(--travertino)]">
            NL ARQUITETOS
          </div>
        </div>
      )}
      <nav className="flex-1 py-4">
        {NAV.map((item) => {
          const active =
            item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-6 py-3 text-sm border-l-2 transition-colors ${
                active
                  ? "border-[color:var(--bronze)] bg-sidebar-accent text-white"
                  : "border-transparent text-white/80 hover:bg-sidebar-accent hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t border-sidebar-border">
        <div className="font-mono text-[10px] tracking-widest text-[color:var(--travertino)]">
          A ARQUITETURA COMO DECISÃO
        </div>
      </div>
    </div>
  );
}