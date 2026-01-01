import { app, BrowserWindow } from 'electron';
import path from 'node:path';

const isDev = !app.isPackaged;

function createWindow() {
  // In dev: __dirname is <repo>/dist/electron
  // In prod: __dirname is inside the packaged app at <...>/dist/electron
  const iconPath = isDev
    ? path.join(__dirname, '..', '..', 'public', 'images', 'app-icons', 'app.ico')
    : path.join(__dirname, '..', 'renderer', 'images', 'app-icons', 'app.ico');

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // __dirname is <repo>/dist/electron at runtime.
    const indexHtml = path.join(__dirname, '..', 'renderer', 'index.html');
    win.loadFile(indexHtml);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
