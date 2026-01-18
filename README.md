# Home Assistant Add-on: MM's Property Management

![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield]

# 🏠 MM's PROPERTY - Real Estate Management


MM's Property Management allows you to run a comprehensive real estate investment and rental platform seamlessly within Home Assistant.

## About

**MM's PROPERTY** is an all-in-one hybrid platform designed for the advanced management of real estate investments, renovations, and rentals. Built for investors and property managers, it combines rigorous financial tools with the power of Generative AI (Google Gemini) to provide strategic analysis, design visualization, and automation.

The application is cross-platform, functioning as both a native Windows desktop application and an integrated Home Assistant Add-on.

## ✨ Key Features

### 💰 Financial Management & Renovations
- **Detailed Business Plans**: Granular tracking of purchase prices, notary fees, agency commissions, and taxes.
- **Construction Site Management**: Breakdown of renovation costs (Labor, Materials, Technical fees) with Progress Status (SAL) monitoring and payment tracking (Deposits vs. Balances).
- **Mortgage vs. Liquidity Analysis**: Automatic calculation of cash requirements, LTV (Loan-to-Value), and investment sustainability.
- **Scenario Modeling**: Save and compare multiple project versions (e.g., "Optimistic" vs. "Prudent").

### 🤖 AI Powerhouse (Powered by Google Gemini)
- **Strategic AI Advisor**: Automated financial plan analysis to identify risks and opportunities (Gemini 1.5 Pro).
- **Live Voice Consultant**: Real-time voice interaction to discuss projects naturally (Gemini 2.0 Flash Native Audio).
- **Interior Designer**: Modify existing room photos via text prompts (Imagen / Gemini Vision).
- **Video Walkthroughs**: Generate cinematic videos to visualize property potential (Veo 1.0).
- **Market Intelligence**: Market research with up-to-date data and mapping (Google Search & Maps Grounding).

### 📋 Rental & Asset Management
- **Lease Registry**: Track income, condo fees, and utilities with real-time Net Cashflow calculation.
- **Tenant Database**: Complete management of tenants and landlords with integrated document storage.
- **Asset Dashboard**: Global view of assets, ROI calculations, and financial trends (Annual/Monthly).

### 🔌 Home Assistant Integration (IoT)
- **Virtual Sensors**: Automatically exposes financial metrics to Home Assistant (e.g., `sensor.immoplan_net_cashflow`, `sensor.immoplan_asset_value`).
- **Ingress Ready**: Native integration with the Home Assistant UI without complex port configurations.

## 🛠 Technical Specifications

### Hybrid Architecture
The project utilizes a monorepo-style architecture capable of targeting multiple platforms:
- **Desktop (Electron)**: Standalone `.exe` with an integrated Node.js backend.
- **Server/Container (Docker)**: Optimized image for Home Assistant Add-ons or cloud deployment.

### Tech Stack
- **Frontend**: React 19, Vite, TailwindCSS.
- **UI Components**: Recharts (Analytics), Leaflet (Maps), Lucide React (Icons).
- **Backend**: Node.js with Express (Local API management and proxy).
- **Database**: JSON-based persistence (`immoplan_data.json`) with local IndexedDB caching for near-instant performance.
- **AI SDK**: Google GenAI SDK.

### AI Models Utilized
- **Reasoning**: `gemini-1.5-pro` (Complex financial analysis).
- **Multimodal/Audio**: `gemini-2.0-flash-exp` (Live Consultant).
- **Search/Grounding**: `gemini-2.0-flash` with Google Search & Maps tools.
- **Vision/Edit**: `gemini-1.5-flash` (Room photo editing).
- **Video**: `veo-1.0` (Render generation).

### Data Structure
Data is stored locally to ensure privacy and portability:
- **Path (HA/Docker)**: `/data/immoplan_data.json` (Persistent volume).
- **Path (Windows)**: `%APPDATA%` or local executable folder.
- **Backup**: Full Export/Import functionality in JSON and CSV formats.

## 🚀 Installation

### Home Assistant Add-on
1. Add this repository to your Home Assistant instance or copy the folder to `/addons/`.
2. Install the **MM's Property Management** add-on.
3. Configure your **Google Gemini API Key** in the Configuration tab.
4. Start the add-on and open the Web UI.

### Windows (Development)
1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start Development Mode** (React + Backend):
   ```bash
   npm run dev
   ```
3. **Build Executable** (.exe):
   ```bash
   npm run dist
   ```

## Support

If you encounter a bug or have a feature request, please create an issue on the GitHub repository.

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg# Home Assistant Add-on: MM's Property Management

![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield]
```

```
# **🏠 MM's PROPERTY - Real Estate Management**

[Add-on Name] allows you to run [Service Name] seamlessly within Home Assistant.

## About

MM's PROPERTY è una piattaforma all-in-one ibrida per la gestione avanzata di investimenti immobiliari, ristrutturazioni e locazioni. Progettata per investitori e property manager, combina strumenti finanziari rigorosi con la potenza dell'Intelligenza Artificiale Generativa (Google Gemini) per offrire analisi strategiche, visualizzazione di design e automazione.
L'applicazione è cross-platform: funziona sia come applicazione Desktop nativa (Windows) che come Add-on integrato in Home Assistant.
```

```

# **✨ Funzionalità Principali**

💰 ## Gestione Finanziaria e Ristrutturazioni
- **Business Plan Dettagliato**: Tracciamento granulare di prezzo d'acquisto, spese notarili, agenzia e tasse.
- # Gestione Cantiere: Breakdown dei costi di ristrutturazione (Lavori, Materiali, Tecnici) con monitoraggio SAL (Stato Avanzamento Lavori) e pagamenti (Acconti vs Saldi).
- # Analisi Mutuo vs Liquidità: Calcolo automatico del fabbisogno di cassa, LTV (Loan-to-Value) e sostenibilità dell'investimento.
- **Scenari Multipli:** Possibilità di salvare e confrontare diverse versioni del progetto (es. "Scenario Ottimistico" vs "Scenario Prudente").
```

```
🤖 ## AI Powerhouse (Powered by Google Gemini)
- AI Advisor Strategico: Analisi automatica del piano finanziario per individuare rischi e opportunità (modello Gemini 3 Pro).
- Live Consultant Vocale: Interazione vocale in tempo reale per discutere del progetto come con un consulente umano (modello Gemini 2.5 Flash Native Audio).
- Interior Designer: Modifica delle foto degli ambienti esistenti tramite prompt testuale (modello Imagen/Gemini Vision).
- Video Walkthrough: Generazione di video cinematici per visualizzare il potenziale dell'immobile (modello Veo 3.1).
- **Market Intelligence**: Ricerca di mercato con dati aggiornati e mappe (Google Search & Maps Grounding).
```

```
## 📋 Gestione Locazioni e Patrimonio
- Registro Affitti: Tracciamento incassi, spese condominiali, utenze e calcolo del Cashflow Netto reale.
- Anagrafica: Gestione completa di Inquilini e Locatori con archiviazione documenti.
Dashboard Patrimonio: Vista globale degli asset, calcolo del ROI e trend finanziari (Annuale/Mensile).
## 🔌 Integrazione Home Assistant (IoT)
- Sensori Virtuali: Espone automaticamente metriche finanziarie su HA (es. sensor.immoplan_cashflow_netto, sensor.immoplan_valore_asset).
- Ingress Ready: Si integra nativamente nell'interfaccia di Home Assistant senza configurazioni di porta complesse.

```

```
# 🛠 Specifiche Tecniche
## Architettura Ibrida
Il progetto utilizza un'architettura a codice unico (Monorepo-style) capace di compilare target diversi:
- Desktop (Electron): Eseguibile .exe standalone con backend Node.js integrato.
- Server/Container (Docker): Immagine ottimizzata per Home Assistant Add-on o deployment cloud.
## Tech Stack
- Frontend: React 19, Vite, TailwindCSS.
- UI Components: Recharts (Grafici), Leaflet (Mappe), Lucide React (Icone).
- Backend: Node.js con Express (gestione API locali e proxy).
- Database: JSON-based persistence (immoplan_data.json) con caching locale IndexedDB per performance istantanee.
- AI SDK: Google GenAI SDK (@google/genai).
## Modelli AI Utilizzati
L'applicazione sfrutta l'ultima suite di modelli Google:
Reasoning: gemini-3-pro-preview (Analisi finanziaria complessa).
Multimodal/Audio: gemini-2.5-flash-native-audio-preview-12-2025 (Consulente Live).
Search/Grounding: gemini-2.5-flash con Tools Google Search & Maps.
Vision/Edit: gemini-2.5-flash-image (Editing foto stanze).
Video: veo-3.1-fast-generate-preview (Generazione video render).
## Struttura Dati
I dati sono salvati localmente per garantire la privacy e la portabilità:
Path (HA/Docker): /data/immoplan_data.json (Volume persistente).
Path (Windows): %APPDATA% o cartella locale dell'eseguibile.
Backup: Funzionalità di Export/Import completo in formato JSON e CSV.

🚀 Installazione Home Assistant (Add-on)
1. Aggiungi il repository locale o copia la cartella in /addons/.
2. Installa l'add-on.
3. Configura la api_key di Google Gemini nella tab Configurazione.
4. Avvia e apri la Web UI.
5. Windows (Sviluppo)

# Installazione dipendenze
npm install

# Avvio in modalità sviluppo (React + Backend)
npm run dev

# Build Eseguibile (.exe)
npm run dist

## Support

If you find a bug, please create an issue on GitHub.

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg
