import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const initialHref = useRef(href);
  const redirected = useRef(false);

  useEffect(() => {
    if (!loading && !session && !redirected.current) {
      redirected.current = true;
      navigate({ to: "/auth", search: { next: initialHref.current }, replace: true });
    }
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="eyebrow animate-pulse">Checking booth credentials…</div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center border-b border-border bg-background/95 px-4 backdrop-blur md:px-5">
          <SidebarTrigger aria-label="Toggle navigation" />
          <div className="ml-3 eyebrow md:hidden">Field Hub · Member CRM</div>
        </header>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
