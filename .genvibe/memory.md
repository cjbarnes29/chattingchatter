<!-- genvibe-memory covers:fIAigBmqEdwQ90qR -->
## What this app is
Chatter is a Vite + React + Tailwind 3 messaging app, installable as a PWA and wrapped for Android with Capacitor. It uses Supabase for accounts, profiles, chats and related features. The public site is `https://chattingchatter.netlify.app`; the GitHub repository is `cjbarnes29/chattingchatter`.

## Built so far
- Supabase email/password sign-up and sign-in, password reset by email code, profile photo uploads, real-time chats, groups, stories, reactions, calls, contacts, favorites, blocks, archive and pinned chats.
- Ghost Canvas has live sharing, drawing tools, notes, games and auto-vanish.
- PIN and decoy profiles, with biometric decoy unlock offered as a Pro setting. Free users are limited to one decoy chat.
- Settings include account, privacy, notifications, chats, Ghost Canvas, decoys and Pro. Appearance options include fonts, text size, colours, bubbles, wallpapers and animations.
- Chatter Pro pricing: $2.99/month or $24.99/year, with a 7-day trial. Payments are not connected.
- APK-only GitHub release workflow; `public/chatter.apk` is served by the website at `/chatter.apk`.
- Latest work added `src/components/Terms.tsx`, a sign-up Terms agreement, and Terms links in the landing page and app. The latest GitHub APK was copied into `public/chatter.apk` because it differed from the existing website copy.

## Design
Ink & Ember aesthetic: warm bone paper, deep ink and vermilion in light mode; midnight violet-black and ember accents in dark mode. Uses Bricolage Grotesque. Chat list is on the right on desktop. Ghost Canvas retains its own dark theme.

## Structure
Key areas: `src/App.tsx`; `src/auth.tsx`, `src/supabase.ts`, `src/realChats.ts`; feature modules including `src/social.ts`, `src/calendar.ts`, `src/contacts.ts`, `src/decoyStore.ts`, `src/pro.tsx`; UI in `src/components/`; Android project in `android/`; APK in `public/chatter.apk`; release workflow in `.github/workflows/release.yml`; Netlify configuration in `netlify.toml`.

## User preferences & rules
- Wants an original look, not WhatsApp-like.
- Wants a direct APK download from the website; currently prioritizes APK over PC versions.
- Prefers step-by-step beginner instructions.
- Asked for Terms and Conditions and a sign-up agreement.
- GitHub tokens have been pasted into chat; treat them as exposed and do not reuse them.

## Open issues & next ideas
- Latest Terms changes and APK replacement are not confirmed pushed to GitHub or deployed to Netlify. Latest check ran TypeScript validation; no deployment confirmation is recorded.
- Test the reset-code email template, profile photo changes, biometrics, calls and Ghost Canvas on real devices/accounts.
- Confirm the latest APK download works after Netlify redeploy.
