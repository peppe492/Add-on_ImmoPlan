
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const http = require('http');

// Configurazione
const SERVER_PORT = 9301;
const WINDOW_WIDTH = 1400;
const WINDOW_HEIGHT = 900;

let mainWindow;
let serverProcess;
let tray = null;
let isQuitting = false;

// Rilevamento modalità background
const exeName = path.basename(process.execPath).toLowerCase();
const isBackgroundExe = exeName.includes('background');
const startHidden = process.argv.includes('--hidden') || isBackgroundExe;

function startServer() {
  const serverPath = path.join(__dirname, 'server.js');
  serverProcess = fork(serverPath, [], {
    env: { ...process.env, PORT: SERVER_PORT, ELECTRON_RUN: 'true' },
    stdio: 'pipe'
  });

  if (serverProcess.stdout) {
    serverProcess.stdout.on('data', (data) => console.log(`[Backend]: ${data}`));
  }
}

function checkServerReady() {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      http.get(`http://localhost:${SERVER_PORT}/api/status`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve();
        }
      }).on('error', () => {});
    }, 500);
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'public/icon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(icon);
  tray.setToolTip("MM's PROPERTY Manager");

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Apri Dashboard', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Esci', click: () => { isQuitting = true; app.quit(); } }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    title: "MM's PROPERTY",
    icon: path.join(__dirname, 'public/icon.ico'), 
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    autoHideMenuBar: true
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  await checkServerReady();
  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  mainWindow.once('ready-to-show', () => {
    if (!startHidden) {
      mainWindow.show();
    }
  });

  if (!tray) createTray();
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    startServer();
    createWindow();
  });
}

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});
