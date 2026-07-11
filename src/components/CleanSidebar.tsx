import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

const cn = (...classes: unknown[]) =>
  classes.filter((c): c is string => typeof c === 'string' && c.length > 0).join(' ');

export type NavChild = {
  label: string;
  to: string;
};

export type NavEntry =
  | {
      type: 'item';
      label: string;
      to: string;
      icon: LucideIcon;
      badge?: number;
    }
  | {
      type: 'section';
      label: string;
      icon: LucideIcon;
      badge?: number;
      children: NavChild[];
    };

export interface SidebarProps {
  items: NavEntry[];
  currentPath: string;
  onNavigate: (to: string) => void;
  logoText?: string;
  title?: string;
  user?: { name: string; role?: string; initials?: string };
  onLogout?: () => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

interface NavItemProps {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  badge?: number;
  isCollapsed?: boolean;
  onClick?: () => void;
}

const NavItem = ({ label, icon, active, badge, isCollapsed, onClick }: NavItemProps) => {
  const content = (
    <div
      onClick={onClick}
      title={isCollapsed && icon ? label : undefined}
      className={cn(
        'flex flex-col transition-all duration-200 group relative cursor-pointer',
        isCollapsed
          ? icon
            ? 'py-4 px-0 items-center justify-center w-full mb-1 hover:bg-white/10'
            : 'py-[10px] px-4 items-start w-full hover:bg-white/10'
          : 'py-2.5 px-10 border-l-2',
        !isCollapsed && active
          ? 'border-bronze bg-bronze/15 text-white'
          : 'border-transparent text-white/70',
        isCollapsed && icon && active && 'text-bronze',
        !icon && active && 'text-bronze',
        'hover:bg-white/10',
      )}
    >
      <div
        className={cn(
          'flex items-center',
          isCollapsed && icon ? 'justify-center' : 'justify-between w-full gap-3',
        )}
      >
        <div className={cn('flex items-center', !isCollapsed || !icon ? 'w-full gap-3' : '')}>
          {icon && (
            <div
              className={cn(
                'transition-colors flex-shrink-0',
                active ? 'text-bronze' : 'text-white/60 group-hover:text-white/80',
              )}
            >
              {icon}
            </div>
          )}
          <span
            className={cn(
              'transition-colors whitespace-nowrap',
              isCollapsed && icon
                ? 'hidden'
                : 'text-[10px] tracking-[0.05em] font-medium uppercase opacity-90',
              active && !isCollapsed ? 'text-white' : 'group-hover:text-white/70',
            )}
          >
            {label}
          </span>
        </div>
        {!isCollapsed && badge !== undefined && badge > 0 && (
          <span className="bg-bronze text-[#0F0F0F] text-[8px] font-bold px-1.5 py-0.5 rounded-[1px] min-w-[14px] text-center shrink-0">
            {badge}
          </span>
        )}
      </div>
    </div>
  );

  return content;
};

interface SectionAccordionProps {
  label: string;
  icon: React.ReactNode;
  badge?: number;
  isOpen: boolean;
  isCollapsed?: boolean;
  isPopoverOpen?: boolean;
  onToggle: () => void;
  onPopoverToggle?: (label: string, top: number) => void;
  children: React.ReactNode;
}

const SectionAccordion = ({
  label,
  icon,
  badge,
  isOpen,
  isCollapsed,
  isPopoverOpen,
  onToggle,
  onPopoverToggle,
  children,
}: SectionAccordionProps) => {
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    if (!isCollapsed) {
      onToggle();
    } else {
      e.stopPropagation();
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        onPopoverToggle?.(label, rect.top);
      }
    }
  };

  return (
    <div className="mb-1 relative">
      <button
        ref={buttonRef}
        onClick={handleClick}
        title={isCollapsed ? label : undefined}
        className={cn(
          'w-full flex items-center transition-colors duration-200 group',
          isCollapsed ? 'justify-center py-4 px-0' : 'justify-between px-6 py-3',
          isOpen && !isCollapsed
            ? 'bg-white/10 text-white'
            : 'text-white/70 hover:text-white/90 hover:bg-white/[0.05]',
          isPopoverOpen && isCollapsed && 'bg-white/10',
        )}
      >
        <div className={cn('flex items-center', isCollapsed ? '' : 'gap-3')}>
          <div
            className={cn(
              'transition-colors',
              (isOpen && !isCollapsed) || (isPopoverOpen && isCollapsed)
                ? 'text-bronze'
                : 'text-white/60 group-hover:text-white/80',
            )}
          >
            {icon}
          </div>
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.4em] font-bold">{label}</span>
              {badge !== undefined && badge > 0 && (
                <span className="bg-bronze text-[#0F0F0F] text-[8px] font-bold px-1.5 py-0.5 rounded-[1px] min-w-[14px] text-center">
                  {badge}
                </span>
              )}
            </div>
          )}
        </div>
        {!isCollapsed && (
          <ChevronDown
            size={10}
            className={cn('transition-transform duration-300', isOpen && 'rotate-180')}
          />
        )}
      </button>

      {!isCollapsed && (
        <div
          className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          <div className="py-1">{children}</div>
        </div>
      )}

      {isCollapsed && isPopoverOpen && (
        <div
          className="fixed left-[64px] bg-[#1a1a1a] border border-white/10 p-0 overflow-hidden w-48 rounded-[6px] z-[9999]"
          style={{ top: buttonRef.current?.getBoundingClientRect().top || 100 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col py-1">{children}</div>
        </div>
      )}
    </div>
  );
};

const Sidebar = ({
  items,
  currentPath,
  onNavigate,
  logoText = 'NL',
  title = 'NL OS',
  user,
  onLogout,
  onCollapsedChange,
}: SidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return sessionStorage.getItem('sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = sessionStorage.getItem('sidebar_sections');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [popoverAberto, setPopoverAberto] = useState<string | null>(null);

  React.useEffect(() => {
    onCollapsedChange?.(isCollapsed);
    try {
      sessionStorage.setItem('sidebar_collapsed', isCollapsed ? '1' : '0');
    } catch {}
  }, [isCollapsed, onCollapsedChange]);

  React.useEffect(() => {
    setPopoverAberto(null);
  }, [currentPath]);

  React.useEffect(() => {
    const handler = () => setPopoverAberto(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const toggleSection = (section: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [section]: !prev[section] };
      sessionStorage.setItem('sidebar_sections', JSON.stringify(next));
      return next;
    });
  };

  const isChildActive = (children: NavChild[]) =>
    children.some((c) => currentPath === c.to || currentPath.startsWith(c.to + '/'));

  return (
    <div
      className={cn(
        'h-screen bg-[#0F0F0F] border-r border-white/5 flex flex-col fixed left-0 top-0 z-50 transition-all duration-300',
        isCollapsed ? 'w-[64px]' : 'w-[230px]',
      )}
    >
      <div className={cn('transition-all duration-300', isCollapsed ? 'p-3 mb-4' : 'p-8 mb-6')}>
        <div className={cn('flex items-center relative', isCollapsed ? 'justify-center' : 'justify-between')}>
          <div className={cn('flex items-center', isCollapsed ? 'justify-center' : 'gap-3')}>
            <div className="w-10 h-10 bg-bronze flex items-center justify-center text-white font-cormorant text-xl shadow-[0_4px_20px_rgba(139,115,85,0.3)] shrink-0">
              {logoText}
            </div>
            {!isCollapsed && (
              <span className="text-base font-bold text-white tracking-[0.15em] uppercase leading-none">
                {title}
              </span>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed((v) => !v)}
            className={cn(
              'absolute w-6 h-6 bg-bronze text-white flex items-center justify-center border border-white/10 shadow-lg hover:scale-110 transition-all z-[60] cursor-pointer',
              isCollapsed ? 'left-1/2 -translate-x-1/2 top-14' : '-right-11 top-2',
            )}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8 scrollbar-none">
        {items.map((entry) => {
          if (entry.type === 'item') {
            const Icon = entry.icon;
            return (
              <NavItem
                key={entry.label}
                label={entry.label}
                icon={<Icon size={14} />}
                badge={entry.badge}
                active={currentPath === entry.to || currentPath.startsWith(entry.to + '/')}
                isCollapsed={isCollapsed}
                onClick={() => onNavigate(entry.to)}
              />
            );
          }

          const Icon = entry.icon;
          return (
            <SectionAccordion
              key={entry.label}
              label={entry.label}
              icon={<Icon size={14} />}
              badge={entry.badge}
              isOpen={!!openSections[entry.label] || isChildActive(entry.children)}
              isCollapsed={isCollapsed}
              isPopoverOpen={popoverAberto === entry.label}
              onToggle={() => toggleSection(entry.label)}
              onPopoverToggle={(label) => setPopoverAberto((prev) => (prev === label ? null : label))}
            >
              {entry.children.map((child) => (
                <NavItem
                  key={child.to}
                  label={child.label}
                  active={currentPath === child.to || currentPath.startsWith(child.to + '/')}
                  isCollapsed={isCollapsed}
                  onClick={() => onNavigate(child.to)}
                />
              ))}
            </SectionAccordion>
          );
        })}
      </div>

      {user && (
        <div
          className={cn(
            'border-t border-white/5 bg-white/[0.02] mt-auto relative',
            isCollapsed ? 'p-3' : 'p-6',
          )}
        >
          <div className={cn('flex items-center', isCollapsed ? 'justify-center' : 'gap-3')}>
            <div className="w-9 h-9 border border-bronze/40 flex items-center justify-center text-bronze text-[11px] font-bold bg-bronze/5 uppercase shrink-0">
              {user.initials ?? user.name.slice(0, 2).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white font-medium truncate capitalize">{user.name}</p>
                {user.role && (
                  <p className="text-[9px] text-bronze/60 uppercase tracking-widest font-bold">
                    {user.role}
                  </p>
                )}
              </div>
            )}
            {!isCollapsed && onLogout && (
              <button
                onClick={onLogout}
                className="text-white/20 hover:text-white transition-colors p-1"
                aria-label="Sair"
              >
                <LogOut size={12} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;