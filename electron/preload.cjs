// The only bridge between the interface and the desktop shell. It exposes a
// handful of named operations, never ipcRenderer itself: the page stays
// sandboxed and can only ask for what is listed here.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const subscribe = (channel, handler) => {
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

const info = ipcRenderer.sendSync('app:info');

contextBridge.exposeInMainWorld('vectopixDesktop', {
  platform: info.platform,
  isPackaged: info.isPackaged,
  setMenu: (sections) => ipcRenderer.send('menu:set', sections),
  onCommand: (handler) => subscribe('menu:command', handler),
  onOpenFile: (handler) => {
    const unsubscribe = subscribe('file:open', handler);
    // Files waiting since startup are sent once someone listens
    ipcRenderer.send('file:ready');
    return unsubscribe;
  },
  rememberFile: (file) => {
    const path = webUtils.getPathForFile(file);
    if (path) ipcRenderer.send('file:remember', path);
  },
  setCloseConfirmation: (confirm) => ipcRenderer.send('window:close-confirmation', confirm),
});
