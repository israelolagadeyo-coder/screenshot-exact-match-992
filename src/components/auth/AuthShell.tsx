import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-4 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" aria-label="BizIntel AI home">
            <Logo />
          </Link>
          <h1 className="mt-10 text-2xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6 text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
      <div className="gradient-ink hidden flex-col justify-end p-12 lg:flex">
        <blockquote className="max-w-md">
          <p className="font-display text-2xl font-semibold leading-snug text-ink-foreground">
            “The analytics engine calculates the facts. The AI explains them.”
          </p>
          <footer className="mt-4 text-sm text-ink-muted">
            BizIntel AI — business intelligence you can trust.
          </footer>
        </blockquote>
      </div>
    </div>
  );
}
