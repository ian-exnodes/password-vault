import { and, eq, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { schema, vaultItems, vaults } from "@/lib/server/db/schema";

export type VaultDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface EncryptedItemRecord {
  id: string;
  vaultId: string;
  ciphertext: string;
  nonce: string;
  cryptoVersion: number;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export type UpdateResult = { status: "updated"; item: EncryptedItemRecord } | { status: "conflict" } | { status: "not_found" };

export interface EncryptedVaultExport {
  vault: { id: string; masterEnvelope: unknown; recoveryEnvelope: unknown; cryptoVersion: number };
  items: EncryptedItemRecord[];
}

const itemSelection = {
  id: vaultItems.id,
  vaultId: vaultItems.vaultId,
  ciphertext: vaultItems.ciphertext,
  nonce: vaultItems.nonce,
  cryptoVersion: vaultItems.cryptoVersion,
  revision: vaultItems.revision,
  createdAt: vaultItems.createdAt,
  updatedAt: vaultItems.updatedAt,
};

export class VaultRepository {
  constructor(private readonly db: VaultDatabase) {}

  async listItems(ownerId: string): Promise<EncryptedItemRecord[]> {
    return this.db.select(itemSelection).from(vaultItems).innerJoin(vaults, eq(vaultItems.vaultId, vaults.id))
      .where(and(eq(vaults.userId, ownerId), isNull(vaultItems.deletedAt))).orderBy(vaultItems.updatedAt);
  }

  async getItem(ownerId: string, itemId: string): Promise<EncryptedItemRecord | null> {
    const [item] = await this.db.select(itemSelection).from(vaultItems).innerJoin(vaults, eq(vaultItems.vaultId, vaults.id))
      .where(and(eq(vaults.userId, ownerId), eq(vaultItems.id, itemId), isNull(vaultItems.deletedAt))).limit(1);
    return item ?? null;
  }

  async createItem(ownerId: string, targetVaultId: string, input: Omit<EncryptedItemRecord, "vaultId" | "createdAt" | "updatedAt">): Promise<EncryptedItemRecord | null> {
    const [ownedVault] = await this.db.select({ id: vaults.id }).from(vaults).where(and(eq(vaults.userId, ownerId), eq(vaults.id, targetVaultId))).limit(1);
    if (!ownedVault) return null;
    const [created] = await this.db.insert(vaultItems).values({ ...input, vaultId: ownedVault.id }).returning(itemSelection);
    return created ?? null;
  }

  async exportVault(ownerId: string, vaultId: string): Promise<EncryptedVaultExport | null> {
    const [vault] = await this.db.select({ id: vaults.id, masterEnvelope: vaults.masterEnvelope, recoveryEnvelope: vaults.recoveryEnvelope, cryptoVersion: vaults.cryptoVersion })
      .from(vaults).where(and(eq(vaults.userId, ownerId), eq(vaults.id, vaultId))).limit(1);
    if (!vault) return null;
    return { vault, items: await this.listItems(ownerId) };
  }

  async updateItem(ownerId: string, itemId: string, expectedRevision: number, input: Pick<EncryptedItemRecord, "ciphertext" | "nonce" | "cryptoVersion">): Promise<UpdateResult> {
    const current = await this.getItem(ownerId, itemId);
    if (!current) return { status: "not_found" };
    if (current.revision !== expectedRevision) return { status: "conflict" };
    const [updated] = await this.db.update(vaultItems).set({ ...input, revision: expectedRevision + 1, updatedAt: sql`now()` })
      .where(and(eq(vaultItems.id, itemId), eq(vaultItems.vaultId, current.vaultId), eq(vaultItems.revision, expectedRevision), isNull(vaultItems.deletedAt))).returning(itemSelection);
    return updated ? { status: "updated", item: updated } : { status: "conflict" };
  }

  async deleteItem(ownerId: string, itemId: string, expectedRevision: number): Promise<UpdateResult> {
    const current = await this.getItem(ownerId, itemId);
    if (!current) return { status: "not_found" };
    if (current.revision !== expectedRevision) return { status: "conflict" };
    const [deleted] = await this.db.update(vaultItems).set({ revision: expectedRevision + 1, deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(vaultItems.id, itemId), eq(vaultItems.vaultId, current.vaultId), eq(vaultItems.revision, expectedRevision), isNull(vaultItems.deletedAt))).returning(itemSelection);
    return deleted ? { status: "updated", item: deleted } : { status: "conflict" };
  }
}
