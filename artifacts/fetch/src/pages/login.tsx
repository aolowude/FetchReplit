import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate("/");
  }, [isLoading, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 w-[26rem] h-[26rem] rounded-full bg-secondary/25 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-accent/40 blur-3xl" />
      </div>
      <div className="min-h-screen w-full grid place-items-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-card-border bg-card/80 backdrop-blur-xl shadow-xl p-8 md:p-10">
            <div className="flex items-center gap-3 mb-8">
              <span className="grid place-items-center w-12 h-12 rounded-2xl bg-primary text-primary-foreground font-serif text-xl font-semibold shadow-md">
                F
              </span>
              <div>
                <div className="font-serif text-2xl tracking-tight">Fetch</div>
                <div className="text-xs text-muted-foreground">your pocket nutritionist</div>
              </div>
            </div>
            <h1 className="font-serif text-3xl md:text-4xl leading-tight">
              Eat well, without the spreadsheet.
            </h1>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Snap any meal for instant macros, keep a living MyFridge, and get warm,
              personal suggestions for what to make next.
            </p>
            <Button
              size="lg"
              className="mt-8 w-full rounded-full text-base h-12"
              onClick={login}
              disabled={isLoading}
              data-testid="button-sign-in"
            >
              {isLoading ? <Spinner className="mr-2" /> : null}
              Sign in to continue
            </Button>
            <p className="mt-4 text-xs text-muted-foreground text-center">
              We remember preferences, allergies and goals — never your raw photos beyond what you save.
            </p>
          </div>
          <ul className="mt-8 grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
            <li className="rounded-2xl bg-muted/50 px-3 py-3">Vision-powered scans</li>
            <li className="rounded-2xl bg-muted/50 px-3 py-3">Smart fridge recipes</li>
            <li className="rounded-2xl bg-muted/50 px-3 py-3">Memory that grows</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
