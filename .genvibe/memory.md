<!-- genvibe-memory covers:eQABWpkcw9VdW7JK -->
## What this app is
Chatter is a messaging app with chat lists, live conversations, privacy and engagement features, plus Ghost Canvas, an ephemeral shared drawing and play space. Chatter Pro is a paid tier for privacy, canvas and power features. It is a Vite + React installable PWA, with a Capacitor Android project and public landing site.

## Built so far
- Chat lists, conversations, search, pinned chats, unread badges, delivery/read ticks, Settings, dark mode, private-message locks, decoy PIN profiles, smart replies, voice-to-text, Timeline Jump, tags and emoji engagement.
- Supabase email/password accounts, persistent sessions, profiles, messaging, password-reset email OTP and profile-photo storage. Friend-email chats are restricted to participants; profile creation and case/space-insensitive email lookup are fixed.
- Contacts: add by email, import registered phone contacts on Chrome for Android, favorite, block/unblock, archive/unarchive, delete chat history and “People I added.” Blocked users cannot message; archived chats have a separate list.
- Ghost Canvas has private one-to-one rooms, real-time strokes, notes, collage stickers, cursors and presence; six ink colours, brush sizing, undo, vanish timers and fading chat notes. Tic-tac-toe and Connect Four sync between players, with computer-opponent fallback. Pro adds pan/zoom, specialty brushes, shared media player and calendar.
- One-to-one calendars, group chats, configurable-duration stories, and voice/video call flows are implemented; backend/live behavior needs verification.
- Pro costs $2.99 monthly or $24.99 yearly, with a 7-day trial; payments are not connected.
- Android landing page has QR code, APK install guide and direct download at `/chatter.apk`; GitHub: `github.com/cjbarnes29/chattingchatter`.
- Gestures, editable decoy profiles, contact nickname/photo editing and device-only message text/time editing are available. PIN lock re-prompts after returning to app and remains enforced after Pro lapses if set.
- Settings → Sounds supports picking an audio file from the phone, previewing/resetting it, and toggling message sounds. Sounds play for new messages in unmuted chats.
- Chat palette sheet supports per-chat sound, preset/solid/photo-gallery wallpapers, and adding chats or groups to Favorites. Inbox tabs: All, Favorites, Groups and Unread; favorited chats show a star.
- Groups have an avatar badge, a New group button by the tabs, and can be pinned.
- GitHub sync setup added: `yarn sync` (optionally `yarn sync "message"`) commits and pushes to `main`. `.gitignore` excludes `.env`, `node_modules`, build folders and signing keys. Sync uses a GitHub token without saving it in code. **First sync has not run:** no `GITHUB_TOKEN` secret is configured.
- Android splash: `android/app/src/main/res/drawable/launch_bg.xml`. `.github/workflows/release.yml` is APK-only, logs diagnostics, and runs on pushes to `main`; build success remains unverified.

## Design
- “Ink & Ember”: warm bone, deep ink and vermilion in light mode; midnight violet-black and ember glow in dark mode. Bricolage Grotesque; peach/cream tailed bubbles and contour-line backgrounds.
- Ghost Canvas: green-tinted dark theme and mint ink. Inbox controls right; conversation actions left; contact name/avatar right.

## Structure
- Vite, React, Tailwind 3. Main files: `src/App.tsx`, `src/index.css`, `src/data.ts`; components in `src/components/`.
- Pro/auth/backend: `src/pro.tsx`, `src/components/ProSettings.tsx`, `src/auth.tsx`, `src/supabase.ts`; chat/social: `src/realChats.ts`, `src/social.ts`, `src/contacts.ts`.
- Calendar: `src/calendar.ts`, `src/components/CalendarPanel.tsx`. Other key files: `src/components/ChatWindow.tsx`, `GhostCanvas.tsx`, `FeatureSettings.tsx`, `Settings.tsx`, `src/prefs.ts`.
- Styling additions: `src/chatStyle.ts`, `src/components/ChatStyleSheet.tsx`. Other updated files: `src/data.ts`, `src/components/FeatureSettings.tsx`, `ChatWindow.tsx`, `ChatList.tsx`, `src/App.tsx`.
- Sync files: `scripts/sync.sh`, `.gitignore`, `package.json`; workflow: `.github/workflows/release.yml`.
- `npx tsc --noEmit -p .` completed cleanly.

## User preferences & rules
- Wants beginner-friendly, correct step-by-step instructions in order; says they are a newbie.
- Wants a distinct design from WhatsApp, opposite-side button placement and reduced copyright similarity.
- Wants release work focused on direct APK downloads; no PC versions for now. Wants Netlify landing page and “Open web app” to start the messenger.
- Wants Pro to offer “superpowers—not just remove ads”; pricing/trial unchanged.
- Wants future updates/download-info website, groups, configurable story visibility/reactions, usable calls and create/edit/delete settings; check issues before release.
- Requested workflow edits with copy/paste instructions. Earlier reported recurring error; later said GitHub is fixed.
- Asked how to update changes on GitHub automatically; approved the proposed sync plan and asked to build it without further questions.

## Open issues & next ideas
- Create a fine-grained GitHub token for `chattingchatter` with Contents read/write access; save it in Cloud → Secrets as `GITHUB_TOKEN`, then run `yarn sync` and verify the push and automatic APK workflow.
- Investigate recurring build error using the full GitHub workflow log; APK build success remains unverified.
- Deploy to Netlify and test `/chatter.apk`, APK artifact and landing-page flow. Rebuild older Android APKs; test password reset and verify `{{ .Token }}`, Site/Redirect URLs, SMTP/Brevo and email delivery.
- Verify releases, artifacts, signing and Android setup.
- Test Ghost Canvas with two accounts, Supabase Realtime for messages, and groups, stories and calls with backend/database policies.
- Determine whether smart replies, voice-to-text and biometrics are fully functional; service worker has no push handling or notifications. Verify biometric, tag and microphone behavior.
- Verify pin-color options; implementation was not confirmed.
