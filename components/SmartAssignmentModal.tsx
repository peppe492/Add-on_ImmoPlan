
import React, { useState, useEffect } from 'react';
import { Portfolio, CostAssignment } from '../types';

interface SmartModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalCost: number;
  currentAssignments: CostAssignment[];
  portfolios: Portfolio[];
  portfolioUsage: Record<string, number>; // Usage globale (incluso l'item corrente)
  onConfirm: (newAssignments: CostAssignment[]) => void;
}

export const SmartAssignmentModal: React.FC<SmartModalProps> = ({ isOpen, onClose, totalCost, currentAssignments, portfolios, portfolioUsage, onConfirm }) => {
  const [draftAssignments, setDraftAssignments] = useState<Record<string, number>>({});

  // Inizializza lo stato locale quando si apre il modale
  useEffect(() => {
    if (isOpen) {
      const initialMap: Record<string, number> = {};
      currentAssignments.forEach(a => {
        initialMap[a.portfolioId] = a.amount;
      });
      setDraftAssignments(initialMap);
    }
  }, [isOpen, currentAssignments]);

  if (!isOpen) return null;

  // Fixed: Cast Object.values to number[] to fix 'unknown' type errors in arithmetic operations
  // Calcola quanto è già assegnato in questo draft
  const assignedSum = (Object.values(draftAssignments) as number[]).reduce((acc: number, v: number) => acc + v, 0);
  const remainingToPay = Math.max(0, totalCost - assignedSum);
  const isFullyCovered = Math.abs(totalCost - assignedSum) < 0.01;
  const isOverAssigned = assignedSum > totalCost + 0.01;

  const handleTogglePortfolio = (portfolioId: string, availableLiquidity: number) => {
    setDraftAssignments(prev => {
      const next = { ...prev };
      if (next[portfolioId] !== undefined) {
        // Se già presente, rimuovi (deselect)
        delete next[portfolioId];
      } else {
        // Se non presente, aggiungi (select)
        // Fixed: Cast Object.values to number[] to fix 'unknown' type error
        // Calcola quanto manca ancora da coprire basandosi sullo stato PRECEDENTE (prev)
        const currentAssigned = (Object.values(prev) as number[]).reduce((acc: number, v: number) => acc + v, 0);
        const needed = Math.max(0, totalCost - currentAssigned);
        
        // Assegna il minimo tra quanto serve e quanto ha il portafoglio
        const toAssign = Math.min(needed, availableLiquidity);
        
        // Se available è 0 o needed è 0, mettiamo comunque 0 per attivare l'input
        next[portfolioId] = toAssign;
      }
      return next;
    });
  };

  const handleAmountChange = (portfolioId: string, amount: number) => {
    setDraftAssignments(prev => ({
      ...prev,
      [portfolioId]: amount
    }));
  };

  const handleSave = () => {
    // Fixed: Cast Object.entries to [string, number][] to fix 'unknown' type assignment error
    const result: CostAssignment[] = (Object.entries(draftAssignments) as [string, number][])
      .filter(([_, amount]) => amount > 0) // Rimuovi assegnazioni a 0
      .map(([pid, amount]) => ({
        portfolioId: pid,
        amount: amount,
        date: new Date().toISOString().split('T')[0] // Data default oggi
      }));
    onConfirm(result);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-50 px-6 py-5 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-black text-slate-800">Smart Split</h3>
            <p className="text-xs text-slate-400 font-medium">Distribuisci la spesa sui portafogli</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-colors">✕</button>
        </div>

        {/* Totale Bar */}
        <div className="px-6 py-4 bg-white border-b border-slate-50">
           <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Totale Spesa</span>
              <span className="text-xl font-black text-slate-900">€ {totalCost.toLocaleString()}</span>
           </div>
           
           {/* Progress Bar Copertura */}
           <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
              <div 
                className={`h-full transition-all duration-300 ${isOverAssigned ? 'bg-rose-500' : isFullyCovered ? 'bg-emerald-500' : 'bg-amber-400'}`} 
                style={{ width: `${Math.min((assignedSum / totalCost) * 100, 100)}%` }}
              ></div>
           </div>
           
           <div className="flex justify-between mt-2">
              <span className={`text-xs font-bold ${isOverAssigned ? 'text-rose-500' : isFullyCovered ? 'text-emerald-600' : 'text-amber-500'}`}>
                 {isOverAssigned ? `Eccedenza: € ${(assignedSum - totalCost).toLocaleString()}` : isFullyCovered ? 'Coperto interamente' : `Mancano: € ${remainingToPay.toLocaleString()}`}
              </span>
              <span className="text-xs font-bold text-slate-500">Assegnato: € {assignedSum.toLocaleString()}</span>
           </div>
        </div>

        {/* Portfolio List */}
        <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
           {portfolios.map(p => {
             // Calcolo Disponibilità Reale per questo Item
             // Disponibile = (Iniziale - UsatoTotale) + (GiàAssegnatoAQuestoItem)
             const usedTotal = portfolioUsage[p.id] || 0;
             // Nota: assignedHere nel calcolo "available" serve se stiamo editando, ma qui usiamo draftAssignments che è lo stato "futuro".
             // Per sapere quanto HO VERAMENTE LIBERO, devo prendere (Initial - UsedGlobal) + (Quanto era assegnato a ME in precedenza, perché lo sto liberando/riassegnando)
             const previouslyAssignedToThisItem = currentAssignments.find(c => c.portfolioId === p.id)?.amount || 0;
             const trueAvailable = (p.initialBalance - usedTotal) + previouslyAssignedToThisItem;
             
             const isSelected = draftAssignments[p.id] !== undefined;

             return (
               <div 
                 key={p.id} 
                 onClick={() => !isSelected && handleTogglePortfolio(p.id, trueAvailable)}
                 className={`group border rounded-2xl p-3 transition-all cursor-pointer ${isSelected ? 'border-brand-500 bg-brand-50/30 ring-1 ring-brand-100' : 'border-slate-200 hover:border-brand-200 hover:bg-slate-50'}`}
               >
                 <div className="flex items-center gap-3">
                    {/* Checkbox Fake */}
                    <div 
                        onClick={(e) => { e.stopPropagation(); handleTogglePortfolio(p.id, trueAvailable); }}
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${isSelected ? 'bg-brand-500 border-brand-500' : 'bg-white border-slate-300'}`}
                    >
                        {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                    </div>

                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                           <span className="font-bold text-sm text-slate-700">{p.name}</span>
                           <span className={`text-[10px] font-bold ${trueAvailable < 0 ? 'text-rose-500' : 'text-slate-400'}`}>Disp: € {trueAvailable.toLocaleString()}</span>
                        </div>
                        {/* Liquidity Bar */}
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                           <div className={`h-full rounded-full ${trueAvailable < 1000 ? 'bg-rose-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min((trueAvailable / p.initialBalance) * 100, 100)}%` }}></div>
                        </div>
                    </div>

                    {isSelected && (
                        <div className="w-28" onClick={e => e.stopPropagation()}>
                           <div className="relative">
                              <input 
                                type="number" 
                                autoFocus
                                value={draftAssignments[p.id] || ''} 
                                onChange={(e) => handleAmountChange(p.id, parseFloat(e.target.value) || 0)}
                                className="w-full bg-white border border-brand-200 rounded-xl px-2 py-2 text-right font-black text-sm text-brand-700 outline-none focus:ring-2 focus:ring-brand-500"
                              />
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-brand-300 text-xs">€</span>
                           </div>
                        </div>
                    )}
                 </div>
               </div>
             );
           })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
           <button onClick={onClose} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-xs uppercase hover:bg-slate-100 transition-colors">Annulla</button>
           <button 
             onClick={handleSave} 
             disabled={assignedSum <= 0}
             className="flex-2 w-2/3 py-3 bg-slate-900 text-white font-bold rounded-xl text-xs uppercase hover:bg-brand-600 transition-colors shadow-lg disabled:opacity-50 disabled:shadow-none"
           >
             Conferma Assegnazione
           </button>
        </div>

      </div>
    </div>
  );
};
