
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const http = require('http');

const app = express();
const PORT = 9301;
const DB_FILE = process.env.DB_PATH || '/data/immoplan_data.json';
const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN || process.env.HASSIO_TOKEN; 

// --- GESTIONE CONFIGURAZIONE ---
let apiKey = process.env.API_KEY || '';
let haManualToken = ''; 
let appTitle = "MM's PROPERTY";
let darkMode = false;
let logLevel = 'info'; 
let sensorPrefix = 'immoplan';
let syncInterval = 60; 

// STATE MACHINE
let sensorCache = {}; 
let isPushing = false; 

// CIRCUIT BREAKER
let consecutiveFailures = 0;
let circuitOpenUntil = 0; 

const optionsPath = '/data/options.json';

function loadOptions() {
  if (fs.existsSync(optionsPath)) {
    try {
      const options = JSON.parse(fs.readFileSync(optionsPath, 'utf8'));
      if (options.api_key) apiKey = options.api_key;
      if (options.ha_token) haManualToken = String(options.ha_token).trim();
      if (options.app_title) appTitle = options.app_title;
      if (options.dark_mode !== undefined) darkMode = options.dark_mode;
      
      if (options.log_level) {
          const rawLevel = Array.isArray(options.log_level) ? options.log_level[0] : options.log_level;
          logLevel = String(rawLevel).trim().toLowerCase();
      }
      
      if (options.sensor_prefix) sensorPrefix = String(options.sensor_prefix).toLowerCase().replace(/[^a-z0-9_]/g, '_');
      
      log('info', `[SYSTEM] Config caricata. Modalità HA: MANUALE (Push su richiesta).`);
    } catch (e) {
      console.error("[ERROR] Errore lettura options.json:", e);
    }
  }
}

function log(level, message) {
    const levels = { debug: 0, info: 1, error: 2 };
    const currentLevelWeight = levels[logLevel] !== undefined ? levels[logLevel] : 1;
    
    if (levels[level] >= currentLevelWeight) {
        if (level === 'error') console.error(message);
        else console.log(message);
    }
}

loadOptions();

function makeRequest(options, payload) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                res.resume();
                resolve(true);
            } else {
                let errorBody = '';
                res.on('data', chunk => errorBody += chunk);
                res.on('end', () => {
                    reject(new Error(`HTTP ${res.statusCode}: ${errorBody}`));
                });
            }
        });

        req.on('error', (e) => {
            reject(new Error(e.message));
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error("Timeout"));
        });

        if (payload) req.write(payload);
        req.end();
    });
}

// STRATEGIA DI CONNESSIONE MULTIPLA
// Prova in sequenza: Config Manuale Hostname -> Config Manuale IP -> Supervisor Proxy
async function sendWithMultiStrategy(sensor, payload) {
    const strategies = [];
    
    // 1. Strategie Token Manuale (se configurato)
    if (haManualToken && haManualToken.length > 10) {
        strategies.push({
            name: 'Direct Core (Hostname)',
            host: 'homeassistant',
            port: 8123,
            path: `/api/states/${sensor.id}`,
            token: haManualToken
        });
        strategies.push({
            name: 'Direct Core (Fallback IP)',
            host: '172.30.32.1',
            port: 8123,
            path: `/api/states/${sensor.id}`,
            token: haManualToken
        });
    }

    // 2. Strategia Supervisor Proxy (Sempre disponibile negli add-on)
    if (SUPERVISOR_TOKEN) {
        strategies.push({
            name: 'Supervisor Proxy',
            host: 'supervisor',
            port: 80,
            path: `/core/api/states/${sensor.id}`,
            token: SUPERVISOR_TOKEN
        });
    }

    if (strategies.length === 0) {
        throw new Error("Nessun metodo di connessione disponibile (Manca Token Manuale e Supervisor).");
    }

    let lastError = null;

    // Itera le strategie finché una non funziona
    for (const strat of strategies) {
        try {
            const options = {
                hostname: strat.host,
                port: strat.port,
                path: strat.path,
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${strat.token}`, 
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                    'Connection': 'close' 
                },
                agent: false,
                timeout: 5000 
            };
            
            await makeRequest(options, payload);
            
            // Se abbiamo dovuto usare una strategia di fallback (non la prima), logghiamolo
            if (strategies.length > 1 && strat.name !== strategies[0].name) {
                log('info', `[HA-RECOVERY] Connessione riuscita usando strategia alternativa: ${strat.name}`);
            }
            
            return true; // Successo, esci dal loop
        } catch (e) {
            lastError = e;
            // Continua alla prossima strategia
        }
    }
    
    // Se siamo qui, tutte le strategie hanno fallito
    throw lastError;
}

async function pushToHASensors(data) {
  // Check Circuit Breaker (resetta se invocato manualmente dall'utente, vedi endpoint sotto)
  const now = Date.now();
  if (circuitOpenUntil > now) {
      const waitTime = Math.ceil((circuitOpenUntil - now) / 1000);
      throw new Error(`Protezione attiva (troppi errori). Riprova tra ${waitTime} secondi.`);
  }

  if (isPushing) throw new Error("Un aggiornamento è già in corso.");
  isPushing = true; 

  try {
      // --- PREPARAZIONE DATI ---
      const properties = data.properties || [];
      const records = data.rentalRecords || [];
      const customSensorsConfig = data.config?.customSensors || [];
      
      const nowDate = new Date();
      const currentMonth = nowDate.getMonth();
      const currentYear = nowDate.getFullYear();

      const totalAssets = properties.reduce((acc, p) => acc + (Number(p.currentValue) || 0), 0);
      const totalMonthlyIncome = records
        .filter(r => r.month === currentMonth && r.year === currentYear)
        .reduce((acc, r) => acc + (Number(r.income) || 0), 0);

      let totalMonthlyExpenses = 0;
      properties.forEach(p => {
        if (p.recurringCosts) {
          p.recurringCosts.forEach(c => {
            const amount = Number(c.amount) || 0;
            if (c.frequency === 'MONTHLY') totalMonthlyExpenses += amount;
            else if (c.frequency === 'YEARLY') totalMonthlyExpenses += (amount / 12);
          });
        }
        const hasMortgageCost = p.recurringCosts?.some(c => c.category === 'MORTGAGE');
        if (!hasMortgageCost && p.financials?.mortgageAmount && p.financials?.mortgageDuration) {
           const durationMonths = p.financials.mortgageDuration * 12;
           if (durationMonths > 0) totalMonthlyExpenses += (Number(p.financials.mortgageAmount) / durationMonths);
        }
      });

      const netCashflow = totalMonthlyIncome - totalMonthlyExpenses;
      const pfx = `sensor.${sensorPrefix}`;

      const sensors = [
        { id: `${pfx}_total_assets`, state: totalAssets, unit: '€', icon: 'mdi:home-group', name: 'Valore Portfolio Immobiliare' },
        { id: `${pfx}_monthly_income`, state: totalMonthlyIncome, unit: '€', icon: 'mdi:cash-plus', name: 'Entrate Reali (Mese)' },
        { id: `${pfx}_monthly_expenses`, state: totalMonthlyExpenses.toFixed(2), unit: '€', icon: 'mdi:cash-minus', name: 'Uscite Stimate (Mese)' },
        { id: `${pfx}_net_cashflow`, state: netCashflow.toFixed(2), unit: '€', icon: 'mdi:chart-line-variant', name: 'Cashflow Netto (Mese)' },
        { id: `${pfx}_property_count`, state: properties.length, unit: 'unità', icon: 'mdi:home-city', name: 'Numero Proprietà' }
      ];

      customSensorsConfig.forEach(cs => {
          let val = 0;
          let unit = '€';
          let icon = 'mdi:chart-line';

          if (cs.type === 'PROPERTY_CASHFLOW' && cs.targetId) {
              const p = properties.find(prop => prop.id === cs.targetId);
              if (p) {
                  const income = records
                    .filter(r => r.propertyId === cs.targetId && r.month === currentMonth && r.year === currentYear)
                    .reduce((acc, r) => acc + (Number(r.income) || 0), 0);
                  let expenses = 0;
                  if (p.recurringCosts) {
                      p.recurringCosts.forEach(c => {
                          if (c.frequency === 'MONTHLY') expenses += Number(c.amount) || 0;
                          else if (c.frequency === 'YEARLY') expenses += (Number(c.amount) || 0) / 12;
                      });
                  }
                  val = income - expenses;
              }
          } else if (cs.type === 'PROPERTY_VALUE' && cs.targetId) {
              const p = properties.find(prop => prop.id === cs.targetId);
              if (p) {
                  val = Number(p.currentValue) || 0;
                  icon = 'mdi:home';
              }
          } else if (cs.type === 'CATEGORY_TOTAL' && cs.targetId) {
              properties.forEach(p => {
                  if (p.recurringCosts) {
                      p.recurringCosts.filter(c => c.category === cs.targetId).forEach(c => {
                          if (c.frequency === 'MONTHLY') val += Number(c.amount) || 0;
                          else if (c.frequency === 'YEARLY') val += (Number(c.amount) || 0) / 12;
                      });
                  }
                  if (cs.targetId === 'MORTGAGE') {
                      const hasMortgageCost = p.recurringCosts?.some(c => c.category === 'MORTGAGE');
                      if (!hasMortgageCost && p.financials?.mortgageAmount && p.financials?.mortgageDuration) {
                          val += (Number(p.financials.mortgageAmount) / (p.financials.mortgageDuration * 12));
                      }
                  }
              });
          }

          sensors.push({
              id: `${pfx}_${cs.entity_id_suffix}`,
              state: typeof val === 'number' ? val.toFixed(2) : val,
              unit: unit,
              icon: icon,
              name: cs.name
          });
      });

      let successCount = 0;
      let failCount = 0;

      for (const s of sensors) {
          const payload = JSON.stringify({
              state: String(s.state), 
              attributes: {
                  unit_of_measurement: s.unit,
                  friendly_name: s.name,
                  icon: s.icon,
                  integration: 'ImmoPlan Add-on'
              }
          });

          try {
              await sendWithMultiStrategy(s, payload);
              const signature = JSON.stringify({ s: String(s.state), n: s.name });
              sensorCache[s.id] = signature;
              successCount++;
              consecutiveFailures = 0; 
          } catch (e) {
              failCount++;
              consecutiveFailures++;
              log('error', `[HA-FAIL] ${s.id}: ${e.message}`);
              
              if (consecutiveFailures >= 3) {
                  circuitOpenUntil = Date.now() + (5 * 60 * 1000);
                  throw new Error("Troppi errori consecutivi. Il sistema entra in pausa.");
              }
          }
          // Pausa per non sovraccaricare
          await new Promise(r => setTimeout(r, 1000));
      }

      log('info', `[HA-MANUAL-PUSH] Completato. ${successCount} OK, ${failCount} Errori.`);
      return { success: true, updated: successCount, failed: failCount };

  } catch (error) {
      log('error', `[HA-PUSH-CRASH] ${error.message}`);
      throw error;
  } finally {
      isPushing = false; 
  }
}

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) return true;
  fs.mkdirSync(dirname, { recursive: true });
}

app.get('/env-config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.process = { env: { API_KEY: "${apiKey}" } }; window.appConfig = { title: "${appTitle}", darkMode: ${darkMode} };`);
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

app.post('/api/log', (req, res) => {
  const { message, type, time } = req.body;
  log('info', `[UI-LOG] [${time}] ${message}`);
  res.json({ success: true });
});

app.get('/api/sync', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (fs.existsSync(DB_FILE)) {
    try {
      res.json(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
  } else {
    res.json({});
  }
});

app.post('/api/sync', (req, res) => {
  try {
    ensureDirectoryExistence(DB_FILE);
    fs.writeFileSync(DB_FILE, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ success: true });
  } catch (e) {
    log('error', `[DB-ERR] ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// TRIGGER MANUALE SENSORI HA
app.post('/api/ha/push_sensors', async (req, res) => {
    try {
        log('info', "[HA-MANUAL] Richiesto aggiornamento manuale sensori dall'utente.");
        
        // RESETTA IL CIRCUIT BREAKER QUANDO RICHIESTO MANUALMENTE
        consecutiveFailures = 0;
        circuitOpenUntil = 0;

        let data = {};
        if (fs.existsSync(DB_FILE)) {
            data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        }
        
        const result = await pushToHASensors(data);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/ha/entities', (req, res) => {
   res.json([]); 
});

app.get('/api/status', (req, res) => res.json({ status: 'online' }));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  log('info', `[SYSTEM] Avviato su porta ${PORT}. Modalità MANUALE attivata.`);
});
