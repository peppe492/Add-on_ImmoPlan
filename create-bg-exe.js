
const fs = require('fs');
const path = require('path');

const releaseRoot = path.join(__dirname, 'release');

console.log('--- Post-Build Script: Creazione Eseguibile Background ---');

if (!fs.existsSync(releaseRoot)) {
  console.error(`❌ Errore: La cartella ${releaseRoot} non esiste. Esegui prima "npm run dist".`);
  process.exit(1);
}

// Cerca la cartella "win-unpacked" generata da electron-builder
const unpackedDirName = 'win-unpacked';
const targetDir = path.join(releaseRoot, unpackedDirName);

if (!fs.existsSync(targetDir)) {
  console.error(`❌ Errore: Cartella ${unpackedDirName} non trovata in release/.`);
  process.exit(1);
}

const originalExe = 'MM Property Manager.exe';
const backgroundExe = 'MM Property Manager (Background).exe';

const sourcePath = path.join(targetDir, originalExe);
const destPath = path.join(targetDir, backgroundExe);

if (fs.existsSync(sourcePath)) {
  try {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ Successo! Creato: ${backgroundExe}`);
  } catch (err) {
    console.error('❌ Errore durante la copia:', err);
    process.exit(1);
  }
} else {
  console.error(`⚠️  File originale non trovato: ${originalExe}`);
  process.exit(1);
}
