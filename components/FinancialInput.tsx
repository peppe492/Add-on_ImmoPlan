
import React, { useState, useRef, useEffect } from 'react';
import { FinancialData, CostDetail, Scenario, RenovationItem, Attachment } from '../types';

interface Props {
  data: FinancialData;
  onChange: (newData: FinancialData) => void;
  scenarios: Scenario[];
  activeScenarioId: string | null;
  onSaveScenario: (name: string) => void;
  onLoadScenario: (id: string) => void;
  onDeleteScenario: (id: string) => void;
  onUpdateScenario: (id: string, newName: string) => void;
  onUpdateScenarioData: (id: string) => void;
  onImportScenarios: (scenarios: Scenario[]) => void;
}

// Helper per leggere file
const readFile = (file: File): Promise<Attachment> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
       resolve({
         name: file.name,
         data: reader.result as string,
         type: file.type
       });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper parser CSV robusto
const parseCSVLine = (text: string) => {
    const result: string[] = [];
    let start = 0;
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '"') {
            inQuotes = !inQuotes;
        } else if (text[i] === ',' && !inQuotes) {
            let field = text.substring(start, i);
            if (field.startsWith('"') && field.endsWith('"')) {
                field = field.slice(1, -1).replace(/""/g, '"');
            }
            result.push(field);
            start = i + 1;
        }
    }
    let field = text.substring(start);
    if (field.startsWith('"') && field.endsWith('"')) {
        field = field.slice(1, -1).replace(/""/g, '"');
    }
    result.push(field);
    return result;
};

const FileUploader = ({ attachment, onUpload, onDelete }: { attachment?: Attachment, onUpload: (file: File) => void, onDelete: () => void }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onUpload(e.target.files[0]);
    }
  };

  if (attachment) {
    return (
      <div className="flex items-center gap-2 mt-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 w-fit animate-fade-in">
        <span className="text-[10px] text-slate-500 font-bold truncate max-w-[100px]">{attachment.name}</span>
        <a 
          href={attachment.data} 
          download={attachment.name} 
          className="text-[10px] font-black text-brand-600 hover:underline uppercase"
        >
          Apri
        </a>
        <button onClick={onDelete} className="text-slate-400 hover:text-rose-500 transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    );
  }

  return (
    <>
      <input type="file" ref={inputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
      <button 
        type="button" 
        onClick={() => inputRef.current?.click()}
        className="text-slate-400 hover:text-brand-600 transition-colors p-1"
        title="Allega fattura o ricevuta"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
      </button>
    </>
  );
};

const PayableCostInput = ({ label, cost, onUpdate }: { label: string, cost: CostDetail, onUpdate: (updated: CostDetail) => void }) => {
  const handleAttach = async (file: File) => {
    const att = await readFile(file);
    onUpdate({ ...cost, attachment: att });
  };

  // Safe numbers
  const total = cost.amount || 0;
  const paid = cost.paidAmount !== undefined ? cost.paidAmount : (cost.isPaid ? total : 0);
  const percent = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  const isPartial = paid > 0 && paid < total;

  const handleTogglePaid = () => {
      const newState = !cost.isPaid;
      onUpdate({ 
          ...cost, 
          isPaid: newState,
          paidAmount: newState ? total : 0 // Auto-fill or clear
      });
  };

  const handlePaidAmountChange = (val: number) => {
      onUpdate({
          ...cost,
          paidAmount: val,
          isPaid: val >= total && total > 0 // Auto-check if full paid
      });
  };

  return (
    <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200 group transition-all hover:border-brand-200 relative overflow-hidden">
      {/* Progress Bar Background */}
      {paid > 0 && (
          <div className="absolute bottom-0 left-0 h-1 bg-emerald-500/20 transition-all duration-500" style={{ width: `${percent}%` }}></div>
      )}

      <div className="flex justify-between items-center mb-4">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</label>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold uppercase transition-colors ${cost.isPaid ? 'text-emerald-600' : isPartial ? 'text-amber-600' : 'text-slate-400'}`}>
            {cost.isPaid ? 'Saldato' : isPartial ? 'Parziale' : 'In attesa'}
          </span>
          <button 
            type="button"
            onClick={handleTogglePaid}
            className={`w-10 h-5 rounded-full transition-all relative ${cost.isPaid ? 'bg-emerald-500' : isPartial ? 'bg-amber-400' : 'bg-slate-300'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${cost.isPaid ? 'left-5.5' : 'left-0.5'}`}></div>
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Campo Totale */}
        <div>
            <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1 ml-1">Preventivo</label>
            <div className="relative">
              <input 
                type="number"
                value={cost.amount === 0 ? '' : cost.amount}
                onChange={(e) => onUpdate({ ...cost, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-full bg-white border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500 rounded-xl px-3 py-3 text-sm font-bold shadow-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-xs">€</span>
            </div>
        </div>

        {/* Campo Versato */}
        <div>
            <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1 ml-1">Versato</label>
            <div className="relative">
              <input 
                type="number"
                value={paid === 0 && !cost.isPaid ? '' : paid}
                onChange={(e) => handlePaidAmountChange(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className={`w-full border-0 ring-1 focus:ring-2 rounded-xl px-3 py-3 text-sm font-bold shadow-sm transition-colors ${cost.isPaid ? 'bg-emerald-50 ring-emerald-200 text-emerald-700 focus:ring-emerald-500' : 'bg-white ring-slate-200 focus:ring-brand-500'}`}
              />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 font-medium text-xs ${cost.isPaid ? 'text-emerald-500' : 'text-slate-400'}`}>€</span>
            </div>
        </div>
      </div>

      {(cost.isPaid || isPartial) && (
          <div className="animate-fade-in mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
                <div className="flex-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Data Pagamento</label>
                    <input 
                      type="date"
                      value={cost.paymentDate}
                      onChange={(e) => onUpdate({ ...cost, paymentDate: e.target.value })}
                      className="w-full bg-white border-0 p-0 text-xs font-bold text-slate-600 focus:ring-0"
                    />
                </div>
                <div className="shrink-0 pt-3">
                    <FileUploader 
                      attachment={cost.attachment} 
                      onUpload={handleAttach} 
                      onDelete={() => onUpdate({ ...cost, attachment: undefined })} 
                    />
                </div>
            </div>
          </div>
      )}
    </div>
  );
};

const CostBreakdown = ({ 
  title, 
  icon, 
  items = [], 
  onBulkUpdate,
  customTotal
}: { 
  title: string, 
  icon: string, 
  items: RenovationItem[], 
  onBulkUpdate: (newItems: RenovationItem[], total: number) => void,
  customTotal?: React.ReactNode 
}) => {
  const calculateTotal = (currItems: RenovationItem[]) => currItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);

  const addItem = () => {
    const newItems = [...items, { 
      id: Date.now().toString(), 
      description: '', 
      amount: 0, 
      isPaid: false, 
      paymentDate: new Date().toISOString().split('T')[0] 
    }];
    onBulkUpdate(newItems, calculateTotal(newItems));
  };

  const updateItem = (id: string, updates: Partial<RenovationItem>) => {
    const newItems = items.map(item => item.id === id ? { ...item, ...updates } : item);
    onBulkUpdate(newItems, calculateTotal(newItems));
  };

  const deleteItem = (id: string) => {
    const newItems = items.filter(i => i.id !== id);
    onBulkUpdate(newItems, calculateTotal(newItems));
  };

  const handleAttachItem = async (id: string, file: File) => {
    const att = await readFile(file);
    updateItem(id, { attachment: att });
  };
  
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50/50">
      <div className="bg-slate-100/50 px-5 py-4 border-b border-slate-200 flex justify-between items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
             <span className="text-base shrink-0">{icon}</span>
             <label className="text-xs font-bold text-slate-500 uppercase tracking-wider leading-tight break-words">{title}</label>
        </div>
        <div className="shrink-0">
             {customTotal ? customTotal : (
              <div className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-sm font-bold text-slate-800">
                € {calculateTotal(items).toLocaleString()}
              </div>
            )}
        </div>
      </div>
      <div className="p-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm transition-all hover:border-brand-200 group">
            <div className="flex gap-2 items-center">
              <input 
                type="text" 
                placeholder="Descrizione (es. Acconto)" 
                value={item.description}
                onChange={(e) => updateItem(item.id, { description: e.target.value })}
                className="flex-1 bg-slate-50 border-0 ring-1 ring-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none transition-all font-medium"
              />
              <input 
                type="number" 
                placeholder="0" 
                value={item.amount === 0 ? '' : item.amount}
                onChange={(e) => updateItem(item.id, { amount: parseFloat(e.target.value) || 0 })}
                className="w-24 bg-slate-50 border-0 ring-1 ring-slate-100 rounded-lg px-3 py-2 text-sm text-right font-bold focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
              />
              <button type="button" onClick={() => deleteItem(item.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            {/* Tracking Pagamenti & Allegati */}
            <div className="mt-2 pt-2 border-t border-slate-50 flex flex-wrap items-center gap-3">
              <button 
                type="button"
                onClick={() => updateItem(item.id, { isPaid: !item.isPaid })}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${item.isPaid ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200' : 'bg-slate-50 text-slate-400 ring-1 ring-slate-200 hover:bg-slate-100'}`}
              >
                <div className={`w-2 h-2 rounded-full ${item.isPaid ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                {item.isPaid ? 'Saldato' : 'Da Saldare'}
              </button>

              {item.isPaid && (
                <div className="flex items-center gap-2 animate-fade-in flex-1">
                   <span className="text-[9px] text-slate-400 font-bold uppercase">Data:</span>
                   <input 
                    type="date"
                    value={item.paymentDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => updateItem(item.id, { paymentDate: e.target.value })}
                    className="bg-transparent border-0 p-0 text-[10px] font-bold text-slate-600 focus:ring-0 max-w-[80px]"
                   />
                   <div className="ml-auto">
                     <FileUploader 
                        attachment={item.attachment} 
                        onUpload={(f) => handleAttachItem(item.id, f)} 
                        onDelete={() => updateItem(item.id, { attachment: undefined })} 
                     />
                   </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <button type="button" onClick={addItem} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold hover:bg-white hover:border-brand-300 transition-all uppercase tracking-tight flex items-center justify-center gap-2">
          <span>+</span> Aggiungi Acconto/Rata
        </button>
      </div>
    </div>
  );
};

const ModernInput = ({ label, value, onChange, placeholder = "0", type = "number", suffix = "€" }: any) => (
  <div>
    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">{label}</label>
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-slate-50 text-slate-900 font-bold border-0 rounded-2xl px-4 py-4 ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all shadow-sm"
      />
      {type === 'number' && <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{suffix}</div>}
    </div>
  </div>
);

export const FinancialInput: React.FC<Props> = ({ 
  data, 
  onChange, 
  scenarios, 
  activeScenarioId,
  onSaveScenario, 
  onLoadScenario, 
  onDeleteScenario,
  onUpdateScenario,
  onUpdateScenarioData,
  onImportScenarios
}) => {
  const [scenarioName, setScenarioName] = useState('');
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
  const [editingScenarioName, setEditingScenarioName] = useState('');
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SAVING'>('IDLE');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSyncStatus('SAVING');
    const timer = setTimeout(() => setSyncStatus('IDLE'), 600);
    return () => clearTimeout(timer);
  }, [data]);

  const handleRootChange = (field: keyof FinancialData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const handleRenovationChange = (field: string, value: any) => {
    onChange({
      ...data,
      renovationCosts: { ...data.renovationCosts, [field]: value }
    });
  };
  
  const handleDesignUpdate = (updated: CostDetail) => {
    onChange({
        ...data,
        renovationCosts: { ...data.renovationCosts, design: updated }
    });
  };

  const handleBreakdownUpdate = (type: 'works' | 'materials', newItems: RenovationItem[], total: number) => {
    const breakdownField = type === 'works' ? 'worksBreakdown' : 'materialsBreakdown';
    onChange({
      ...data,
      renovationCosts: {
        ...data.renovationCosts,
        [breakdownField]: newItems,
        [type]: total
      }
    });
  };

  const handlePropertyPaymentsUpdate = (newItems: RenovationItem[]) => {
      onChange({
          ...data,
          propertyPayments: newItems
      });
  };

  const handlePurchaseUpdate = (field: keyof typeof data.purchaseCosts, updated: CostDetail) => {
    onChange({
      ...data,
      purchaseCosts: { ...data.purchaseCosts, [field]: updated }
    });
  };

  const onSaveClick = () => {
    if (!scenarioName.trim()) {
      alert("Inserisci un nome per lo scenario.");
      return;
    }
    onSaveScenario(scenarioName);
    setScenarioName('');
  };

  const startRename = (e: React.MouseEvent, scenario: Scenario) => {
    e.stopPropagation();
    setEditingScenarioId(scenario.id);
    setEditingScenarioName(scenario.name);
  };

  const submitRename = (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
    e.stopPropagation();
    if (editingScenarioName.trim()) {
      onUpdateScenario(id, editingScenarioName);
    }
    setEditingScenarioId(null);
  };

  const handleUpdateData = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Sei sicuro? Questa azione sovrascriverà TUTTI i dati salvati in questo scenario con quelli che vedi attualmente a video.")) {
      onUpdateScenarioData(id);
      setEditingScenarioId(null);
    }
  };

  // --- CSV Export Logic ---
  const handleExportCSV = () => {
    if (scenarios.length === 0) {
      alert("Nessuno scenario salvato da esportare.");
      return;
    }

    const header = `"ID","Nome","Data","Prezzo_Immobile","Dati_Completi_JSON"`;
    const rows = scenarios.map(s => {
      // Escape quote: " -> ""
      const jsonString = JSON.stringify(s.data).replace(/"/g, '""');
      const safeId = s.id.replace(/"/g, '""');
      const safeName = s.name.replace(/"/g, '""');
      const safeDate = s.date.replace(/"/g, '""');
      
      return `"${safeId}","${safeName}","${safeDate}","${s.data.totalPrice}","${jsonString}"`;
    });

    const csvContent = [header, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `immoplan_scenarios_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- CSV Import Logic ---
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
      // Skip header
      const dataLines = lines[0].startsWith('"ID"') ? lines.slice(1) : lines;
      
      const newScenarios: Scenario[] = [];
      let successCount = 0;
      let errorCount = 0;

      dataLines.forEach(line => {
        try {
            const cols = parseCSVLine(line);
            if (cols.length >= 5) {
                // cols[0]=id, [1]=name, [2]=date, [3]=price, [4]=json
                const jsonString = cols[4];
                const parsedData = JSON.parse(jsonString);
                const newId = `IMP-${Date.now()}-${Math.floor(Math.random()*100000)}`;

                newScenarios.push({
                    id: newId,
                    name: cols[1] + " (Import)",
                    date: cols[2],
                    data: parsedData
                });
                successCount++;
            } else {
                errorCount++;
            }
        } catch (err) {
            console.error("Errore parsing riga:", line, err);
            errorCount++;
        }
      });

      if (successCount > 0) {
        onImportScenarios(newScenarios);
        alert(`Importati con successo ${successCount} scenari.${errorCount > 0 ? ` (${errorCount} errori)` : ''}`);
      } else {
        alert("Nessuno scenario valido trovato nel file.");
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // Calculations for Property Payments
  const totalPaidProperty = (data.propertyPayments || []).reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
  const remainingProperty = Math.max(0, data.totalPrice - totalPaidProperty);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
      <div className="lg:col-span-4 space-y-8 no-print">
        {/* Pannello Stato Progetto */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 text-xl">🏠</div>
              <h3 className="text-xl font-bold text-slate-900">Nuovi Dati</h3>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${syncStatus === 'SAVING' ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'SAVING' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                <span className={`text-[8px] font-black uppercase tracking-tighter ${syncStatus === 'SAVING' ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {syncStatus === 'SAVING' ? 'Scrittura...' : 'Pronto'}
                </span>
            </div>
          </div>

          <div className="space-y-6">
            <ModernInput label="Nome Progetto" type="text" value={data.propertyName} onChange={(e: any) => handleRootChange('propertyName', e.target.value)} suffix="" />
            <div className="grid grid-cols-2 gap-4">
              <ModernInput label="Prezzo Immobile" value={data.totalPrice || ''} onChange={(e: any) => handleRootChange('totalPrice', parseFloat(e.target.value) || 0)} />
              <ModernInput label="Budget Max" value={data.totalBudget || ''} onChange={(e: any) => handleRootChange('totalBudget', parseFloat(e.target.value) || 0)} />
            </div>

            {/* SEZIONE PAGAMENTI PREZZO (Nuova) */}
            <div className="bg-slate-50/50 rounded-2xl border border-slate-200/60 p-1">
                <CostBreakdown 
                    title="Piano Pagamenti Prezzo" 
                    icon="💸" 
                    items={data.propertyPayments || []} 
                    onBulkUpdate={(items) => handlePropertyPaymentsUpdate(items)}
                    customTotal={
                        <div className="text-right">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block whitespace-nowrap">Residuo al Rogito</span>
                            <span className={`text-xs font-black ${remainingProperty > 0 ? 'text-slate-800' : 'text-emerald-600'}`}>€ {remainingProperty.toLocaleString()}</span>
                        </div>
                    }
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ModernInput label="% Mutuo" value={data.loanPercentage || ''} onChange={(e: any) => handleRootChange('loanPercentage', parseFloat(e.target.value) || 0)} suffix="%" />
              <div className="flex flex-col justify-end pb-1 px-1">
                 <p className="text-[8px] font-black text-slate-400 uppercase">Valore Mutuo</p>
                 <p className="text-xs font-black text-slate-900">€ {(data.totalPrice * (data.loanPercentage / 100)).toLocaleString()}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ModernInput label="Liquidità G." value={data.liquidityGiuseppe || ''} onChange={(e: any) => handleRootChange('liquidityGiuseppe', parseFloat(e.target.value) || 0)} />
              <ModernInput label="Liquidità C." value={data.liquidityClaudia || ''} onChange={(e: any) => handleRootChange('liquidityClaudia', parseFloat(e.target.value) || 0)} />
            </div>
            
            <div className="pt-4 border-t border-slate-50">
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner">
                  <label className="block text-[10px] font-bold text-brand-600 uppercase mb-3">Salva come nuova versione</label>
                  <div className="flex gap-2">
                    <input type="text" value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} placeholder="Esempio: Versione A" className="flex-1 bg-white border-0 rounded-xl px-4 py-3 text-xs font-bold outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500 shadow-sm" />
                    <button onClick={onSaveClick} className="bg-brand-600 text-white px-5 py-3 rounded-xl text-xs font-black hover:bg-brand-700 transition-all uppercase">Salva</button>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Lista Versioni Salvate */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100">
           <div className="flex items-center justify-between mb-6 px-1">
              <h3 className="text-lg font-bold text-slate-800">Scenari nel Database</h3>
              <div className="flex items-center gap-2">
                 <input 
                   type="file" 
                   accept=".csv" 
                   ref={fileInputRef} 
                   onChange={handleImportCSV} 
                   className="hidden" 
                 />
                 <button 
                   onClick={() => fileInputRef.current?.click()} 
                   className="text-[10px] font-black uppercase text-brand-600 hover:bg-brand-50 px-2 py-1 rounded-lg transition-colors border border-brand-100"
                   title="Importa CSV"
                 >
                   📥 Importa
                 </button>
                 <button 
                   onClick={handleExportCSV} 
                   className="text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-200"
                   title="Esporta CSV"
                 >
                   📤 Export
                 </button>
                 <span className="bg-brand-100 text-brand-600 text-[10px] font-black px-2 py-0.5 rounded-full">{scenarios.length}</span>
              </div>
           </div>
           
           <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
              {scenarios.map(s => {
                const isEditing = editingScenarioId === s.id;
                
                // Ricalcolo in tempo reale basato sullo snapshot dello scenario
                const sPrice = Number(s.data.totalPrice) || 0;
                // Fix backward compatibility for design
                const sDesign = typeof s.data.renovationCosts.design === 'object' ? (s.data.renovationCosts.design.amount || 0) : (s.data.renovationCosts.design || 0);
                const sPurchase = (Object.values(s.data.purchaseCosts) as CostDetail[]).reduce((acc: number, cost: CostDetail) => acc + (Number(cost.amount) || 0), 0);
                const sRenov = (Number(s.data.renovationCosts.works) || 0) + 
                               (Number(s.data.renovationCosts.materials) || 0) +
                               sDesign + 
                               (Number(s.data.renovationCosts.contingency) || 0);
                const sTotal = sPrice + sPurchase + sRenov;

                return (
                  <div 
                    key={s.id} 
                    className={`group p-5 rounded-[2rem] border transition-all flex flex-col relative cursor-pointer ${isEditing ? 'border-brand-500 bg-white ring-4 ring-brand-50 shadow-xl z-20' : activeScenarioId === s.id ? 'bg-brand-50/50 border-brand-300 shadow-sm ring-1 ring-brand-200' : 'bg-slate-50 border-slate-100 hover:border-brand-200'}`}
                    onClick={() => !isEditing && onLoadScenario(s.id)}
                  >
                     {activeScenarioId === s.id && !isEditing && (
                       <div className="absolute -top-3 right-6 bg-brand-600 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-lg z-30 tracking-widest">Visualizzato</div>
                     )}

                     <div className="flex justify-between items-start">
                       <div className="flex-1 min-w-0 pr-2">
                         {isEditing ? (
                            <input 
                              type="text"
                              value={editingScenarioName}
                              onChange={(e) => setEditingScenarioName(e.target.value)}
                              className="w-full bg-white border border-brand-200 rounded-xl px-3 py-2 text-sm font-bold outline-none mb-3"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                         ) : (
                           <div className="mb-2">
                            <p className="text-sm font-black text-slate-800 truncate">{s.name}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 leading-none">{s.date}</p>
                           </div>
                         )}
                         
                         <div className="flex gap-5 mt-2">
                            <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">Valore Casa</p>
                                <p className="text-xs font-black text-slate-600">€ {sPrice.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">Budget Totale</p>
                                <p className="text-xs font-black text-brand-600">€ {sTotal.toLocaleString()}</p>
                            </div>
                         </div>
                       </div>
                       
                       {!isEditing && (
                        <div className="flex gap-1 shrink-0">
                            <button onClick={(e) => startRename(e, s)} className="p-2 text-slate-400 hover:text-brand-600 transition-colors" title="Rinomina">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onDeleteScenario(s.id); }} className="p-2 text-rose-300 hover:text-rose-600 transition-colors" title="Elimina">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                       )}
                     </div>

                     {isEditing && (
                       <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                          <button onClick={(e) => handleUpdateData(e, s.id)} className="w-full bg-slate-900 text-white py-3 rounded-xl text-[9px] font-black uppercase hover:bg-brand-600 shadow-md transition-all active:scale-95 tracking-widest">
                             🚀 Sovrascrivi con Dati Visualizzati
                          </button>
                          <div className="flex gap-2">
                             <button onClick={(e) => submitRename(e, s.id)} className="flex-1 py-2 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-xl">Ok Nome</button>
                             <button onClick={(e) => { e.stopPropagation(); setEditingScenarioId(null); }} className="flex-1 py-2 bg-slate-200 text-slate-500 text-[9px] font-black uppercase rounded-xl">Chiudi</button>
                          </div>
                       </div>
                     )}
                  </div>
                );
              })}
           </div>
        </div>
      </div>

      <div className="lg:col-span-8 space-y-8">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-xl">💰</div>
            <h3 className="text-xl font-bold text-slate-900">Spese d'Acquisto</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PayableCostInput label="Notaio" cost={data.purchaseCosts.notary} onUpdate={(val) => handlePurchaseUpdate('notary', val)} />
            <PayableCostInput label="Agenzia" cost={data.purchaseCosts.agency} onUpdate={(val) => handlePurchaseUpdate('agency', val)} />
            <PayableCostInput label="Imposte" cost={data.purchaseCosts.taxes} onUpdate={(val) => handlePurchaseUpdate('taxes', val)} />
            <PayableCostInput label="Altro" cost={data.purchaseCosts.other} onUpdate={(val) => handlePurchaseUpdate('other', val)} />
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 text-xl">🔨</div>
            <h3 className="text-xl font-bold text-slate-900">Ristrutturazione</h3>
          </div>
          <div className="space-y-8">
            <CostBreakdown 
              title="Lavori Edili"
              icon="🏗️"
              items={data.renovationCosts.worksBreakdown || []} 
              onBulkUpdate={(items, total) => handleBreakdownUpdate('works', items, total)}
            />
            <CostBreakdown 
              title="Materiali"
              icon="📦"
              items={data.renovationCosts.materialsBreakdown || []} 
              onBulkUpdate={(items, total) => handleBreakdownUpdate('materials', items, total)}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
               <PayableCostInput 
                 label="Progetto / Tecnici" 
                 cost={typeof data.renovationCosts.design === 'object' ? data.renovationCosts.design : { amount: data.renovationCosts.design, isPaid: false, paymentDate: '' }} 
                 onUpdate={(val) => handleDesignUpdate(val)} 
               />
               <ModernInput label="Buffer Imprevisti" value={data.renovationCosts.contingency || ''} onChange={(e: any) => handleRenovationChange('contingency', parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
