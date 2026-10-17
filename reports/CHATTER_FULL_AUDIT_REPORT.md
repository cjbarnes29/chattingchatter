# Chatter — Full Audit Report

- **Date:** 17 October 2026
- **Audited code:** `main` at `f43ecfb` (includes PR #8), plus the fixes on branch `ccr-588e02cb-4exl8k`
- **Live backend checked:** Supabase project `jirquumzasixrqwxulmg` (read-only queries, plus test transactions that were **rolled back**)
- **Not available here:** a phone or emulator, the Android SDK, test accounts, the Netlify site, direct HTTPS to Supabase (the sandbox proxy blocks it)

Statuses: **PASS** (tested and worked) · **PARTIAL** · **FAIL** (tested and broken) · **NOT IMPLEMENTED** · **NOT TESTED** · **BLOCKED**.
"Code-verified" means I read the code and the logic is right, but I did not run it. It is never counted as PASS.

---

## 1. Executive summary

- **The most serious problem is in the live database, not the code.** The repo contains security migrations (`fix_security_and_bugs.sql`, `receipts_and_typing.sql`) that were **never applied to production**. I confirmed in the live database that:
  - **Anyone with the public app key, without signing in, can check whether an email is registered and get that person's name, photo and "about" text.** A test lookup returned all 3 registered profiles.
  - **The person who receives a message can rewrite its text and timestamp.** Tested in a rolled-back transaction: the body changed to "FORGED by recipient" and the date to 2000-01-01.
  - Editing a story is broken, blocked users can still send call invites, and the group-message and story length limits are missing.
- **Real chats were shown for one render before the PIN screen.** This was confirmed in a browser in 3 out of 3 runs on the old build. It is **fixed**: 0 out of 3 on the new build.
- **Message history loaded the *oldest* 1000 messages**, so once an account had more than 1000, new messages stopped appearing after a reload. Confirmed with SQL on the real schema. **Fixed.**
- **Ghost Canvas, typing indicators and group calls use open realtime channels.** Anyone who knows the user or group IDs can listen in or join, including people removed from a group. This was found by reading the code; it was not exploited live. It needs a database change to fix (Realtime Authorization), so it is **unresolved**.
- **The APK downloads are bad.** `website/chatter.apk` is corrupt: it is truncated and will not install. `public/chatter.apk` is from 15 October and has none of the 16–17 October fixes. Main's latest CI run (#19) **failed**, so the stable `latest-apk` release was not rebuilt from `main` after PR #8. The open PR #9, from another session, addresses all three.
- Typecheck went from 7 errors to 0, lint from 13 errors to 0, and there are now 17 unit tests plus 3 browser lock tests, all passing.
- **Release readiness: not ready for beta or production.** It is OK for internal testing only after the database migrations are approved and applied.

## 2. Project structure and technology stack

| Area | Detected |
|---|---|
| Web app | Vite 5, React 19, TypeScript 5, Tailwind 3, lucide-react |
| Backend | Supabase (Auth, Postgres with RLS, Realtime postgres_changes + broadcast/presence, Storage `avatars` bucket) |
| Android | Capacitor 8, `app.chatter.messenger`, minSdk 24 / target 36, custom `ChatterDevicePlugin` (BiometricPrompt, notifications, file save) from PR #8 |
| Desktop | Electron 44 config (`electron/main.cjs`), not audited in depth |
| Hosting | Netlify (`netlify.toml`, Node 22, SPA redirect); separate static site in `website/` |
| CI | `.github/workflows/release.yml`: builds a debug APK (or a release APK if signing secrets exist) and publishes `latest-apk` (main) / `test-apk` (branches) |
| Calls | WebRTC with Google STUN only (no TURN) |
| Local storage | PIN hashes, decoy chats, Pro state, masterpieces, edits, prefs: all in `localStorage` |

Main source: `src/App.tsx`, `src/auth.tsx`, `src/pro.tsx`, `src/realChats.ts`, `src/social.ts`, `src/groupCall.ts`, `src/components/GhostCanvas.tsx`, `src/ghostSession.ts`, `src/pinLock.ts`, `src/biometric.ts`, `src/decoyStore.ts`, `supabase/migrations/*.sql`.

## 3. Feature inventory

Taken from the code, `.genvibe/memory.md`, `RELEASING.md`, `src/entitlements.ts`, the commit messages and PR #8.

Authentication and account: email/password sign-up with emailed code, sign-in, password reset by code, password change by code, email change (gated by a security question), security question, session persistence, logout behind the PIN, Terms acceptance.
Profile: photo upload, name/nickname/age/status/about, presence (auto / always online / appear offline).
Messaging: 1:1 chats, realtime receive, typing indicator, read receipts (with a privacy toggle), delivery status, new chat by email, contacts (add, favourite, block, remove, import from phone), archive/pin/delete history, local message edits/tags/reactions, quick reply notifications, sounds.
Groups: create, rename, members and roles, leave/delete, polls.
Stories: post, react, edit, delete, expiry.
Calls: 1:1 voice/video, group voice/video.
Calendar: shared events and reminders.
Privacy: PIN lock, wrong-PIN lockout, intruder alert, decoy PIN and decoy chats, editing decoy chats/fake people, confidential chats, auto-lock, lock now, shake to lock, biometric unlock (Pro) and biometric for confidential chats, Android runtime permission prompts.
Ghost Canvas: live drawing, notes, stickers/collage, tic-tac-toe, Connect Four (Pro), waiting/invite/timeout/exit, hold-to-stay, close-when-I-leave, pan/zoom, brushes, eraser/undo/redo, encrypted masterpieces (save, open, export, import).
Pro: plans, 7-day trial, focus scheduling, entitlements.
Interface: themes, layout, dashboard, presets, synced through `ui_prefs`.
Distribution: PWA, APK, Netlify site, static website.

## 4. Feature-by-feature verification

| # | Feature | Status | Evidence / notes |
|---|---|---|---|
| 1 | Sign-in / sign-up screens render (phone 390px, desktop 1280px) | PASS | Playwright smoke test of the built app: rendered, no page errors, no horizontal overflow. Only the blocked Google Fonts requests failed. |
| 2 | Sign-up with emailed code, sign-in, reset/change password | NOT TESTED | Needs a real mailbox and Supabase Auth, which is unreachable from the sandbox. The code was reviewed and looks fine. |
| 3 | Session persistence on reload | PASS (mocked backend) | Browser tests seed a stored session; the app restores it and shows the lock screen. |
| 4 | Email change behind a security question | PARTIAL | The question is checked only in the browser. `supabase.auth.updateUser({ email })` can be called directly. `check_security_answer` has no rate limit. |
| 5 | Terms page and sign-up agreement | PASS | `/terms` renders (smoke test). |
| 6 | Profile edit and photo upload | NOT TESTED | Needs an account. RLS reviewed: users can update only their own profile; avatar uploads are limited to `<uid>/` folders. |
| 7 | Presence: appear offline | PARTIAL → fixed in code | It still sent a `last_seen` heartbeat every 45 s, which any signed-in user can read. Fixed (no heartbeat while appearing offline); code-verified. `age` and `last_seen` are still readable by all signed-in users. |
| 8 | 1:1 send/receive and realtime | NOT TESTED live | Needs two accounts. Found and fixed the 1000-message history bug (§11). A failed send silently removes the message without telling the user (unresolved). |
| 9 | Typing indicator | NOT TESTED | It is an open broadcast channel `typing:<idA>-<idB>`, so it can be faked by anyone who knows the IDs. |
| 10 | Read receipts and the toggle | NOT TESTED live | Code-verified: with the toggle off, read state is kept on this device only. |
| 11 | Delivery status (sent / delivered) | PARTIAL | Every sent message shows "delivered" as soon as it is saved on the server. `delivered_at` is never written, and the column does not exist in production. |
| 12 | Contacts, block, archive, pin, delete history | NOT TESTED live | RLS reviewed: the owner only. The live message insert policy does enforce blocks. |
| 13 | Groups and polls | NOT TESTED live | RLS and the RPC functions were reviewed and check membership. |
| 14 | Story edit | FAIL (production) | There is no UPDATE policy on `stories` in the live database (policy dump), so edits silently do nothing. The fix is in the repo but not applied. |
| 15 | Stories post/react/delete | NOT TESTED live | RLS reviewed. |
| 16 | 1:1 calls | NOT TESTED | Needs two devices. STUN only, with no TURN server, so calls often fail on mobile networks. Live: blocked users can still send call invites (missing policy). |
| 17 | Group calls | NOT TESTED | Signalling uses the open channel `gcall:<groupId>`. A non-member or removed member who knows the ID can join and receive audio/video. |
| 18 | Calendar events and reminders | NOT TESTED | RLS reviewed: the creator manages, both people can read. |
| 19 | PIN lock at launch | PASS (after fix) | Browser test `tests/browser/pingate.cjs`. Old build: real app rendered before the PIN screen (3/3). New build: PIN screen only (3/3). Wrong PIN stays locked; right PIN unlocks. |
| 20 | Wrong-PIN lockout | PASS | `tests/browser/lockout.cjs`: after 5 wrong PINs the message shows, keypad clicks are refused, keyboard entry is refused during the wait, the counter is saved (`failedAttempts: 5`), and the right PIN works after the wait. |
| 21 | PIN hashing (salted PBKDF2, legacy upgrade) | PASS | `tests/pinLock.test.ts` (5 tests). |
| 22 | Decoy PIN shows only decoy chats | PASS | `tests/browser/decoy.cjs`: decoy chats are shown and **0 requests** go to the real data API in decoy mode. |
| 23 | Decoy limits (free 1, Pro unlimited) | PASS | `tests/entitlements.test.ts`. |
| 24 | Editing decoy chats / fake people | NOT TESTED in UI | Code-verified. The local edit overlay (`chatter.edits.v1`) is shared by every account on the device, not per account (P3). |
| 25 | "Random PIN" | NOT IMPLEMENTED | No such code exists (`grep -i "random ?pin"` finds nothing). |
| 26 | Incorrect PIN activates decoy | NOT IMPLEMENTED (by design) | A wrong PIN counts as a failed guess; only the decoy PIN opens the decoy. |
| 27 | Biometric unlock (web WebAuthn and Android BiometricPrompt) | BLOCKED | Needs a phone with a fingerprint or face enrolled. Code-verified: only `r.ok` unlocks; a failure, cancel or lockout opens nothing; on the web the user-verified flag is checked. |
| 28 | Confidential chats | NOT TESTED | Code-verified: previews are hidden in notifications. |
| 29 | Auto-lock, lock now, shake to lock | NOT TESTED | Needs a device (visibility and motion events). |
| 30 | Ghost Canvas wait / timeout / exit | PASS (logic) · NOT TESTED (two live users) | `tests/ghostSession.test.ts` (8 tests): waiting alone never counts down or closes; the card appears after 10 s; Keep Waiting, peer leave/return, connection failure with retry, invite cooldown and "close when I leave" all behave as specified. |
| 31 | Ghost Canvas privacy | FAIL (design) | The open channel `ghost:<idA>_<idB>` can be read by anyone who knows both IDs, without joining presence. |
| 32 | Encrypted masterpieces | NOT TESTED | Code-verified: AES-GCM with a PBKDF2-derived key (150k iterations). |
| 33 | Focus scheduling | PASS | `tests/entitlements.test.ts` (overnight windows, days off, meeting mode). |
| 34 | Pro / trial | PARTIAL | Works in the app, but it is stored only on the device: clearing storage restarts the trial. Payments are not connected (documented). |
| 35 | Interface prefs sync | NOT TESTED live | RLS reviewed: own row only. |
| 36 | Android permissions (manifest) | PASS (static) | See §8. |
| 37 | Android runtime permission prompts | BLOCKED | Needs a device. PR #8 reports 29/29 browser tests with a stand-in plugin (not re-run here). |
| 38 | APK build | PARTIAL | CI branch runs 20–22 succeeded. **Main run #19 failed** in the APK report step (see §15). Could not build locally (no Android SDK). |
| 39 | APK download on website | FAIL | `website/chatter.apk` is corrupt ("End-of-central-directory signature not found"). `public/chatter.apk` is stale (15 Oct): none of the PIN, decoy or Ghost fixes are inside. |
| 40 | Netlify deployment | BLOCKED | The Netlify connector lists no sites for this account, and the sandbox proxy refuses `chattingchatter.netlify.app` (403). |

**Totals (40 features):** PASS 11 (#30 is logic-only, #3 used a mocked backend, #36 is a static check) · PARTIAL 5 · FAIL 3 · NOT IMPLEMENTED 2 · NOT TESTED 16 · BLOCKED 3.

## 5. Previously reported bugs

| Bug (source) | Fix in code? | Verified status | Evidence |
|---|---|---|---|
| Recipient could rewrite received messages (`fix_security_and_bugs.sql` #1) | Yes (migration) | **FAIL in production** | Live: `authenticated` has UPDATE on `messages.body/created_at/sender_id`. Rolled-back test: the recipient changed the body and date. |
| Story edit silently failed (#2) | Yes (migration) | **FAIL in production** | Live policy list has no UPDATE policy on `stories`. |
| Email enumeration through `find_profiles_by_emails` and `create_group` (#3) | Yes (migration) | **FAIL in production** | Live `has_function_privilege('anon', …)` = true. Anon lookup returned 3/3 profiles (rolled back). |
| Missing size limits (#4) | Yes (migration) | **FAIL in production** | The live constraints list has no `group_messages_body_len`, `stories_body_len`, `groups_name_len` or `story_reactions_emoji_len`. |
| Blocked users could send call invites (#5) | Yes (migration) | **FAIL in production** | The live `send signals` policy is only `sender_id = auth.uid()`. |
| Delivery receipts column (`receipts_and_typing.sql`) | Yes (migration) | **FAIL in production** | `messages.delivered_at` does not exist live. |
| Rejected fingerprint opened decoy (fe85bc8) | Yes | Code-verified, BLOCKED for device test | `PinGate.tryBio` calls `onUnlock` only on `ok`, and never `onDecoy`. |
| Unsalted PIN hashes (fe85bc8) | Yes | **PASS** | Unit tests, including legacy hash upgrade and role binding. |
| Unlimited PIN guesses / lockout lost on reload (fe85bc8) | Yes | **PASS** | Browser lockout test; counter saved in storage. |
| Decoy PIN reset the guess counter (fe85bc8) | Yes | Code-verified | `verifyPin` does not reset on decoy. |
| Real PIN could equal the decoy PIN (fe85bc8) | Yes | Code-verified | `ProSettings.save` checks both directions. |
| Decoy chats per device, not per account (fe85bc8) | Yes | Code-verified | `decoyStore` keys by owner ID. |
| Trial could be restarted forever / lasted a year (fe85bc8) | Yes | PARTIAL | 7 days, once per account **on this device**; clearing storage resets it. |
| Large canvases crashed when saved (fe85bc8) | Yes | Code-verified | Chunked `toB64`. |
| Ghost Canvas closed after ~10 s while waiting (7a87c03) | Yes | **PASS (logic)** | 8 reducer/rule tests; component wiring reviewed. Not tested with two live users. |
| Sign-up dead end for unconfirmed accounts (d7432d6) | Yes | Code-verified, NOT TESTED | Needs a real mailbox. |
| Terms not pushed (memory) | — | **PASS** | Present on `main`. |
| APK replacement not confirmed (memory) | — | **FAIL** | Website APK corrupt; public APK stale. |
| Netlify Node ≥ 22 deploy error (PR #1) | Yes | Config present, deploy BLOCKED | `NODE_VERSION = "22"` in `netlify.toml`. |

## 6. Newly discovered bugs

| ID | Sev | Bug | Status |
|---|---|---|---|
| N1 | P0 | Production database is missing two security migrations (see §5 and §9) | **Unresolved: needs your approval to apply** |
| N2 | P1 | Real app rendered for one render before the PIN screen (`ProProvider` loaded PINs in an effect) | **Fixed**, verified in a browser |
| N3 | P1 | Open realtime channels for Ghost Canvas, typing, group-call signalling and ringing; non-members can listen or join | Unresolved (needs Realtime Authorization: database policies plus client change) |
| N4 | P1 | Chat history query kept the oldest 1000 messages and dropped newer ones | **Fixed**, verified by SQL |
| N5 | P2 | Lock state was not tied to the account: after logout, another account signing in on the same device started "unlocked" | **Fixed**, code-verified; lock tests still pass |
| N6 | P2 | "Appear offline" still published `last_seen` | **Fixed**, code-verified |
| N7 | P2 | `age`, `last_seen` and presence are readable by every signed-in user, not just contacts | Unresolved |
| N8 | P2 | A failed send removes the message silently | Unresolved |
| N9 | P2 | "Delivered" is shown for every sent message | Unresolved |
| N10 | P2 | Security-question gate is client-side only; no rate limit on answers | Unresolved |
| N11 | P2 | No TURN server, so calls fail behind many mobile/carrier NATs | Unresolved |
| N12 | P2 | `website/chatter.apk` corrupt; `public/chatter.apk` stale and was being packed inside the APK | Unresolved on `main`; PR #9 removes both |
| N13 | P2 | Main CI run #19 failed (APK report step), so `latest-apk` was not rebuilt from `main` after PR #8 | Unresolved on `main`; fix is in PR #9 (commit `4035512`) |
| N14 | P2 | `android:allowBackup="true"` with a debuggable debug APK: PIN hashes, decoy data and the Supabase session can be copied off the phone with adb | Unresolved (set `allowBackup="false"` and ship release-signed builds) |
| N15 | P3 | `tsc` failed with 7 errors; ESLint had 13 errors | **Fixed** |
| N16 | P3 | Local edit overlay is shared by all accounts on the device | Unresolved |
| N17 | P3 | Single 814 kB JS bundle | Unresolved |

## 7. Security and privacy findings

**Critical / high**
1. **Unauthenticated email lookup (P0, confirmed live).** `find_profiles_by_emails` can be executed by `anon`. The anon key ships in the app (`src/supabase.ts`), so anyone can test emails and get name, photo and "about".
2. **Message tampering by the recipient (P0, confirmed live).** Full UPDATE privilege on `messages` plus the `recipient marks read` policy lets the recipient change body, time and sender of messages sent to them. This breaks chat integrity (for example, faked evidence).
3. **Open realtime channels (P1, code review).** `ghost:*`, `typing:*`, `gcall:*` and `gring:*` are public broadcast/presence channels. The Ghost Canvas is presented as private and vanishing, but a third party with both user IDs can receive every stroke and note. A removed group member can still join group calls.
4. **Lock-screen bypass for one render (P1, fixed).** See N2.

**Medium**
- Helper functions `can_see_story`, `is_blocked_pair`, `is_group_admin`, `is_group_member` and `create_group` can be executed by `anon` (Supabase advisor, 7 warnings).
- Supabase leaked-password protection is off (advisor).
- Presence and age are visible to every signed-in user (N7). The "appear offline" leak is fixed (N6).
- Email change can bypass the security question (N10).
- `allowBackup` plus a debuggable APK (N14).
- Pro and trial live only on the device. This is documented, and no extra data access depends on it.

**Low / informational**
- The anon key in the client is expected for Supabase; RLS is enabled on every public table.
- `user_security` and `chattingchatter` have RLS enabled with no policies, so direct access is denied. That is correct; `chattingchatter` is an unused empty table.
- The avatars bucket is public by design.
- Encryption claims: PINs use PBKDF2 (210k iterations, salted); masterpieces use AES-GCM. **Messages are not end-to-end encrypted.** They are protected by TLS and RLS only. I found no claim of end-to-end encryption, but any marketing should not imply it.
- No secrets, `.env` files or keystores are tracked (`.gitignore` covers them; `git log` shows no `.env`).

## 8. Android permissions and installation

Manifest on `main` (after PR #8): `INTERNET`, `MODIFY_AUDIO_SETTINGS`, `USE_BIOMETRIC`, `VIBRATE`, `RECORD_AUDIO`, `CAMERA`, `POST_NOTIFICATIONS`. CI's aapt2 dump on run #19 also shows `USE_FINGERPRINT` (from androidx.biometric) and `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. There are no storage, location or contacts permissions. Each permission maps to a feature, and none is excessive. Camera and microphone are marked `required="false"`.

Concerns: `allowBackup="true"` (N14). The default build is a debug APK, so it is debuggable and debug-signed (Play Protect may warn; PR #9 discusses this).

Installation on a device: **BLOCKED.** There is no Android SDK, emulator or phone here, and I did not install or launch an APK.

## 9. Backend, Supabase, RLS and integrations

- **Live schema vs repo:** `list_migrations` is empty; the SQL was applied by hand. The live database matches the repo **except** `fix_security_and_bugs.sql` and `receipts_and_typing.sql`, which are not applied (§5).
- **RLS:** enabled on all 17 public tables. Policies on messages, contacts, blocks, chat_prefs, events, groups/members/messages, polls, stories, reactions and ui_prefs scope access correctly to the owner, members or the people involved. Anon `select` on `messages` and `profiles` returned 0 rows (rolled-back role test).
- **New file `supabase/migrations/audit_hardening.sql` (not applied):** removes `anon` EXECUTE on the helper functions and keeps `authenticated`, so the RLS policies keep working.
- **Dry run of the three migrations:** I prepared a single transaction that applies all three, checks the results and rolls back. The call was **cancelled at the approval step and not retried**, so the migrations are **NOT TESTED** against the live schema. I confirmed afterwards that the database was unchanged.
- **Production writes made by this audit: none.** Every test write was inside `begin … rollback`. Afterwards `messages` still had 0 rows, and grants and policies were unchanged.
- **Realtime:** `postgres_changes` on messages and other tables is covered by RLS. Broadcast/presence channels are not (§7.3).
- **Netlify:** BLOCKED (no site visible to the connector; proxy refuses the host).

## 10. Build, lint, type-check and test results

| Check | Before | After | Command |
|---|---|---|---|
| Install | OK | OK | `npm ci --ignore-scripts` |
| Type-check | **7 errors** (unused vars, `useRef()` with no argument under React 19 types) | **0 errors** | `npm run typecheck` (new script) |
| Lint | **13 errors**, 10 warnings | **0 errors**, 10 warnings (fast-refresh and hook-dependency notices) | `npx eslint .` |
| Web build | OK (814 kB chunk warning) | OK | `npm run build` |
| Unit tests | none existed | **17/17 pass** | `npm test` (Node's built-in test runner) |
| Browser lock tests | none existed | pingate 3/3, decoy 1/1, lockout 1/1 pass | `tests/browser/*.cjs` (see README) |
| UI smoke (phone and desktop) | — | Renders, no page errors, no overflow | Playwright, ad-hoc (not committed) |
| Android build | — | BLOCKED locally; CI: branch runs 20–22 succeeded, **main run #19 failed** | — |

All checks were re-run after bringing in PR #8 (`f43ecfb`), with the same results.

## 11. Bugs fixed

| Bug | Root cause | Change | Verification |
|---|---|---|---|
| N2 PIN screen bypass for one render | `ProProvider` started with empty defaults and loaded the saved PIN in `useEffect`, so the first render with a user had `hasPins = false` and rendered `<App/>` | `src/pro.tsx`: load the account's data during render, keyed by email | Old build: `REAL_APP → PIN_GATE` (3/3). New build: `PIN_GATE` only (3/3). Wrong/right PIN behaviour unchanged. |
| N4 Newest messages missing after 1000 | `.order(asc).limit(1000)` keeps the oldest rows | `src/realChats.ts`: order descending, limit, then reverse | Rolled-back SQL with 1200 rows: old query includes the newest message = **false**, new query = **true** |
| N5 Unlock carried over to another account | `unlocked` state was not tied to the user | `src/App.tsx`: store `{uid, state}`; another uid reads as locked | Code-verified; all lock tests still pass |
| N6 Appear offline still sent `last_seen` | The heartbeat ignored `presence_mode` | `src/auth.tsx`: no heartbeat while appearing offline | Code-verified |
| N15 Type/lint errors | Unused code, `any`, React 19 `useRef` signature | `CallOverlay.tsx`, `ChatWindow.tsx`, `GhostCanvas.tsx`, `Innovations.tsx`, `edits.ts`, `groupCall.ts`, `social.ts`, `typing.ts`, `App.tsx` | `tsc` 0 errors, ESLint 0 errors, build OK |

Also added: `tests/` (unit and browser tests), `npm test` and `npm run typecheck` scripts, `supabase/migrations/audit_hardening.sql` (not applied) and this report. No security control was weakened.

## 12. Remaining issues and risks

N1 (production database), N3 (realtime channels), N7–N14, N16, N17. The largest risk by far is N1, which can be fixed in a few minutes once you approve it.

## 13. Tests blocked or not run

| Test | Why | What it needs |
|---|---|---|
| Real sign-up, sign-in, reset, email change | Supabase Auth unreachable from the sandbox; no mailbox | Two test accounts and inboxes |
| Live messaging, receipts, typing, groups, stories, calls, Ghost Canvas with two people | No second account or device | Two phones or browsers with test accounts |
| Biometric success/fail/cancel/no hardware | No hardware | A phone with fingerprint or face enrolled |
| Android permissions at runtime, APK install and launch | No SDK, emulator or device | A phone; the checklist is in `docs/ANDROID.md` |
| Netlify deploy | Not visible to the connector; host blocked | Netlify access, or check the dashboard yourself |
| Migration dry run | Cancelled at the approval step | Your approval |

## 14. Git and GitHub

- The repo has a GitHub remote, `cjbarnes29/chattingchatter`.
- The session started at `803d9a7`. Remote `main` moved to `f43ecfb` (PR #8) during the audit, and I fast-forwarded with no conflicts.
- Work branch: `ccr-588e02cb-4exl8k`. The final push status is in the summary at the end.
- **PR #9 is open on `ccr-1056779d-cbnqch` from another session.** It removes `public/chatter.apk` and `website/chatter.apk` and fixes the CI report step. My branch does not touch those files or the workflow, to avoid conflicts.
- No secrets, keystores or `.env` files were committed.

## 15. APK availability and installation

| Source | State |
|---|---|
| GitHub release `latest-apk` | `chatter.apk`, 21.5 MB, uploaded 07:58 UTC by branch run 17 (head `8276160`, before PR #8 changed branch builds to publish to `test-apk`). It has not been rebuilt from `main`, because main run #19 failed. |
| `public/chatter.apk` (served at `/chatter.apk`) | Valid zip, last changed 15 Oct. It **does not contain** any of the 16–17 Oct code (checked for the PIN-hash, lockout, confidential-chat and Ghost-waiting strings). |
| `website/chatter.apk` | **Corrupt**: 1.9 MB, no ZIP central directory, cannot be installed. |
| Installed on a device | **Not done** (no device). |

## 16. Prioritized next actions

1. **Approve applying the database migrations**: `fix_security_and_bugs.sql`, then `receipts_and_typing.sql`, then `audit_hardening.sql`. This fixes N1 and the anon advisor warnings. I can do it with your approval; a dry run inside a rolled-back transaction should come first.
2. Merge PR #9 (removes the broken/stale APKs and fixes the CI step), then confirm a green `main` run and a fresh `latest-apk`.
3. Review and merge this branch's fixes (PIN-gate bypass, message history, lock state per account, presence).
4. Move broadcast channels to private Realtime channels with `realtime.messages` RLS policies (members/participants only), and update the client to `config: { private: true }`.
5. Add a TURN server for calls.
6. Set `android:allowBackup="false"` and add the release-signing secrets.
7. Show an error and a retry when a send fails; show "sent" until the message is actually delivered.
8. Turn on Supabase leaked-password protection, and move the security-question check for email change to the server.
9. Run the device checklist in `docs/ANDROID.md` on a real phone, with two test accounts.

## 17. Release readiness

| Stage | Ready? | Why |
|---|---|---|
| Internal testing | **Yes, once step 1 is done** | Core flows build and the lock/decoy logic is tested. The production database is currently unsafe. |
| Beta | **No** | N1 and N3, broken APK distribution, failing `main` CI, and no device testing. |
| Production | **No** | All of the above, plus no TURN, no billing, and no end-to-end encryption. |
