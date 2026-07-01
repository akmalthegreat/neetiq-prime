import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bonus")({
  beforeLoad: () => {
    throw redirect({ to: "/premium" });
  },
});
