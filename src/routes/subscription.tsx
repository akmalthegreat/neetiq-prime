import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/subscription")({
  head: () => ({ meta: [
    { title: "Subscription Plans — NEETIQ Prime" },
    { name: "description", content: "Explore NEETIQ Prime batch subscriptions and study access." },
    { property: "og:title", content: "Subscription Plans — NEETIQ Prime" },
    { property: "og:description", content: "Explore NEETIQ Prime batch subscriptions and study access." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  beforeLoad: () => { throw redirect({ to: "/premium" }); },
});
