const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('benetDesktop', {
  exportLibrary: content => ipcRenderer.invoke('library:export', content),
  importFile: () => ipcRenderer.invoke('library:import'),
  onMenuAction: callback => ipcRenderer.on('menu:action', (_event, action) => callback(action))
});
