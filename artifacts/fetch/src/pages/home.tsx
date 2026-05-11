import { Link } from "wouter";
import {
  useGetHomeSummary,
  getGetHomeSummaryQueryKey,
  useGetHomeSuggestions,
  getGetHomeSuggestionsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Camera, Sparkles, Refrigerator, Clock, ChevronRight } from "lucide-react";
import { HealthRing } from "@/components/health-ring";
import { formatDistanceToNow } from "date-fns";

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
  const summary = summaryQ.data;
  const suggestions = sugQ.data ?? [];
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
              Add a few items to <Link href="/fridge" className="underline">MyFridge</Link> or save preferences in <Link href="/profile" className="underline">Profile</Link> for smarter suggestions.
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

      <section className="grid md:grid-cols-2 gap-5">
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
                {summary!.recentScans.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors" data-testid={`row-scan-${s.id}`}>
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0">
                      {s.imageDataUrl ? <img src={s.imageDataUrl} alt={s.foodName} className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate" data-testid={`text-scan-name-${s.id}`}>{s.foodName}</div>
                      <div className="text-xs text-muted-foreground">{s.calories} kcal · {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}</div>
                    </div>
                    <HealthRing score={s.healthScore} size={42} strokeWidth={4} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-serif text-xl flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Use it soon
            </CardTitle>
            <Link href="/fridge" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center">
              MyFridge <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {summaryQ.isLoading ? (
              <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : (summary?.expiringItems?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-3">Nothing expiring this week.</p>
            ) : (
              <ul className="space-y-2">
                {summary!.expiringItems.map((it) => (
                  <li key={it.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50" data-testid={`row-expiring-${it.id}`}>
                    <div>
                      <div className="font-medium">{it.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{it.category} · {it.quantity}</div>
                    </div>
                    {it.expiresAt ? (
                      <Badge variant="outline" className="text-xs">
                        {formatDistanceToNow(new Date(it.expiresAt), { addSuffix: true })}
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
