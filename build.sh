#!/bin/sh
# Obsidian が読む形に $1 へ置く。$1/plugin がプラグイン（main.js, manifest.json, styles.css）、$1/themes がテーマ。
# obsidian や @codemirror/* は Obsidian が実行時に渡すので、名前だけの import はまとめずに残す（--packages=external）。
set -eu
out=$1
rm -rf "${out:?}/plugin" "$out/themes"
mkdir -p "$out/plugin"
esbuild plugin/main.ts --bundle --packages=external --format=cjs --target=es2022 --charset=utf8 --outfile="$out/plugin/main.js" --log-level=warning
tailwindcss -i plugin/styles.css -o "$out/plugin/styles.css" --minify
cp plugin/manifest.json "$out/plugin/"
cp -R themes "$out/"
