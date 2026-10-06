import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/battlegrounds/view-all")({
  head: () => ({ meta: [
    { title: "All Quiz Battles — NEET Track" },
    { name: "description", content: "View your NEET Track quiz battle history and results." },
    { property: "og:title", content: "All Quiz Battles — NEET Track" },
    { property: "og:description", content: "View your NEET Track quiz battle history and results." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/battlegrounds/history" });
  },
});
