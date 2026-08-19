import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import QRCode from "qrcode";
import { q1 } from "./db.server";
import { requireAuth } from "./auth-middleware";

export const getCarteirinhaData = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ participantId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const member = await q1<any>(
      `SELECT p.*, c.nome AS congregacao_nome FROM participants p LEFT JOIN congregations c ON c.id = p.congregation_id WHERE p.id = $1`,
      [data.participantId],
    );
    if (!member) throw new Error("Membro não encontrado.");

    const qrDataUrl = await QRCode.toDataURL(`IGREJA-MEMBRO:${member.id}`, { margin: 1, width: 200 });
    return { member, qrDataUrl };
  });

export const getCertificadoData = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ participantId: z.string().min(1), tipo: z.enum(["BATISMO", "MEMBRESIA"]) }).parse(d))
  .handler(async ({ data }) => {
    const member = await q1<any>(
      `SELECT p.*, c.nome AS congregacao_nome, c.pastor_responsavel FROM participants p LEFT JOIN congregations c ON c.id = p.congregation_id WHERE p.id = $1`,
      [data.participantId],
    );
    if (!member) throw new Error("Membro não encontrado.");
    if (data.tipo === "BATISMO" && !member.data_batismo) {
      throw new Error("Esse membro não tem data de batismo cadastrada — preencha antes de emitir o certificado.");
    }
    if (data.tipo === "MEMBRESIA" && !member.data_recepcao) {
      throw new Error("Esse membro não tem data de recepção cadastrada — preencha antes de emitir o certificado.");
    }
    return { member, tipo: data.tipo };
  });
