# Chatter: full audit report

**Date:** 17 October 2026 · **Branch:** `ccr-1056779d-cbnqch` · **Status:** committed locally only. Not pushed, not deployed, and the database is unchanged.

This report covers one change set:

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
2. **Push** this branch, so CI builds the APK (including the Java change) and the PR can be reviewed.
3. **Install and test** the resulting APK on a phone.
