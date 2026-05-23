import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PanelProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, children, className }: PanelProps) {
  return (
    <section className={cn("flex flex-col min-h-0", className)}>
      <header className="shrink-0 border-b border-slate-800 px-3 py-2 text-sm font-medium text-slate-400">
        {title}
      </header>
      <div className="flex-1 min-h-0 overflow-auto p-3">{children}</div>
    </section>
  );
}
