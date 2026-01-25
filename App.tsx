
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FinancialInput } from './components/FinancialInput';
import { Dashboard } from './components/Dashboard';
import { AIAdvisor } from './components/AIAdvisor';
import { RenovationVisualizer } from './components/RenovationVisualizer';
import { RentalManager } from './components/RentalManager';
import { PropertyAssetManager } from './components/PropertyAssetManager';
import { ContactManager } from './components/ContactManager';
import { GlobalDashboard } from './components/GlobalDashboard';
import { AdminPanel } from './components/AdminPanel';
import { Sidebar } from './components/Sidebar';
import { FinancialData, MainTab, PurchaseTab, PropertyTab, Scenario, SystemLog } from './types';
import { db } from './services/dbService';

const INITIAL_DATA: FinancialData = {
  propertyName: 'Nuovo Progetto',
  totalPrice: 200000,
  propertyPayments: [],
  totalBudget: 280000,
  portfolios: [
    { id: 'p1', name: 'Conto Corrente G.', owner: 'Giuseppe', initialBalance: 50000 },
    { id: 'p2', name: 'Conto Corrente C.', owner: 'Claudia', initialBalance: 50000 }
  ],
  loanPercentage: 80,
  purchaseCosts: {
    deposit: { amount: 0, isPaid: false, assignments: [] },
    balance: { amount: 0, isPaid: false, assignments: [] }, // Saldo al Rogito (Calcolato)
    notary: { amount: 3000, isPaid: false, assignments: [] },
    agency: { amount: 6000, isPaid: false, assignments: [] },
    taxes: { amount: 2000, isPaid: false, assignments: [] },
    other: { amount: 0, isPaid: false, assignments: [] },
  },
  renovationCosts: {
    works: 0,
    worksBreakdown: [],
    materials: 0,
    materialsBreakdown: [],
    design: { amount: 0, isPaid: false, assignments: [] }, // Impostato a 0
    contingency: 0, // Impostato a 0
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
  const lastSyncRef = useRef<number>(0);

  const addLog = useCallback((message: string, type: 'info' | 'error' | 'success') => {
    const newLog: SystemLog = { id: Date.now() + Math.random(), message, type, time: new Date().toLocaleTimeString() };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
    db.saveLog(newLog).catch(() => {});
  }, []);

  const refreshUIFromDB = useCallback(async () => {
    const [savedData, savedScenarios, savedLogs] = await Promise.all([
      db.getAppData(),
      db.getScenarios(),
      db.getLogs()
    ]);
    if (savedData) {
        // Migration check: ensure balance exists if loading old data
        if (!savedData.purchaseCosts.balance) {
            savedData.purchaseCosts.balance = { amount: 0, isPaid: false, assignments: [] };
        }
        setData(savedData);
    }
    if (savedScenarios) setScenarios(savedScenarios);
    if (savedLogs) setLogs(savedLogs);
  }, []);

  const syncNow = useCallback(async () => {
    if (db.isSyncBlocked()) return;
    if (Date.now() - lastSyncRef.current < 5000) return;
    const changed = await db.pullFromServer();
    if (changed) {
      await refreshUIFromDB();
      addLog("Sincronizzazione completata", 'success');
    }
    lastSyncRef.current = Date.now();
  }, [refreshUIFromDB, addLog]);

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

  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bold">Caricamento...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <Sidebar activeTab={activeMainTab} onTabChange={setActiveMainTab} onReset={handleResetAll} onPrint={() => window.print()} isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(prev => !prev)} />
      <main className={`flex-1 min-h-screen relative p-6 pb-24 lg:p-10 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'}`}>
        {activeMainTab === MainTab.DASHBOARD && <GlobalDashboard />}
        {activeMainTab === MainTab.PURCHASE && (
          <div className="space-y-8 animate-fade-in">
             <div className="flex justify-start mb-4 no-print">
               <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm inline-flex gap-1">
                  <button onClick={() => setActivePurchaseTab(PurchaseTab.INPUT)} className={`px-5 py-2.5 rounded-xl text-xs font-bold ${activePurchaseTab === PurchaseTab.INPUT ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-slate-500'}`}>Editor Dati</button>
                  <button onClick={() => setActivePurchaseTab(PurchaseTab.DASHBOARD)} className={`px-5 py-2.5 rounded-xl text-xs font-bold ${activePurchaseTab === PurchaseTab.DASHBOARD ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-slate-500'}`}>Report</button>
               </div>
            </div>
            {activePurchaseTab === PurchaseTab.INPUT ? (
              <FinancialInput data={data} onChange={setData} scenarios={scenarios} activeScenarioId={activeScenarioId} onSaveScenario={handleSaveScenario} onLoadScenario={handleLoadScenario} onDeleteScenario={handleDeleteScenario} onUpdateScenario={handleUpdateScenario} onUpdateScenarioData={handleUpdateScenarioData} onImportScenarios={handleImportScenarios} />
            ) : <Dashboard data={data} onChange={setData} />}
          </div>
        )}
        {activeMainTab === MainTab.PROPERTY_MGMT && (
          <div className="space-y-8 animate-fade-in">
             <div className="flex justify-start mb-4 no-print">
               <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm inline-flex gap-1">
                  <button onClick={() => setActivePropertyTab(PropertyTab.ASSETS)} className={`px-5 py-2.5 rounded-xl text-xs font-bold ${activePropertyTab === PropertyTab.ASSETS ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-slate-500'}`}>Patrimonio</button>
                  <button onClick={() => setActivePropertyTab(PropertyTab.RENTALS)} className={`px-5 py-2.5 rounded-xl text-xs font-bold ${activePropertyTab === PropertyTab.RENTALS ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-slate-500'}`}>Affitti</button>
                  <button onClick={() => setActivePropertyTab(PropertyTab.CONTACTS)} className={`px-5 py-2.5 rounded-xl text-xs font-bold ${activePropertyTab === PropertyTab.CONTACTS ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-slate-500'}`}>Anagrafica</button>
               </div>
            </div>
            {activePropertyTab === PropertyTab.ASSETS ? <PropertyAssetManager /> : activePropertyTab === PropertyTab.RENTALS ? <RentalManager /> : <ContactManager />}
          </div>
        )}
        {activeMainTab === MainTab.ADVISOR && <AIAdvisor data={data} />}
        {activeMainTab === MainTab.VISUALIZER && <RenovationVisualizer />}
        {activeMainTab === MainTab.ADMIN && <AdminPanel logs={logs} onResetDatabase={handleResetAll} />}
      </main>
    </div>
  );
};

export default App;
