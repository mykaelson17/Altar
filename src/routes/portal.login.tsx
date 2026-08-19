import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, LogIn } from "lucide-react";

export const Route = createFileRoute("/portal/login")({
  head: () => ({ meta: [{ title: "Login - Portal do Inscrito" }] }),
  component: PortalLogin,
});

function PortalLogin() {
  const navigate = useNavigate();
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!cpf.trim() || !dataNascimento.trim()) return;

    setLoading(true);
    try {
      // Clean CPF to numbers only for storage
      const cleanCpf = cpf.replace(/\D/g, "");
      
      // Save credentials locally
      localStorage.setItem("portal_cpf", cleanCpf);
      localStorage.setItem("portal_dn", dataNascimento);
      
      // Navigate to portal
      navigate({ to: "/portal" });
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <User className="size-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Portal do Inscrito</CardTitle>
          <CardDescription>
            Acompanhe suas inscrições, pagamentos e recebimento de uniformes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">Seu CPF</Label>
              <Input 
                id="cpf" 
                value={cpf} 
                onChange={(e) => setCpf(e.target.value)} 
                placeholder="000.000.000-00" 
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dn">Data de Nascimento</Label>
              <Input 
                id="dn" 
                type="date" 
                value={dataNascimento} 
                onChange={(e) => setDataNascimento(e.target.value)} 
              />
            </div>
            <Button type="submit" className="w-full" disabled={!cpf || !dataNascimento || loading}>
              {loading ? "Entrando..." : (
                <>
                  <LogIn className="size-4 mr-2" /> Acessar Portal
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
