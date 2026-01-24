#!/bin/bash
# Patch Electron's Info.plist to show "Zero Crust" instead of "Electron" in macOS menu bar
# This only affects development mode - packaged builds use forge.config.ts settings

APP_NAME="Zero Crust"
PLIST_PATH="node_modules/electron/dist/Electron.app/Contents/Info.plist"

if [[ "$OSTYPE" == "darwin"* ]] && [ -f "$PLIST_PATH" ]; then
  echo "Patching Electron.app Info.plist with app name: $APP_NAME"
  
  # Update CFBundleName
  /usr/libexec/PlistBuddy -c "Set :CFBundleName '$APP_NAME'" "$PLIST_PATH" 2>/dev/null || true
  
  # Update CFBundleDisplayName if it exists
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName '$APP_NAME'" "$PLIST_PATH" 2>/dev/null || true
  
  echo "Electron.app patched successfully"
else
  echo "Skipping Electron patch (not macOS or Electron not installed)"
fi

