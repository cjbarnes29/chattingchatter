<!-- genvibe-memory covers:bRRUXjk3DIGtJBe1 -->
## What this app is
Chatter is a messaging app with chat lists, live conversations, privacy and engagement features, plus Ghost Canvas, an ephemeral shared drawing and play space. Chatter Pro is a paid tier for privacy, canvas and power features. It is a Vite + React installable PWA, with a Capacitor Android project and public landing site.

## Built so far
- Chat lists and conversations, search, pinned chats, unread badges, delivery/read ticks, dark mode, private-message locks, decoy PIN profiles, smart replies, voice-to-text, Timeline Jump, tags, emoji engagement, gestures, editable decoy profiles, and device-only message text/time editing.
- Supabase email/password accounts, persistent sessions, profiles, messaging, password-reset email OTP and profile-photo storage. Friend-email chats are restricted to participants; profile creation and case/space-insensitive email lookup are fixed.
- Contacts: add by email, import registered phone contacts on Chrome for Android, favorite, block/unblock, archive/unarchive, delete chat history and “People I added.” Blocked users cannot message; archived chats have a separate list.
- Ghost Canvas: private one-to-one rooms, real-time strokes, notes, collage stickers, cursors/presence, six ink colours, brush sizing, undo, vanish timers and fading chat notes. Tic-tac-toe and Connect Four sync between players, with computer-opponent fallback. Pro adds pan/zoom, specialty brushes, shared media player and calendar. A Ghost Canvas button was added to one-to-one chats; functionality still needs testing.
- One-to-one calendars, group chats, configurable-duration stories, and voice/video call flows are implemented; backend/live behavior needs verification. Group calls have not been tested.
- Settings open one page at a time. Chatter 1.3 adds Appearance controls, profile-photo zoom, profile view and bio fields, presence controls, and Pro biometric unlock.
- Chatter 1.3 build passed, was pushed to GitHub, and its APK was saved in the website files. Biometric behavior was tested only on web, not on a phone or with two accounts. Netlify deployment status remains unclear.
- Terms and Conditions page, links and signup agreement are proposed, not confirmed built.

## Design
- “Ink & Ember”: warm bone, deep ink and vermilion in light mode; midnight violet-black and ember glow in dark mode. Bricolage Grotesque; peach/cream tailed bubbles and contour-line backgrounds.
- Ghost Canvas: green-tinted dark theme and mint ink. Inbox controls right; conversation actions left; contact name/avatar right.

## Structure
- Vite, React, Tailwind 3. Main files: `src/App.tsx`, `src/index.css`, `src/data.ts`; components in `src/components/`.
- Pro/auth/backend: `src/pro.tsx`, `src/components/ProSettings.tsx`, `src/auth.tsx`, `src/supabase.ts`; chat/social: `src/realChats.ts`, `src/social.ts`, `src/contacts.ts`.
- Calendar: `src/calendar.ts`, `src/components/CalendarPanel.tsx`. Other key files: `src/components/ChatWindow.tsx`, `GhostCanvas.tsx`, `FeatureSettings.ts`, `Settings.ts`, `src/prefs.ts`.
- Styling/security and Android/release files are listed in the existing project structure; Netlify config: `netlify.toml`.

## User preferences & rules
- Wants beginner-friendly, correct step-by-step instructions in order; says they are a newbie.
- Wants a distinct design from WhatsApp, opposite-side button placement and reduced copyright similarity.
- Wants release work focused on direct APK downloads; no PC versions for now. Most recently: “just need the apk version i can download.”
- Wants Netlify landing page and “Open web app” to start the messenger.
- Wants Pro to offer “superpowers—not just remove ads”; pricing/trial unchanged.
- Wants settings organized, group calls available, Ghost Canvas accessible by button, PIN/decoy behavior working, and an exit choice when pressing Back.
- Wants copy/paste workflow instructions, a clean version without old demo chats, pushed to GitHub and updated on Netlify.
- Asked to check whether the latest GitHub release APK matches the website APK, add Terms and Conditions, and reupload the site to Netlify with the latest APK.
- Proposed Terms plan: plain-language page linked from landing-page footer, signup and Settings; signup requires ticking “I agree to the Terms.”

## Open issues & next ideas
- Check whether the latest GitHub release APK matches the website APK; update the website APK and redeploy to Netlify.
- Add and link Terms and Conditions, including a required signup agreement; details and implementation status are not yet known. A plan was proposed, but no approval or implementation is recorded.
- Test Chatter 1.3 on a phone and with two accounts, especially biometric paths, PINs, and free-tier decoy limit.
- Verify group calls, logout PIN prompt, Back exit prompt, Ghost Canvas and Pro banner removal.
- Test APK download/QR flow, email delivery, Supabase Realtime and policies, and other listed release checks.
- A GitHub token was pasted in chat; its value is intentionally not retained here. Revoke or rotate it.
