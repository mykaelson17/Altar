import { createFileRoute } from "@tanstack/react-router";
import { LicensePanel } from "@/components/license-panel";

export const Route = createFileRoute("/_authenticated/licenca")({
  head: () => ({ meta: [{ title: "Licença" }] }),
  component: LicensePanel,
});
