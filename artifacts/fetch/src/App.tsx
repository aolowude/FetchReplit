import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { AppShell } from "@/components/app-shell";
import HomePage from "@/pages/home";
import ScanPage from "@/pages/scan";
import HistoryPage from "@/pages/history";
import FridgePage from "@/pages/fridge";
import ProfilePage from "@/pages/profile";
import MemoryPage from "@/pages/memory";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/login");
  }, [isLoading, isAuthenticated, navigate]);
  if (isLoading) {
    return (
      <div className="min-h-screen w-full grid place-items-center bg-background">
        <Spinner className="text-primary" />
      </div>
    );
  }
  if (!isAuthenticated) return null;
  return <AppShell>{children}</AppShell>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/" >
        <Protected><HomePage /></Protected>
      </Route>
      <Route path="/scan">
        <Protected><ScanPage /></Protected>
      </Route>
      <Route path="/history">
        <Protected><HistoryPage /></Protected>
      </Route>
      <Route path="/fridge">
        <Protected><FridgePage /></Protected>
      </Route>
      <Route path="/profile">
        <Protected><ProfilePage /></Protected>
      </Route>
      <Route path="/memory">
        <Protected><MemoryPage /></Protected>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
