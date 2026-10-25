// Vectopix desktop shell: serves the built web app (dist/) from a private,
// secure `app://` origin, so module workers, the clipboard and downloads
// behave exactly as on the web. The interface describes the menu bar; this
// process builds it natively and relays its clicks, files the system hands
// over (recent files, the Dock, "Open with") and closing with unsaved work.
const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { toMenuTemplate } = require('./menu.cjs');

const DIST = path.join(__dirname, '..', 'dist');
const ORIGIN = 'app://vectopix';

const MIME_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.bmp': 'image/bmp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function serveDist(request) {
  const { pathname } = new URL(request.url);
  const filePath = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
  // Never serve anything outside dist/
  if (!filePath.startsWith(DIST + path.sep)) return new Response('Not found', { status: 404 });
  return net.fetch(pathToFileURL(filePath).toString());
}

let mainWindow = null;
/** Files to open, held until the interface is listening for them. */
const pendingFiles = [];
let interfaceReady = false;

async function openFile(filePath) {
  try {
    const data = await fs.readFile(filePath);
    app.addRecentDocument(filePath);
    const ext = path.extname(filePath).toLowerCase();
    pendingFiles.push({ name: path.basename(filePath), type: MIME_TYPES[ext] ?? '', data: new Uint8Array(data) });
    flushFiles();
  } catch {
    // Moved or deleted since it was listed: nothing to open
  }
}

function flushFiles() {
  if (!interfaceReady || !mainWindow) return;
  while (pendingFiles.length) mainWindow.webContents.send('file:open', pendingFiles.shift());
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

/** Image paths among command-line arguments ("Open with", Jump Lists). */
const filesInArgs = (argv) => argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('-') && MIME_TYPES[path.extname(a).toLowerCase()]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'Vectopix',
    backgroundColor: '#0b0d14',
    show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.cjs') },
  });
  mainWindow = win;
  interfaceReady = false;

  win.once('ready-to-show', () => win.show());

  // External links open in the browser or mail app; the app never navigates away
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(ORIGIN)) event.preventDefault();
  });

  // Unsaved hand edits: ask first, in the interface's language
  let closeConfirmation = null;
  ipcMain.removeAllListeners('window:close-confirmation');
  ipcMain.on('window:close-confirmation', (_event, confirm) => (closeConfirmation = confirm));
  win.on('close', (event) => {
    if (!closeConfirmation) return;
    const { title, message, discard, cancel } = closeConfirmation;
    const choice = dialog.showMessageBoxSync(win, { type: 'warning', title, message, buttons: [discard, cancel], defaultId: 1, cancelId: 1 });
    if (choice === 1) event.preventDefault();
  });
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.loadURL(`${ORIGIN}/index.html`);
}

// The interface describes the menu bar (translated, with its state); build it natively
ipcMain.on('menu:set', (event, sections) => {
  const send = (command) => event.sender.send('menu:command', command);
  Menu.setApplicationMenu(Menu.buildFromTemplate(toMenuTemplate(sections, send)));
});
ipcMain.on('app:info', (event) => {
  event.returnValue = { platform: process.platform, isPackaged: app.isPackaged };
});
ipcMain.on('file:ready', () => {
  interfaceReady = true;
  flushFiles();
});
ipcMain.on('file:remember', (_event, filePath) => {
  if (typeof filePath === 'string' && filePath) app.addRecentDocument(filePath);
});

// One instance: opening another file reuses the window
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    filesInArgs(argv).forEach(openFile);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // macOS: Open Recent, the Dock, Finder's "Open with" (may arrive before ready)
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (app.isReady()) openFile(filePath);
    else app.whenReady().then(() => openFile(filePath));
  });

  app.whenReady().then(() => {
    protocol.handle('app', serveDist);
    // Until the interface sends its own (a moment later): just what a window needs
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }]));
    createWindow();
    filesInArgs(process.argv).forEach(openFile);
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
