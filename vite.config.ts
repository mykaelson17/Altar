// @lovable.dev/vite-tanstack-config já inclui os plugins padrão.
// Preset "node-server" para rodar on-premise (Docker/PM2).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },

  nitro: {
    preset: process.env.NITRO_PRESET || "node-server",
  },
});
