import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function Eyebrow({ left, right }: { left: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-5 eyebrow">
      <span>{left}</span>
      {right ? <span>{right}</span> : null}
    </div>
  );
}

export function FieldShell({
  eyebrowRight,
  back,
  children,
}: {
  eyebrowRight?: ReactNode;
  back?: { to: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-24 sm:px-7">
      <Eyebrow left="Tax Compliance Pro · Field Hub" right={eyebrowRight} />
      {back ? (
        <Link
          to={back.to}
          className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← {back.label}
        </Link>
      ) : null}
      {children}
    </div>
  );
}

export function PageTitle({
  title,
  accent,
  lede,
}: {
  title: string;
  accent?: string;
  lede?: string;
}) {
  return (
    <div className="mt-6">
      <h1 className="font-display text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
        {title}{" "}
        {accent ? (
          <span className="bg-gradient-to-r from-signal to-go bg-clip-text text-transparent">
            {accent}
          </span>
        ) : null}
      </h1>
      {lede ? <p className="mt-2 max-w-prose text-sm text-muted-foreground">{lede}</p> : null}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mt-8 mb-3 eyebrow">{children}</div>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-panel p-4 ${className}`}>{children}</div>
  );
}
