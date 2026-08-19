import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { changePassword } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/trocar-senha")({
  head: () => ({ meta: [{ title: "Trocar senha" }] }),
  component: Page,
});

function Page() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [cur, setCur] = useState("");
  const [n1, setN1] = useState("");
  const [n2, setN2] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center gap-2">
          <img src="/branding/symbol.png" alt="" aria-hidden className="size-10 mb-1" />
          <CardTitle>Trocar senha</CardTitle>
          <CardDescription>
            {user?.mustChangePassword ? "Defina uma senha nova para continuar." : "Atualize sua senha."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (n1.length < 6) return toast.error("A nova senha deve ter no mínimo 6 caracteres");
              if (n1 !== n2) return toast.error("As senhas não conferem");
              setBusy(true);
              try {
                await changePassword({ data: { currentPassword: cur, newPassword: n1 } });
                await refresh();
                toast.success("Senha atualizada");
                nav({ to: "/dashboard", replace: true });
              } catch (err: any) {
                toast.error(err?.message ?? "Falha ao trocar senha");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div><Label>Senha atual</Label><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} required /></div>
            <div><Label>Nova senha</Label><Input type="password" value={n1} onChange={(e) => setN1(e.target.value)} required /></div>
            <div><Label>Confirmar</Label><Input type="password" value={n2} onChange={(e) => setN2(e.target.value)} required /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
