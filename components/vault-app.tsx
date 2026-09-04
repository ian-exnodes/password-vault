"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FileKey,
  Heart,
  KeyRound,
  Lock,
  Moon,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPassword, filterItems, fixtureItems, type VaultItem } from "@/lib/vault-items";
import { generateVaultKey } from "@/lib/crypto/core";
import { VaultSession, type LockReason } from "@/lib/crypto/session";
import { ClipboardExpiry, VaultLifecycle } from "@/lib/security/lifecycle";

type Tab = "vault" | "favorites" | "generator" | "settings";

const tabs: { id: Tab; label: string; icon: typeof Lock }[] = [
  { id: "vault", label: "Vault", icon: FileKey },
  { id: "favorites", label: "Favorites", icon: Star },
  { id: "generator", label: "Generate", icon: Sparkles },
  { id: "settings", label: "Settings", icon: Settings },
];

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? "brand-mark brand-mark--small" : "brand-mark"} aria-hidden="true">
      <span />
    </span>
  );
}

export function VaultApp() {
  const [locked, setLocked] = useState(true);
  const [tab, setTab] = useState<Tab>("vault");
  const [items, setItems] = useState(fixtureItems);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("All");
  const [selected, setSelected] = useState<VaultItem | null>(null);
  const [editing, setEditing] = useState<VaultItem | null | "new">(null);
  const [announcement, setAnnouncement] = useState("");
  const session = useRef(new VaultSession());
  const clipboardExpiry = useRef<ClipboardExpiry | null>(null);

  const visibleItems = useMemo(() => {
    const base = tab === "favorites" ? items.filter((item) => item.favorite) : items;
    return filterItems(base, query, tag);
  }, [items, query, tag, tab]);

  function announce(message: string) {
    setAnnouncement("");
    window.setTimeout(() => setAnnouncement(message), 10);
  }

  const lockVault = useCallback((reason: LockReason) => {
    session.current.lock(reason);
    void clipboardExpiry.current?.clearIfUnchanged();
    setSelected(null);
    setEditing(null);
    setQuery("");
    setLocked(true);
  }, []);

  async function unlockVault() {
    session.current.unlock(await generateVaultKey());
    setLocked(false);
  }

  useEffect(() => {
    if (locked) return;
    const lifecycle = new VaultLifecycle((reason) => lockVault(reason));
    const activityEvents = ["pointerdown", "keydown", "touchstart"] as const;
    const onActivity = () => lifecycle.activity();
    const onVisibility = () => document.visibilityState === "hidden" ? lifecycle.background() : lifecycle.foreground();
    activityEvents.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    lifecycle.start();
    return () => {
      lifecycle.stop();
      activityEvents.forEach((event) => window.removeEventListener(event, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [locked, lockVault]);

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      clipboardExpiry.current ??= new ClipboardExpiry(navigator.clipboard);
      clipboardExpiry.current.schedule(value);
    } catch {
      // Clipboard permission varies in embedded/mobile test contexts; feedback remains useful.
    }
    announce(`${label} copied. Clipboard clear scheduled for 30 seconds.`);
  }

  function saveItem(next: VaultItem) {
    setItems((current) => {
      const exists = current.some((item) => item.id === next.id);
      return exists ? current.map((item) => (item.id === next.id ? next : item)) : [next, ...current];
    });
    setSelected(next);
    setEditing(null);
    announce(`${next.title} saved.`);
  }

  if (locked) {
    return <UnlockScreen onUnlock={unlockVault} />;
  }

  return (
    <main className="app-shell">
      <div className="desktop-rail">
        <div className="rail-brand"><BrandMark small /><span>Vault</span></div>
        <Navigation tab={tab} setTab={setTab} desktop />
        <button className="rail-lock" type="button" onClick={() => lockVault("manual")}><Lock size={18} />Lock vault</button>
      </div>

      <section className="app-content">
        {(tab === "vault" || tab === "favorites") && (
          <VaultView
            favoriteOnly={tab === "favorites"}
            items={visibleItems}
            query={query}
            tag={tag}
            onQuery={setQuery}
            onTag={setTag}
            onSelect={setSelected}
            onCopy={copyValue}
            onToggleFavorite={(id) => setItems((current) => current.map((item) => item.id === id ? { ...item, favorite: !item.favorite } : item))}
            onAdd={() => setEditing("new")}
            onLock={() => lockVault("manual")}
          />
        )}
        {tab === "generator" && <GeneratorView onCopy={copyValue} />}
        {tab === "settings" && <SettingsView onLock={() => lockVault("manual")} />}
      </section>

      <Navigation tab={tab} setTab={setTab} />
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>

      <ItemDetail
        item={selected}
        onClose={() => setSelected(null)}
        onCopy={copyValue}
        onEdit={(item) => { setSelected(null); setEditing(item); }}
        onDelete={(item) => {
          setItems((current) => current.filter((candidate) => candidate.id !== item.id));
          setSelected(null);
          announce(`${item.title} deleted.`);
        }}
      />
      <ItemForm value={editing} onClose={() => setEditing(null)} onSave={saveItem} />
    </main>
  );
}

function UnlockScreen({ onUnlock }: { onUnlock: () => void | Promise<void> }) {
  const [masterMode, setMasterMode] = useState(false);
  const [password, setPassword] = useState("");

  return (
    <main className="unlock-shell">
      <section className="unlock-card" aria-labelledby="unlock-title">
        <div className="unlock-orbit"><BrandMark /></div>
        <p className="eyebrow">Private by design</p>
        <h1 id="unlock-title">Your digital life,<br />within reach.</h1>
        <p className="unlock-copy">A calm, encrypted home for the accounts that matter.</p>

        {masterMode ? (
          <form className="unlock-form" onSubmit={(event) => { event.preventDefault(); onUnlock(); }}>
            <label htmlFor="master-password">Master password</label>
            <input id="master-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" autoFocus />
            <button className="primary-button" type="submit" disabled={!password}>Unlock vault <ChevronRight size={18} /></button>
            <button className="text-button" type="button" onClick={() => setMasterMode(false)}><ArrowLeft size={16} /> Back</button>
          </form>
        ) : (
          <div className="unlock-actions">
            <button className="primary-button" type="button" onClick={onUnlock}>
              <ShieldCheck size={20} /> Unlock demo vault
            </button>
            <button className="secondary-button" type="button" onClick={() => setMasterMode(true)}>
              <KeyRound size={19} /> Use master password
            </button>
          </div>
        )}
        <div className="trust-note"><Lock size={14} /><span>Prototype data stays on this device</span></div>
      </section>
    </main>
  );
}

function Navigation({ tab, setTab, desktop = false }: { tab: Tab; setTab: (tab: Tab) => void; desktop?: boolean }) {
  return (
    <nav className={desktop ? "rail-nav" : "bottom-nav"} aria-label="Primary">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" className={tab === id ? "nav-item nav-item--active" : "nav-item"} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}>
          <Icon size={desktop ? 19 : 21} strokeWidth={tab === id ? 2.3 : 1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

type VaultViewProps = {
  favoriteOnly: boolean;
  items: VaultItem[];
  query: string;
  tag: string;
  onQuery: (value: string) => void;
  onTag: (value: string) => void;
  onSelect: (item: VaultItem) => void;
  onCopy: (value: string, label: string) => void;
  onToggleFavorite: (id: string) => void;
  onAdd: () => void;
  onLock: () => void;
};

function VaultView({ favoriteOnly, items, query, tag, onQuery, onTag, onSelect, onCopy, onToggleFavorite, onAdd, onLock }: VaultViewProps) {
  const tags = ["All", "Personal", "Work", "Code", "Design"];
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Good evening</p>
          <h1>{favoriteOnly ? "Favorites" : "Your vault"}</h1>
        </div>
        <button className="icon-button" type="button" aria-label="Lock vault" onClick={onLock}><Lock size={20} /></button>
      </header>

      <div className="search-field">
        <Search size={19} aria-hidden="true" />
        <label className="sr-only" htmlFor="vault-search">Search accounts</label>
        <input id="vault-search" type="search" placeholder="Search accounts" value={query} onChange={(event) => onQuery(event.target.value)} />
        <SlidersHorizontal size={18} aria-hidden="true" />
      </div>

      <div className="chip-row" aria-label="Filter by tag">
        {tags.map((value) => <button type="button" key={value} onClick={() => onTag(value)} className={tag === value ? "chip chip--active" : "chip"} aria-pressed={tag === value}>{value}</button>)}
      </div>

      <div className="section-heading">
        <h2>{query ? "Search results" : favoriteOnly ? "Saved for quick access" : "All accounts"}</h2>
        <span>{items.length} {items.length === 1 ? "item" : "items"}</span>
      </div>

      {items.length ? (
        <ul className="vault-list" aria-label="Vault accounts">
          {items.map((item) => (
            <li key={item.id} className="vault-row">
              <button className="item-main" type="button" onClick={() => onSelect(item)} aria-label={`Open ${item.title}`}>
                <span className="item-avatar" style={{ background: item.color }}>{item.title.slice(0, 1)}</span>
                <span className="item-text"><strong>{item.title}</strong><small>{item.username}</small></span>
              </button>
              <button className="row-action favorite-action" type="button" aria-label={`${item.favorite ? "Remove" : "Add"} ${item.title} ${item.favorite ? "from" : "to"} favorites`} aria-pressed={item.favorite} onClick={() => onToggleFavorite(item.id)}>
                <Heart size={18} fill={item.favorite ? "currentColor" : "none"} />
              </button>
              <button className="row-action" type="button" aria-label={`Copy ${item.title} username`} onClick={() => onCopy(item.username, `${item.title} username`)}><Copy size={18} /></button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state"><Search size={28} /><h2>No accounts found</h2><p>Try another name, username, URL, or tag.</p></div>
      )}

      <button className="fab" type="button" onClick={onAdd} aria-label="Add login"><Plus size={25} /></button>
    </>
  );
}

function ItemDetail({ item, onClose, onCopy, onEdit, onDelete }: { item: VaultItem | null; onClose: () => void; onCopy: (value: string, label: string) => void; onEdit: (item: VaultItem) => void; onDelete: (item: VaultItem) => void }) {
  const [revealed, setRevealed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  return (
    <Dialog.Root open={Boolean(item)} onOpenChange={(open) => { if (!open) { setRevealed(false); setConfirmingDelete(false); onClose(); } }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="detail-sheet">
          {item && <>
            <div className="sheet-handle" aria-hidden="true" />
            <header className="sheet-header">
              <Dialog.Close asChild><button className="icon-button" type="button" aria-label="Close details"><X size={20} /></button></Dialog.Close>
              <button className="text-button" type="button" onClick={() => onEdit(item)}>Edit</button>
            </header>
            <div className="detail-identity">
              <span className="item-avatar item-avatar--large" style={{ background: item.color }}>{item.title.slice(0, 1)}</span>
              <Dialog.Title>{item.title}</Dialog.Title>
              <Dialog.Description>{item.url.replace(/^https?:\/\//, "")}</Dialog.Description>
            </div>
            <div className="detail-fields">
              <FieldRow label="Username" value={item.username} actionLabel={`Copy ${item.title} username`} onAction={() => onCopy(item.username, `${item.title} username`)} />
              <div className="field-row">
                <div><span>Password</span><strong className={revealed ? "password-value" : "password-value password-value--masked"}>{revealed ? item.password : "••••••••••••"}</strong></div>
                <div className="field-actions">
                  <button type="button" aria-label={`${revealed ? "Hide" : "Reveal"} ${item.title} password`} aria-pressed={revealed} onClick={() => setRevealed(!revealed)}>{revealed ? <EyeOff size={19} /> : <Eye size={19} />}</button>
                  <button type="button" aria-label={`Copy ${item.title} password`} onClick={() => onCopy(item.password, `${item.title} password`)}><Copy size={19} /></button>
                </div>
              </div>
              <FieldRow label="Website" value={item.url.replace(/^https?:\/\//, "")} />
              <div className="field-block"><span>Tags</span><div className="tag-list">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>
              <div className="field-block"><span>Notes</span><p>{item.notes || "No notes"}</p></div>
            </div>
            {confirmingDelete ? (
              <div className="delete-confirm"><p>Delete {item.title}? This action is only simulated in the prototype.</p><button className="danger-button" type="button" onClick={() => onDelete(item)}>Confirm delete</button><button className="secondary-button" type="button" onClick={() => setConfirmingDelete(false)}>Cancel</button></div>
            ) : <button className="delete-button" type="button" onClick={() => setConfirmingDelete(true)}><Trash2 size={18} />Delete item</button>}
          </>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FieldRow({ label, value, actionLabel, onAction }: { label: string; value: string; actionLabel?: string; onAction?: () => void }) {
  return <div className="field-row"><div><span>{label}</span><strong>{value}</strong></div>{onAction && <button type="button" aria-label={actionLabel} onClick={onAction}><Copy size={19} /></button>}</div>;
}

function ItemForm({ value, onClose, onSave }: { value: VaultItem | null | "new"; onClose: () => void; onSave: (item: VaultItem) => void }) {
  const initial = value && value !== "new" ? value : null;
  const [showPassword, setShowPassword] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (!title) { nameRef.current?.focus(); return; }
    onSave({
      id: initial?.id ?? `${title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      title,
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
      url: String(form.get("url") ?? ""),
      notes: String(form.get("notes") ?? ""),
      tags: String(form.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
      favorite: initial?.favorite ?? false,
      color: initial?.color ?? "#d86942",
    });
  }

  return (
    <Dialog.Root open={Boolean(value)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="form-sheet">
          <form onSubmit={submit}>
            <header className="form-header"><Dialog.Close asChild><button className="text-button" type="button">Cancel</button></Dialog.Close><Dialog.Title>{initial ? "Edit login" : "New login"}</Dialog.Title><button className="save-button" type="submit">Save</button></header>
            <Dialog.Description className="sr-only">Add or update a fixture login in this prototype.</Dialog.Description>
            <div className="form-body">
              <label>Name <span aria-hidden="true">*</span><input ref={nameRef} name="title" defaultValue={initial?.title} required autoFocus /></label>
              <label>Username or email<input name="username" defaultValue={initial?.username} autoComplete="username" inputMode="email" /></label>
              <label>Password<div className="input-with-actions input-with-actions--two"><input ref={passwordRef} name="password" type={showPassword ? "text" : "password"} defaultValue={initial?.password} autoComplete="new-password" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button><button type="button" aria-label="Generate password" onClick={() => { if (passwordRef.current) passwordRef.current.value = createPassword(24, true); }}><Sparkles size={18} /></button></div></label>
              <label>Website<input name="url" type="url" defaultValue={initial?.url} inputMode="url" placeholder="https://" /></label>
              <label>Tags <span className="label-note">Separated by commas</span><input name="tags" defaultValue={initial?.tags.join(", ")} /></label>
              <label>Notes<textarea name="notes" defaultValue={initial?.notes} rows={4} /></label>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function GeneratorView({ onCopy }: { onCopy: (value: string, label: string) => void }) {
  const [length, setLength] = useState(24);
  const [symbols, setSymbols] = useState(true);
  const [password, setPassword] = useState(() => createPassword(24, true));
  function regenerate(nextLength = length, nextSymbols = symbols) { setPassword(createPassword(nextLength, nextSymbols)); }
  return <>
    <header className="topbar"><div><p className="eyebrow">Fresh every time</p><h1>Generator</h1></div><span className="status-pill"><ShieldCheck size={15} />Local</span></header>
    <section className="generator-card" aria-labelledby="generated-heading">
      <div className="generator-output"><span id="generated-heading">Generated password</span><strong>{password}</strong><button type="button" aria-label="Copy generated password" onClick={() => onCopy(password, "Generated password")}><Copy size={19} /></button></div>
      <div className="strength-row"><span><i /> Strong</span><small>{length} characters</small></div>
    </section>
    <section className="preference-card"><div className="range-heading"><label htmlFor="password-length">Length</label><output htmlFor="password-length">{length}</output></div><input id="password-length" type="range" min="12" max="48" value={length} onChange={(event) => { const next = Number(event.target.value); setLength(next); regenerate(next, symbols); }} />
      <Preference label="Uppercase" checked /><Preference label="Lowercase" checked /><Preference label="Numbers" checked />
      <div className="switch-row"><span>Symbols</span><Switch.Root className="switch-root" checked={symbols} onCheckedChange={(next) => { setSymbols(next); regenerate(length, next); }} aria-label="Include symbols"><Switch.Thumb className="switch-thumb" /></Switch.Root></div>
    </section>
    <button className="primary-button generator-button" type="button" onClick={() => regenerate()}><RefreshCw size={19} />Generate new password</button>
  </>;
}

function Preference({ label, checked }: { label: string; checked: boolean }) {
  return <div className="switch-row"><span>{label}</span><span className="fixed-check" aria-hidden="true"><Check size={15} /></span><input className="sr-only" type="checkbox" checked={checked} readOnly aria-label={`Include ${label}`} /></div>;
}

function SettingsView({ onLock }: { onLock: () => void }) {
  const [dark, setDark] = useState(false);
  return <>
    <header className="topbar"><div><p className="eyebrow">Make it yours</p><h1>Settings</h1></div><span className="profile-dot"><UserRound size={19} /></span></header>
    <section className="settings-group" aria-labelledby="security-settings"><h2 id="security-settings">Security</h2><SettingRow icon={Lock} title="Auto-lock" detail="After 5 minutes" /><SettingRow icon={Copy} title="Clear clipboard" detail="After 30 seconds" /><SettingRow icon={ShieldCheck} title="Trusted devices" detail="1 device" /></section>
    <section className="settings-group" aria-labelledby="appearance-settings"><h2 id="appearance-settings">Appearance</h2><div className="setting-row"><span className="setting-icon"><Moon size={19} /></span><span><strong>Dark appearance</strong><small>Follow your preference</small></span><Switch.Root className="switch-root" checked={dark} onCheckedChange={(next) => { setDark(next); document.documentElement.dataset.theme = next ? "dark" : ""; }} aria-label="Dark appearance"><Switch.Thumb className="switch-thumb" /></Switch.Root></div></section>
    <section className="settings-group" aria-labelledby="data-settings"><h2 id="data-settings">Data</h2><SettingRow icon={FileKey} title="Encrypted export" detail="Create a backup" /><SettingRow icon={MoreHorizontal} title="About this prototype" detail="Phase 1 · Fixture data" /></section>
    <button className="secondary-button lock-wide" type="button" onClick={onLock}><Lock size={18} />Lock vault now</button>
    <p className="settings-footnote">Your operating system may retain clipboard history even after this app clears its latest value.</p>
  </>;
}

function SettingRow({ icon: Icon, title, detail }: { icon: typeof Lock; title: string; detail: string }) {
  return <button className="setting-row" type="button"><span className="setting-icon"><Icon size={19} /></span><span><strong>{title}</strong><small>{detail}</small></span><ChevronRight size={18} /></button>;
}
