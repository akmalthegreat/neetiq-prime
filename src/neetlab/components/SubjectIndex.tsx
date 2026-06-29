import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { Topic } from "../data/topics";

interface Props {
  subject: "biology" | "physics" | "chemistry";
  title: string;
  desc: string;
  topics: Topic[];
}

export function SubjectIndex({ subject, title, desc, topics }: Props) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-10">
        <div className="text-xs font-semibold uppercase tracking-wider text-brand">{subject}</div>
        <h1 className="mt-2 text-4xl font-bold text-ink sm:text-5xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{desc}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((t, i) => (
          <motion.div
            key={t.slug}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <Link
              to={`/${subject}/$topic` as "/biology/$topic"}
              params={{ topic: t.slug }}
              className="group block h-full rounded-2xl border border-border bg-white p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-glow"
            >
              <div className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-deep">{t.tag}</div>
              <h3 className="mt-3 text-xl font-bold text-ink">{t.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t.blurb}</p>
              <div className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-deep">
                Open <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
