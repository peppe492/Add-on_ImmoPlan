
ISTRUZIONI PER LA VERSIONE DESKTOP (ELECTRON)
=============================================

1. INSTALLAZIONE DIPENDENZE
   Esegui nel terminale:
   npm install

2. SVILUPPO (REACT + ELECTRON)
   Per testare l'app in modalità sviluppo (nota: server.js in questo caso viene avviato da main.js, ma React potrebbe non avere l'hot reload completo se servito staticamente da server.js. Usa 'npm run dev' per solo web):
   npm run electron

3. CREAZIONE ESEGUIBILE WINDOWS (.exe)
   Questo comando compila React (in /dist) e pacchetta tutto in un installer:
   npm run dist

   Troverai l'installer (es. "MM Property Manager Setup 1.0.0.exe") nella cartella:
   /release

NOTE IMPORTANTI:
- API KEY: La chiave API di Google Gemini è attualmente gestita tramite `process.env`.
  In produzione Electron, le variabili d'ambiente di sistema vengono lette.
  Assicurati di impostare la variabile d'ambiente API_KEY su Windows, oppure modifica `main.js` per caricarla da un file .env locale (richiede pacchetto `dotenv`).
  
- PORTA 9301: L'app cercherà di avviare il server locale su http://localhost:9301. Se la porta è occupata, l'app potrebbe non caricare la UI.

- ICONA: Per avere l'icona personalizzata nell'eseguibile, posiziona un file `icon.ico` nella cartella `public/`.
