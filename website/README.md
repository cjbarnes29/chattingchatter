# Chatter website (Netlify upload)

This folder is a complete, ready-to-upload website. It has no build step.

## Contents
- `index.html`, `styles.css`: the landing page (features, Pro, download, FAQ)
- `terms.html`: Terms and Conditions
- `chatter.apk`: the latest Android app (v1.3), served at `/chatter.apk`
- `netlify.toml`: serves the APK with the right download headers

## Publish on Netlify (drag and drop)
1. Go to https://app.netlify.com and log in.
2. Open **Sites** → **Add new site** → **Deploy manually**.
3. Drag the whole `website` folder onto the upload box.
4. When it finishes, open the site URL and check `/chatter.apk` downloads.

To update later, drag the folder in again on the same site.
