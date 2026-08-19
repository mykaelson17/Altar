// "Portão" do mural de avisos — qualquer formulário pode "segurar" o
// popup enquanto o usuário está digitando (pra não interromper no meio
// de um lançamento), e "soltar" no momento certo (ex.: logo depois de
// salvar, antes de começar o próximo). Usa contador (não booleano) pra
// aguentar múltiplas seguranças sobrepostas sem soltar cedo demais.

type Listener = () => void;

let suppressCount = 0;
const listeners = new Set<Listener>();

export function suppressAvisos() {
  suppressCount++;
}

export function releaseAvisos() {
  suppressCount = Math.max(0, suppressCount - 1);
  if (suppressCount === 0) listeners.forEach((l) => l());
}

export function isAvisosSuppressed(): boolean {
  return suppressCount > 0;
}

// Assina mudanças de "liberado" — usado pelo popup pra saber quando
// tentar aparecer de novo.
export function onAvisosGateChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
