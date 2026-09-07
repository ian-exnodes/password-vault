import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { sessions, users, type schema } from "@/lib/server/db/schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

const SESSION_COOKIE = "__Host-vault_session";
const CSRF_COOKIE = "__Host-vault_csrf";
const SESSION_BYTES = 32;
const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;

type SessionDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function randomToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(SESSION_BYTES)));
}

async function tokenHash(token: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
}

function cookieValue(request: Request, name: string): string | null {
  const entry = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

function sameValue(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class SessionAuthError extends Error {
  constructor(readonly status: 401 | 403, message: string) { super(message); }
}

export interface AuthenticatedSession {
  id: string;
  userId: string;
  csrfTokenHash: string;
}

export class SessionService {
  constructor(private readonly db: SessionDatabase) {}

  async issue(userId: string, deviceName: string, now = new Date()): Promise<{ sessionCookie: string; csrfCookie: string; csrfToken: string }> {
    const sessionToken = randomToken();
    const csrfToken = randomToken();
    const expiresAt = new Date(now.getTime() + ABSOLUTE_MS);
    await this.db.insert(sessions).values({
      userId, deviceName: deviceName.slice(0, 120), tokenHash: await tokenHash(sessionToken), csrfTokenHash: await tokenHash(csrfToken),
      idleExpiresAt: new Date(now.getTime() + IDLE_MS), expiresAt, lastSeenAt: now,
    });
    const common = "Path=/; Secure; SameSite=Strict";
    return {
      sessionCookie: `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; ${common}; HttpOnly; Max-Age=${Math.floor(ABSOLUTE_MS / 1000)}`,
      csrfCookie: `${CSRF_COOKIE}=${encodeURIComponent(csrfToken)}; ${common}; Max-Age=${Math.floor(ABSOLUTE_MS / 1000)}`,
      csrfToken,
    };
  }

  async authenticate(request: Request, requireCsrf = false, now = new Date()): Promise<AuthenticatedSession> {
    const rawToken = cookieValue(request, SESSION_COOKIE);
    if (!rawToken) throw new SessionAuthError(401, "Authentication required");
    const [session] = await this.db.select({ id: sessions.id, userId: sessions.userId, csrfTokenHash: sessions.csrfTokenHash })
      .from(sessions).innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, await tokenHash(rawToken)), eq(users.status, "enabled"), isNull(sessions.revokedAt), gt(sessions.expiresAt, now), gt(sessions.idleExpiresAt, now))).limit(1);
    if (!session) throw new SessionAuthError(401, "Authentication required");
    if (requireCsrf) {
      const origin = request.headers.get("origin");
      if (!origin || origin !== new URL(request.url).origin) throw new SessionAuthError(403, "Invalid request origin");
      const csrfCookie = cookieValue(request, CSRF_COOKIE);
      const csrfHeader = request.headers.get("x-csrf-token");
      if (!csrfCookie || !csrfHeader || !sameValue(csrfCookie, csrfHeader) || !sameValue(await tokenHash(csrfHeader), session.csrfTokenHash)) {
        throw new SessionAuthError(403, "Invalid CSRF proof");
      }
    }
    await this.db.update(sessions).set({ lastSeenAt: now, idleExpiresAt: new Date(now.getTime() + IDLE_MS) })
      .where(and(eq(sessions.id, session.id), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)));
    return session;
  }

  async listDevices(ownerId: string) {
    return this.db.select({ id: sessions.id, deviceName: sessions.deviceName, lastSeenAt: sessions.lastSeenAt, expiresAt: sessions.expiresAt, revokedAt: sessions.revokedAt })
      .from(sessions).where(eq(sessions.userId, ownerId)).orderBy(sql`${sessions.lastSeenAt} desc`);
  }

  async revoke(ownerId: string, sessionId: string, now = new Date()): Promise<boolean> {
    const revoked = await this.db.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.id, sessionId), eq(sessions.userId, ownerId), isNull(sessions.revokedAt))).returning({ id: sessions.id });
    return revoked.length === 1;
  }
}

export const sessionCookieNames = { session: SESSION_COOKIE, csrf: CSRF_COOKIE } as const;
