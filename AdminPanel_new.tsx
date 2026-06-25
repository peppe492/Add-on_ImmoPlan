import React, { useEffect, useState } from 'react';
import { db } from '../services/dbService';
import { SystemLog, CustomSensor, Property, FinancialData } from '../types';

/* =====================================================================================
   ImmoPlan · Admin — "Bento Terminal" design
   Reskin completo del pannello Amministrazione. Logica identica all'originale
   (props, db, handler). Stile via CSS scoped sotto `.ipb` (indipendente da Tailwind).
   Tema scuro col tema "Neon" (appData.theme === 'NEON'), chiaro altrimenti.
   ===================================================================================== */

interface AdminPanelProps {
  logs: SystemLog[];
  onResetDatabase: () => void;
  appData: FinancialData;
  onUpdateAppData: (data: FinancialData) => void;
}

const ic = (p: string, s = 18, sw = 1.8) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: p }} />
);
const PATH = {
  palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.92 0 1.63-.77 1.63-1.7 0-.43-.16-.83-.41-1.16-.08-.1-.17-.22-.17-.36 0-.28.22-.53.5-.53H16c4.42 0 8-3.58 8-8 0-4.97-4.03-9-9-9z"/>',
  key: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  chip: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>',
  warn: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.7 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.6 6.6A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><line x1="2" y1="2" x2="22" y2="22"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  sync: '<path d="M21 12a9 9 0 0 1-9 9c-2.5 0-4.8-1-6.4-2.7M3 12a9 9 0 0 1 9-9c2.5 0 4.8 1 6.4 2.7"/><polyline points="21 3 21 9 15 9"/><polyline points="3 21 3 15 9 15"/>',
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ logs, onResetDatabase, appData, onUpdateAppData }) => {
  const [dbStats, setDbStats] = useState<Record<string, number> | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [customSensors, setCustomSensors] = useState<CustomSensor[]>([]);
  const [isSyncingSensors, setIsSyncingSensors] = useState(false);
  const [newSensor, setNewSensor] = useState<Partial<CustomSensor>>({ type: 'PROPERTY_CASHFLOW', name: '', entity_id_suffix: '' });
  const [apiKeyInput, setApiKeyInput] = useState(appData.apiKey || localStorage.getItem('immoplan_api_key') || '');
  const [showKey, setShowKey] = useState(false);

  const handleSaveApiKey = () => {
    localStorage.setItem('immoplan_api_key', apiKeyInput);
    onUpdateAppData({ ...appData, apiKey: apiKeyInput });
    alert('API Key salvata con successo!');
  };

  useEffect(() => { refreshStats(); loadConfig(); }, []);

  const refreshStats = async () => {
    try { const stats = await db.getStats(); setDbStats(stats); } catch (e) { console.error('Errore recupero stats', e); }
  };
  const loadConfig = async () => {
    const data = await db.getAppData(); const props = await db.getProperties();
    setProperties(props || []);
    if (data && data.customSensors) setCustomSensors(data.customSensors);
    if (data && data.apiKey) { setApiKeyInput(data.apiKey); localStorage.setItem('immoplan_api_key', data.apiKey); }
  };
  const handleManualSync = async () => {
    if (isSyncingSensors) return;
    setIsSyncingSensors(true);
    try {
      const result = await db.triggerHASensorSync();
      if (result.success) alert('Sincronizzazione completata! Controlla i log per i dettagli.');
      else alert('Errore sincronizzazione: ' + result.message);
    } catch (e: any) { alert('Errore critico: ' + e.message); } finally { setIsSyncingSensors(false); }
  };
  const handleAddSensor = async () => {
    if (!newSensor.name || !newSensor.entity_id_suffix || (!newSensor.targetId && newSensor.type !== 'CALENDAR_EVENTS')) { alert('Compila tutti i campi!'); return; }
    const safeSuffix = newSensor.entity_id_suffix.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const sensor: CustomSensor = { id: Date.now().toString(), name: newSensor.name, entity_id_suffix: safeSuffix, type: newSensor.type as any, targetId: newSensor.targetId || 'GLOBAL' };
    const updatedList = [...customSensors, sensor];
    setCustomSensors(updatedList);
    onUpdateAppData({ ...appData, customSensors: updatedList });
    setNewSensor({ type: 'PROPERTY_CASHFLOW', name: '', entity_id_suffix: '' });
    alert("Sensore aggiunto al DB locale. Premi 'Forza Push' per crearlo su HA.");
  };
  const handleDeleteSensor = async (id: string) => {
    if (!window.confirm('Eliminare sensore?')) return;
    const updatedList = customSensors.filter(c => c.id !== id);
    setCustomSensors(updatedList);
    onUpdateAppData({ ...appData, customSensors: updatedList });
  };
  const setTheme = (theme: 'DEFAULT' | 'NEON') => onUpdateAppData({ ...appData, theme });

  const isNeon = appData.theme === 'NEON';
  const SENSOR_TYPE_LABEL: Record<string, string> = { PROPERTY_CASHFLOW: 'Cashflow Netto', PROPERTY_VALUE: 'Valore Attuale', CATEGORY_TOTAL: 'Totale Categoria', CALENDAR_EVENTS: 'Calendario (JSON)' };

  return (
    <div className={`ipb${isNeon ? '' : ' light'}`}>
      <style>{IPB_ADMIN_CSS}</style>
      <div className="body">
        <div className="hero">
          <div className="glow" />
          <div className="micro accent">Amministrazione</div>
          <h2>Amministrazione Sistema</h2>
          <p>Monitoraggio database, log di sistema e strumenti di manutenzione.</p>
        </div>

        <div className="grid3">
          {/* Tema */}
          <div className="panel pad">
            <div className="ph">{ic(PATH.palette, 16)}<h3>Personalizzazione UI</h3></div>
            <div className="themegrid">
              <button className={`themecard${appData.theme === 'DEFAULT' ? ' on' : ''}`} onClick={() => setTheme('DEFAULT')}>
                <div className="prev light-prev">Aa</div><span>Default · Chiaro</span>
              </button>
              <button className={`themecard${isNeon ? ' on' : ''}`} onClick={() => setTheme('NEON')}>
                <div className="prev dark-prev">Aa</div><span>Bento · Dark</span>
              </button>
            </div>
          </div>

          {/* API key */}
          <div className="panel pad">
            <div className="ph">{ic(PATH.key, 16)}<h3>Chiave API Gemini</h3></div>
            <p className="muted">Inserisci la tua API Key di Google AI Studio per abilitare le risposte del Chatbot AI.</p>
            <div className="keyrow">
              <input className="input" type={showKey ? 'text' : 'password'} value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} placeholder="API Key (AIzaSy...)" />
              <button className="eyebtn" type="button" onClick={() => setShowKey(!showKey)}>{ic(showKey ? PATH.eyeoff : PATH.eye, 16)}</button>
            </div>
            <button className="btn primary wide" onClick={handleSaveApiKey}>Salva API Key</button>
          </div>

          {/* DB stats */}
          <div className="panel pad">
            <div className="ph spread">{ic(PATH.db, 16)}<h3>Stato Database</h3><button className="linkbtn" onClick={refreshStats}>Aggiorna</button></div>
            <div className="statgrid">
              {dbStats ? Object.entries(dbStats).map(([key, count]) => (
                <div className="statcell" key={key}><span className="sk">{key}</span><span className="sv">{count}</span><span className="su">record</span></div>
              )) : <p className="muted center span2">Caricamento statistiche…</p>}
            </div>
          </div>
        </div>

        <div className="grid2">
          {/* Sensori HA */}
          <div className="panel pad">
            <div className="ph spread">{ic(PATH.chip, 16)}<h3>Sensori Home Assistant</h3>
              <button className={`btn ghost sm${isSyncingSensors ? ' busy' : ''}`} onClick={handleManualSync} disabled={isSyncingSensors}>{ic(PATH.sync, 13)} {isSyncingSensors ? 'Sync…' : 'Forza Push'}</button>
            </div>
            {customSensors.length > 0 && (
              <div className="senslist">
                {customSensors.map(s => (
                  <div className="sensrow" key={s.id}>
                    <div className="sinfo"><div className="sname">{s.name}</div><div className="sid">sensor.immoplan_{s.entity_id_suffix}</div></div>
                    <span className="tag">{SENSOR_TYPE_LABEL[s.type] || s.type}</span>
                    <button className="delc" onClick={() => handleDeleteSensor(s.id)}>{ic(PATH.trash, 14)}</button>
                  </div>
                ))}
              </div>
            )}
            <div className="addbox">
              <div className="adtitle">Aggiungi Sensore</div>
              <div className="adgrid">
                <div className="field span2"><label>Nome Sensore</label><input className="input" value={newSensor.name} onChange={e => setNewSensor({ ...newSensor, name: e.target.value })} placeholder="Es. Cashflow Loft" /></div>
                <div className="field span2"><label>Entity ID</label>
                  <div className="prefixed"><span className="pfx">sensor.immoplan_</span><input className="input" value={newSensor.entity_id_suffix} onChange={e => setNewSensor({ ...newSensor, entity_id_suffix: e.target.value })} placeholder="id_unico" /></div></div>
                <div className="field"><label>Tipo</label>
                  <select className="input" value={newSensor.type} onChange={e => setNewSensor({ ...newSensor, type: e.target.value as any })}>
                    <option value="PROPERTY_CASHFLOW">Cashflow Netto</option><option value="PROPERTY_VALUE">Valore Attuale</option><option value="CATEGORY_TOTAL">Totale Categoria</option><option value="CALENDAR_EVENTS">Calendario (JSON)</option>
                  </select></div>
                <div className="field"><label>Target</label>
                  <select className="input" value={newSensor.targetId || ''} onChange={e => setNewSensor({ ...newSensor, targetId: e.target.value })}>
                    <option value="">Target…</option>
                    {newSensor.type === 'CALENDAR_EVENTS' && <option value="GLOBAL">Globale</option>}
                    {newSensor.type === 'CATEGORY_TOTAL'
                      ? (<><option value="MORTGAGE">Mutui</option><option value="TAX">Tasse</option><option value="MAINTENANCE">Manutenzione</option></>)
                      : properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select></div>
              </div>
              <button className="btn primary wide" onClick={handleAddSensor}>Crea Sensore</button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="panel pad danger">
            <div className="dico">{ic(PATH.warn, 26, 2)}</div>
            <h3>Danger Zone</h3>
            <p>L'eliminazione del database è irreversibile. Tutti i dati verranno persi definitivamente.</p>
            <button className="btn danger-btn" onClick={onResetDatabase}>{ic(PATH.trash, 14)} Elimina Database</button>
          </div>
        </div>

        {/* Logs terminal */}
        <div className="panel logterm">
          <div className="logbar">
            <div className="dots"><span className="d r" /><span className="d a" /><span className="d g" /></div>
            <span className="logname">system_logs.log</span>
          </div>
          <div className="logbody">
            {logs.length === 0 ? <p className="logwait">// In attesa di log…</p> : logs.map(log => (
              <div className="logline" key={log.id}>
                <span className="lt">[{log.time}]</span>
                <span className={`lk ${log.type}`}>{log.type.toUpperCase()}:</span>
                <span className="lm">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const IPB_ADMIN_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&display=swap');
.ipb{ --font:'Geist','DM Sans',system-ui,sans-serif; --mono:'Geist Mono',ui-monospace,monospace;
  --bg:#0a0e16; --panel:#111827; --panel-2:#151d2d; --inset:#0c121e; --border:rgba(255,255,255,.07); --border-2:rgba(255,255,255,.12);
  --text:#eaeff7; --dim:#8b97ab; --faint:#58637a; --accent:#2f8fff; --accent-2:#6f63ff; --accent-soft:rgba(47,143,255,.14); --glow:rgba(47,143,255,.28);
  --pos:#2fd6a3; --neg:#fb6f86; --neg-soft:rgba(251,111,134,.14); --warn:#f5b942; --grid-line:rgba(255,255,255,.05); --r:11px; --r-sm:8px; --r-lg:16px;
  font-family:var(--font); color:var(--text); text-align:left; }
.ipb.light{ --bg:#f4f6fb; --panel:#fff; --panel-2:#fff; --inset:#f1f4f9; --border:rgba(15,23,42,.09); --border-2:rgba(15,23,42,.16);
  --text:#0c1424; --dim:#5a6679; --faint:#9aa6bb; --accent:#0a6cff; --accent-2:#5b4bff; --accent-soft:rgba(10,108,255,.10); --glow:rgba(10,108,255,.18);
  --pos:#0fa47a; --neg:#e23d63; --neg-soft:rgba(226,61,99,.10); --warn:#d98a0b; --grid-line:rgba(15,23,42,.06); }
.ipb *{ box-sizing:border-box; }
.ipb .body{ display:flex; flex-direction:column; gap:18px; max-width:1180px; margin:0 auto; }
.ipb .micro{ font-family:var(--mono); font-size:10px; font-weight:500; letter-spacing:.14em; text-transform:uppercase; color:var(--faint); }
.ipb .micro.accent{ color:var(--accent); }
.ipb .muted{ color:var(--dim); font-size:12px; margin:0 0 14px; } .ipb .center{ text-align:center; } .ipb .span2{ grid-column:span 2; }
.ipb .panel{ background:var(--panel); border:1px solid var(--border); border-radius:var(--r-lg); }
.ipb .panel.pad{ padding:22px; }
.ipb .ph{ display:flex; align-items:center; gap:10px; margin-bottom:16px; color:var(--accent); }
.ipb .ph h3{ margin:0; font-size:14px; font-weight:700; color:var(--text); }
.ipb .ph.spread{ justify-content:flex-start; } .ipb .ph.spread h3{ flex:1; }
.ipb .hero{ position:relative; overflow:hidden; background:linear-gradient(150deg,var(--panel-2),var(--panel)); border:1px solid var(--border); border-radius:var(--r-lg); padding:30px 28px; }
.ipb .hero .glow{ position:absolute; top:-60px; right:-40px; width:240px; height:240px; border-radius:50%; background:var(--accent-soft); filter:blur(50px); }
.ipb .hero h2{ margin:8px 0 6px; font-size:26px; font-weight:700; letter-spacing:-.02em; } .ipb .hero p{ margin:0; color:var(--dim); font-size:13px; }
.ipb .grid3{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:18px; }
.ipb .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:18px; align-items:stretch; }

.ipb .btn{ border:none; cursor:pointer; font-family:var(--font); font-weight:700; font-size:11px; letter-spacing:.06em; text-transform:uppercase; padding:11px 16px; border-radius:10px; display:inline-flex; align-items:center; gap:7px; }
.ipb .btn.primary{ background:var(--accent); color:#fff; box-shadow:0 8px 24px -10px var(--glow); } .ipb .btn.primary:hover{ filter:brightness(1.08); }
.ipb .btn.ghost{ background:var(--inset); color:var(--dim); border:1px solid var(--border); } .ipb .btn.ghost:hover{ color:var(--text); border-color:var(--border-2); }
.ipb .btn.ghost.busy{ opacity:.6; cursor:wait; } .ipb .btn.sm{ padding:8px 12px; font-size:10px; }
.ipb .btn.wide{ width:100%; justify-content:center; margin-top:14px; }
.ipb .btn.danger-btn{ background:var(--neg); color:#fff; }
.ipb .linkbtn{ border:none; background:transparent; color:var(--accent); font-family:var(--mono); font-size:11px; font-weight:600; cursor:pointer; }

.ipb .input{ width:100%; background:var(--inset); border:1px solid var(--border); border-radius:10px; color:var(--text); font-family:var(--font); font-size:13px; font-weight:500; padding:11px 13px; outline:none; }
.ipb .input:focus{ border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
.ipb select.input{ appearance:none; -webkit-appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238b97ab' stroke-width='2.4' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 11px center; padding-right:32px; cursor:pointer; }
.ipb .field label{ display:block; font-family:var(--mono); font-size:9px; letter-spacing:.12em; text-transform:uppercase; color:var(--faint); margin:0 0 6px 2px; }

.ipb .themegrid{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.ipb .themecard{ border:1.5px solid var(--border); background:var(--inset); border-radius:var(--r); padding:12px; cursor:pointer; display:flex; flex-direction:column; gap:9px; align-items:stretch; }
.ipb .themecard.on{ border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
.ipb .themecard span{ font-family:var(--mono); font-size:10px; letter-spacing:.04em; color:var(--dim); text-align:center; }
.ipb .prev{ height:46px; border-radius:8px; display:grid; place-items:center; font-weight:700; font-size:16px; }
.ipb .light-prev{ background:#eef2f8; color:#0c1424; } .ipb .dark-prev{ background:#0a0e16; color:#2f8fff; border:1px solid rgba(47,143,255,.4); }

.ipb .keyrow{ position:relative; display:flex; align-items:center; }
.ipb .keyrow .input{ padding-right:40px; }
.ipb .eyebtn{ position:absolute; right:8px; width:28px; height:28px; border:none; background:transparent; color:var(--faint); cursor:pointer; display:grid; place-items:center; } .ipb .eyebtn:hover{ color:var(--text); }

.ipb .statgrid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.ipb .statcell{ background:var(--inset); border:1px solid var(--border); border-radius:var(--r); padding:13px; display:flex; flex-direction:column; align-items:center; }
.ipb .statcell .sk{ font-family:var(--mono); font-size:8.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); }
.ipb .statcell .sv{ font-family:var(--mono); font-size:26px; font-weight:600; margin:6px 0 2px; }
.ipb .statcell .su{ font-size:9px; color:var(--faint); }

.ipb .senslist{ display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }
.ipb .sensrow{ display:grid; grid-template-columns:1fr auto 30px; gap:10px; align-items:center; background:var(--inset); border:1px solid var(--border); border-radius:10px; padding:10px 12px; }
.ipb .sensrow .sname{ font-size:12.5px; font-weight:600; } .ipb .sensrow .sid{ font-family:var(--mono); font-size:9.5px; color:var(--faint); margin-top:2px; }
.ipb .tag{ font-family:var(--mono); font-size:9px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; padding:4px 8px; border-radius:6px; background:var(--accent-soft); color:var(--accent); }
.ipb .delc{ width:30px; height:30px; border-radius:8px; border:none; background:transparent; color:var(--faint); cursor:pointer; display:grid; place-items:center; } .ipb .delc:hover{ color:var(--neg); background:var(--neg-soft); }
.ipb .addbox{ background:var(--inset); border:1px solid var(--border); border-radius:var(--r); padding:16px; }
.ipb .addbox .adtitle{ font-family:var(--mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); margin-bottom:12px; }
.ipb .addbox .adgrid{ display:grid; grid-template-columns:1fr 1fr; gap:11px; }
.ipb .addbox .span2{ grid-column:span 2; }
.ipb .prefixed{ display:flex; align-items:center; background:var(--bg); border:1px solid var(--border); border-radius:10px; overflow:hidden; }
.ipb .prefixed .pfx{ font-family:var(--mono); font-size:10px; color:var(--faint); padding:0 0 0 11px; white-space:nowrap; }
.ipb .prefixed .input{ border:none; background:transparent; padding-left:4px; } .ipb .prefixed .input:focus{ box-shadow:none; }

.ipb .panel.danger{ display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:6px; border-color:var(--neg-soft); background:linear-gradient(160deg, var(--neg-soft), transparent); }
.ipb .panel.danger .dico{ width:56px; height:56px; border-radius:50%; background:var(--neg-soft); color:var(--neg); display:grid; place-items:center; margin-bottom:6px; }
.ipb .panel.danger h3{ margin:0; font-size:16px; font-weight:700; color:var(--neg); }
.ipb .panel.danger p{ margin:0 0 12px; font-size:12px; color:var(--dim); max-width:340px; }

.ipb .logterm{ overflow:hidden; }
.ipb .logbar{ display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border); background:var(--inset); }
.ipb .dots{ display:flex; gap:6px; } .ipb .dots .d{ width:11px; height:11px; border-radius:50%; } .ipb .dots .r{ background:#fb6f86; } .ipb .dots .a{ background:#f5b942; } .ipb .dots .g{ background:#2fd6a3; }
.ipb .logname{ font-family:var(--mono); font-size:11px; color:var(--faint); }
.ipb .logbody{ padding:16px 18px; height:320px; overflow-y:auto; font-family:var(--mono); font-size:11px; line-height:1.9; }
.ipb .logwait{ color:var(--faint); font-style:italic; }
.ipb .logline{ display:flex; gap:10px; }
.ipb .logline .lt{ color:var(--faint); flex:none; }
.ipb .logline .lk{ font-weight:700; flex:none; } .ipb .logline .lk.error{ color:var(--neg); } .ipb .logline .lk.success{ color:var(--pos); } .ipb .logline .lk.info{ color:var(--accent); }
.ipb .logline .lm{ color:var(--dim); word-break:break-word; }

@media (max-width:1000px){ .ipb .grid3,.ipb .grid2{ grid-template-columns:1fr; } }
`;

export default AdminPanel;
