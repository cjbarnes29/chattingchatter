# Browser lock tests

Each script serves a built app (`npm run build`), replaces the Supabase backend with canned
responses, seeds a signed-in session with a PIN set, and drives the lock screen in Chromium.

```
PW=<path to the playwright package> node tests/browser/pingate.cjs dist   # real chats never render before the PIN screen
PW=<path to the playwright package> node tests/browser/decoy.cjs dist     # decoy PIN shows decoy chats and loads no real data
PW=<path to the playwright package> node tests/browser/lockout.cjs dist   # 5 wrong PINs: keypad and keyboard refused for the wait (~35 s)
```
Real PIN: 2468. Decoy PIN: 1357. No real account or network is used.
