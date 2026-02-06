
import React, { useEffect, useState } from 'react';
import { db } from '../services/dbService';
import { SystemLog, CustomSensor, Property, FinancialData } from '../types';

interface AdminPanelProps {
  logs: SystemLog[];
  onResetDatabase: () => void;
  appData: FinancialData;
  onUpdateAppData: (data: FinancialData) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ logs, onResetDatabase, appData, onUpdateAppData }) => {
  const [dbStats, setDbStats] = useState<Record<string, number> | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [customSensors, setCustomSensors] = useState<CustomSensor[]>([]);
  const [isSyncingSensors, setIsSyncingSensors] = useState(false);
  
  // New Sensor Form
  const [newSensor, setNewSensor] = useState<Partial<CustomSensor>>({
      type: 'PROPERTY_CASHFLOW',
      name: '',
      entity_id_suffix: ''
  });

  useEffect(() => {
    refreshStats();
    loadConfig();
  }, []);

  const refreshStats = async () => {
    try {
      const stats = await db.getStats();
      setDbStats(stats);
    } catch (e) {
      console.error("Errore recupero stats", e);
    }
  };

  const loadConfig = async () => {
      const data = await db.getAppData();
      const props = await db.getProperties();
      setProperties(props || []);
      if (data && data.customSensors) {
          setCustomSensors(data.customSensors);
      }
  };

  const handleManualSync = async () => {
      if (isSyncingSensors) return;
      setIsSyncingSensors(true);
      try {
          const result = await db.triggerHASensorSync();
          if (result.success) {
              alert("Sincronizzazione completata! Controlla i log per i dettagli.");
          } else {
              alert("Errore sincronizzazione: " + result.message);
          }
      } catch (e: any) {
          alert("Errore critico: " + e.message);
      } finally {
          setIsSyncingSensors(false);
      }
  };

  const handleAddSensor = async () => {
      if (!newSensor.name || !newSensor.entity_id_suffix || (!newSensor.targetId && newSensor.type !== 'CALENDAR_EVENTS')) {
          alert("Compila tutti i campi!");
          return;
      }
      
      const safeSuffix = newSensor.entity_id_suffix.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      
      const sensor: CustomSensor = {
          id: Date.now().toString(),
          name: newSensor.name,
          entity_id_suffix: safeSuffix,
          type: newSensor.type as any,
          targetId: newSensor.targetId || 'GLOBAL'
      };

      const updatedList = [...customSensors, sensor];
      setCustomSensors(updatedList);
      
      onUpdateAppData({ ...appData, customSensors: updatedList });
      
      setNewSensor({ type: 'PROPERTY_CASHFLOW', name: '', entity_id_suffix: '' });
      alert("Sensore aggiunto al DB locale. Premi 'Forza Aggiornamento' per crearlo su HA.");
  };

  const handleDeleteSensor = async (id: string) => {
      if(!window.confirm("Eliminare sensore?")) return;
      const updatedList = customSensors.filter(c => c.id !== id);
      setCustomSensors(updatedList);
      onUpdateAppData({ ...appData, customSensors: updatedList });
  };

  const setTheme = (theme: 'DEFAULT' | 'NEON') => {
      onUpdateAppData({ ...appData, theme });
  };

  const isNeon = appData.theme === 'NEON';

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      
      {/* Header */}
      <div className={`${isNeon ? 'bg-slate-900 border-cyan-500/30' : 'bg-slate-900 border-slate-700'} text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border`}>
         <div className={`absolute top-0 right-0 w-80 h-80 ${isNeon ? 'bg-cyan-500' : 'bg-rose-600'} rounded-full blur-[120px] opacity-10 -mr-20 -mt-20 pointer-events-none`}></div>
         <h2 className="text-3xl font-bold tracking-tight relative z-10">Amministrazione Sistema</h2>
         <p className="text-slate-400 mt-2 relative z-10">Monitoraggio database, log di sistema e strumenti di manutenzione.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Theme Selection */}
        <div className={`${isNeon ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'} p-8 rounded-3xl shadow-soft border`}>
            <h3 className={`font-bold text-xl mb-6 flex items-center gap-2 ${isNeon ? 'text-white' : 'text-slate-800'}`}>
                🎨 Personalizzazione UI
            </h3>
            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={() => setTheme('DEFAULT')}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${appData.theme === 'DEFAULT' ? 'border-brand-500 bg-brand-50/10' : 'border-slate-100 hover:border-slate-200'}`}
                >
                    <div className="w-full h-12 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-bold text-slate-400">Light / Soft</div>
                    <span className={`text-xs font-bold ${isNeon ? 'text-slate-300' : 'text-slate-600'}`}>Default Theme</span>
                </button>
                <button 
                    onClick={() => setTheme('NEON')}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${isNeon ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'border-slate-100 hover:border-slate-200'}`}
                >
                    <div className="w-full h-12 bg-[#020617] border border-cyan-500/50 rounded-lg flex items-center justify-center text-xs font-bold text-cyan-400">Neon / Dark</div>
                    <span className={`text-xs font-bold ${isNeon ? 'text-slate-300' : 'text-slate-600'}`}>Cyber Neon</span>
                </button>
            </div>
        </div>

        {/* DB Stats */}
        <div className={`${isNeon ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'} p-8 rounded-3xl shadow-soft border`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={`font-bold text-xl flex items-center gap-2 ${isNeon ? 'text-white' : 'text-slate-800'}`}>
              📊 Stato Database
            </h3>
            <button onClick={refreshStats} className="text-sm font-bold text-brand-600 hover:opacity-80 px-3 py-1 rounded-lg transition-colors">
              Aggiorna
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {dbStats ? Object.entries(dbStats).map(([key, count]) => (
              <div key={key} className={`${isNeon ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} p-4 rounded-2xl border flex flex-col items-center`}>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{key}</span>
                <span className={`text-3xl font-black ${isNeon ? 'text-cyan-400' : 'text-slate-800'}`}>{count}</span>
                <span className="text-[9px] text-slate-400 mt-1">record</span>
              </div>
            )) : (
              <p className="col-span-2 text-center text-slate-400">Caricamento statistiche...</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* HA CUSTOM SENSORS */}
        <div className={`${isNeon ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'} p-8 rounded-3xl shadow-soft border`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h3 className={`font-bold text-xl flex items-center gap-2 ${isNeon ? 'text-white' : 'text-slate-800'}`}>
                    <span className="text-2xl">🔌</span> Sensori HA
                </h3>
                <button 
                    onClick={handleManualSync} 
                    disabled={isSyncingSensors}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide text-white shadow-lg transition-all ${isSyncingSensors ? 'bg-slate-400 cursor-wait' : (isNeon ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/20' : 'bg-indigo-600 hover:bg-indigo-700')}`}
                >
                    {isSyncingSensors ? 'Sincronizzazione...' : '⚡ Forza Push'}
                </button>
            </div>
            
            <div className="space-y-4">
                <div className={`${isNeon ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} p-4 rounded-2xl border`}>
                    <h4 className={`font-bold text-xs mb-3 ${isNeon ? 'text-cyan-400' : 'text-slate-700'}`}>Aggiungi Sensore</h4>
                    <div className="space-y-3">
                        <input type="text" value={newSensor.name} onChange={e => setNewSensor({...newSensor, name: e.target.value})} className={`${isNeon ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'} w-full p-2 rounded-lg border text-sm font-bold`} placeholder="Nome Sensore" />
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">sensor.immoplan_</span>
                            <input type="text" value={newSensor.entity_id_suffix} onChange={e => setNewSensor({...newSensor, entity_id_suffix: e.target.value})} className={`${isNeon ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'} flex-1 p-2 rounded-lg border text-sm font-bold`} placeholder="id_unico" />
                        </div>
                        <select value={newSensor.type} onChange={e => setNewSensor({...newSensor, type: e.target.value as any})} className={`${isNeon ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'} w-full p-2 rounded-lg border text-sm font-bold`}>
                            <option value="PROPERTY_CASHFLOW">Cashflow Netto</option>
                            <option value="PROPERTY_VALUE">Valore Attuale</option>
                            <option value="CATEGORY_TOTAL">Totale Categoria</option>
                            <option value="CALENDAR_EVENTS">Calendario (JSON)</option>
                        </select>
                        <select value={newSensor.targetId || ''} onChange={e => setNewSensor({...newSensor, targetId: e.target.value})} className={`${isNeon ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'} w-full p-2 rounded-lg border text-sm font-bold`}>
                            <option value="">Target...</option>
                            {newSensor.type === 'CALENDAR_EVENTS' && <option value="GLOBAL">Globale</option>}
                            {newSensor.type === 'CATEGORY_TOTAL' ? (
                                <>
                                  <option value="MORTGAGE">Mutui</option>
                                  <option value="TAX">Tasse</option>
                                  <option value="MAINTENANCE">Manutenzione</option>
                                </>
                            ) : properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button onClick={handleAddSensor} className={`w-full ${isNeon ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-brand-600 hover:bg-brand-700'} text-white py-2 rounded-xl font-bold uppercase text-xs mt-2 transition-all`}>Crea Sensore</button>
                    </div>
                </div>
            </div>
        </div>

        {/* Danger Zone */}
        <div className={`${isNeon ? 'bg-rose-950/20 border-rose-500/20' : 'bg-rose-50/50 border-rose-100'} p-8 rounded-3xl border flex flex-col justify-center items-center text-center`}>
          <div className={`w-16 h-16 ${isNeon ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-600'} rounded-full flex items-center justify-center text-3xl mb-4`}>
            🧨
          </div>
          <h3 className={`font-bold text-xl mb-2 ${isNeon ? 'text-rose-400' : 'text-rose-900'}`}>Danger Zone</h3>
          <p className={`${isNeon ? 'text-rose-300/60' : 'text-rose-700/70'} text-sm mb-6 max-w-sm`}>
            L'eliminazione del database è irreversibile. Tutti i dati verranno persi definitivamente.
          </p>
          <button 
             onClick={onResetDatabase}
             className="bg-rose-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg active:scale-95 uppercase text-xs tracking-widest"
          >
             Elimina Database
          </button>
        </div>
      </div>

      {/* System Logs */}
      <div className={`${isNeon ? 'bg-slate-900 border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)]' : 'bg-slate-900 border-slate-700'} rounded-3xl shadow-soft border overflow-hidden flex flex-col h-[400px]`}>
        <div className={`${isNeon ? 'bg-slate-950 border-cyan-500/20' : 'bg-slate-800/50 border-slate-700'} p-4 border-b flex justify-between items-center`}>
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
          </div>
          <span className={`text-xs font-mono ${isNeon ? 'text-cyan-400' : 'text-slate-400'}`}>system_logs.log</span>
        </div>
        <div className="flex-1 p-6 overflow-y-auto font-mono text-[11px] space-y-1.5 custom-scrollbar">
          {logs.length === 0 ? (
            <p className="text-slate-600 italic">// In attesa di log...</p>
          ) : (
            logs.map(log => (
              <div key={log.id} className="flex gap-3">
                <span className="text-slate-500 shrink-0">[{log.time}]</span>
                <span className={`
                  ${log.type === 'error' ? 'text-rose-400 font-bold' : ''}
                  ${log.type === 'success' ? (isNeon ? 'text-cyan-400' : 'text-emerald-400') : ''}
                  ${log.type === 'info' ? (isNeon ? 'text-purple-400' : 'text-blue-300') : ''}
                `}>
                  {log.type.toUpperCase()}:
                </span>
                <span className={`${isNeon ? 'text-slate-300' : 'text-slate-300'} break-all`}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
