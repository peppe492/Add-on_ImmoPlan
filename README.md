
# 🏠 MM's PROPERTY - Real Estate Management AI

**MM's PROPERTY** è una piattaforma *all-in-one* ibrida per la gestione avanzata di investimenti immobiliari, ristrutturazioni e locazioni. Progettata per investitori e property manager, combina strumenti finanziari rigorosi con la potenza dell'Intelligenza Artificiale Generativa (Google Gemini) per offrire analisi strategiche, visualizzazione di design e automazione.

L'applicazione è **cross-platform**: funziona sia come applicazione Desktop nativa (Windows) che come Add-on integrato in Home Assistant.
<img width="1750" height="886" alt="image" src="https://github.com/user-attachments/assets/1cf499a7-a79d-4529-907b-8188188b3328" />

---

## ✨ Funzionalità Principali

### 💰 Gestione Finanziaria e Ristrutturazioni
*   **Business Plan Dettagliato:** Tracciamento granulare di prezzo d'acquisto, spese notarili, agenzia e tasse.
*   **Gestione Cantiere:** Breakdown dei costi di ristrutturazione (Lavori, Materiali, Tecnici) con monitoraggio SAL (Stato Avanzamento Lavori) e pagamenti (Acconti vs Saldi).
*   **Analisi Mutuo vs Liquidità:** Calcolo automatico del fabbisogno di cassa, LTV (Loan-to-Value) e sostenibilità dell'investimento.
*   **Scenari Multipli:** Possibilità di salvare e confrontare diverse versioni del progetto (es. "Scenario Ottimistico" vs "Scenario Prudente").

### 🤖 AI Powerhouse (Powered by Google Gemini)
*   **AI Advisor Strategico:** Analisi automatica del piano finanziario per individuare rischi e opportunità (modello *Gemini 3 Pro*).
*   **Live Consultant Vocale:** Interazione vocale in tempo reale per discutere del progetto come con un consulente umano (modello *Gemini 2.5 Flash Native Audio*).
*   **Interior Designer:** Modifica delle foto degli ambienti esistenti tramite prompt testuale (modello *Imagen/Gemini Vision*).
*   **Video Walkthrough:** Generazione di video cinematici per visualizzare il potenziale dell'immobile (modello *Veo 3.1*).
*   **Market Intelligence:** Ricerca di mercato con dati aggiornati e mappe (Google Search & Maps Grounding).

### 📋 Gestione Locazioni e Patrimonio
*   **Registro Affitti:** Tracciamento incassi, spese condominiali, utenze e calcolo del Cashflow Netto reale.
*   **Anagrafica:** Gestione completa di Inquilini e Locatori con archiviazione documenti.
*   **Dashboard Patrimonio:** Vista globale degli asset, calcolo del ROI e trend finanziari (Annuale/Mensile).

### 🔌 Integrazione Home Assistant (IoT)
*   **Sensori Virtuali:** Espone automaticamente metriche finanziarie su HA (es. `sensor.immoplan_cashflow_netto`, `sensor.immoplan_valore_asset`).
*   **Calendario Scadenze:** Nuovo sensore `calendar_events` che espone la prossima scadenza come stato e la lista completa degli eventi futuri come attributi JSON (ottimo per card Lovelace personalizzate).
*   **Ingress Ready:** Si integra nativamente nell'interfaccia di Home Assistant senza configurazioni di porta complesse.

---

## 🛠 Specifiche Tecniche

### Architettura Ibrida
Il progetto utilizza un'architettura a codice unico (Monorepo-style) capace di compilare target diversi:
1.  **Desktop (Electron):** Eseguibile `.exe` standalone con backend Node.js integrato.
2.  **Server/Container (Docker):** Immagine ottimizzata per Home Assistant Add-on o deployment cloud.

### Tech Stack
*   **Frontend:** React 19, Vite, TailwindCSS.
*   **UI Components:** Recharts (Grafici), Leaflet (Mappe), Lucide React (Icone).
*   **Backend:** Node.js con Express (gestione API locali e proxy).
*   **Database:** JSON-based persistence (`immoplan_data.json`) con caching locale IndexedDB per performance istantanee.
*   **AI SDK:** Google GenAI SDK (`@google/genai`).

### Modelli AI Utilizzati
L'applicazione sfrutta l'ultima suite di modelli Google:
*   **Reasoning:** `gemini-3-pro-preview` (Analisi finanziaria complessa).
*   **Multimodal/Audio:** `gemini-2.5-flash-native-audio-preview-12-2025` (Consulente Live).
*   **Search/Grounding:** `gemini-2.5-flash` con Tools Google Search & Maps.
*   **Vision/Edit:** `gemini-2.5-flash-image` (Editing foto stanze).
*   **Video:** `veo-3.1-fast-generate-preview` (Generazione video render).

### Struttura Dati
I dati sono salvati localmente per garantire la privacy e la portabilità:
*   **Path (HA/Docker):** `/data/immoplan_data.json` (Volume persistente).
*   **Path (Windows):** `%APPDATA%` o cartella locale dell'eseguibile.
*   **Backup:** Funzionalità di Export/Import completo in formato JSON e CSV.

---

## 🚀 Installazione

### Home Assistant (Add-on)
1.  Aggiungi il repository locale o copia la cartella in `/addons/`.
2.  Installa l'add-on.
3.  Configura la `api_key` di Google Gemini nella tab **Configurazione**.
4.  Avvia e apri la Web UI.

### Windows (Sviluppo)
```bash
# Installazione dipendenze
npm install

# Avvio in modalità sviluppo (React + Backend)
npm run dev

# Build Eseguibile (.exe)
npm run dist
```
