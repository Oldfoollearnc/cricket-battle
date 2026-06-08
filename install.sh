#!/bin/bash
# 电子斗蛐蛐 - 安装脚本 (Linux/Mac/Git Bash)

set -e

echo "🦗 电子斗蛐蛐 安装中..."

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 创建技能目录
mkdir -p ~/.claude/skills

# 复制技能文件
cp "$SCRIPT_DIR/cricket-battle.md" ~/.claude/skills/cricket-battle.md
echo "✅ 技能文件已安装到 ~/.claude/skills/cricket-battle.md"

# 复制项目文件
mkdir -p ~/cricket-battle
cp "$SCRIPT_DIR/battle.js" ~/cricket-battle/battle.js
cp "$SCRIPT_DIR/config.js" ~/cricket-battle/config.js
cp "$SCRIPT_DIR/roles.js" ~/cricket-battle/roles.js
cp "$SCRIPT_DIR/report.js" ~/cricket-battle/report.js
cp "$SCRIPT_DIR/README.md" ~/cricket-battle/README.md
echo "✅ 项目文件已安装到 ~/cricket-battle/"

echo ""
echo "🦗 安装完成！"
echo ""
echo "使用方式：在 Claude Code 中输入："
echo "  做一个记账App"
echo "  或"
echo "  斗蛐蛐：做一个外卖平台"
