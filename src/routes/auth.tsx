import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, AlertTriangle } from "lucide-react";
import { generateLicensePayment } from "@/lib/license.functions";
import type { LicenseStatus } from "@/lib/license.functions";
import { getPublicBranding } from "@/lib/branding.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Administração" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockedLicense, setBlockedLicense] = useState<LicenseStatus | null>(null);
  const { data: branding } = useQuery({ queryKey: ["public-branding"], queryFn: () => getPublicBranding() });

  useEffect(() => {
    if (!loading && user) {
      if (user.mustChangePassword) navigate({ to: "/trocar-senha", replace: true });
      else navigate({ to: "/", replace: true });
    }
  }, [user, loading, navigate]);

  if (blockedLicense) {
    return <LicenseBlockedScreen license={blockedLicense} onVoltar={() => setBlockedLicense(null)} />;
  }

  return (
    <div
      className="min-h-screen grid place-items-center p-6 bg-background bg-[length:100%_100%] bg-center bg-no-repeat relative before:absolute before:inset-0 before:bg-black/40"
      style={{ backgroundImage: branding?.login_bg_url ? `url(${branding.login_bg_url})` : "url('/bg-login.jpg')" }}
    >
      <Card className="w-full max-w-sm relative z-10 border-white/20 bg-background/70 backdrop-blur-xl shadow-2xl">
        <CardHeader className="items-center text-center gap-1 pb-2">
          {!!branding?.logo_url && <img src={branding.logo_url} alt="Logo" className="max-h-16 w-auto max-w-[75%] mb-2 object-contain drop-shadow-md" />}
          {!branding?.logo_url && <CardTitle className="text-2xl font-bold tracking-tight">Bem-vindo</CardTitle>}
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const result = await signIn(username.trim(), password);
                if (result.blocked) setBlockedLicense(result.license);
              } catch (err: any) {
                toast.error(err?.message ?? "Falha no login");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="u" className="text-foreground/80">Usuário</Label>
              <Input id="u" className="bg-background/50 focus:bg-background transition-colors" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p" className="text-foreground/80">Senha</Label>
              <Input id="p" className="bg-background/50 focus:bg-background transition-colors" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            <Button type="submit" size="lg" className="w-full font-semibold mt-2 shadow-lg hover:shadow-xl transition-all" disabled={busy} style={branding?.cor_primaria ? { backgroundColor: branding.cor_primaria, color: '#fff' } : undefined}>
              {busy ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function LicenseBlockedScreen({ license, onVoltar }: { license: LicenseStatus; onVoltar: () => void }) {
  const [meses, setMeses] = useState(1);
  const [gerado, setGerado] = useState<{ qrDataUrl: string; payload: string; valor: number } | null>(null);

  const gerarMut = useMutation({
    mutationFn: () => generateLicensePayment({ data: { meses } }),
    onSuccess: (r) => setGerado(r),
    onError: (e: any) => toast.error(e.message),
  });

  function fmtBRL(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center gap-2">
          <div className="size-12 rounded-full bg-red-100 dark:bg-red-950 grid place-items-center">
            <AlertTriangle className="size-6 text-red-600" />
          </div>
          <CardTitle>Assinatura vencida</CardTitle>
          <CardDescription>
            O acesso está temporariamente bloqueado — a licença venceu em {license.vencimento}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!gerado ? (
            <>
              <div>
                <Label className="text-xs">Renovar por quantos meses?</Label>
                <Input type="number" min={1} max={12} value={meses} onChange={(e) => setMeses(Number(e.target.value))} />
              </div>
              <Button className="w-full" onClick={() => gerarMut.mutate()} disabled={gerarMut.isPending}>
                {gerarMut.isPending ? "Gerando..." : "Gerar PIX pra pagar"}
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <img src={gerado.qrDataUrl} alt="QR Code PIX" className="size-52" />
              <p className="text-sm font-medium">{fmtBRL(gerado.valor)}</p>
              <Button
                variant="outline" size="sm"
                onClick={() => { navigator.clipboard.writeText(gerado.payload); toast.success("Código copiado"); }}
              >
                <Copy className="size-4 mr-2" /> Copiar código Copia e Cola
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Depois de pagar, avise o suporte pra confirmar e liberar o acesso — assim que
                confirmado, é só entrar de novo com seu usuário e senha normalmente.
              </p>
            </div>
          )}
          <Button variant="ghost" size="sm" className="w-full" onClick={onVoltar}>Voltar</Button>
        </CardContent>
      </Card>
    </div>
  );
}
