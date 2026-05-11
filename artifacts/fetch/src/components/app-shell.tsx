import { Link, useLocation } from "wouter";
import { Home, Camera, Refrigerator, History, User, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home, testId: "nav-home" },
  { to: "/scan", label: "Scan", icon: Camera, testId: "nav-scan" },
  { to: "/fridge", label: "Fridge", icon: Refrigerator, testId: "nav-fridge" },
  { to: "/history", label: "History", icon: History, testId: "nav-history" },
  { to: "/memory", label: "Memory", icon: Brain, testId: "nav-memory" },
  { to: "/profile", label: "Profile", icon: User, testId: "nav-profile" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border/60">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" data-testid="link-home-brand" className="flex items-center gap-2">
            <span className="grid place-items-center w-9 h-9 rounded-2xl bg-primary text-primary-foreground font-serif text-lg font-semibold shadow-md">F</span>
            <span className="font-serif text-xl tracking-tight">Fetch</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = location === n.to;
              return (
                <Link
                  key={n.to}
                  href={n.to}
                  data-testid={n.testId}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-colors",
                    active
                      ? "bg-primary/12 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-5 pt-6 pb-28 md:pb-12">{children}</main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl bg-background/85 border-t border-border/60 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-6 max-w-md mx-auto">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = location === n.to;
            return (
              <Link
                key={n.to}
                href={n.to}
                data-testid={`${n.testId}-mobile`}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="w-5 h-5" />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
