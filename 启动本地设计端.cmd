@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 萌开了本地设计端（请勿关闭）
if not exist "node_modules" (
  echo 首次启动，正在安装本地依赖，请稍候……
  call npm install
  if errorlevel 1 (
    echo.
    echo 依赖安装失败，请保留此窗口并联系维护人员。
    pause
    exit /b 1
  )
)
echo 正在启动本地设计端：http://127.0.0.1:3000/#/diy-designer
echo 看到 Local 地址后，请回到 SketchUp 点击“导入本地设计端（测试）”。
echo 测试结束后关闭本窗口即可停止本地网站。
echo.
call npm run dev -- --host 127.0.0.1 --port 3000
pause
