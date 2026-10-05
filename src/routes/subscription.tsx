import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/subscription")({
  head: () => ({ meta: [
    { title: "Subscription Plans — NEET Track" },
    { name: "description", content: "Explore NEET Track batch subscriptions and study access." },
    { property: "og:title", content: "Subscription Plans — NEET Track" },
    { property: "og:description", content: "Explore NEET Track batch subscriptions and study access." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  beforeLoad: () => { throw redirect({ to: "/premium" }); },
});
