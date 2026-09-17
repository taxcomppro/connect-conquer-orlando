import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useInbound } from "@/hooks/useInbound";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const initialHref = useRef(href);
  const redirected = useRef(false);
  const [displayName, setDisplayName] = useState("");
  const { unread } = useInbound({ notify: true });

  useEffect(() => {
    if (!loading && !session && !redirected.current) {
      redirected.current = true;
      navigate({ to: "/auth", search: { next: initialHref.current }, replace: true });
    }
  }, [loading, session, navigate]);

  useEffect(() => {
    let active = true;
    const userId = session?.user.id;
    if (!userId) {
      setDisplayName("");
      return;
    }

    void supabase
      .from("staff_profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setDisplayName(data?.display_name?.trim() ?? "");
      });

    return () => {
      active = false;
    };
  }, [session?.user.id]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="eyebrow animate-pulse">Checking booth credentials…</div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar unreadInbox={unread} />
      <SidebarInset className="basis-0 min-w-0 max-w-full flex-1 overflow-x-hidden">
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center border-b border-border bg-background/95 px-4 backdrop-blur md:px-5">
          <SidebarTrigger aria-label="Toggle navigation" />
          <div className="ml-3 eyebrow md:hidden">Membership Hub</div>
          <div className="ml-auto max-w-[45%] truncate text-right text-sm font-medium">
            {displayName || session.user.email || "Signed in"}
          </div>
        </header>
        <div className="min-w-0 max-w-full flex-1 overflow-x-hidden">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
