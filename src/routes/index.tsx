import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth", replace: true }); return; }
    if (user.mustChangePassword) navigate({ to: "/trocar-senha", replace: true });
    else navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  return <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">Carregando...</div>;
}
