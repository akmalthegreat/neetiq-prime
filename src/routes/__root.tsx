import { DrAkzaLoader } from "@/components/dr-akza-loader";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { Toaster } from "@/components/ui/sonner";
import { OnboardingTour } from "@/components/onboarding-tour";
import { SupportWidget } from "@/components/support-widget";
import { AppVersionGate } from "@/components/app-version-gate";
import { getPublicSupabaseConfig } from "@/integrations/supabase/config";

const THEME_INIT = `(function(){try{var t=localStorage.getItem('neetiq-theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant transition-opacity hover:opacity-95"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        {error && (
          <details className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">Error details</summary>
            <pre className="mt-2 whitespace-pre-wrap overflow-auto max-h-40 font-mono text-[11px]">{error instanceof Error ? (error.stack || error.message) : String(error)}</pre>
          </details>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-95"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "NEET Track" },
      { name: "description", content: "NEET Track brings together NEET practice questions, CBT exams, NCERT study tools, and progress tracking." },
      { name: "author", content: "SΛNSKΛƦ" },
      { name: "theme-color", content: "#1d4ed8" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "NEET Track" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:title", content: "NEET Track" },
      { property: "og:description", content: "NEET practice questions, CBT exams, NCERT study tools, and progress tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "NEET Track" },
      { name: "twitter:description", content: "NEET practice questions, CBT exams, NCERT study tools, and progress tracking." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: "https://neettrack.com/" },
      { rel: "manifest", href: "/manifest.webmanifest?v=2" },
      { rel: "icon", href: "/favicon.ico?v=2", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png?v=2" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png?v=2" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon.png?v=2" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  pendingComponent: () => <DrAkzaLoader message="Dr. Azka is preparing the page..." fullScreen />,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  const supabaseConfig = getPublicSupabaseConfig();
  const supabaseConfigInit = `globalThis.__MY_SUPABASE_CONFIG__=${JSON.stringify(supabaseConfig)};`;

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": "https://neettrack.com/#website",
                  "url": "https://neettrack.com/",
                  "name": "NEET Track",
                  "alternateName": ["NeetTrack", "NEETTrack"],
                  "description": "NEET preparation platform for CBT practice, mock tests, PYQs, NCERT study tools, flashcards, short notes, and progress tracking."
                },
                {
                  "@type": "Organization",
                  "@id": "https://neettrack.com/#organization",
                  "name": "NEET Track",
                  "alternateName": ["NeetTrack", "NEETTrack"],
                  "url": "https://neettrack.com/",
                  "logo": "https://neettrack.com/logo.jpg"
                }
              ]
            })
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: supabaseConfigInit }} />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
                      <Outlet />
            <Toaster richColors position="top-center" />
            <OnboardingTour />
            <SupportWidget />
            <AppVersionGate />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
