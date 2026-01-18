
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
  propertyPayments: [], // Inizializzazione array pagamenti prezzo
  totalBudget: 280000,
  liquidityGiuseppe: 45000,
  liquidityClaudia: 45000,
  loanPercentage: 80,
  purchaseCosts: {
    notary: { amount: 3000, isPaid: false, paymentDate: new Date().toISOString().split('T')[0] },
    agency: { amount: 6000, isPaid: false, paymentDate: new Date().toISOString().split('T')[0] },
    taxes: { amount: 2000, isPaid: false, paymentDate: new Date().toISOString().split('T')[0] },
    other: { amount: 0, isPaid: false, paymentDate: new Date().toISOString().split('T')[0] },
  },
  renovationCosts: {
    works: 30000,
    worksBreakdown: [{ id: '1', description: 'Stima lavori edili', amount: 30000, isPaid: false, paymentDate: new Date().toISOString().split('T')[0] }],
    materials: 10000,
    materialsBreakdown: [{ id: '1', description: 'Fornitura pavimenti e rivestimenti', amount: 10000, isPaid: false, paymentDate: new Date().toISOString().split('T')[0] }],
    design: { amount: 2000, isPaid: false, paymentDate: new Date().toISOString().split('T')[0] },
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
    if (savedData) setData(savedData);
    if (savedScenarios) setScenarios(savedScenarios);
    if (savedLogs) setLogs(savedLogs);
  }, []);

  const syncNow = useCallback(async () => {
    // Controllo blocco centralizzato DBService
    if (db.isSyncBlocked()) return;
    
    // Debounce locale
    if (Date.now() - lastSyncRef.current < 5000) return;

    const changed = await db.pullFromServer();
    if (changed) {
      await refreshUIFromDB();
      addLog("Sincronizzazione completata", 'success');
    }
    lastSyncRef.current = Date.now();
  }, [refreshUIFromDB, addLog]);

  // Inizializzazione e Eventi di Sistema
  useEffect(() => {
    db.onLog = addLog;
    const initData = async () => {
      try {
        await db.init();
        await refreshUIFromDB();
      } catch (e) {
        addLog("Errore connessione database", 'error');
      } finally {
        setIsLoaded(true);
      }
    };
    initData();

    // Sincronizza quando l'app torna visibile (es. riaprendo il tab o sbloccando il telefono)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncNow();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', syncNow);

    const pollInterval = setInterval(async () => {
      const now = Date.now();
      if (now - lastSyncRef.current > 30000) { // Polling ogni 30s se idle
        syncNow();
      }
    }, 30000);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', syncNow);
      clearInterval(pollInterval);
    };
  }, [addLog, refreshUIFromDB, syncNow]);

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
    lastSyncRef.current = Date.now();
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
      // Blocca sync tramite il servizio centralizzato
      db.blockSync(10000); 

      await db.deleteScenario(id);
      setScenarios(prev => prev.filter(s => s.id !== id));
      if (activeScenarioId === id) setActiveScenarioId(null);
      lastSyncRef.current = Date.now();
    }
  };

  const handleUpdateScenario = async (id: string, newName: string) => {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) return;
    const updated = { ...scenario, name: newName };
    await db.saveScenario(updated);
    setScenarios(prev => prev.map(s => s.id === id ? updated : s));
    lastSyncRef.current = Date.now();
  };

  const handleUpdateScenarioData = async (id: string) => {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) return;
    const updated = { ...scenario, data: JSON.parse(JSON.stringify(data)), date: new Date().toLocaleDateString('it-IT') + " (Agg.)" };
    await db.saveScenario(updated);
    setScenarios(prev => prev.map(s => s.id === id ? updated : s));
    lastSyncRef.current = Date.now();
  };

  const handleImportScenarios = async (newScenarios: Scenario[]) => {
    for (const s of newScenarios) await db.saveScenario(s);
    setScenarios(prev => [...newScenarios, ...prev]);
    lastSyncRef.current = Date.now();
  };

  const handleResetAll = async () => {
    if (window.confirm("Cancellare tutto?")) {
      db.blockSync(10000); // Block sync during reset
      await db.clearAll();
      window.location.reload();
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-6">
        <div className="w-16 h-16 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin mb-6"></div>
        <h2 className="text-xl font-bold text-slate-800">MM's PROPERTY</h2>
        <p className="text-slate-400 font-medium animate-pulse mt-2">Allineamento database centrale...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <Sidebar 
        activeTab={activeMainTab} 
        onTabChange={setActiveMainTab} 
        onReset={handleResetAll} 
        onPrint={() => window.print()} 
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(prev => !prev)}
      />

      <main className={`flex-1 min-h-screen relative p-6 pb-24 lg:p-10 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'}`}>
        <div className="hidden lg:flex justify-between items-center mb-8 no-print">
           <div className="text-sm text-slate-400 font-medium">Dashboard / <span className="text-slate-900 font-bold">{activeMainTab}</span></div>
           <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isSaving ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isSaving ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
              <span className="text-[10px] font-bold uppercase tracking-wide">{isSaving ? 'Salvataggio Cloud...' : 'Database Sincronizzato'}</span>
           </div>
        </div>

        {activeMainTab === MainTab.DASHBOARD && <GlobalDashboard />}
        {activeMainTab === MainTab.PURCHASE && (
          <div className="space-y-8 animate-fade-in">
             <div className="flex justify-start no-print mb-4">
               <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm inline-flex gap-1">
                  <button onClick={() => setActivePurchaseTab(PurchaseTab.INPUT)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activePurchaseTab === PurchaseTab.INPUT ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-slate-500 hover:bg-slate-50'}`}>Editor Dati</button>
                  <button onClick={() => setActivePurchaseTab(PurchaseTab.DASHBOARD)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activePurchaseTab === PurchaseTab.DASHBOARD ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-slate-500 hover:bg-slate-50'}`}>Report</button>
               </div>
            </div>
            {activePurchaseTab === PurchaseTab.INPUT ? (
              <FinancialInput data={data} onChange={setData} scenarios={scenarios} activeScenarioId={activeScenarioId} onSaveScenario={handleSaveScenario} onLoadScenario={handleLoadScenario} onDeleteScenario={handleDeleteScenario} onUpdateScenario={handleUpdateScenario} onUpdateScenarioData={handleUpdateScenarioData} onImportScenarios={handleImportScenarios} />
            ) : <Dashboard data={data} />}
          </div>
        )}
        {activeMainTab === MainTab.PROPERTY_MGMT && (
          <div className="space-y-8 animate-fade-in">
             <div className="flex justify-start no-print mb-4">
               <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm inline-flex gap-1">
                  <button onClick={() => setActivePropertyTab(PropertyTab.ASSETS)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activePropertyTab === PropertyTab.ASSETS ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-slate-500 hover:bg-slate-50'}`}>Patrimonio</button>
                  <button onClick={() => setActivePropertyTab(PropertyTab.RENTALS)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activePropertyTab === PropertyTab.RENTALS ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-slate-500 hover:bg-slate-50'}`}>Affitti</button>
                  <button onClick={() => setActivePropertyTab(PropertyTab.CONTACTS)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activePropertyTab === PropertyTab.CONTACTS ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-slate-500 hover:bg-slate-50'}`}>Anagrafica</button>
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
