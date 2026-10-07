import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved into the Improvement Zone.
export const Route = createFileRoute("/bookmarks")({
  beforeLoad: () => {
    throw redirect({ to: "/improve", search: { tab: "saved" } as never, replace: true });
  },
});
