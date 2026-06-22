import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  useAnalyzeScan,
  getListScansQueryKey,
  getGetHomeSummaryQueryKey,
  type Scan,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Camera, ImagePlus, RotateCcw, AlertTriangle, Leaf, CheckCircle2, X } from "lucide-react";
import { HealthRing } from "@/components/health-ring";
import { fileToResizedDataUrl, objectPathToUrl } from "@/lib/image";

export default function ScanPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [scan, setScan] = useState<Scan | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const analyze = useAnalyzeScan();

  async function onPick(file: File) {
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setPreviewUrl(dataUrl);
      setPendingDataUrl(dataUrl);
      setScan(null);
    } catch (err) {
      toast({ title: "Couldn't read that image", description: String(err), variant: "destructive" });
    }
  }

  function reset() {
    setPreviewUrl(null);
    setPendingDataUrl(null);
    setNote("");
    setScan(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit() {
    if (!pendingDataUrl) return;
    setUploading(true);
    const dataUrl = pendingDataUrl;
    setUploading(false);
    analyze.mutate(
      { data: { imageDataUrl: dataUrl, note: note || undefined } },
      {
        onSuccess: (result) => {
          setScan(result);
          qc.invalidateQueries({ queryKey: getListScansQueryKey() });
          qc.invalidateQueries({ queryKey: getGetHomeSummaryQueryKey() });
          toast({ title: "Analyzed", description: result.foodName });
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Analysis failed";
          toast({ title: "Analysis failed", description: msg, variant: "destructive" });
        },
      },
    );
  }

  const busy = uploading || analyze.isPending;
  const scanImageUrl = scan ? objectPathToUrl(scan.imageDataUrl) : undefined;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="font-serif text-3xl tracking-tight">Scan a meal</h1>
        <p className="text-muted-foreground mt-1">Snap or upload — we'll do the rest.</p>
      </header>

      <Card className="border-card-border overflow-hidden">
        <CardContent className="p-0">
          {!previewUrl ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              data-testid="button-pick-photo"
              className="w-full aspect-[4/3] grid place-items-center bg-gradient-to-br from-primary/15 via-accent/40 to-secondary/10 hover:from-primary/20 transition-colors"
            >
              <div className="text-center px-6">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-card grid place-items-center shadow-md mb-4">
                  <Camera className="w-7 h-7 text-primary" />
                </div>
                <div className="font-serif text-xl">Tap to capture</div>
                <p className="text-sm text-muted-foreground mt-1">Use your camera, or pick a photo</p>
              </div>
            </button>
          ) : (
            <div className="relative">
              <img src={previewUrl} alt="To analyze" className="w-full max-h-[60vh] object-cover" data-testid="img-preview" />
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-3 right-3 rounded-full"
                onClick={reset}
                data-testid="button-reset"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Retake
              </Button>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPick(f);
            }}
            data-testid="input-photo"
          />
        </CardContent>
      </Card>

      {previewUrl && !scan ? (
        <Card className="border-card-border">
          <CardContent className="p-5 space-y-4">
            <div>
              <Label htmlFor="note">Anything we should know? (optional)</Label>
              <Input
                id="note"
                placeholder="e.g. half a portion, no dressing"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1.5"
                data-testid="input-note"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={submit}
                disabled={busy}
                className="rounded-full"
                size="lg"
                data-testid="button-analyze"
              >
                {busy ? (
                  <><Spinner className="mr-2" /> {uploading ? "Uploading…" : "Analyzing…"}</>
                ) : (
                  <><ImagePlus className="w-4 h-4 mr-2" /> Analyze</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => inputRef.current?.click()}
                className="rounded-full"
                size="lg"
              >
                Choose another
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {scan ? (
        <Card className="border-card-border animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardContent className="p-5 space-y-5">
            {scanImageUrl ? (
              <img src={scanImageUrl} alt={scan.foodName} className="w-full rounded-2xl max-h-72 object-cover" />
            ) : null}
            <div className="flex items-start gap-4">
              <HealthRing score={scan.healthScore} size={72} />
              <div className="flex-1 min-w-0">
                <h2 className="font-serif text-2xl tracking-tight" data-testid="text-result-name">{scan.foodName}</h2>
                <p className="text-sm text-muted-foreground mt-1">{scan.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                ["Calories", `${scan.calories}`, "kcal"],
                ["Protein", `${Math.round(scan.protein)}`, "g"],
                ["Carbs", `${Math.round(scan.carbs)}`, "g"],
                ["Fat", `${Math.round(scan.fat)}`, "g"],
                ["Fiber", `${Math.round(scan.fiber)}`, "g"],
              ].map(([label, val, unit]) => (
                <div key={label} className="rounded-xl bg-muted/60 p-3" data-testid={`stat-${label.toLowerCase()}`}>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                  <div className="font-serif text-xl">{val}<span className="text-xs ml-0.5 text-muted-foreground">{unit}</span></div>
                </div>
              ))}
            </div>
            {scan.allergens.length ? (
              <div
                className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 space-y-1.5"
                data-testid="section-allergen-warnings"
                role="alert"
              >
                <div className="flex items-center gap-1.5 text-destructive font-semibold text-sm">
                  <AlertTriangle className="w-4 h-4" /> Allergen alert
                </div>
                <ul className="text-xs space-y-0.5">
                  {scan.allergens.map((a, i) => (
                    <li key={i} data-testid={`allergen-${a.allergen}`}>
                      <span className="font-medium capitalize">{a.allergen.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground"> · {a.severity.replace("_", " ")}</span>
                      {a.reason ? <span className="text-muted-foreground"> — {a.reason}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="section-dietary-compliance">
              {(
                [
                  ["vegetarian", "Vegetarian"],
                  ["vegan", "Vegan"],
                  ["glutenFree", "Gluten-free"],
                  ["dairyFree", "Dairy-free"],
                  ["pescatarian", "Pescatarian"],
                  ["keto", "Keto"],
                ] as const
              ).map(([key, label]) => {
                const ok = Boolean(scan.dietaryCompliance[key]);
                return (
                  <div
                    key={key}
                    className={`rounded-lg p-2 text-xs flex items-center gap-1.5 ${
                      ok ? "bg-secondary/30 text-foreground" : "bg-muted/50 text-muted-foreground line-through"
                    }`}
                    data-testid={`compliance-${key}`}
                  >
                    {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-secondary-foreground" /> : <X className="w-3.5 h-3.5" />}
                    {label}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-3" data-testid="section-environmental-score">
              <Leaf className="w-4 h-4 text-secondary-foreground" />
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Environmental impact</div>
                <div className="font-serif text-base">{scan.environmentalScore}/100 <span className="text-xs text-muted-foreground">{scan.environmentalScore >= 70 ? "low" : scan.environmentalScore >= 40 ? "moderate" : "high"} footprint</span></div>
              </div>
            </div>
            {scan.ingredients.length ? (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Ingredients</div>
                <div className="flex flex-wrap gap-1.5">
                  {scan.ingredients.map((ing, i) => (
                    <Badge key={i} variant="outline">{ing.name} · {ing.amount}</Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {scan.tags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {scan.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
              </div>
            ) : null}
            <div className="flex gap-2 pt-2">
              <Button onClick={reset} className="rounded-full" data-testid="button-scan-another">Scan another</Button>
              <Button variant="outline" onClick={() => navigate("/history")} className="rounded-full">View history</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
