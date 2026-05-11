import { useEffect, useState, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProfile,
  getGetProfileQueryKey,
  useUpdateProfile,
  getGetHomeSuggestionsQueryKey,
  type AllergenSeverity,
  type AllergyEntry,
  type CookingSkill,
  type HealthGoal,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LogOut, X, Brain } from "lucide-react";
import { MemoryPanel } from "@/components/memory-panel";

const DIETS = ["omnivore", "vegetarian", "vegan", "pescatarian", "keto", "paleo", "gluten-free"];
const SEVERITIES: { value: AllergenSeverity; label: string; tone: string }[] = [
  { value: "mild", label: "Mild", tone: "bg-secondary/40" },
  { value: "moderate", label: "Moderate", tone: "bg-amber-500/20" },
  { value: "severe", label: "Severe", tone: "bg-destructive/30" },
];
const HEALTH_GOAL_OPTIONS: { value: HealthGoal; label: string }[] = [
  { value: "lose_weight", label: "Lose weight" },
  { value: "gain_muscle", label: "Gain muscle" },
  { value: "more_protein", label: "Eat more protein" },
  { value: "less_sugar", label: "Less added sugar" },
  { value: "more_plants", label: "More plants" },
  { value: "more_fiber", label: "More fiber" },
  { value: "balanced_macros", label: "Balanced macros" },
  { value: "manage_blood_sugar", label: "Manage blood sugar" },
  { value: "heart_health", label: "Heart health" },
];
const SKILLS: { value: CookingSkill; label: string }[] = [
  { value: "beginner", label: "Beginner — quick basics" },
  { value: "intermediate", label: "Intermediate — comfortable in the kitchen" },
  { value: "advanced", label: "Advanced — anything goes" },
];

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

function AllergyEditor({
  values, onChange,
}: { values: AllergyEntry[]; onChange: (next: AllergyEntry[]) => void }) {
  const [draft, setDraft] = useState("");
  const [draftSev, setDraftSev] = useState<AllergenSeverity>("moderate");
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (values.some((a) => a.name.toLowerCase() === v.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...values, { name: v, severity: draftSev }]);
    setDraft("");
  }
  function setSeverity(name: string, severity: AllergenSeverity) {
    onChange(values.map((a) => (a.name === name ? { ...a, severity } : a)));
  }
  function remove(name: string) {
    onChange(values.filter((a) => a.name !== name));
  }
  return (
    <div>
      <Label>Allergies</Label>
      <p className="text-xs text-muted-foreground mt-1">Add each allergen and tell us how serious a reaction is — we surface severe ones first in scan warnings.</p>
      <div className="mt-2 space-y-2">
        {values.map((a) => (
          <div key={a.name} className="flex items-center gap-2 p-2 rounded-lg border border-input bg-background" data-testid={`row-allergy-${a.name}`}>
            <span className="font-medium text-sm flex-1 capitalize">{a.name}</span>
            <Select value={a.severity} onValueChange={(v) => setSeverity(a.name, v as AllergenSeverity)}>
              <SelectTrigger className="w-32" data-testid={`select-severity-${a.name}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => remove(a.name)} aria-label={`Remove ${a.name}`}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          placeholder="add allergen (e.g. peanuts)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          data-testid="input-allergy-name"
        />
        <Select value={draftSev} onValueChange={(v) => setDraftSev(v as AllergenSeverity)}>
          <SelectTrigger className="w-36" data-testid="select-allergy-draft-severity"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" onClick={add} className="rounded-full" data-testid="button-add-allergy">Add</Button>
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
  const [allergiesDetailed, setAllergiesDetailed] = useState<AllergyEntry[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [cuisinePreferences, setCuisinePreferences] = useState<string[]>([]);
  const [healthGoals, setHealthGoals] = useState("");
  const [healthGoalsList, setHealthGoalsList] = useState<HealthGoal[]>([]);
  const [cookingSkill, setCookingSkill] = useState<CookingSkill>("beginner");
  const [householdSize, setHouseholdSize] = useState<string>("1");
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState<string>("");

  useEffect(() => {
    if (q.data) {
      setDisplayName(q.data.displayName ?? "");
      setDietaryStyle(q.data.dietaryStyle ?? "omnivore");
      const detailed = q.data.allergiesDetailed ?? [];
      if (detailed.length > 0) {
        setAllergiesDetailed(detailed);
      } else {
        // Migrate legacy flat allergies into detailed shape (default moderate).
        setAllergiesDetailed((q.data.allergies ?? []).map((name) => ({ name, severity: "moderate" as AllergenSeverity })));
      }
      setDislikes(q.data.dislikes ?? []);
      setCuisinePreferences(q.data.cuisinePreferences ?? []);
      setHealthGoals(q.data.healthGoals ?? "");
      setHealthGoalsList(q.data.healthGoalsList ?? []);
      setCookingSkill((q.data.cookingSkill ?? "beginner") as CookingSkill);
      setHouseholdSize(String(q.data.householdSize ?? 1));
      setDailyCalorieTarget(q.data.dailyCalorieTarget != null ? String(q.data.dailyCalorieTarget) : "");
    }
  }, [q.data]);

  function toggleGoal(g: HealthGoal) {
    setHealthGoalsList((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  function save() {
    const target = dailyCalorieTarget.trim() === "" ? null : Math.max(0, Math.round(Number(dailyCalorieTarget) || 0));
    const hh = Math.max(1, Math.round(Number(householdSize) || 1));
    update.mutate(
      {
        data: {
          displayName: displayName || null,
          dietaryStyle,
          allergiesDetailed,
          dislikes,
          cuisinePreferences,
          healthGoals: healthGoals || null,
          healthGoalsList,
          cookingSkill,
          householdSize: hh,
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

              <AllergyEditor values={allergiesDetailed} onChange={setAllergiesDetailed} />

              <TagInput label="Dislikes" values={dislikes} onChange={setDislikes} placeholder="foods you'd rather skip" testId="dislike" />
              <TagInput label="Favourite cuisines" values={cuisinePreferences} onChange={setCuisinePreferences} placeholder="italian, japanese, levantine…" testId="cuisine" />

              <div>
                <Label>Health goals</Label>
                <p className="text-xs text-muted-foreground mt-1">Pick anything that fits — we'll bias suggestions accordingly.</p>
                <div className="mt-2 grid sm:grid-cols-2 gap-2" data-testid="grid-health-goals">
                  {HEALTH_GOAL_OPTIONS.map((g) => {
                    const checked = healthGoalsList.includes(g.value);
                    return (
                      <label
                        key={g.value}
                        className="flex items-center gap-2 p-2 rounded-lg border border-input bg-background cursor-pointer hover:bg-muted/40"
                        data-testid={`checkbox-goal-${g.value}`}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleGoal(g.value)} />
                        <span className="text-sm">{g.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="skill">Cooking skill</Label>
                  <Select value={cookingSkill} onValueChange={(v) => setCookingSkill(v as CookingSkill)}>
                    <SelectTrigger className="mt-1.5" data-testid="select-cooking-skill"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SKILLS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="hh">Household size</Label>
                  <Input id="hh" type="number" min={1} value={householdSize} onChange={(e) => setHouseholdSize(e.target.value)} className="mt-1.5" data-testid="input-household-size" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cal">Daily calorie target</Label>
                  <Input id="cal" type="number" min={0} value={dailyCalorieTarget} onChange={(e) => setDailyCalorieTarget(e.target.value)} className="mt-1.5" placeholder="e.g. 2200" data-testid="input-calorie-target" />
                </div>
              </div>

              <div>
                <Label htmlFor="goals">Notes for the chef</Label>
                <Textarea id="goals" rows={3} value={healthGoals} onChange={(e) => setHealthGoals(e.target.value)} placeholder="anything else we should know — e.g. training for a marathon, low-FODMAP" className="mt-1.5" data-testid="input-goals" />
              </div>

              <Button onClick={save} disabled={update.isPending} className="rounded-full" data-testid="button-save-profile">
                {update.isPending ? <><Spinner className="mr-2" /> Saving…</> : "Save preferences"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="font-serif text-xl flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" /> What Fetch remembers about you
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MemoryPanel />
        </CardContent>
      </Card>
    </div>
  );
}
