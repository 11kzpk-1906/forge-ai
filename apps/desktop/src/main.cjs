const { app, BrowserWindow, ipcMain, protocol, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "forgeai",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

if (process.platform === "win32") app.setAppUserModelId("ai.forgeai.desktop");

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) app.quit();

const isDev = !app.isPackaged;
const rendererUrl = process.env.FORGEAI_DEV_URL || "http://127.0.0.1:5173/";
const DEV_SERVER_RETRIES = 30;
const DEV_SERVER_RETRY_DELAY_MS = 500;
const OAUTH_CALLBACK_PREFIX = "forgeai://auth/callback";
let mainWindow = null;
const pendingOAuthCallbacks = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDevServer(url) {
  for (let attempt = 1; attempt <= DEV_SERVER_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // Vite may still be starting.
    }
    await sleep(DEV_SERVER_RETRY_DELAY_MS);
  }
  throw new Error(`ForgeAI frontend did not become available at ${url} after ${DEV_SERVER_RETRIES} attempts.`);
}

function isOAuthCallback(value) {
  try {
    const url = new URL(value);
    return url.protocol === "forgeai:" && url.hostname === "auth" && url.pathname === "/callback";
  } catch {
    return false;
  }
}

function enqueueOAuthCallback(value) {
  if (!isOAuthCallback(value)) return;
  pendingOAuthCallbacks.push(value);
  flushOAuthCallbacks();
}

function flushOAuthCallbacks() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isLoadingMainFrame()) return;
  while (pendingOAuthCallbacks.length) {
    mainWindow.webContents.send("forgeai:oauth-callback", pendingOAuthCallbacks.shift());
  }
}

function findOAuthCallback(args) {
  return args.find((arg) => typeof arg === "string" && arg.startsWith(OAUTH_CALLBACK_PREFIX));
}

if (process.platform === "win32" || process.platform === "linux") {
  app.setAsDefaultProtocolClient("forgeai");
}

if (process.platform === "darwin") {
  app.on("open-url", (event, url) => {
    event.preventDefault();
    enqueueOAuthCallback(url);
  });
}

if (gotSingleInstanceLock) {
  app.on("second-instance", (_event, commandLine) => {
    enqueueOAuthCallback(findOAuthCallback(commandLine));
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

const initialOAuthUrl = findOAuthCallback(process.argv);
if (initialOAuthUrl) pendingOAuthCallbacks.push(initialOAuthUrl);

ipcMain.handle("forgeai:open-oauth-url", async (_event, value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid OAuth authorization URL.");
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".supabase.co") ||
    url.pathname !== "/auth/v1/authorize" ||
    url.searchParams.get("provider") !== "google"
  ) {
    throw new Error("Blocked an untrusted OAuth authorization URL.");
  }

  await shell.openExternal(url.toString());
});

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

async function registerAppProtocol() {
  const distRoot = path.resolve(process.resourcesPath, "dist");
  await protocol.handle("forgeai", async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== "app") return new Response("Not found", { status: 404 });

      const decodedPath = decodeURIComponent(url.pathname);
      const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
      const filePath = path.resolve(distRoot, relativePath);
      if (filePath !== distRoot && !filePath.startsWith(distRoot + path.sep)) {
        return new Response("Forbidden", { status: 403 });
      }

      const stat = await fs.stat(filePath);
      if (!stat.isFile()) return new Response("Not found", { status: 404 });
      const body = await fs.readFile(filePath);
      return new Response(body, {
        headers: {
          "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'self' https:; script-src 'self' 'unsafe-inline' https://*.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: forgeai://app;",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#08070d",
    title: "ForgeAI",
    icon: path.join(__dirname, "../assets/forgeai.ico"),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.on("did-finish-load", flushOAuthCallbacks);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:" || parsed.protocol === "mailto:") void shell.openExternal(url);
    } catch {
      // Reject malformed URLs.
    }
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isDev && url.startsWith(rendererUrl)) return;
    if (!isDev && url.startsWith("forgeai://app/")) return;
    event.preventDefault();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) console.error(`ForgeAI failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
  });

  if (isDev) {
    console.log(`Waiting for ForgeAI frontend at ${rendererUrl}...`);
    await waitForDevServer(rendererUrl);
    await mainWindow.loadURL(rendererUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await registerAppProtocol();
    await mainWindow.loadURL("forgeai://app/index.html");
  }
}

if (gotSingleInstanceLock) {
  app.whenReady().then(async () => {
    try {
      await createWindow();
      flushOAuthCallbacks();
    } catch (error) {
      console.error(error);
      app.quit();
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
