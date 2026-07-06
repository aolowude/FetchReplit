import { useState, useEffect, useCallback } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

// In dev mode the API is configured to authenticate every request as a
// single hard-coded user (DEV_AUTH=1). To keep the React tree unaware of
// that, we mirror the same flag here: when set, useAuth reports a logged-in
// dev user immediately and the Login button just navigates home.
const DEV_AUTH = import.meta.env["VITE_DEV_AUTH"] === "1";

const DEV_USER: AuthUser = {
  id: "dev-user-local",
  email: "dev@fetch.local",
  firstName: "Dev",
  lastName: "User",
  profileImageUrl: null,
};

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(DEV_AUTH ? DEV_USER : null);
  const [isLoading, setIsLoading] = useState(!DEV_AUTH);

  useEffect(() => {
    if (DEV_AUTH) {
      // No need to hit the API — server treats every request as this user.
      return;
    }
    let cancelled = false;

    fetch("/api/auth/user", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ user: AuthUser | null }>;
      })
      .then((data) => {
        if (!cancelled) {
          setUser(data.user ?? null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    const base = import.meta.env.BASE_URL.replace(/\/+$/, "") || "/";
    if (DEV_AUTH) {
      window.location.href = base || "/";
      return;
    }
    window.location.href = `/api/login?returnTo=${encodeURIComponent(base)}`;
  }, []);

  const logout = useCallback(() => {
    if (DEV_AUTH) {
      // No real session to clear; just go to login.
      window.location.href = "/login";
      return;
    }
    window.location.href = "/api/logout";
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
