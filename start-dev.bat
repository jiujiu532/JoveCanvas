@echo off
title VOZEB PRO local dev (file DB mode, no PostgreSQL needed)
cd /d "%~dp0web"

if not exist node_modules (
    echo [1/2] First run: installing dependencies, this may take a few minutes...
    call pnpm install --frozen-lockfile
    if errorlevel 1 (
        echo Install failed. Please check that Node 22 and pnpm are available.
        pause
        exit /b 1
    )
)

echo [2/2] Starting dev server: http://localhost:3100
echo First visit: http://localhost:3100/install  (create the admin account; data is stored in web\.data as local files)
start "" http://localhost:3100/install
call pnpm run dev
pause
