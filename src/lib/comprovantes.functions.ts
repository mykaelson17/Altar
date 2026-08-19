import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "crypto";
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import { join, dirname } from "path";
import { q1, getDataDir } from "./sqlite.server";
import { requireFinance } from "./auth-middleware";

// Comprovantes ficam em disco, na mesma pasta montada como volume do
// Docker (data/comprovantes/) — não no banco. Isso evita que o SQLite
// vá inchando com anos de fotos de nota fiscal; o banco só guarda o
// caminho relativo do arquivo.
//
// Organização das pastas: comprovantes/<congregação>/<ano>-<mês>/<dia>/
// — usa a DATA DO LANÇAMENTO (não a data do upload), que é o que faz
// sentido pra quem for procurar depois ("o comprovante daquela despesa
// de março"), mesmo que o comprovante só seja anexado meses depois.

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function comprovantesRoot(): string {
  const dir = join(getDataDir(), "comprovantes");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function slugify(nome: string): string {
  const semAcento = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const limpo = semAcento.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return limpo || "sem-nome";
}

// Monta o caminho relativo (dentro de comprovantes/) baseado na
// congregação e na data do lançamento — ex.:
// "assembleia-central/2026-03/15/<arquivo>"
function buildRelativePath(congregacaoNome: string | null, dataLancamento: string, filename: string): string {
  const pastaCongregacao = slugify(congregacaoNome || "sede-geral");
  const [ano, mes, dia] = dataLancamento.split("-"); // formato esperado: YYYY-MM-DD
  const anoMes = ano && mes ? `${ano}-${mes}` : "sem-data";
  const diaPasta = dia || "00";
  return join(pastaCongregacao, anoMes, diaPasta, filename);
}

const UploadSchema = z.object({
  transactionId: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  base64: z.string().min(1),
});

export const uploadComprovante = createServerFn({ method: "POST" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) => UploadSchema.parse(d))
  .handler(async ({ data }) => {
    const ext = ALLOWED_EXT[data.mimeType];
    if (!ext) {
      throw new Error("Tipo de arquivo não aceito. Envie uma foto (JPG/PNG/WEBP) ou PDF.");
    }

    const buffer = Buffer.from(data.base64, "base64");
    if (buffer.byteLength > MAX_SIZE_BYTES) {
      throw new Error("Arquivo muito grande (máximo 8MB).");
    }

    const tx = await q1<{ id: string; comprovante_url: string | null; data: string; congregation_id: string | null }>(
      `SELECT id, comprovante_url, data, congregation_id FROM finance_transactions WHERE id = $1`,
      [data.transactionId],
    );
    if (!tx) throw new Error("Lançamento não encontrado.");

    const congregacao = tx.congregation_id
      ? await q1<{ nome: string }>(`SELECT nome FROM congregations WHERE id = $1`, [tx.congregation_id])
      : null;

    // Se já tinha um comprovante anterior (mesmo que em outra pasta, caso
    // a data/congregação tenha mudado depois), apaga do disco antes de trocar.
    if (tx.comprovante_url) {
      const oldPath = join(comprovantesRoot(), tx.comprovante_url);
      if (existsSync(oldPath)) unlinkSync(oldPath);
    }

    const storedName = `${data.transactionId}-${randomUUID()}.${ext}`;
    const relativePath = buildRelativePath(congregacao?.nome ?? null, tx.data, storedName);
    const fullPath = join(comprovantesRoot(), relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, buffer);

    await q1(`UPDATE finance_transactions SET comprovante_url = $1 WHERE id = $2`, [relativePath, data.transactionId]);
    return { ok: true, path: relativePath };
  });

export const getComprovante = createServerFn({ method: "GET" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const tx = await q1<{ comprovante_url: string | null }>(
      `SELECT comprovante_url FROM finance_transactions WHERE id = $1`,
      [data.transactionId],
    );
    if (!tx?.comprovante_url) return null;

    const filePath = join(comprovantesRoot(), tx.comprovante_url);
    if (!existsSync(filePath)) return null;

    const ext = tx.comprovante_url.split(".").pop() ?? "";
    const mimeByExt: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };
    const buffer = readFileSync(filePath);
    return {
      base64: buffer.toString("base64"),
      mimeType: mimeByExt[ext] ?? "application/octet-stream",
      isPdf: ext === "pdf",
      path: tx.comprovante_url,
    };
  });

export const removeComprovante = createServerFn({ method: "POST" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const tx = await q1<{ comprovante_url: string | null }>(
      `SELECT comprovante_url FROM finance_transactions WHERE id = $1`,
      [data.transactionId],
    );
    if (tx?.comprovante_url) {
      const filePath = join(comprovantesRoot(), tx.comprovante_url);
      if (existsSync(filePath)) unlinkSync(filePath);
    }
    await q1(`UPDATE finance_transactions SET comprovante_url = NULL WHERE id = $1`, [data.transactionId]);
    return { ok: true };
  });
