const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('DMDesktop', {
  setTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      ipcRenderer.send('dm-theme', theme);
    }
  },
});
