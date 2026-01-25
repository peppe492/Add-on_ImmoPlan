
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

const FileUploader = ({ attachment, onUpload, onDelete }: { attachment?: Attachment, onUpload: (file: File) => void, onDelete: () => void }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
        {attachment ? (
            <div className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                <span className="text-[9px] font-bold text-slate-600 truncate max-w-[100px]" title={attachment.name}>{attachment.name}</span>
                <button onClick={onDelete} className="text-rose-500 hover:text-rose-700 font-bold">×</button>
            </div>
        ) : (
            <button onClick={() => fileInputRef.current?.click()} className="text-[9px] font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                📎 Allega
            </button>
        )}
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
    </div>
  );
};

const PortfolioManager = ({ portfolios, onChange }: { portfolios: Portfolio[], onChange: (p: Portfolio[]) => void }) => {
  const addPortfolio = (owner: 'Giuseppe' | 'Claudia') => {
    const newP: Portfolio = { id: Date.now().toString(), name: `Nuovo Portafoglio ${owner}`, owner, initialBalance: 0 };
    onChange([...portfolios, newP]);
  };

  const updatePortfolio = (id: string, updates: Partial<Portfolio>) => {
    onChange(portfolios.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePortfolio = (id: string) => {
    onChange(portfolios.filter(p => p.id !== id));
  };

  return (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Liquidità e Portafogli</h4>
        <div className="flex gap-2">
          <button onClick={() => addPortfolio('Giuseppe')} className="bg-brand-100 text-brand-700 px-2 py-1 rounded-lg text-[9px] font-bold hover:bg-brand-200 transition-colors">+ G.</button>
          <button onClick={() => addPortfolio('Claudia')} className="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[9px] font-bold hover:bg-rose-200 transition-colors">+ C.</button>
        </div>
      </div>
      <div className="space-y-2">
        {portfolios.map(p => (
          <div key={p.id} className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 group">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] shrink-0 font-bold ${p.owner === 'Giuseppe' ? 'bg-brand-50 text-brand-600' : 'bg-rose-50 text-rose-600'}`}>
              {p.owner === 'Giuseppe' ? 'G' : 'C'}
            </div>
            <div className="flex-1 min-w-0">
              <input 
                type="text" 
                value={p.name} 
                onChange={e => updatePortfolio(p.id, { name: e.target.value })}
                className="w-full bg-transparent border-0 p-0 text-[10px] font-bold text-slate-800 focus:ring-0" 
              />
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-slate-400">Saldo: €</span>
                <input 
                  type="number" 
                  value={p.initialBalance || ''} 
                  onChange={e => updatePortfolio(p.id, { initialBalance: parseFloat(e.target.value) || 0 })}
                  className="w-20 bg-transparent border-0 p-0 text-[10px] font-black text-slate-600 focus:ring-0" 
                />
              </div>
            </div>
            <button onClick={() => deletePortfolio(p.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        ))}
        {portfolios.length === 0 && <p className="text-[10px] text-slate-400 italic text-center">Nessun portafoglio definito.</p>}
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
    <>
      <div className="mt-4 p-3 bg-slate-100/50 rounded-2xl border border-slate-200">
        <div className="flex justify-between items-center mb-3">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Assegnazione Portafogli</label>
          <span className={`text-[10px] font-black uppercase ${Math.abs(diff) < 0.01 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {Math.abs(diff) < 0.01 ? '✓ Coperto' : `Mancano: € ${diff.toLocaleString()}`}
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
              <div key={i} className={`flex flex-col bg-white p-2 rounded-xl border ${isOverdraft ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}>
                {/* Row 1: Controls */}
                <div className="flex gap-2 items-center w-full">
                  <select 
                    value={asgn.portfolioId} 
                    onChange={e => updateAssignment(i, { portfolioId: e.target.value })}
                    className="flex-1 min-w-0 bg-transparent border-0 p-0 text-[10px] font-bold text-slate-700 focus:ring-0 outline-none truncate"
                  >
                    {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  
                  <div className="flex items-center gap-1 shrink-0">
                      <input 
                        type="number" 
                        value={asgn.amount === 0 ? '' : asgn.amount} 
                        onChange={e => updateAssignment(i, { amount: parseFloat(e.target.value) || 0 })}
                        className={`w-14 bg-slate-50 border-0 rounded-lg p-1 text-[10px] font-black text-right focus:ring-0 ${isOverdraft ? 'text-rose-600 ring-1 ring-rose-300' : 'text-slate-900'}`}
                        placeholder="€"
                      />
                      <input 
                        type="date" 
                        value={asgn.date} 
                        onChange={e => updateAssignment(i, { date: e.target.value })}
                        className="bg-transparent border-0 p-0 text-[9px] font-bold text-slate-500 focus:ring-0 w-[85px] text-right" 
                      />
                      <button onClick={() => removeAssignment(i)} className="text-slate-300 hover:text-rose-500 ml-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                  </div>
                </div>
                
                {/* Row 2: Status */}
                <div className="flex justify-between items-center mt-1.5 px-0.5 border-t border-slate-50 pt-1">
                  <span className={`text-[9px] font-bold ${isOverdraft ? 'text-rose-500' : 'text-slate-400'}`}>
                    {isOverdraft ? '⚠️ Fondi Insufficienti!' : 'Disp. residua:'}
                  </span>
                  <span className={`text-[9px] font-bold ${isOverdraft ? 'text-rose-500' : 'text-emerald-600'}`}>
                    € {(availableReal - currentVal).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            );
          })}
          
          <button 
            onClick={() => setShowSmartModal(true)} 
            className="w-full py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl text-[10px] font-bold uppercase hover:shadow-lg hover:scale-[1.01] transition-all flex justify-center items-center gap-2"
          >
            <span>✨</span> Smart Split (Assegna Rapido)
          </button>
        </div>
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
    </>
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
  // Init dello stato "sbloccato" se c'è già un valore versato o se è saldato
  const [isUnlocked, setIsUnlocked] = useState(() => (safeNum(cost.paidAmount) > 0 || cost.isPaid));
  const [showAddPopover, setShowAddPopover] = useState(false);
  const [addAmountVal, setAddAmountVal] = useState('');
  const [addDateVal, setAddDateVal] = useState(new Date().toISOString().split('T')[0]);
  
  // Stato locale per gestire l'input testuale (permette decimali tipo "100.")
  const [localPaidInput, setLocalPaidInput] = useState(cost.paidAmount ? cost.paidAmount.toString() : '');

  // Sincronizza stato locale se arriva un update esterno
  useEffect(() => {
      const propVal = safeNum(cost.paidAmount);
      const localVal = parseFloat(localPaidInput) || 0;
      if (Math.abs(propVal - localVal) > 0.001) {
          setLocalPaidInput(propVal === 0 ? '' : propVal.toString());
      }
      if (propVal > 0 || cost.isPaid) setIsUnlocked(true);
  }, [cost.paidAmount, cost.isPaid]);

  const handleAttach = async (file: File) => {
    const att = await readFile(file);
    onUpdate({ ...cost, attachment: att });
  };

  const handleStatusToggle = () => {
    if (!isUnlocked) {
        setIsUnlocked(true);
        return;
    }

    const currentPaid = safeNum(cost.paidAmount);
    const totalAmount = safeNum(cost.amount);
    
    const isFull = currentPaid >= totalAmount && totalAmount > 0;
    
    if (!isFull) {
        onUpdate({
            ...cost,
            isPaid: true,
            paidAmount: totalAmount,
            paymentDate: cost.paymentDate || new Date().toISOString().split('T')[0]
        });
    } else {
        onUpdate({
            ...cost,
            isPaid: false,
            paidAmount: 0,
            paymentDate: '',
            payments: [] // Reset payments history on clear
        });
    }
  };

  const handleAddPaymentEntry = () => {
    const val = parseFloat(addAmountVal.replace(',', '.'));
    if (!isNaN(val) && val > 0) {
        const newRecord: PaymentRecord = {
            id: Date.now().toString(),
            amount: val,
            date: addDateVal || new Date().toISOString().split('T')[0]
        };
        
        // Use existing history or create first record if legacy data
        let currentPayments = cost.payments ? [...cost.payments] : [];
        
        // If legacy data (paidAmount > 0 but no payments list), migrate it
        if (currentPayments.length === 0 && safeNum(cost.paidAmount) > 0) {
            currentPayments.push({
                id: 'legacy',
                amount: safeNum(cost.paidAmount),
                date: cost.paymentDate || new Date().toISOString().split('T')[0]
            });
        }

        currentPayments.push(newRecord);
        
        // Recalculate total
        const newTotal = currentPayments.reduce((acc, p) => acc + p.amount, 0);
        const maxDate = currentPayments.reduce((max, p) => p.date > max ? p.date : max, currentPayments[0].date);
        const totalCostVal = safeNum(cost.amount);

        onUpdate({
            ...cost,
            payments: currentPayments,
            paidAmount: newTotal,
            isPaid: newTotal >= totalCostVal,
            paymentDate: maxDate
        });
    }
    setAddAmountVal('');
    setAddDateVal(new Date().toISOString().split('T')[0]);
  };

  const handleDeletePaymentEntry = (id: string) => {
      if (!cost.payments) return;
      const updatedPayments = cost.payments.filter(p => p.id !== id);
      const newTotal = updatedPayments.reduce((acc, p) => acc + p.amount, 0);
      
      // Determine new date (if any payments left)
      let newDate = '';
      if (updatedPayments.length > 0) {
          newDate = updatedPayments.reduce((max, p) => p.date > max ? p.date : max, updatedPayments[0].date);
      }

      onUpdate({
          ...cost,
          payments: updatedPayments,
          paidAmount: newTotal,
          isPaid: newTotal >= safeNum(cost.amount) && safeNum(cost.amount) > 0,
          paymentDate: newDate
      });
  };

  // Override manuale: se l'utente scrive nell'input principale, resetta la lista e usa il valore come unico "Manuale"
  const handlePaidAmountChange = (valStr: string) => {
      setLocalPaidInput(valStr);
      const val = parseFloat(valStr.replace(',', '.'));
      const safeVal = isNaN(val) ? 0 : val;
      const total = safeNum(cost.amount);
      
      onUpdate({
          ...cost,
          paidAmount: safeVal,
          isPaid: safeVal >= total && safeVal > 0,
          paymentDate: (safeVal > 0 && !cost.paymentDate) ? new Date().toISOString().split('T')[0] : cost.paymentDate,
          payments: [] // Clear detailed history on manual override to ensure consistency
      });
  };

  const isPartial = safeNum(cost.paidAmount) > 0 && safeNum(cost.paidAmount) < safeNum(cost.amount);
  const isFull = safeNum(cost.paidAmount) >= safeNum(cost.amount) && safeNum(cost.amount) > 0;
  
  const statusLabel = isFull ? 'Saldato' : (isPartial ? 'Parziale' : 'In attesa');
  const statusColorClass = isFull ? 'bg-emerald-500' : (isPartial ? 'bg-amber-500' : 'bg-slate-300');
  const statusTextColorClass = isFull ? 'text-emerald-600' : (isPartial ? 'text-amber-600' : 'text-slate-400');

  const remaining = Math.max(0, (cost.amount || 0) - (cost.paidAmount || 0));

  // Determine current history list for display
  const displayPayments = cost.payments && cost.payments.length > 0 
      ? cost.payments 
      : (safeNum(cost.paidAmount) > 0 
          ? [{id: 'legacy', amount: safeNum(cost.paidAmount), date: cost.paymentDate || 'N/D'}] 
          : []);

  return (
    <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200 group transition-all hover:border-brand-200 relative">
      <div className="flex justify-between items-center mb-4">
        {onLabelChange ? (
            <input 
                type="text" 
                value={label} 
                onChange={(e) => onLabelChange(e.target.value)}
                placeholder="Descrizione..."
                className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-500 outline-none text-[10px] font-bold text-slate-500 uppercase tracking-widest w-2/3"
            />
        ) : (
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</label>
        )}
        <div className="flex items-center gap-2">
            <span className={`text-[9px] font-black uppercase transition-colors ${statusTextColorClass}`}>
                {statusLabel}
            </span>
            <button 
              type="button"
              onClick={handleStatusToggle}
              className={`w-10 h-5 rounded-full transition-all relative ${statusColorClass}`}
              title={isUnlocked ? "Clicca per saldare/resettare" : "Clicca per abilitare inserimento"}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${isFull ? 'left-5.5' : (isPartial ? 'left-3' : 'left-0.5')}`}></div>
            </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-3 relative z-0">
        <div className="relative">
          <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1 ml-1">Importo Totale</label>
          <input 
            type="number"
            value={cost.amount === 0 ? '' : cost.amount}
            onChange={(e) => !readOnlyAmount && onUpdate({ ...cost, amount: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            readOnly={readOnlyAmount}
            className={`w-full bg-white border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500 rounded-xl px-3 py-2.5 text-sm font-bold shadow-sm ${readOnlyAmount ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
          />
          <span className="absolute right-3 top-9 text-slate-400 font-medium text-[10px]">€</span>
        </div>
        <div className="relative">
          <div className="flex justify-between items-center mb-1 ml-1 relative">
              <label className="block text-[8px] font-bold text-slate-400 uppercase">Versato</label>
              {isUnlocked && (
                <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowAddPopover(!showAddPopover); }}
                    className={`text-[7px] px-1.5 py-0.5 rounded font-bold uppercase transition-colors relative z-20 ${showAddPopover ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-600 hover:bg-brand-200'}`}
                >
                    + Agg.
                </button>
              )}
              
              {/* Custom Add Popover List */}
              {showAddPopover && (
                  <div className="absolute right-0 top-6 z-50 bg-white shadow-2xl border border-slate-200 p-3 rounded-xl flex flex-col gap-2 w-64 animate-fade-in ring-4 ring-slate-100" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-1">
                          <p className="text-[9px] font-bold text-slate-500 uppercase">Storico Versamenti</p>
                          <button onClick={() => setShowAddPopover(false)} className="text-slate-400 hover:text-rose-500 font-bold">×</button>
                      </div>
                      
                      {/* List */}
                      <div className="max-h-32 overflow-y-auto space-y-1.5 mb-1 custom-scrollbar pr-1">
                          {displayPayments.map((p, idx) => (
                              <div key={p.id || idx} className="flex justify-between items-center bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100 group/item">
                                  <div>
                                      <div className="text-xs font-bold text-emerald-600">€ {p.amount.toLocaleString()}</div>
                                      <div className="text-[9px] text-slate-400 font-mono">{p.date}</div>
                                  </div>
                                  {/* Delete button only if not legacy auto-generated or if we allow deleting everything */}
                                  <button onClick={() => handleDeletePaymentEntry(p.id)} className="text-slate-300 hover:text-rose-500 font-bold text-xs px-1">×</button>
                              </div>
                          ))}
                          {displayPayments.length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-2">Nessun versamento registrato</p>}
                      </div>

                      {/* Add Form */}
                      <div className="pt-2 border-t border-slate-100 bg-slate-50/50 -mx-3 -mb-3 p-3 rounded-b-xl">
                          <div className="flex gap-2 mb-2">
                              <input 
                                autoFocus
                                type="number" 
                                value={addAmountVal} 
                                onChange={e => setAddAmountVal(e.target.value)} 
                                className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-brand-500"
                                placeholder="€"
                                onKeyDown={e => e.key === 'Enter' && handleAddPaymentEntry()}
                              />
                              <input 
                                type="date" 
                                value={addDateVal} 
                                onChange={e => setAddDateVal(e.target.value)} 
                                className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600 focus:ring-1 focus:ring-brand-500"
                              />
                          </div>
                          <button onClick={handleAddPaymentEntry} className="w-full bg-brand-600 text-white py-1.5 rounded-lg text-[9px] font-bold uppercase hover:bg-brand-700 shadow-sm transition-all active:scale-95">
                              Aggiungi Versamento
                          </button>
                      </div>
                  </div>
              )}
          </div>
          <input 
            type="text"
            inputMode="decimal"
            value={localPaidInput}
            onChange={(e) => handlePaidAmountChange(e.target.value)}
            placeholder="0"
            disabled={!isUnlocked}
            className={`w-full border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 rounded-xl px-3 py-2.5 text-sm font-bold shadow-sm transition-opacity ${!isUnlocked ? 'bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed' : 'bg-white text-slate-900'}`}
          />
          <span className={`absolute right-3 top-9 font-medium text-[10px] ${!isUnlocked ? 'text-slate-300' : 'text-emerald-500'}`}>€</span>
        </div>
      </div>

      <div className="flex gap-2 items-center mb-4">
          <div className="flex-1">
              <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1 ml-1">Data Saldo/Versamento</label>
              <input 
                type="date" 
                value={cost.paymentDate || ''}
                onChange={(e) => onUpdate({ ...cost, paymentDate: e.target.value })}
                disabled={!isUnlocked}
                className={`w-full border-0 ring-1 ring-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold transition-opacity ${!isUnlocked ? 'bg-slate-100 text-slate-300 opacity-50 cursor-not-allowed' : 'bg-slate-50 text-slate-600'}`}
              />
          </div>
          {remaining > 0 && isUnlocked && (
              <div className="bg-rose-50 px-2 py-2 rounded-xl border border-rose-100 text-center shrink-0 min-w-[70px]">
                  <p className="text-[7px] font-bold text-rose-400 uppercase">Residuo</p>
                  <p className="text-[10px] font-black text-rose-600">€ {remaining.toLocaleString()}</p>
              </div>
          )}
      </div>

      <AssignmentManager 
        amount={cost.amount} 
        assignments={cost.assignments || []} 
        portfolios={portfolios} 
        onUpdate={(a) => onUpdate({ ...cost, assignments: a })} 
        portfolioUsage={portfolioUsage}
      />

      <div className="mt-3 flex justify-between items-center">
         <FileUploader 
            attachment={cost.attachment} 
            onUpload={handleAttach} 
            onDelete={() => onUpdate({ ...cost, attachment: undefined })} 
          />
      </div>
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
    const newItems = items.filter((_, i) => i !== index);
    onBulkUpdate(newItems, calculateTotal(newItems));
  };

  return (
    <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm bg-white">
      <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</label>
        </div>
        <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 shadow-sm">
          € {calculateTotal(items).toLocaleString()}
        </div>
      </div>
      
      <div className="p-6 space-y-4">
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
                className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
             >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
             </button>
          </div>
        ))}

        <button 
            onClick={addItem} 
            className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold text-xs uppercase hover:bg-slate-50 hover:border-brand-300 hover:text-brand-500 transition-all"
        >
            + Aggiungi Voce
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
  const [newScenarioName, setNewScenarioName] = useState('');
  const [showScenarioMenu, setShowScenarioMenu] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  
  // Stati per la rinomina
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  
  const activeScenario = useMemo(() => scenarios.find(s => s.id === activeScenarioId), [scenarios, activeScenarioId]);

  const { portfolioUsage } = useMemo(() => {
    const usage: Record<string, number> = {};
    const assignments: CostAssignment[] = [];
    Object.values(data.purchaseCosts).forEach((c: any) => assignments.push(...(c.assignments || [])));
    (data.renovationCosts.worksBreakdown || []).forEach(w => assignments.push(...(w.assignments || [])));
    (data.renovationCosts.materialsBreakdown || []).forEach(m => assignments.push(...(m.assignments || [])));
    if (typeof data.renovationCosts.design === 'object') {
      assignments.push(...(data.renovationCosts.design.assignments || []));
    }
    assignments.forEach(a => {
      usage[a.portfolioId] = (usage[a.portfolioId] || 0) + safeNum(a.amount);
    });
    return { portfolioUsage: usage };
  }, [data]);

  const updatePurchaseCost = (key: string, val: CostDetail) => {
    onChange({
      ...data,
      purchaseCosts: { ...data.purchaseCosts, [key]: val }
    });
  };

  const handleExportScenarios = () => {
    const json = JSON.stringify(scenarios, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `scenarios_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target?.result as string);
        if (Array.isArray(imported)) {
          onImportScenarios(imported);
        }
      } catch (err) { alert("Errore importazione file"); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleStartRenaming = () => {
      if (activeScenario) {
          setRenameVal(activeScenario.name);
          setIsRenaming(true);
      }
  };

  const handleConfirmRename = () => {
      if (activeScenario && renameVal.trim()) {
          onUpdateScenario(activeScenario.id, renameVal);
          setIsRenaming(false);
      } else {
          setIsRenaming(false);
      }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-20">
      
      {/* SCENARIO BAR */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-3 items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2">
             <span className="text-xl">💾</span>
             <div className="relative">
                 {isRenaming ? (
                     <div className="flex items-center gap-1">
                         <input 
                            autoFocus
                            type="text" 
                            value={renameVal} 
                            onChange={e => setRenameVal(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleConfirmRename()}
                            onBlur={handleConfirmRename}
                            className="bg-slate-50 border border-brand-300 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 w-48 outline-none focus:ring-2 focus:ring-brand-200"
                         />
                         <button onClick={handleConfirmRename} className="text-emerald-500 hover:text-emerald-700">✓</button>
                         <button onClick={() => setIsRenaming(false)} className="text-rose-500 hover:text-rose-700">✕</button>
                     </div>
                 ) : (
                     <div className="flex items-center gap-2">
                         <button onClick={() => setShowScenarioMenu(!showScenarioMenu)} className="font-bold text-slate-700 hover:text-brand-600 flex items-center gap-1 text-base">
                            {activeScenario ? activeScenario.name : 'Scenario Corrente'}
                            <span className="text-[10px] ml-1 opacity-50">▼</span>
                         </button>
                         {activeScenario && (
                             <button onClick={handleStartRenaming} className="text-slate-400 hover:text-brand-500" title="Rinomina scenario">
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                             </button>
                         )}
                     </div>
                 )}
                 
                 {showScenarioMenu && (
                     <div className="absolute top-10 left-0 w-72 bg-white shadow-xl rounded-xl border border-slate-100 p-2 z-50 animate-fade-in">
                         {scenarios.length === 0 && <p className="text-[10px] text-slate-400 p-2 italic">Nessuno scenario salvato</p>}
                         {scenarios.map(s => (
                             <div key={s.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg group cursor-pointer" onClick={() => { onLoadScenario(s.id); setShowScenarioMenu(false); }}>
                                 <div className="flex-1 min-w-0">
                                     <div className="text-sm font-bold text-slate-700 truncate">{s.name}</div>
                                     <div className="text-[9px] text-slate-400">{s.date}</div>
                                 </div>
                                 {activeScenarioId === s.id && <span className="text-emerald-500 font-bold mr-2">✓</span>}
                                 <button onClick={(e) => { e.stopPropagation(); onDeleteScenario(s.id); }} className="text-slate-300 hover:text-rose-500 px-2 py-1 rounded hover:bg-rose-50 font-bold">🗑️</button>
                             </div>
                         ))}
                         <div className="border-t border-slate-100 mt-2 pt-2 flex gap-2">
                             <button onClick={handleExportScenarios} className="flex-1 bg-slate-50 text-slate-600 text-[9px] font-bold py-2 rounded-lg uppercase hover:bg-slate-100 flex items-center justify-center gap-1">📥 Esporta</button>
                             <button onClick={() => importInputRef.current?.click()} className="flex-1 bg-slate-50 text-slate-600 text-[9px] font-bold py-2 rounded-lg uppercase hover:bg-slate-100 flex items-center justify-center gap-1">📤 Importa</button>
                             <input type="file" ref={importInputRef} onChange={handleImportFile} className="hidden" accept=".json" />
                         </div>
                     </div>
                 )}
             </div>
          </div>

          <div className="flex items-center gap-2">
              {activeScenarioId && (
                  <button 
                    onClick={() => {
                        if(window.confirm(`Vuoi sovrascrivere lo scenario "${activeScenario?.name}" con i dati attuali?`)) {
                            onUpdateScenarioData(activeScenarioId);
                        }
                    }} 
                    className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl text-xs font-bold border border-amber-200 hover:bg-amber-200 transition-all flex items-center gap-2 shadow-sm"
                    title="Salva modifiche su scenario attuale"
                  >
                      💾 Sovrascrivi
                  </button>
              )}
              
              <div className="h-6 w-px bg-slate-200 mx-1"></div>

              <input 
                 type="text" 
                 placeholder="Salva come nuovo..." 
                 value={newScenarioName}
                 onChange={e => setNewScenarioName(e.target.value)}
                 className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold w-40 outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button 
                 onClick={() => { if(newScenarioName) { onSaveScenario(newScenarioName); setNewScenarioName(''); } }}
                 disabled={!newScenarioName}
                 className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-brand-600 disabled:opacity-50 transition-all"
              >
                  Salva Copia
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN: Main Info & Portfolios */}
          <div className="space-y-6">
              <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-4">Dati Principali</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">Nome Progetto</label>
                          <input 
                            type="text" 
                            value={data.propertyName} 
                            onChange={e => onChange({...data, propertyName: e.target.value})} 
                            className="w-full bg-slate-50 border-0 rounded-xl px-4 py-3 font-bold text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500" 
                          />
                      </div>
                      <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">Prezzo Immobile</label>
                          <div className="relative">
                            <input 
                                type="number" 
                                value={data.totalPrice || ''} 
                                onChange={e => onChange({...data, totalPrice: parseFloat(e.target.value) || 0})} 
                                className="w-full bg-slate-50 border-0 rounded-xl px-4 py-3 font-bold text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500" 
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">€</span>
                          </div>
                      </div>
                      <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">% Mutuo</label>
                          <div className="relative">
                              <input 
                                type="number" 
                                value={data.loanPercentage || ''} 
                                onChange={e => onChange({...data, loanPercentage: parseFloat(e.target.value) || 0})} 
                                className="w-full bg-slate-50 border-0 rounded-xl px-4 py-3 font-bold text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500" 
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                          </div>
                      </div>
                  </div>
              </div>

              <PortfolioManager portfolios={data.portfolios} onChange={p => onChange({...data, portfolios: p})} />
          </div>

          {/* MIDDLE & RIGHT: Costs */}
          <div className="lg:col-span-2 space-y-6">
              
              {/* PURCHASE COSTS */}
              <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="bg-indigo-100 text-indigo-600 p-1 rounded-lg text-sm">💰</span> Costi Acquisto
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <PayableCostInput label="Anticipo / Caparra" cost={data.purchaseCosts.deposit} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('deposit', c)} />
                      <PayableCostInput label="Agenzia" cost={data.purchaseCosts.agency} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('agency', c)} />
                      <PayableCostInput label="Notaio" cost={data.purchaseCosts.notary} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('notary', c)} />
                      <PayableCostInput label="Imposte" cost={data.purchaseCosts.taxes} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('taxes', c)} />
                      <PayableCostInput label="Altre Spese" cost={data.purchaseCosts.other} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('other', c)} />
                      <PayableCostInput label="Saldo Rogito (Equity)" cost={data.purchaseCosts.balance} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('balance', c)} />
                  </div>
              </div>

              {/* RENOVATION COSTS */}
              <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-8 flex items-center gap-2">
                      <span className="bg-amber-100 text-amber-600 p-1 rounded-lg text-sm">🔨</span> Ristrutturazione
                  </h3>
                  
                  <div className="space-y-8">
                      {/* Works */}
                      <CostBreakdown 
                          title="Lavori Edili" 
                          icon="🏗️" 
                          items={data.renovationCosts.worksBreakdown || []} 
                          portfolios={data.portfolios}
                          portfolioUsage={portfolioUsage}
                          onBulkUpdate={(items, total) => onChange({...data, renovationCosts: {...data.renovationCosts, worksBreakdown: items, works: total}})}
                      />

                      {/* Materials */}
                      <CostBreakdown 
                          title="Materiali" 
                          icon="📦" 
                          items={data.renovationCosts.materialsBreakdown || []} 
                          portfolios={data.portfolios}
                          portfolioUsage={portfolioUsage}
                          onBulkUpdate={(items, total) => onChange({...data, renovationCosts: {...data.renovationCosts, materialsBreakdown: items, materials: total}})}
                      />

                      {/* Design & Contingency */}
                      <div className="pt-4 border-t border-slate-100">
                           <PayableCostInput 
                                label="Progetto / Tecnici" 
                                cost={typeof data.renovationCosts.design === 'object' ? data.renovationCosts.design : { amount: data.renovationCosts.design as number, isPaid: false, assignments: [] }} 
                                portfolios={data.portfolios} 
                                portfolioUsage={portfolioUsage}
                                onUpdate={c => onChange({...data, renovationCosts: { ...data.renovationCosts, design: c }})} 
                           />
                      </div>
                      
                      <div className="pt-2">
                           <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200">
                               <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 block">Imprevisti (Budget)</label>
                               <div className="relative">
                                   <input 
                                       type="number" 
                                       value={data.renovationCosts.contingency || ''} 
                                       onChange={e => onChange({...data, renovationCosts: { ...data.renovationCosts, contingency: parseFloat(e.target.value) || 0 }})}
                                       className="w-full bg-white border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500 rounded-xl px-3 py-2.5 text-sm font-bold shadow-sm"
                                   />
                                   <span className="absolute right-3 top-2.5 text-slate-400 font-medium text-[10px]">€</span>
                               </div>
                           </div>
                      </div>
                  </div>
              </div>

          </div>
      </div>
    </div>
  );
};
