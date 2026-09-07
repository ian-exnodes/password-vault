import { deleteItemSchema, encryptedItemSchema, updateItemSchema } from "@/lib/server/vault/http-schema";
import type { VaultRepository } from "@/lib/server/vault/repository";
import { SessionAuthError, type SessionService } from "@/lib/server/auth/session";
import type { RateLimiter } from "@/lib/server/security/rate-limit";

const headers = { "Cache-Control": "no-store", "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

function envelope(item: Awaited<ReturnType<VaultRepository["getItem"]>> & {}) {
  if (!item) return null;
  return { format: "password-vault-item", version: 1, vaultId: item.vaultId, itemId: item.id, revision: item.revision, cipher: { name: "aes-256-gcm", nonce: item.nonce, tagBits: 128 }, ciphertext: item.ciphertext } as const;
}

async function body(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 1_500_000) throw new SyntaxError("Request body too large");
  return request.json();
}

export class VaultHttpApi {
  constructor(private readonly repository: VaultRepository, private readonly sessions: SessionService, private readonly rateLimiter?: RateLimiter) {}

  private async allowMutation(userId: string): Promise<Response | null> {
    if (this.rateLimiter && !await this.rateLimiter.consume(userId, "vault-mutation")) return json({ error: "Too many requests" }, 429);
    return null;
  }

  private async run(action: () => Promise<Response>): Promise<Response> {
    try { return await action(); }
    catch (error) {
      if (error instanceof SessionAuthError) return json({ error: error.message }, error.status);
      if (error instanceof SyntaxError) return json({ error: "Invalid request body" }, 400);
      return json({ error: "Request failed" }, 500);
    }
  }

  list(request: Request) { return this.run(async () => {
    const session = await this.sessions.authenticate(request);
    return json({ items: (await this.repository.listItems(session.userId)).map(envelope) });
  }); }

  get(request: Request, itemId: string) { return this.run(async () => {
    const session = await this.sessions.authenticate(request);
    const item = await this.repository.getItem(session.userId, itemId);
    return item ? json({ item: envelope(item) }) : json({ error: "Not found" }, 404);
  }); }

  create(request: Request) { return this.run(async () => {
    const session = await this.sessions.authenticate(request, true);
    const limited = await this.allowMutation(session.userId); if (limited) return limited;
    const parsed = encryptedItemSchema.safeParse(await body(request));
    if (!parsed.success || parsed.data.revision !== 1) return json({ error: "Invalid encrypted item" }, 400);
    const value = parsed.data;
    const created = await this.repository.createItem(session.userId, value.vaultId, { id: value.itemId, ciphertext: value.ciphertext, nonce: value.cipher.nonce, cryptoVersion: value.version, revision: value.revision });
    return created ? json({ item: envelope(created) }, 201) : json({ error: "Not found" }, 404);
  }); }

  update(request: Request, itemId: string) { return this.run(async () => {
    const session = await this.sessions.authenticate(request, true);
    const limited = await this.allowMutation(session.userId); if (limited) return limited;
    const parsed = updateItemSchema.safeParse(await body(request));
    if (!parsed.success || parsed.data.item.itemId !== itemId) return json({ error: "Invalid encrypted item" }, 400);
    const value = parsed.data;
    const result = await this.repository.updateItem(session.userId, itemId, value.expectedRevision, { ciphertext: value.item.ciphertext, nonce: value.item.cipher.nonce, cryptoVersion: value.item.version });
    if (result.status === "not_found") return json({ error: "Not found" }, 404);
    if (result.status === "conflict") return json({ error: "Revision conflict" }, 409);
    return json({ item: envelope(result.item) });
  }); }

  delete(request: Request, itemId: string) { return this.run(async () => {
    const session = await this.sessions.authenticate(request, true);
    const limited = await this.allowMutation(session.userId); if (limited) return limited;
    const parsed = deleteItemSchema.safeParse(await body(request));
    if (!parsed.success) return json({ error: "Invalid revision" }, 400);
    const result = await this.repository.deleteItem(session.userId, itemId, parsed.data.expectedRevision);
    if (result.status === "not_found") return json({ error: "Not found" }, 404);
    if (result.status === "conflict") return json({ error: "Revision conflict" }, 409);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }); }
}
