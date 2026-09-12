
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

app.post('/api/log', (req, res) => {
  try {
    const log = req.body;
    const type = log.type || 'info';
    const message = log.message || '';
    const time = log.time || new Date().toLocaleTimeString();
    console.log(`[CLIENT] [${time}] [${type.toUpperCase()}] ${message}`);
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

    res.json({ success: true, updated: updatedCount, failed: failedCount });

  } catch (e) {
    console.error("Sensor Sync Error:", e);
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

      const taxRate = (prop.financials?.defaultTaxRate === 10) ? 0.10 : 0.21;

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
          taxRegime: prop.financials?.defaultTaxRate === 10 ? 'CEDOLARE_10' : 'CEDOLARE_21'
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
    if (!fs.existsSync(DB_FILE)) return res.status(404).json({ error: "Database not found" });
    const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    
    if (!dbData.deadlines) return res.status(404).json({ error: "No deadlines in DB" });
    
    let found = false;
    dbData.deadlines = dbData.deadlines.map(d => {
      if (d.id === req.params.id) {
        d.isCompleted = true;
        found = true;
      }
      return d;
    });
    
    if (found) {
      fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf8');
      console.log(`[SYSTEM] Scadenza ${req.params.id} segnata come completata via webhook.`);
      res.json({ success: true, message: "Scadenza aggiornata." });
    } else {
      res.status(404).json({ error: "Scadenza non trovata" });
    }
  } catch (e) {
    console.error("Errore webhook scadenze:", e);
    res.status(500).json({ error: e.message });
  }
});

let lastNotificationDate = '';

// Controllo Scadenze ogni ora
setInterval(async () => {
  try {
    if (!SUPERVISOR_TOKEN || !fs.existsSync(DB_FILE)) return;
    
    const today = new Date().toISOString().split('T')[0];
    if (lastNotificationDate === today) return; // Già notificato oggi

    const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    let deadlines = dbData.deadlines || [];
    const properties = dbData.properties || [];
    
    // Genera scadenze automatiche
    const autoDeadlines = [];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
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
      if (prop.financials && prop.financials.monthlyRent && prop.financials.monthlyRent > 0) {
        for (let m = -1; m <= 3; m++) {
          const targetDate = new Date(currentYear, currentMonth + m, 5);
          autoDeadlines.push({
            id: `auto_rent_${prop.id}_${targetDate.toISOString().split('T')[0]}`,
            title: `${prop.name}: Affitto`,
            date: targetDate.toISOString().split('T')[0],
            amount: prop.financials.monthlyRent,
            isCompleted: false,
            propertyId: prop.id
          });
        }
      }
      
      if (prop.financials && prop.financials.condoFees && prop.financials.condoFees > 0) {
        for (let m = -1; m <= 3; m++) {
          const targetDate = new Date(currentYear, currentMonth + m, 10);
          autoDeadlines.push({
            id: `auto_condo_${prop.id}_${targetDate.toISOString().split('T')[0]}`,
            title: `${prop.name}: Spese Condominiali`,
            date: targetDate.toISOString().split('T')[0],
            amount: prop.financials.condoFees,
            isCompleted: false,
            propertyId: prop.id
          });
        }
      }

      if (prop.financials && prop.financials.mortgageAmount && prop.financials.mortgageAmount > 0) {
        const hasExplicit = prop.recurringCosts?.some(c => c.category === 'MORTGAGE');
        if (!hasExplicit) {
          const monthly = prop.financials.mortgageAmount;
          let day = 1;
          if (prop.financials.mortgageStartDate) {
             const parts = prop.financials.mortgageStartDate.split('-');
             if (parts.length >= 3) day = parseInt(parts[2]);
          }
          for (let m = -1; m <= 3; m++) {
            const targetDate = new Date(currentYear, currentMonth + m, day);
            autoDeadlines.push({
              id: `auto_mortg_${prop.id}_${targetDate.toISOString().split('T')[0]}`,
              title: `${prop.name}: Rata Mutuo`,
              date: targetDate.toISOString().split('T')[0],
              amount: monthly,
              isCompleted: false,
              propertyId: prop.id
            });
          }
        }
      }

      if (prop.recurringCosts) {
        prop.recurringCosts.forEach(cost => {
          if (!cost.amount || cost.amount <= 0) return;
          let day = 1;
          if (cost.date) {
            const parts = cost.date.split('-');
            if (parts.length >= 3) day = parseInt(parts[2]) || 1;
            else if (parts.length === 2) day = parseInt(parts[1]) || 1;
            else {
              const dm = cost.date.match(/\b([1-9]|[12]\d|3[01])\b/);
              if (dm) day = parseInt(dm[1]) || 1;
            }
          }
          if (cost.frequency === 'MONTHLY') {
            for (let m = -1; m <= 3; m++) {
              const maxDay = new Date(currentYear, currentMonth + m + 1, 0).getDate();
              const actualDay = Math.min(day, maxDay);
              const targetDate = new Date(currentYear, currentMonth + m, actualDay);
              autoDeadlines.push({
                id: `auto_cost_${prop.id}_${cost.id}_${targetDate.toISOString().split('T')[0]}`,
                title: `${prop.name}: ${cost.name}`,
                date: targetDate.toISOString().split('T')[0],
                amount: cost.amount,
                isCompleted: false,
                propertyId: prop.id
              });
            }
          } else if (cost.frequency === 'YEARLY' && cost.date) {
             const parts = cost.date.split('-');
             let monthIndex = 0, dayIndex = 1;
             if (parts.length >= 2) {
                 monthIndex = parseInt(parts[parts.length-2]) - 1;
                 dayIndex = parseInt(parts[parts.length-1]);
             }
             [currentYear, currentYear + 1].forEach(y => {
                 const targetDate = new Date(y, monthIndex, dayIndex);
                 autoDeadlines.push({
                    id: `auto_cost_${prop.id}_${cost.id}_${targetDate.toISOString().split('T')[0]}`,
                    title: `${prop.name}: ${cost.name}`,
                    date: targetDate.toISOString().split('T')[0],
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

    // Unisci scadenze manuali e automatiche
    const manualMap = new Map(deadlines.map(d => [d.id, d]));
    autoDeadlines.forEach(auto => {
      if (!manualMap.has(auto.id)) deadlines.push(auto);
    });
    
    const pending = deadlines.filter(d => !d.isCompleted && d.date <= today);
    
    if (pending.length > 0) {
      console.log(`[SYSTEM] Trovate ${pending.length} scadenze pendenti. Invio eventi ad HA.`);
      
      // 1. Notifica persistente nella UI di Home Assistant
      let message = "Hai delle scadenze in sospeso:\n";
      pending.forEach(d => { message += `- **${d.title}** (Scadenza: ${d.date}) - €${d.amount || 0}\n`; });
      
      await fetch(`http://supervisor/core/api/services/persistent_notification/create`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPERVISOR_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: "🚨 ImmoPlan: Scadenze", message, notification_id: "immoplan_deadlines" })
      });

      // 2. Lancia un evento custom su HA per ogni scadenza (utile per Automazioni e notifiche push)
      for (const d of pending) {
        await fetch(`http://supervisor/core/api/events/immoplan_deadline_due`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SUPERVISOR_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: d.id, title: d.title, date: d.date, type: d.type, amount: d.amount || 0 })
        });
      }
      
      lastNotificationDate = today;
    } else {
      // Chiudi eventuale notifica persistente se tutto è pagato
      await fetch(`http://supervisor/core/api/services/persistent_notification/dismiss`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPERVISOR_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: "immoplan_deadlines" })
      }).catch(()=>{});
    }
  } catch(e) {
    console.error("Errore controllo scadenze:", e);
  }
}, 60 * 60 * 1000); // 1 ora

app.get('/api/status', (req, res) => res.json({ status: 'online' }));

// Fondamentale: Tutte le altre rotte devono servire index.html per gestire il routing client-side
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// CRITICO: Ascoltare su 0.0.0.0 è obbligatorio per Docker/Home Assistant Add-ons
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SYSTEM] Server in ascolto su http://0.0.0.0:${PORT}`);
});
