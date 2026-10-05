@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动 网易云音乐 API 服务 ...
node server.js
echo.
echo 服务已退出。按任意键关闭窗口。
pause >nul