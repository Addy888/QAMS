@echo off
echo Cleaning up old Node.js processes...
taskkill /F /IM node.exe

echo Starting QAMS API Backend cleanly on Port 3000...
cd apps\api
pnpm start:dev
