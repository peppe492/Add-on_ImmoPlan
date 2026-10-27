import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/dbService';
import { SystemLog, CustomSensor, Property, FinancialData, Scenario, NotificationSettings } from '../types';
import { fetchIstatIndexes, getMicroMarketMetrics } from '../services/openDataService';
import { notificationService, DEFAULT_NOTIFICATION_SETTINGS } from '../services/notificationService';
import { runMortgageRadarCheck, DEFAULT_MORTGAGE_RADAR_SETTINGS } from '../services/mortgageService';
import { IPB_ADMIN_CSS } from './admin/adminStyles';
import { AdminUserProfilesCard } from './admin/AdminUserProfilesCard';
import { AdminDatabaseStatusCard } from './admin/AdminDatabaseStatusCard';
import { AdminAiSettingsCard } from './admin/AdminAiSettingsCard';
import { AdminThemeSettingsCard } from './admin/AdminThemeSettingsCard';
import { AdminTelegramCard } from './admin/AdminTelegramCard';
import { AdminHaSensorsCard } from './admin/AdminHaSensorsCard';
import { AdminDangerZoneCard } from './admin/AdminDangerZoneCard';
import { AdminLogViewerCard } from './admin/AdminLogViewerCard';

/* =====================================================================================
   ImmoPlan · Admin — Bento Cyber Design (v2 Refined)
   Layout a 12 colonne Bento Grid responsivo, bilanciato e modulare.
   ===================================================================================== */

interface AdminPanelProps {
  logs: SystemLog[];
  onResetDatabase: () => void;
  appData: FinancialData;
  onUpdateAppData: (data: FinancialData) => void;
  onRefreshData?: () => Promise<void>;
  onUpdateScenarios?: (scenarios: Scenario[]) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  logs,
  onResetDatabase,
  appData,
  onUpdateAppData,
  onRefreshData,
  onUpdateScenarios
}) => {
  const [activeSection, setActiveSection] = useState<'all' | 'users' | 'config' | 'ha' | 'notifications' | 'logs'>('all');
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
  const [logFilter, setLogFilter] = useState<'ALL' | 'INFO' | 'SUCCESS' | 'ERROR' | 'OPENDATA'>('ALL');
  const [logSearch, setLogSearch] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [isTestingOpenData, setIsTestingOpenData] = useState(false);

  // Impostazioni Automazioni & Notifiche (Telegram & Home Assistant)
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);
  const [notifSuccessMsg, setNotifSuccessMsg] = useState('');
  const [isTestingHA, setIsTestingHA] = useState(false);
  const [haTestFeedback, setHaTestFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingTg, setIsTestingTg] = useState(false);
  const [tgTestFeedback, setTgTestFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [showTgToken, setShowTgToken] = useState(false);
  const [isRunningRadarTest, setIsRunningRadarTest] = useState(false);
  const [radarTestFeedback, setRadarTestFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const terminalBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshStats();
    loadConfig();
    notificationService.getSettings().then(s => setNotifSettings(s)).catch(() => {});
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

      const { updatedScenarios } = await db.updateOwnerNamesCascade(
        o1,
        o2,
        oldO1,
        oldO2,
        updatedAppData
      );

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

  const scrollToSection = (sectionId: string, sectionKey: 'all' | 'users' | 'config' | 'ha' | 'notifications' | 'logs') => {
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

  const handleTestIstatOpenData = async () => {
    setIsTestingOpenData(true);
    setLogFilter('OPENDATA');
    db.log('[Admin] Avvio verifica manuale connessione OpenData ISTAT & OMI...', 'info');
    try {
      await fetchIstatIndexes();
      const testZone = (dbStats?.properties && dbStats.properties > 0) ? 'Roma Centro' : 'Milano Centro';
      await getMicroMarketMetrics(testZone, testZone);
      db.log('[Admin] Verifica OpenData ISTAT & OMI completata con successo.', 'success');
    } catch (e: any) {
      db.log(`[Admin] Errore verifica OpenData: ${e?.message || e}`, 'error');
    } finally {
      setIsTestingOpenData(false);
    }
  };

  const handleSaveNotifs = async () => {
    setIsSavingNotifs(true);
    setNotifSuccessMsg('');
    try {
      await notificationService.saveSettings(notifSettings);
      setNotifSuccessMsg('Impostazioni notifiche salvate con successo!');
      setTimeout(() => setNotifSuccessMsg(''), 4000);
    } catch (e: any) {
      alert('Errore salvataggio impostazioni: ' + e.message);
    } finally {
      setIsSavingNotifs(false);
    }
  };

  const handleTestHA = async () => {
    setIsTestingHA(true);
    setHaTestFeedback(null);
    try {
      const res = await notificationService.testHomeAssistant();
      setHaTestFeedback(res);
    } catch (e: any) {
      setHaTestFeedback({ success: false, message: e.message });
    } finally {
      setIsTestingHA(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!notifSettings.telegram.botToken.trim()) {
      alert('Inserisci il Bot Token Telegram prima di testare!');
      return;
    }
    setIsTestingTg(true);
    setTgTestFeedback(null);
    try {
      const res = await notificationService.testTelegram(
        notifSettings.telegram.botToken,
        notifSettings.telegram.ownerChatId
      );
      setTgTestFeedback(res);
    } catch (e: any) {
      setTgTestFeedback({ success: false, message: e.message });
    } finally {
      setIsTestingTg(false);
    }
  };

  const handleRunAdminMortgageRadar = async (sendTg: boolean) => {
    setIsRunningRadarTest(true);
    setRadarTestFeedback(null);
    try {
      await notificationService.saveSettings(notifSettings);
      const radarCfg = notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS;
      const report = await runMortgageRadarCheck({
        properties,
        sendTelegram: sendTg,
        forceSend: sendTg,
        botToken: notifSettings.telegram.botToken,
        recipientChatId: radarCfg.recipientChatId || notifSettings.telegram.ownerChatId,
        settings: radarCfg
      });
      if (sendTg) {
        if (report.telegramSent) {
          setRadarTestFeedback({
            success: true,
            message: `Report Telegram inviato! ${report.advantageousCount} mutui con surroga vantaggiosa (risparmio max € ${report.totalPotentialAnnualSavings.toFixed(0)}/anno).`
          });
        } else {
          setRadarTestFeedback({
            success: false,
            message: report.telegramError || 'Controlla la configurazione Bot Token e Chat ID Telegram.'
          });
        }
      } else {
        setRadarTestFeedback({
          success: true,
          message: `Analisi completata: ${report.propertiesAnalyzedCount} mutui attivi, ${report.advantageousCount} opportunità di surroga trovate (risparmio potenziale € ${report.totalPotentialMonthlySavings.toFixed(2)}/mese).`
        });
      }
      db.log(`[Admin] Radar Tassi Mutui eseguito: ${report.advantageousCount}/${report.propertiesAnalyzedCount} surroghe vantaggiose`, 'success');
    } catch (e: any) {
      setRadarTestFeedback({ success: false, message: e?.message || 'Errore controllo Radar Mutui' });
    } finally {
      setIsRunningRadarTest(false);
    }
  };

  const handleToggleRadarEnabled = async (newVal: boolean) => {
    const updatedRadar = {
      ...(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS),
      enabled: newVal
    };
    const updated = {
      ...notifSettings,
      mortgageRadar: updatedRadar
    };
    setNotifSettings(updated);
    try {
      await notificationService.saveSettings(updated);
      window.dispatchEvent(new CustomEvent('immoplan:radar-settings-changed', { detail: { enabled: newVal } }));
      setRadarTestFeedback({
        success: true,
        message: newVal
          ? 'Funzionalità Radar Tassi Banche abilitata e visibile nell\'app!'
          : 'Funzionalità Radar Tassi Banche disattivata e nascosta nell\'app.'
      });
      setTimeout(() => setRadarTestFeedback(null), 3500);
    } catch (e: any) {
      console.error('Errore attivazione radar:', e);
    }
  };

  const filteredLogs = logs.filter(l => {
    let matchesType = false;
    if (logFilter === 'ALL') {
      matchesType = true;
    } else if (logFilter === 'OPENDATA') {
      matchesType = l.message.includes('[OpenData') || l.message.includes('[ISTAT') || l.message.includes('[OMI');
    } else {
      matchesType = l.type.toUpperCase() === logFilter;
    }
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
                className={`ipb-pill ${activeSection === 'notifications' ? 'active' : ''}`}
                onClick={() => scrollToSection('sec-notifications', 'notifications')}
              >
                Automazioni & Notifiche
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
          {/* RIGA 1: ANAGRAFICA UTENTI & STATO DATABASE */}
          <AdminUserProfilesCard
            owner1Input={owner1Input}
            setOwner1Input={setOwner1Input}
            owner2Input={owner2Input}
            setOwner2Input={setOwner2Input}
            u1Initial={u1Initial}
            u2Initial={u2Initial}
            handleResetDefaultOwners={handleResetDefaultOwners}
            handleSaveOwners={handleSaveOwners}
            isSavingOwners={isSavingOwners}
            ownerSuccessMsg={ownerSuccessMsg}
          />

          <AdminDatabaseStatusCard
            dbStats={dbStats}
            properties={properties}
            customSensors={customSensors}
            isRefreshingStats={isRefreshingStats}
            refreshStats={refreshStats}
          />

          {/* RIGA 2: CHIAVE API GEMINI & TEMA GRAFICO */}
          <AdminAiSettingsCard
            apiKeyInput={apiKeyInput}
            setApiKeyInput={setApiKeyInput}
            showKey={showKey}
            setShowKey={setShowKey}
            apiKeySuccessMsg={apiKeySuccessMsg}
            handleSaveApiKey={handleSaveApiKey}
            handleClearApiKey={handleClearApiKey}
          />

          <AdminThemeSettingsCard
            appData={appData}
            setTheme={setTheme}
            isNeon={isNeon}
          />

          {/* RIGA 3: AUTOMAZIONI & BOT TELEGRAM */}
          <AdminTelegramCard
            notifSettings={notifSettings}
            setNotifSettings={setNotifSettings}
            isSavingNotifs={isSavingNotifs}
            notifSuccessMsg={notifSuccessMsg}
            handleSaveNotifs={handleSaveNotifs}
            showTgToken={showTgToken}
            setShowTgToken={setShowTgToken}
            tgTestFeedback={tgTestFeedback}
            isTestingTg={isTestingTg}
            handleTestTelegram={handleTestTelegram}
            isRunningRadarTest={isRunningRadarTest}
            radarTestFeedback={radarTestFeedback}
            handleRunAdminMortgageRadar={handleRunAdminMortgageRadar}
            handleToggleRadarEnabled={handleToggleRadarEnabled}
          />

          {/* RIGA 4: HOME ASSISTANT */}
          <AdminHaSensorsCard
            notifSettings={notifSettings}
            setNotifSettings={setNotifSettings}
            isSyncingSensors={isSyncingSensors}
            handleManualSync={handleManualSync}
            isTestingHA={isTestingHA}
            handleTestHA={handleTestHA}
            haTestFeedback={haTestFeedback}
            customSensors={customSensors}
            handleDeleteSensor={handleDeleteSensor}
            newSensor={newSensor}
            setNewSensor={setNewSensor}
            handleSensorTypeChange={handleSensorTypeChange}
            properties={properties}
            handleAddSensor={handleAddSensor}
          />

          {/* RIGA 5: DANGER ZONE */}
          <AdminDangerZoneCard
            confirmResetOpen={confirmResetOpen}
            setConfirmResetOpen={setConfirmResetOpen}
            onResetDatabase={onResetDatabase}
          />

          {/* RIGA 6: TERMINALE LOG DI SISTEMA */}
          <AdminLogViewerCard
            logs={logs}
            filteredLogs={filteredLogs}
            logFilter={logFilter}
            setLogFilter={setLogFilter}
            logSearch={logSearch}
            setLogSearch={setLogSearch}
            handleTestIstatOpenData={handleTestIstatOpenData}
            isTestingOpenData={isTestingOpenData}
            handleCopyLogs={handleCopyLogs}
            copyFeedback={copyFeedback}
            terminalBodyRef={terminalBodyRef}
          />
        </main>
      </div>
    </div>
  );
};
