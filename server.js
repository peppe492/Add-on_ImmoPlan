
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 9301;
let DB_FILE = process.env.DB_PATH || (fs.existsSync('/data') ? '/data/immoplan_data.json' : path.join(__dirname, 'data', 'immoplan_data.json'));
app.setDbPath = (newPath) => { DB_FILE = newPath; process.env.DB_PATH = newPath; };
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
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      res.json(data);
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
  } else {
    res.json({});
  }
});

app.post('/api/sync', (req, res) => {
  try {
    ensureDirectoryExistence(DB_FILE);
    let existingData = {};
    if (fs.existsSync(DB_FILE)) {
      try {
        existingData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      } catch (err) {}
    }

    // Empty body (e.g. clearAll)
    if (!req.body || Object.keys(req.body).length === 0) {
      fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2), 'utf8');
      return res.json({ success: true });
    }

    const merged = { ...existingData, ...req.body };

    // Merge notificationLogs if present in both to prevent log loss
    if (existingData.notificationLogs && req.body.notificationLogs) {
      const logMap = new Map();
      existingData.notificationLogs.forEach(l => { if (l && l.id) logMap.set(l.id, l); });
      req.body.notificationLogs.forEach(l => { if (l && l.id) logMap.set(l.id, l); });
      merged.notificationLogs = Array.from(logMap.values())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 500);
    } else if (existingData.notificationLogs && !req.body.notificationLogs) {
      merged.notificationLogs = existingData.notificationLogs;
    }

    // Preserve systemLogs if existing and not in body
    if (existingData.systemLogs && !req.body.systemLogs) {
      merged.systemLogs = existingData.systemLogs;
    }

    fs.writeFileSync(DB_FILE, JSON.stringify(merged, null, 2), 'utf8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/log', (req, res) => {
  try {
    const log = req.body;
    const type = log.type || 'info';
    const message = log.message || '';
    const time = log.time || new Date().toLocaleTimeString();
    console.log(`[CLIENT] [${time}] [${type.toUpperCase()}] ${message}`);

    if (fs.existsSync(DB_FILE)) {
      try {
        const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!dbData.systemLogs) dbData.systemLogs = [];
        dbData.systemLogs.unshift({
          id: log.id || Date.now(),
          message,
          type,
          time
        });
        if (dbData.systemLogs.length > 100) dbData.systemLogs = dbData.systemLogs.slice(0, 100);
        fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf8');
      } catch (err) {}
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- DEFAULT NOTIFICATION SETTINGS & HELPERS ---
const DEFAULT_NOTIF_SETTINGS = {
  reminderAdvanceDays: 5,
  autoCheckEnabled: true,
  homeAssistant: {
    enabled: true,
    updateSensors: true,
    persistentNotifications: true,
    sensorEntityId: 'sensor.immoplan_affitti_stato'
  },
  telegram: {
    enabled: false,
    botToken: '',
    ownerChatId: '',
    notifyOwnerOnDue: true,
    notifyTenantOnDue: true,
    autoSendReceiptToTenant: true
  }
};

function escapeTgHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- HELPER PER INVIO A HOME ASSISTANT ---
const updateHASensor = async (entityIdSuffix, state, attributes = {}) => {
  const token = SUPERVISOR_TOKEN || process.env.SUPERVISOR_TOKEN;
  if (!token) return false;
  
  const entityId = `sensor.immoplan_${entityIdSuffix}`;
  const supervisorBase = (process.env.SUPERVISOR_URL || 'http://supervisor').replace(/\/$/, '');
  const url = `${supervisorBase}/core/api/states/${entityId}`;
  
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
        'Authorization': `Bearer ${token}`,
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

/**
 * Authentic Home Assistant Sensor Updater: sensor.immoplan_affitti_stato
 * Computes aggregate rent statuses across all leased properties.
 */
async function updateAffittiStatoSensor(dbData) {
  if (!dbData) return { success: false, error: 'Database non valido o assente' };

  const properties = dbData.properties || [];
  const tenants = dbData.tenants || [];
  const rentalRecords = dbData.rentalRecords || [];
  const settings = dbData.notificationSettings || DEFAULT_NOTIF_SETTINGS;
  const advanceDays = settings.reminderAdvanceDays !== undefined ? settings.reminderAdvanceDays : 5;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayUtc = Date.UTC(currentYear, currentMonth, now.getDate());

  const tenantMap = new Map(tenants.map(t => [t.id, t]));
  const rentedProperties = properties.filter(p => {
    const monthlyRent = Number(p.financials?.monthlyRent) || 0;
    const isRented = p.status === 'RENTED' || Boolean(p.currentTenantId) || (p.status !== 'EMPTY' && p.status !== 'MAIN_RESIDENCE');
    return monthlyRent > 0 && isRented;
  });

  let scaduti = 0;
  let inScadenza = 0;
  let saldati = 0;
  const dettagli = [];

  for (const prop of rentedProperties) {
    const tenant = prop.currentTenantId ? tenantMap.get(prop.currentTenantId) : undefined;
    let dueDay = 5;
    if (tenant && typeof tenant.rentDueDay === 'number' && tenant.rentDueDay >= 1 && tenant.rentDueDay <= 31) {
      dueDay = Math.floor(tenant.rentDueDay);
    } else if (prop.financials && typeof prop.financials.rentDueDay === 'number' && prop.financials.rentDueDay >= 1 && prop.financials.rentDueDay <= 31) {
      dueDay = Math.floor(prop.financials.rentDueDay);
    } else if (typeof prop.rentDueDay === 'number' && prop.rentDueDay >= 1 && prop.rentDueDay <= 31) {
      dueDay = Math.floor(prop.rentDueDay);
    }

    const maxDays = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
    const clampedDay = Math.min(dueDay, maxDays);
    const dueDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    const dueUtc = Date.UTC(currentYear, currentMonth, clampedDay);
    const daysUntilDue = Math.round((dueUtc - todayUtc) / (1000 * 60 * 60 * 24));

    const monthlyRent = Number(prop.financials?.monthlyRent) || 0;
    const matching = rentalRecords.filter(r =>
      r.propertyId === prop.id &&
      Number(r.year) === currentYear &&
      Number(r.month) === currentMonth
    );
    const totalPaid = matching.reduce((sum, r) => sum + (Number(r.income) || 0), 0);
    const isPaid = totalPaid >= monthlyRent;

    let itemStatus;
    if (isPaid) {
      itemStatus = 'SALDATO';
      saldati++;
    } else if (daysUntilDue < 0) {
      itemStatus = 'SCADUTO';
      scaduti++;
    } else if (daysUntilDue <= advanceDays) {
      itemStatus = 'IN_SCADENZA';
      inScadenza++;
    } else {
      itemStatus = 'PROGRAMMATO';
    }

    dettagli.push({
      propertyId: prop.id,
      property: prop.name,
      propertyName: prop.name,
      tenantName: tenant?.name || 'Conduttore',
      monthlyRent,
      paidAmount: totalPaid,
      daysUntilDue,
      daysOverdue: daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0,
      dueDate: dueDateStr,
      status: itemStatus
    });
  }

  const totale_canoni = rentedProperties.length;
  const state = String(scaduti);
  const attributes = {
    friendly_name: 'Stato Canoni di Locazione',
    totale_canoni,
    scaduti,
    in_scadenza: inScadenza,
    saldati,
    dettagli,
    status_label: scaduti > 0 ? 'in_ritardo' : (inScadenza > 0 ? 'in_scadenza' : 'ok'),
    unit_of_measurement: 'canoni',
    icon: scaduti > 0 ? 'mdi:alert-circle' : 'mdi:check-circle'
  };

  const success = await updateHASensor('affitti_stato', state, attributes);
  return { success, state, attributes };
}


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

    // --- PROJECTION / FORECAST SENSORS FOR ALL PROPERTIES ---
    const props = dbData.properties || [];
    for (const prop of props) {
      const propIdSanitized = (prop.id || 'prop').toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const forecast = prop.forecastData || {};
      const proj = forecast.yearlyProjections || [];
      const y5 = proj[4] || proj[proj.length - 1] || {};
      const y10 = proj[9] || proj[proj.length - 1] || {};

      const val5a = y5.propertyValue || prop.currentValue || 0;
      const rendNet5a = y5.annualNetRent || 0;
      const eqNet5a = y5.accumulatedEquity || 0;
      const diffEtf10a = (y10.accumulatedEquity || 0) + (y10.cumulativeNetCashFlow || 0) - (y10.etfWorldBenchmarkValue || 0);

      // Push 4 standard forecast sensors per property
      await updateHASensor(`${propIdSanitized}_valore_stimato_5a`, val5a, {
        friendly_name: `${prop.name} - Valore Stimato (5 anni)`,
        unit_of_measurement: '€',
        icon: 'mdi:trending-up'
      });
      await updateHASensor(`${propIdSanitized}_rendimento_netto_proiettato`, rendNet5a, {
        friendly_name: `${prop.name} - Rendimento Netto Proiettato (5a)`,
        unit_of_measurement: '€/anno',
        icon: 'mdi:cash-fast'
      });
      await updateHASensor(`${propIdSanitized}_equita_netta`, eqNet5a, {
        friendly_name: `${prop.name} - Equità Netta (5a)`,
        unit_of_measurement: '€',
        icon: 'mdi:shield-home'
      });
      await updateHASensor(`${propIdSanitized}_diff_etf_world_10a`, diffEtf10a, {
        friendly_name: `${prop.name} - Differenziale ETF World (10a)`,
        unit_of_measurement: '€',
        icon: 'mdi:chart-line-variant'
      });

      // Fire market alert webhook if cashflow is negative
      if (y5.netCashFlow !== undefined && y5.netCashFlow < 0 && SUPERVISOR_TOKEN) {
        await fetch(`http://supervisor/core/api/events/immoplan_market_alert`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SUPERVISOR_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: prop.id,
            property_name: prop.name,
            alert_type: 'NEGATIVE_CASHFLOW',
            net_cash_flow_5y: y5.netCashFlow,
            message: `Attenzione: l'immobile ${prop.name} presenta un cashflow netto proiettato negativo (${y5.netCashFlow}€/anno).`
          })
        }).catch(() => {});
      }
    }

    // Aggiorna anche il sensore di stato canoni di locazione (sensor.immoplan_affitti_stato)
    const rentSensorRes = await updateAffittiStatoSensor(dbData);
    if (rentSensorRes?.success) updatedCount++; else failedCount++;

    res.json({ success: true, updated: updatedCount, failed: failedCount, rentSensor: rentSensorRes });

  } catch (e) {
    console.error("Sensor Sync Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Dedicated endpoint to push rent sensor state and attributes to Home Assistant
app.post('/api/ha/push_rent_sensor', async (req, res) => {
  if (!fs.existsSync(DB_FILE)) {
    return res.status(404).json({ success: false, error: "Database not found" });
  }
  try {
    const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const result = await updateAffittiStatoSensor(dbData);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- ENDPOINT PREVISIONI BATCH ---
app.post('/api/forecast/run-batch', (req, res) => {
  if (!fs.existsSync(DB_FILE)) {
    return res.status(404).json({ success: false, error: "Database non trovato" });
  }

  try {
    const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const properties = dbData.properties || [];

    properties.forEach(prop => {
      const initialVal = prop.currentValue || prop.purchasePrice || 200000;
      const purchasePrice = prop.purchasePrice || initialVal;

      let initialLoanAmount = 0;
      let monthlyMortgagePayment = 0;
      let durationYears = prop.financials?.mortgageDuration || 20;
      let mortgageRate = prop.financials?.mortgageRate || 3.5;

      if (prop.financials?.mortgageAmount && prop.financials.mortgageAmount > 0) {
        if (prop.financials.mortgageAmount > 10000) {
          initialLoanAmount = prop.financials.mortgageAmount;
          const r = (mortgageRate > 0 ? mortgageRate : 3.5) / 12 / 100;
          const n = durationYears * 12;
          monthlyMortgagePayment = initialLoanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        } else {
          monthlyMortgagePayment = prop.financials.mortgageAmount;
        }
      } else if (prop.recurringCosts) {
        const mortCost = prop.recurringCosts.find(c => c.category === 'MORTGAGE');
        if (mortCost && mortCost.amount > 0) {
          monthlyMortgagePayment = mortCost.frequency === 'MONTHLY' ? mortCost.amount : mortCost.amount / 12;
        }
      }

      if (initialLoanAmount === 0 && monthlyMortgagePayment > 0) {
        const r = (mortgageRate > 0 ? mortgageRate : 3.5) / 12 / 100;
        const n = durationYears * 12;
        initialLoanAmount = monthlyMortgagePayment * (1 - Math.pow(1 + r, -n)) / r;
      }

      const purchaseExpenses = purchasePrice * 0.08;
      const initCash = prop.financials?.initialInvestment || Math.max(10000, purchasePrice + purchaseExpenses - initialLoanAmount);

      const growth = 0.018 + 0.003;
      const rentMonth = prop.financials?.monthlyRent || (initialVal * 0.05 / 12);
      const baseGrossRent = rentMonth * 12;
      const isGreen = prop.energyClass === 'A' || prop.energyClass === 'B';
      const isRed = ['E', 'F', 'G'].includes(prop.energyClass || '');
      const energyDelta = isGreen ? 0.015 : isRed ? -0.02 : 0;
      const netRate = growth + energyDelta;

      let annualOperatingExpenses = (prop.financials?.condoFees || 0) * 12;
      if (prop.recurringCosts) {
        prop.recurringCosts.forEach(c => {
          if (c.category !== 'MORTGAGE') {
            if (c.frequency === 'MONTHLY') annualOperatingExpenses += c.amount * 12;
            else if (c.frequency === 'YEARLY' || c.frequency === 'ONE_OFF') annualOperatingExpenses += c.amount;
          }
        });
      }

      const defaultTax = prop.financials?.defaultTaxRate;
      const taxRate = defaultTax === 0 ? 0 : (defaultTax === 10 ? 0.10 : (defaultTax !== undefined ? defaultTax / 100 : 0.21));

      let cumulativeNetCashFlow = 0;
      const yearlyProjections = [];

      for (let y = 1; y <= 10; y++) {
        const pVal = Math.round(initialVal * Math.pow(1 + netRate, y));
        const grossRent = baseGrossRent * Math.pow(1.015, y - 1);
        const effectiveRent = grossRent * (1 - 2/52);
        const taxAmount = effectiveRent * taxRate;
        const netRent = Math.max(0, effectiveRent - taxAmount - annualOperatingExpenses);
        
        let remainingDebt = 0;
        if (initialLoanAmount > 0) {
          const r = (mortgageRate > 0 ? mortgageRate : 3.5) / 12 / 100;
          const n = durationYears * 12;
          const k = Math.min(y * 12, n);
          if (k < n) {
            remainingDebt = initialLoanAmount * (Math.pow(1 + r, n) - Math.pow(1 + r, k)) / (Math.pow(1 + r, n) - 1);
          }
        }

        const annualMortgagePayment = monthlyMortgagePayment > 0 ? monthlyMortgagePayment * 12 : 0;
        const ncf = Math.round(netRent - annualMortgagePayment);
        cumulativeNetCashFlow += ncf;
        const eq = Math.max(0, pVal - Math.round(remainingDebt));
        const etfVal = Math.round(initCash * Math.pow(1.07, y));

        const netProfitGain = (eq - initCash) + cumulativeNetCashFlow;
        const roe = Number(((netProfitGain / (initCash * y)) * 100).toFixed(2));

        yearlyProjections.push({
          year: y,
          propertyValue: pVal,
          optimisticValue: Math.round(pVal * Math.pow(1.02, y)),
          pessimisticValue: Math.round(pVal * Math.pow(0.98, y)),
          annualGrossRent: Math.round(grossRent),
          annualNetRent: Math.round(netRent),
          netCashFlow: ncf,
          cumulativeNetCashFlow: Math.round(cumulativeNetCashFlow),
          remainingMortgageDebt: Math.round(remainingDebt),
          accumulatedEquity: eq,
          etfWorldBenchmarkValue: etfVal,
          roePercent: roe,
          energyPenaltyBonus: Math.round(initialVal * energyDelta)
        });
      }

      prop.forecastData = {
        config: {
          cpiInflationTarget: 2.0,
          vacancyWeeksPerYear: 2,
          bceInterestRateScenario: 'STABLE',
          energyClassUpgrade: false,
          currentEnergyClass: prop.energyClass || 'D',
          enableEtfBenchmark: true,
          etfAnnualReturn: 7.0,
          taxRegime: prop.financials?.taxRegime || (prop.financials?.defaultTaxRate === 0 ? 'ESENTE_0' : (prop.financials?.defaultTaxRate === 10 ? 'CEDOLARE_10' : (prop.financials?.defaultTaxRate === 21 ? 'CEDOLARE_21' : 'IRPEF_ORDINARIA'))),
          ownerMarginalTaxRate: prop.financials?.marginalTaxRate || 35
        },
        yearlyProjections,
        metrics: {
          zone: prop.address || prop.name,
          avgPriceSqm: Math.round(initialVal / (prop.surfaceSqm || 70)),
          avgRentSqmMonth: Math.round(rentMonth / (prop.surfaceSqm || 70) * 10) / 10,
          annualGrowthTrend: 0.018,
          demographicTrend: 0.003,
          lastUpdated: new Date().toISOString().split('T')[0]
        },
        lastSimulatedAt: new Date().toISOString()
      };
    });

    if (!dbData.systemLogs) dbData.systemLogs = [];
    dbData.systemLogs.unshift({
      id: Date.now(),
      message: `[OpenData / Batch] Ricalcolate previsioni a 10 anni con parametri ISTAT e OMI per ${properties.length} immobili`,
      type: 'success',
      time: new Date().toLocaleTimeString()
    });
    if (dbData.systemLogs.length > 100) dbData.systemLogs = dbData.systemLogs.slice(0, 100);

    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf8');
    res.json({ success: true, count: properties.length, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error("Batch Forecast Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- WEBHOOK SCADENZE ---
app.post('/api/deadlines/:id/complete', (req, res) => {
  try {
    ensureDirectoryExistence(DB_FILE);
    let dbData = {};
    if (fs.existsSync(DB_FILE)) {
      try {
        dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      } catch (e) {}
    }
    
    if (!Array.isArray(dbData.deadlines)) dbData.deadlines = [];
    
    let found = false;
    dbData.deadlines = dbData.deadlines.map(d => {
      if (d.id === req.params.id) {
        d.isCompleted = true;
        d.completedAt = new Date().toISOString();
        found = true;
      }
      return d;
    });
    
    if (!found) {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      dbData.deadlines.push({
        id: req.params.id,
        title: req.body?.title || 'Scadenza automatica',
        date: req.body?.date || todayStr,
        isCompleted: true,
        completedAt: now.toISOString(),
        notes: req.body?.notes || 'Completata via webhook/azione'
      });
      found = true;
    }
    
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf8');
    console.log(`[SYSTEM] Scadenza ${req.params.id} segnata come completata via webhook.`);
    res.json({ success: true, message: "Scadenza aggiornata." });
  } catch (e) {
    console.error("Errore webhook scadenze:", e);
    res.status(500).json({ error: e.message });
  }
});

let lastNotificationDate = '';

// Controllo Scadenze ogni ora
setInterval(async () => {
  try {
    if (!fs.existsSync(DB_FILE)) return;
    
    const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const settings = dbData.notificationSettings || DEFAULT_NOTIF_SETTINGS;
    if (settings.autoCheckEnabled === false) return;
    if (!SUPERVISOR_TOKEN && !(settings.telegram?.enabled && settings.telegram?.botToken)) return;

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (lastNotificationDate === today) return; // Già notificato oggi

    let deadlines = dbData.deadlines || [];
    const properties = dbData.properties || [];
    const rentalRecords = dbData.rentalRecords || [];
    const tenants = dbData.tenants || [];
    
    // Genera scadenze automatiche
    const autoDeadlines = [];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const config = dbData.config;
    
    if (config) {
      const p = config.purchaseCosts;
      if (p) {
        const createPurch = (key, detail, title) => {
          if (detail && detail.paymentDate && !detail.isPaid) {
            autoDeadlines.push({ id: `auto_purch_${key}`, title: `Acquisto: ${title}`, date: detail.paymentDate.split('T')[0], amount: detail.amount, isCompleted: detail.isPaid });
          }
        };
        createPurch('deposit', p.deposit, 'Caparra');
        createPurch('balance', p.balance, 'Saldo al Rogito');
        createPurch('notary', p.notary, 'Notaio');
        createPurch('agency', p.agency, 'Agenzia');
        createPurch('taxes', p.taxes, 'Imposte');
        createPurch('other', p.other, 'Altre Spese');
      }
      if (config.renovationCosts) {
        const r = config.renovationCosts;
        if (r.design && r.design.paymentDate && !r.design.isPaid) autoDeadlines.push({ id: `auto_renov_design`, title: `Ristrutturazione: Progettazione`, date: r.design.paymentDate.split('T')[0], amount: r.design.amount, isCompleted: false });
        if (r.worksBreakdown) r.worksBreakdown.forEach(w => { if (w.paymentDate && !w.isPaid) autoDeadlines.push({ id: `auto_renov_w_${w.id}`, title: `Lavori: ${w.description}`, date: w.paymentDate.split('T')[0], amount: w.amount, isCompleted: false }); });
        if (r.materialsBreakdown) r.materialsBreakdown.forEach(m => { if (m.paymentDate && !m.isPaid) autoDeadlines.push({ id: `auto_renov_m_${m.id}`, title: `Materiali: ${m.description}`, date: m.paymentDate.split('T')[0], amount: m.amount, isCompleted: false }); });
      }
    }

    properties.forEach(prop => {
      // 1. Canone di Affitto Mensile
      const monthlyRent = Number(prop.financials?.monthlyRent) || 0;
      const isRentedStatus = prop.status === 'RENTED' || Boolean(prop.currentTenantId);
      const shouldTrackRent = monthlyRent > 0 && (isRentedStatus || (prop.status !== 'EMPTY' && prop.status !== 'MAIN_RESIDENCE'));

      if (shouldTrackRent) {
        const tenant = tenants.find(t => t.id === prop.currentTenantId);
        let dueDay = 5;
        if (tenant && typeof tenant.rentDueDay === 'number' && tenant.rentDueDay >= 1 && tenant.rentDueDay <= 31) {
          dueDay = Math.floor(tenant.rentDueDay);
        } else if (prop.financials && typeof prop.financials.rentDueDay === 'number' && prop.financials.rentDueDay >= 1 && prop.financials.rentDueDay <= 31) {
          dueDay = Math.floor(prop.financials.rentDueDay);
        } else if (typeof prop.rentDueDay === 'number' && prop.rentDueDay >= 1 && prop.rentDueDay <= 31) {
          dueDay = Math.floor(prop.rentDueDay);
        }

        for (let m = -1; m <= 3; m++) {
          const anchorDate = new Date(currentYear, currentMonth + m, 1);
          const targetYear = anchorDate.getFullYear();
          const targetMonth = anchorDate.getMonth();
          const maxDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
          const actualDay = Math.min(dueDay, maxDay);
          const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
          const deadlineId = `auto_rent_${prop.id}_${dateStr}`;

          // Cross-reference rentalRecords to eliminate false alarms
          const matching = rentalRecords.filter(r =>
            r.propertyId === prop.id &&
            Number(r.year) === targetYear &&
            Number(r.month) === targetMonth
          );
          const totalPaid = matching.reduce((sum, r) => sum + (Number(r.income) || 0), 0);
          const isPaid = totalPaid >= monthlyRent;

          autoDeadlines.push({
            id: deadlineId,
            title: `${prop.name}: Affitto`,
            date: dateStr,
            type: 'RENT',
            amount: monthlyRent,
            isCompleted: isPaid,
            propertyId: prop.id,
            tenantId: prop.currentTenantId || undefined,
            notes: isPaid 
              ? 'Canone saldato e registrato' 
              : (totalPaid > 0 ? `Pagamento parziale (${totalPaid}€/${monthlyRent}€)` : 'In attesa di pagamento')
          });
        }
      }
      
      // 2. Spese Condominiali
      if (prop.financials && prop.financials.condoFees && prop.financials.condoFees > 0) {
        for (let m = -1; m <= 3; m++) {
          const anchorDate = new Date(currentYear, currentMonth + m, 1);
          const targetYear = anchorDate.getFullYear();
          const targetMonth = anchorDate.getMonth();
          const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-10`;
          const deadlineId = `auto_condo_${prop.id}_${dateStr}`;

          const matching = rentalRecords.filter(r =>
            r.propertyId === prop.id &&
            Number(r.year) === targetYear &&
            Number(r.month) === targetMonth
          );
          const condoPaid = matching.some(r => (Number(r.condo) || 0) >= (Number(prop.financials.condoFees) || 0));

          autoDeadlines.push({
            id: deadlineId,
            title: `${prop.name}: Spese Condominiali`,
            date: dateStr,
            type: 'MAINTENANCE',
            amount: prop.financials.condoFees,
            isCompleted: condoPaid,
            propertyId: prop.id
          });
        }
      }

      // 3. Rata Mutuo
      if (prop.financials && prop.financials.mortgageAmount && prop.financials.mortgageAmount > 0) {
        const hasExplicit = prop.recurringCosts?.some(c => c.category === 'MORTGAGE');
        if (!hasExplicit) {
          const monthly = prop.financials.mortgageAmount;
          let day = 1;
          if (prop.financials.mortgageStartDate) {
             const parts = prop.financials.mortgageStartDate.split('-');
             if (parts.length >= 3) day = parseInt(parts[2], 10) || 1;
          }
          for (let m = -1; m <= 3; m++) {
            const anchorDate = new Date(currentYear, currentMonth + m, 1);
            const targetYear = anchorDate.getFullYear();
            const targetMonth = anchorDate.getMonth();
            const maxDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
            const actualDay = Math.min(day, maxDay);
            const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
            const deadlineId = `auto_mortg_${prop.id}_${dateStr}`;

            const matching = rentalRecords.filter(r =>
              r.propertyId === prop.id &&
              Number(r.year) === targetYear &&
              Number(r.month) === targetMonth
            );
            const mortgagePaid = matching.some(r => (Number(r.mortgage) || 0) >= (Number(monthly) || 0));

            autoDeadlines.push({
              id: deadlineId,
              title: `${prop.name}: Rata Mutuo`,
              date: dateStr,
              type: 'MORTGAGE',
              amount: monthly,
              isCompleted: mortgagePaid,
              propertyId: prop.id
            });
          }
        }
      }

      // 4. Recurring Costs
      if (prop.recurringCosts) {
        prop.recurringCosts.forEach(cost => {
          if (!cost.amount || cost.amount <= 0) return;
          let day = 1;
          if (cost.date) {
            const parts = cost.date.split('-');
            if (parts.length >= 3) day = parseInt(parts[2], 10) || 1;
            else if (parts.length === 2) day = parseInt(parts[1], 10) || 1;
            else {
              const dm = cost.date.match(/\b([1-9]|[12]\d|3[01])\b/);
              if (dm) day = parseInt(dm[1], 10) || 1;
            }
          }
          if (cost.frequency === 'MONTHLY') {
            for (let m = -1; m <= 3; m++) {
              const anchorDate = new Date(currentYear, currentMonth + m, 1);
              const targetYear = anchorDate.getFullYear();
              const targetMonth = anchorDate.getMonth();
              const maxDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
              const actualDay = Math.min(day, maxDay);
              const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
              autoDeadlines.push({
                id: `auto_cost_${prop.id}_${cost.id}_${dateStr}`,
                title: `${prop.name}: ${cost.name}`,
                date: dateStr,
                amount: cost.amount,
                isCompleted: false,
                propertyId: prop.id
              });
            }
          } else if (cost.frequency === 'YEARLY' && cost.date) {
             const parts = cost.date.split('-');
             let monthIndex = 0, dayIndex = 1;
             if (parts.length >= 2) {
                 monthIndex = parseInt(parts[parts.length-2], 10) - 1;
                 dayIndex = parseInt(parts[parts.length-1], 10);
             }
             [currentYear, currentYear + 1].forEach(y => {
                 const maxDay = new Date(Date.UTC(y, monthIndex + 1, 0)).getUTCDate();
                 const actualDay = Math.min(dayIndex, maxDay);
                 const dateStr = `${y}-${String(monthIndex + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
                 autoDeadlines.push({
                    id: `auto_cost_${prop.id}_${cost.id}_${dateStr}`,
                    title: `${prop.name}: ${cost.name}`,
                    date: dateStr,
                    amount: cost.amount,
                    isCompleted: false,
                    propertyId: prop.id
                  });
             });
          } else if (cost.frequency === 'ONE_OFF') {
            const dateVal = cost.date ? cost.date.split('T')[0] : today;
            autoDeadlines.push({
              id: `auto_cost_${prop.id}_${cost.id}_${dateVal}`,
              title: `${prop.name}: ${cost.name}`,
              date: dateVal,
              amount: cost.amount,
              isCompleted: false,
              propertyId: prop.id
            });
          }
        });
      }
    });

    // Unisci scadenze manuali e automatiche, propagando lo stato isCompleted
    const manualMap = new Map(deadlines.map(d => [d.id, d]));
    autoDeadlines.forEach(auto => {
      if (!manualMap.has(auto.id)) {
        deadlines.push(auto);
      } else {
        const existing = manualMap.get(auto.id);
        if (auto.id.startsWith('auto_rent_') || auto.id.startsWith('auto_condo_') || auto.id.startsWith('auto_mortg_')) {
          if (auto.isCompleted && !existing.isCompleted) {
            existing.isCompleted = true;
            existing.notes = auto.notes || existing.notes;
          }
        }
      }
    });
    
    const reminderAdvanceDays = settings.reminderAdvanceDays !== undefined ? settings.reminderAdvanceDays : 5;
    const advanceLimitDate = new Date(now.getTime() + reminderAdvanceDays * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const pending = deadlines.filter(d => {
      if (d.isCompleted) return false;

      const isRent = d.type === 'RENT' || (d.id && d.id.startsWith('auto_rent_'));
      if (isRent) {
        if (d.date > advanceLimitDate) return false;
      } else {
        if (d.date > today) return false;
      }

      // Controllo difensivo per canoni di affitto
      if (isRent) {
        const parts = (d.date || '').split('-');
        if (parts.length >= 2) {
          const dYear = parseInt(parts[0], 10);
          const dMonth = parseInt(parts[1], 10) - 1;
          const totalPaid = rentalRecords
            .filter(r => r.propertyId === d.propertyId && Number(r.year) === dYear && Number(r.month) === dMonth)
            .reduce((sum, r) => sum + (Number(r.income) || 0), 0);
          const expectedAmount = Number(d.amount) || 0;
          if (expectedAmount > 0 ? totalPaid >= expectedAmount : totalPaid > 0) {
            d.isCompleted = true;
            return false;
          }
        }
      }
      return true;
    });

    // Dismiss persistent notifications for paid rents
    properties.forEach(prop => {
      const matching = rentalRecords.filter(r =>
        r.propertyId === prop.id &&
        Number(r.year) === currentYear &&
        Number(r.month) === currentMonth
      );
      const totalPaid = matching.reduce((sum, r) => sum + (Number(r.income) || 0), 0);
      const monthlyRent = Number(prop.financials?.monthlyRent) || 0;
      if (monthlyRent > 0 && totalPaid >= monthlyRent && SUPERVISOR_TOKEN) {
        fetch(`http://supervisor/core/api/services/persistent_notification/dismiss`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SUPERVISOR_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: `immoplan_reminder_${prop.id}` })
        }).catch(() => {});
      }
    });

    // Telegram reminders in background cron loop
    if (settings.telegram?.enabled && settings.telegram?.botToken) {
      const rentDeadlines = pending.filter(d => d.type === 'RENT' || (d.id && d.id.startsWith('auto_rent_')));
      for (const d of rentDeadlines) {
        const prop = properties.find(p => p.id === d.propertyId);
        const tenant = tenants.find(t => t.id === (d.tenantId || prop?.currentTenantId));
        const propName = escapeTgHtml(prop ? prop.name : 'Immobile');
        const tenantName = escapeTgHtml(tenant ? tenant.name : 'Conduttore');
        const rentAmount = Number(d.amount) || (prop?.financials?.monthlyRent || 0);

        const isOverdue = d.date < today;
        const statusHeader = isOverdue ? '⚠️ <b>ImmoPlan · Canone Scaduto</b>' : '🔔 <b>ImmoPlan · Promemoria Canone</b>';
        const msgText = isOverdue
          ? `Gentile ${tenantName}, il canone di locazione di <b>€ ${rentAmount.toFixed(2)}</b> per l'immobile <b>${propName}</b> risultava in scadenza il <b>${d.date}</b> ed è attualmente in ritardo.`
          : `Gentile ${tenantName}, ti ricordiamo la scadenza del canone di locazione di <b>€ ${rentAmount.toFixed(2)}</b> per l'immobile <b>${propName}</b> prevista per il <b>${d.date}</b>.`;

        if (settings.telegram.notifyTenantOnDue && tenant?.telegramChatId) {
          await sendTelegramText(settings.telegram.botToken, tenant.telegramChatId, `${statusHeader}\n\n${msgText}`);
        }
        if (settings.telegram.notifyOwnerOnDue && settings.telegram.ownerChatId) {
          const ownerMsg = `Promemoria per ${propName} (${tenantName}): € ${rentAmount.toFixed(2)} (Scadenza: ${d.date}, Stato: ${isOverdue ? 'SCADUTO' : 'IN SCADENZA'})`;
          await sendTelegramText(settings.telegram.botToken, settings.telegram.ownerChatId, `${statusHeader}\n\n${ownerMsg}`);
        }
      }
    }

    if (pending.length > 0) {
      console.log(`[SYSTEM] Trovate ${pending.length} scadenze pendenti. Invio eventi ad HA.`);
      
      if (SUPERVISOR_TOKEN && settings.homeAssistant?.persistentNotifications !== false) {
        // 1. Notifica persistente nella UI di Home Assistant
        let message = "Hai delle scadenze in sospeso:\n";
        pending.forEach(d => { message += `- **${d.title}** (Scadenza: ${d.date}) - €${d.amount || 0}\n`; });
        
        await fetch(`http://supervisor/core/api/services/persistent_notification/create`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SUPERVISOR_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: "🚨 ImmoPlan: Scadenze", message, notification_id: "immoplan_deadlines" })
        }).catch(() => {});
      }

      if (SUPERVISOR_TOKEN) {
        // 2. Lancia un evento custom su HA per ogni scadenza (utile per Automazioni e notifiche push)
        for (const d of pending) {
          await fetch(`http://supervisor/core/api/events/immoplan_deadline_due`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${SUPERVISOR_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: d.id, title: d.title, date: d.date, type: d.type, amount: d.amount || 0 })
          }).catch(() => {});
        }
      }
      
      lastNotificationDate = today;
    } else {
      if (SUPERVISOR_TOKEN) {
        // Chiudi eventuale notifica persistente se tutto è pagato
        await fetch(`http://supervisor/core/api/services/persistent_notification/dismiss`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SUPERVISOR_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: "immoplan_deadlines" })
        }).catch(() => {});
      }
    }

    // Aggiorna sempre il sensore Home Assistant sensor.immoplan_affitti_stato
    await updateAffittiStatoSensor(dbData);
  } catch (e) {
    console.error('[CRON] Errore controllo scadenze:', e);
  }
}, 60 * 60 * 1000);

// ========================================================
// NOTIFICHE & AUTOMAZIONI AFFITTO (TELEGRAM & HOME ASSISTANT)
// ========================================================

async function sendTelegramText(botToken, chatId, text) {
  if (!botToken || !chatId) {
    console.error(`[TELEGRAM DEBUG] Errore: Token o Chat ID mancante. ChatId: ${chatId}`);
    return { success: false, error: 'Token o Chat ID mancante' };
  }
  try {
    console.log(`[TELEGRAM DEBUG] Invio messaggio a Chat ID: ${chatId}`);
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      console.error(`[TELEGRAM DEBUG] Errore API Telegram (Testo): HTTP ${res.status} - Risposta:`, data);
      return { success: false, error: data.description || `HTTP ${res.status}` };
    }
    console.log(`[TELEGRAM DEBUG] Messaggio inviato con successo, message_id: ${data.result?.message_id}`);
    return { success: true, messageId: data.result?.message_id };
  } catch (err) {
    console.error(`[TELEGRAM DEBUG] Eccezione di rete o parsing:`, err);
    return { success: false, error: err.message };
  }
}

async function sendTelegramDoc(botToken, chatId, pdfBuffer, filename, caption = '') {
  if (!botToken || !chatId || !pdfBuffer) {
    console.error(`[TELEGRAM DEBUG] Errore: Parametri documento mancanti. ChatId: ${chatId}`);
    return { success: false, error: 'Parametri documento mancanti' };
  }
  try {
    console.log(`[TELEGRAM DEBUG] Preparazione invio PDF a Chat ID: ${chatId} (${filename})`);
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('document', blob, filename || 'quietanza.pdf');

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      console.error(`[TELEGRAM DEBUG] Errore API Telegram (Documento): HTTP ${res.status} - Risposta:`, data);
      return { success: false, error: data.description || `HTTP ${res.status}` };
    }
    console.log(`[TELEGRAM DEBUG] PDF inviato con successo, document_id: ${data.result?.document?.file_id}`);
    return { success: true, documentId: data.result?.document?.file_id };
  } catch (err) {
    console.error(`[TELEGRAM DEBUG] Eccezione di rete o parsing (Documento):`, err);
    return { success: false, error: err.message };
  }
}

function escapePdf(str) {
  if (!str) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdfBuffer(receipt) {
  const width = 595.28;
  const height = 841.89;
  const stampClause = receipt.taxRegime === 'CEDOLARE_SECCA'
    ? "Operazione soggetta a cedolare secca ex art. 3 D.Lgs. 23/2011. Imposta di bollo non dovuta."
    : (receipt.totalAmount > 77.47
        ? "Imposta di bollo di Euro 2,00 assolta sull'originale ai sensi dell'art. 13 DPR 642/1972."
        : "Esente da imposta di bollo ex art. 13 DPR 642/1972 (non sup. 77,47 Euro).");

  const streamLines = [
    '0.2 0.3 0.5 RG', '0.95 0.97 1.0 rg', '40 760 515 50 re', 'B',
    'BT', '/F2 20 Tf', '55 778 Td', `(${escapePdf(`QUIETANZA DI PAGAMENTO - RICEVUTA N. ${receipt.formattedNumber}`)}) Tj`, 'ET',
    'BT', '/F1 10 Tf', '55 765 Td', `(${escapePdf(`Data di emissione: ${(receipt.issueDate || '').split('T')[0]}`)}) Tj`, 'ET',
    '0.8 0.8 0.8 RG', '40 640 515 105 re', 'S',
    'BT', '/F2 12 Tf', '55 725 Td', `(${escapePdf('DATI DEL LOCATORE (PROPRIETARIO)')}) Tj`,
    '/F1 10 Tf', '0 -16 Td', `(${escapePdf(`Nome / Ragione Sociale: ${receipt.landlordName || 'Locatore'}`)}) Tj`,
    '0 -14 Td', `(${escapePdf(`Codice Fiscale: ${receipt.landlordTaxCode || '-'}`)}) Tj`,
    '0 -14 Td', `(${escapePdf(`Indirizzo: ${receipt.landlordAddress || '-'}`)}) Tj`, 'ET',
    '40 520 515 105 re', 'S',
    'BT', '/F2 12 Tf', '55 605 Td', `(${escapePdf('DATI DEL CONDUTTORE (INQUILINO)')}) Tj`,
    '/F1 10 Tf', '0 -16 Td', `(${escapePdf(`Nome / Ragione Sociale: ${receipt.tenantName || 'Conduttore'}`)}) Tj`,
    '0 -14 Td', `(${escapePdf(`Codice Fiscale: ${receipt.tenantTaxCode || '-'}`)}) Tj`, 'ET',
    '40 400 515 105 re', 'S',
    'BT', '/F2 12 Tf', '55 485 Td', '(DETTAGLI IMMOBILE E COMPETENZA) Tj',
    '/F1 10 Tf', '0 -16 Td', `(${escapePdf(`Immobile: ${receipt.propertyName || '-'}`)}) Tj`,
    '0 -14 Td', `(${escapePdf(`Ubicazione: ${receipt.propertyAddress || '-'}`)}) Tj`,
    '0 -14 Td', `(${escapePdf(`Periodo di competenza: ${receipt.competencePeriod || '-'}`)}) Tj`, 'ET',
    '0.15 0.45 0.7 rg', '40 350 515 30 re', 'f',
    'BT', '/F2 11 Tf', '1 1 1 rg', '55 360 Td', '(VOCE CONTABILE) Tj', '400 0 Td', '(IMPORTO) Tj', 'ET',
    '0 0 0 rg', '40 315 515 35 re', 'S',
    'BT', '/F1 10 Tf', '55 328 Td', '(Canone di locazione concordato/pattuito) Tj', '400 0 Td', `(${escapePdf(`Euro ${(receipt.rentAmount || 0).toFixed(2)}`)}) Tj`, 'ET',
    '40 280 515 35 re', 'S',
    'BT', '/F1 10 Tf', '55 293 Td', '(Oneri accessori e spese condominiali) Tj', '400 0 Td', `(${escapePdf(`Euro ${(receipt.expensesAmount || 0).toFixed(2)}`)}) Tj`, 'ET',
    '0.92 0.94 0.98 rg', '40 240 515 40 re', 'f',
    '0.2 0.3 0.5 RG', '40 240 515 40 re', 'S',
    'BT', '/F2 13 Tf', '0.1 0.2 0.4 rg', '55 254 Td', '(TOTALE CORRISPOSTO E SALDATO) Tj', '380 0 Td', `(${escapePdf(`Euro ${(receipt.totalAmount || 0).toFixed(2)}`)}) Tj`, 'ET',
    '40 140 515 85 re', 'S',
    'BT', '/F2 10 Tf', '0 0 0 rg', '55 205 Td', '(INFORMAZIONI FISCALI E DICHIARAZIONE DI QUIETANZA) Tj',
    '/F1 9 Tf', '0 -16 Td', `(${escapePdf(`Regime fiscale: ${receipt.taxRegime || 'CEDOLARE_SECCA'}`)}) Tj`,
    '0 -14 Td', `(${escapePdf(stampClause)}) Tj`,
    '0 -14 Td', '(Il locatore rilascia la presente quale quietanza liberatoria a saldo.) Tj', 'ET',
    'BT', '/F2 10 Tf', '380 75 Td', '(Firma del locatore per quietanza) Tj', 'ET',
    '360 60 m 530 60 l S'
  ];

  const streamContent = streamLines.join('\n');
  const streamLength = Buffer.byteLength(streamContent, 'binary');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`,
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n'
  ];

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, 'binary'));
    pdf += objects[i];
  }
  const startXref = Buffer.byteLength(pdf, 'binary');
  pdf += 'xref\n';
  pdf += `0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += 'trailer\n';
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${startXref}\n%%EOF\n`;
  return Buffer.from(pdf, 'binary');
}

app.get('/api/notifications/settings', (req, res) => {
  try {
    let dbData = {};
    if (fs.existsSync(DB_FILE)) dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    res.json({ settings: dbData.notificationSettings || DEFAULT_NOTIF_SETTINGS });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/notifications/settings', (req, res) => {
  try {
    ensureDirectoryExistence(DB_FILE);
    let dbData = {};
    if (fs.existsSync(DB_FILE)) dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    dbData.notificationSettings = { ...DEFAULT_NOTIF_SETTINGS, ...req.body };
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf8');
    res.json({ success: true, settings: dbData.notificationSettings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/notifications/test-ha', async (req, res) => {
  try {
    const token = req.body?.supervisorToken || SUPERVISOR_TOKEN;
    const supervisorUrl = req.body?.supervisorUrl || 'http://supervisor';
    if (!token) {
      return res.json({ success: false, message: 'Nessun SUPERVISOR_TOKEN trovato nell\'ambiente Add-on.' });
    }
    const resp = await fetch(`${supervisorUrl.replace(/\/$/, '')}/core/api/config`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (resp.ok) {
      const data = await resp.json();
      return res.json({ success: true, message: `Connessione a Home Assistant riuscita (v${data.version || 'unknown'})`, haVersion: data.version });
    }
    res.json({ success: false, message: `Errore Home Assistant (HTTP ${resp.status})` });
  } catch (e) {
    res.json({ success: false, message: `Supervisor non raggiungibile: ${e.message}` });
  }
});

app.post('/api/notifications/test-telegram', async (req, res) => {
  try {
    const botToken = (req.body?.botToken || '').trim();
    const chatId = req.body?.chatId;
    console.log(`[TELEGRAM DEBUG] Ricevuta richiesta di test. BotToken presente: ${!!botToken}, ChatID: ${chatId}`);
    
    if (!botToken) {
      console.error(`[TELEGRAM DEBUG] Test fallito: Bot Token mancante.`);
      return res.json({ success: false, message: 'Bot Token mancante' });
    }

    console.log(`[TELEGRAM DEBUG] Esecuzione getMe su API Telegram...`);
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      console.error(`[TELEGRAM DEBUG] Errore getMe. HTTP ${resp.status} - Risposta:`, data);
      return res.json({ success: false, message: `Errore Telegram: ${data.description || resp.status}` });
    }
    console.log(`[TELEGRAM DEBUG] getMe convalidato. Bot Username: @${data.result?.username}`);

    if (chatId) {
      console.log(`[TELEGRAM DEBUG] Chat ID fornito. Invio messaggio di test...`);
      const sendRes = await sendTelegramText(botToken, chatId, '🔔 <b>Test Connessione ImmoPlan</b>: Bot Telegram configurato e funzionante!');
      if (!sendRes.success) {
        console.error(`[TELEGRAM DEBUG] Invio messaggio di test fallito. Dettagli:`, sendRes.error);
        return res.json({ success: false, message: `Bot valido (@${data.result.username}), ma invio messaggio fallito su Chat ID ${chatId}: ${sendRes.error}` });
      }
    }

    res.json({ success: true, message: `Connessione riuscita con @${data.result.username}`, botUsername: data.result.username });
  } catch (e) {
    console.error(`[TELEGRAM DEBUG] Eccezione di rete o server durante test-telegram:`, e);
    res.json({ success: false, message: `Errore connessione Telegram: ${e.message}` });
  }
});

app.post('/api/notifications/send-reminder', async (req, res) => {
  try {
    const { propertyId, channel = 'ALL', customMessage } = req.body || {};
    if (!propertyId) return res.status(400).json({ success: false, error: 'propertyId mancante' });

    let dbData = {};
    if (fs.existsSync(DB_FILE)) dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const prop = (dbData.properties || []).find(p => p.id === propertyId);
    if (!prop) return res.status(404).json({ success: false, error: 'Immobile non trovato' });

    const tenant = (dbData.tenants || []).find(t => t.id === prop.currentTenantId);
    const settings = dbData.notificationSettings || DEFAULT_NOTIF_SETTINGS;
    const sentTo = [];

    const rentAmount = prop.financials?.monthlyRent || 0;
    const safeTenantName = escapeTgHtml(tenant?.name || 'Conduttore');
    const safePropName = escapeTgHtml(prop.name || 'Immobile');
    const safeCustomMsg = customMessage ? escapeTgHtml(customMessage) : null;
    const msgText = safeCustomMsg || `Gentile ${safeTenantName}, ti ricordiamo la scadenza del canone di locazione di <b>€ ${rentAmount.toFixed(2)}</b> per l'immobile <b>${safePropName}</b>. Ti ringraziamo per la puntualità!`;

    // 1. Telegram
    if (channel === 'ALL' || channel === 'TELEGRAM') {
      if (settings.telegram?.enabled && settings.telegram?.botToken) {
        const targetChatId = tenant?.telegramChatId || settings.telegram.ownerChatId;
        if (targetChatId) {
          const tgRes = await sendTelegramText(settings.telegram.botToken, targetChatId, `🏠 <b>ImmoPlan · Promemoria Canone</b>\n\n${msgText}`);
          if (tgRes.success) sentTo.push(`Telegram (${targetChatId})`);
        }
      }
    }

    // 2. Home Assistant
    if (channel === 'ALL' || channel === 'HOME_ASSISTANT') {
      if (SUPERVISOR_TOKEN) {
        await fetch(`http://supervisor/core/api/services/persistent_notification/create`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SUPERVISOR_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `🔔 Promemoria Affitto: ${prop.name}`,
            message: `Canone di € ${rentAmount} in scadenza per ${tenant?.name || 'Inquilino'}.`,
            notification_id: `immoplan_reminder_${prop.id}`
          })
        }).catch(() => {});
        sentTo.push('Home Assistant (Persistent Notification)');
      }
    }

    // Logga l'evento
    if (!dbData.notificationLogs) dbData.notificationLogs = [];
    dbData.notificationLogs.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      channel: channel === 'ALL' ? 'TELEGRAM' : channel,
      type: 'REMINDER_UPCOMING',
      recipient: sentTo.join(', ') || 'Nessuno',
      propertyId: prop.id,
      propertyName: prop.name,
      tenantName: tenant?.name,
      status: sentTo.length > 0 ? 'SUCCESS' : 'FAILED',
      details: sentTo.length > 0 ? `Inviato a: ${sentTo.join(', ')}` : 'Nessun canale abilitato o configurato'
    });
    if (dbData.notificationLogs.length > 200) dbData.notificationLogs = dbData.notificationLogs.slice(0, 200);
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf8');

    res.json({ success: sentTo.length > 0, sentTo });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/notifications/send-receipt', async (req, res) => {
  try {
    const { receipt, recipientChatId } = req.body || {};
    if (!receipt) return res.status(400).json({ success: false, message: 'Dati ricevuta mancanti' });

    let dbData = {};
    if (fs.existsSync(DB_FILE)) dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const settings = dbData.notificationSettings || DEFAULT_NOTIF_SETTINGS;

    const botToken = settings.telegram?.botToken;
    const targetChat = recipientChatId || settings.telegram?.ownerChatId;
    if (!botToken || !targetChat) {
      return res.status(400).json({ success: false, message: 'Bot Token Telegram o Chat ID destinatario mancante nelle impostazioni' });
    }

    const pdfBuf = buildPdfBuffer(receipt);
    const safeNumber = escapeTgHtml(receipt.formattedNumber || 'quietanza');
    const safePropName = escapeTgHtml(receipt.propertyName || '-');
    const filename = `Ricevuta_${safeNumber.replace('/', '_')}.pdf`;
    const caption = `📄 <b>Quietanza di Pagamento N. ${safeNumber}</b>\nImmobile: <b>${safePropName}</b>\nImporto saldato: <b>€ ${(receipt.totalAmount || 0).toFixed(2)}</b>`;

    const docRes = await sendTelegramDoc(botToken, targetChat, pdfBuf, filename, caption);
    if (!docRes.success) {
      return res.status(500).json({ success: false, message: docRes.error });
    }

    // Logga
    if (!dbData.notificationLogs) dbData.notificationLogs = [];
    dbData.notificationLogs.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      channel: 'TELEGRAM',
      type: 'RECEIPT_SENT',
      recipient: String(targetChat),
      propertyId: receipt.propertyId,
      propertyName: receipt.propertyName,
      tenantName: receipt.tenantName,
      status: 'SUCCESS',
      details: `Ricevuta ${receipt.formattedNumber} inviata via Telegram`
    });
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf8');

    res.json({ success: true, message: `Ricevuta ${receipt.formattedNumber} inviata con successo su Telegram!` });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/notifications/logs', (req, res) => {
  try {
    let dbData = {};
    if (fs.existsSync(DB_FILE)) dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    res.json(dbData.notificationLogs || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/notifications/clear-logs', (req, res) => {
  try {
    let dbData = {};
    if (fs.existsSync(DB_FILE)) dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    dbData.notificationLogs = [];
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/status', (req, res) => res.json({ status: 'online' }));

// Fondamentale: Tutte le altre rotte devono servire index.html per gestire il routing client-side
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// CRITICO: Ascoltare su 0.0.0.0 è obbligatorio per Docker/Home Assistant Add-ons
let serverInstance;
if (process.env.NODE_ENV !== 'test' && require.main === module) {
  serverInstance = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SYSTEM] Server in ascolto su http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
module.exports.app = app;
module.exports.server = serverInstance;
module.exports.updateAffittiStatoSensor = updateAffittiStatoSensor;
module.exports.escapeTgHtml = escapeTgHtml;
module.exports.buildPdfBuffer = buildPdfBuffer;
module.exports.sendTelegramText = sendTelegramText;
module.exports.sendTelegramDoc = sendTelegramDoc;

