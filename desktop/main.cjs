const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let window;
const appFile = path.join(__dirname, '..', 'index.html');
const appURL = pathToFileURL(appFile).href;
function trusted(event) { if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== appURL) throw new Error('Untrusted request'); }
function openWindow() {
  window = new BrowserWindow({ width: 1440, height: 980, minWidth: 760, minHeight: 620, title: 'Benet', backgroundColor: '#f7f8f1', icon: path.join(__dirname, '../build/icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.webContents.setWindowOpenHandler(({url}) => { if (url === 'https://github.com/CookieBoi09/Benet/releases') shell.openExternal(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => { if (url !== appURL) event.preventDefault(); });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.loadFile(appFile);
  window.on('closed', () => { window = null; });
}
app.whenReady().then(() => {
  ipcMain.handle('library:export', async (event, content) => {
    trusted(event);
    if (typeof content !== 'string' || Buffer.byteLength(content) > 20e6) throw new Error('Invalid backup');
    const data = JSON.parse(content); if (data.version !== 1 || !Array.isArray(data.pages)) throw new Error('Invalid backup');
    const result = await dialog.showSaveDialog(window, { title: 'Export Benet library', defaultPath: 'benet-library.json', filters: [{name:'Benet library', extensions:['json']}] });
    if (result.canceled || !result.filePath) return false;
    await fs.writeFile(result.filePath, content, 'utf8'); return true;
  });
  ipcMain.handle('library:import', async event => {
    trusted(event);
    const result = await dialog.showOpenDialog(window, { title: 'Import a library or Notion page', properties:['openFile'], filters:[{name:'Benet library or Markdown',extensions:['json','md','markdown','txt']}] });
    if (result.canceled || !result.filePaths[0]) return null;
    const filename = result.filePaths[0]; const stat = await fs.stat(filename);
    if (!stat.isFile() || stat.size > 20e6) throw new Error('File must be smaller than 20 MB');
    return { name:path.basename(filename), text:await fs.readFile(filename, 'utf8') };
  });
  const action = id => () => window?.webContents.send('menu:action', id);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{role:'appMenu'}] : []),
    {label:'File',submenu:[{label:'New mind map',accelerator:'CmdOrCtrl+N',click:action('new')},{label:'Import…',accelerator:'CmdOrCtrl+O',click:action('import')},{label:'Export library…',accelerator:'CmdOrCtrl+Shift+S',click:action('export')},{type:'separator'},{role:process.platform==='darwin'?'close':'quit'}]},
    {role:'editMenu'}, {role:'viewMenu'}, {label:'Practice',submenu:[{label:'Practice current map',accelerator:'CmdOrCtrl+Shift+P',click:action('open-quiz')}]}, {role:'windowMenu'}
  ]));
  openWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) openWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
