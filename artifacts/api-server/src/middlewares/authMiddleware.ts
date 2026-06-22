import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import {
  clearSession,
  getSessionId,
  getSession,
  updateSession,
  type SessionData,
} from "../lib/auth";
import { DEV_AUTH_ENABLED, getDevUser } from "../lib/devAuth";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  // Dev bypass: every request is authenticated as the local dev user.
  if (DEV_AUTH_ENABLED) {
    req.user = await getDevUser();
    next();
    return;
  }

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const session = await getSession(sid);
  if (!session?.user?.id) {
    await clearSession(res, sid);
    next();
    return;
  }

  // Token refresh is Replit-OIDC specific; skip it in dev mode.
  req.user = session.user;
  void refreshAndPersist(sid, session).catch(() => {
    /* best-effort; not used in dev */
  });
  next();
}

async function refreshAndPersist(
  _sid: string,
  _session: SessionData,
): Promise<void> {
  // Placeholder for production token-refresh logic. In Replit mode the
  // middleware would call refreshTokenGrant here; in local dev we skip it
  // because the OIDC client is never configured.
  return;
}

// Re-export so existing call sites (e.g. logout) still work.
export { updateSession };
