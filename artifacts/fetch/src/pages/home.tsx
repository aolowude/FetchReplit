import { Link } from "wouter";
import {
  useGetHomeSummary,
  getGetHomeSummaryQueryKey,
  useGetHomeSuggestions,
  getGetHomeSuggestionsQueryKey,
  useGetHomeRecipes,
  getGetHomeRecipesQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Camera, Sparkles, Refrigerator, Clock, ChevronRight, ChefHat } from "lucide-react";
import { HealthRing } from "@/components/health-ring";
import { formatDistanceToNow } from "date-fns";
import { objectPathToUrl } from "@/lib/image";

function MacroBar({ label, value, max, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = max && max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-sm font-medium" data-testid={`text-macro-${label.toLowerCase()}`}>
          {Math.round(value)}{max ? ` / ${max}` : "g"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct || (value > 0 ? 12 : 0)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const summaryQ = useGetHomeSummary({ query: { queryKey: getGetHomeSummaryQueryKey() } });
  const sugQ = useGetHomeSuggestions({ query: { queryKey: getGetHomeSuggestionsQueryKey() } });
  const recipeQ = useGetHomeRecipes({ query: { queryKey: getGetHomeRecipesQueryKey() } });
  const summary = summaryQ.data;
  const suggestions = sugQ.data ?? [];
  const recipes = recipeQ.data ?? [];
  const expiring = summary?.expiringItems ?? [];
  const greetingName = user?.firstName || (user?.email ? user.email.split("@")[0] : "friend");

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="font-serif text-3xl md:text-4xl tracking-tight" data-testid="text-greeting">
          Hello, {greetingName}.
        </h1>
        <p className="text-muted-foreground mt-1">Here's what your day is looking like.</p>
      </section>

      <Card className="overflow-hidden border-card-border">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-xl">Today</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryQ.isLoading ? (
            <div className="grid md:grid-cols-2 gap-6">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Calories</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-serif text-4xl tracking-tight" data-testid="text-today-calories">
                    {summary?.todayCalories ?? 0}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {summary?.calorieTarget ? `of ${summary.calorieTarget} kcal` : "kcal eaten"}
                  </span>
                </div>
                {summary?.calorieTarget ? (
                  <div className="mt-4 h-2 rounded-full bg-muted/70 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(100, ((summary.todayCalories ?? 0) / summary.calorieTarget) * 100)}%`,
                      }}
                    />
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-muted-foreground">
                    <Link href="/profile" className="underline-offset-2 hover:underline">
                      Set a daily target
                    </Link>{" "}
                    to track progress.
                  </div>
                )}
              </div>
              <div className="rounded-2xl bg-card border border-card-border p-5 space-y-4">
                <MacroBar label="Protein" value={summary?.todayProtein ?? 0} color="hsl(var(--secondary))" />
                <MacroBar label="Carbs" value={summary?.todayCarbs ?? 0} color="hsl(var(--chart-3))" />
                <MacroBar label="Fat" value={summary?.todayFat ?? 0} color="hsl(var(--chart-4))" />
              </div>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild className="rounded-full" data-testid="button-scan-cta">
              <Link href="/scan"><Camera className="w-4 h-4 mr-2" />Scan a meal</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/fridge"><Refrigerator className="w-4 h-4 mr-2" />MyFridge ({summary?.fridgeItemCount ?? 0})</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <section data-testid="section-ingredient-carousel">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif text-2xl tracking-tight flex items-center gap-2">
            <Refrigerator className="w-5 h-5 text-primary" /> Use these soon
          </h2>
          <Link href="/fridge" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center">
            MyFridge <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {summaryQ.isLoading ? (
          <div className="flex gap-3 overflow-hidden">
            {[0,1,2,3].map((i) => <Skeleton key={i} className="h-28 w-44 rounded-2xl shrink-0" />)}
          </div>
        ) : expiring.length === 0 ? (
          <Card className="border-card-border">
            <CardContent className="py-6 text-sm text-muted-foreground">
              Nothing in your fridge needs urgent attention. <Link href="/fridge" className="underline">Add ingredients</Link> to see ideas tailored to what you have.
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory" data-testid="ingredient-carousel">
            {expiring.map((it) => {
              const days = it.expiresAt
                ? Math.max(0, Math.round((new Date(it.expiresAt).getTime() - Date.now()) / 86400000))
                : null;
              const urgency = days != null && days <= 1 ? "border-destructive/40 bg-destructive/5" : days != null && days <= 3 ? "border-amber-500/40 bg-amber-500/5" : "border-card-border bg-card";
              return (
                <div
                  key={it.id}
                  className={`shrink-0 w-44 snap-start rounded-2xl border p-4 flex flex-col gap-1.5 ${urgency}`}
                  data-testid={`ingredient-card-${it.id}`}
                >
                  <div className="text-xs uppercase tracking-wider text-muted-foreground capitalize">{it.category}</div>
                  <div className="font-serif text-lg leading-tight truncate">{it.name}</div>
                  <div className="text-xs text-muted-foreground">{it.quantity}</div>
                  {it.expiresAt ? (
                    <Badge variant="outline" className="self-start mt-auto text-[10px]">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDistanceToNow(new Date(it.expiresAt), { addSuffix: true })}
                    </Badge>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section data-testid="section-recipe-recommendations">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif text-2xl tracking-tight flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-primary" /> Recipes for what you have
          </h2>
          {recipeQ.isFetching ? <span className="text-xs text-muted-foreground">cooking up ideas…</span> : null}
        </div>
        {recipeQ.isLoading ? (
          <div className="grid md:grid-cols-3 gap-3">
            {[0,1,2].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : recipeQ.isError ? (
          <Card className="border-card-border"><CardContent className="py-6 text-sm text-muted-foreground">Couldn't reach the chef right now. Try again in a moment.</CardContent></Card>
        ) : recipes.length === 0 ? (
          <Card className="border-card-border">
            <CardContent className="py-6 text-sm text-muted-foreground">
              Add a few items to <Link href="/fridge" className="underline">MyFridge</Link> and we'll cook up personalised recipe ideas.
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {recipes.map((r) => (
              <Card key={r.id} className="border-card-border hover:shadow-md transition-shadow" data-testid={`recipe-card-${r.id}`}>
                <CardContent className="p-4 flex flex-col h-full">
                  <div className="font-serif text-lg leading-snug">{r.title}</div>
                  <p className="text-xs text-muted-foreground mt-1 flex-1">{r.reason}</p>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{r.minutes} min</span>
                    <span>{r.usedIngredients.length} from fridge</span>
                  </div>
                  {r.usedIngredients.length ? (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {r.usedIngredients.slice(0, 4).map((ing) => (
                        <Badge key={ing} variant="secondary" className="text-[10px]">{ing}</Badge>
                      ))}
                    </div>
                  ) : null}
                  {r.missingIngredients.length ? (
                    <div className="mt-1.5 text-[11px] text-muted-foreground">
                      Plus: {r.missingIngredients.slice(0, 3).join(", ")}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif text-2xl tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> For you, right now
          </h2>
          {sugQ.isFetching ? <span className="text-xs text-muted-foreground">refreshing…</span> : null}
        </div>
        {sugQ.isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
        ) : sugQ.isError ? (
          <Card className="border-card-border"><CardContent className="py-6 text-sm text-muted-foreground">Couldn't reach the chef right now. Try again in a moment.</CardContent></Card>
        ) : suggestions.length === 0 ? (
          <Card className="border-card-border">
            <CardContent className="py-6 text-sm text-muted-foreground">
              Save preferences in <Link href="/profile" className="underline">Profile</Link> for smarter suggestions.
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {suggestions.map((s) => (
              <Card
                key={s.id}
                className="border-card-border hover:shadow-md transition-shadow"
                data-testid={`card-suggestion-${s.id}`}
              >
                <CardContent className="p-4 flex flex-col h-full">
                  <Badge variant="secondary" className="self-start mb-2 capitalize">{s.kind}</Badge>
                  <div className="font-serif text-lg leading-snug" data-testid={`text-suggestion-title-${s.id}`}>{s.title}</div>
                  <p className="text-sm text-muted-foreground mt-1 flex-1">{s.reason}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{s.estimatedCalories} kcal</span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {s.tags.slice(0, 2).map((t) => <span key={t} className="px-2 py-0.5 rounded-full bg-muted">{t}</span>)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-serif text-xl">Recent scans</CardTitle>
            <Link href="/history" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center" data-testid="link-history">
              All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {summaryQ.isLoading ? (
              <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
            ) : (summary?.recentScans?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-3">No scans yet. <Link href="/scan" className="underline">Try one now.</Link></p>
            ) : (
              <ul className="space-y-2">
                {summary!.recentScans.map((s) => {
                  const url = objectPathToUrl(s.imageObjectPath);
                  return (
                    <li key={s.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors" data-testid={`row-scan-${s.id}`}>
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0">
                        {url ? <img src={url} alt={s.foodName} className="w-full h-full object-cover" loading="lazy" /> : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" data-testid={`text-scan-name-${s.id}`}>{s.foodName}</div>
                        <div className="text-xs text-muted-foreground">{s.calories} kcal · {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}</div>
                      </div>
                      <HealthRing score={s.healthScore} size={42} strokeWidth={4} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
