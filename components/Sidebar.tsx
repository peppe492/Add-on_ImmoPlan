
import React, { useRef } from 'react';
import { MainTab } from '../types';
import { db } from '../services/dbService';

interface SidebarProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  onReset: () => void;
  onPrint: () => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, onReset, onPrint, isCollapsed, onToggle }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const menuItems = [
    { id: MainTab.DASHBOARD, label: 'Dashboard', icon: '📊' },
    { id: MainTab.PURCHASE, label: 'Nuovo Acquisto', icon: '🏠' },
    { id: MainTab.PROPERTY_MGMT, label: 'Patrimonio', icon: '🏢' },
    { id: MainTab.ADVISOR, label: 'AI Advisor', icon: '🤖' },
    { id: MainTab.VISUALIZER, label: 'Design Studio', icon: '✨' },
    { id: MainTab.ADMIN, label: 'Admin', icon: '⚙️' },
  ];

  const handleGlobalExport = async () => {
    try {
        const json = await db.exportFullDatabase();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `immoplan_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (e) {
        alert("Errore durante l'esportazione del database.");
    }
  };

  const handleGlobalImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset immediato valore input per permettere ri-selezione stesso file
    e.target.value = '';

    const reader = new FileReader();
    
    reader.onload = async (evt) => {
        try {
            const text = evt.target?.result as string;
            if (!text) {
                alert("Il file selezionato è vuoto.");
                return;
            }
            
            if (window.confirm("ATTENZIONE: Stai per sovrascrivere COMPLETAMENTE il database corrente con questo backup. \n\nI dati attuali verranno persi. Vuoi procedere?")) {
                const success = await db.importFullDatabase(text);
                if (success) {
                    // Timeout per dare tempo al rendering dei log UI se attivo
                    setTimeout(() => {
                        if(window.confirm("Ripristino completato con successo!\n\nPremi OK per ricaricare l'applicazione e visualizzare i nuovi dati.")) {
                            window.location.reload();
                        }
                    }, 500);
                } else {
                    alert("Si è verificato un errore durante l'importazione. Controlla il pannello Admin -> System Logs.");
                }
            }
        } catch (e: any) {
            console.error("Critical Import Error:", e);
            alert("Errore critico lettura file: " + e.message);
        }
    };
    
    reader.onerror = () => {
        alert("Errore generico nella lettura del file (Permessi?).");
    };

    reader.readAsText(file);
  };

  const triggerImport = () => {
      if (fileInputRef.current) {
          fileInputRef.current.click();
      }
  };

  return (
    <>
      <div 
        className={`hidden lg:flex flex-col bg-white border-r border-slate-100 h-screen fixed left-0 top-0 z-50 p-4 no-print transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Toggle Button */}
        <button 
          onClick={onToggle}
          className="absolute -right-3 top-9 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-brand-600 shadow-sm z-50"
        >
          {isCollapsed ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          )}
        </button>

        <div className={`flex items-center gap-3 mb-8 px-2 ${isCollapsed ? 'justify-center' : ''}`}>
           <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0">MM</div>
           {!isCollapsed && (
             <div className="animate-fade-in overflow-hidden whitespace-nowrap">
               <h1 className="font-bold text-sm text-slate-900 leading-none">ImmoPlan</h1>
               <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Property Manager</span>
             </div>
           )}
        </div>

        <nav className="flex-1 space-y-1">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                activeTab === item.id 
                  ? 'bg-brand-600 text-white shadow-md' 
                  : 'text-slate-500 hover:bg-slate-50'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? item.label : ''}
            >
              <span className="text-base shrink-0">{item.icon}</span>
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-100 space-y-2">
            <button onClick={handleGlobalExport} className={`w-full py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-50 transition-colors flex items-center gap-2 ${isCollapsed ? 'justify-center px-0' : 'justify-center'}`} title="Backup">
               <span className="text-sm">📥</span>
               {!isCollapsed && <span>Backup JSON</span>}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleGlobalImport} 
              accept=".json" 
              className="hidden" 
            />
            <button onClick={triggerImport} className={`w-full py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-50 transition-colors flex items-center gap-2 ${isCollapsed ? 'justify-center px-0' : 'justify-center'}`} title="Ripristina">
               <span className="text-sm">📤</span>
               {!isCollapsed && <span>Ripristina DB</span>}
            </button>
            <button onClick={onPrint} className={`w-full py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-200 transition-colors flex items-center gap-2 ${isCollapsed ? 'justify-center px-0' : 'justify-center'}`} title="Stampa">
               <span className="text-sm">🖨️</span>
               {!isCollapsed && <span>Stampa Report</span>}
            </button>
            {!isCollapsed && <p className="text-[8px] text-center text-slate-300 font-medium animate-fade-in">HA Add-on Edition</p>}
        </div>
      </div>

      {/* Mobile Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-lg border-t border-slate-200 z-50 px-2 py-1 flex justify-around items-center no-print">
         {menuItems.slice(0, 4).map(item => (
            <button key={item.id} onClick={() => onTabChange(item.id)} className={`flex flex-col items-center p-2 ${activeTab === item.id ? 'text-brand-600' : 'text-slate-400'}`}>
               <span className="text-lg">{item.icon}</span>
               <span className="text-[8px] font-bold">{item.label.split(' ')[0]}</span>
            </button>
         ))}
      </div>
    </>
  );
};
