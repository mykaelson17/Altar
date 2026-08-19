import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Megaphone } from "lucide-react";
import { getAvisosPendentesHoje, marcarAvisoVistoHoje } from "@/lib/avisos.functions";
import { isAvisosSuppressed, onAvisosGateChange } from "@/lib/avisos-gate";

export function AvisosPopup() {
  const qc = useQueryClient();
  const { data: avisos = [] } = useQuery({
    queryKey: ["avisos-pendentes-hoje"],
    queryFn: () => getAvisosPendentesHoje(),
    staleTime: Infinity, // não busca de novo sozinho — só quando a página recarrega
  });

  const [fila, setFila] = useState<any[]>([]);
  const [fechando, setFechando] = useState(false);
  // Só existe pra forçar um re-render quando o portão libera — o valor
  // em si não importa, só o fato de mudar.
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (avisos.length > 0) setFila(avisos);
  }, [avisos]);

  // Reavalia sempre que alguma tela "solta" o portão (ex.: logo depois
  // de salvar um lançamento) — se tiver aviso pendente, aparece agora.
  useEffect(() => onAvisosGateChange(() => forceTick((n) => n + 1)), []);

  const atual = fila[0];
  const podeExibir = !!atual && !isAvisosSuppressed();
  if (!podeExibir) return null;

  async function fechar() {
    setFechando(true);
    try {
      await marcarAvisoVistoHoje({ data: { avisoId: atual.id } });
    } finally {
      setFila((f) => f.slice(1));
      setFechando(false);
      qc.invalidateQueries({ queryKey: ["avisos-pendentes-hoje"] });
    }
  }

  return (
    <Dialog open={podeExibir} onOpenChange={(open) => { if (!open) fechar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Megaphone className="size-5" />
            <DialogTitle>{atual.titulo}</DialogTitle>
          </div>
        </DialogHeader>
        <p className="text-sm whitespace-pre-wrap">{atual.mensagem}</p>
        {fila.length > 1 && (
          <p className="text-xs text-muted-foreground">Mais {fila.length - 1} aviso(s) depois deste.</p>
        )}
        <Button onClick={fechar} disabled={fechando} className="mt-2">
          {fechando ? "Fechando..." : "Fechar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
