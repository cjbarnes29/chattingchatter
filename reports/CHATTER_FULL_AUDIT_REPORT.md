# Chatter: full audit report

**Date:** 17 October 2026 · **Repository:** `cjbarnes29/chattingchatter` · **Branch:** `ccr-1056779d-cbnqch` · **Database:** unchanged (the migration in §6 is not applied) · **Deployed:** no

This report covers two change sets: part A (§1–§7) and part B, decoy mode with any wrong PIN (§8).

Part A:

- Editable Decoy Chats
- Removal of the Ghost Canvas timer
- WhatsApp-style voice messages (record, play, save, translate)
- Files of any type up to 1 MB
- The emoji button fix

It lists what was changed, how it was checked, and what is still open.

---

## 1. Summary

| Request | Result | Verified how |
|---|---|---|
| Editable Decoy Chats (Manage Decoy Chats editor) | **Done** | Browser tests on the real components (editor, preview, decoy mode, migration, reload) |
| Remove the Ghost Canvas timer | **Done** | Browser test with a fake clock: open 2 min after the other person joins, closes only on Exit |
| Voice messages: record and play back | **Done** | Real `MediaRecorder` in Chromium with a fake microphone: hold, release, slide-cancel, lock, keyboard, play, seek, speed |
| Voice messages: save | **Done** (web). Android uses a new native save path whose **Java isn't compiled yet** | Download test in the browser. The Android build needs CI after push approval |
| Voice messages: translation | **Partly.** Works where the device has an on-device translator and the sender added a transcript | Tested with a stand-in translator. The real one isn't available on Android or offline |
| Files of any type, up to 1 MB each | **Done in the app.** Real chats **need the database update** `chat_attachments.sql` (not applied) | Browser tests with stand-in storage; size limit, any type, save, inline pictures |
| Emoji button | **Fixed** | Browser test: opens, inserts at the caret, closes on Escape or outside click |

---

## 2. Root causes found

| Problem | Cause (file) |
|---|---|
| Emoji button did nothing | `ChatWindow.tsx`: the button had **no click handler and no picker existed**. The **Attach** button next to it had no handler either. |
| Ghost Canvas closed by itself | `GhostCanvas.tsx`: a "Hold to stay · 5s" countdown (`grace`) called `onExit()` at zero once the other person joined, and **letting go of the hold button also exited**. The Pin button and the "Hold-to-stay time" setting existed only to fight that countdown. |
| Decoy chats were barely editable | `decoyStore.ts` stored **one opening line per contact** plus anything typed in decoy mode. There was no way to write the other side, change times, or preview. New contacts used `ui-avatars.com`, which **sent decoy names to a third-party service**. |
| No voice messages | The composer mic was dictation (speech-to-text into the text box), which doesn't exist in the Android app's web view. Nothing recorded audio. |
| No files | Messages are text only (max 4000 characters), and production storage has only the **public** `avatars` bucket (checked read-only). Private files need a new, private bucket. |

---

## 3. What changed

### 3.1 Editable Decoy Chats
**Settings → Decoy chats** opens a new editor. It's only available inside the real app: hidden in decoy mode, as tested.

- **List:**
  - Every fake contact with its last message.
  - Badges for **Hidden** and **Pro to show**; the free plan still shows 1 decoy chat in decoy mode.
  - **Open, Duplicate, Move up/down, Delete** (with confirmation), **New decoy chat**, and **Reset to samples** (with confirmation).
- **Contact editor:**
  - Photo from the phone, or a local **initials avatar**.
  - Name (rename) and the status line under the name ("online", "last seen today at 09:30", …).
  - Show in decoy mode.
- **Messages tab:**
  - Each message has a **Them / You** switch, editable text with an **emoji button**, **date and time**, and **ticks** (Sent / Delivered / Read).
  - Messages can be deleted (with confirmation).
  - "+ Their message" and "+ Your message" add a message one minute after the last.
  - Messages are kept in date order.
- **Preview tab:** shows how it will look, with the header, WhatsApp-style **date dividers** (Today / Yesterday / weekday / date), bubbles on both sides, times and ticks.
- **Saving:** automatic on every change, to this device only, per account. The editor says "Saved on this device only", or warns if storage is full.
- **Decoy mode:**
  - Shows the full edited conversations with date dividers and the custom status.
  - Messages typed there are saved into that decoy chat.
  - Voice messages and files work too, kept on the device.
- **Migration:** existing decoys (old format: opening line plus typed replies, per account or device-wide) are converted automatically, and the old keys are removed.

### 3.2 Ghost Canvas timer removed
- The hold-to-stay countdown, the hold button's exit-on-release, the Pin button and the "Hold-to-stay time" setting are gone.
- The canvas stays open until **Exit canvas**, **X**, or **Escape**. "Close when I leave" (a privacy option) is kept.
- The **ink fade** ("vanishes in 10s") is a separate privacy feature and is **unchanged**. If you meant that timer too, say so and it can be removed the same way.

### 3.3 Voice messages
- **Recording, WhatsApp-style:**
  - **Hold the mic** to record and **let go to send**.
  - **Slide left** to cancel; **slide up** to lock and record hands-free, then Send or Delete.
  - Keyboard: Enter or Space starts a locked recording.
  - A quick tap explains "hold to record".
  - Live level bars and a timer. Maximum 5 minutes, and it stops before 1 MB. Minimum 1 second.
  - On Android, the explanation is shown before the microphone prompt.
- **Playback:** play/pause, a **waveform you can tap or drag to seek**, elapsed and total time, **speed 1× / 1.5× / 2×**, and **Save** (download on web, "Save to" on Android).
- **Transcript and translation:**
  - Settings → Chats & gestures → **Voice message transcripts** (off by default). When on, the browser's speech recognition writes a transcript while you record, and it's sent with the message.
  - The receiver can read it and **Translate** it into any of 22 languages using the device's **built-in, on-device translator**. Nothing is sent to a translation service.
  - If the device has no translator, or there's no transcript, the app says so plainly.

### 3.4 Files (any type, up to 1 MB)
- **Attach** (paperclip) picks one or more files of any type. Anything over **1 MB** is refused before upload, with a clear message.
- **Display:** pictures show inline (tap to enlarge); audio and video play on tap; other files show name, size and **Save**.
- **Safety:** SVG and HTML are **never shown inline**, because they can carry scripts. Executable types (apk, exe, js, …) show a "only open if you trust the sender" note.
- **Storage:**
  - Real chats use a **private** bucket, opened through **1-hour signed links**. The storage rules (in the migration) let only the two people in a DM, or a group's members, read a file. Blocked users can't send, and only the sender can delete.
  - Decoy chats store files **on the device only** (IndexedDB).
- Chat previews and notifications show a readable line ("📎 report.pdf · 120 KB", "🎤 Voice message · 0:12"), never the technical details.

### 3.5 Emoji
A full emoji panel (recent plus 7 groups) that inserts at the caret. **Recent emojis are kept separately for real and decoy chats**, so decoy mode never shows what you used in real chats. The same panel is used in the decoy editor.

### 3.6 Files changed

| File | Change |
|---|---|
| `src/components/DecoyManager.tsx` | **New.** The Manage Decoy Chats editor and preview |
| `src/decoyModel.ts` | **New.** Decoy data rules: validation and limits, samples, migration, duplicate, local avatars, date labels |
| `src/decoyStore.ts` | Rewritten for full conversations (v2), per account, with migration |
| `src/decoyChats.ts` | Deleted (samples moved into `decoyModel.ts`) |
| `src/components/DecoyApp.tsx` | Shows the edited conversations; device-only files; decoy emoji scope |
| `src/components/ProSettings.tsx` | Decoy list uses the new store |
| `src/components/Settings.tsx` | Decoy chats page uses the new editor |
| `src/components/FeatureSettings.tsx` | Old decoy editor and Hold-to-stay setting removed; transcript toggle added |
| `src/components/GhostCanvas.tsx`, `src/ghostSession.ts`, `src/prefs.ts` | Countdown, hold-to-stay, Pin and the `grace` setting removed |
| `src/components/ChatWindow.tsx` | Emoji panel, attach, voice recorder, file and voice bubbles, date dividers |
| `src/components/EmojiPicker.tsx`, `src/caret.ts` | **New.** Emoji panel; insert at the caret |
| `src/components/VoiceRecorder.tsx`, `src/components/VoiceMessage.tsx`, `src/components/FileMessage.tsx` | **New.** Recording and the voice and file bubbles |
| `src/attachmentFormat.ts` | **New.** How files and voice messages are written into a message; limits; previews |
| `src/attachmentStore.ts` | **New.** Private server storage for real chats, device storage for decoy, Save |
| `src/translate.ts` | **New.** On-device translation (with a timeout), optional transcript, transcript setting |
| `src/App.tsx`, `src/components/ChatList.tsx`, `src/data.ts` | Storage per chat; readable previews and notifications; optional date label |
| `src/permissions.ts`, `src/components/AppPermissions.tsx`, `AndroidManifest.xml` (comment only) | Microphone wording now includes voice messages. **No new permissions** |
| `src/native.ts`, `android/.../ChatterDevicePlugin.java` | Native Save accepts any file (base64) |
| `supabase/migrations/chat_attachments.sql` | **New, not applied.** Private `attachments` bucket (1 MB limit) and its access rules |

PIN, decoy PIN, fingerprint and app-lock code was **not changed** (`pinLock.ts`, `PinGate.tsx`, `biometric.ts`, `appLock.ts`, `security.ts`, `Innovations.tsx`: no diff).

---

## 4. Separation and security

- **Decoy data never touches real data:**
  - Decoy chats are stored only on the device, per account, under their own key.
  - Decoy mode loads no real chats, contacts or files. Tested: **no server calls** for messages, profiles, contacts, storage or channels in the editor or in decoy mode.
- **Files can't cross over.** Decoy files can't open real files and real chats can't open decoy files; another account's decoy files are also refused (tested).
- **No leaks through shared helpers:** emoji recents are separate. Decoy avatars are local pictures only, and stored decoy data that points anywhere else is replaced with an initials avatar.
- **PIN and fingerprint behaviour is unchanged.** The decoy editor is reachable only from the real app's Settings.
- **Server files:**
  - The bucket is private and links expire after 1 hour.
  - The app only signs keys in the exact `dm/<uuid>/<uuid>/<uuid>/<name>` or `group/…` layout; other keys were refused in testing.
  - File names are cleaned before upload, and SVG/HTML are never rendered.
- **Privacy:**
  - Translation runs on the device, and nothing is sent to a translation service (tested: no extra calls).
  - Transcripts are opt-in, because browser speech recognition in Chrome uses Google's servers; the setting says so.
- **Android:** no new permissions. Saving uses Android's "Save to" screen, which needs no storage permission.

---

## 5. Test evidence

### Static checks (same as before the change)
| Check | Result |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | 7 lines, **all pre-existing** (unused variables and `useRef()` in older code). No new errors |
| `npx eslint src` | 23 problems, **all pre-existing**. None in new or changed code |
| `npx vite build` | Passes |

### Unit tests: 15 / 15 pass
`node --experimental-strip-types --test` on the pure modules:
- Attachment encode/parse round-trips, a readable first line, and staying under 4000 characters even with long transcripts.
- Malformed or mid-text markers are treated as text.
- 1 MB limit; safe file names (`../../etc/passwd` → `etc_passwd`, accents); waveform shape; SVG/HTML never inline.
- Decoy samples; v1 migration (third-party avatar replaced).
- Validation limits, and junk / `javascript:` avatars / bad dates / bad ticks rejected.
- Duplicate creates new ids; the initials avatar escapes markup; Today/Yesterday labels; sorting.

### Browser tests (real components, Chromium, fake microphone): 74 / 74 and 7 / 7 pass
These used a temporary harness with stand-ins for Supabase and sign-in (removed afterwards).

**Emoji (8 checks):**
- Opens; inserts at the caret.
- Escape and an outside click close it.
- Recent tab works; recents are scoped.
- A message with emoji sends; no page errors.

**Files (10 checks):**
- Over 1 MB refused before upload.
- A PDF goes to `dm/<me>/<peer>/<id>/report_final.pdf`; the bubble shows name and size; Save downloads the exact bytes.
- Unknown type accepted; APK warned.
- PNG inline; SVG not inline.
- Missing bucket gives a clear message; no page errors.

**Voice (15 checks):**
- Hold and release sends an Opus/WebM recording under 1 MB with a 40-bar waveform.
- Plays; speed cycles; seek works; Save downloads.
- Slide left cancels; a quick tap explains and sends nothing.
- Slide up locks; locked Send works; Enter starts and Delete discards.
- Fits at 390 px; no page errors.

**Translation (7 checks):**
- Transcript shows.
- No translator gives an honest message, with no other calls made.
- A **stalled language-pack download times out** with a clear message.
- A stand-in translator translates.
- No transcript is explained; a key outside the allowed layout is refused.

**Isolation (1):** decoy and real files can't open each other, nor can another account's decoy files.

**Ghost Canvas (5):**
- No countdown and no Pin.
- **Still open 2 minutes after the other person joined** (fake clock).
- Exit closes it; no page errors.

**Decoy editor (18):**
- Samples listed.
- Create; rename; messages on both sides; emoji in a message.
- Change date/time, ticks and side.
- Preview shows date dividers, both sides, the edited time and the new name.
- Rename appears in the list; the free-plan "Pro to show" badge.
- Duplicate; delete with confirmation; reorder; saved note; saved per account.
- **Survives reload**; **no server calls**; fits 390 px; no page errors.

**Decoy mode (10):**
- Old decoys migrated; old keys removed.
- Typed message saved into the decoy chat.
- **Decoy emoji panel doesn't show real recents.**
- File saved on the device and re-opened; voice message works on the device.
- **No real-data server calls.**
- Date dividers and custom status; no page errors.

**Settings (7):**
- Decoy chats opens the editor.
- Transcript toggle exists and saves (off by default).
- Hold-to-stay setting removed; "Close when I leave" kept.
- No errors.
- **Decoy mode can't reach the decoy editor.**

### Bugs found by these tests and fixed
1. **Translation could hang forever.** Chromium 141 has a built-in translator that tries to download a language pack; without a connection the app sat on "Translating…" indefinitely. There is now a 15-second timeout with "The language pack is still downloading…".
2. **Accented file names were mangled** (`ünïcødé.txt` → `u_ni_c_de_.txt`). Accents are now stripped properly (`unic_de.txt`).
3. **Broken decoy entries used up slots.** Invalid stored entries counted toward the 50-contact limit; they are now skipped first.

---

## 6. Not verified / limitations

| Item | Why | What's needed |
|---|---|---|
| **Files and voice messages in real chats on the live server** | The private `attachments` bucket doesn't exist yet. Until it does, real chats show "File sharing isn't switched on for this server yet". Decoy chats work now. | Review and run `supabase/migrations/chat_attachments.sql` in the Supabase SQL Editor (**needs your approval**). Then test sending between two accounts. |
| **Android build of the native Save change** | No Android SDK in this environment. The Java change is small (base64 decode) but hasn't been compiled. | Push to GitHub so CI builds it (**needs your approval**). |
| **Real phone testing** | No device or emulator here. Recording uses the phone's microphone through the web view; Opus/WebM recording is expected on Android Chrome-based web views but unconfirmed. | Install the next test APK and run the checks in `docs/ANDROID.md`, plus: record, play, save a voice message, send a file, edit a decoy chat. |
| **Voice translation on Android** | The Android web view has no on-device translator and no speech recognition, so phones **can't add transcripts or translate yet**. It works in Chrome on a computer (with the language pack downloaded). | A cloud speech-to-text and translation service would be needed, which means sending audio or text to a third party. That's a privacy decision for you. |
| **Older app versions** | They don't understand the new file/voice messages and show the readable first line ("🎤 Voice message · 0:12") plus a technical line under it. | Update all devices. |
| **Editing a file or voice message's text** | The message menu's local "edit" replaces the text on your screen and hides the attachment there (other people are unaffected). | Low priority; could block editing for attachment messages. |
| **Group chats: files** | Supported in the code and storage rules, but only tested with a stand-in. | Covered by the live test after the migration. |
| Pre-existing type/lint issues (7 / 23) | In older files, not part of this change. | Separate clean-up. |
| Play Protect warning on install (from the earlier report) | Builds are signed with a throwaway debug key. | A permanent release key plus developer verification (see `docs/ANDROID.md`). |

---

## 7. Pending approvals
1. **Apply `supabase/migrations/chat_attachments.sql`** to production (private file storage for real chats).
2. **Push** this branch: authorized on 17 October together with part B. CI can then build the APK (including the Java change).
3. **Install and test** the resulting APK on a phone.

---

## 8. Part B: decoy mode opens with any wrong PIN

### What was asked
Remove the separate decoy PIN. The correct PIN opens the real app, and **any other PIN opens decoy mode** with only the fake chats. Keep fingerprint unlock for the real account, never expose real data, and don't weaken the lock.

### How it worked before (inspected)
- **Lock screen (`PinGate.tsx` → `pro.tsx` `verifyPin`):**
  - Each PIN was checked against two salted PBKDF2 hashes, real and decoy.
  - The real PIN opened the app, the decoy PIN opened decoy mode, and anything else showed **"Incorrect PIN"**.
  - After 5 wrong PINs came a 30 s wait doubling to 15 min, shown as a countdown with the keypad disabled.
- **Settings** had a "Decoy PIN" field, with checks that it differed from the real PIN.
- **Fingerprint** (`biometric.ts`) only opens the real app. Since the earlier fix, a failed one opens nothing.

### What changed
| File | Change |
|---|---|
| `src/pro.tsx` | New `unlockPin()` for the lock screen. The real PIN returns `real`; **anything else returns `decoy`** and still counts as a wrong guess (logged for the owner). During a wrong-guess wait, every PIN returns `decoy`; the correct one isn't counted, and wrong ones keep counting and lengthen the wait. The slow PBKDF2 check always runs, so timing doesn't hint at the answer. `verifyPin()` (confidential chats, turning the lock off, logging out in the real app) now only knows "real / wrong / wait" and **never opens decoy**. The decoy PIN hash, `setDecoyPin`, `clearDecoy` and `matchPin` are removed, and an old stored decoy PIN hash is **deleted** on load. **Also fixed:** PIN data now loads before the first render (see below). |
| `src/components/PinGate.tsx` | New `mode`. `unlock` (lock screen): no "incorrect" message and no countdown; the keypad always works. `confirm`: only the real PIN, with errors. The fingerprint path is unchanged (a verified check opens the real app; otherwise nothing opens). |
| `src/App.tsx` | Lock screen uses `mode="unlock"`. **Decoy mode locks as soon as the app is left**, whatever the auto-lock setting, so a mistyped PIN is fixed by leaving and coming back. |
| `src/components/Settings.tsx` | Logging out from the real app needs the real PIN (`confirm`). From decoy mode any PIN logs out, as before, so logging out doesn't reveal the PIN was wrong. Wording updated. |
| `src/components/ProSettings.tsx` | Decoy PIN field and checks removed; one PIN field. Explains that any other PIN opens decoy mode, that wrong PINs still count, and what to do after a typo. The decoy chat list shows whenever a PIN lock is on. |
| `DecoyManager.tsx`, `decoyModel.ts`, `entitlements.ts`, `Innovations.tsx`, `Landing.tsx`, `website/index.html` | Wording: "any other PIN" instead of "decoy PIN". The website FAQ no longer claims a rejected fingerprint opens decoy chats (it hasn't since the earlier fix). |

### Security bug found while testing (existing before this change, now fixed)
**On every launch, the real app was drawn and started loading real data before the lock screen appeared.**
- The PIN settings were read in an effect, *after* the first render. For that first render the app thought no PIN was set, so it mounted the real inbox.
- That one render began loading messages, groups, contacts, stories and events, and subscribed to live updates, then the lock screen replaced it.
- **Fix:** the PIN settings are now read before the first render.
- **Evidence:** before the fix, the test that enters a wrong PIN recorded `from:messages`, `from:contacts`, `from:stories`, `channel:messages-…`, `from:chat_prefs` and more. After it, nothing from the real account loads at the lock screen or in decoy mode (empty call list).

### Test results: 50 / 50 pass
Real `App.tsx` gate (`Root`), real `ProProvider` and `PinGate`, Chromium. The account sign-in and Supabase were replaced by a stand-in that records every call. Each PIN was stored the way the app stores it (salted PBKDF2, 210,000 rounds).

| Area | Checks |
|---|---|
| Correct PIN | Locked at start. **Nothing from the real account loads before the PIN.** The correct PIN opens the real app; the counter stays at 0; no page errors. |
| Wrong PINs | 9876, 000000, 1235 and 12345 all open decoy mode. No "incorrect" message. The wrong PIN is counted and logged. No real-app screens appear. **No real data loaded** (no messages/contacts/profiles/groups/stories/events/channels/RPC/storage). **Sending in decoy mode never touches real conversations**; the message is stored with the decoy chats only. |
| Typo recovery | A typo opens decoy; leaving the app locks it at once even with 5-minute auto-lock. The real PIN then opens the real app, and the owner sees "1 wrong PIN was tried". The counter resets. The real app keeps its own auto-lock setting. |
| Repeated attempts | 5 wrong PINs start a wait (stored), but the screen shows no countdown and the keypad stays usable. **The correct PIN during the wait opens decoy** and isn't counted. A wrong PIN during the wait counts and lengthens it to 60 s. After the wait, the correct PIN opens the real app ("6 wrong PINs were tried"), and the counter and wait reset. |
| App restart | The wait survives a restart. Restarting after a real unlock, or from decoy mode, locks again. |
| Old data | An old decoy PIN hash is deleted on load; that PIN now opens decoy as a wrong PIN and is counted. An old-format real PIN still works and is upgraded to PBKDF2. |
| Fingerprint | A verified check opens the real app. **A rejected or cancelled check opens nothing (not decoy).** A result without the "user verified" flag opens nothing. A verified fingerprint still opens the real app during a wrong-PIN wait. These used a stand-in for the browser's credential API with the same responses as the device. |
| Inside the real app | Confirming log out with a wrong PIN shows "Incorrect PIN" and never opens decoy; the real PIN confirms. |
| Settings | No decoy PIN field; the explanation is shown. An invalid PIN is refused. A new PIN is saved only as a salted hash. No page errors. |

Plus: `tsc` 7 and `eslint` 23 (unchanged pre-existing issues), `vite build` passes, unit tests 15/15.

### Trade-offs and limitations (by design, stated plainly)
- **A mistyped PIN opens decoy mode,** not an error. Leave Chatter and come back to retry, or use the fingerprint. Settings explains this, but decoy mode itself never hints at it.
- **During a wrong-guess wait, even the correct PIN opens decoy mode.** This keeps the guessing limit without revealing it. A real user who mistyped 5 times sees decoy chats until the wait ends (30 s at first, up to 15 min), or uses the fingerprint.
- **Decoy mode is only as convincing as the fake chats you set up.** With none, decoy mode shows an empty inbox.
- **This lock lives on the device, as before.** Someone with full access to the phone's storage could still try offline guesses against the PIN hash, which is slow by design. Your real messages remain protected by your account sign-in on the server.
- **Shared app-wide settings:** in decoy mode, theme and interface changes (Settings → Interface/Appearance) apply to the whole app, including the real account's synced interface preferences. They contain no messages or contacts.
- **Not tested on a real phone.** Android's fingerprint prompt goes through the native plugin, which was tested earlier only with a stand-in.

---

## 9. Part C: lock timing and sign-in options

### What was asked
Let the user choose when Chatter locks after leaving it, including "only when the app is closed". Optionally save the password to Google and sign in automatically.

### What changed
| File | Change |
|---|---|
| `src/pro.tsx`, `src/App.tsx`, `src/components/ProSettings.tsx`, `src/entitlements.ts` | **When Chatter locks:** Immediately, after 30 seconds, 1 minute, 5 minutes or 15 minutes in the background, or **Only when Chatter is closed**. Opening the app again always asks for the PIN, and decoy mode still locks as soon as it's left, whatever the choice. |
| `src/signinPrefs.ts` (new), `src/components/SignInSettings.tsx` (new), `src/components/Settings.tsx` | **Settings → Privacy & security → Sign-in:**<br>• A note that you stay signed in after closing Chatter (that's how Supabase sessions already work).<br>• **Save password to Google** (off by default).<br>• **Sign in automatically** (off by default; needs saving on). |
| `src/components/AuthScreen.tsx` | A "Save my password to Google Password Manager" box on the sign-in form. After a **successful** sign-in, the password is handed to the browser's password manager, which asks the user to confirm. With auto sign-in on, a saved password signs in by itself. The fields carry `username` / `current-password` hints so password managers and Android Autofill recognise them. |
| `src/auth.tsx` | Logging out tells the browser not to sign back in silently; it asks first next time. |

**How it's stored:** the password is kept by Chrome/Google Password Manager, **never by Chatter** (tested: it isn't in the app's storage). The PIN lock still applies after an automatic sign-in.

### Test results: 33 / 33 pass
Real app gate, sign-in screen and settings in Chromium, with a fake clock and stand-ins for Chrome's password manager API.
- **Lock timing:** Immediately locks on leaving. At 30 s, 20 s away stays open and 31 s locks. At 15 min, 14 min stays open and 15 min locks. "Only when closed": 3 hours in the background stays open, and reopening locks. Decoy mode still locks on leaving. All six options are shown, the choice is saved and shown as selected. No page errors.
- **Save password:** the box is off by default, and nothing is saved when it's off. A wrong password is never saved. A successful sign-in hands the password to the password manager, and Chatter itself doesn't store it. The fields are marked for password managers.
- **Auto sign-in:** it signs in with the saved password. When it's off, nothing is read and nothing happens. Log out blocks silent re-sign-in.
- **Settings:** auto sign-in needs saving first; turning saving off also turns auto sign-in off. Without a password manager (the Android web view), it explains Android Autofill and auto sign-in stays off.

Plus: `tsc` 7 and `eslint` 23 (unchanged pre-existing issues), `vite build` passes, unit tests 15/15.

### Limitations
- **The Android app can't use Google Password Manager directly.** Its web view has no password-manager API, so "Sign in automatically" isn't available there. Android's own Autofill (Google) can offer to save and fill the password on the sign-in form, if Autofill is on in phone settings. That depends on the phone and wasn't tested here.
- Auto sign-in in Chrome needs the user to be signed in to Chrome with password saving on.
- Not tested on a real phone.

---

## 10. Part D: Message Control Center, Story Maker and stories panel

### What was asked
- **Message Control Center:** per-chat expiry, block copy/forward, allow or block attachment downloads, read receipts and typing indicator controlled separately.
- **Story Maker:** gallery photos → animated GIF, text, stickers, effects, drafts, reuse edits, who can view each story.
- **Stories panel** with GIFs/photos/videos/music, text, emoji replies, GIF and voice replies, replying with your own story, private or public replies.

### How it works
**Message controls** (timer icon in a chat → *Message controls*):
- **Disappearing messages:** off / 1 h / 24 h / 7 d / 30 d. The setting is a message in the chat, so both people share it and the newest rule wins. Each new message carries an expiry time; apps hide expired ones. A timer shows on each message ("5h").
- **Block copying and forwarding:** messages you send can't be selected, copied or dragged out in the other person's Chatter, and the menu says "The sender turned off copying".
- **Allow saving attachments:** when off, the other person can view or play files and voice messages but gets no Save button, no download control, no drag or right-click on pictures.
- **Read receipts and typing indicator:** two independent per-chat settings (Default / On / Off), with global defaults in Settings → Privacy & security (typing indicator is a new global switch).
- These per-message rules ride at the top of the message in a hidden marker line (`messageMeta.ts`). Previews and notifications never show it.

**Story Maker** (Create story): pick several photos → animated GIF (Slideshow / Slow zoom / Crossfade, speed, effects Mono/Sepia/Vivid/Warm/Cool/Faded) or a single **picture**; add text (colour, size, background) and **emoji stickers** and drag them on the live preview; or pick a **ready-made GIF**, or a **video** (up to 8 MB). **Add music** (a song from the phone, up to 4 MB; plays only when a viewer taps play). Drafts (kept on the device, with photos, edits, caption, audience, format, video and music), reusable **templates** ("Save as template"), export with **Save to device**. GIFs are encoded on the device (`gifenc`, MIT licence) and shrunk if needed to stay under 2 MB.

**Who can see a story:** Everyone I chat with · Close friends (a saved list) · Only… · Everyone except…

**Stories panel** (the "All stories" tile in the stories row): a grid of every current story with its photo/GIF/video/music or text; tap to open.

**Replies** (on any story you can see): text, emoji, GIF, picture, voice, or **"Reply with my story"** (links one of your own stories; tapping it opens that story if the viewer is allowed to see it). Each reply is **Private** (only the story's author sees it, the default) or **Public** (everyone who can see the story).

### Files
New: `messageMeta.ts`, `chatRules.ts`, `expiry.ts`, `components/MessageControls.tsx`, `storyMaker.ts`, `storyFormat.ts`, `storyDrafts.ts`, `components/StoryMaker.tsx`, `supabase/migrations/message_controls_and_stories.sql` (**not applied**). Changed: `ChatWindow.tsx`, `EditSheets.tsx`, `ChatList.tsx`, `FileMessage.tsx`, `VoiceMessage.tsx`, `Stories.tsx`, `social.ts`, `realChats.ts`, `App.tsx`, `Settings.tsx`, `prefs.ts`, `data.ts`, `attachmentFormat.ts`, `vite-env.d.ts`, `package.json` (adds `gifenc`).

### Database updates (applied by you in the Supabase SQL Editor on 17 October 2026)
Both `chat_attachments.sql` (private chat files, 1 MB) and `message_controls_and_stories.sql` below were applied to the live project. **Checked afterwards with read-only queries:** both buckets exist and are private (1 MB and 8 MB); every new column, policy, trigger and constraint is present; row-level security is on for `story_replies`; the cleanup job `chatter-purge-expired` is scheduled every 10 minutes; `anon` and `authenticated` cannot run the cleanup function or (for anonymous users) the block-lookup function. **Not yet done: a real two-account test on phones** (audience rules, private vs public replies, expiry deletion, file access between two people). Before applying, a bug in this SQL was found and fixed in review: a story's attached song could not be opened by viewers (now `music_key`), and stories could point at other people's files (now constrained to the author's own folder).

#### What the update contains (`message_controls_and_stories.sql`)
Adds `expires_at` to messages and group messages with a restrictive policy so expired messages are never returned, a trigger so the expiry can't be pushed later, and a purge job every 10 minutes (pg_cron). Adds story `audience`, `audience_ids` and `media_key`, with new read/react rules that honour the audience. Adds `story_replies` (public/private rules enforced by row-level security; "reply with my story" must link the replier's own story, checked by a trigger). Adds a private `story-media` bucket (8 MB; the app limits photos/GIFs to 2 MB and music to 4 MB). All 50 statements parse with PostgreSQL's own parser (`pglast`); it was then applied (see above).

### If the database update is missing (tested; no longer the case on the live project)
- Disappearing messages are hidden by the apps but stay in the database.
- Text and emoji **private** story replies are sent as a direct message to the story's author.
- Photo/GIF/video/music stories, audiences and public replies show "needs the stories database update", and the maker stays open with the work kept (so you can still Save draft or Save to device).

### Test results
**Browser (real components, Chromium, stand-ins for the server and sign-in, real microphone stream): 55 / 55 on two runs in a row. Unit tests: 21 / 21.**
- **Message controls (21):** expired messages vanish at once; time-left shown; the marker line is never shown; choosing 24 h posts a shared rule note; later messages carry a 24 h expiry; protection flags are added; a protected message can't be selected; Copy is replaced by "sender turned off copying"; no Save on a voice message from a no-download sender; receipts and typing are separate; no page errors.
- **Story Maker:** several photos open the preview; text, sticker, effect and motion work; templates and drafts save and reopen; **Save to device produces a real animated GIF (checked: `GIF89a` header, 3+ frames, under 2 MB)**; posting uploads to my private story folder with the caption; the GIF plays in the viewer; a single photo can post as a JPEG picture; a video over 8 MB and a song over 4 MB are refused; a video plus music uploads both and the viewer shows the video with a play button for the song (it doesn't autoplay).
- **Replies:** private by default and saved as private; public emoji reply; GIF and picture replies uploaded under `reply/<story>/<me>/`; a non-GIF refused in the GIF slot; voice reply; reply with my story links my story's id and shows in the replies; no such button when I have no story; the direct-message fallback before the update.
- **Audiences:** close friends with an empty list is refused; the list is saved for next time; "close" and "everyone except" save the right people.
- Plus: `tsc` 7 and `eslint` 23 (same pre-existing issues), `vite build` passes.

### Bugs found by testing and fixed
1. **Expired messages could stay visible** for up to 5 seconds (or until the next tick) if the first timed message arrived after the chat was already open. The clock now catches up immediately.
2. **Drafts forgot Picture vs GIF** for single photos (always reopened as GIF). Drafts now keep the format, and also a video or song.
3. **The stories grid loaded full video players** with controls for every card. Cards now show a quiet preview.

### Limitations (stated plainly)
- **Not tested on real accounts:** the database update is applied, but cross-device behaviour (audience rules, public vs private visibility enforced by the server, server-side deletion of expired messages) is **verified only in the browser with a stand-in server**, not against Supabase.
- **Copy/forward/download blocks and disappearing messages are honoured by Chatter apps only.** Nothing stops screenshots, a second phone filming the screen, or an older app version that ignores the marker. This is why the controls say so. Disappearing messages are hidden by the apps and deleted by the server only after the update is applied.
- **Block copying** prevents selecting and copying text in the app; it doesn't stop someone retyping it.
- **The stories "everyone except / only / close friends" list is chosen by you per story; the person you exclude is not told.**
- **Videos aren't re-encoded or trimmed** in the app: pick a video under 8 MB (the phone's gallery editor can trim it). Music is a file from the phone; **only share music you have the right to share**.
- **Story files** are private and opened by short-lived links; the storage rules honour the audience. Deleting a story removes the post, but the stored file is cleaned up by a separate job (SQL can't delete storage files), so the file can remain unreadable in the bucket until cleaned.
- **Group chats:** disappearing messages and protections apply to messages you send; receipts/typing per-chat settings apply to one-to-one chats (groups have no read ticks).
- **No story view counts or "seen by" list** yet.
- Not tested on a real phone. Not built into an APK yet.
