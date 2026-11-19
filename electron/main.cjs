const { app, BrowserWindow, session, dialog, ipcMain } = require('electron');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');

let serverProcess = null;
let mainWindow = null;

app.setName('D&M');
app.setPath('userData', path.join(app.getPath('appData'), 'D&M'));

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });
}

function isHealthy(port) {
  return new Promise((resolve) => {
    const request = http.get({
      host: '127.0.0.1',
      port,
      path: '/api/health',
      timeout: 700,
    }, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

async function waitForHealth(port, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    if (await isHealthy(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

function startServer(port) {
  const appRoot = app.getAppPath();
  serverProcess = spawn(process.execPath, [path.join(appRoot, 'server.mjs')], {
    cwd: appRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      HOST: '127.0.0.1',
      PORT: String(port),
    },
    stdio: 'ignore',
    windowsHide: true,
  });
  serverProcess.on('exit', () => {
    serverProcess = null;
  });
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    try { serverProcess.kill(); } catch {}
  }
  serverProcess = null;
}

function createWindow(port) {
  const appRoot = app.getAppPath();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 880,
    minWidth: 860,
    minHeight: 600,
    title: 'D&M',
    backgroundColor: '#E9DFC8',
    icon: path.join(appRoot, 'public', 'icon-512.png'),
    webPreferences: {
      preload: path.join(appRoot, 'electron', 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}/`)) event.preventDefault();
  });
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());

  mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('dm-theme', (event, theme) => {
  if (!mainWindow || (theme !== 'light' && theme !== 'dark')) return;
  const iconName = theme === 'dark' ? 'icon-512-dark.png' : 'icon-512.png';
  try {
    mainWindow.setIcon(path.join(app.getAppPath(), 'public', iconName));
  } catch {
    // Ignore icon updates on platforms that do not support them.
  }
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  app.setAppUserModelId('com.dm.chat');

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = webContents.getURL().startsWith('http://127.0.0.1:');
    callback(allowed && (permission === 'media' || permission === 'clipboard-sanitized-write'));
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allowed = webContents.getURL().startsWith('http://127.0.0.1:');
    return allowed && (permission === 'media' || permission === 'clipboard-sanitized-write');
  });

  const port = await getFreePort();
  startServer(port);

  if (!(await waitForHealth(port))) {
    stopServer();
    dialog.showErrorBox('D&M', '本机服务启动失败，请重新打开 D&M。');
    app.quit();
    return;
  }

  createWindow(port);
});

app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});

app.on('before-quit', () => {
  stopServer();
});
