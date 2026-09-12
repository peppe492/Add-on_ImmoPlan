import React, { useRef, useState } from 'react';
import { MainTab } from '../types.ts';
import { db } from '../services/dbService.ts';

interface SidebarProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  onReset: () => void;
  onPrint: () => void;
  isCollapsed: boolean;
  onToggle: () => void;
  theme?: 'DEFAULT' | 'NEON';
  onThemeToggle?: () => void;
  portalRef?: (el: HTMLDivElement | null) => void;
  onRestoreComplete?: () => Promise<void>; // callback per aggiornare l'UI senza reload
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  onTabChange, 
  onReset, 
  onPrint, 
  isCollapsed, 
  onToggle,
  theme = 'DEFAULT',
  onThemeToggle,
  portalRef,
  onRestoreComplete
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stati per il ripristino selettivo del backup
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [availableStores, setAvailableStores] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);

  // Mappatura delle chiavi database con etichette visibili in italiano
  const STORE_LABELS: Record<string, { label: string; desc: string }> = {
    config: { label: '⚙️ Impostazioni Generali', desc: 'Prezzo bozza, portafogli, budget' },
    properties: { label: '🏠 Immobili e Valutazioni', desc: 'Storico stime reali, mutui e note' },
    rentalRecords: { label: '📊 Registro Affitti e Spese', desc: 'Transazioni mensili, utenze e tasse' },
    scenarios: { label: '💰 Scenari d\'Acquisto', desc: 'Tutte le versioni di business plan salvate' },
    tenants: { label: '👤 Anagrafica Inquilini', desc: 'Dati di contatto, contratti e documenti' },
    landlords: { label: '💼 Anagrafica Locatori', desc: 'Dati bancari e anagrafica proprietari' },
    deadlines: { label: '📅 Scadenze e Promemoria', desc: 'Calendario pagamenti, imposte e contratti' },
    invoices: { label: '📄 Fatture & Detrazioni 730', desc: 'Fatture, bonifici parlanti e crediti fiscali' },
  };

  const menuItems = [
    { id: MainTab.DASHBOARD, label: 'Dashboard', mobileLabel: 'Dash', icon: '📊' },
    { id: MainTab.PURCHASE, label: 'Acquisto', mobileLabel: 'Acquisto', icon: '💰' },
    { id: MainTab.PROPERTY_MGMT, label: 'Patrimonio', mobileLabel: 'Asset', icon: '🏢' },
    { id: MainTab.CALENDAR, label: 'Scadenze', mobileLabel: 'Scadenze', icon: '📅' },
    { id: MainTab.ADMIN, label: 'Admin', mobileLabel: 'Admin', icon: '⚙️' },
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

    e.target.value = '';
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
        try {
            const text = evt.target?.result as string;
            if (!text) {
                alert("Il file selezionato è vuoto.");
                return;
            }
            
            const parsed = JSON.parse(text);
            const data = parsed.data || parsed;
            
            const possibleStores = ['config', 'scenarios', 'rentalRecords', 'tenants', 'landlords', 'properties', 'deadlines', 'invoices'];
            const foundStores = possibleStores.filter(s => data[s] !== undefined);
            
            if (foundStores.length === 0) {
                alert("Il file selezionato non contiene un backup valido o è vuoto.");
                return;
            }
            
            setImportJsonText(text);
            setAvailableStores(foundStores);
            setSelectedStores(foundStores); // Spuntati di default tutti gli store rilevati
            setShowImportModal(true);
        } catch (e: any) {
            console.error("Critical Import Error:", e);
            alert("Errore critico lettura file: " + e.message);
        }
    };
    
    reader.onerror = () => {
        alert("Errore generico nella lettura del file.");
    };

    reader.readAsText(file);
  };

  const executeSelectiveImport = async () => {
    if (selectedStores.length === 0) {
      alert("Seleziona almeno un tipo di dato da ripristinare.");
      return;
    }
    
    const confirmMessage = "ATTENZIONE: I dati correnti delle categorie selezionate verranno sovrascritti permanentemente con quelli del backup. \n\nVuoi procedere?";
    if (window.confirm(confirmMessage)) {
      setShowImportModal(false);
      try {
        const success = await db.importFullDatabase(importJsonText, selectedStores);
        if (success) {
          // Aggiorna l'UI direttamente senza reload della pagina.
          // Questo elimina tutte le race condition causate dal reload.
          if (onRestoreComplete) {
            await onRestoreComplete();
          }
          window.dispatchEvent(new CustomEvent('immoplan-db-restored', { detail: { stores: selectedStores } }));
          alert("Ripristino completato con successo! I dati sono stati aggiornati.");
        } else {
          alert("Si è verificato un errore durante l'importazione. Controlla il pannello Admin -> System Logs.");
        }
      } catch (e: any) {
        alert("Errore durante l'importazione: " + e.message);
      }
    }
  };

  const triggerImport = () => {
      if (fileInputRef.current) {
          fileInputRef.current.click();
      }
  };

  const isNeon = theme === 'NEON';

  return (
    <>
      {/* Top Horizontal Menu Bar for Desktop */}
      <div className={`ip-header-container ${isNeon ? '' : 'light'}`}>
        <style>{HEADER_CSS}</style>
        <header className="ip-header">
          {/* Logo only */}
          <div className="ip-logo-group">
            <div className="ip-logo">MM</div>
          </div>

          {/* Navigation Menu Tabs */}
          <nav className="ip-nav">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`ip-nav-btn ${activeTab === item.id ? 'active' : ''}`}
                title={item.label}
              >
                {item.icon ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span>{item.icon}</span>
                    <span className="tab-text">{item.label}</span>
                  </span>
                ) : (
                  <span className="tab-text">{item.label}</span>
                )}
              </button>
            ))}
          </nav>

          {/* Portal container for page-specific filters (e.g. GlobalDashboard) */}
          <div id="header-filters-portal" ref={portalRef} className="ip-portal-area"></div>

          {/* Action Buttons: Help, Notification, Sun (Theme Switch), Export/Import */}
          <div className="ip-actions-row">
            <button
              className={`ip-circle-btn ${activeTab === MainTab.HELP ? 'active ring-2 ring-brand-500' : ''}`}
              onClick={() => onTabChange(MainTab.HELP)}
              title="Guida & Manuali"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            </button>
            <button className="ip-circle-btn" title="Notifiche">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            </button>
            <button className="ip-circle-btn" onClick={onThemeToggle} title="Cambia Tema">
              {isNeon ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              )}
            </button>
            <button className="ip-circle-btn" onClick={handleGlobalExport} title="Backup JSON">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleGlobalImport} accept=".json" className="hidden" />
            <button className="ip-circle-btn" onClick={triggerImport} title="Ripristina DB">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            </button>
          </div>
        </header>
      </div>

      {/* Mobile Bottom Bar for small screens */}
      <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 z-50 px-2 py-2.5 flex justify-around items-center no-print shadow-lg">
         {menuItems.map(item => (
            <button 
              key={item.id} 
              onClick={() => onTabChange(item.id)} 
              className={`flex flex-col items-center gap-1 p-1 transition-all ${
                activeTab === item.id ? 'text-blue-500 dark:text-cyan-400 font-extrabold scale-105' : 'text-slate-400 font-medium'
              }`}
            >
               {item.icon && <span className="text-xs">{item.icon}</span>}
               <span className="text-[9px] uppercase tracking-wider font-bold">{item.mobileLabel || item.label}</span>
            </button>
         ))}
      </div>

      {/* Finestra Modale per il Ripristino Selettivo dei Dati */}
      {showImportModal && (
        <div className="ip-modal-overlay">
          <div className={`ip-modal-card ${isNeon ? '' : 'light'}`}>
            <div className="ip-modal-header">
              <h3>Ripristino Selettivo Backup</h3>
              <p className="ip-modal-subtitle">Seleziona quali categorie di dati desideri sovrascrivere dal file di backup. Le altre rimarranno intatte.</p>
            </div>
            
            <div className="ip-modal-body">
              <div className="ip-checkbox-list">
                {availableStores.map(store => {
                  const info = STORE_LABELS[store] || { label: store, desc: 'Dati di sistema' };
                  const isChecked = selectedStores.includes(store);
                  return (
                    <label key={store} className={`ip-checkbox-item ${isChecked ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setSelectedStores(prev =>
                            prev.includes(store) ? prev.filter(s => s !== store) : [...prev, store]
                          );
                        }}
                      />
                      <div className="ip-checkbox-content">
                        <span className="ip-checkbox-label">{info.label}</span>
                        <span className="ip-checkbox-desc">{info.desc}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            
            <div className="ip-modal-footer">
              <button className="ip-modal-btn cancel" onClick={() => setShowImportModal(false)}>Annulla</button>
              <button className="ip-modal-btn confirm" onClick={executeSelectiveImport} disabled={selectedStores.length === 0}>
                Ripristina Selezionati ({selectedStores.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const HEADER_CSS = `
.ip-header-container {
  --bg: #0a0e16;
  --border: rgba(255, 255, 255, 0.07);
  --text: #eaeff7;
  --dim: #8b97ab;
  --accent: #2f8fff;
  --accent-soft: rgba(47, 143, 255, 0.14);
  --panel-2: #151d2d;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 12px 20px;
  margin: 10px 14px 6px 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.20);
  font-family: 'Geist', 'DM Sans', sans-serif;
  box-sizing: border-box;
  transition: all 0.2s ease-in-out;
}

.ip-header-container.light {
  --bg: #ffffff;
  --border: rgba(15, 23, 42, 0.08);
  --text: #0c1424;
  --dim: #5a6679;
  --accent: #0a6cff;
  --accent-soft: rgba(10, 108, 255, 0.10);
  --panel-2: #f1f4f9;
  box-shadow: 0 6px 24px rgba(15, 23, 42, 0.06);
}

.ip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  max-width: 100%;
  margin: 0;
  flex-wrap: nowrap;
  min-height: 40px;
}

.ip-logo-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.ip-logo {
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, #2f8fff, #6f63ff);
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 800;
  font-size: 14.5px;
  box-shadow: 0 4px 12px rgba(47, 143, 255, 0.3);
  flex-shrink: 0;
}

.ip-title-area {
  display: none;
}

.ip-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.ip-nav-btn {
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  font-family: 'Geist', sans-serif;
  font-weight: 600;
  font-size: 13px;
  color: var(--dim);
  padding: 6px 11px;
  border-radius: 9px;
  transition: all 0.15s ease-in-out;
  white-space: nowrap;
}

.ip-nav-btn:hover {
  color: var(--text);
  background: rgba(150, 150, 150, 0.06);
}

.ip-nav-btn.active {
  background: var(--panel-2);
  border-color: var(--border);
  color: var(--text);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.ip-portal-area {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: clamp(8px, 1.5vw, 24px);
  flex-shrink: 1;
  min-width: 0;
}

.ip-actions-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  flex-shrink: 0;
}

.ip-circle-btn {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--dim);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  padding: 0;
  flex-shrink: 0;
}

.ip-circle-btn:hover {
  color: var(--text);
  border-color: var(--accent);
  box-shadow: 0 0 8px var(--accent-soft);
  transform: translateY(-1px);
}

.ip-circle-btn.active {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 0 10px var(--accent-soft);
}

@media (max-width: 1350px) {
  .ip-nav-btn {
    padding: 5px 8px;
    font-size: 12.5px;
  }
  .ip-nav {
    gap: 4px;
  }
  .ip-header {
    gap: 8px;
  }
  .ip-portal-area {
    margin-left: 8px;
    gap: 6px;
  }
}

@media (max-width: 1150px) {
  .ip-nav-btn span.tab-text {
    display: none;
  }
  .ip-nav-btn.active span.tab-text {
    display: inline;
  }
  .ip-nav-btn {
    padding: 5px 8px;
  }
}

@media (max-width: 950px) {
  .ip-header-container {
    margin: 8px 10px 4px 10px;
    padding: 8px 12px;
  }
  .ip-header {
    gap: 6px;
  }
  .ip-logo {
    width: 32px;
    height: 32px;
    font-size: 12px;
    border-radius: 8px;
  }
  .ip-circle-btn {
    width: 28px;
    height: 28px;
  }
}

@media (max-width: 768px) {
  .ip-header-container {
    display: none; /* Hidden on mobile, bottom bar is used */
  }
}

/* Stili Modale Ripristino Selettivo */
.ip-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(2, 6, 23, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeInModal 0.2s ease-out forwards;
}

@keyframes fadeInModal {
  from { opacity: 0; }
  to { opacity: 1; }
}

.ip-modal-card {
  --bg-modal: #0f172a;
  --border-modal: rgba(255, 255, 255, 0.08);
  --text-modal: #f8fafc;
  --desc-modal: #94a3b8;
  --item-bg: #1e293b;
  --item-hover: #334155;
  --item-active-border: #38bdf8;
  --item-active-bg: rgba(56, 189, 248, 0.08);
  --btn-cancel-bg: #1e293b;
  --btn-cancel-text: #94a3b8;
  --btn-confirm-bg: #0284c7;
  --btn-confirm-hover: #0369a1;

  background: var(--bg-modal);
  border: 1px solid var(--border-modal);
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
  font-family: 'Geist', sans-serif;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: scaleInModal 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.ip-modal-card.light {
  --bg-modal: #ffffff;
  --border-modal: rgba(15, 23, 42, 0.08);
  --text-modal: #0f172a;
  --desc-modal: #64748b;
  --item-bg: #f8fafc;
  --item-hover: #f1f5f9;
  --item-active-border: #0284c7;
  --item-active-bg: rgba(2, 132, 199, 0.06);
  --btn-cancel-bg: #f1f5f9;
  --btn-cancel-text: #64748b;
  --btn-confirm-bg: #0284c7;
  --btn-confirm-hover: #0369a1;
}

@keyframes scaleInModal {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.ip-modal-header {
  padding: 20px 24px 14px 24px;
  border-bottom: 1px solid var(--border-modal);
}

.ip-modal-header h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-modal);
}

.ip-modal-subtitle {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--desc-modal);
}

.ip-modal-body {
  padding: 16px 24px;
  max-height: 50vh;
  overflow-y: auto;
}

.ip-checkbox-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ip-checkbox-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--item-bg);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.1s ease-in-out;
  user-select: none;
}

.ip-checkbox-item:hover {
  background: var(--item-hover);
}

.ip-checkbox-item.active {
  border-color: var(--item-active-border);
  background: var(--item-active-bg);
}

.ip-checkbox-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--item-active-border);
  cursor: pointer;
  flex-shrink: 0;
}

.ip-checkbox-content {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ip-checkbox-label {
  font-weight: 600;
  font-size: 13.5px;
  color: var(--text-modal);
}

.ip-checkbox-desc {
  font-size: 11.5px;
  color: var(--desc-modal);
}

.ip-modal-footer {
  padding: 14px 24px 20px 24px;
  border-top: 1px solid var(--border-modal);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.ip-modal-btn {
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  border: none;
}

.ip-modal-btn.cancel {
  background: var(--btn-cancel-bg);
  color: var(--btn-cancel-text);
}

.ip-modal-btn.cancel:hover {
  filter: brightness(0.9);
}

.ip-modal-btn.confirm {
  background: var(--btn-confirm-bg);
  color: #ffffff;
  box-shadow: 0 4px 10px rgba(2, 132, 199, 0.25);
}

.ip-modal-btn.confirm:hover:not(:disabled) {
  background: var(--btn-confirm-hover);
}

.ip-modal-btn.confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

`;

export default Sidebar;
