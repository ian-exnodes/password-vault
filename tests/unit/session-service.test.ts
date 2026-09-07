// @vitest-environment node

import { describe, expect, it } from "vitest";
import { users } from "@/lib/server/db/schema";
import { SessionAuthError, SessionService, sessionCookieNames } from "@/lib/server/auth/session";
import { testDatabase } from "@/tests/helpers/postgres";

const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";

function pair(setCookie: string): string { return setCookie.split(";", 1)[0]; }

describe("SessionService", () => {
  it("issues opaque cookies with secure production attributes and stores no raw token", async () => {
    const { client, db } = await testDatabase();
    await db.insert(users).values({ id: USER_A, email: "a@example.test" });
    const service = new SessionService(db);
    const issued = await service.issue(USER_A, "iPhone");
    expect(issued.sessionCookie).toContain(`${sessionCookieNames.session}=`);
    expect(issued.sessionCookie).toMatch(/Path=\/; Secure; SameSite=Strict; HttpOnly/);
    expect(issued.csrfCookie).toMatch(/Path=\/; Secure; SameSite=Strict/);
    expect(issued.csrfCookie).not.toContain("HttpOnly");
    const rows = await client.query<{ token_hash: string; csrf_token_hash: string }>("select token_hash, csrf_token_hash from sessions");
    expect(JSON.stringify(rows.rows)).not.toContain(issued.csrfToken);
    expect(JSON.stringify(rows.rows)).not.toContain(pair(issued.sessionCookie).split("=")[1]);
  });

  it("authenticates an active session and requires same-origin CSRF proof for mutations", async () => {
    const { db } = await testDatabase();
    await db.insert(users).values({ id: USER_A, email: "a@example.test" });
    const service = new SessionService(db);
    const issued = await service.issue(USER_A, "Android");
    const cookies = `${pair(issued.sessionCookie)}; ${pair(issued.csrfCookie)}`;
    await expect(service.authenticate(new Request("https://vault.example/api", { headers: { cookie: cookies } }))).resolves.toMatchObject({ userId: USER_A });
    await expect(service.authenticate(new Request("https://vault.example/api", { method: "POST", headers: { cookie: cookies } }), true)).rejects.toMatchObject({ status: 403 });
    await expect(service.authenticate(new Request("https://vault.example/api", { method: "POST", headers: { cookie: cookies, origin: "https://evil.example", "x-csrf-token": issued.csrfToken } }), true)).rejects.toMatchObject({ status: 403 });
    await expect(service.authenticate(new Request("https://vault.example/api", { method: "POST", headers: { cookie: cookies, origin: "https://vault.example", "x-csrf-token": issued.csrfToken } }), true)).resolves.toMatchObject({ userId: USER_A });
  });

  it("rejects expired and revoked sessions without disclosing which condition failed", async () => {
    const { db } = await testDatabase();
    await db.insert(users).values({ id: USER_A, email: "a@example.test" });
    const service = new SessionService(db);
    const issued = await service.issue(USER_A, "Laptop", new Date("2026-01-01T00:00:00Z"));
    const request = new Request("https://vault.example/api", { headers: { cookie: pair(issued.sessionCookie) } });
    await expect(service.authenticate(request, false, new Date("2027-01-01T00:00:00Z"))).rejects.toEqual(new SessionAuthError(401, "Authentication required"));
  });

  it("lists and revokes devices only for their owner", async () => {
    const { db } = await testDatabase();
    await db.insert(users).values([{ id: USER_A, email: "a@example.test" }, { id: USER_B, email: "b@example.test" }]);
    const service = new SessionService(db);
    await service.issue(USER_A, "Phone");
    await service.issue(USER_B, "Other phone");
    const devices = await service.listDevices(USER_A);
    expect(devices).toHaveLength(1);
    await expect(service.revoke(USER_B, devices[0].id)).resolves.toBe(false);
    await expect(service.revoke(USER_A, devices[0].id)).resolves.toBe(true);
  });
});
