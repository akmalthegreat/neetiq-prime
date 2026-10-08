import type { ReactNode } from "react";

interface Props {
  subject: "biology" | "physics" | "chemistry";
  title: string;
  tag: string;
  blurb: string;
  children: ReactNode;
  notes?: ReactNode;
  onBack?: () => void;
}

const ACCENT = { biology: "#A855F7", physics: "#3B82F6", chemistry: "#10B981" } as const;

export function TopicShell({ subject, title, tag, blurb, children, notes, onBack }: Props) {
  return (
    <div className="mx-auto max-w-6xl px-1 py-4">
      {onBack && (
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          ← Back to {subject}
        </button>
      )}
      <div className="mt-3 mb-5">
        <div className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: ACCENT[subject], background: `${ACCENT[subject]}1f` }}>{tag}</div>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{blurb}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-3xl border bg-card shadow-[0_30px_60px_-36px_rgba(15,23,42,.6)]" style={{ boxShadow: `0 30px 60px -36px ${ACCENT[subject]}` }}>{children}</div>
        {notes && (
          <aside className="relative overflow-hidden rounded-3xl border bg-card p-5">
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: ACCENT[subject] }} />
            <h3 className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em]" style={{ color: ACCENT[subject] }}>NEET key points</h3>
            <div className="prose prose-sm dark:prose-invert">{notes}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
