const { app, BrowserWindow, session, dialog, ipcMain, Menu } = require('electron');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn, execFile } = require('node:child_process');

let serverProcess = null;
let mainWindow = null;

app.setName('M');
app.setPath('userData', path.join(app.getPath('appData'), 'M'));

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
    title: 'M',
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
  mainWindow.webContents.on('context-menu', (event, params) => {
    const menu = Menu.buildFromTemplate([
      { label: '剪切', role: 'cut', enabled: params.editFlags.canCut },
      { label: '复制', role: 'copy', enabled: params.editFlags.canCopy },
      { label: '粘贴', role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { label: '全选', role: 'selectAll' },
    ]);
    menu.popup({ window: mainWindow });
  });
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

function updateShortcuts(theme) {
  const ico = path.join(app.getAppPath(), 'theme', theme === 'dark' ? 'dark.ico' : 'light.ico');
  const desktop = path.join(app.getPath('desktop'), 'M.lnk');
  const startMenu = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'M.lnk');
  const script = '$ws=New-Object -ComObject WScript.Shell; foreach($p in @($env:M_DESKTOP,$env:M_START)){ if(Test-Path -LiteralPath $p){ $s=$ws.CreateShortcut($p); $s.IconLocation=$env:M_ICON+",0"; $s.Save() } }';
  try {
    execFile('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script], {
      env: { ...process.env, M_ICON: ico, M_DESKTOP: desktop, M_START: startMenu },
      windowsHide: true,
      timeout: 8000,
    }, () => {});
  } catch {
    // Shortcut updates are best-effort.
  }
}

ipcMain.on('dm-theme', (event, theme) => {
  if (!mainWindow || (theme !== 'light' && theme !== 'dark')) return;
  const iconName = theme === 'dark' ? 'icon-512-dark.png' : 'icon-512.png';
  try {
    mainWindow.setIcon(path.join(app.getAppPath(), 'public', iconName));
  } catch {
    // Ignore icon updates on platforms that do not support them.
  }
  updateShortcuts(theme);
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  app.setAppUserModelId('com.dm.chat');

  await session.defaultSession.clearCache();
  await session.defaultSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = webContents.getURL().startsWith('http://127.0.0.1:');
    callback(allowed && (permission === 'media' || permission === 'clipboard-sanitized-write' || permission === 'clipboard-read'));
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allowed = webContents.getURL().startsWith('http://127.0.0.1:');
    return allowed && (permission === 'media' || permission === 'clipboard-sanitized-write' || permission === 'clipboard-read');
  });

  const port = await getFreePort();
  startServer(port);

  if (!(await waitForHealth(port))) {
    stopServer();
    dialog.showErrorBox('M', '本机服务启动失败，请重新打开 M。');
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
