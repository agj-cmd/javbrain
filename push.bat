@echo off
cd /d "%~dp0"
echo Building...
node build.js
echo.
echo Pushing to GitHub...
git add .
git commit -m "update %date% %time%"
git push
echo.
echo Done. Site will update in ~1 minute.
pause