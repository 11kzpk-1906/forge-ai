# ForgeAI for Windows

This folder packages the hosted ForgeAI web app as a Windows desktop application using Electron.

## Build the installer and ZIP locally

Requirements: Windows, Node.js 22 or newer, and npm.

```powershell
cd desktop
npm install
npm run build:desktop
```

The NSIS installer (`.exe`) and portable ZIP are created in `desktop/dist/`.

## Build and publish a GitHub Release

1. Merge the desktop packaging changes into `main`.
2. Open **Actions → Build ForgeAI Windows Release → Run workflow** to build and download artifacts.
3. To publish release assets automatically, create and push a version tag after the changes are merged:

```powershell
git checkout main
git pull
git tag v0.1.0
git push origin v0.1.0
```

The tagged workflow builds the Windows installer and ZIP, then attaches both files to a GitHub Release. Ensure the version in `desktop/package.json` matches the tag before cutting a release.

## Important

This is an online desktop wrapper: it loads the deployed ForgeAI site at `https://forge-ai-acme-2726.vercel.app/`. An internet connection is required, and the frontend/backend remain hosted services. This installer does not bundle the API server or make ForgeAI work offline.

The installer is not code-signed, so Windows SmartScreen may show an unknown-publisher warning. Only install builds you trust.
