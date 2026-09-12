
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FinancialInput } from './components/FinancialInput';
import { Dashboard } from './components/Dashboard';
import { AIChatbotBubble } from './components/AIChatbotBubble';
import { RentalManager } from './components/RentalManager';
import { PropertyAssetManager } from './components/PropertyAssetManager';
import { ContactManager } from './components/ContactManager';
import { GlobalDashboard } from './components/GlobalDashboard';
import { AdminPanel } from './components/AdminPanel';
import { Sidebar } from './components/Sidebar';
import { CalendarManager } from './components/CalendarManager';
import { InvoiceTaxArchive } from './components/InvoiceTaxArchive';
import { HelpCenter } from './components/HelpCenter';
import { FinancialData, MainTab, PurchaseTab, PropertyTab, Scenario, SystemLog } from './types';
import { db } from './services/dbService';

const INITIAL_DATA: FinancialData = {
  propertyName: '',
  totalPrice: 0,
  propertyPayments: [],
  totalBudget: 0,
  theme: 'DEFAULT',
  owner1Name: 'Giuseppe',
  owner2Name: 'Claudia',
  portfolios: [
    { id: 'p1', name: 'Risparmi Utente 1', owner: 'Giuseppe', initialBalance: 0 },
    { id: 'p2', name: 'Fondo Casa Utente 2', owner: 'Claudia', initialBalance: 0 }
  ],
  loanPercentage: 80,
  purchaseCosts: {
    deposit: { amount: 0, isPaid: false, assignments: [] },
    balance: { amount: 0, isPaid: false, assignments: [] },
    notary: { amount: 0, isPaid: false, assignments: [] },
    agency: { amount: 0, isPaid: false, assignments: [] },
    taxes: { amount: 0, isPaid: false, assignments: [] },
    other: { amount: 0, isPaid: false, assignments: [] },
  },
  renovationCosts: {
    works: 0,
    worksBreakdown: [],
    materials: 0,
    materialsBreakdown: [],
    design: { amount: 0, isPaid: false, assignments: [] },
    contingency: 0,
  },
  customSensors: []
};

const sanitizeFinancialData = (raw: any, defaultOwner1 = 'Giuseppe', defaultOwner2 = 'Claudia'): FinancialData => {
  if (!raw) return raw;
  const d = { ...raw };

  // 1. Migrate liquidity fields to portfolios array if missing
  if (!d.portfolios) {
    d.portfolios = [];
    if (d.liquidityGiuseppe !== undefined) {
      d.portfolios.push({
        id: 'p1',
        name: `Risparmi ${defaultOwner1}`,
        owner: defaultOwner1,
        initialBalance: Number(d.liquidityGiuseppe) || 0
      });
      delete d.liquidityGiuseppe;
    }
    if (d.liquidityClaudia !== undefined) {
      d.portfolios.push({
        id: 'p2',
        name: `Fondo Casa ${defaultOwner2}`,
        owner: defaultOwner2,
        initialBalance: Number(d.liquidityClaudia) || 0
      });
      delete d.liquidityClaudia;
    }
  }

  // 2. Ensure purchaseCosts contains all required fields
  if (!d.purchaseCosts) {
    d.purchaseCosts = {};
  }
  const costFields = ['deposit', 'balance', 'notary', 'agency', 'taxes', 'other'];
  costFields.forEach((field: string) => {
    if (!d.purchaseCosts[field]) {
      d.purchaseCosts[field] = { amount: 0, isPaid: false, assignments: [] };
    }
  });

  // 3. Ensure renovationCosts contains all required fields/structures
  if (!d.renovationCosts) {
    d.renovationCosts = {
      works: 0,
      worksBreakdown: [],
      materials: 0,
      materialsBreakdown: [],
      design: { amount: 0, isPaid: false, assignments: [] },
      contingency: 0
    };
  } else {
    if (d.renovationCosts.worksBreakdown === undefined) d.renovationCosts.worksBreakdown = [];
    if (d.renovationCosts.materialsBreakdown === undefined) d.renovationCosts.materialsBreakdown = [];
    if (!d.renovationCosts.design) {
      d.renovationCosts.design = { amount: 0, isPaid: false, assignments: [] };
    } else if (typeof d.renovationCosts.design !== 'object') {
      d.renovationCosts.design = { amount: Number(d.renovationCosts.design) || 0, isPaid: false, assignments: [] };
    }
  }

  // 4. Ensure customSensors array exists
  if (!d.customSensors) {
    d.customSensors = [];
  }

  // 5. Ensure owner1Name and owner2Name exist with defaults
  if (!d.owner1Name || typeof d.owner1Name !== 'string' || !d.owner1Name.trim()) {
    d.owner1Name = defaultOwner1;
  }
  if (!d.owner2Name || typeof d.owner2Name !== 'string' || !d.owner2Name.trim()) {
    d.owner2Name = defaultOwner2;
  }

  return d;
};

const App: React.FC = () => {
  const [data, setData] = useState<FinancialData>(INITIAL_DATA);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<MainTab>(MainTab.DASHBOARD);
  const [activePurchaseTab, setActivePurchaseTab] = useState<PurchaseTab>(PurchaseTab.INPUT);
  const [activePropertyTab, setActivePropertyTab] = useState<PropertyTab>(PropertyTab.ASSETS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);
  const lastSyncRef = useRef<number>(0);
  // Flag: diventa true solo dopo che i dati sono stati letti dal DB.
  // Impedisce che l'useEffect di auto-save pushes INITIAL_DATA al server
  // prima che refreshUIFromDB abbia popolato lo state con i dati reali.
  const isDbInitializedRef = useRef<boolean>(false);

  const addLog = useCallback((message: string, type: 'info' | 'error' | 'success') => {
    const newLog: SystemLog = { id: Date.now() + Math.random(), message, type, time: new Date().toLocaleTimeString() };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
    db.saveLog(newLog).catch(() => { });
  }, []);

  const refreshUIFromDB = useCallback(async () => {
    const [savedData, savedScenarios, savedLogs] = await Promise.all([
      db.getAppData(),
      db.getScenarios(),
      db.getLogs()
    ]);
    const activeO1 = savedData?.owner1Name || 'Giuseppe';
    const activeO2 = savedData?.owner2Name || 'Claudia';
    if (savedData) {
      setData(sanitizeFinancialData(savedData, activeO1, activeO2));
    }
    if (savedScenarios) {
      const sanitized = savedScenarios.map((s: Scenario) => {
        return {
          ...s,
          id: String(s.id), // Enforce ID to be string to prevent strict comparison mismatch
          data: sanitizeFinancialData(s.data, activeO1, activeO2)
        };
      });
      setScenarios(sanitized);
    }
    if (savedLogs) setLogs(savedLogs);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-neon');
    root.classList.remove('dark');
    if (data.theme === 'NEON') {
      root.classList.add('theme-neon');
      root.classList.add('dark');
    }
  }, [data.theme]);

  useEffect(() => {
    db.onLog = addLog;
    const initData = async () => {
      try {
        await db.init();
        await refreshUIFromDB();
        // Segna che i dati sono stati caricati dal DB.
        // Solo da questo momento l'auto-save può inviare dati al server.
        isDbInitializedRef.current = true;
      } catch (e) {
        addLog("Errore database", 'error');
        isDbInitializedRef.current = true; // permetti il salvataggio anche in caso di errore
      } finally {
        setIsLoaded(true);
      }
    };
    initData();
  }, [addLog, refreshUIFromDB]);

  useEffect(() => {
    // Non salvare finché i dati non sono stati inizializzati dal DB.
    // Questo previene la sovrascrittura dei dati importati dal backup
    // con INITIAL_DATA durante il reload post-import.
    if (isLoaded && isDbInitializedRef.current) {
      setIsSaving(true);
      const timer = setTimeout(async () => {
        try {
          await db.saveAppData(data);
          lastSyncRef.current = Date.now();
        } finally {
          setIsSaving(false);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [data, isLoaded]);

  const handleSaveScenario = async (name: string) => {
    const newScenario: Scenario = { id: Date.now().toString(), name, date: new Date().toLocaleDateString('it-IT'), data: JSON.parse(JSON.stringify(data)) };
    await db.saveScenario(newScenario);
    setScenarios(prev => [newScenario, ...prev]);
    setActiveScenarioId(newScenario.id);
  };

  const handleLoadScenario = (id: string) => {
    const scenario = scenarios.find(s => String(s.id) === String(id));
    if (scenario) {
      setData(JSON.parse(JSON.stringify(scenario.data)));
      setActiveScenarioId(String(scenario.id));
    }
  };

  const handleDeleteScenario = async (id: string) => {
    if (window.confirm("Eliminare lo scenario?")) {
      db.blockSync(10000);
      await db.deleteScenario(String(id));
      setScenarios(prev => prev.filter(s => String(s.id) !== String(id)));
      if (activeScenarioId && String(activeScenarioId) === String(id)) setActiveScenarioId(null);
    }
  };

  const handleUpdateScenario = async (id: string, newName: string) => {
    const scenario = scenarios.find(s => String(s.id) === String(id));
    if (!scenario) return;
    const updated = { ...scenario, name: newName };
    await db.saveScenario(updated);
    setScenarios(prev => prev.map(s => String(s.id) === String(id) ? updated : s));
  };

  const handleUpdateScenarioData = async (id: string) => {
    const scenario = scenarios.find(s => String(s.id) === String(id));
    if (!scenario) return;
    const updated = { ...scenario, data: JSON.parse(JSON.stringify(data)), date: new Date().toLocaleDateString('it-IT') + " (Agg.)" };
    await db.saveScenario(updated);
    setScenarios(prev => prev.map(s => String(s.id) === String(id) ? updated : s));
  };

  const handleImportScenarios = async (newScenarios: Scenario[]) => {
    const sanitized = newScenarios.map(s => ({ ...s, id: String(s.id), data: sanitizeFinancialData(s.data) }));
    for (const s of sanitized) await db.saveScenario(s);
    setScenarios(prev => [...sanitized, ...prev]);
  };

  const handleResetAll = async () => {
    if (window.confirm("Cancellare tutto?")) {
      db.blockSync(10000);
      await db.clearAll();
      window.location.reload();
    }
  };

  const toggleTheme = () => {
    setData(prev => ({
      ...prev,
      theme: prev.theme === 'NEON' ? 'DEFAULT' : 'NEON'
    }));
  };

  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bold">Caricamento...</div>;

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-500 ${data.theme === 'NEON' ? 'bg-[#020617] text-white' : 'bg-[#f8fafc] text-slate-800'}`}>
      <Sidebar
        activeTab={activeMainTab}
        onTabChange={setActiveMainTab}
        onReset={handleResetAll}
        onPrint={() => window.print()}
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(prev => !prev)}
        theme={data.theme}
        onThemeToggle={toggleTheme}
        portalRef={setPortalTarget}
        onRestoreComplete={refreshUIFromDB}
      />
      <main className="flex-1 min-h-screen relative p-4 pb-24 lg:p-10 transition-all duration-300 ease-in-out">
        {activeMainTab === MainTab.DASHBOARD && <GlobalDashboard portalTarget={portalTarget} />}
        {activeMainTab === MainTab.PURCHASE && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex justify-start mb-4 no-print overflow-x-auto pb-2 scrollbar-hide">
              <div className={`p-1 rounded-2xl border shadow-sm inline-flex gap-1 shrink-0 ${data.theme === 'NEON' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                <button onClick={() => setActivePurchaseTab(PurchaseTab.INPUT)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activePurchaseTab === PurchaseTab.INPUT ? (data.theme === 'NEON' ? 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/50' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-200') : 'text-slate-500'}`}>Editor Dati</button>
                <button onClick={() => setActivePurchaseTab(PurchaseTab.DASHBOARD)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activePurchaseTab === PurchaseTab.DASHBOARD ? (data.theme === 'NEON' ? 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/50' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-200') : 'text-slate-500'}`}>Report</button>
                <button onClick={() => setActivePurchaseTab(PurchaseTab.INVOICES)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activePurchaseTab === PurchaseTab.INVOICES ? (data.theme === 'NEON' ? 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/50' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-200') : 'text-slate-500'}`}>Fatture & Detrazioni</button>
              </div>
            </div>
            {activePurchaseTab === PurchaseTab.INPUT ? (
              <FinancialInput data={data} onChange={setData} scenarios={scenarios} activeScenarioId={activeScenarioId} onSaveScenario={handleSaveScenario} onLoadScenario={handleLoadScenario} onDeleteScenario={handleDeleteScenario} onUpdateScenario={handleUpdateScenario} onUpdateScenarioData={handleUpdateScenarioData} onImportScenarios={handleImportScenarios} />
            ) : activePurchaseTab === PurchaseTab.DASHBOARD ? (
              <Dashboard data={data} onChange={setData} />
            ) : (
              <InvoiceTaxArchive
                theme={data.theme}
                owner1Name={data.owner1Name || 'Giuseppe'}
                owner2Name={data.owner2Name || 'Claudia'}
              />
            )}
          </div>
        )}
        {activeMainTab === MainTab.PROPERTY_MGMT && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex justify-start mb-4 no-print overflow-x-auto pb-2 scrollbar-hide">
              <div className={`p-1 rounded-2xl border shadow-sm inline-flex gap-1 shrink-0 ${data.theme === 'NEON' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                <button onClick={() => setActivePropertyTab(PropertyTab.ASSETS)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activePropertyTab === PropertyTab.ASSETS ? (data.theme === 'NEON' ? 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/50' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-200') : 'text-slate-500'}`}>Patrimonio</button>
                <button onClick={() => setActivePropertyTab(PropertyTab.RENTALS)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activePropertyTab === PropertyTab.RENTALS ? (data.theme === 'NEON' ? 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/50' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-200') : 'text-slate-500'}`}>Affitti</button>
                <button onClick={() => setActivePropertyTab(PropertyTab.CONTACTS)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activePropertyTab === PropertyTab.CONTACTS ? (data.theme === 'NEON' ? 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/50' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-200') : 'text-slate-500'}`}>Anagrafica</button>
              </div>
            </div>
            {activePropertyTab === PropertyTab.ASSETS ? <PropertyAssetManager /> : activePropertyTab === PropertyTab.RENTALS ? <RentalManager /> : <ContactManager />}
          </div>
        )}
        {activeMainTab === MainTab.CALENDAR && <CalendarManager />}
        {activeMainTab === MainTab.ADMIN && (
          <AdminPanel
            logs={logs}
            onResetDatabase={handleResetAll}
            appData={data}
            onUpdateAppData={setData}
            onRefreshData={refreshUIFromDB}
            onUpdateScenarios={setScenarios}
          />
        )}
        {activeMainTab === MainTab.HELP && (
          <HelpCenter theme={data.theme} />
        )}
      </main>
      <AIChatbotBubble
        owner1Name={data.owner1Name || 'Giuseppe'}
        owner2Name={data.owner2Name || 'Claudia'}
      />
    </div>
  );
};

export default App;
