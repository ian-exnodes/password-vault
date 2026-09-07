import { getDatabase } from "@/lib/server/db/client";
import { SessionAuthError, SessionService } from "@/lib/server/auth/session";

const responseHeaders = { "Cache-Control": "no-store", "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: responseHeaders });

let service: SessionService | null = null;
function sessions() { return service ??= new SessionService(getDatabase()); }

async function run(action: () => Promise<Response>): Promise<Response> {
  try { return await action(); }
  catch (error) {
    if (error instanceof SessionAuthError) return json({ error: error.message }, error.status);
    return json({ error: "Request failed" }, 500);
  }
}

export function listSessionDevices(request: Request) {
  return run(async () => {
    const authenticated = await sessions().authenticate(request);
    return json({ sessions: await sessions().listDevices(authenticated.userId) });
  });
}

export function revokeSessionDevice(request: Request, sessionId: string) {
  return run(async () => {
    const authenticated = await sessions().authenticate(request, true);
    return await sessions().revoke(authenticated.userId, sessionId)
      ? new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } })
      : json({ error: "Not found" }, 404);
  });
}
