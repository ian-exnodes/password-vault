# Mobile UX Wireframes and Accessibility Requirements

Status: Phase 0 low-fidelity baseline

Design baseline: 360 × 640 CSS pixels, portrait, one-handed use. Layout scales through large phones, tablets, and desktop without hiding core actions behind hover.

## Information architecture

Bottom navigation has four destinations: Vault, Favorites, Generator, Settings. The add-item action floats above the navigation on Vault/Favorites. Authentication and unlock screens have no application navigation.

## Wireframes

### Locked

```text
┌────────────────────────────┐
│                            │
│          ◇ Vault           │
│       Vault is locked      │
│                            │
│  ┌──────────────────────┐  │
│  │ Unlock on this device│  │
│  └──────────────────────┘  │
│                            │
│  Use master password       │
│  Use recovery key          │
│                            │
│  Auto-lock information     │
└────────────────────────────┘
```

“Unlock on this device” appears only when PRF-backed quick unlock is enrolled. Otherwise the master-password action is primary.

### Vault list

```text
┌────────────────────────────┐
│ Vault              [lock]  │
│ ┌────────────────────────┐ │
│ │ Search accounts…       │ │
│ └────────────────────────┘ │
│ [All] [Work] [Personal]    │
│                            │
│ ★ GitHub                   │
│   person@example.com  [⧉] │
│ ────────────────────────── │
│   Email                    │
│   person@example.com  [⧉] │
│                            │
│                       (+)  │
├────────────────────────────┤
│ Vault   ★   Generate   ⚙   │
└────────────────────────────┘
```

Search is client-side and includes title, username, URL, and tags after unlock. Copy buttons announce success without moving focus.

### Item detail

```text
┌────────────────────────────┐
│ ‹ Vault       GitHub  Edit │
│                            │
│ Username                   │
│ person@example.com    [⧉]  │
│                            │
│ Password                   │
│ ••••••••••••     [show][⧉]│
│                            │
│ Website             [open] │
│ github.com                 │
│                            │
│ Tags       personal, code  │
│ Notes                      │
│ …                          │
│                            │
│ Delete item                │
└────────────────────────────┘
```

Reveal is temporary and independent of copy. Delete requires confirmation and is visually separated from frequent actions.

### Add/edit

```text
┌────────────────────────────┐
│ Cancel    New login   Save │
│                            │
│ Name *                     │
│ [                          ]│
│ Username                   │
│ [                          ]│
│ Password                   │
│ [••••••••••] [show] [gen] │
│ Website                    │
│ [                          ]│
│ Tags                       │
│ [                          ]│
│ Notes                      │
│ [                          ]│
└────────────────────────────┘
```

Unsaved navigation prompts the user. Save remains reachable above the mobile keyboard and reports validation inline plus in a summary.

### Generator

```text
┌────────────────────────────┐
│ Password generator         │
│                            │
│ vQ7…mP2               [⧉]  │
│ Strength: strong           │
│                            │
│ Length  ─────●────  24     │
│ [✓] Uppercase              │
│ [✓] Lowercase              │
│ [✓] Numbers                │
│ [✓] Symbols                │
│ [ ] Avoid ambiguous        │
│                            │
│ [ Generate new password ]  │
└────────────────────────────┘
```

## Interaction requirements

- Primary tap targets are at least 44 × 44 CSS pixels and separated to prevent accidental reveal/delete.
- Common actions remain within comfortable thumb reach; destructive actions are never adjacent to copy.
- Do not rely on hover, color, swipe, or icons alone.
- Respect safe-area insets and browser/virtual-keyboard resizing.
- Preserve scroll position when returning from an item.
- Search results begin updating within 100 ms for the MVP performance fixture.
- Copy confirmation is announced through a polite live region; never display the copied password in a toast.
- Clipboard clearing defaults to 30 seconds, is user-configurable within a safe range, and honestly warns that OS history may retain copies.
- Auto-lock defaults to 5 minutes of inactivity and locks after 30 seconds in background; exact timers are validated on real devices.

## Accessibility requirements

- Target WCAG 2.2 AA for all MVP flows.
- Semantic headings, landmarks, lists, labels, buttons, dialogs, and error associations.
- Full keyboard operation with visible focus and logical order.
- Screen-reader names include intent and item context, such as “Copy GitHub password.”
- Password reveal communicates pressed/state changes.
- Text contrast at least 4.5:1; large text at least 3:1; component/focus contrast at least 3:1.
- Support 200% text zoom and reflow at 320 CSS pixels without two-dimensional scrolling, except essential content.
- Respect `prefers-reduced-motion`; no security state depends on animation.
- Avoid automatic focus jumps and unexpected context changes.
- Errors are textual, actionable, and announced; focus moves to an error summary only after submit.
- Authentication works with password managers and platform accessibility features; paste into master-password fields is allowed.
- Test light/dark modes, English/Vietnamese expansion tolerance, VoiceOver/Safari, and TalkBack/Chrome.

## Phase 1 usability test script

With five fixture items on a 360 px viewport, a test participant must be able to:

1. Find and copy a named password within 15 seconds after unlock.
2. Add a login with generated password within 60 seconds.
3. Favorite an item and find it under Favorites.
4. Manually lock the vault.
5. Identify why a form cannot save without relying on color.

Record completion, errors, accidental taps, and participant comments; do not record fixture passwords in screen analytics.
