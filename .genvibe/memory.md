<!-- genvibe-memory covers:a3dS2zaNjxPySL2V -->
## What this app is
Chatter is a messaging app with chat lists, live conversations, privacy and engagement features, plus Ghost Canvas, an ephemeral shared drawing and play space. Chatter Pro is a paid tier for privacy, canvas and power features. It is a Vite + React installable PWA, with a Capacitor Android project and public landing site.

## Built so far
- Chat lists and conversations, search, pinned chats, unread badges, delivery/read ticks, dark mode, private-message locks, decoy PIN profiles, smart replies, voice-to-text, Timeline Jump, tags, emoji engagement, gestures, editable decoy profiles, and device-only message text/time editing.
- Supabase email/password accounts, persistent sessions, profiles, messaging, password-reset email OTP and profile-photo storage. Friend-email chats are restricted to participants; profile creation and case/space-insensitive email lookup are fixed.
- Contacts: add by email, import registered phone contacts on Chrome for Android, favorite, block/unblock, archive/unarchive, delete chat history and “People I added.” Blocked users cannot message; archived chats have a separate list.
- Ghost Canvas: private one-to-one rooms, real-time strokes, notes, collage stickers, cursors/presence, six ink colours, brush sizing, undo, vanish timers and fading chat notes. Tic-tac-toe and Connect Four sync between players, with computer-opponent fallback. Pro adds pan/zoom, specialty brushes, shared media player and calendar. A Ghost Canvas button was added to one-to-one chats; functionality still needs testing.
- One-to-one calendars, group chats, configurable-duration stories, and voice/video call flows are implemented; backend/live behavior needs verification.
- Group chats have voice/video call buttons, Join prompts and a shared call screen with participant tiles; group calls have not been tested.
- Settings now open one page at a time, including Profile, Account, Appearance, Privacy & security, Notifications & sounds, Chats & gestures, Ghost Canvas, Decoy chats and Chatter Pro.
- Logging out prompts for a PIN; either the real or decoy PIN logs out. Six-digit PINs check automatically. Decoy mode was updated for parity with normal mode; needs testing.
- A Back exit prompt was added. Pro banner removal for subscribers was requested; implementation/testing status is unclear.
- Chatter 1.2 was pushed to GitHub and an APK was rebuilt. Netlify deployment status is unclear.

## Design
- “Ink & Ember”: warm bone, deep ink and vermilion in light mode; midnight violet-black and ember glow in dark mode. Bricolage Grotesque; peach/cream tailed bubbles and contour-line backgrounds.
- Ghost Canvas: green-tinted dark theme and mint ink. Inbox controls right; conversation actions left; contact name/avatar right.

## Structure
- Vite, React, Tailwind 3. Main files: `src/App.tsx`, `src/index.css`, `src/data.ts`; components in `src/components/`.
- Pro/auth/backend: `src/pro.tsx`, `src/components/ProSettings.tsx`, `src/auth.tsx`, `src/supabase.ts`; chat/social: `src/realChats.ts`, `src/social.ts`, `src/contacts.ts`.
- Calendar: `src/calendar.ts`, `src/components/CalendarPanel.tsx`. Other key files: `src/components/ChatWindow.tsx`, `GhostCanvas.tsx`, `FeatureSettings.ts`, `Settings.ts`, `src/prefs.ts`.
- Styling: `src/chatStyle.ts`, `src/components/ChatStyleSheet.tsx`; decoy: `src/decoyStore.ts`, `src/components/PinGate.tsx`.
- Recent files include `src/backNav.ts`, `src/components/ExitDialog.tsx`, `src/typing.ts`, `src/groupCall.ts`, `src/components/GroupCallOverlay.tsx`, `src/components/DecoyApp.tsx`, `src/components/ChatList.tsx`.
- Sync files: `scripts/sync.sh`, `.gitignore`, `package.json`; workflow: `.github/workflows/release.yml`. APK and Netlify configuration: `public/chatter.apk`, `netlify.toml`; Android version: `android/app/build.gradle`.

## User preferences & rules
- Wants beginner-friendly, correct step-by-step instructions in order; says they are a newbie.
- Wants a distinct design from WhatsApp, opposite-side button placement and reduced copyright similarity.
- Wants release work focused on direct APK downloads; no PC versions for now. Most recently: “just need the apk version i can download.”
- Wants Netlify landing page and “Open web app” to start the messenger.
- Wants Pro to offer “superpowers—not just remove ads”; pricing/trial unchanged.
- Wants future updates/download-info website, groups, configurable story visibility/reactions, usable calls and create/edit/delete settings; check issues before release.
- Wants settings organized, group calls available, Ghost Canvas accessible by button, PIN/decoy behavior working, and an exit choice when pressing Back.
- Wants workflow edits with copy/paste instructions. Asked for a clean version without old demo chats, pushed to GitHub, and updated on Netlify.
- Requested a swipe-up biometric unlock: matching fingerprint or face opens the real account; an unrecognized/wrong biometric opens the decoy account. The existing PIN should continue working.
- A GitHub token was shared in chat; never reproduce or reuse it. Revoke/delete exposed tokens.

## Open issues & next ideas
- Verify Chatter 1.2 on a phone: group calls, decoy parity/PIN behavior, logout PIN prompt, Back exit prompt, Ghost Canvas and Pro banner removal.
- Confirm/deploy the latest build to Netlify; test `/chatter.apk`, landing-page download and QR flow. Uninstall the old phone app before installing the new APK to clear old local test data.
- Test password reset, `{{ .Token }}`, Site/Redirect URLs, SMTP/Brevo and email delivery.
- Verify releases, artifacts, signing and Android setup.
- Test Ghost Canvas with two accounts, Supabase Realtime for messages, and groups, stories and calls with backend/database policies.
- Determine whether smart replies, voice-to-text and biometrics are fully functional; service worker has no push handling or notifications. Verify biometric, tag, microphone and pin-colour behavior.
- Confirm whether the requested swipe-up biometric unlock and decoy fallback have been implemented and test both real and decoy paths.
