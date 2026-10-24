// Vectopix desktop shell: serves the built web app (dist/) from a private,
// secure `app://` origin, so module workers, the clipboard and downloads
// behave exactly as on the web.
const { app, BrowserWindow, net, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DIST = path.join(__dirname, '..', 'dist');
const ORIGIN = 'app://vectopix';

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
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  win.once('ready-to-show', () => win.show());

  // External links open in the browser; the app never navigates away
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(ORIGIN)) event.preventDefault();
  });

  win.loadURL(`${ORIGIN}/index.html`);
}

app.whenReady().then(() => {
  protocol.handle('app', serveDist);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
