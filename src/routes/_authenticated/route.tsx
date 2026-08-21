import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
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

  return <Outlet />;
}
