export type LockReason = "manual" | "inactivity" | "background" | "revoked";

export class VaultSession {
  #vaultKey: CryptoKey | null = null;
  #generation = 0;

  unlock(vaultKey: CryptoKey): void {
    this.#vaultKey = vaultKey;
    this.#generation += 1;
  }

  lock(reason: LockReason): void {
    void reason;
    this.#vaultKey = null;
    this.#generation += 1;
  }

  get isLocked(): boolean { return this.#vaultKey === null; }
  get generation(): number { return this.#generation; }

  requireKey(): CryptoKey {
    if (!this.#vaultKey) throw new Error("Vault is locked");
    return this.#vaultKey;
  }
}
