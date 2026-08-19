import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, q1 } from "./db.server";
import { requireAdmin } from "./auth-middleware";

const BRANDING_KEYS = ["branding_nome_sistema", "branding_logo_url", "branding_login_bg_url", "branding_cor_primaria"] as const;

export type PublicBranding = {
  nome_sistema: string;
  logo_url: string;
  login_bg_url: string;
  cor_primaria: string;
};

// Sem exigir login — a tela de /auth usa isso antes de qualquer autenticação.
export const getPublicBranding = createServerFn({ method: "GET" }).handler(async (): Promise<PublicBranding> => {
  const rows = await q<{ key: string; value: string }>(
    `SELECT key, value FROM church_settings WHERE key IN (${BRANDING_KEYS.map((k) => `'${k}'`).join(",")})`,
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    nome_sistema: map.branding_nome_sistema || "Altar",
    logo_url: map.branding_logo_url || "",
    login_bg_url: map.branding_login_bg_url || "",
    cor_primaria: map.branding_cor_primaria || "",
  };
});

const SaveBrandingSchema = z.object({
  nome_sistema: z.string().trim().min(1),
  logo_url: z.string().optional(),
  login_bg_url: z.string().optional(),
  cor_primaria: z.string().optional(),
});

// Só a sede (admin/master) personaliza — vale pra instância inteira.
export const saveGlobalBranding = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((d: unknown) => SaveBrandingSchema.parse(d))
  .handler(async ({ data }) => {
    const pairs: [string, string][] = [
      ["branding_nome_sistema", data.nome_sistema],
      ["branding_logo_url", data.logo_url ?? ""],
      ["branding_login_bg_url", data.login_bg_url ?? ""],
      ["branding_cor_primaria", data.cor_primaria ?? ""],
    ];
    for (const [key, value] of pairs) {
      await q1(
        `INSERT INTO church_settings (key, value) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value],
      );
    }
    return { ok: true };
  });
