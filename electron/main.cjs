// Vectopix desktop shell: serves the built web app (dist/) from a private,
// secure `app://` origin, so module workers, the clipboard and downloads
// behave exactly as on the web. The interface describes the menu bar; this
// process builds it natively and relays its clicks, files the system hands
// over (recent files, the Dock, "Open with"), closing with unsaved work,
// saving through the native dialog, dragging files out, progress and theme.
const { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage, nativeTheme, net, protocol, screen, shell } = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { toMenuTemplate } = require('./menu.cjs');
const { restoreBounds } = require('./windowState.cjs');
const { createDesktopState } = require('./desktopState.cjs');

const DIST = path.join(__dirname, '..', 'dist');
const ORIGIN = 'app://vectopix';

const ICON = path.join(__dirname, '..', 'build', 'icon.png');
const WINDOW_SIZE = { width: 1440, height: 900, minWidth: 1024, minHeight: 680 };
/** The page's background in each theme, so the window never flashes the other one. */
const BACKGROUND = { light: '#fbfbfa', dark: '#232326' };
const THEMES = ['system', 'light', 'dark'];

const MIME_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.bmp': 'image/bmp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.tga': 'image/x-tga',
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

/** Set once the app is ready (it lives in the user's data folder). */
let state = null;
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
  const bounds = restoreBounds(state.get('bounds'), screen.getAllDisplays().map((d) => d.workArea), WINDOW_SIZE);
  const win = new BrowserWindow({
    ...bounds,
    minWidth: WINDOW_SIZE.minWidth,
    minHeight: WINDOW_SIZE.minHeight,
    title: 'Vectopix',
    backgroundColor: BACKGROUND[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'],
    show: false,
    icon: ICON,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.cjs') },
  });
  mainWindow = win;
  interfaceReady = false;

  win.once('ready-to-show', () => {
    if (state.get('maximized')) win.maximize();
    win.show();
  });

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
  ipcMain.on('window:close-confirmation', (_event, confirm) => {
    closeConfirmation = confirm;
    // macOS: the dot in the close button, as for any unsaved document
    if (process.platform === 'darwin') win.setDocumentEdited(!!confirm);
  });
  win.on('close', (event) => {
    if (closeConfirmation) {
      const { title, message, discard, cancel } = closeConfirmation;
      const choice = dialog.showMessageBoxSync(win, { type: 'warning', title, message, buttons: [discard, cancel], defaultId: 1, cancelId: 1 });
      if (choice === 1) return event.preventDefault();
    }
    // Reopen where it was (the size before maximising, and whether it was)
    state.set('bounds', win.getNormalBounds());
    state.set('maximized', win.isMaximized());
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
// Save as: the native dialog, starting in the folder used last time
ipcMain.handle('file:save', async (event, { fileName, data, filterName, extensions }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const folder = state.get('lastDir') ?? app.getPath('downloads');
  const filters = extensions.length ? [{ name: filterName, extensions }] : [];
  const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: path.join(folder, path.basename(fileName)), filters });
  if (canceled || !filePath) return null;
  await fs.writeFile(filePath, data);
  state.set('lastDir', path.dirname(filePath));
  app.addRecentDocument(filePath);
  // The name the person may have changed in the dialog, for the confirmation
  return path.basename(filePath);
});

// Drag a file out of the window: a real file, written to a temporary folder first
ipcMain.on('file:drag', async (event, { fileName, data }) => {
  const folder = path.join(os.tmpdir(), 'vectopix-drag');
  const filePath = path.join(folder, path.basename(fileName));
  try {
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(filePath, data);
    event.sender.startDrag({ file: filePath, icon: nativeImage.createFromPath(ICON).resize({ width: 64, height: 64 }) });
  } catch {
    // Nothing to drag if it couldn't be written
  }
});

// Tracing progress on the Dock icon / taskbar button (null: none)
ipcMain.on('window:progress', (event, fraction) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.setProgressBar(typeof fraction === 'number' ? Math.min(1, Math.max(0, fraction)) : -1);
});

// The theme chosen in Settings also applies to menus, dialogs and the title bar
ipcMain.on('app:theme', (_event, preference) => {
  if (!THEMES.includes(preference)) return;
  nativeTheme.themeSource = preference;
  state.set('theme', preference);
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
    state = createDesktopState(app.getPath('userData'));
    // Before the window exists, so it opens in the right colours
    if (THEMES.includes(state.get('theme'))) nativeTheme.themeSource = state.get('theme');
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
