import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ScanLine } from "lucide-react";
import { checkIn } from "@/lib/registrations.functions";

export const Route = createFileRoute("/_authenticated/checkin")({
  head: () => ({ meta: [{ title: "Check-in — QR Code" }] }),
  component: Page,
});

function Page() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanningRef = useRef(true);
  const lastCodeRef = useRef<string | null>(null);

  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState<{ ok: boolean; nome?: string; evento?: string; message?: string } | null>(null);
  const [history, setHistory] = useState<{ nome: string; evento: string; hora: string }[]>([]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId: number;

    async function handleDecoded(code: string) {
      scanningRef.current = false;
      try {
        const res = await checkIn({ data: { qr_code: code } });
        setResult({ ok: true, nome: res.nome, evento: res.evento });
        setHistory((h) => [{ nome: res.nome, evento: res.evento, hora: new Date().toLocaleTimeString("pt-BR") }, ...h].slice(0, 10));
      } catch (e: any) {
        setResult({ ok: false, message: e.message });
      }
      setTimeout(() => {
        setResult(null);
        lastCodeRef.current = null;
        scanningRef.current = true;
      }, 2500);
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (scanningRef.current && video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data && code.data !== lastCodeRef.current) {
            lastCodeRef.current = code.data;
            handleDecoded(code.data);
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch (e: any) {
        setCameraError(e.message || "Não foi possível acessar a câmera.");
      }
    })();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-10">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center justify-center gap-2">
          <ScanLine className="size-6" /> Check-in
        </h1>
        <p className="text-sm text-muted-foreground">Aponte a câmera pro QR Code do participante.</p>
      </header>

      <Card className="overflow-hidden">
        <CardContent className="p-0 relative">
          {cameraError ? (
            <div className="p-8 text-center text-sm text-destructive">{cameraError}</div>
          ) : (
            <video ref={videoRef} className="w-full aspect-square object-cover bg-black" playsInline muted />
          )}
          <canvas ref={canvasRef} className="hidden" />

          {result && (
            <div className={`absolute inset-0 grid place-items-center backdrop-blur-sm ${result.ok ? "bg-green-500/80" : "bg-red-500/80"}`}>
              <div className="text-center text-white p-4">
                {result.ok ? <CheckCircle2 className="size-16 mx-auto mb-2" /> : <XCircle className="size-16 mx-auto mb-2" />}
                <div className="text-xl font-semibold">{result.ok ? result.nome : "Não foi possível"}</div>
                <div className="text-sm opacity-90">{result.ok ? result.evento : result.message}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Últimos check-ins</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>{h.nome}</span>
                <Badge variant="outline">{h.hora}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
