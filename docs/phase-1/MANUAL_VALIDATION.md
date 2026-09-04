# Phase 1 Manual Validation

Status: Awaiting project-owner and real-device sign-off

Automated coverage runs Android Chromium emulation, iOS WebKit emulation, 320/360/390/768/1280 px responsive widths, keyboard activation, touch-target sizing, light/dark axe scans, and primary fixture-data flows. The following checks require a human and/or real phone and cannot be truthfully replaced by browser automation.

## Run the prototype

```sh
nvm use
npm install
npm run dev
```

Open the displayed network URL from a phone on the same network. Use fixture data only; Phase 1 does not encrypt or persist credentials.

## Project-owner usability script

- [ ] Unlock the demo and find/copy the GitHub password within 15 seconds.
- [ ] Add a login named `Travel card`, generate its password, and save within 60 seconds.
- [ ] Remove or add an item to Favorites and confirm the Favorites screen updates.
- [ ] Lock the vault manually.
- [ ] Submit New login without a name and confirm the missing field is understandable without relying on color.
- [ ] Confirm no accidental destructive action occurred.

Record device/browser, completion time, errors, accidental taps, and comments below. Never enter a real password.

## Assistive-technology smoke tests

### VoiceOver with Safari on iPhone

- [ ] Headings, search, account rows, copy/favorite controls, and bottom navigation have understandable names and order.
- [ ] Item detail and New login dialogs announce their title/description, trap focus, close correctly, and return focus to the trigger.
- [ ] Reveal password communicates its state; copy success is announced without reading the password.
- [ ] Validation errors are announced and focus behavior is predictable.

### TalkBack with Chrome on Android

- [ ] Repeat the four checks above.
- [ ] Confirm touch exploration can distinguish row open, favorite, and copy actions without accidental activation.

## Mobile behavior and visual review

- [ ] No content is hidden by the browser chrome, safe area, bottom navigation, or virtual keyboard.
- [ ] Save remains reachable while the keyboard is open.
- [ ] Scrolling, sheets, focus, light mode, and dark mode feel stable.
- [ ] Text remains readable at the device's enlarged text setting.
- [ ] Visual direction is approved, or requested changes are recorded.

## Sign-off record

- Reviewer:
- Date:
- Device/browser:
- Usability results:
- VoiceOver result:
- TalkBack result:
- Visual approval/changes:
- Decision: Approve Phase 1 | Changes required
