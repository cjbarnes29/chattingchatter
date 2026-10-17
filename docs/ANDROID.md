# Chatter on Android

How the Android app is built, which permissions it uses and why, how to install it, and what has been tested.

## Download

| Link | What it is |
|---|---|
| https://github.com/cjbarnes29/chattingchatter/releases/download/latest-apk/chatter.apk | **Stable.** Rebuilt on every push to `main`. |
| https://github.com/cjbarnes29/chattingchatter/releases/download/test-apk/chatter.apk | **Test.** Built from other branches (Actions → Release Chatter APK → Run workflow → pick the branch). For trying changes before they reach `main`. |

Each build has its own version: version code = workflow run number, version name `1.3.<run>`. You can check it in phone Settings → Apps → Chatter.

## Install on a phone

1. Open the link on the phone, or download it on a computer and send the file to the phone.
2. Open `chatter.apk`. Android asks to allow installs from that app (Chrome, Files, …): **Settings → Allow from this source**, then go back.
3. Tap **Install**, then **Open**.
4. Play Protect may warn about an app it doesn't know. Chatter isn't on Google Play, so this is expected. Tap **More details → Install anyway** only if you got the file from the links above.

**Updating:** install the new APK over the old one. If Android says *"App not installed"* or *"package conflicts with an existing package"*, the new APK was signed with a different key (see [Signing](#signing)). Uninstall Chatter and install again. Uninstalling removes data stored only on the phone (lock PIN, decoy chats, confidential-chat locks, local interface settings). Your account, chats and contacts are on the server and come back when you sign in.

## Permissions

Nothing is asked at launch. Each runtime permission is requested the first time you use the feature that needs it, after a Chatter screen explains what it's for. If you say no twice (or pick "Don't allow"), Android stops showing its prompt. Chatter then explains how to turn it on and offers **Open phone settings**.

All of them can be viewed and changed in **Chatter → Settings → App permissions** (Android only) or **phone Settings → Apps → Chatter → Permissions**.

### Asked at runtime

| Permission | Used for | When it's asked |
|---|---|---|
| `RECORD_AUDIO` (Microphone) | Voice and video calls, 1:1 and group | Starting or answering a call |
| `CAMERA` | Video calls | Starting or answering a video call |
| `POST_NOTIFICATIONS` (Android 13+) | Event reminders | Adding an event, or tapping Enable under Settings → Notifications → Calendar & alarms |

Refusing one only turns off that feature. A voice call still works without the camera; a refused video call shows "Allow microphone/camera access to call."

### Granted at install (no prompt, by Android's rules)

| Permission | Used for |
|---|---|
| `INTERNET` | Everything online (Supabase) |
| `MODIFY_AUDIO_SETTINGS` | Speaker/earpiece routing during calls |
| `USE_BIOMETRIC` | Fingerprint / face unlock through Android's BiometricPrompt |
| `USE_FINGERPRINT` | Added by `androidx.biometric` for Android 6–8 phones; same purpose |
| `VIBRATE` | Small haptic tap on long-press and swipe-to-reply |
| `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Internal to AndroidX; keeps the app's own broadcast receivers private. Not usable by other apps. |

### Deliberately not used

- **Storage / media permissions** (`READ_EXTERNAL_STORAGE`, `READ_MEDIA_*`, `MANAGE_EXTERNAL_STORAGE`). Photos and files are picked in Android's own picker, which gives Chatter only the file you choose. If you take a new photo from inside that picker, the camera app does it under its own permission, not Chatter's. Saving (e.g. exporting a masterpiece) uses Android's "Save to" picker.
- **Exact alarms, boot receivers, background location, contacts, phone state.** Not needed by any feature.

### Fingerprint / face

On Android, Chatter uses `BiometricPrompt` with **strong (Class 3) biometrics only**, with "Use PIN" as the way out. A cancelled or failed check opens nothing (and never the decoy). Chatter never receives fingerprint or face data; Android only reports success or failure. If no fingerprint is enrolled, Chatter says so and points to phone Settings → Security.

The browser version still uses WebAuthn (the device's platform authenticator).

## How it's built

- **Web app → Android:** Capacitor 8. `yarn build` produces `dist/`, `npx cap sync android` copies it into the Android project. The app runs from files inside the APK, not from a website.
- **Native code:** `android/app/src/main/java/app/chatter/messenger/ChatterDevicePlugin.java`, registered in `MainActivity.java`. It provides permission state and requests (camera, microphone, notifications), BiometricPrompt, reminder notifications (channel "Event reminders"), the "Save to" file picker, and opening Chatter's page in phone settings. The JavaScript side is `src/native.ts`; permission explanations are in `src/permissions.ts` and `src/components/PermissionPrompt.tsx`; the settings page is `src/components/AppPermissions.tsx`.
- **In-call camera/microphone:** the web view asks Capacitor, which asks Android. Chatter asks first (with its explanation), so by the time the call starts the permission is already decided.
- **CI:** `.github/workflows/release.yml` (Actions → *Release Chatter APK*). It runs on every push to `main` and on demand. The log's *Show APK version, permissions and signer* step prints the version, the final merged permission list and the signing certificate, so any change to permissions shows up there.
- `public/chatter.apk` (the website's download copy) is excluded from the app's assets, so it no longer doubles the APK size.

### Build locally

Needs Node 22, JDK 21 and the Android SDK (Android Studio installs it).

```bash
npm install
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug   # or: gradle assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Install on a phone with USB debugging on: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

## Signing

Without signing secrets, CI builds a **debug** APK, signed with a key that is generated fresh on each CI machine. That works for a first install, but an update can fail with "App not installed" because the key changed.

For installable updates, add a permanent release key once:

1. Create it (keep the file and passwords safe; if lost, existing installs can't be updated):
   ```bash
   keytool -genkey -v -keystore chatter-release.jks -alias chatter -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 chatter-release.jks > chatter-release.b64   # macOS: base64 -i chatter-release.jks -o chatter-release.b64
   ```
2. GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**, add:
   - `ANDROID_KEYSTORE_BASE64`: contents of `chatter-release.b64`
   - `ANDROID_KEYSTORE_PASSWORD`: the keystore password
   - `ANDROID_KEY_ALIAS`: `chatter`
   - `ANDROID_KEY_PASSWORD`: the key password
3. Run the workflow. The log shows `Gradle task: assembleRelease`, and the APK is a signed, non-debuggable release build.
4. Switching from the debug builds to the release key needs one uninstall and reinstall. Every update after that installs over the top.

Never commit the keystore or passwords to the repository.

## Testing

### Done

| Check | Result |
|---|---|
| CI Android build with the native plugin (run 18) | Compiled and packaged; `versionCode 18`, `versionName 1.3.18`, target SDK 36 |
| Final permission list in the built APK (aapt2) | Exactly the list above; no storage, location, contacts or exact-alarm permissions |
| Browser tests of the permission flow, using a stand-in for the native plugin (29 checks) | All pass: explanation shown before Android's prompt and nothing requested until Continue; Not now requests nothing; "don't ask again" leads to Open phone settings; already-blocked goes straight to settings help; video call needs camera and mic, voice call only mic; BiometricPrompt success, cancel, lockout and not-enrolled; notification permission; App permissions page states and buttons; no horizontal scroll at 390 px; no page errors |
| TypeScript, ESLint, `vite build` | No new errors (same counts as `main`) |

### Not done yet: needs a real phone

No Android phone or emulator was available while building this (the build environment can't download Android SDK parts or run an emulator). These need checking on a device before calling the Android release finished:

1. Install the test APK on a clean phone (Android 13 or newer if possible, plus one older phone if available).
2. Open Chatter: **no permission prompt at launch**.
3. Start a voice call: Chatter's microphone explanation → **Continue** → Android prompt → **Allow**. The call connects with audio.
4. Start a video call: camera explanation → Allow. Your camera preview shows.
5. Deny the camera twice, then start a video call: Chatter shows "Camera is turned off" → **Open phone settings** opens Chatter's app page. Allow it there, come back, and try again.
6. Settings → **App permissions**: the states match phone settings, and change after you toggle them in phone settings and come back.
7. Add a calendar event a few minutes ahead: notification explanation → Allow. A notification titled "Event: …" arrives when the reminder is due, and tapping it opens Chatter.
8. Settings → Privacy & security → fingerprint: Android's fingerprint sheet appears. Wrong finger → it stays open; **Use PIN** → nothing unlocks. A correct finger turns it on. Lock the app and unlock with the fingerprint.
9. Pick a profile photo: Android's picker opens with no storage prompt.
10. Chatter Pro → masterpieces → download: Android's "Save to" screen opens and the file is saved.
11. Install the next build over this one (same signing key): it updates without uninstalling.

Record the phone model, Android version and result of each step here.
