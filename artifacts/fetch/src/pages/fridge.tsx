import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListFridgeItems,
  getListFridgeItemsQueryKey,
  useCreateFridgeItem,
  useUpdateFridgeItem,
  useDeleteFridgeItem,
  useAddFridgeItemsFromImage,
  useGenerateFridgeRecipes,
  getGetHomeSummaryQueryKey,
  type FridgeItem,
  type Recipe,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Camera, ChefHat, Trash2, Pencil, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fileToResizedDataUrl } from "@/lib/image";

const CATEGORIES = ["produce", "dairy", "meat", "seafood", "grains", "pantry", "frozen", "beverages", "condiments"];

interface ItemDraft {
  id?: string;
  name: string;
  quantity: string;
  category: string;
  expiresAt: string;
  notes: string;
}

const EMPTY_DRAFT: ItemDraft = { name: "", quantity: "1", category: "pantry", expiresAt: "", notes: "" };

export default function FridgePage() {
  const q = useListFridgeItems({ query: { queryKey: getListFridgeItemsQueryKey() } });
  const items = q.data ?? [];
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateFridgeItem();
  const update = useUpdateFridgeItem();
  const del = useDeleteFridgeItem();
  const fromImage = useAddFridgeItemsFromImage();
  const recipes = useGenerateFridgeRecipes();
  const inputRef = useRef<HTMLInputElement>(null);

  const [editor, setEditor] = useState<{ open: boolean; draft: ItemDraft }>({ open: false, draft: EMPTY_DRAFT });
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [cuisine, setCuisine] = useState("");
  const [maxMinutes, setMaxMinutes] = useState(45);
  const [generated, setGenerated] = useState<Recipe[]>([]);

  function refresh() {
    qc.invalidateQueries({ queryKey: getListFridgeItemsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetHomeSummaryQueryKey() });
  }

  function openNew() { setEditor({ open: true, draft: EMPTY_DRAFT }); }
  function openEdit(it: FridgeItem) {
    setEditor({
      open: true,
      draft: {
        id: it.id,
        name: it.name,
        quantity: it.quantity,
        category: it.category,
        expiresAt: it.expiresAt ? it.expiresAt.slice(0, 10) : "",
        notes: it.notes ?? "",
      },
    });
  }

  function saveDraft() {
    const d = editor.draft;
    if (!d.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const payload = {
      name: d.name.trim(),
      quantity: d.quantity || "1",
      category: d.category,
      expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString() : null,
      notes: d.notes || null,
    };
    const cb = {
      onSuccess: () => {
        refresh();
        setEditor({ open: false, draft: EMPTY_DRAFT });
        toast({ title: d.id ? "Item updated" : "Added to MyFridge" });
      },
      onError: (err: unknown) => toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" }),
    };
    if (d.id) update.mutate({ id: d.id, data: payload }, cb);
    else create.mutate({ data: payload }, cb);
  }

  function remove(id: string) {
    del.mutate({ id }, {
      onSuccess: () => { refresh(); toast({ title: "Removed" }); },
      onError: (err: unknown) => toast({ title: "Couldn't remove", description: err instanceof Error ? err.message : String(err), variant: "destructive" }),
    });
  }

  async function onScanIngredients(file: File) {
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      fromImage.mutate({ data: { imageDataUrl: dataUrl } }, {
        onSuccess: (added) => {
          refresh();
          toast({ title: `Added ${added.length} item${added.length === 1 ? "" : "s"}` });
        },
        onError: (err: unknown) => toast({ title: "Scan failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" }),
      });
    } catch (err) {
      toast({ title: "Couldn't read image", description: String(err), variant: "destructive" });
    }
  }

  function generate() {
    setGenerated([]);
    recipes.mutate({ data: { cuisine: cuisine || undefined, maxMinutes } }, {
      onSuccess: (rs) => setGenerated(rs),
      onError: (err: unknown) => toast({ title: "Couldn't cook up ideas", description: err instanceof Error ? err.message : String(err), variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">MyFridge</h1>
          <p className="text-muted-foreground mt-1">What's at home — and what you can make from it.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            data-testid="input-scan-fridge"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onScanIngredients(f); e.target.value = ""; }}
          />
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => inputRef.current?.click()}
            disabled={fromImage.isPending}
            data-testid="button-scan-ingredients"
          >
            {fromImage.isPending ? <Spinner className="mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
            Scan ingredients
          </Button>
          <Dialog open={recipeOpen} onOpenChange={setRecipeOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full" data-testid="button-open-recipes" disabled={items.length === 0}>
                <ChefHat className="w-4 h-4 mr-2" /> Recipes from my fridge
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">What can I cook tonight?</DialogTitle>
              </DialogHeader>
              <div className="grid sm:grid-cols-2 gap-3 mt-2">
                <div>
                  <Label htmlFor="cuisine">Cuisine (optional)</Label>
                  <Input id="cuisine" placeholder="any, italian, thai…" value={cuisine} onChange={(e) => setCuisine(e.target.value)} className="mt-1.5" data-testid="input-cuisine" />
                </div>
                <div>
                  <Label htmlFor="minutes">Max minutes</Label>
                  <Input id="minutes" type="number" min={5} max={240} value={maxMinutes} onChange={(e) => setMaxMinutes(Math.max(5, Math.min(240, Number(e.target.value) || 30)))} className="mt-1.5" data-testid="input-max-minutes" />
                </div>
              </div>
              <Button className="mt-2 rounded-full" onClick={generate} disabled={recipes.isPending} data-testid="button-generate-recipes">
                {recipes.isPending ? <><Spinner className="mr-2" /> Cooking up ideas…</> : "Generate"}
              </Button>
              <div className="mt-4 space-y-4">
                {generated.map((r) => (
                  <Card key={r.id} className="border-card-border" data-testid={`card-recipe-${r.id}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-serif text-xl">{r.title}</h3>
                          <p className="text-sm text-muted-foreground">{r.description}</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground shrink-0">
                          <div>{r.estimatedMinutes} min</div>
                          <div>{r.calories} kcal</div>
                          <div>serves {r.servings}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {r.usedIngredients.map((u) => <Badge key={u} variant="secondary" className="text-[10px]">{u}</Badge>)}
                        {r.missingIngredients.map((m) => <Badge key={m} variant="outline" className="text-[10px]">+ {m}</Badge>)}
                      </div>
                      <ol className="space-y-1.5 text-sm list-decimal pl-5">
                        {r.steps.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={editor.open} onOpenChange={(o) => setEditor((s) => ({ ...s, open: o }))}>
            <DialogTrigger asChild>
              <Button className="rounded-full" variant="default" onClick={openNew} data-testid="button-add-item">
                <Plus className="w-4 h-4 mr-2" /> Add item
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" data-testid="dialog-edit-item">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">{editor.draft.id ? "Edit item" : "New item"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={editor.draft.name} onChange={(e) => setEditor((s) => ({ ...s, draft: { ...s.draft, name: e.target.value } }))} className="mt-1.5" data-testid="input-item-name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="qty">Quantity</Label>
                    <Input id="qty" value={editor.draft.quantity} onChange={(e) => setEditor((s) => ({ ...s, draft: { ...s.draft, quantity: e.target.value } }))} className="mt-1.5" data-testid="input-item-quantity" />
                  </div>
                  <div>
                    <Label htmlFor="cat">Category</Label>
                    <Select value={editor.draft.category} onValueChange={(v) => setEditor((s) => ({ ...s, draft: { ...s.draft, category: v } }))}>
                      <SelectTrigger className="mt-1.5" data-testid="select-item-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="exp">Expires (optional)</Label>
                  <Input id="exp" type="date" value={editor.draft.expiresAt} onChange={(e) => setEditor((s) => ({ ...s, draft: { ...s.draft, expiresAt: e.target.value } }))} className="mt-1.5" data-testid="input-item-expires" />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" rows={2} value={editor.draft.notes} onChange={(e) => setEditor((s) => ({ ...s, draft: { ...s.draft, notes: e.target.value } }))} className="mt-1.5" data-testid="input-item-notes" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setEditor({ open: false, draft: EMPTY_DRAFT })}>Cancel</Button>
                <Button onClick={saveDraft} disabled={create.isPending || update.isPending} data-testid="button-save-item">
                  {(create.isPending || update.isPending) ? <Spinner className="mr-2" /> : null} Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {q.isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0,1,2,3,4,5].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-card-border"><CardContent className="py-12 text-center text-muted-foreground">Empty fridge — tap "Add item" or "Scan ingredients".</CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((it) => (
            <Card key={it.id} className="border-card-border group" data-testid={`card-item-${it.id}`}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-lg leading-tight" data-testid={`text-item-name-${it.id}`}>{it.name}</span>
                    <Badge variant="outline" className="capitalize text-[10px]">{it.category}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">{it.quantity}</div>
                  {it.expiresAt ? (
                    <div className="text-xs flex items-center gap-1 mt-2 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      Use by {format(new Date(it.expiresAt), "MMM d")} · {formatDistanceToNow(new Date(it.expiresAt), { addSuffix: true })}
                    </div>
                  ) : null}
                  {it.notes ? <div className="text-xs text-muted-foreground mt-1">{it.notes}</div> : null}
                </div>
                <div className="flex flex-col gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(it)} data-testid={`button-edit-${it.id}`}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(it.id)} disabled={del.isPending} data-testid={`button-delete-${it.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
