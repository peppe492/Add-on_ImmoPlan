import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FinancialData, CostDetail, Scenario, RenovationItem, Attachment, Portfolio, CostAssignment, PaymentRecord } from '../types';
import { SmartAssignmentModal } from './SmartAssignmentModal';

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

const safeNum = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) || !isFinite(val) ? 0 : val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
    }
    return 0;
};

const readFile = (file: File): Promise<Attachment> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, data: reader.result as string, type: file.type });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- SUBCOMPONENTS ---

const FileUploader = ({ attachment, onUpload, onDelete }: { attachment?: Attachment, onUpload: (file: File) => void, onDelete: () => void }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
        {attachment ? (
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer group" title="Scarica/Vedi">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 inline mr-1"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span className="text-[10px] font-bold text-slate-600 truncate max-w-[120px]">{attachment.name}</span>
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-slate-400 hover:text-rose-500 font-bold ml-1 px-1">×</button>
            </div>
        ) : (
            <>
                <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="text-[10px] font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 bg-brand-50 px-3 py-2 rounded-lg border border-brand-100 transition-all hover:shadow-sm">
                    <span className="flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Allega File</span>
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={(e) => {
                        if (e.target.files?.[0]) {
                            onUpload(e.target.files[0]);
                            e.target.value = '';
                        }
                    }} 
                />
            </>
        )}
    </div>
  );
};

const PortfolioManager = ({ portfolios, onChange }: { portfolios: Portfolio[], onChange: (p: Portfolio[]) => void }) => {
  const addPortfolio = (owner: 'Giuseppe' | 'Claudia') => {
    const newP: Portfolio = { id: Date.now().toString(), name: `Nuovo Conto ${owner}`, owner, initialBalance: 0 };
    onChange([...portfolios, newP]);
  };

  const updatePortfolio = (id: string, updates: Partial<Portfolio>) => {
    onChange(portfolios.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePortfolio = (id: string) => {
    if(confirm("Eliminare questo portafoglio?")) onChange(portfolios.filter(p => p.id !== id));
  };

  return (
    <div className="bg-white p-4 lg:p-6 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
            <h4 className="text-lg font-bold text-slate-800">Liquidità Disponibile</h4>
            <p className="text-xs text-slate-400 font-medium">Gestisci i conti e i budget di partenza</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => addPortfolio('Giuseppe')} className="flex-1 sm:flex-none bg-brand-50 text-brand-700 px-3 py-2 rounded-xl text-xs font-bold hover:bg-brand-100 transition-colors flex items-center justify-center gap-1">
             <span className="w-4 h-4 rounded-full bg-brand-200 flex items-center justify-center text-[8px]">G</span> Aggiungi
          </button>
          <button onClick={() => addPortfolio('Claudia')} className="flex-1 sm:flex-none bg-rose-50 text-rose-700 px-3 py-2 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors flex items-center justify-center gap-1">
             <span className="w-4 h-4 rounded-full bg-rose-200 flex items-center justify-center text-[8px]">C</span> Aggiungi
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {portfolios.map(p => (
          <div key={p.id} className="relative group bg-slate-50 p-4 rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${p.owner === 'Giuseppe' ? 'bg-brand-100 text-brand-600' : 'bg-rose-100 text-rose-600'}`}>
                  {p.owner === 'Giuseppe' ? 'G' : 'C'}
                </div>
                <button onClick={() => deletePortfolio(p.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 lg:group-hover:opacity-100 transition-opacity p-2 -mr-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
            
            <input 
              type="text" 
              value={p.name} 
              onChange={e => updatePortfolio(p.id, { name: e.target.value })}
              className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-800 focus:ring-0 mb-1 placeholder-slate-400" 
              placeholder="Nome Conto"
            />
            
            <div className="flex items-center gap-1 bg-white rounded-lg px-2 py-1.5 border border-slate-200 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 transition-all">
                <span className="text-xs text-slate-400 font-bold">€</span>
                <input 
                  type="number" 
                  value={p.initialBalance || ''} 
                  onChange={e => updatePortfolio(p.id, { initialBalance: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-700 focus:ring-0" 
                  placeholder="0"
                />
            </div>
          </div>
        ))}
        {portfolios.length === 0 && (
            <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-medium">
                Nessun portafoglio configurato. Aggiungine uno per iniziare.
            </div>
        )}
      </div>
    </div>
  );
};

const AssignmentManager = ({ 
  amount, 
  assignments, 
  portfolios, 
  onUpdate,
  portfolioUsage
}: { 
  amount: number, 
  assignments: CostAssignment[], 
  portfolios: Portfolio[], 
  onUpdate: (a: CostAssignment[]) => void,
  portfolioUsage: Record<string, number>
}) => {
  const [showSmartModal, setShowSmartModal] = useState(false);
  const assignedTotal = assignments.reduce((acc, a) => acc + (a.amount || 0), 0);
  const diff = amount - assignedTotal;

  const updateAssignment = (index: number, updates: Partial<CostAssignment>) => {
    const next = [...assignments];
    next[index] = { ...next[index], ...updates };
    onUpdate(next);
  };

  const removeAssignment = (index: number) => {
    onUpdate(assignments.filter((_, i) => i !== index));
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="flex justify-between items-center mb-2">
             <div className="flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 inline mr-1.5"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pagamenti</label>
             </div>
             <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${Math.abs(diff) < 0.01 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {Math.abs(diff) < 0.01 ? '✓ Coperto' : `Mancano € ${diff.toLocaleString()}`}
             </span>
        </div>
        
        <div className="space-y-2">
          {assignments.map((asgn, i) => {
            const portfolio = portfolios.find(p => p.id === asgn.portfolioId);
            const totalUsed = portfolioUsage[asgn.portfolioId] || 0;
            const currentVal = asgn.amount || 0;
            const initial = portfolio?.initialBalance || 0;
            const availableReal = initial - (totalUsed - currentVal); 
            const isOverdraft = currentVal > availableReal + 0.01; 

            return (
              <div key={i} className={`flex items-center justify-between bg-slate-50 p-2 rounded-lg border ${isOverdraft ? 'border-rose-300' : 'border-slate-200'}`}>
                 <div className="flex items-center gap-2 flex-1 min-w-0">
                     <select 
                        value={asgn.portfolioId} 
                        onChange={e => updateAssignment(i, { portfolioId: e.target.value })}
                        className="bg-transparent border-none p-0 text-[10px] font-bold text-slate-700 focus:ring-0 truncate w-24"
                      >
                        {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {isOverdraft && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500 shrink-0 inline ml-1.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14a2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>}
                 </div>
                 <div className="flex items-center gap-2">
                     <input 
                        type="number" 
                        value={asgn.amount === 0 ? '' : asgn.amount} 
                        onChange={e => updateAssignment(i, { amount: parseFloat(e.target.value) || 0 })}
                        className="w-16 bg-white border border-slate-200 rounded px-1 py-1 text-[10px] font-bold text-right"
                      />
                      <input 
                        type="date" 
                        value={asgn.date} 
                        onChange={e => updateAssignment(i, { date: e.target.value })}
                        className="bg-transparent border-none p-0 text-[9px] text-slate-400 w-[80px] text-right" 
                      />
                      <button onClick={() => removeAssignment(i)} className="text-slate-400 hover:text-rose-500 px-1">×</button>
                 </div>
              </div>
            );
          })}
          
          <button 
            onClick={() => setShowSmartModal(true)} 
            className="w-full py-2.5 bg-white border border-dashed border-slate-300 text-slate-500 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-50 hover:border-slate-400 transition-all flex justify-center items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg> Gestisci Pagamenti
          </button>
        </div>

      <SmartAssignmentModal 
        isOpen={showSmartModal}
        onClose={() => setShowSmartModal(false)}
        totalCost={amount}
        currentAssignments={assignments}
        portfolios={portfolios}
        portfolioUsage={portfolioUsage}
        onConfirm={(newAssignments) => onUpdate(newAssignments)}
      />
    </div>
  );
};

const PayableCostInput = ({ 
  label, 
  cost, 
  portfolios, 
  onUpdate, 
  portfolioUsage,
  readOnlyAmount = false,
  onLabelChange
}: { 
  label: string, 
  cost: CostDetail, 
  portfolios: Portfolio[], 
  onUpdate: (updated: CostDetail) => void,
  portfolioUsage: Record<string, number>,
  readOnlyAmount?: boolean,
  onLabelChange?: (newLabel: string) => void
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localPaidInput, setLocalPaidInput] = useState(cost.paidAmount ? cost.paidAmount.toString() : '');

  useEffect(() => {
      const propVal = safeNum(cost.paidAmount);
      const localVal = parseFloat(localPaidInput) || 0;
      if (Math.abs(propVal - localVal) > 0.001) {
          setLocalPaidInput(propVal === 0 ? '' : propVal.toString());
      }
  }, [cost.paidAmount]);

  const handlePaidChange = (valStr: string) => {
      setLocalPaidInput(valStr);
      const val = parseFloat(valStr.replace(',', '.'));
      const safeVal = isNaN(val) ? 0 : val;
      const total = safeNum(cost.amount);
      
      onUpdate({
          ...cost,
          paidAmount: safeVal,
          isPaid: safeVal >= total && safeVal > 0,
          paymentDate: (safeVal > 0 && !cost.paymentDate) ? new Date().toISOString().split('T')[0] : cost.paymentDate,
          assignments: [] 
      });
  };

  const handleAssignmentUpdate = (newAssignments: CostAssignment[]) => {
      const newPaidTotal = newAssignments.reduce((sum, a) => sum + (a.amount || 0), 0);
      const total = safeNum(cost.amount);
      onUpdate({
          ...cost,
          assignments: newAssignments,
          paidAmount: newPaidTotal, 
          isPaid: newPaidTotal >= total && newPaidTotal > 0,
          paymentDate: newAssignments.length > 0 ? newAssignments[newAssignments.length - 1].date : cost.paymentDate
      });
  };

  const handleAttach = async (file: File) => {
    const att = await readFile(file);
    onUpdate({ ...cost, attachment: att });
  };

  const isPaid = safeNum(cost.paidAmount) >= safeNum(cost.amount) && safeNum(cost.amount) > 0;
  const isPartial = safeNum(cost.paidAmount) > 0 && !isPaid;
  const assignmentsTotal = (cost.assignments || []).reduce((acc, a) => acc + a.amount, 0);
  const isAssigned = Math.abs(assignmentsTotal - safeNum(cost.amount)) < 0.01 && safeNum(cost.amount) > 0;

  return (
    <div className={`rounded-2xl border transition-all duration-300 ${isOpen ? 'bg-white shadow-lg border-brand-200 ring-1 ring-brand-100' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}>
      
      <div 
        className="flex items-center gap-3 p-3 lg:p-4 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-colors ${isPaid ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : isPartial ? 'bg-amber-100 border-amber-200 text-amber-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
              {isPaid ? '✓' : isPartial ? '≈' : '€'}
          </div>

          <div className="flex-1 min-w-0 grid grid-cols-12 gap-2 items-center">
             <div className="col-span-7 md:col-span-5">
                 {onLabelChange ? (
                     <input 
                        type="text" 
                        value={label} 
                        onClick={e => e.stopPropagation()}
                        onChange={(e) => onLabelChange(e.target.value)} 
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0 truncate placeholder-slate-300" 
                        placeholder="Nome Spesa"
                     />
                 ) : (
                     <p className="text-sm font-bold text-slate-700 truncate">{label}</p>
                 )}
                 {!isOpen && (
                     <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                         {cost.paymentDate && <span className="flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 inline"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> {new Date(cost.paymentDate).toLocaleDateString()}</span>}
                         {cost.attachment && <span className="flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 inline"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> 1 All.</span>}
                     </div>
                 )}
             </div>

             <div className="col-span-5 md:col-span-3 text-right">
                  <span className="text-sm font-black text-slate-800">€ {safeNum(cost.amount).toLocaleString()}</span>
                  {!isOpen && isPartial && <p className="text-[9px] font-bold text-amber-500">Pagato: €{safeNum(cost.paidAmount).toLocaleString()}</p>}
             </div>

             <div className="hidden md:block col-span-3 text-right">
                 <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${isPaid ? 'bg-emerald-50 text-emerald-600' : isPartial ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                     {isPaid ? 'Saldato' : isPartial ? 'Parziale' : 'In Sospeso'}
                 </span>
             </div>
          </div>

          <div className={`text-slate-400 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`}>▼</div>
      </div>

      {isOpen && (
         <div className="px-3 pb-4 lg:px-4 animate-fade-in border-t border-slate-50 pt-3">
             <div className="flex flex-col gap-4">
                 
                 <div className="space-y-3">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Importo Totale</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    value={cost.amount === 0 ? '' : cost.amount}
                                    onChange={(e) => !readOnlyAmount && onUpdate({ ...cost, amount: parseFloat(e.target.value) || 0 })}
                                    readOnly={readOnlyAmount}
                                    className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none ${readOnlyAmount ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    placeholder="0"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">€</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <div className="flex-1">
                                 <label className="text-[9px] font-bold text-slate-400 uppercase">Già Pagato</label>
                                 <div className="relative">
                                     <input 
                                        type="text" 
                                        inputMode="decimal"
                                        value={localPaidInput}
                                        onChange={(e) => handlePaidChange(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none"
                                        placeholder="0"
                                     />
                                     <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">€</span>
                                 </div>
                             </div>
                             <div className="flex-1">
                                 <label className="text-[9px] font-bold text-slate-400 uppercase">Data</label>
                                 <input 
                                    type="date" 
                                    value={cost.paymentDate || ''}
                                    onChange={(e) => onUpdate({ ...cost, paymentDate: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-brand-500 outline-none"
                                 />
                             </div>
                        </div>
                     </div>

                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <FileUploader attachment={cost.attachment} onUpload={handleAttach} onDelete={() => onUpdate({...cost, attachment: undefined})} />
                     </div>
                 </div>

                 <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                     <AssignmentManager 
                        amount={cost.amount} 
                        assignments={cost.assignments || []} 
                        portfolios={portfolios} 
                        onUpdate={handleAssignmentUpdate} 
                        portfolioUsage={portfolioUsage}
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
  portfolios, 
  onBulkUpdate,
  portfolioUsage
}: { 
  title: string, 
  icon: React.ReactNode, 
  items: RenovationItem[], 
  portfolios: Portfolio[], 
  onBulkUpdate: (newItems: RenovationItem[], total: number) => void,
  portfolioUsage: Record<string, number>
}) => {
  const calculateTotal = (currItems: RenovationItem[]) => currItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);

  const addItem = () => {
    const newItems = [...items, { 
        id: Date.now().toString(), 
        description: 'Nuova Voce', 
        amount: 0, 
        isPaid: false, 
        assignments: [] 
    }];
    onBulkUpdate(newItems, calculateTotal(newItems));
  };

  const updateItem = (index: number, updates: Partial<RenovationItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    onBulkUpdate(newItems, calculateTotal(newItems));
  };

  const deleteItem = (index: number) => {
    if(confirm("Eliminare questa voce?")) {
        const newItems = items.filter((_, i) => i !== index);
        onBulkUpdate(newItems, calculateTotal(newItems));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2 px-1">
        <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <h4 className="font-bold text-slate-800">{title}</h4>
            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-bold">{items.length} voci</span>
        </div>
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
             <p className="text-[10px] font-bold text-slate-400 uppercase sm:mb-1">Subtotale</p>
             <p className="text-sm font-black text-slate-900 ml-2 sm:ml-0">€ {calculateTotal(items).toLocaleString()}</p>
        </div>
      </div>
      
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={item.id} className="relative group">
             <PayableCostInput 
                label={item.description} 
                cost={item} 
                portfolios={portfolios} 
                portfolioUsage={portfolioUsage}
                onUpdate={(updated) => updateItem(idx, updated)}
                onLabelChange={(newLabel) => updateItem(idx, { description: newLabel })}
             />
             <button 
                onClick={() => deleteItem(idx)}
                className="absolute top-4 right-10 md:right-14 text-slate-300 hover:text-rose-500 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity z-10 p-1"
                title="Elimina"
             >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
             </button>
          </div>
        ))}

        <button 
            onClick={addItem} 
            className="w-full py-3.5 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold text-xs uppercase hover:bg-slate-50 hover:border-brand-300 hover:text-brand-500 transition-all flex justify-center items-center gap-2"
        >
            <span>+</span> Aggiungi {title}
        </button>
      </div>
    </div>
  );
};

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
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'PURCHASE' | 'RENOVATION'>('GENERAL');
  
  const [newScenarioName, setNewScenarioName] = useState('');
  const [showScenarioMenu, setShowScenarioMenu] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  
  const activeScenario = useMemo(() => scenarios.find(s => s.id === activeScenarioId), [scenarios, activeScenarioId]);

  const { portfolioUsage, totalBudget, totalSpent } = useMemo(() => {
    const usage: Record<string, number> = {};
    const assignments: CostAssignment[] = [];
    let spent = 0;

    const agg = (c: any) => {
        assignments.push(...(c.assignments || []));
        spent += safeNum(c.paidAmount) || (c.isPaid ? safeNum(c.amount) : 0);
    };

    // Cast Object.values to any[] to ensure compatibility with 'agg' and avoid 'unknown' type issues
    (Object.values(data.purchaseCosts) as any[]).forEach(agg);
    (data.renovationCosts.worksBreakdown || []).forEach(agg);
    (data.renovationCosts.materialsBreakdown || []).forEach(agg);
    if (typeof data.renovationCosts.design === 'object') agg(data.renovationCosts.design);

    // Ensure numeric arithmetic on assignments map
    assignments.forEach(a => {
      const currentVal = usage[a.portfolioId] || 0;
      usage[a.portfolioId] = currentVal + safeNum(a.amount);
    });
    
    // Safely determine design amount handling object/number duality
    const designTotalVal = typeof data.renovationCosts.design === 'object' 
        ? safeNum(data.renovationCosts.design.amount) 
        : safeNum(data.renovationCosts.design);

    const grandTotal = safeNum(data.totalPrice) 
        + (Object.values(data.purchaseCosts) as any[]).reduce((acc: number, c: any) => acc + safeNum(c.amount), 0)
        - safeNum(data.purchaseCosts.deposit.amount) - safeNum(data.purchaseCosts.balance.amount)
        + safeNum(data.renovationCosts.works) + safeNum(data.renovationCosts.materials) + designTotalVal + safeNum(data.renovationCosts.contingency);

    return { portfolioUsage: usage, totalBudget: grandTotal, totalSpent: spent };
  }, [data]);

  const updatePurchaseCost = (key: string, val: CostDetail) => {
    onChange({
      ...data,
      purchaseCosts: { ...data.purchaseCosts, [key]: val }
    });
  };

  const handleDuplicateActive = () => {
    if (!activeScenario) return;
    const dupName = `${activeScenario.name} (Copia)`;
    onSaveScenario(dupName);
    setShowScenarioMenu(false);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-20">
      
      {/* 1. TOP BAR: Scenarios & Global Stats */}
      <div className="bg-white p-3 lg:p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4 sticky top-0 z-40">
          <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 text-slate-500"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></div>
                 <div className="relative">
                     {isRenaming ? (
                         <input 
                            autoFocus
                            type="text" 
                            value={renameVal} 
                            onChange={e => setRenameVal(e.target.value)}
                            onBlur={() => { if(activeScenario) onUpdateScenario(activeScenario.id, renameVal); setIsRenaming(false); }}
                            onKeyDown={e => { if(e.key==='Enter') { if(activeScenario) onUpdateScenario(activeScenario.id, renameVal); setIsRenaming(false); } }}
                            className="bg-slate-50 border border-brand-300 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 w-32 outline-none"
                         />
                     ) : (
                         <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scenario</span>
                            <div className="flex items-center gap-1 cursor-pointer group" onClick={() => setShowScenarioMenu(!showScenarioMenu)}>
                                <span className="font-bold text-slate-700 group-hover:text-brand-600 transition-colors truncate max-w-[120px]">
                                    {activeScenario ? activeScenario.name : 'Bozza Corrente'}
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0">▼</span>
                            </div>
                         </div>
                     )}
                     {showScenarioMenu && (
                         <div className="absolute top-12 left-0 w-72 bg-white shadow-xl rounded-xl border border-slate-100 p-2 z-50 animate-fade-in">
                             <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                 {scenarios.length === 0 ? (
                                     <p className="text-[10px] text-slate-400 p-4 text-center italic">Nessun scenario salvato</p>
                                 ) : scenarios.map(s => (
                                     <div key={s.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg group cursor-pointer" onClick={() => { onLoadScenario(s.id); setShowScenarioMenu(false); }}>
                                         <span className={`text-sm font-bold truncate flex-1 ${activeScenarioId === s.id ? 'text-brand-600' : 'text-slate-700'}`}>{s.name}</span>
                                         {activeScenarioId === s.id && <span className="text-emerald-500 font-bold text-xs mr-2">●</span>}
                                         <button onClick={(e) => { e.stopPropagation(); onDeleteScenario(s.id); }} className="text-slate-400 hover:text-rose-500 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Elimina"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                                     </div>
                                 ))}
                             </div>
                             
                             <div className="border-t border-slate-100 mt-2 pt-2 p-1">
                                 {activeScenario && (
                                     <div className="grid grid-cols-2 gap-2 mb-3">
                                         <button 
                                            onClick={() => { if(activeScenarioId) onUpdateScenarioData(activeScenarioId); setShowScenarioMenu(false); }}
                                            className="bg-brand-50 text-brand-600 text-[9px] font-black uppercase py-2 rounded-lg border border-brand-100 hover:bg-brand-100 transition-all flex items-center justify-center gap-1"
                                         >
                                             <span className="flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Aggiorna</span>
                                         </button>
                                         <button 
                                            onClick={handleDuplicateActive}
                                            className="bg-slate-50 text-slate-600 text-[9px] font-black uppercase py-2 rounded-lg border border-slate-100 hover:bg-slate-100 transition-all flex items-center justify-center gap-1.5"
                                         >
                                             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Duplica
                                         </button>
                                     </div>
                                 )}
                                 <div className="flex gap-1">
                                    <input type="text" placeholder="Nuovo nome..." value={newScenarioName} onChange={e => setNewScenarioName(e.target.value)} className="flex-1 bg-slate-50 border-none rounded-lg text-xs px-2 py-2 font-bold" />
                                    <button onClick={() => { if(newScenarioName) { onSaveScenario(newScenarioName); setNewScenarioName(''); } }} disabled={!newScenarioName} className="bg-brand-600 text-white rounded-lg px-3 font-bold text-xs hover:bg-brand-700 disabled:opacity-50">+</button>
                                 </div>
                             </div>
                         </div>
                     )}
                 </div>
              </div>
              <div className="flex items-center gap-4">
                  {activeScenario && (
                      <div className="hidden md:flex gap-2 mr-2">
                           <button 
                                onClick={() => { if(activeScenarioId) onUpdateScenarioData(activeScenarioId); }}
                                title="Aggiorna scenario corrente con i dati a video"
                                className="bg-emerald-50 text-emerald-600 p-2 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-all"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                            </button>
                      </div>
                  )}
                  <div className="text-right">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Totale</p>
                      <p className="text-sm font-black text-slate-800">€{totalBudget.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Speso</p>
                      <p className="text-sm font-black text-emerald-600">€{totalSpent.toLocaleString()}</p>
                  </div>
              </div>
          </div>
      </div>

      {/* 2. TAB NAVIGATION - Scrollable on mobile */}
      <div className="flex justify-center px-4">
          <div className="inline-flex bg-slate-200/60 p-1 rounded-2xl gap-1 overflow-x-auto scrollbar-hide w-full max-w-md">
              <button 
                onClick={() => setActiveTab('GENERAL')}
                className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 ${activeTab === 'GENERAL' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}
              >
                  <span className="flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg> Generale</span>
              </button>
              <button 
                onClick={() => setActiveTab('PURCHASE')}
                className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 ${activeTab === 'PURCHASE' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}
              >
                  <span className="flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/><path d="M12 18V6"/></svg> Acquisto</span>
              </button>
              <button 
                onClick={() => setActiveTab('RENOVATION')}
                className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 ${activeTab === 'RENOVATION' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}
              >
                  <span className="flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="m15 5 4 4"/><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67M9 11h.01"/></svg> Lavori</span>
              </button>
          </div>
      </div>

      {/* 3. CONTENT AREA */}
      <div className="animate-fade-in px-1">
          
          {activeTab === 'GENERAL' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500"><path d="M12 3a2.85 2.83 0 1 1 4 4L7.5 17.5 2 19l1.5-5.5Z"/></svg>
                          <div>
                              <h4 className="text-lg font-bold text-slate-800">Dati Progetto</h4>
                              <p className="text-xs text-slate-400 font-medium">Informazioni base immobile</p>
                          </div>
                      </div>
                      <div className="space-y-4">
                          <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Nome Immobile</label>
                              <input 
                                type="text" 
                                value={data.propertyName} 
                                onChange={e => onChange({...data, propertyName: e.target.value})} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 font-bold text-sm focus:ring-2 focus:ring-brand-500 outline-none" 
                                placeholder="Es. Via Roma 10"
                              />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Prezzo Acquisto</label>
                                  <div className="relative">
                                      <input 
                                        type="number" 
                                        value={data.totalPrice || ''} 
                                        onChange={e => onChange({...data, totalPrice: parseFloat(e.target.value) || 0})} 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 font-bold text-sm focus:ring-2 focus:ring-brand-500 outline-none" 
                                        placeholder="0"
                                      />
                                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">€</span>
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">% Mutuo</label>
                                  <div className="relative">
                                      <input 
                                        type="number" 
                                        value={data.loanPercentage || ''} 
                                        onChange={e => onChange({...data, loanPercentage: parseFloat(e.target.value) || 0})} 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 font-bold text-sm focus:ring-2 focus:ring-brand-500 outline-none" 
                                        placeholder="80"
                                      />
                                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">%</span>
                                  </div>
                              </div>
                          </div>
                          
                          <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex justify-between items-center">
                              <div>
                                  <p className="text-[10px] font-bold text-indigo-400 uppercase">Mutuo Stimato</p>
                                  <p className="text-xl font-black text-indigo-900">€ {(data.totalPrice * (data.loanPercentage / 100)).toLocaleString()}</p>
                              </div>
                              <div className="text-right">
                                  <p className="text-[10px] font-bold text-indigo-400 uppercase">Equity (Anticipo)</p>
                                  <p className="text-xl font-black text-indigo-600">€ {(data.totalPrice * (1 - data.loanPercentage / 100)).toLocaleString()}</p>
                              </div>
                          </div>
                      </div>
                  </div>

                  <PortfolioManager portfolios={data.portfolios} onChange={p => onChange({...data, portfolios: p})} />
              </div>
          )}

          {activeTab === 'PURCHASE' && (
              <div className="bg-white p-4 lg:p-8 rounded-[2rem] shadow-soft border border-slate-200">
                  <div className="flex items-center gap-3 mb-8 px-1">
                      <div className="bg-indigo-100 text-indigo-650 p-3 rounded-2xl flex items-center justify-center shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/><path d="M12 18V6"/></svg></div>
                      <div>
                          <h3 className="text-xl font-bold text-slate-800">Costi di Acquisto</h3>
                          <p className="text-sm text-slate-400 font-medium">Spese accessorie e tasse</p>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                      <PayableCostInput label="Anticipo / Caparra" cost={data.purchaseCosts.deposit} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('deposit', c)} />
                      <PayableCostInput label="Agenzia Immobiliare" cost={data.purchaseCosts.agency} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('agency', c)} />
                      <PayableCostInput label="Notaio" cost={data.purchaseCosts.notary} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('notary', c)} />
                      <PayableCostInput label="Imposte di Registro" cost={data.purchaseCosts.taxes} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('taxes', c)} />
                      <PayableCostInput label="Altre Spese" cost={data.purchaseCosts.other} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('other', c)} />
                      
                      <div className="mt-4 pt-4 border-t border-slate-100">
                           <PayableCostInput label="Saldo al Rogito (Contanti)" cost={data.purchaseCosts.balance} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('balance', c)} />
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'RENOVATION' && (
              <div className="space-y-6">
                  <div className="bg-white p-4 lg:p-8 rounded-[2rem] shadow-soft border border-slate-200">
                      <div className="flex items-center gap-3 mb-8 px-1">
                          <div className="bg-amber-100 text-amber-700 p-3 rounded-2xl flex items-center justify-center shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="m15 5 4 4"/><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67M9 11h.01"/></svg></div>
                          <div>
                              <h3 className="text-xl font-bold text-slate-800">Ristrutturazione</h3>
                              <p className="text-sm text-slate-400 font-medium">Lavori, materiali e tecnici</p>
                          </div>
                      </div>
                      
                      <div className="space-y-8">
                          <CostBreakdown 
                              title="Lavori & Impianti" 
                              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M3 22V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v17"/><path d="M2 22h20"/><path d="M13 22V9a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v13"/></svg>} 
                              items={data.renovationCosts.worksBreakdown || []} 
                              portfolios={data.portfolios}
                              portfolioUsage={portfolioUsage}
                              onBulkUpdate={(items, total) => onChange({...data, renovationCosts: {...data.renovationCosts, worksBreakdown: items, works: total}})}
                          />

                          <hr className="border-slate-100" />

                          <CostBreakdown 
                              title="Materiali & Finiture" 
                              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg>} 
                              items={data.renovationCosts.materialsBreakdown || []} 
                              portfolios={data.portfolios}
                              portfolioUsage={portfolioUsage}
                              onBulkUpdate={(items, total) => onChange({...data, renovationCosts: {...data.renovationCosts, materialsBreakdown: items, materials: total}})}
                          />
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                           <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 inline"><path d="M21.3 15.3a2.82 2.82 0 0 1 0 4c-1 1-2.5 1-3.5 0L2.8 4.3a2.82 2.82 0 0 1 0-4c1-1 2.5-1 3.5 0Z"/><path d="m5.6 2.8 1.4 1.4"/><path d="m8.4 5.6 1.4 1.4"/><path d="m11.2 8.4 1.4 1.4"/><path d="m14 11.2 1.4 1.4"/><path d="m16.8 14 1.4 1.4"/></svg> Tecnici & Design</h4>
                           <PayableCostInput 
                                label="Parcelle Totali" 
                                cost={typeof data.renovationCosts.design === 'object' ? data.renovationCosts.design : { amount: data.renovationCosts.design as number, isPaid: false, assignments: [] }} 
                                portfolios={data.portfolios} 
                                portfolioUsage={portfolioUsage}
                                onUpdate={c => onChange({...data, renovationCosts: { ...data.renovationCosts, design: c }})} 
                           />
                      </div>

                      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                           <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 inline"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Riserva Imprevisti</h4>
                           <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                               <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Budget di Riserva</label>
                               <div className="relative">
                                   <input 
                                       type="number" 
                                       value={data.renovationCosts.contingency || ''} 
                                       onChange={e => onChange({...data, renovationCosts: { ...data.renovationCosts, contingency: parseFloat(e.target.value) || 0 }})}
                                       className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 font-bold text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                       placeholder="0"
                                   />
                                   <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">€</span>
                               </div>
                           </div>
                      </div>
                  </div>
              </div>
          )}

      </div>
    </div>
  );
};