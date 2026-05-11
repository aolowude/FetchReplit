import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListScans,
  getListScansQueryKey,
  useDeleteScan,
  getGetHomeSummaryQueryKey,
  type Scan,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { HealthRing } from "@/components/health-ring";
import { Search, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function HistoryPage() {
  const q = useListScans({ query: { queryKey: getListScansQueryKey() } });
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Scan | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const del = useDeleteScan();

  const items = useMemo(() => {
    const all = q.data ?? [];
    if (!search) return all;
    const s = search.toLowerCase();
    return all.filter((x) => x.foodName.toLowerCase().includes(s) || x.tags.some((t) => t.toLowerCase().includes(s)));
  }, [q.data, search]);

  function remove(id: string) {
    del.mutate(
      { id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListScansQueryKey() });
          qc.invalidateQueries({ queryKey: getGetHomeSummaryQueryKey() });
          setActive(null);
          toast({ title: "Scan deleted" });
        },
        onError: (err: unknown) => toast({ title: "Couldn't delete", description: err instanceof Error ? err.message : String(err), variant: "destructive" }),
      },
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">Scan history</h1>
          <p className="text-muted-foreground mt-1">Every meal you've scanned.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or tag"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full"
            data-testid="input-search-history"
          />
        </div>
      </header>

      {q.isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-card-border"><CardContent className="py-12 text-center text-muted-foreground">No scans yet — head to <a href="/scan" className="underline">Scan</a> to capture your first meal.</CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s)}
              className="text-left rounded-2xl overflow-hidden border border-card-border bg-card hover:shadow-lg transition-all hover:-translate-y-0.5"
              data-testid={`card-history-${s.id}`}
            >
              <div className="aspect-[4/3] bg-muted">
                {s.imageDataUrl ? <img src={s.imageDataUrl} alt={s.foodName} className="w-full h-full object-cover" loading="lazy" /> : null}
              </div>
              <div className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-lg leading-tight truncate" data-testid={`text-history-name-${s.id}`}>{s.foodName}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {format(new Date(s.createdAt), "MMM d · p")} · {s.calories} kcal
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {s.tags.slice(0, 2).map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                  </div>
                </div>
                <HealthRing score={s.healthScore} size={48} strokeWidth={4} />
              </div>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg" data-testid="sheet-scan-detail">
          {active ? (
            <>
              <SheetHeader>
                <SheetTitle className="font-serif text-2xl">{active.foodName}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {active.imageDataUrl ? (
                  <img src={active.imageDataUrl} alt={active.foodName} className="w-full rounded-2xl" />
                ) : null}
                <div className="flex items-center gap-4">
                  <HealthRing score={active.healthScore} size={64} />
                  <div className="text-sm text-muted-foreground">{active.description}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Calories", active.calories, "kcal"],
                    ["Protein", Math.round(active.protein), "g"],
                    ["Carbs", Math.round(active.carbs), "g"],
                    ["Fat", Math.round(active.fat), "g"],
                    ["Fiber", Math.round(active.fiber), "g"],
                    ["Sugar", Math.round(active.sugar), "g"],
                  ].map(([l, v, u]) => (
                    <div key={l} className="rounded-xl bg-muted/60 p-3">
                      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{l}</div>
                      <div className="font-serif text-lg">{v}<span className="text-xs ml-0.5 text-muted-foreground">{u}</span></div>
                    </div>
                  ))}
                </div>
                {active.ingredients.length ? (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Ingredients</div>
                    <ul className="space-y-1 text-sm">
                      {active.ingredients.map((ing, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{ing.name}</span>
                          <span className="text-muted-foreground">{ing.amount}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <Button
                  variant="destructive"
                  onClick={() => remove(active.id)}
                  disabled={del.isPending}
                  className="w-full rounded-full"
                  data-testid={`button-delete-scan-${active.id}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete scan
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
