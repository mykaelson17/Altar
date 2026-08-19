import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q } from "./sqlite.server";
import { requireAuth } from "./auth-middleware";

export const listCargos = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    return q<{ id: string; nome: string }>(`SELECT id, nome FROM cargos ORDER BY nome ASC`);
  });

export const createCargo = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ nome: z.string().trim().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const existing = q<{ id: string }>(`SELECT id FROM cargos WHERE nome = ? COLLATE NOCASE`, [data.nome])[0];
    if (existing) throw new Error("Cargo já cadastrado.");
    q(`INSERT INTO cargos (nome) VALUES (?)`, [data.nome]);
    return { success: true };
  });

export const deleteCargo = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    q(`DELETE FROM cargos WHERE id = ?`, [data.id]);
    return { success: true };
  });

export const listDepartamentos = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    return q<{ id: string; nome: string }>(`SELECT id, nome FROM departamentos ORDER BY nome ASC`);
  });

export const createDepartamento = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ nome: z.string().trim().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const existing = q<{ id: string }>(`SELECT id FROM departamentos WHERE nome = ? COLLATE NOCASE`, [data.nome])[0];
    if (existing) throw new Error("Departamento já cadastrado.");
    q(`INSERT INTO departamentos (nome) VALUES (?)`, [data.nome]);
    return { success: true };
  });

export const deleteDepartamento = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    q(`DELETE FROM departamentos WHERE id = ?`, [data.id]);
    return { success: true };
  });

export const listTiposCulto = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    return q<{ id: string; nome: string }>(`SELECT id, nome FROM tipos_culto ORDER BY nome ASC`);
  });

export const createTipoCulto = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ nome: z.string().trim().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const existing = q<{ id: string }>(`SELECT id FROM tipos_culto WHERE nome = ? COLLATE NOCASE`, [data.nome])[0];
    if (existing) throw new Error("Tipo de culto já cadastrado.");
    q(`INSERT INTO tipos_culto (nome) VALUES (?)`, [data.nome]);
    return { success: true };
  });

export const deleteTipoCulto = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    q(`DELETE FROM tipos_culto WHERE id = ?`, [data.id]);
    return { success: true };
  });

// Tipos de Evento
export const listTiposEvento = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    return q<{ id: string; nome: string }>("SELECT id, nome FROM tipos_evento ORDER BY nome");
  });

export const createTipoEvento = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ nome: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    try {
      q("INSERT INTO tipos_evento (nome) VALUES ($1)", [data.nome.trim()]);
    } catch (e: any) {
      if (e.message.includes("UNIQUE")) throw new Error("Tipo de evento já cadastrado");
      throw e;
    }
    return { success: true };
  });

export const deleteTipoEvento = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    q("DELETE FROM tipos_evento WHERE id = $1", [data.id]);
    return { success: true };
  });
