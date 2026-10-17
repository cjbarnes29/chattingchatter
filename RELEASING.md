# Getting Chatter on your phone (beginner guide)

## Get the Android APK (no setup needed)
- Stable: https://github.com/cjbarnes29/chattingchatter/releases/download/latest-apk/chatter.apk (rebuilt on every push to `main`).
- To build it by hand: **Actions → Release Chatter APK → Run workflow**. Branches other than `main` publish to the `test-apk` release instead.

Permissions, signing, building locally and the device test checklist: see [docs/ANDROID.md](docs/ANDROID.md).

## Install the APK on your phone
1. Send `chatter.apk` to your phone (download it there, or send it to yourself by email/Drive).
2. Open the file. Android asks you to allow installs from this app. Tap **Settings → Allow**, then go back.
3. Tap **Install**. Open Chatter.

## Other options
- **Install from the website:** open your Netlify address in Chrome on the phone → ⋮ menu → **Install app**.
- **Google Play:** needs a Google Play developer account ($25 one-time) and a signed build (see below).

## Publishing a numbered version (optional)
1. `git tag v1.0.1 && git push --tags` — this creates a proper release with the APK and desktop installers.
2. Desktop installers (`.exe`, `.dmg`, `.AppImage`) are published to the same release automatically.

## Google Play (later)
1. Create a keystore: `keytool -genkey -v -keystore release.keystore -alias chatter -keyalg RSA -keysize 2048 -validity 10000`
2. Add repo secrets: `ANDROID_KEYSTORE_BASE64` (`base64 -w0 release.keystore`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. The APK workflow then builds a signed release APK (see docs/ANDROID.md → Signing).
3. Add repo variable `ANDROID_STORE_READY` = `true` (Settings → Secrets and variables → Actions → Variables).
4. Push a version tag; the signed `.aab` is attached to the release. Upload it in Play Console.
