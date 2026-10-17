// Links to the GitHub Releases of https://github.com/cjbarnes29/chattingchatter
// They work after you push a version tag (e.g. v1.0.0) and the release workflow finishes.
// Leave a value empty and its button shows "Coming soon".
const RELEASES = 'https://github.com/cjbarnes29/chattingchatter/releases'
export const DOWNLOADS = {
  playStore: '', // add your Google Play URL once published
  androidApk: 'https://github.com/cjbarnes29/chattingchatter/releases/download/latest-apk/chatter.apk', // stable APK, rebuilt from main by the release workflow
  windows: RELEASES + '/latest', // release page: pick the .exe
  mac: RELEASES + '/latest', // release page: pick the .dmg
  linux: RELEASES + '/latest', // release page: pick the .AppImage
}
