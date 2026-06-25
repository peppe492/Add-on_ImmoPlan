
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
import { FinancialData, MainTab, PurchaseTab, PropertyTab, Scenario, SystemLog } from './types';
import { db } from './services/dbService';

const INITIAL_DATA: FinancialData = {
  propertyName: 'Progetto Demo: Loft Navigli',
  totalPrice: 245000,
  propertyPayments: [],
  totalBudget: 310000,
  theme: 'DEFAULT',
  portfolios: [
    { id: 'p1', name: 'Risparmi Giuseppe', owner: 'Giuseppe', initialBalance: 65000 },
    { id: 'p2', name: 'Fondo Casa Claudia', owner: 'Claudia', initialBalance: 40000 }
  ],
  loanPercentage: 80,
  purchaseCosts: {
    deposit: {
      amount: 15000,
      isPaid: true,
      paidAmount: 15000,
      paymentDate: '2024-01-15',
      assignments: [{ portfolioId: 'p1', amount: 15000, date: '2024-01-15' }]
    },
    balance: { amount: 34000, isPaid: false, assignments: [] },
    notary: { amount: 3800, isPaid: false, assignments: [] },
    agency: { amount: 7350, isPaid: false, assignments: [] },
    taxes: { amount: 2000, isPaid: true, paidAmount: 2000, paymentDate: '2024-02-01', assignments: [{ portfolioId: 'p2', amount: 2000, date: '2024-02-01' }] },
    other: { amount: 500, isPaid: false, assignments: [] },
  },
  renovationCosts: {
    works: 45000,
    worksBreakdown: [
      { id: 'w1', description: 'Rifacimento Bagno Master', amount: 8500, isPaid: false, assignments: [] },
      { id: 'w2', description: 'Impianto Elettrico Certificato', amount: 4500, isPaid: false, assignments: [] }
    ],
    materials: 12000,
    materialsBreakdown: [
      { id: 'm1', description: 'Parquet Rovere (65mq)', amount: 4200, isPaid: false, assignments: [] },
      { id: 'm2', description: 'Rivestimenti Marazzi', amount: 1800, isPaid: false, assignments: [] }
    ],
    design: { amount: 3500, isPaid: true, paidAmount: 1500, paymentDate: '2024-02-10', assignments: [{ portfolioId: 'p1', amount: 1500, date: '2024-02-10' }] },
    contingency: 5000,
  },
  customSensors: []
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
    if (savedData) {
      if (!savedData.purchaseCosts.balance) {
        savedData.purchaseCosts.balance = { amount: 0, isPaid: false, assignments: [] };
      }
      setData(savedData);
    }
    if (savedScenarios) setScenarios(savedScenarios);
    if (savedLogs) setLogs(savedLogs);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-neon');
    if (data.theme === 'NEON') {
      root.classList.add('theme-neon');
    }
  }, [data.theme]);

  useEffect(() => {
    db.onLog = addLog;
    const initData = async () => {
      try {
        await db.init();
        await refreshUIFromDB();
      } catch (e) {
        addLog("Errore database", 'error');
      } finally {
        setIsLoaded(true);
      }
    };
    initData();
  }, [addLog, refreshUIFromDB]);

  useEffect(() => {
    if (isLoaded) {
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
    const scenario = scenarios.find(s => s.id === id);
    if (scenario) {
      setData(JSON.parse(JSON.stringify(scenario.data)));
      setActiveScenarioId(id);
    }
  };

  const handleDeleteScenario = async (id: string) => {
    if (window.confirm("Eliminare lo scenario?")) {
      db.blockSync(10000);
      await db.deleteScenario(id);
      setScenarios(prev => prev.filter(s => s.id !== id));
      if (activeScenarioId === id) setActiveScenarioId(null);
    }
  };

  const handleUpdateScenario = async (id: string, newName: string) => {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) return;
    const updated = { ...scenario, name: newName };
    await db.saveScenario(updated);
    setScenarios(prev => prev.map(s => s.id === id ? updated : s));
  };

  const handleUpdateScenarioData = async (id: string) => {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) return;
    const updated = { ...scenario, data: JSON.parse(JSON.stringify(data)), date: new Date().toLocaleDateString('it-IT') + " (Agg.)" };
    await db.saveScenario(updated);
    setScenarios(prev => prev.map(s => s.id === id ? updated : s));
  };

  const handleImportScenarios = async (newScenarios: Scenario[]) => {
    for (const s of newScenarios) await db.saveScenario(s);
    setScenarios(prev => [...newScenarios, ...prev]);
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
      />
      <main className="flex-1 min-h-screen relative p-4 pb-24 lg:p-10 transition-all duration-300 ease-in-out">
        {activeMainTab === MainTab.DASHBOARD && <GlobalDashboard portalTarget={portalTarget} />}
        {activeMainTab === MainTab.PURCHASE && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex justify-start mb-4 no-print overflow-x-auto pb-2 scrollbar-hide">
              <div className={`p-1 rounded-2xl border shadow-sm inline-flex gap-1 shrink-0 ${data.theme === 'NEON' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                <button onClick={() => setActivePurchaseTab(PurchaseTab.INPUT)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activePurchaseTab === PurchaseTab.INPUT ? (data.theme === 'NEON' ? 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/50' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-200') : 'text-slate-500'}`}>Editor Dati</button>
                <button onClick={() => setActivePurchaseTab(PurchaseTab.DASHBOARD)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activePurchaseTab === PurchaseTab.DASHBOARD ? (data.theme === 'NEON' ? 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/50' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-200') : 'text-slate-500'}`}>Report</button>
              </div>
            </div>
            {activePurchaseTab === PurchaseTab.INPUT ? (
              <FinancialInput data={data} onChange={setData} scenarios={scenarios} activeScenarioId={activeScenarioId} onSaveScenario={handleSaveScenario} onLoadScenario={handleLoadScenario} onDeleteScenario={handleDeleteScenario} onUpdateScenario={handleUpdateScenario} onUpdateScenarioData={handleUpdateScenarioData} onImportScenarios={handleImportScenarios} />
            ) : <Dashboard data={data} onChange={setData} />}
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
        {activeMainTab === MainTab.ADMIN && <AdminPanel logs={logs} onResetDatabase={handleResetAll} appData={data} onUpdateAppData={setData} />}
      </main>
      <AIChatbotBubble />
    </div>
  );
};

export default App;
