#!/usr/bin/env bash
# One-command sync to GitHub. Usage: yarn sync  (or: yarn sync "my message")
# Needs env var GITHUB_TOKEN (fine-grained token, Contents: read/write on the repo).
set -e
REPO="cjbarnes29/chattingchatter"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "GITHUB_TOKEN is not set. Save your GitHub token as a secret named GITHUB_TOKEN first."
  exit 1
fi

[ -d .git ] || git init -q
git checkout -q -B main
git config user.name  "${GIT_USER_NAME:-Chatter Sync}"
git config user.email "${GIT_USER_EMAIL:-sync@chatter.app}"

git add -A
MSG="${1:-Update $(date -u +'%Y-%m-%d %H:%M UTC')}"
if git diff --cached --quiet; then
  echo "Nothing new to sync."
else
  git commit -q -m "$MSG"
fi

# Token is used only for this push and never stored in the repo config.
git push "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" main --force-with-lease 2>&1 \
  || git push "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" main
echo "Synced to https://github.com/${REPO}"
