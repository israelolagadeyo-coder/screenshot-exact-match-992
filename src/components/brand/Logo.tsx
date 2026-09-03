import { cn } from "@/lib/utils";

export function Logo({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "inverted";
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display", className)}>
      <span
        aria-hidden
        className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M4 19V11M10 19V5M16 19v-6M22 19H2" strokeLinecap="round" />
        </svg>
      </span>
      <span
        className={cn(
          "text-lg font-bold tracking-tight",
          variant === "inverted" ? "text-ink-foreground" : "text-foreground",
        )}
      >
        BizIntel <span className="text-primary">AI</span>
      </span>
    </span>
  );
}
