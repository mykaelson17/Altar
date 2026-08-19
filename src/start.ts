import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    if (error instanceof Response) {
      // Server functions com requireAuth propagam Response(401/403). Repasse.
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Login/sessão desse app são 100% locais (SQLite + cookie de sessão — ver
// src/lib/session.server.ts e src/lib/auth-middleware.ts). O Supabase NÃO é
// usado; não anexamos nenhum middleware de autenticação do Supabase aqui.
export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
}));
