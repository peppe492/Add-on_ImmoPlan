
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File System
  readFile: (path) => ipcRenderer.invoke('fs-read-file', path),

  // Crypto
  sha256: (data) => ipcRenderer.invoke('crypto-sha256', data),

  // IPC Messaggistica
  saveData: (data) => ipcRenderer.send('save-data', data),

  // Listener eventi
  onUpdateData: (callback) => {
    const subscription = (event, value) => callback(value);
    ipcRenderer.on('update-data', subscription);
    return () => {
      ipcRenderer.removeListener('update-data', subscription);
    };
  }
});
