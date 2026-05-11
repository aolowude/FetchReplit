import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetUserMemory,
  getGetUserMemoryQueryKey,
  useCreateMemoryFact,
  useDeleteMemoryFact,
  useClearAllMemoryFacts,
  getGetHomeSuggestionsQueryKey,
  type MemoryFact,
  type MemoryTier,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Eraser, Sparkles, User, Activity, Clock } from "lucide-react";
import { format } from "date-fns";

const SUGGESTED_CATEGORIES = ["preference", "allergy", "goal", "routine", "context"];

const TIER_META: Record<MemoryTier, { label: string; description: string; icon: typeof User }> = {
  stable_profile: {
    label: "About you",
    description: "Long-lived facts you've told us — preferences, allergies, lifestyle.",
    icon: User,
  },
  inferred_preferences: {
    label: "What we've learned",
    description: "Patterns we've noticed from your scans. Edit or delete anything that's wrong.",
    icon: Sparkles,
  },
  contextual_state: {
    label: "Right now",
    description: "Short-lived context — travelling, hosting, on a cleanse.",
    icon: Clock,
  },
};

const TIER_ORDER: MemoryTier[] = ["stable_profile", "inferred_preferences", "contextual_state"];

export function MemoryPanel() {
  const q = useGetUserMemory({ query: { queryKey: getGetUserMemoryQueryKey() } });
  const create = useCreateMemoryFact();
  const del = useDeleteMemoryFact();
  const clearAll = useClearAllMemoryFacts();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tier, setTier] = useState<MemoryTier>("stable_profile");
  const [category, setCategory] = useState("preference");
  const [content, setContent] = useState("");

  const groups = useMemo(() => {
    const data = q.data ?? { stableProfile: [], inferredPreferences: [], contextualState: [] };
    return {
      stable_profile: data.stableProfile ?? [],
      inferred_preferences: data.inferredPreferences ?? [],
      contextual_state: data.contextualState ?? [],
    } as Record<MemoryTier, MemoryFact[]>;
  }, [q.data]);
  const total = TIER_ORDER.reduce((acc, t) => acc + groups[t].length, 0);

  function refresh() {
    qc.invalidateQueries({ queryKey: getGetUserMemoryQueryKey() });
    qc.invalidateQueries({ queryKey: getGetHomeSuggestionsQueryKey() });
  }

  function add() {
    if (!content.trim()) return;
    create.mutate(
      { data: { tier, category, content: content.trim() } },
      {
        onSuccess: () => { setContent(""); refresh(); toast({ title: "Saved" }); },
        onError: (err: unknown) => toast({ title: "Couldn't save", description: err instanceof Error ? err.message : String(err), variant: "destructive" }),
      },
    );
  }

  function remove(id: string) {
    del.mutate({ id }, {
      onSuccess: () => { refresh(); toast({ title: "Forgotten" }); },
      onError: (err: unknown) => toast({ title: "Couldn't delete", description: err instanceof Error ? err.message : String(err), variant: "destructive" }),
    });
  }

  function wipe() {
    clearAll.mutate(undefined, {
      onSuccess: () => { refresh(); toast({ title: "Memory cleared" }); },
      onError: (err: unknown) => toast({ title: "Couldn't clear", description: err instanceof Error ? err.message : String(err), variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-[10rem_10rem_1fr_auto]">
        <div>
          <Label htmlFor="mem-tier" className="sr-only">Tier</Label>
          <Select value={tier} onValueChange={(v) => setTier(v as MemoryTier)}>
            <SelectTrigger id="mem-tier" data-testid="select-memory-tier"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIER_ORDER.map((t) => (
                <SelectItem key={t} value={t}>{TIER_META[t].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="mem-cat" className="sr-only">Category</Label>
          <Input id="mem-cat" value={category} onChange={(e) => setCategory(e.target.value)} list="memory-cats" data-testid="input-memory-category" />
          <datalist id="memory-cats">
            {SUGGESTED_CATEGORIES.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <Input
          placeholder="e.g. I cook for two on weeknights"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          data-testid="input-memory-content"
        />
        <Button onClick={add} disabled={create.isPending || !content.trim()} className="rounded-full" data-testid="button-add-memory">
          {create.isPending ? <Spinner /> : "Add"}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{total} {total === 1 ? "fact" : "facts"} remembered</div>
        {total > 0 ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive" data-testid="button-clear-memory">
                <Eraser className="w-4 h-4 mr-1.5" /> Clear all
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Forget everything?</AlertDialogTitle>
                <AlertDialogDescription>This deletes everything across all three tiers. Your profile preferences stay intact.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={wipe} disabled={clearAll.isPending} data-testid="button-confirm-clear">Clear all</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>

      {q.isLoading ? (
        <div className="space-y-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No memories yet. Add a fact above to get more personal suggestions.</p>
      ) : (
        <div className="space-y-5" data-testid="memory-tier-groups">
          {TIER_ORDER.map((t) => {
            const items = groups[t];
            const Icon = TIER_META[t].icon;
            return (
              <section key={t} className="space-y-2" data-testid={`section-memory-${t}`}>
                <header className="flex items-baseline justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-4 h-4 text-primary" />
                    <h3 className="font-serif text-base">{TIER_META[t].label}</h3>
                    <span className="text-xs text-muted-foreground">· {items.length}</span>
                  </div>
                </header>
                <p className="text-xs text-muted-foreground">{TIER_META[t].description}</p>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">Nothing here yet.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-card-border bg-card/50">
                    {items.map((f) => (
                      <li key={f.id} className="py-2.5 px-3 flex items-start gap-3" data-testid={`row-memory-${f.id}`}>
                        <Badge variant="secondary" className="capitalize mt-0.5 shrink-0">{f.category}</Badge>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm flex items-center gap-1.5">
                            {f.content}
                            {f.source === "inferred" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary"><Sparkles className="w-3 h-3" /> learned</span>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{format(new Date(f.createdAt), "MMM d, yyyy")}</div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => remove(f.id)} disabled={del.isPending} data-testid={`button-delete-memory-${f.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
