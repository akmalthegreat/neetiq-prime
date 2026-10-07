import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload a destination when the user intends to open it.
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    // Keep 0 because route data is coordinated with TanStack Query.
    defaultPreloadStaleTime: 0,
  });

  return router;
};
