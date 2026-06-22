@echo off
setlocal

cd /d "%~dp0.."

set "MGAI_PROJECT_ROOT=%~dp0.."

call "%~dp0..\node_modules\.bin\tsx.cmd" "%~dp0run.ts"

endlocal