
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 9301;
const DB_FILE = process.env.DB_PATH || '/data/immoplan_data.json';
const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN || process.env.HASSIO_TOKEN; 

// --- GESTIONE CONFIGURAZIONE ---
let apiKey = process.env.API_KEY || '';
let haManualToken = ''; 
let appTitle = "MM's PROPERTY";
let darkMode = false;
let logLevel = 'info'; 

const optionsPath = '/data/options.json';

function loadOptions() {
  if (fs.existsSync(optionsPath)) {
    try {
      const options = JSON.parse(fs.readFileSync(optionsPath, 'utf8'));
      if (options.api_key) apiKey = options.api_key;
      if (options.app_title) appTitle = options.app_title;
      if (options.dark_mode !== undefined) darkMode = options.dark_mode;
      console.log(`[SYSTEM] Configurazione caricata correttamente.`);
    } catch (e) {
      console.error("[ERROR] Errore lettura options.json:", e);
    }
  }
}

loadOptions();

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) return true;
  fs.mkdirSync(dirname, { recursive: true });
}

// Endpoint per passare la configurazione al frontend in modo sicuro
app.get('/env-config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.process = { env: { API_KEY: "${apiKey}" } }; window.appConfig = { title: "${appTitle}", darkMode: ${darkMode} };`);
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Servizio file statici dalla cartella dist prodotta da Vite
app.use(express.static(path.join(__dirname, 'dist')));

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
    res.status(500).json({ error: e.message });
  }
});

// --- HELPER PER INVIO A HOME ASSISTANT ---
const updateHASensor = async (entityIdSuffix, state, attributes = {}) => {
  if (!SUPERVISOR_TOKEN) return false;
  
  const entityId = `sensor.immoplan_${entityIdSuffix}`;
  const url = `http://supervisor/core/api/states/${entityId}`;
  
  const payload = {
    state: String(state),
    attributes: {
      ...attributes,
      friendly_name: attributes.friendly_name || `ImmoPlan ${entityIdSuffix}`,
      last_updated: new Date().toISOString()
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPERVISOR_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return response.ok;
  } catch (e) {
    console.error(`[HA PUSH ERROR] ${entityId}:`, e.message);
    return false;
  }
};

// --- LOGICA CALCOLO SENSORI ---
app.post('/api/ha/push_sensors', async (req, res) => {
  if (!fs.existsSync(DB_FILE)) {
    return res.status(404).json({ success: false, error: "Database not found" });
  }

  try {
    const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const config = dbData.config || {};
    const sensors = config.customSensors || [];
    let updatedCount = 0;
    let failedCount = 0;

    for (const sensor of sensors) {
      let state = 'unknown';
      let attrs = { icon: 'mdi:chart-line' };

      if (sensor.type === 'CALENDAR_EVENTS') {
          // --- CALENDAR LOGIC ---
          const events = [];
          
          // Helper to process cost item
          const processItem = (item, type) => {
              // 1. Check assignments
              if (item.assignments && Array.isArray(item.assignments)) {
                  item.assignments.forEach(a => {
                      if (a.date && a.amount > 0) {
                          events.push({
                              date: a.date,
                              label: item.description || item.label || 'Spesa',
                              amount: a.amount,
                              type: type,
                              is_paid: true // Assignments usually imply payment schedule or done
                          });
                      }
                  });
              }
              // 2. Check estimated payment date if not fully paid/assigned
              // Questo richiederebbe logica più complessa, per ora basiamoci su assignments
          };

          // Purchase Costs
          if (config.purchaseCosts) {
              Object.entries(config.purchaseCosts).forEach(([key, val]) => {
                  if (val && val.assignments) processItem({...val, label: key}, 'Purchase');
              });
          }
          
          // Renovation Costs
          if (config.renovationCosts) {
              if (config.renovationCosts.worksBreakdown) config.renovationCosts.worksBreakdown.forEach(w => processItem(w, 'Work'));
              if (config.renovationCosts.materialsBreakdown) config.renovationCosts.materialsBreakdown.forEach(m => processItem(m, 'Material'));
              if (config.renovationCosts.design) processItem(config.renovationCosts.design, 'Design');
          }

          // Sort events by date
          events.sort((a, b) => new Date(a.date) - new Date(b.date));
          
          // Find next event
          const today = new Date().toISOString().split('T')[0];
          const nextEvent = events.find(e => e.date >= today);
          
          state = nextEvent ? nextEvent.date : 'N/A';
          attrs = {
              friendly_name: sensor.name,
              icon: 'mdi:calendar-clock',
              next_amount: nextEvent ? nextEvent.amount : 0,
              next_label: nextEvent ? nextEvent.label : '',
              events: events, // JSON list for frontend cards
              total_events: events.length
          };

      } else if (sensor.type === 'PROPERTY_CASHFLOW' && sensor.targetId) {
        // --- CASHFLOW LOGIC ---
        const records = dbData.rentalRecords || [];
        const propRecords = records.filter(r => r.propertyId === sensor.targetId);
        
        let totalNet = 0;
        let lastMonthNet = 0;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        propRecords.forEach(r => {
           // Basic Net Calc
           const expenses = (r.mortgage||0) + (r.condo||0) + (r.utilities||0) + (r.internet||0) + (r.maintenance||0) + (r.taxes||0) + (r.other||0);
           const net = (r.income||0) - expenses;
           totalNet += net;

           if (r.month === currentMonth && r.year === currentYear) {
               lastMonthNet += net;
           }
        });

        state = lastMonthNet.toFixed(2);
        attrs = {
            friendly_name: sensor.name,
            icon: 'mdi:cash-multiple',
            unit_of_measurement: '€',
            total_net_all_time: totalNet.toFixed(2),
            transaction_count: propRecords.length
        };

      } else if (sensor.type === 'PROPERTY_VALUE' && sensor.targetId) {
         // --- PROPERTY VALUE LOGIC ---
         const props = dbData.properties || [];
         const prop = props.find(p => p.id === sensor.targetId);
         if (prop) {
             state = prop.currentValue || 0;
             attrs = {
                 friendly_name: sensor.name,
                 icon: 'mdi:home-city',
                 unit_of_measurement: '€',
                 purchase_price: prop.purchasePrice,
                 gain: (prop.currentValue || 0) - (prop.purchasePrice || 0)
             };
         }
      } else if (sensor.type === 'CATEGORY_TOTAL' && sensor.targetId) {
          // --- CATEGORY LOGIC (e.g. Mortgage Total) ---
          const props = dbData.properties || [];
          let monthlyTotal = 0;
          
          props.forEach(p => {
              if (p.recurringCosts) {
                  p.recurringCosts.forEach(c => {
                      if (c.category === sensor.targetId) {
                          if (c.frequency === 'MONTHLY') monthlyTotal += (c.amount || 0);
                          else if (c.frequency === 'YEARLY') monthlyTotal += (c.amount || 0) / 12;
                      }
                  });
              }
              // Fallback for Mortgage in financials
              if (sensor.targetId === 'MORTGAGE' && p.financials && p.financials.mortgageAmount) {
                  const hasExplicit = p.recurringCosts?.some(c => c.category === 'MORTGAGE');
                  if (!hasExplicit) {
                      monthlyTotal += (p.financials.mortgageAmount / ((p.financials.mortgageDuration || 20) * 12));
                  }
              }
          });
          
          state = monthlyTotal.toFixed(2);
          attrs = {
              friendly_name: sensor.name,
              icon: 'mdi:chart-pie',
              unit_of_measurement: '€/mese',
              category: sensor.targetId
          };
      }

      const success = await updateHASensor(sensor.entity_id_suffix, state, attrs);
      if (success) updatedCount++; else failedCount++;
    }

    res.json({ success: true, updated: updatedCount, failed: failedCount });

  } catch (e) {
    console.error("Sensor Sync Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/status', (req, res) => res.json({ status: 'online' }));

// Fondamentale: Tutte le altre rotte devono servire index.html per gestire il routing client-side
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// CRITICO: Ascoltare su 0.0.0.0 è obbligatorio per Docker/Home Assistant Add-ons
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SYSTEM] Server in ascolto su http://0.0.0.0:${PORT}`);
});
