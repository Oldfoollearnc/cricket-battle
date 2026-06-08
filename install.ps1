# 电子斗蛐蛐 - 安装脚本 (Windows PowerShell)

Write-Host "🦗 电子斗蛐蛐 安装中..." -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 创建技能目录
$SkillsDir = "$env:USERPROFILE\.claude\skills"
if (!(Test-Path $SkillsDir)) {
    New-Item -ItemType Directory -Path $SkillsDir -Force | Out-Null
}

# 复制技能文件
Copy-Item "$ScriptDir\cricket-battle.md" "$SkillsDir\cricket-battle.md" -Force
Write-Host "✅ 技能文件已安装到 $SkillsDir\cricket-battle.md" -ForegroundColor Green

# 复制项目文件
$ProjectDir = "$env:USERPROFILE\cricket-battle"
if (!(Test-Path $ProjectDir)) {
    New-Item -ItemType Directory -Path $ProjectDir -Force | Out-Null
}

Copy-Item "$ScriptDir\battle.js" "$ProjectDir\battle.js" -Force
Copy-Item "$ScriptDir\config.js" "$ProjectDir\config.js" -Force
Copy-Item "$ScriptDir\roles.js" "$ProjectDir\roles.js" -Force
Copy-Item "$ScriptDir\report.js" "$ProjectDir\report.js" -Force
Copy-Item "$ScriptDir\README.md" "$ProjectDir\README.md" -Force
Copy-Item "$ScriptDir\install.sh" "$ProjectDir\install.sh" -Force
Copy-Item "$ScriptDir\install.ps1" "$ProjectDir\install.ps1" -Force
Write-Host "✅ 项目文件已安装到 $ProjectDir\" -ForegroundColor Green

Write-Host ""
Write-Host "🦗 安装完成！" -ForegroundColor Cyan
Write-Host ""
Write-Host "使用方式：在 Claude Code 中输入："
Write-Host "  做一个记账App" -ForegroundColor Yellow
Write-Host "  或"
Write-Host "  斗蛐蛐：做一个外卖平台" -ForegroundColor Yellow
