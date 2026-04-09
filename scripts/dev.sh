#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILDER_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
UPSTREAM="${UPSTREAM:-$(cd "$BUILDER_ROOT/../kai-desktop" && pwd)}"

BRANDING_SRC="$BUILDER_ROOT/branding/branding.config.ts"
BRANDING_DST="$UPSTREAM/branding.config.ts"
ICONS_SRC="$BUILDER_ROOT/branding/build"
ICONS_DST="$UPSTREAM/build"
PLUGIN_SRC="${LEGION_PLUGIN:-$BUILDER_ROOT/plugins/legion}"
PLUGIN_DST="$UPSTREAM/bundled-plugins/legion"

if [[ ! -f "$BRANDING_SRC" ]]; then
  echo "Legion branding config not found at $BRANDING_SRC" >&2
  exit 1
fi

if [[ ! -f "$BRANDING_DST" ]]; then
  echo "Upstream branding config not found at $BRANDING_DST" >&2
  echo "Set UPSTREAM= to the correct kai-desktop checkout." >&2
  exit 1
fi

if [[ ! -d "$PLUGIN_SRC" ]]; then
  echo "Legion plugin not found at $PLUGIN_SRC" >&2
  exit 1
fi

if [[ -f "$BUILDER_ROOT/branding/generate_icon.swift" ]]; then
  echo "Regenerating Legion icon assets..."
  (cd "$BUILDER_ROOT" && swift branding/generate_icon.swift)
fi

echo "Backing up upstream originals..."
cp "$BRANDING_DST" "$BRANDING_DST.legion-dev-backup"

ICON_BACKUPS=()
for icon in "$ICONS_SRC"/*; do
  [[ -f "$icon" ]] || continue
  name="$(basename "$icon")"
  target="$ICONS_DST/$name"
  if [[ -f "$target" ]]; then
    cp "$target" "$target.legion-dev-backup"
    ICON_BACKUPS+=("$target")
  fi
done

PLUGIN_BACKUP=""
if [[ -d "$PLUGIN_DST" ]]; then
  PLUGIN_BACKUP="$PLUGIN_DST.legion-dev-backup"
  rm -rf "$PLUGIN_BACKUP"
  cp -R "$PLUGIN_DST" "$PLUGIN_BACKUP"
fi

restore() {
  echo ""
  echo "Restoring upstream originals..."

  if [[ -f "$BRANDING_DST.legion-dev-backup" ]]; then
    mv "$BRANDING_DST.legion-dev-backup" "$BRANDING_DST"
  fi

  for target in "${ICON_BACKUPS[@]}"; do
    if [[ -f "$target.legion-dev-backup" ]]; then
      mv "$target.legion-dev-backup" "$target"
    fi
  done

  rm -rf "$PLUGIN_DST"
  if [[ -n "$PLUGIN_BACKUP" && -d "$PLUGIN_BACKUP" ]]; then
    mv "$PLUGIN_BACKUP" "$PLUGIN_DST"
  fi

  echo "Upstream repo restored."
}

trap restore EXIT INT TERM

echo "Overlaying Legion branding..."
cp "$BRANDING_SRC" "$BRANDING_DST"

for icon in "$ICONS_SRC"/*; do
  [[ -f "$icon" ]] || continue
  cp -f "$icon" "$ICONS_DST/$(basename "$icon")"
done

echo "Bundling required Legion plugin..."
mkdir -p "$(dirname "$PLUGIN_DST")"
rm -rf "$PLUGIN_DST"
cp -R "$PLUGIN_SRC" "$PLUGIN_DST"

echo ""
echo "Launching kai-desktop with Legion Interlink branding..."
echo ""

cd "$UPSTREAM"
pnpm dev
