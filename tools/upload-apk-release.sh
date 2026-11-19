#!/usr/bin/env bash
# APK 打包完成后上传到 GitHub Release。
# 用法：bash tools/upload-apk-release.sh
set -e
cd "$(dirname "$0")/.."
APK="dist/release/apk/pwd-v1.0.0-100.apk"
if [ ! -f "$APK" ]; then
  echo "找不到 APK: $APK —— 请确认云打包已完成且监听脚本已下载"
  exit 1
fi
echo "上传 $APK 到 Release v1.0.0 ..."
gh release upload v1.0.0 "$APK" --clobber
echo "上传完成。验证："
gh release view v1.0.0 --json assets --jq '.assets[].name'
