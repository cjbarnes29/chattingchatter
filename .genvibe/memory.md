<!-- genvibe-memory covers:e5T1AxpYmMp7xO0t -->
## What this app is
Chatter is a messaging app with chat lists, live conversations, privacy and engagement features, plus Ghost Canvas, an ephemeral shared drawing and play space. Chatter Pro is a paid tier for privacy, canvas and power features. It is a Vite + React installable PWA, with a Capacitor Android project and public landing site.

## Built so far
- Chat lists and conversations, search, pinned chats, unread badges, delivery/read ticks, dark mode, private-message locks, decoy PIN profiles, smart replies, voice-to-text, Timeline Jump, tags, emoji engagement, gestures, editable decoy profiles, and device-only message text/time editing.
- Supabase email/password accounts, persistent sessions, profiles, messaging, password-reset email OTP and profile-photo storage. Friend-email chats are restricted to participants; profile creation and case/space-insensitive email lookup are fixed.
- Contacts: add by email, import registered phone contacts on Chrome for Android, favorite, block/unblock, archive/unarchive, delete chat history and “People I added.” Blocked users cannot message; archived chats have a separate list.
- Ghost Canvas: private one-to-one rooms, real-time strokes, notes, collage stickers, cursors/presence, six ink colours, brush sizing, undo, vanish timers and fading chat notes. Tic-tac-toe and Connect Four sync between players, with computer-opponent fallback. Pro adds pan/zoom, specialty brushes, shared media player and calendar.
- One-to-one calendars, group chats, configurable-duration stories, and voice/video call flows are implemented; backend/live behavior needs verification.
- Pro costs $2.99 monthly or $24.99 yearly, with a 7-day trial; payments are not connected.
- Settings → Sounds supports picking an audio file, preview/reset and message-sound toggle. Chat palette sheet supports per-chat sound, wallpapers and Favorites. Inbox tabs: All, Favorites, Groups and Unread. Groups have avatar badges, a New group button and pinning.
- Decoy settings use a consistent list with individual toggles; deleted chats stay deleted, Reset restores the original three. PIN lock re-prompts after returning to the app and remains enforced after Pro lapses if set.
- A 4.4 MB APK was downloaded from the GitHub release into `public/chatter.apk`. `netlify.toml` was changed so `/chatter.apk` serves that file directly; the landing page Download button and QR code use the same URL.

## Design
- “Ink & Ember”: warm bone, deep ink and vermilion in light mode; midnight violet-black and ember glow in dark mode. Bricolage Grotesque; peach/cream tailed bubbles and contour-line backgrounds.
- Ghost Canvas: green-tinted dark theme and mint ink. Inbox controls right; conversation actions left; contact name/avatar right.

## Structure
- Vite, React, Tailwind 3. Main files: `src/App.tsx`, `src/index.css`, `src/data.ts`; components in `src/components/`.
- Pro/auth/backend: `src/pro.tsx`, `src/components/ProSettings.tsx`, `src/auth.tsx`, `src/supabase.ts`; chat/social: `src/realChats.ts`, `src/social.ts`, `src/contacts.ts`.
- Calendar: `src/calendar.ts`, `src/components/CalendarPanel.tsx`. Other key files: `src/components/ChatWindow.tsx`, `GhostCanvas.tsx`, `FeatureSettings.ts`, `Settings.ts`, `src/prefs.ts`.
- Styling: `src/chatStyle.ts`, `src/components/ChatStyleSheet.tsx`; decoy: `src/decoyStore.ts`, `src/components/PinGate.tsx`.
- Sync files: `scripts/sync.sh`, `.gitignore`, `package.json`; workflow: `.github/workflows/release.yml`. APK and Netlify configuration: `public/chatter.apk`, `netlify.toml`.

## User preferences & rules
- Wants beginner-friendly, correct step-by-step instructions in order; says they are a newbie.
- Wants a distinct design from WhatsApp, opposite-side button placement and reduced copyright similarity.
- Wants release work focused on direct APK downloads; no PC versions for now. Most recently: “just need the apk version i can download.”
- Wants Netlify landing page and “Open web app” to start the messenger.
- Wants Pro to offer “superpowers—not just remove ads”; pricing/trial unchanged.
- Wants future updates/download-info website, groups, configurable story visibility/reactions, usable calls and create/edit/delete settings; check issues before release.
- Requested workflow edits with copy/paste instructions. Earlier reported recurring error; later said GitHub is fixed.
- Asked to build the approved decoy-settings plan immediately without further questions; implementation completed.
- Asked to make an APK of the current app, then asked to get the finished file and put it on the Netlify website.

## Open issues & next ideas
- Redeploy the website so Netlify publishes `public/chatter.apk`; test `/chatter.apk` on a phone and verify the landing-page download and QR flow.
- A GitHub token was exposed in chat again. Revoke/delete it immediately; do not reuse or store it.
- Test password reset, `{{ .Token }}`, Site/Redirect URLs, SMTP/Brevo and email delivery.
- Verify releases, artifacts, signing and Android setup.
- Test Ghost Canvas with two accounts, Supabase Realtime for messages, and groups, stories and calls with backend/database policies.
- Determine whether smart replies, voice-to-text and biometrics are fully functional; service worker has no push handling or notifications. Verify biometric, tag, microphone and pin-colour behavior.
