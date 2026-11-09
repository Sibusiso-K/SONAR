import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { transitionType } from "./lib/page-transition";

export const getRouter = () => {
  // The Supabase client already retries network failures with backoff, so
  // retrying again here multiplied the wait: a database outage showed a
  // loading state for over 30 seconds before the error panel appeared.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, retryDelay: 1_000 } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Animate section changes with the View Transitions API (a no-op in
    // browsers without it; styles.css provides a CSS fallback). The type
    // tells the CSS which way to slide. Same-path updates such as a search
    // param change are not animated.
    defaultViewTransition: {
      types: ({ fromLocation, toLocation, pathChanged }) =>
        pathChanged ? [transitionType(fromLocation?.pathname, toLocation.pathname)] : false,
    },
  });

  return router;
};
