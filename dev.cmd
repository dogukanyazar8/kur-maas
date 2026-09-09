@echo off
setlocal
cd /d "%~dp0"
if exist "%~dp0.runtime\node-v24.20.0-win-x64\node.exe" set "PATH=%~dp0.runtime\node-v24.20.0-win-x64;%PATH%"
call npm.cmd run dev -- %*
