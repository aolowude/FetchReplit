import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMemoryFacts,
  getListMemoryFactsQueryKey,
  useCreateMemoryFact,
  useDeleteMemoryFact,
  useClearAllMemoryFacts,
  getGetHomeSuggestionsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Eraser } from "lucide-react";
import { format } from "date-fns";

const SUGGESTED_CATEGORIES = ["preference", "allergy", "goal", "routine", "context"];

export default function MemoryPage() {
  const q = useListMemoryFacts({ query: { queryKey: getListMemoryFactsQueryKey() } });
  const facts = q.data ?? [];
  const create = useCreateMemoryFact();
  const del = useDeleteMemoryFact();
  const clearAll = useClearAllMemoryFacts();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [category, setCategory] = useState("preference");
  const [content, setContent] = useState("");

  function refresh() {
    qc.invalidateQueries({ queryKey: getListMemoryFactsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetHomeSuggestionsQueryKey() });
  }

  function add() {
    if (!content.trim()) return;
    create.mutate(
      { data: { category, content: content.trim() } },
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
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="font-serif text-3xl tracking-tight">Memory</h1>
        <p className="text-muted-foreground mt-1">Little notes Fetch keeps about you to make better suggestions. Edit anytime.</p>
      </header>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="font-serif text-xl flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Add a fact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-[10rem_1fr_auto] gap-2">
            <div>
              <Label htmlFor="cat" className="sr-only">Category</Label>
              <Input id="cat" value={category} onChange={(e) => setCategory(e.target.value)} list="memory-cats" data-testid="input-memory-category" />
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
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-serif text-xl">What we remember ({facts.length})</CardTitle>
          {facts.length > 0 ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive" data-testid="button-clear-memory">
                  <Eraser className="w-4 h-4 mr-1.5" /> Clear all
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Forget everything?</AlertDialogTitle>
                  <AlertDialogDescription>This deletes all memory facts. Your profile preferences stay intact.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={wipe} disabled={clearAll.isPending} data-testid="button-confirm-clear">Clear all</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <div className="space-y-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : facts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No memories yet. Add a fact above to get more personal suggestions.</p>
          ) : (
            <ul className="divide-y divide-border">
              {facts.map((f) => (
                <li key={f.id} className="py-3 flex items-start gap-3" data-testid={`row-memory-${f.id}`}>
                  <Badge variant="secondary" className="capitalize mt-0.5">{f.category}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{f.content}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{format(new Date(f.createdAt), "MMM d, yyyy")}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(f.id)} disabled={del.isPending} data-testid={`button-delete-memory-${f.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
