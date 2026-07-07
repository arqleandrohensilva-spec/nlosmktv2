import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-[color:var(--divisoria)] px-4 py-6 md:px-10 md:py-10 bg-white">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          {eyebrow && (
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
              {eyebrow}
            </div>
          )}
          <h1 className="font-serif text-2xl md:text-3xl text-[color:var(--graphite)] leading-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)] max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}