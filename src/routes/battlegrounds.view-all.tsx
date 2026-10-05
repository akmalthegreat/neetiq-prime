import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/battlegrounds/view-all")({
  head: () => ({ meta: [
    { title: "All Quiz Battles — NEETIQ Prime" },
    { name: "description", content: "View your NEETIQ Prime quiz battle history and results." },
    { property: "og:title", content: "All Quiz Battles — NEETIQ Prime" },
    { property: "og:description", content: "View your NEETIQ Prime quiz battle history and results." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/battlegrounds/history" });
  },
});
