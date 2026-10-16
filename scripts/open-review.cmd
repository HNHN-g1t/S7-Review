@echo off
rem サイノメ総覧（review.html）をすばやく開く。
rem 1. 開発用サーバー（5180番）が動いていなければ、別ウィンドウで起動する
rem 2. 起動を待ってから、ふだんのブラウザで http://localhost:5180/review.html を開く
rem 起動したサーバーのウィンドウを閉じると、総覧も見られなくなる（もう一度これをダブルクリック）
chcp 65001 >nul
cd /d "%~dp0.."

curl -s -o nul http://localhost:5180/review.html
if %errorlevel%==0 goto open

if not exist node_modules (
  echo 初回の準備をしています（npm install）...
  call npm install
)
start "SAINOME 開発サーバー（閉じると総覧も止まります）" cmd /k npm run dev -- --port 5180 --strictPort

rem サーバーが応答するまで最大30秒待つ
for /l %%i in (1,1,30) do (
  curl -s -o nul http://localhost:5180/review.html && goto open
  timeout /t 1 /nobreak >nul
)
echo サーバーが起動しませんでした。開いたウィンドウのエラーを確認してください。
pause
exit /b 1

:open
start "" http://localhost:5180/review.html
