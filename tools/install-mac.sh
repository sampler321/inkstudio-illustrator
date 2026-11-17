#!/bin/sh
# Installs InkStudio into Illustrator on macOS (Illustrator closed): sh install-mac.sh
set -e
here=$(cd "$(dirname "$0")" && pwd)
dst="$HOME/Library/Application Support/Adobe/CEP/extensions/com.inkdraw.studio"
pgrep -x "Adobe Illustrator" >/dev/null && { echo "Close Illustrator first."; exit 1; }
mkdir -p "$(dirname "$dst")"; rm -rf "$dst"; cp -R "$here/com.inkdraw.studio" "$dst"
for v in 11 12; do defaults write com.adobe.CSXS.$v PlayerDebugMode 1; done
for d in "$HOME/Library/Preferences/Adobe Illustrator "*" Settings"/*/; do mkdir -p "$d/Workspaces"; cp "$here/InkStudio.workspace" "$d/Workspaces/InkStudio"; done
echo "InkStudio installed. Start Illustrator, then Window > Workspace > InkStudio."
