import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, Calendar, MapPin, Info, ArrowRight } from "lucide-react";
import { getPublicEvent } from "@/lib/events.functions";
import { createPublicRegistration } from "@/lib/registrations.functions";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/inscricao/$eventId")({
  head: () => ({ meta: [{ title: "Inscrição de Evento" }] }),
  component: PublicRegistrationPage,
});

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PublicRegistrationPage() {
  const { eventId } = Route.useParams();
  
  const { data, isLoading, isError, error } = useQuery({ 
    queryKey: ["public-event", eventId], 
    queryFn: () => getPublicEvent({ data: { id: eventId } }),
    retry: false
  });

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [congregacao, setCongregacao] = useState("");
  const [novaCongregacao, setNovaCongregacao] = useState("");
  const [sexo, setSexo] = useState<"M" | "F" | "">("");
  const [uniformId, setUniformId] = useState<string>("__none");
  const [tamanho, setTamanho] = useState<string>("__none");
  const [possuiRoupaPropria, setPossuiRoupaPropria] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const createMut = useMutation({
    mutationFn: () => createPublicRegistration({
      data: {
        event_id: eventId,
        nome,
        cpf: cpf.replace(/\D/g, "") || undefined,
        email: email || undefined,
        data_nascimento: dataNascimento || undefined,
        telefone: telefone || undefined,
        congregacao: congregacao === "__outra" ? novaCongregacao : congregacao,
        sexo: sexo || undefined,
        uniform_id: uniformId === "__none" ? null : uniformId,
        tamanho_roupa: tamanho === "__none" ? undefined : (tamanho as any),
        possui_roupa_propria: possuiRoupaPropria,
      },
    }),
    onSuccess: () => {
      setIsSuccess(true);
      window.scrollTo(0, 0);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando informações do evento...</div>;
  
  if (isError || !data) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{(error as any)?.message || "Evento não encontrado ou inscrições encerradas."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { event, uniforms, congregations } = data;

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center py-8">
          <CardContent className="space-y-4 flex flex-col items-center">
            <CheckCircle2 className="size-16 text-green-500" />
            <h2 className="text-2xl font-semibold">Inscrição Confirmada!</h2>
            <p className="text-muted-foreground">Sua inscrição no evento <strong>{event.nome}</strong> foi realizada com sucesso.</p>
            {event.valor_inscricao > 0 && (
               <div className="bg-muted p-4 rounded-md text-sm mt-4 text-left w-full border border-border">
                 <p className="font-medium mb-1">Pagamento e Acompanhamento</p>
                 <p>Para gerar o PIX da sua inscrição, ou acompanhar o status do seu uniforme, acesse o Portal do Inscrito informando seu CPF e Data de Nascimento.</p>
               </div>
            )}
            <div className="w-full pt-4">
              <Link to="/portal/login">
                <Button className="w-full" size="lg">
                  Acessar Portal do Inscrito <ArrowRight className="ml-2 size-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedUniform = uniforms.find((u: any) => u.id === uniformId);
  const uniformValor = possuiRoupaPropria ? 0 : (selectedUniform?.valor || 0);
  const valorTotal = event.valor_inscricao + uniformValor;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {event.arte_url && (
          <img src={event.arte_url} alt="Arte do evento" className="w-full rounded-xl shadow-sm object-cover max-h-64" />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{event.nome}</CardTitle>
            <CardDescription className="flex flex-col gap-1 mt-2 text-base">
              <span className="flex items-center gap-2"><Calendar className="size-4" /> {event.data_inicio} até {event.data_fim}</span>
              {event.local && <span className="flex items-center gap-2"><MapPin className="size-4" /> {event.local}</span>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {event.observacoes && (
              <div className="bg-primary/5 text-primary p-3 rounded-md text-sm whitespace-pre-wrap">
                {event.observacoes}
              </div>
            )}

            <div className="grid gap-2 text-sm border-t pt-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor da Inscrição:</span>
                <span className="font-medium">{event.valor_inscricao > 0 ? fmtBRL(event.valor_inscricao) : "Gratuito"}</span>
              </div>
              {uniforms.length > 0 && (
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Uniforme disponível:</span>
                  <span className="text-xs">Sim, escolha abaixo</span>
                </div>
              )}
            </div>

            {(event.regulamento_url || event.programacao_url) && (
               <div className="flex flex-wrap gap-2 pt-2 border-t">
                 {event.regulamento_url && (
                   <a href={event.regulamento_url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                     <Info className="size-3.5" /> Ver Regulamento
                   </a>
                 )}
                 {event.programacao_url && (
                   <a href={event.programacao_url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                     <Info className="size-3.5" /> Ver Programação
                   </a>
                 )}
               </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Formulário de Inscrição</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {event.regras_inscricao && (
              <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 p-4 rounded-lg space-y-3 mb-6">
                <h3 className="font-medium text-amber-800 dark:text-amber-300">Termos e Regras do Evento</h3>
                <div className="text-sm text-amber-900/80 dark:text-amber-200/80 whitespace-pre-wrap max-h-40 overflow-y-auto pr-2">
                  {event.regras_inscricao}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-amber-200/50 dark:border-amber-900/50">
                  <Checkbox 
                    id="aceitouTermos" 
                    checked={aceitouTermos} 
                    onCheckedChange={(v) => setAceitouTermos(!!v)} 
                    className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                  />
                  <Label htmlFor="aceitouTermos" className="font-medium text-amber-800 dark:text-amber-300 cursor-pointer">
                    Li e concordo com os termos e regras
                  </Label>
                </div>
              </div>
            )}

            <div className={event.regras_inscricao && !aceitouTermos ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity space-y-4"}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Nome Completo *</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Digite seu nome completo" />
                </div>
                
                <div className="space-y-2">
                  <Label>CPF *</Label>
                  <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
                </div>
                
                <div className="space-y-2">
                  <Label>Data de Nascimento *</Label>
                  <Input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>E-mail (opcional)</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
                </div>

                <div className="space-y-2">
                  <Label>Telefone / WhatsApp *</Label>
                  <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
                </div>
              
              <div className="space-y-2">
                <Label>Sexo</Label>
                <Select value={sexo} onValueChange={(v: "M" | "F") => setSexo(v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Feminino</SelectItem></SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Congregação *</Label>
                <Select value={congregacao} onValueChange={setCongregacao}>
                  <SelectTrigger><SelectValue placeholder="Selecione sua congregação" /></SelectTrigger>
                  <SelectContent>
                    {congregations.map((c: any) => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}
                    <SelectItem value="__outra">Outro Ministério / Visitante</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {congregacao === "__outra" && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Qual o seu ministério/igreja?</Label>
                  <Input value={novaCongregacao} onChange={(e) => setNovaCongregacao(e.target.value)} placeholder="Digite o nome da sua igreja" />
                </div>
              )}
            </div>

            {uniforms.length > 0 && (
              <div className="pt-4 border-t space-y-4 mt-2">
                <h3 className="font-medium">Roupa / Uniforme do Evento</h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Modelo Desejado</Label>
                      <Select value={uniformId} onValueChange={setUniformId}>
                        <SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Não vou querer uniforme</SelectItem>
                          {uniforms.map((u: any) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.modelo} {u.cor ? `- ${u.cor}` : ""} (+{fmtBRL(u.valor)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {selectedUniform && selectedUniform.foto_url && (
                        <div className="mt-2 border rounded p-1 inline-block bg-white">
                          <img src={selectedUniform.foto_url} alt="Modelo de roupa selecionado" className="h-32 object-contain" />
                        </div>
                      )}
                    </div>
                    
                    {uniformId !== "__none" && (
                      <div className="space-y-2">
                        <Label>Tamanho</Label>
                        <Select value={tamanho} onValueChange={setTamanho}>
                          <SelectTrigger><SelectValue placeholder="Selecione o tamanho" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">—</SelectItem>
                            {["PP", "P", "M", "G", "GG", "XG"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Checkbox checked={possuiRoupaPropria} onCheckedChange={(v) => setPossuiRoupaPropria(!!v)} id="possui-roupa" />
                  <Label htmlFor="possui-roupa" className="cursor-pointer">Já possuo a roupa/uniforme (não cobrar valor)</Label>
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
               <div className="flex justify-between items-center bg-accent/50 p-4 rounded-lg">
                 <span className="font-medium text-lg">Total a pagar:</span>
                 <span className="font-bold text-xl text-primary">{fmtBRL(valorTotal)}</span>
               </div>
            </div>

              <Button 
                className="w-full mt-4" 
                size="lg" 
                onClick={() => createMut.mutate()} 
                disabled={!nome.trim() || !telefone.trim() || !cpf.trim() || !dataNascimento.trim() || !congregacao.trim() || (congregacao === "__outra" && !novaCongregacao.trim()) || createMut.isPending}
              >
                {createMut.isPending ? "Processando..." : "Confirmar Inscrição"}
              </Button>
            </div>
            
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
