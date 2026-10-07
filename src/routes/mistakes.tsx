import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved into the Improvement Zone.
export const Route = createFileRoute("/mistakes")({
  beforeLoad: () => {
    throw redirect({ to: "/improve", search: { tab: "mistakes" } as never, replace: true });
  },
});
