import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface Props {
  subject: "biology" | "physics" | "chemistry";
  title: string;
  tag: string;
  blurb: string;
  children: ReactNode;
  notes?: ReactNode;
}

export function TopicShell({ subject, title, tag, blurb, children, notes }: Props) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        to={`/${subject}` as "/biology"}
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-deep hover:underline"
      >
        ← Back to {subject}
      </Link>
      <div className="mt-4 mb-6">
        <div className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-deep">{tag}</div>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{blurb}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-soft">{children}</div>
        {notes && (
          <aside className="rounded-2xl border border-border bg-white p-5 shadow-soft">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-brand">Key points</h3>
            <div className="prose prose-sm text-ink/80">{notes}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
