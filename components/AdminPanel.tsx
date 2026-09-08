import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/dbService';
import { SystemLog, CustomSensor, Property, FinancialData, Scenario } from '../types';

/* =====================================================================================
   ImmoPlan · Admin — Bento Cyber Design (v2 Refined)
   Layout a 12 colonne Bento Grid responsivo, bilanciato e compatto.
   Navigazione fluida, form sensori intelligente, terminale log con copia e ricerca,
   conferma sicura a 2 step per reset database e supporto completo Dark Bento & Light theme.
   ===================================================================================== */

interface AdminPanelProps {
  logs: SystemLog[];
  onResetDatabase: () => void;
  appData: FinancialData;
  onUpdateAppData: (data: FinancialData) => void;
  onRefreshData?: () => Promise<void>;
  onUpdateScenarios?: (scenarios: Scenario[]) => void;
}

const ic = (p: string, s = 18, sw = 1.8) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    dangerouslySetInnerHTML={{ __html: p }}
  />
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
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'
};

export const AdminPanel: React.FC<AdminPanelProps> = ({
  logs,
  onResetDatabase,
  appData,
  onUpdateAppData,
  onRefreshData,
  onUpdateScenarios
}) => {
  const [activeSection, setActiveSection] = useState<'all' | 'users' | 'config' | 'ha' | 'logs'>('all');
  const [dbStats, setDbStats] = useState<Record<string, number> | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [customSensors, setCustomSensors] = useState<CustomSensor[]>([]);
  const [isSyncingSensors, setIsSyncingSensors] = useState(false);
  const [newSensor, setNewSensor] = useState<Partial<CustomSensor>>({
    type: 'PROPERTY_CASHFLOW',
    name: '',
    entity_id_suffix: '',
    targetId: ''
  });
  const [apiKeyInput, setApiKeyInput] = useState(appData.apiKey || localStorage.getItem('immoplan_api_key') || '');
  const [showKey, setShowKey] = useState(false);
  const [apiKeySuccessMsg, setApiKeySuccessMsg] = useState(false);
  const [owner1Input, setOwner1Input] = useState(appData.owner1Name || 'Giuseppe');
  const [owner2Input, setOwner2Input] = useState(appData.owner2Name || 'Claudia');
  const [isSavingOwners, setIsSavingOwners] = useState(false);
  const [ownerSuccessMsg, setOwnerSuccessMsg] = useState('');
  const [logFilter, setLogFilter] = useState<'ALL' | 'INFO' | 'SUCCESS' | 'ERROR'>('ALL');
  const [logSearch, setLogSearch] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);

  const terminalBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshStats();
    loadConfig();
  }, []);

  useEffect(() => {
    if (appData.owner1Name) setOwner1Input(appData.owner1Name);
    if (appData.owner2Name) setOwner2Input(appData.owner2Name);
  }, [appData.owner1Name, appData.owner2Name]);

  const refreshStats = async () => {
    setIsRefreshingStats(true);
    try {
      const stats = await db.getStats();
      setDbStats(stats);
    } catch (e) {
      console.error('Errore recupero stats', e);
    } finally {
      setTimeout(() => setIsRefreshingStats(false), 400);
    }
  };

  const loadConfig = async () => {
    const data = await db.getAppData();
    const props = await db.getProperties();
    setProperties(props || []);
    if (data && data.customSensors) setCustomSensors(data.customSensors);
    if (data && data.apiKey) {
      setApiKeyInput(data.apiKey);
      localStorage.setItem('immoplan_api_key', data.apiKey);
    }
    if (data && data.owner1Name) setOwner1Input(data.owner1Name);
    if (data && data.owner2Name) setOwner2Input(data.owner2Name);
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('immoplan_api_key', apiKeyInput);
    onUpdateAppData({ ...appData, apiKey: apiKeyInput });
    setApiKeySuccessMsg(true);
    setTimeout(() => setApiKeySuccessMsg(false), 3500);
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('immoplan_api_key');
    setApiKeyInput('');
    onUpdateAppData({ ...appData, apiKey: '' });
  };

  const handleSaveOwners = async () => {
    const o1 = owner1Input.trim() || 'Giuseppe';
    const o2 = owner2Input.trim() || 'Claudia';
    const oldO1 = appData.owner1Name || 'Giuseppe';
    const oldO2 = appData.owner2Name || 'Claudia';

    if (o1.toLowerCase() === o2.toLowerCase()) {
      alert('I due utenti/comproprietari devono avere nomi distinti.');
      return;
    }

    setIsSavingOwners(true);
    setOwnerSuccessMsg('');

    try {
      // 1. Aggiorna portafogli in appData
      const updatedPortfolios = (appData.portfolios || []).map(p => {
        let newOwner = p.owner;
        let newName = p.name;
        if (p.owner === oldO1 || p.owner === 'Giuseppe') {
          newOwner = o1;
          newName = newName.replace(oldO1, o1).replace('Giuseppe', o1);
        } else if (p.owner === oldO2 || p.owner === 'Claudia') {
          newOwner = o2;
          newName = newName.replace(oldO2, o2).replace('Claudia', o2);
        }
        return { ...p, owner: newOwner, name: newName };
      });

      const updatedAppData: FinancialData = {
        ...appData,
        owner1Name: o1,
        owner2Name: o2,
        portfolios: updatedPortfolios,
      };

      // 2. Esegui aggiornamento atomico a cascata su IndexedDB (config + scenari + fatture)
      const { updatedScenarios } = await db.updateOwnerNamesCascade(
        o1,
        o2,
        oldO1,
        oldO2,
        updatedAppData
      );

      // 3. Propaga immediatamente lo stato all'app genitore
      onUpdateAppData(updatedAppData);
      if (onUpdateScenarios && updatedScenarios.length > 0) {
        onUpdateScenarios(updatedScenarios);
      }
      if (onRefreshData) {
        await onRefreshData();
      }

      setOwner1Input(o1);
      setOwner2Input(o2);
      setOwnerSuccessMsg(`Nomi aggiornati in tutta l'app: "${o1}" e "${o2}"`);
      setTimeout(() => setOwnerSuccessMsg(''), 4500);
      refreshStats();
    } catch (err: any) {
      alert(`Errore durante il salvataggio dei nomi: ${err?.message || err}`);
    } finally {
      setIsSavingOwners(false);
    }
  };

  const handleResetDefaultOwners = () => {
    setOwner1Input('Giuseppe');
    setOwner2Input('Claudia');
  };

  const handleManualSync = async () => {
    if (isSyncingSensors) return;
    setIsSyncingSensors(true);
    try {
      const result = await db.triggerHASensorSync();
      if (result.success) {
        alert('Sincronizzazione completata! Controlla i log per i dettagli.');
      } else {
        alert('Errore sincronizzazione: ' + result.message);
      }
    } catch (e: any) {
      alert('Errore critico: ' + e.message);
    } finally {
      setIsSyncingSensors(false);
    }
  };

  const handleSensorTypeChange = (type: CustomSensor['type']) => {
    setNewSensor(prev => ({
      ...prev,
      type,
      // Calendar events are always global
      targetId: type === 'CALENDAR_EVENTS' ? 'GLOBAL' : ''
    }));
  };

  const handleAddSensor = async () => {
    if (!newSensor.name || !newSensor.entity_id_suffix) {
      alert('Compila il nome e il suffisso per il sensore!');
      return;
    }
    if (newSensor.type !== 'CALENDAR_EVENTS' && !newSensor.targetId) {
      alert('Seleziona il target (immobile o categoria) per questo sensore!');
      return;
    }

    const safeSuffix = newSensor.entity_id_suffix.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const sensor: CustomSensor = {
      id: Date.now().toString(),
      name: newSensor.name.trim(),
      entity_id_suffix: safeSuffix,
      type: (newSensor.type || 'PROPERTY_CASHFLOW') as any,
      targetId: newSensor.targetId || 'GLOBAL'
    };

    const updatedList = [...customSensors, sensor];
    setCustomSensors(updatedList);
    onUpdateAppData({ ...appData, customSensors: updatedList });
    setNewSensor({ type: 'PROPERTY_CASHFLOW', name: '', entity_id_suffix: '', targetId: '' });
    alert("Sensore aggiunto al DB locale. Premi 'Forza Push' per registrarlo su Home Assistant.");
  };

  const handleDeleteSensor = async (id: string) => {
    if (!window.confirm('Eliminare questo sensore personalizzato?')) return;
    const updatedList = customSensors.filter(c => c.id !== id);
    setCustomSensors(updatedList);
    onUpdateAppData({ ...appData, customSensors: updatedList });
  };

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2500);
  };

  const scrollToSection = (sectionId: string, sectionKey: 'all' | 'users' | 'config' | 'ha' | 'logs') => {
    setActiveSection(sectionKey);
    const elem = document.getElementById(sectionId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      elem.classList.add('ipb-highlight-flash');
      setTimeout(() => elem.classList.remove('ipb-highlight-flash'), 1200);
    }
  };

  const setTheme = (theme: 'DEFAULT' | 'NEON') => onUpdateAppData({ ...appData, theme });

  const isNeon = appData.theme === 'NEON';
  const SENSOR_TYPE_LABEL: Record<string, string> = {
    PROPERTY_CASHFLOW: 'Cashflow Netto',
    PROPERTY_VALUE: 'Valore Attuale',
    CATEGORY_TOTAL: 'Totale Categoria',
    CALENDAR_EVENTS: 'Calendario (JSON)'
  };

  const filteredLogs = logs.filter(l => {
    const matchesType = logFilter === 'ALL' || l.type.toUpperCase() === logFilter;
    const matchesSearch = !logSearch || l.message.toLowerCase().includes(logSearch.toLowerCase());
    return matchesType && matchesSearch;
  });

  const u1Initial = owner1Input.trim() ? owner1Input.trim().charAt(0).toUpperCase() : '1';
  const u2Initial = owner2Input.trim() ? owner2Input.trim().charAt(0).toUpperCase() : '2';

  return (
    <div className={`ipb${isNeon ? '' : ' light'}`} id="ipb-top">
      <style>{IPB_ADMIN_CSS}</style>
      <div className="ipb-container">

        {/* HERO BAR CON BADGES E NAVIGAZIONE COMPATTA */}
        <header className="ipb-hero">
          <div className="ipb-hero-glow" />
          <div className="ipb-hero-content">
            <div className="ipb-hero-left">
              <div className="ipb-hero-badges">
                <span className="ipb-badge cyan">
                  SISTEMA & CONFIGURAZIONE
                </span>
                <span className="ipb-badge emerald">
                  <span className="ipb-pulse-dot" />
                  Stato Online
                </span>
                <span className="ipb-badge faint">
                  IndexedDB v5 · Storage Locale
                </span>
              </div>
              <h1 className="ipb-hero-title">
                Pannello Amministrazione
              </h1>
              <p className="ipb-hero-desc">
                Gestisci l'anagrafica degli utenti, le chiavi API, la sincronizzazione sensori Home Assistant e il database di ImmoPlan.
              </p>
            </div>

            {/* Quick Navigation Anchor Pills */}
            <div className="ipb-nav-pills">
              <button
                type="button"
                className={`ipb-pill ${activeSection === 'all' ? 'active' : ''}`}
                onClick={() => scrollToSection('ipb-top', 'all')}
              >
                Vista Completa
              </button>
              <button
                type="button"
                className={`ipb-pill ${activeSection === 'users' ? 'active' : ''}`}
                onClick={() => scrollToSection('sec-users-db', 'users')}
              >
                Anagrafica & DB
              </button>
              <button
                type="button"
                className={`ipb-pill ${activeSection === 'config' ? 'active' : ''}`}
                onClick={() => scrollToSection('sec-api-theme', 'config')}
              >
                Gemini & Aspetto
              </button>
              <button
                type="button"
                className={`ipb-pill ${activeSection === 'ha' ? 'active' : ''}`}
                onClick={() => scrollToSection('sec-ha-danger', 'ha')}
              >
                Home Assistant
              </button>
              <button
                type="button"
                className={`ipb-pill ${activeSection === 'logs' ? 'active' : ''}`}
                onClick={() => scrollToSection('sec-logs', 'logs')}
              >
                Log Terminale
              </button>
            </div>
          </div>
        </header>

        {/* 12-COLUMN BENTO GRID */}
        <main className="ipb-bento-grid">

          {/* =========================================================================
              RIGA 1: ANAGRAFICA UTENTI (Span 7) & STATO DATABASE (Span 5)
              ========================================================================= */}
          {/* CARD: ANAGRAFICA UTENTI & COMPROPRIETARI */}
          <section className="ipb-card span-7" id="sec-users-db">
            <div className="ipb-card-header">
              <div className="ipb-card-title-group">
                <div className="ipb-icon-wrap blue">
                  {ic(PATH.users, 19, 2)}
                </div>
                <div>
                  <h2 className="ipb-card-title">Anagrafica Utenti & Beneficiari</h2>
                  <p className="ipb-card-subtitle">Nomi sincronizzati a cascata in Portafogli, Schede Finanziarie e Detrazioni 730</p>
                </div>
              </div>
              <button
                type="button"
                className="ipb-btn-ghost-sm"
                onClick={handleResetDefaultOwners}
                title="Ripristina 'Giuseppe' e 'Claudia'"
              >
                {ic(PATH.refresh, 12)}
                <span>Default</span>
              </button>
            </div>

            <div className="ipb-users-grid">
              {/* UTENTE 1 */}
              <div className="ipb-user-box blue-box">
                <div className="ipb-user-box-header">
                  <span className="ipb-user-tag blue">
                    <span className="ipb-user-dot blue" />
                    Utente 1 (Principale)
                  </span>
                  <span className="ipb-initial-badge blue">
                    Iniziale: <strong>{u1Initial}</strong>
                  </span>
                </div>
                <input
                  className="ipb-input"
                  type="text"
                  value={owner1Input}
                  onChange={e => setOwner1Input(e.target.value)}
                  placeholder="Giuseppe"
                />
                <p className="ipb-user-hint">Assegnatario quote A e crediti IRPEF primari</p>
              </div>

              {/* UTENTE 2 */}
              <div className="ipb-user-box pink-box">
                <div className="ipb-user-box-header">
                  <span className="ipb-user-tag pink">
                    <span className="ipb-user-dot pink" />
                    Utente 2 (Cointestatario)
                  </span>
                  <span className="ipb-initial-badge pink">
                    Iniziale: <strong>{u2Initial}</strong>
                  </span>
                </div>
                <input
                  className="ipb-input"
                  type="text"
                  value={owner2Input}
                  onChange={e => setOwner2Input(e.target.value)}
                  placeholder="Claudia"
                />
                <p className="ipb-user-hint">Assegnatario quote B e detrazioni seconda casa</p>
              </div>
            </div>

            <div className="ipb-card-footer">
              <div className="ipb-feedback-area">
                {ownerSuccessMsg ? (
                  <span className="ipb-success-text">
                    {ic(PATH.check, 14, 2.5)}
                    <span>{ownerSuccessMsg}</span>
                  </span>
                ) : (
                  <span className="ipb-dim-note">Salvataggio atomico su Store config, scenari e fatture</span>
                )}
              </div>
              <button
                type="button"
                className="ipb-btn ipb-btn-primary"
                onClick={handleSaveOwners}
                disabled={isSavingOwners}
              >
                {ic(PATH.save, 14)}
                <span>{isSavingOwners ? 'Salvataggio in corso…' : 'Salva Nomi Utenti'}</span>
              </button>
            </div>
          </section>

          {/* CARD: STATO DATABASE COMPATTO */}
          <section className="ipb-card span-5">
            <div className="ipb-card-header">
              <div className="ipb-card-title-group">
                <div className="ipb-icon-wrap emerald">
                  {ic(PATH.db, 19, 2)}
                </div>
                <div>
                  <h2 className="ipb-card-title">Stato Database Locale</h2>
                  <p className="ipb-card-subtitle">Archivio IndexedDB & entità persistenti</p>
                </div>
              </div>
              <button
                type="button"
                className={`ipb-btn-ghost-sm emerald-ghost ${isRefreshingStats ? 'busy' : ''}`}
                onClick={refreshStats}
                title="Ricarica statistiche"
                disabled={isRefreshingStats}
              >
                {ic(PATH.sync, 12)}
                <span>{isRefreshingStats ? 'Aggiornamento…' : 'Aggiorna'}</span>
              </button>
            </div>

            {/* 4-METRIC STATS GRID */}
            <div className="ipb-stat-grid">
              <div className="ipb-stat-cell">
                <span className="ipb-stat-key">Immobili</span>
                <span className="ipb-stat-val text-white">
                  {dbStats?.properties ?? properties.length ?? 0}
                </span>
                <span className="ipb-stat-sub">unità attive</span>
              </div>

              <div className="ipb-stat-cell">
                <span className="ipb-stat-key">Scenari</span>
                <span className="ipb-stat-val text-cyan">
                  {dbStats?.scenarios ?? 0}
                </span>
                <span className="ipb-stat-sub">simulazioni</span>
              </div>

              <div className="ipb-stat-cell">
                <span className="ipb-stat-key">Fatture 730</span>
                <span className="ipb-stat-val text-emerald">
                  {dbStats?.invoices ?? 0}
                </span>
                <span className="ipb-stat-sub">detraibili</span>
              </div>

              <div className="ipb-stat-cell">
                <span className="ipb-stat-key">Sensori HA</span>
                <span className="ipb-stat-val text-amber">
                  {customSensors.length}
                </span>
                <span className="ipb-stat-sub">pubblicati</span>
              </div>
            </div>

            {/* Extended store strip */}
            <div className="ipb-sub-stats-bar">
              <span className="ipb-sub-stat-pill">
                Inquilini: <strong>{dbStats?.tenants ?? 0}</strong>
              </span>
              <span className="ipb-sub-stat-pill">
                Canoni / Spese: <strong>{dbStats?.rentalRecords ?? 0}</strong>
              </span>
              <span className="ipb-sub-stat-pill">
                Scadenze: <strong>{dbStats?.deadlines ?? 0}</strong>
              </span>
            </div>

            <div className="ipb-card-footer split-footer">
              <span className="ipb-status-pill ok">
                Integrità Store: <strong>100% OK</strong>
              </span>
              <span className="ipb-dim-note mono">
                Engine: IndexedDB v5
              </span>
            </div>
          </section>

          {/* =========================================================================
              RIGA 2: CHIAVE API GEMINI AI (Span 6) & PERSONALIZZAZIONE UI (Span 6)
              ========================================================================= */}
          {/* CARD: CHIAVE API GEMINI */}
          <section className="ipb-card span-6" id="sec-api-theme">
            <div className="ipb-card-header">
              <div className="ipb-card-title-group">
                <div className="ipb-icon-wrap amber">
                  {ic(PATH.key, 19, 2)}
                </div>
                <div>
                  <h2 className="ipb-card-title">Chiave API Gemini AI</h2>
                  <p className="ipb-card-subtitle">Abilita il consulente vocale, l'analisi delle fatture e le risposte AI</p>
                </div>
              </div>
            </div>

            <div className="ipb-key-section">
              <div className="ipb-key-input-row">
                <input
                  className="ipb-input mono"
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder="Incolla API Key (AIzaSy...)"
                />
                <button
                  type="button"
                  className="ipb-input-addon-btn"
                  onClick={() => setShowKey(!showKey)}
                  title={showKey ? 'Nascondi chiave' : 'Mostra chiave'}
                >
                  {ic(showKey ? PATH.eyeoff : PATH.eye, 16)}
                </button>
              </div>
              <div className="ipb-key-meta-row">
                <p className="ipb-field-desc">
                  Genera una chiave gratuita su{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ipb-link-accent"
                  >
                    Google AI Studio {ic(PATH.external, 11)}
                  </a>
                  . Memorizzata solo nel tuo browser.
                </p>
                {apiKeyInput && (
                  <button
                    type="button"
                    className="ipb-btn-text-danger"
                    onClick={handleClearApiKey}
                    title="Rimuovi chiave salvata"
                  >
                    Rimuovi
                  </button>
                )}
              </div>
            </div>

            <div className="ipb-card-footer end-footer">
              {apiKeySuccessMsg && (
                <span className="ipb-success-text" style={{ marginRight: 'auto' }}>
                  {ic(PATH.check, 14, 2.5)}
                  <span>Chiave API salvata con successo!</span>
                </span>
              )}
              <button
                type="button"
                className="ipb-btn ipb-btn-amber"
                onClick={handleSaveApiKey}
              >
                {ic(PATH.save, 14)}
                <span>Salva Chiave API</span>
              </button>
            </div>
          </section>

          {/* CARD: TEMA GRAFICO & PERSONALIZZAZIONE UI */}
          <section className="ipb-card span-6">
            <div className="ipb-card-header">
              <div className="ipb-card-title-group">
                <div className="ipb-icon-wrap purple">
                  {ic(PATH.palette, 19, 2)}
                </div>
                <div>
                  <h2 className="ipb-card-title">Personalizzazione Tema Grafico</h2>
                  <p className="ipb-card-subtitle">Seleziona lo stile visivo tra Cyber Bento Dark ad alto contrasto o Light</p>
                </div>
              </div>
            </div>

            <div className="ipb-theme-grid">
              <button
                type="button"
                className={`ipb-theme-card ${appData.theme === 'DEFAULT' ? 'active' : ''}`}
                onClick={() => setTheme('DEFAULT')}
              >
                <div className="ipb-theme-preview light-swatch">
                  <span>Aa</span>
                </div>
                <div className="ipb-theme-info">
                  <span className="ipb-theme-name">Default · Chiaro</span>
                  <span className="ipb-theme-desc">Stile Standard Light pulito</span>
                </div>
                {appData.theme === 'DEFAULT' && <span className="ipb-active-badge" />}
              </button>

              <button
                type="button"
                className={`ipb-theme-card ${isNeon ? 'active' : ''}`}
                onClick={() => setTheme('NEON')}
              >
                <div className="ipb-theme-preview dark-swatch">
                  <span>Aa</span>
                </div>
                <div className="ipb-theme-info">
                  <span className="ipb-theme-name">Bento · Dark</span>
                  <span className="ipb-theme-desc">Cyber Glow • Alto Contrasto</span>
                </div>
                {isNeon && <span className="ipb-active-badge" />}
              </button>
            </div>

            <div className="ipb-card-footer split-footer">
              <span className="ipb-dim-note">
                Preset attivo: <strong className="text-accent">{isNeon ? 'Cyber Bento Dark' : 'Default Chiaro'}</strong>
              </span>
              <span className="ipb-status-pill ok">Design System v2.1</span>
            </div>
          </section>

          {/* =========================================================================
              RIGA 3: SENSORI HOME ASSISTANT (Span 8) & DANGER ZONE (Span 4)
              ========================================================================= */}
          {/* CARD: SENSORI HOME ASSISTANT */}
          <section className="ipb-card span-8" id="sec-ha-danger">
            <div className="ipb-card-header">
              <div className="ipb-card-title-group">
                <div className="ipb-icon-wrap cyan">
                  {ic(PATH.chip, 19, 2)}
                </div>
                <div>
                  <h2 className="ipb-card-title">Sensori Personalizzati Home Assistant</h2>
                  <p className="ipb-card-subtitle">Pubblica entità MQTT/REST per dashboard Lovelace e automazioni domotiche</p>
                </div>
              </div>
              <button
                type="button"
                className={`ipb-btn ipb-btn-cyan ${isSyncingSensors ? 'busy' : ''}`}
                onClick={handleManualSync}
                disabled={isSyncingSensors}
              >
                {ic(PATH.sync, 13)}
                <span>{isSyncingSensors ? 'Sincronizzazione…' : 'Forza Push HA'}</span>
              </button>
            </div>

            {/* LISTA SENSORI ATTIVI */}
            <div className="ipb-sensors-container">
              {customSensors.length === 0 ? (
                <div className="ipb-empty-sensors">
                  <p>Nessun sensore personalizzato configurato. Utilizza il modulo qui sotto per crearne uno e integrarlo in Home Assistant.</p>
                </div>
              ) : (
                <div className="ipb-sensors-list">
                  {customSensors.map(s => (
                    <div className="ipb-sensor-item" key={s.id}>
                      <div className="ipb-sensor-left">
                        <span className="ipb-sensor-live-dot" />
                        <div>
                          <div className="ipb-sensor-name">{s.name}</div>
                          <div className="ipb-sensor-id mono">sensor.immoplan_{s.entity_id_suffix}</div>
                        </div>
                      </div>
                      <div className="ipb-sensor-right">
                        <span className="ipb-sensor-target-tag">
                          {s.targetId === 'GLOBAL' ? 'GLOBALE' : s.targetId}
                        </span>
                        <span className="ipb-sensor-tag">
                          {SENSOR_TYPE_LABEL[s.type] || s.type}
                        </span>
                        <button
                          type="button"
                          className="ipb-btn-trash"
                          onClick={() => handleDeleteSensor(s.id)}
                          title="Elimina sensore"
                        >
                          {ic(PATH.trash, 14)}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FORM ORGANIZZATO A GRID PER AGGIUNTA SENSORE */}
            <div className="ipb-add-sensor-box">
              <div className="ipb-add-title">Aggiungi Nuovo Sensore Home Assistant</div>
              <div className="ipb-add-grid">
                <div className="ipb-field">
                  <label>Nome Sensore</label>
                  <input
                    className="ipb-input"
                    value={newSensor.name || ''}
                    onChange={e => setNewSensor({ ...newSensor, name: e.target.value })}
                    placeholder="Es. Cashflow Navigli"
                  />
                </div>

                <div className="ipb-field">
                  <label>Entity ID Suffix</label>
                  <div className="ipb-prefixed-input">
                    <span className="ipb-prefix-label mono">sensor.immoplan_</span>
                    <input
                      className="ipb-input bare"
                      value={newSensor.entity_id_suffix || ''}
                      onChange={e => setNewSensor({ ...newSensor, entity_id_suffix: e.target.value })}
                      placeholder="cashflow_loft"
                    />
                  </div>
                </div>

                <div className="ipb-field">
                  <label>Tipologia Metrica</label>
                  <select
                    className="ipb-input ipb-select"
                    value={newSensor.type || 'PROPERTY_CASHFLOW'}
                    onChange={e => handleSensorTypeChange(e.target.value as any)}
                  >
                    <option value="PROPERTY_CASHFLOW">Cashflow Netto</option>
                    <option value="PROPERTY_VALUE">Valore Attuale</option>
                    <option value="CATEGORY_TOTAL">Totale Categoria Spesa</option>
                    <option value="CALENDAR_EVENTS">Calendario & Scadenze (JSON)</option>
                  </select>
                </div>

                <div className="ipb-field">
                  <label>Target Entità</label>
                  <select
                    className="ipb-input ipb-select"
                    value={newSensor.type === 'CALENDAR_EVENTS' ? 'GLOBAL' : (newSensor.targetId || '')}
                    disabled={newSensor.type === 'CALENDAR_EVENTS'}
                    onChange={e => setNewSensor({ ...newSensor, targetId: e.target.value })}
                  >
                    {newSensor.type === 'CALENDAR_EVENTS' ? (
                      <option value="GLOBAL">Globale (Tutti gli immobili & scadenze)</option>
                    ) : newSensor.type === 'CATEGORY_TOTAL' ? (
                      <>
                        <option value="">Seleziona Categoria…</option>
                        <option value="MORTGAGE">Mutui & Finanziamenti</option>
                        <option value="TAX">Tasse (IMU, TARI, Cedolare)</option>
                        <option value="MAINTENANCE">Manutenzione Ordinaria/Straord.</option>
                      </>
                    ) : properties.length > 0 ? (
                      <>
                        <option value="">Seleziona Immobile…</option>
                        {properties.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </>
                    ) : (
                      <option value="" disabled>Nessun immobile configurato</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="ipb-add-actions">
                <span className="ipb-sensor-preview-note mono">
                  Anteprima: <strong>sensor.immoplan_{newSensor.entity_id_suffix ? newSensor.entity_id_suffix.toLowerCase().replace(/[^a-z0-9_]/g, '_') : 'nome_sensore'}</strong>
                </span>
                <button
                  type="button"
                  className="ipb-btn ipb-btn-primary"
                  onClick={handleAddSensor}
                >
                  {ic(PATH.plus, 14)}
                  <span>Registra Sensore</span>
                </button>
              </div>
            </div>
          </section>

          {/* CARD: MANUTENZIONE CRITICA & RESET (Span 4) */}
          <section className="ipb-card span-4 ipb-danger-card">
            <div className="ipb-card-header">
              <div className="ipb-card-title-group">
                <div className="ipb-icon-wrap rose">
                  {ic(PATH.warn, 19, 2)}
                </div>
                <div>
                  <h2 className="ipb-card-title text-rose">Manutenzione Critica</h2>
                  <p className="ipb-card-subtitle">Reset di fabbrica & Ripristino</p>
                </div>
              </div>
            </div>

            <div className="ipb-danger-body">
              <div className="ipb-danger-callout">
                <div className="ipb-callout-header">
                  {ic(PATH.warn, 14, 2)}
                  <strong>Attenzione: Operazione Irreversibile</strong>
                </div>
                <p className="ipb-callout-text">
                  L'eliminazione cancella l'intero database IndexedDB: immobili, spese, storico fatture 730, scenari di simulazione e configurazione locale.
                </p>
              </div>

              {confirmResetOpen && (
                <div className="ipb-confirm-drawer">
                  <div className="ipb-confirm-title">
                    {ic(PATH.shield, 15)}
                    <span>Confermi l'eliminazione definitiva del database?</span>
                  </div>
                  <div className="ipb-confirm-actions">
                    <button
                      type="button"
                      className="ipb-btn ipb-btn-ghost-sm"
                      onClick={() => setConfirmResetOpen(false)}
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      className="ipb-btn ipb-btn-danger"
                      onClick={() => {
                        setConfirmResetOpen(false);
                        onResetDatabase();
                      }}
                    >
                      {ic(PATH.trash, 13)}
                      <span>Sì, Cancella Tutto</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="ipb-card-footer">
              {!confirmResetOpen ? (
                <button
                  type="button"
                  className="ipb-btn ipb-btn-danger wide"
                  onClick={() => setConfirmResetOpen(true)}
                >
                  {ic(PATH.trash, 14)}
                  <span>Elimina Database Locale</span>
                </button>
              ) : (
                <span className="ipb-dim-note text-rose">Conferma richiesta nel riquadro superiore</span>
              )}
            </div>
          </section>

          {/* =========================================================================
              RIGA 4: TERMINALE LOG DI SISTEMA (Span 12 Full Width)
              ========================================================================= */}
          <section className="ipb-card span-12 ipb-terminal-card" id="sec-logs">
            <div className="ipb-terminal-header">
              <div className="ipb-mac-dots">
                <span className="dot red" />
                <span className="dot amber" />
                <span className="dot emerald" />
                <span className="ipb-terminal-title mono">immoplan_system.log</span>
              </div>

              <div className="ipb-terminal-controls">
                <div className="ipb-terminal-filter-pills">
                  <button
                    type="button"
                    className={`ipb-mini-pill ${logFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setLogFilter('ALL')}
                  >
                    Tutti ({logs.length})
                  </button>
                  <button
                    type="button"
                    className={`ipb-mini-pill ${logFilter === 'INFO' ? 'active' : ''}`}
                    onClick={() => setLogFilter('INFO')}
                  >
                    Info
                  </button>
                  <button
                    type="button"
                    className={`ipb-mini-pill ${logFilter === 'SUCCESS' ? 'active' : ''}`}
                    onClick={() => setLogFilter('SUCCESS')}
                  >
                    Success
                  </button>
                  <button
                    type="button"
                    className={`ipb-mini-pill ${logFilter === 'ERROR' ? 'active' : ''}`}
                    onClick={() => setLogFilter('ERROR')}
                  >
                    Error
                  </button>
                </div>

                <input
                  type="text"
                  className="ipb-terminal-search"
                  placeholder="Cerca nei log…"
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                />

                <button
                  type="button"
                  className="ipb-btn-ghost-sm"
                  onClick={handleCopyLogs}
                  title="Copia log filtrati negli appunti"
                >
                  {ic(copyFeedback ? PATH.check : PATH.copy, 12)}
                  <span>{copyFeedback ? 'Copiato!' : 'Copia'}</span>
                </button>

                <span className="ipb-event-counter mono">
                  <span className="ipb-pulse-dot mini" />
                  {filteredLogs.length} eventi
                </span>
              </div>
            </div>

            <div className="ipb-terminal-body" ref={terminalBodyRef}>
              {filteredLogs.length === 0 ? (
                <p className="ipb-log-empty mono">
                  {logs.length === 0
                    ? '// In attesa di log ed eventi di sistema…'
                    : '// Nessun log corrisponde ai filtri impostati.'}
                </p>
              ) : (
                filteredLogs.map(log => (
                  <div className="ipb-log-row" key={log.id}>
                    <span className="ipb-log-time mono">[{log.time}]</span>
                    <span className={`ipb-log-badge mono ${log.type}`}>
                      {log.type.toUpperCase()}:
                    </span>
                    <span className="ipb-log-msg mono">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
};

const IPB_ADMIN_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

/* =========================================================================
   VARIABLES & COLOR TOKENS
   ========================================================================= */
.ipb {
  --font: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --mono: 'JetBrains Mono', monospace;

  /* Cyber Bento Dark Theme (Default) */
  --bg: #090d16;
  --card-bg: rgba(15, 23, 42, 0.85);
  --card-gradient: linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.85) 100%);
  --card-border: rgba(255, 255, 255, 0.08);
  --card-border-hover: rgba(255, 255, 255, 0.16);
  --inset: rgba(11, 17, 32, 0.7);
  --inset-card: #0c121e;

  --text: #f1f5f9;
  --dim: #94a3b8;
  --faint: #64748b;

  --accent-blue: #3b82f6;
  --accent-cyan: #06b6d4;
  --accent-emerald: #10b981;
  --accent-pink: #ec4899;
  --accent-amber: #f59e0b;
  --accent-purple: #a855f7;
  --accent-rose: #f43f5e;

  --glow-cyan: rgba(6, 182, 212, 0.15);
  --glow-blue: rgba(59, 130, 246, 0.18);
  --glow-rose: rgba(244, 63, 94, 0.15);

  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 20px;

  font-family: var(--font);
  color: var(--text);
  background: var(--bg);
  min-height: 100%;
  padding-bottom: 30px;
}

/* Default Chiaro (Light Theme) */
.ipb.light {
  --bg: #f4f6fb;
  --card-bg: #ffffff;
  --card-gradient: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  --card-border: rgba(15, 23, 42, 0.08);
  --card-border-hover: rgba(15, 23, 42, 0.16);
  --inset: #f1f4f9;
  --inset-card: #f8fafc;

  --text: #0f172a;
  --dim: #475569;
  --faint: #94a3b8;

  --accent-blue: #2563eb;
  --accent-cyan: #0891b2;
  --accent-emerald: #059669;
  --accent-pink: #db2777;
  --accent-amber: #d97706;
  --accent-purple: #9333ea;
  --accent-rose: #e11d48;

  --glow-cyan: rgba(8, 145, 178, 0.10);
  --glow-blue: rgba(37, 99, 235, 0.12);
  --glow-rose: rgba(225, 29, 72, 0.08);
}

.ipb * {
  box-sizing: border-box;
}

.ipb-container {
  max-width: 1240px;
  margin: 0 auto;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* =========================================================================
   HERO BAR & HEADER
   ========================================================================= */
.ipb-hero {
  position: relative;
  overflow: hidden;
  background: var(--card-gradient);
  border: 1px solid var(--card-border);
  border-radius: var(--r-xl);
  padding: 24px 28px;
  box-shadow: 0 4px 20px -5px var(--glow-cyan);
}

.ipb-hero-glow {
  position: absolute;
  top: -80px;
  right: -50px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: var(--glow-cyan);
  filter: blur(60px);
  pointer-events: none;
}

.ipb-hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (min-width: 900px) {
  .ipb-hero-content {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.ipb-hero-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.ipb-badge {
  font-family: var(--mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: 3px 9px;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.ipb-badge.cyan {
  background: rgba(6, 182, 212, 0.12);
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.25);
}

.ipb-badge.emerald {
  background: rgba(16, 185, 129, 0.12);
  color: var(--accent-emerald);
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.ipb-badge.faint {
  background: rgba(100, 116, 139, 0.12);
  color: var(--dim);
  border: 1px solid var(--card-border);
}

.ipb-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-emerald);
  box-shadow: 0 0 8px var(--accent-emerald);
  display: inline-block;
  animation: ipb-pulse 2s infinite ease-in-out;
}

.ipb-pulse-dot.mini {
  width: 6px;
  height: 6px;
}

@keyframes ipb-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.ipb-hero-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text);
}

.ipb-hero-desc {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--dim);
  max-width: 680px;
  line-height: 1.5;
}

/* Nav Pills */
.ipb-nav-pills {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  align-self: flex-start;
}

@media (min-width: 900px) {
  .ipb-nav-pills {
    align-self: center;
  }
}

.ipb-pill {
  border: 1px solid var(--card-border);
  background: var(--inset);
  color: var(--dim);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  padding: 7px 13px;
  border-radius: var(--r-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.ipb-pill:hover {
  color: var(--text);
  border-color: var(--card-border-hover);
}

.ipb-pill.active {
  background: rgba(59, 130, 246, 0.16);
  border-color: rgba(59, 130, 246, 0.4);
  color: var(--accent-blue);
  box-shadow: 0 0 14px -3px var(--glow-blue);
}

/* Flash highlight animation for jumping to sections */
.ipb-highlight-flash {
  animation: ipb-flash 1.2s ease-out;
}

@keyframes ipb-flash {
  0% { box-shadow: 0 0 0 3px var(--accent-blue), 0 0 25px var(--glow-blue); }
  100% { box-shadow: none; }
}

/* =========================================================================
   12-COLUMN BENTO GRID
   ========================================================================= */
.ipb-bento-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 20px;
}

.ipb-card {
  background: var(--card-gradient);
  border: 1px solid var(--card-border);
  border-radius: var(--r-xl);
  padding: 22px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  backdrop-filter: blur(12px);
}

.ipb-card:hover {
  border-color: var(--card-border-hover);
}

/* Column spans */
.span-12 { grid-column: span 12; }
.span-8  { grid-column: span 8; }
.span-7  { grid-column: span 7; }
.span-6  { grid-column: span 6; }
.span-5  { grid-column: span 5; }
.span-4  { grid-column: span 4; }

@media (max-width: 1024px) {
  .span-8, .span-7, .span-6, .span-5, .span-4 {
    grid-column: span 12;
  }
}

/* Card Header */
.ipb-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--card-border);
}

.ipb-card-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ipb-card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}

.ipb-card-subtitle {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: var(--dim);
}

/* Icon Wraps */
.ipb-icon-wrap {
  width: 38px;
  height: 38px;
  border-radius: var(--r-md);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.ipb-icon-wrap.blue {
  background: rgba(59, 130, 246, 0.12);
  color: var(--accent-blue);
  border: 1px solid rgba(59, 130, 246, 0.25);
}

.ipb-icon-wrap.emerald {
  background: rgba(16, 185, 129, 0.12);
  color: var(--accent-emerald);
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.ipb-icon-wrap.amber {
  background: rgba(245, 158, 11, 0.12);
  color: var(--accent-amber);
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.ipb-icon-wrap.purple {
  background: rgba(168, 85, 247, 0.12);
  color: var(--accent-purple);
  border: 1px solid rgba(168, 85, 247, 0.25);
}

.ipb-icon-wrap.cyan {
  background: rgba(6, 182, 212, 0.12);
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.25);
}

.ipb-icon-wrap.rose {
  background: rgba(244, 63, 94, 0.12);
  color: var(--accent-rose);
  border: 1px solid rgba(244, 63, 94, 0.25);
}

/* Card Footer */
.ipb-card-footer {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--card-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ipb-card-footer.split-footer {
  justify-content: space-between;
}

.ipb-card-footer.end-footer {
  justify-content: flex-end;
}

/* =========================================================================
   FORM CONTROLS & INPUTS
   ========================================================================= */
.ipb-input {
  width: 100%;
  background: var(--inset);
  border: 1px solid var(--card-border);
  border-radius: var(--r-md);
  color: var(--text);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  padding: 9px 12px;
  outline: none;
  transition: all 0.2s ease;
}

.ipb-input:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.ipb-input:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.ipb-input.mono {
  font-family: var(--mono);
}

.ipb-input.bare {
  border: none;
  background: transparent;
  padding-left: 4px;
  box-shadow: none !important;
}

.ipb-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
  cursor: pointer;
}

.ipb-prefixed-input {
  display: flex;
  align-items: center;
  background: var(--inset);
  border: 1px solid var(--card-border);
  border-radius: var(--r-md);
  overflow: hidden;
  transition: border-color 0.2s;
}

.ipb-prefixed-input:focus-within {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.ipb-prefix-label {
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--faint);
  padding: 0 0 0 10px;
  white-space: nowrap;
}

.ipb-field label {
  display: block;
  font-family: var(--mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--dim);
  margin-bottom: 6px;
}

.ipb-field-desc {
  font-size: 11.5px;
  color: var(--dim);
  margin: 8px 0 0;
  line-height: 1.4;
}

.ipb-link-accent {
  color: var(--accent-amber);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.ipb-link-accent:hover {
  text-decoration: underline;
}

.ipb-key-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.ipb-btn-text-danger {
  border: none;
  background: transparent;
  color: var(--accent-rose);
  font-size: 11px;
  font-family: var(--mono);
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.2s;
}

.ipb-btn-text-danger:hover {
  opacity: 0.8;
  text-decoration: underline;
}

/* =========================================================================
   BUTTONS
   ========================================================================= */
.ipb-btn {
  border: none;
  cursor: pointer;
  font-family: var(--font);
  font-weight: 700;
  font-size: 11.5px;
  letter-spacing: 0.03em;
  padding: 9px 15px;
  border-radius: var(--r-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.ipb-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ipb-btn.wide {
  width: 100%;
}

.ipb-btn-primary {
  background: linear-gradient(135deg, var(--accent-blue) 0%, #4f46e5 100%);
  color: #ffffff;
  box-shadow: 0 4px 14px -2px var(--glow-blue);
}

.ipb-btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 6px 18px -2px var(--glow-blue);
}

.ipb-btn-amber {
  background: rgba(245, 158, 11, 0.15);
  color: var(--accent-amber);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.ipb-btn-amber:hover {
  background: rgba(245, 158, 11, 0.25);
}

.ipb-btn-cyan {
  background: rgba(6, 182, 212, 0.15);
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.3);
}

.ipb-btn-cyan:hover:not(:disabled) {
  background: rgba(6, 182, 212, 0.25);
}

.ipb-btn-cyan.busy {
  cursor: wait;
}

.ipb-btn-danger {
  background: linear-gradient(135deg, var(--accent-rose) 0%, #be123c 100%);
  color: #ffffff;
  box-shadow: 0 4px 14px -2px var(--glow-rose);
}

.ipb-btn-danger:hover {
  filter: brightness(1.1);
}

.ipb-btn-ghost-sm {
  border: 1px solid var(--card-border);
  background: var(--inset);
  color: var(--accent-blue);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: var(--r-sm);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  transition: all 0.2s;
}

.ipb-btn-ghost-sm:hover:not(:disabled) {
  border-color: var(--accent-blue);
  background: rgba(59, 130, 246, 0.1);
}

.ipb-btn-ghost-sm.busy {
  cursor: wait;
  opacity: 0.6;
}

.ipb-btn-ghost-sm.emerald-ghost {
  color: var(--accent-emerald);
}

.ipb-btn-ghost-sm.emerald-ghost:hover:not(:disabled) {
  border-color: var(--accent-emerald);
  background: rgba(16, 185, 129, 0.1);
}

.ipb-btn-trash {
  width: 30px;
  height: 30px;
  border-radius: var(--r-sm);
  border: none;
  background: transparent;
  color: var(--faint);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.2s;
}

.ipb-btn-trash:hover {
  color: var(--accent-rose);
  background: rgba(244, 63, 94, 0.12);
}

/* =========================================================================
   ROW 1: USERS & DATABASE
   ========================================================================= */
.ipb-users-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin: 4px 0;
}

@media (max-width: 640px) {
  .ipb-users-grid {
    grid-template-columns: 1fr;
  }
}

.ipb-user-box {
  background: var(--inset);
  border-radius: var(--r-md);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.2s;
}

.ipb-user-box.blue-box {
  border: 1px solid rgba(59, 130, 246, 0.22);
}

.ipb-user-box.blue-box:focus-within {
  border-color: var(--accent-blue);
}

.ipb-user-box.pink-box {
  border: 1px solid rgba(236, 72, 153, 0.22);
}

.ipb-user-box.pink-box:focus-within {
  border-color: var(--accent-pink);
}

.ipb-user-box-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ipb-user-tag {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ipb-user-tag.blue { color: var(--accent-blue); }
.ipb-user-tag.pink { color: var(--accent-pink); }

.ipb-user-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.ipb-user-dot.blue { background: var(--accent-blue); box-shadow: 0 0 6px var(--accent-blue); }
.ipb-user-dot.pink { background: var(--accent-pink); box-shadow: 0 0 6px var(--accent-pink); }

.ipb-initial-badge {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--dim);
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 7px;
  border-radius: 6px;
}

.ipb-initial-badge strong {
  color: var(--text);
}

.ipb-user-hint {
  margin: 0;
  font-size: 10.5px;
  color: var(--faint);
  line-height: 1.3;
}

.ipb-feedback-area {
  min-height: 20px;
  display: flex;
  align-items: center;
}

.ipb-success-text {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--accent-emerald);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.ipb-dim-note {
  font-size: 11px;
  color: var(--faint);
}

.ipb-dim-note.mono {
  font-family: var(--mono);
}

.ipb-status-pill {
  font-family: var(--mono);
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
}

.ipb-status-pill.ok {
  background: rgba(16, 185, 129, 0.12);
  color: var(--accent-emerald);
  border: 1px solid rgba(16, 185, 129, 0.25);
}

/* Stat Grid */
.ipb-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 4px 0 8px;
}

@media (max-width: 640px) {
  .ipb-stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.ipb-stat-cell {
  background: var(--inset);
  border: 1px solid var(--card-border);
  border-radius: var(--r-md);
  padding: 12px 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ipb-stat-key {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--dim);
}

.ipb-stat-val {
  font-family: var(--mono);
  font-size: 22px;
  font-weight: 700;
  margin: 3px 0;
}

.ipb-stat-val.text-white { color: var(--text); }
.ipb-stat-val.text-cyan { color: var(--accent-cyan); }
.ipb-stat-val.text-emerald { color: var(--accent-emerald); }
.ipb-stat-val.text-amber { color: var(--accent-amber); }

.ipb-stat-sub {
  font-size: 9.5px;
  color: var(--faint);
}

.ipb-sub-stats-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
  padding: 6px 10px;
  background: var(--inset);
  border: 1px solid var(--card-border);
  border-radius: var(--r-sm);
  margin-bottom: 4px;
}

.ipb-sub-stat-pill {
  font-size: 10.5px;
  color: var(--dim);
  font-family: var(--mono);
}

.ipb-sub-stat-pill strong {
  color: var(--text);
}

/* =========================================================================
   ROW 2: GEMINI API & THEME
   ========================================================================= */
.ipb-key-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ipb-key-input-row {
  position: relative;
  display: flex;
  align-items: center;
}

.ipb-key-input-row .ipb-input {
  padding-right: 38px;
}

.ipb-input-addon-btn {
  position: absolute;
  right: 6px;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--faint);
  display: grid;
  place-items: center;
  cursor: pointer;
  border-radius: var(--r-sm);
  transition: color 0.2s;
}

.ipb-input-addon-btn:hover {
  color: var(--text);
}

.ipb-theme-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ipb-theme-card {
  border: 1px solid var(--card-border);
  background: var(--inset);
  border-radius: var(--r-md);
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  text-align: left;
  position: relative;
  transition: all 0.2s ease;
}

.ipb-theme-card:hover {
  border-color: var(--card-border-hover);
}

.ipb-theme-card.active {
  border-color: var(--accent-blue);
  background: rgba(59, 130, 246, 0.08);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.ipb-theme-preview {
  width: 40px;
  height: 40px;
  border-radius: var(--r-sm);
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 15px;
  flex-shrink: 0;
}

.ipb-theme-preview.light-swatch {
  background: #f1f5f9;
  color: #0f172a;
  border: 1px solid #cbd5e1;
}

.ipb-theme-preview.dark-swatch {
  background: #090d16;
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.4);
  box-shadow: 0 0 10px -2px var(--glow-cyan);
}

.ipb-theme-info {
  display: flex;
  flex-direction: column;
}

.ipb-theme-name {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text);
}

.ipb-theme-desc {
  font-size: 10px;
  color: var(--dim);
  margin-top: 1px;
}

.ipb-active-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-blue);
  box-shadow: 0 0 8px var(--accent-blue);
}

/* =========================================================================
   ROW 3: SENSORS & DANGER ZONE
   ========================================================================= */
.ipb-sensors-container {
  margin-bottom: 16px;
}

.ipb-empty-sensors {
  background: var(--inset);
  border: 1px dashed var(--card-border);
  border-radius: var(--r-md);
  padding: 24px;
  text-align: center;
  color: var(--dim);
  font-size: 12px;
}

.ipb-sensors-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding-right: 4px;
}

.ipb-sensor-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--inset);
  border: 1px solid var(--card-border);
  border-radius: var(--r-md);
  padding: 9px 12px;
  transition: border-color 0.2s;
}

.ipb-sensor-item:hover {
  border-color: var(--card-border-hover);
}

.ipb-sensor-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ipb-sensor-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-cyan);
  box-shadow: 0 0 6px var(--accent-cyan);
  flex-shrink: 0;
}

.ipb-sensor-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
}

.ipb-sensor-id {
  font-size: 10px;
  color: var(--faint);
  margin-top: 1px;
}

.ipb-sensor-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ipb-sensor-target-tag {
  font-family: var(--mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.12);
  color: var(--dim);
  border: 1px solid var(--card-border);
}

.ipb-sensor-tag {
  font-family: var(--mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(6, 182, 212, 0.12);
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.25);
}

/* Add sensor form grid */
.ipb-add-sensor-box {
  background: var(--inset);
  border: 1px solid var(--card-border);
  border-radius: var(--r-md);
  padding: 14px;
}

.ipb-add-title {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--dim);
  margin-bottom: 10px;
}

.ipb-add-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

@media (max-width: 820px) {
  .ipb-add-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .ipb-add-grid {
    grid-template-columns: 1fr;
  }
}

.ipb-add-actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.ipb-sensor-preview-note {
  font-size: 10.5px;
  color: var(--faint);
}

.ipb-sensor-preview-note strong {
  color: var(--accent-cyan);
}

/* Danger Zone */
.ipb-danger-card {
  border-color: rgba(244, 63, 94, 0.22);
  background: linear-gradient(180deg, rgba(244, 63, 94, 0.08) 0%, rgba(15, 23, 42, 0.9) 100%);
}

.ipb-danger-body {
  margin: 4px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ipb-danger-callout {
  background: rgba(244, 63, 94, 0.1);
  border: 1px solid rgba(244, 63, 94, 0.25);
  border-radius: var(--r-md);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ipb-callout-header {
  font-size: 11.5px;
  color: var(--accent-rose);
  display: flex;
  align-items: center;
  gap: 7px;
}

.ipb-callout-text {
  margin: 0;
  font-size: 11.5px;
  color: var(--dim);
  line-height: 1.45;
}

.ipb-confirm-drawer {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid var(--accent-rose);
  border-radius: var(--r-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: ipb-fade-in 0.2s ease-out;
}

@keyframes ipb-fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.ipb-confirm-title {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--accent-rose);
  display: flex;
  align-items: center;
  gap: 6px;
}

.ipb-confirm-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

/* =========================================================================
   ROW 4: TERMINAL LOGS
   ========================================================================= */
.ipb-terminal-card {
  padding: 0;
  overflow: hidden;
  border-color: var(--card-border);
}

.ipb-terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 16px;
  background: var(--inset-card);
  border-bottom: 1px solid var(--card-border);
}

.ipb-mac-dots {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ipb-mac-dots .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.ipb-mac-dots .dot.red     { background: #ef4444; }
.ipb-mac-dots .dot.amber   { background: #f59e0b; }
.ipb-mac-dots .dot.emerald { background: #10b981; }

.ipb-terminal-title {
  font-size: 11px;
  color: var(--dim);
  margin-left: 6px;
}

.ipb-terminal-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.ipb-terminal-filter-pills {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ipb-mini-pill {
  border: 1px solid var(--card-border);
  background: var(--inset);
  color: var(--dim);
  font-family: var(--mono);
  font-size: 9.5px;
  font-weight: 600;
  padding: 3px 7px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.ipb-mini-pill:hover {
  color: var(--text);
  border-color: var(--card-border-hover);
}

.ipb-mini-pill.active {
  background: rgba(59, 130, 246, 0.15);
  color: var(--accent-blue);
  border-color: rgba(59, 130, 246, 0.35);
}

.ipb-terminal-search {
  background: var(--inset);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  color: var(--text);
  font-family: var(--mono);
  font-size: 10.5px;
  padding: 4px 8px;
  outline: none;
  width: 130px;
  transition: all 0.2s;
}

.ipb-terminal-search:focus {
  width: 170px;
  border-color: var(--accent-blue);
}

.ipb-event-counter {
  font-size: 10.5px;
  color: var(--faint);
  display: flex;
  align-items: center;
  gap: 5px;
}

.ipb-terminal-body {
  background: rgba(5, 8, 15, 0.95);
  padding: 14px 16px;
  height: 240px;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.8;
}

.ipb.light .ipb-terminal-body {
  background: #0f172a;
  color: #f1f5f9;
}

.ipb-log-empty {
  color: var(--faint);
  font-style: italic;
  margin: 0;
}

.ipb-log-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 11.5px;
}

.ipb-log-time {
  color: var(--faint);
  flex-shrink: 0;
}

.ipb-log-badge {
  font-weight: 700;
  flex-shrink: 0;
}

.ipb-log-badge.info    { color: var(--accent-cyan); }
.ipb-log-badge.success { color: var(--accent-emerald); }
.ipb-log-badge.error   { color: var(--accent-rose); }
.ipb-log-badge.warn    { color: var(--accent-amber); }

.ipb-log-msg {
  color: #cbd5e1;
  word-break: break-word;
}

.ipb-log-row:hover .ipb-log-msg {
  color: #ffffff;
}

/* Utilities */
.text-accent  { color: var(--accent-blue); }
.text-rose    { color: var(--accent-rose); }
.mono         { font-family: var(--mono); }
`;

export default AdminPanel;
