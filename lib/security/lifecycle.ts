export const INACTIVITY_LOCK_MS = 5 * 60 * 1000;
export const BACKGROUND_LOCK_MS = 30 * 1000;
export const CLIPBOARD_CLEAR_MS = 30 * 1000;

type TimerHandle = ReturnType<typeof setTimeout>;

export class VaultLifecycle {
  #inactivityTimer: TimerHandle | null = null;
  #backgroundTimer: TimerHandle | null = null;
  #active = false;

  constructor(
    private readonly onLock: (reason: "inactivity" | "background") => void,
    private readonly inactivityMs = INACTIVITY_LOCK_MS,
    private readonly backgroundMs = BACKGROUND_LOCK_MS,
  ) {}

  start(): void {
    this.#active = true;
    this.activity();
  }

  activity(): void {
    if (!this.#active) return;
    if (this.#inactivityTimer) clearTimeout(this.#inactivityTimer);
    this.#inactivityTimer = setTimeout(() => {
      this.#inactivityTimer = null;
      this.onLock("inactivity");
    }, this.inactivityMs);
  }

  background(): void {
    if (!this.#active || this.#backgroundTimer) return;
    this.#backgroundTimer = setTimeout(() => {
      this.#backgroundTimer = null;
      this.onLock("background");
    }, this.backgroundMs);
  }

  foreground(): void {
    if (this.#backgroundTimer) clearTimeout(this.#backgroundTimer);
    this.#backgroundTimer = null;
    this.activity();
  }

  stop(): void {
    this.#active = false;
    if (this.#inactivityTimer) clearTimeout(this.#inactivityTimer);
    if (this.#backgroundTimer) clearTimeout(this.#backgroundTimer);
    this.#inactivityTimer = null;
    this.#backgroundTimer = null;
  }
}

export class ClipboardExpiry {
  #timer: TimerHandle | null = null;
  #copiedValue: string | null = null;

  constructor(
    private readonly clipboard: Pick<Clipboard, "readText" | "writeText">,
    private readonly delayMs = CLIPBOARD_CLEAR_MS,
  ) {}

  schedule(value: string): void {
    this.cancel();
    this.#copiedValue = value;
    this.#timer = setTimeout(() => void this.clearIfUnchanged(), this.delayMs);
  }

  async clearIfUnchanged(): Promise<boolean> {
    const expected = this.#copiedValue;
    this.cancel();
    if (expected === null) return false;
    try {
      if (await this.clipboard.readText() !== expected) return false;
      await this.clipboard.writeText("");
      return true;
    } catch {
      return false;
    }
  }

  cancel(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    this.#copiedValue = null;
  }
}
