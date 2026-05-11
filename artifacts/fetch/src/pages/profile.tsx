import { useEffect, useState, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProfile,
  getGetProfileQueryKey,
  useUpdateProfile,
  getGetHomeSuggestionsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LogOut, X } from "lucide-react";

const DIETS = ["omnivore", "vegetarian", "vegan", "pescatarian", "keto", "paleo", "gluten-free"];

function TagInput({
  label, values, onChange, placeholder, testId,
}: { label: string; values: string[]; onChange: (next: string[]) => void; placeholder: string; testId: string }) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    }
  }
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 flex flex-wrap gap-1.5 p-2 rounded-lg border border-input bg-background min-h-[2.75rem]">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1" data-testid={`${testId}-${v}`}>
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[8rem] bg-transparent outline-none text-sm"
          data-testid={`input-${testId}`}
        />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const q = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });
  const update = useUpdateProfile();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [dietaryStyle, setDietaryStyle] = useState("omnivore");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [cuisinePreferences, setCuisinePreferences] = useState<string[]>([]);
  const [healthGoals, setHealthGoals] = useState("");
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState<string>("");

  useEffect(() => {
    if (q.data) {
      setDisplayName(q.data.displayName ?? "");
      setDietaryStyle(q.data.dietaryStyle ?? "omnivore");
      setAllergies(q.data.allergies ?? []);
      setDislikes(q.data.dislikes ?? []);
      setCuisinePreferences(q.data.cuisinePreferences ?? []);
      setHealthGoals(q.data.healthGoals ?? "");
      setDailyCalorieTarget(q.data.dailyCalorieTarget != null ? String(q.data.dailyCalorieTarget) : "");
    }
  }, [q.data]);

  function save() {
    const target = dailyCalorieTarget.trim() === "" ? null : Math.max(0, Math.round(Number(dailyCalorieTarget) || 0));
    update.mutate(
      {
        data: {
          displayName: displayName || null,
          dietaryStyle,
          allergies,
          dislikes,
          cuisinePreferences,
          healthGoals: healthGoals || null,
          dailyCalorieTarget: target,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          qc.invalidateQueries({ queryKey: getGetHomeSuggestionsQueryKey() });
          toast({ title: "Saved" });
        },
        onError: (err: unknown) => toast({ title: "Couldn't save", description: err instanceof Error ? err.message : String(err), variant: "destructive" }),
      },
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="font-serif text-3xl tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">The more we know, the smarter your suggestions.</p>
      </header>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground" data-testid="text-account-email">{user?.email ?? "—"}</div>
          <Button variant="outline" onClick={logout} className="rounded-full" data-testid="button-sign-out">
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {q.isLoading ? <Skeleton className="h-64" /> : (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dn">Display name</Label>
                  <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1.5" data-testid="input-display-name" />
                </div>
                <div>
                  <Label htmlFor="ds">Dietary style</Label>
                  <Select value={dietaryStyle} onValueChange={setDietaryStyle}>
                    <SelectTrigger className="mt-1.5" data-testid="select-diet"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIETS.map((d) => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <TagInput label="Allergies" values={allergies} onChange={setAllergies} placeholder="add allergens (e.g. peanuts) and press Enter" testId="allergy" />
              <TagInput label="Dislikes" values={dislikes} onChange={setDislikes} placeholder="foods you'd rather skip" testId="dislike" />
              <TagInput label="Favourite cuisines" values={cuisinePreferences} onChange={setCuisinePreferences} placeholder="italian, japanese, levantine…" testId="cuisine" />
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cal">Daily calorie target</Label>
                  <Input id="cal" type="number" min={0} value={dailyCalorieTarget} onChange={(e) => setDailyCalorieTarget(e.target.value)} className="mt-1.5" placeholder="e.g. 2200" data-testid="input-calorie-target" />
                </div>
              </div>
              <div>
                <Label htmlFor="goals">Health goals</Label>
                <Textarea id="goals" rows={3} value={healthGoals} onChange={(e) => setHealthGoals(e.target.value)} placeholder="e.g. more protein, less added sugar, eat more plants" className="mt-1.5" data-testid="input-goals" />
              </div>
              <Button onClick={save} disabled={update.isPending} className="rounded-full" data-testid="button-save-profile">
                {update.isPending ? <><Spinner className="mr-2" /> Saving…</> : "Save preferences"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
