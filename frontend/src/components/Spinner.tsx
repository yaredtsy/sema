import { cn } from "@/lib/cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400",
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
