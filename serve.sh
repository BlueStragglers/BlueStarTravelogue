#!/usr/bin/env bash
# 无需 Node.js 的静态预览脚本。
# 使用系统自带的 python3 起一个本地静态服务器，直接预览已构建好的 dist/。
# 因为路由是 hash 模式（/#/today），所以不需要任何服务端回退配置。
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d "dist" ]; then
  echo "还没有构建产物 dist/。如果你已安装 Node.js，请先运行：pnpm install && pnpm build"
  exit 1
fi

PORT="${1:-8000}"
echo "蓝星旅记 PWA 预览：http://localhost:${PORT}"
echo "按 Ctrl+C 停止"
cd dist
exec python3 -m http.server "$PORT"
