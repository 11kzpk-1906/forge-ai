# ForgeAI for Windows

This folder packages the hosted ForgeAI web app as a Windows desktop application using Electron.

## Build the installer locally

Requirements: Windows, Node.js 22 or newer, and npm.

```powershell
cd desktop
npm install
npm run dist:win
```

The installer is created in `desktop/dist/`.

## Build with GitHub Actions

Open **Actions → Build Windows Installer → Run workflow**. Download the `ForgeAI-Windows-Installer` artifact after the workflow succeeds.

Pushing a version tag such as `v0.1.0` also triggers a build.

## Important

This is an online desktop wrapper: it loads the deployed ForgeAI site at `https://forge-ai-acme-2726.vercel.app/`. An internet connection is required, and the frontend/backend remain hosted services. This installer does not bundle the API server or make ForgeAI work offline.

The installer is not code-signed, so Windows SmartScreen may show an unknown-publisher warning. Only install builds you trust.
