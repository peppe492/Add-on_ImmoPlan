
import React, { useEffect, useState } from 'react';
import { db } from '../services/dbService';
import { SystemLog, CustomSensor, Property } from '../types';

interface AdminPanelProps {
  logs: SystemLog[];
  onResetDatabase: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ logs, onResetDatabase }) => {
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
      const appData = await db.getAppData();
      const props = await db.getProperties();
      setProperties(props || []);
      if (appData && appData.customSensors) {
          setCustomSensors(appData.customSensors);
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
      if (!newSensor.name || !newSensor.entity_id_suffix || !newSensor.targetId) {
          alert("Compila tutti i campi!");
          return;
      }
      
      const safeSuffix = newSensor.entity_id_suffix.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      
      const sensor: CustomSensor = {
          id: Date.now().toString(),
          name: newSensor.name,
          entity_id_suffix: safeSuffix,
          type: newSensor.type as any,
          targetId: newSensor.targetId
      };

      const updatedList = [...customSensors, sensor];
      setCustomSensors(updatedList);
      
      const appData = await db.getAppData();
      if (appData) {
          appData.customSensors = updatedList;
          await db.saveAppData(appData); 
      }
      
      setNewSensor({ type: 'PROPERTY_CASHFLOW', name: '', entity_id_suffix: '' });
      alert("Sensore aggiunto al DB locale. Premi 'Forza Aggiornamento' per crearlo su HA.");
  };

  const handleDeleteSensor = async (id: string) => {
      if(!window.confirm("Eliminare sensore?")) return;
      const updatedList = customSensors.filter(c => c.id !== id);
      setCustomSensors(updatedList);
      const appData = await db.getAppData();
      if (appData) {
          appData.customSensors = updatedList;
          await db.saveAppData(appData);
      }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-slate-700">
         <div className="absolute top-0 right-0 w-80 h-80 bg-rose-600 rounded-full blur-[120px] opacity-10 -mr-20 -mt-20 pointer-events-none"></div>
         <h2 className="text-3xl font-bold tracking-tight relative z-10">Amministrazione Sistema</h2>
         <p className="text-slate-400 mt-2 relative z-10">Monitoraggio database, log di sistema e strumenti di manutenzione.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* DB Stats */}
        <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
              📊 Stato Database (IndexedDB)
            </h3>
            <button onClick={refreshStats} className="text-sm font-bold text-brand-600 hover:bg-brand-50 px-3 py-1 rounded-lg transition-colors">
              Aggiorna
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {dbStats ? Object.entries(dbStats).map(([key, count]) => (
              <div key={key} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{key}</span>
                <span className="text-3xl font-black text-slate-800">{count}</span>
                <span className="text-[9px] text-slate-400 mt-1">record</span>
              </div>
            )) : (
              <p className="col-span-2 text-center text-slate-400">Caricamento statistiche...</p>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-rose-50/50 p-8 rounded-3xl border border-rose-100 flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-3xl mb-4 text-rose-600">
            🧨
          </div>
          <h3 className="font-bold text-xl text-rose-900 mb-2">Danger Zone</h3>
          <p className="text-rose-700/70 text-sm mb-6 max-w-sm">
            L'eliminazione del database è irreversibile. Tutti i dati, scenari, immobili e transazioni verranno persi.
          </p>
          <button 
             onClick={onResetDatabase}
             className="bg-rose-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20 active:scale-95 uppercase text-xs tracking-widest"
          >
             Elimina Database e Reset
          </button>
        </div>

      </div>

      {/* HA CUSTOM SENSORS */}
      <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-100">
          <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                 <span className="text-2xl">🔌</span> Sensori Home Assistant
              </h3>
              <button 
                  onClick={handleManualSync} 
                  disabled={isSyncingSensors}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide text-white shadow-lg transition-all ${isSyncingSensors ? 'bg-slate-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/30'}`}
              >
                  {isSyncingSensors ? 'Aggiornamento in corso...' : '⚡ Forza Aggiornamento Sensori'}
              </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form Nuovo Sensore */}
              <div className="lg:col-span-1 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  <h4 className="font-bold text-slate-700 mb-4">Aggiungi Sensore</h4>
                  <div className="space-y-3">
                      <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Nome Visualizzato</label>
                          <input type="text" value={newSensor.name} onChange={e => setNewSensor({...newSensor, name: e.target.value})} className="w-full bg-white p-2 rounded-lg border border-slate-200 text-sm font-bold" placeholder="Es. Cashflow Via Roma" />
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">ID Sensore (Suffisso)</label>
                          <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400">sensor.immoplan_</span>
                              <input type="text" value={newSensor.entity_id_suffix} onChange={e => setNewSensor({...newSensor, entity_id_suffix: e.target.value})} className="w-full bg-white p-2 rounded-lg border border-slate-200 text-sm font-bold" placeholder="cashflow_viaroma" />
                          </div>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo Metrica</label>
                          <select value={newSensor.type} onChange={e => setNewSensor({...newSensor, type: e.target.value as any})} className="w-full bg-white p-2 rounded-lg border border-slate-200 text-sm font-bold">
                              <option value="PROPERTY_CASHFLOW">Cashflow Netto Immobile</option>
                              <option value="PROPERTY_VALUE">Valore Attuale Immobile</option>
                              <option value="CATEGORY_TOTAL">Totale Categoria (es. Mutui)</option>
                          </select>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Target (Immobile o Categoria)</label>
                          <select value={newSensor.targetId || ''} onChange={e => setNewSensor({...newSensor, targetId: e.target.value})} className="w-full bg-white p-2 rounded-lg border border-slate-200 text-sm font-bold">
                              <option value="">Seleziona...</option>
                              {newSensor.type === 'CATEGORY_TOTAL' ? (
                                  <>
                                    <option value="MORTGAGE">Mutui</option>
                                    <option value="TAX">Tasse</option>
                                    <option value="MAINTENANCE">Manutenzione</option>
                                    <option value="UTILITY">Utenze</option>
                                  </>
                              ) : (
                                  properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                          </select>
                      </div>
                      <button onClick={handleAddSensor} className="w-full bg-brand-600 text-white py-2 rounded-xl font-bold uppercase text-xs mt-2 hover:bg-brand-700">Crea Sensore</button>
                  </div>
              </div>

              {/* Lista Sensori Attivi */}
              <div className="lg:col-span-2">
                  <h4 className="font-bold text-slate-700 mb-4">Sensori Attivi ({customSensors.length})</h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {customSensors.length === 0 && <p className="text-slate-400 text-sm italic">Nessun sensore personalizzato configurato.</p>}
                      {customSensors.map(s => (
                          <div key={s.id} className="flex justify-between items-center bg-white border border-slate-100 p-3 rounded-xl shadow-sm">
                              <div>
                                  <div className="flex items-center gap-2">
                                      <p className="font-bold text-slate-800 text-sm">{s.name}</p>
                                      <span className="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded uppercase">{s.type.replace('_', ' ')}</span>
                                  </div>
                                  <p className="text-xs text-slate-400 font-mono">sensor.immoplan_{s.entity_id_suffix}</p>
                              </div>
                              <button onClick={() => handleDeleteSensor(s.id)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg font-bold text-xs">Elimina</button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </div>

      {/* System Logs */}
      <div className="bg-slate-900 rounded-3xl shadow-soft border border-slate-700 overflow-hidden flex flex-col h-[500px]">
        <div className="bg-slate-800/50 p-4 border-b border-slate-700 flex justify-between items-center">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          </div>
          <span className="text-xs font-mono text-slate-400">system_logs.log</span>
        </div>
        <div className="flex-1 p-6 overflow-y-auto font-mono text-xs space-y-2 custom-scrollbar">
          {logs.length === 0 ? (
            <p className="text-slate-600 italic">// Nessun log registrato in questa sessione...</p>
          ) : (
            logs.map(log => (
              <div key={log.id} className="flex gap-3">
                <span className="text-slate-500 shrink-0">[{log.time}]</span>
                <span className={`
                  ${log.type === 'error' ? 'text-rose-400 font-bold' : ''}
                  ${log.type === 'success' ? 'text-emerald-400' : ''}
                  ${log.type === 'info' ? 'text-blue-300' : ''}
                `}>
                  {log.type.toUpperCase()}:
                </span>
                <span className="text-slate-300 break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
