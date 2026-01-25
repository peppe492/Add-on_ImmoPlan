
import React, { useMemo, useState } from 'react';
import { 
  CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie, XAxis, YAxis, BarChart, Bar, Legend
} from 'recharts';
import { FinancialData, CostDetail, Portfolio, CostAssignment, RenovationItem } from '../types';
import { SmartAssignmentModal } from './SmartAssignmentModal';

const safeNum = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) || !isFinite(val) ? 0 : val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
    }
    return 0;
};

interface Props {
  data: FinancialData;
  onChange?: (newData: FinancialData) => void;
}

interface ModalConfig {
  isOpen: boolean;
  itemSource?: { type: 'purchase' | 'work' | 'design', key?: string, id?: string };
  totalCost: number;
  currentAssignments: CostAssignment[];
}

export const Dashboard: React.FC<Props> = ({ data, onChange }) => {
  const [modalState, setModalState] = useState<ModalConfig>({ isOpen: false, totalCost: 0, currentAssignments: [] });

  // --- BASE CALCULATIONS ---
  
  // Costi Acquisto (Accessori)
  const depositAmount = safeNum(data.purchaseCosts.deposit?.amount);
  const balanceAmount = safeNum(data.purchaseCosts.balance?.amount);
  const purchaseCostsTotal = (Object.values(data.purchaseCosts) as CostDetail[]).reduce((acc, cost) => acc + safeNum(cost.amount), 0);
  
  // Spese Accessorie "Pure" (Total Purchase Costs - Deposit - Balance)
  const feesTotal = purchaseCostsTotal - depositAmount - balanceAmount;

  // Ristrutturazione
  const worksTotal = safeNum(data.renovationCosts.works);
  const materialsTotal = safeNum(data.renovationCosts.materials);
  const designTotal = typeof data.renovationCosts.design === 'object' ? safeNum(data.renovationCosts.design.amount) : safeNum(data.renovationCosts.design);
  const contingencyTotal = safeNum(data.renovationCosts.contingency);
  const totalRenovation = worksTotal + materialsTotal + designTotal + contingencyTotal;

  // Totali Progetto
  const totalPrice = safeNum(data.totalPrice);
  // Costo Totale Reale = Prezzo Immobile + Spese Accessorie + Ristrutturazione
  const totalProjectCost = totalPrice + feesTotal + totalRenovation;
  
  // Finanza
  const loanPercentage = safeNum(data.loanPercentage);
  const mortgageAmount = totalPrice * (loanPercentage / 100);
  const currentLiquidity = (data.portfolios || []).reduce((acc, p) => acc + safeNum(p.initialBalance), 0);
  
  // --- NUOVA LOGICA SOSTENIBILITA' ---
  const downPaymentRequired = totalPrice - mortgageAmount;
  const cashNeededForPurchase = downPaymentRequired + feesTotal;
  const liquidityAfterPurchase = currentLiquidity - cashNeededForPurchase;
  const isPurchaseSustainable = liquidityAfterPurchase >= 0;
  const totalCashRequired = cashNeededForPurchase + totalRenovation;
  const liquidityMargin = currentLiquidity - totalCashRequired;
  const isRenovationSustainable = liquidityMargin >= 0;

  const financialStatus = !isPurchaseSustainable 
      ? 'CRITICAL' 
      : (!isRenovationSustainable ? 'WARNING' : 'SAFE');

  // --- PAYMENT TRACKING (UPDATED FOR PARTIALS) ---
  const paymentStats = useMemo(() => {
    const items: { 
        label: string; 
        amount: number; 
        paidAmount: number; // New field for partials
        isPaid: boolean; 
        date?: string; 
        portfolios: string[], 
        assignments: CostAssignment[], 
        source: any 
    }[] = [];
    
    // Purchase Costs
    const pcLabels: Record<string, string> = {
      deposit: 'Anticipo Caparra',
      balance: 'Saldo al Rogito',
      notary: 'Notaio',
      agency: 'Agenzia Immobiliare',
      taxes: 'Imposte di Registro',
      other: 'Altre Spese Acquisto'
    };

    Object.entries(data.purchaseCosts).forEach(([key, cost]: [string, any]) => {
      if (safeNum(cost.amount) <= 0) return;
      
      const pAmount = safeNum(cost.paidAmount);
      const isFull = pAmount >= safeNum(cost.amount) || !!cost.isPaid;

      items.push({
        label: pcLabels[key] || key,
        amount: safeNum(cost.amount),
        paidAmount: isFull ? safeNum(cost.amount) : pAmount,
        isPaid: isFull,
        date: cost.paymentDate || cost.assignments?.[0]?.date,
        portfolios: (cost.assignments || []).map((a: any) => {
          const p = data.portfolios.find(pf => pf.id === a.portfolioId);
          return p ? p.name : 'N/D';
        }),
        assignments: cost.assignments || [],
        source: { type: 'purchase', key }
      });
    });

    // Renovation (Assuming binary isPaid for now, unless updated structure)
    (data.renovationCosts.worksBreakdown || []).forEach(w => {
        const amt = safeNum(w.amount);
        items.push({
            label: `Lavoro: ${w.description || 'Senza nome'}`,
            amount: amt,
            paidAmount: w.isPaid ? amt : 0,
            isPaid: !!w.isPaid,
            date: w.assignments?.[0]?.date,
            portfolios: (w.assignments || []).map((a: any) => {
                const p = data.portfolios.find(pf => pf.id === a.portfolioId);
                return p ? p.name : 'N/D';
            }),
            assignments: w.assignments || [],
            source: { type: 'work', id: w.id }
        });
    });
    
    // Design
    if (designTotal > 0) {
         const designPaid = data.renovationCosts.design?.isPaid ? designTotal : safeNum(data.renovationCosts.design?.paidAmount);
         items.push({
            label: 'Progettazione & Tecnici',
            amount: designTotal,
            paidAmount: designPaid,
            isPaid: !!data.renovationCosts.design?.isPaid || designPaid >= designTotal,
            date: data.renovationCosts.design?.paymentDate || data.renovationCosts.design?.assignments?.[0]?.date,
            portfolios: [],
            assignments: data.renovationCosts.design?.assignments || [],
            source: { type: 'design' }
        });
    }

    // Calcolo Totali precisi basati sul versato reale
    const paidTotal = items.reduce((acc, i) => acc + i.paidAmount, 0);
    const pendingTotal = Math.max(0, totalProjectCost - paidTotal);

    return { items, paidTotal, pendingTotal, progress: totalProjectCost > 0 ? (paidTotal / totalProjectCost) * 100 : 0 };
  }, [data, totalProjectCost, designTotal]);

  // --- MILESTONES CALCULATION FOR PROGRESS BAR ---
  const milestones = useMemo(() => {
      let currentCumulative = 0;
      const sortedItems = [...paymentStats.items].sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          
          if (dateA !== 0 && dateB !== 0) return dateA - dateB;
          // Sort partially/fully paid first
          if (a.paidAmount > 0 && b.paidAmount === 0) return -1;
          if (a.paidAmount === 0 && b.paidAmount > 0) return 1;
          return 0;
      });

      return sortedItems.map(item => {
          currentCumulative += item.amount;
          return {
              ...item,
              endPosition: (currentCumulative / totalProjectCost) * 100
          };
      }).filter(item => {
          return item.amount > (totalProjectCost * 0.02); // Soglia visualizzazione 2%
      });
  }, [paymentStats.items, totalProjectCost]);

  // --- CALENDAR GROUPING LOGIC ---
  const calendarData = useMemo(() => {
    const withDates = paymentStats.items
        .filter(i => i.date)
        .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
    
    const grouped = new Map<string, typeof withDates>();
    
    withDates.forEach(item => {
        const d = new Date(item.date!);
        const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!grouped.has(sortKey)) grouped.set(sortKey, []);
        grouped.get(sortKey)!.push(item);
    });

    return Array.from(grouped.entries());
  }, [paymentStats.items]);


  // --- PORTFOLIO ANALYSIS ---
  const { portfolioUsage, rawPortfolioUsage } = useMemo(() => {
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

    const mapped = data.portfolios.map(p => {
      const used = usage[p.id] || 0;
      return {
        ...p,
        used,
        remaining: p.initialBalance - used,
        percent: p.initialBalance > 0 ? (used / p.initialBalance) * 100 : 0
      };
    });

    return { portfolioUsage: mapped, rawPortfolioUsage: usage };
  }, [data]);

  const ownerContribution = useMemo(() => {
    const giuseppe = portfolioUsage.filter(p => p.owner === 'Giuseppe').reduce((acc, p) => acc + p.used, 0);
    const claudia = portfolioUsage.filter(p => p.owner === 'Claudia').reduce((acc, p) => acc + p.used, 0);
    return [
      { name: 'Giuseppe', value: giuseppe, color: '#0ea5e9' },
      { name: 'Claudia', value: claudia, color: '#f43f5e' }
    ].filter(v => v.value > 0);
  }, [portfolioUsage]);

  // --- NEW CHARTS DATA PREP ---
  const coverageChartData = useMemo(() => [
      {
          name: 'Fondi Disponibili',
          Mutuo: mortgageAmount,
          Cash: currentLiquidity,
          Immobile: 0,
          Acquisto: 0,
          Ristrutturazione: 0
      },
      {
          name: 'Costi Previsti',
          Mutuo: 0,
          Cash: 0,
          Immobile: totalPrice,
          Acquisto: feesTotal,
          Ristrutturazione: totalRenovation
      }
  ], [mortgageAmount, currentLiquidity, totalPrice, feesTotal, totalRenovation]);

  const flowChartData = useMemo(() => {
      const cumulative = [
          { stage: 'Start', value: 0 },
          { stage: 'Prezzo Immobile', value: totalPrice },
          { stage: '+ Oneri Acquisto', value: totalPrice + feesTotal },
          { stage: '+ Lavori Edili', value: totalPrice + feesTotal + worksTotal },
          { stage: '+ Materiali', value: totalPrice + feesTotal + worksTotal + materialsTotal },
          { stage: '+ Tecnici', value: totalPrice + feesTotal + worksTotal + materialsTotal + designTotal },
          { stage: '+ Imprevisti', value: totalProjectCost }
      ];
      return cumulative;
  }, [totalPrice, feesTotal, worksTotal, materialsTotal, designTotal, totalProjectCost]);

  // --- ASSIGNMENT MODAL LOGIC ---
  const openAssignmentModal = (item: any) => {
      setModalState({
          isOpen: true,
          itemSource: item.source,
          totalCost: item.amount,
          currentAssignments: item.assignments
      });
  };

  const handleAssignmentUpdate = (newAssignments: CostAssignment[]) => {
      if (!modalState.itemSource || !onChange) return;
      const { type, key, id } = modalState.itemSource;
      let newData = { ...data };

      if (type === 'purchase' && key) {
          // @ts-ignore
          newData.purchaseCosts = {
              ...newData.purchaseCosts,
              [key]: { ...newData.purchaseCosts[key as keyof typeof newData.purchaseCosts], assignments: newAssignments }
          };
      } else if (type === 'work' && id) {
          newData.renovationCosts = {
              ...newData.renovationCosts,
              worksBreakdown: newData.renovationCosts.worksBreakdown.map(w => 
                  w.id === id ? { ...w, assignments: newAssignments } : w
              )
          };
      } else if (type === 'design') {
           newData.renovationCosts = {
              ...newData.renovationCosts,
              design: { ...newData.renovationCosts.design, assignments: newAssignments }
           };
      }
      
      onChange(newData);
      setModalState({ ...modalState, isOpen: false });
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* 1. STATO PAGAMENTI CARD (AGGIORNATA CON MILESTONES E PARZIALI) */}
      <div className="bg-[#0f172a] text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Sezione Sinistra: Totale e Progress */}
            <div className="lg:col-span-7 flex flex-col justify-between relative z-10">
                <div>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">💸</div>
                        <div>
                            <h2 className="text-xl font-bold">Stato Pagamenti</h2>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">FLUSSO DI CASSA IN USCITA</p>
                        </div>
                    </div>
                    
                    <div className="mt-8 flex items-baseline gap-4">
                        <h3 className="text-5xl font-black tracking-tighter">€ {paymentStats.paidTotal.toLocaleString()}</h3>
                        <span className="text-slate-400 font-bold text-sm">/ € {totalProjectCost.toLocaleString()}</span>
                    </div>
                </div>

                <div className="mt-12">
                    <div className="flex justify-between mb-3 items-end">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TIMELINE MILESTONES</span>
                         <span className={`text-[10px] font-bold uppercase tracking-widest ${paymentStats.progress >= 100 ? 'text-emerald-400' : 'text-blue-400'}`}>
                             {paymentStats.progress.toFixed(1)}% VERSATO
                         </span>
                    </div>
                    
                    {/* Barra di Progresso con Milestones */}
                    <div className="relative w-full h-3 bg-slate-800 rounded-full">
                         {/* Background Fill */}
                         <div 
                             className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out z-10" 
                             style={{ width: `${paymentStats.progress}%` }}
                         >
                             <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                         </div>
                         
                         {/* Milestones Markers */}
                         {milestones.map((m, idx) => {
                             const isPartial = m.paidAmount > 0 && !m.isPaid;
                             const colorClass = m.isPaid ? 'bg-emerald-500 border-emerald-200' : (isPartial ? 'bg-amber-500 border-amber-200' : 'bg-slate-700 border-slate-500');
                             
                             return (
                                 <div 
                                    key={idx} 
                                    className="absolute top-1/2 -translate-y-1/2 z-20 group"
                                    style={{ left: `${m.endPosition}%` }}
                                 >
                                     {/* Il Pallino */}
                                     <div className={`w-3 h-3 rounded-full border-2 transition-all cursor-pointer hover:scale-125 ${colorClass}`}>
                                     </div>
                                     
                                     {/* Badge/Tooltip */}
                                     <div className="absolute bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] py-1.5 px-3 rounded-lg border border-slate-700 whitespace-nowrap shadow-xl pointer-events-none z-30">
                                         <div className="font-bold mb-0.5 flex items-center gap-1">
                                             {m.isPaid ? '✅' : (isPartial ? '⚠️' : '⏳')} {m.label}
                                         </div>
                                         <div className="font-mono text-slate-300">Tot: € {m.amount.toLocaleString()}</div>
                                         {isPartial && <div className="font-mono text-emerald-400">Vers: € {m.paidAmount.toLocaleString()}</div>}
                                         <div className="text-[8px] text-slate-500 mt-1 uppercase font-bold">{m.date ? new Date(m.date).toLocaleDateString() : 'Data N/D'}</div>
                                         <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-slate-700"></div>
                                     </div>
                                 </div>
                             );
                         })}
                    </div>

                    <div className="flex justify-between mt-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                        <span>Start</span>
                        <span>Completamento</span>
                    </div>
                </div>
            </div>

            {/* Sezione Destra: Cards di Dettaglio */}
            <div className="lg:col-span-5 grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                {/* Card Ancora da Saldare */}
                <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 flex flex-col justify-center h-full">
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-2">ANCORA DA SALDARE</p>
                    <p className="text-2xl font-black">€ {paymentStats.pendingTotal.toLocaleString()}</p>
                    <p className="text-[9px] text-slate-500 font-medium mt-1">Impegni futuri</p>
                </div>
                
                {/* Card Valore Immobile */}
                <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 flex flex-col justify-center h-full">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">VALORE IMMOBILE</p>
                    <p className="text-2xl font-black">€ {totalPrice.toLocaleString()}</p>
                    <p className="text-[9px] text-slate-500 font-medium mt-1">Budget allocato</p>
                </div>
            </div>
        </div>
      </div>

      {/* 2. ANALISI SOSTENIBILITÀ (BUDGET BANNER EVOLUTO) */}
      <div className={`rounded-[2.5rem] border p-8 flex flex-col gap-6 shadow-sm transition-colors duration-300
        ${financialStatus === 'SAFE' ? 'bg-emerald-50 border-emerald-100' : 
          financialStatus === 'WARNING' ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100'}`}>
         
         <div className="flex flex-col md:flex-row gap-6 items-start">
             <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0 font-bold shadow-sm
                ${financialStatus === 'SAFE' ? 'bg-emerald-100 text-emerald-600' : 
                  financialStatus === 'WARNING' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                {financialStatus === 'SAFE' ? '✓' : financialStatus === 'WARNING' ? '⚠️' : '⛔'}
             </div>
             
             <div className="flex-1">
                 <h3 className={`text-xl font-bold mb-2
                    ${financialStatus === 'SAFE' ? 'text-emerald-900' : 
                      financialStatus === 'WARNING' ? 'text-amber-900' : 'text-rose-900'}`}>
                    {financialStatus === 'SAFE' ? 'Progetto Sostenibile' : 
                     financialStatus === 'WARNING' ? 'Sostenibilità Parziale (Solo Acquisto)' : 'Progetto Insostenibile'}
                 </h3>
                 <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                    {financialStatus === 'SAFE' 
                        ? `Hai liquidità sufficiente per coprire l'acquisto, le spese accessorie e tutti i lavori di ristrutturazione previsti, con un margine di sicurezza di € ${liquidityMargin.toLocaleString()}.` 
                        : financialStatus === 'WARNING' 
                        ? `Attenzione: La liquidità copre l'acquisto dell'immobile (€ ${cashNeededForPurchase.toLocaleString()}), ma NON è sufficiente per completare la ristrutturazione. Mancano € ${Math.abs(liquidityMargin).toLocaleString()}.`
                        : `Critico: La liquidità attuale non è sufficiente nemmeno per coprire l'acquisto e le spese accessorie. Mancano € ${Math.abs(liquidityAfterPurchase).toLocaleString()} solo per arrivare al rogito.`}
                 </p>
             </div>
         </div>

         {/* Fasi Breakdown */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
             {/* Card Fase 1: Acquisto */}
             <div className={`bg-white/60 p-4 rounded-2xl border flex items-center justify-between
                 ${isPurchaseSustainable ? 'border-emerald-200' : 'border-rose-200'}`}>
                 <div>
                     <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Fase 1: Rogito (Equity + Spese)</p>
                     <p className="text-lg font-black text-slate-800">€ {cashNeededForPurchase.toLocaleString()}</p>
                     <p className="text-[10px] text-slate-400">Anticipo: € {downPaymentRequired.toLocaleString()} + Spese: € {feesTotal.toLocaleString()}</p>
                 </div>
                 <div className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${isPurchaseSustainable ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                     {isPurchaseSustainable ? 'Coperto' : 'Scoperto'}
                 </div>
             </div>

             {/* Card Fase 2: Ristrutturazione */}
             <div className={`bg-white/60 p-4 rounded-2xl border flex items-center justify-between
                 ${isRenovationSustainable ? 'border-emerald-200' : (totalRenovation > 0 ? 'border-amber-200' : 'border-slate-200')}`}>
                 <div>
                     <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Fase 2: Ristrutturazione</p>
                     <p className="text-lg font-black text-slate-800">€ {totalRenovation.toLocaleString()}</p>
                     {/* Breakdown Costi Ristrutturazione */}
                     <p className="text-[10px] text-slate-400">
                         Edili/Mat: €{(worksTotal + materialsTotal).toLocaleString()} + Tecnici: €{designTotal.toLocaleString()} + Varie: €{contingencyTotal.toLocaleString()}
                     </p>
                     {/* Info liquidità residua */}
                     <p className="text-[9px] text-slate-300 mt-0.5 font-medium">
                         (Residuo post-rogito disponibile: € {liquidityAfterPurchase.toLocaleString()})
                     </p>
                 </div>
                 <div className={`px-3 py-1 rounded-lg text-xs font-bold uppercase 
                     ${totalRenovation === 0 ? 'bg-slate-100 text-slate-500' : isRenovationSustainable ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                     {totalRenovation === 0 ? 'N/A' : isRenovationSustainable ? 'Coperto' : 'Parziale'}
                 </div>
             </div>
         </div>
      </div>

      {/* 3. NEW FINANCIAL WIDGETS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Mutuo Richiesto */}
          <div className="bg-[#eff6ff] p-6 rounded-[2rem] border border-indigo-100 flex flex-col justify-center shadow-sm">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">MUTUO RICHIESTO</p>
              <h3 className="text-3xl font-black text-indigo-900">€ {mortgageAmount.toLocaleString()}</h3>
              <p className="text-[11px] font-medium text-indigo-500 mt-1">{loanPercentage}% del valore immobile</p>
          </div>

          {/* Costo Totale */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 flex flex-col justify-center shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">COSTO TOTALE</p>
              <h3 className="text-3xl font-black text-slate-900">€ {totalProjectCost.toLocaleString()}</h3>
              <p className="text-[11px] font-medium text-slate-500 mt-1">Investimento complessivo</p>
          </div>

          {/* Cash Necessario */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 flex flex-col justify-center shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">CASH NECESSARIO</p>
              <h3 className="text-3xl font-black text-slate-900">€ {totalCashRequired.toLocaleString()}</h3>
              <p className="text-[11px] font-medium text-slate-500 mt-1">Anticipo + Oneri + Lavori</p>
          </div>

          {/* Margine Liquidità */}
          <div className={`${liquidityMargin < 0 ? 'bg-[#fff1f2] border-rose-100' : 'bg-[#ecfdf5] border-emerald-100'} p-6 rounded-[2rem] border flex flex-col justify-center shadow-sm`}>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${liquidityMargin < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>MARGINE LIQUIDITÀ</p>
              <h3 className={`text-3xl font-black ${liquidityMargin < 0 ? 'text-[#881337]' : 'text-emerald-900'}`}>€ {liquidityMargin.toLocaleString()}</h3>
              <p className={`text-[11px] font-medium mt-1 ${liquidityMargin < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>Fondi residui post-operazione</p>
          </div>
      </div>

      {/* 4. DETTAGLI OPERATIVI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
        
        {/* Dettaglio Voci di Costo */}
        <div className="lg:col-span-8 bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100">
           <h4 className="text-xl font-bold text-slate-900 mb-6">Dettaglio Voci & Scadenze</h4>
           <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <th className="pb-4 pl-2">Voce</th>
                            <th className="pb-4">Importo</th>
                            <th className="pb-4">Versato</th>
                            <th className="pb-4">Stato</th>
                            <th className="pb-4">Scadenza</th>
                            <th className="pb-4">Wallet</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {paymentStats.items.map((item, idx) => (
                            <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                                <td className="py-3 pl-2 text-sm font-bold text-slate-700">{item.label}</td>
                                <td className="py-3 text-sm font-black text-slate-900">€ {item.amount.toLocaleString()}</td>
                                <td className="py-3 text-sm font-bold text-emerald-600">€ {item.paidAmount.toLocaleString()}</td>
                                <td className="py-3">
                                    <span className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase ${item.isPaid ? 'bg-emerald-50 text-emerald-600' : (item.paidAmount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400')}`}>
                                        {item.isPaid ? 'Saldato' : (item.paidAmount > 0 ? 'Parziale' : 'In Attesa')}
                                    </span>
                                </td>
                                <td className="py-3 text-xs font-medium text-slate-500">{item.date ? new Date(item.date).toLocaleDateString('it-IT') : '-'}</td>
                                <td className="py-3 text-[10px] font-bold text-slate-400">{item.portfolios.join(', ') || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
           </div>
        </div>

        {/* Grafico Copertura Finanziaria */}
        <div className="lg:col-span-4 bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100 flex flex-col">
            <h4 className="text-xl font-bold text-slate-900 mb-4">Fonti di Finanziamento</h4>
            <div className="flex-1 min-h-[250px] relative">
               <ResponsiveContainer>
                  <PieChart>
                    <Pie data={ownerContribution} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" cornerRadius={5}>
                      {ownerContribution.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Cash Totale</span>
                  <span className="text-xl font-black text-slate-800">€ {(ownerContribution.reduce((a,b)=>a+b.value,0)).toLocaleString()}</span>
               </div>
            </div>
            <div className="mt-4 space-y-2">
                {ownerContribution.map((oc, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: oc.color}}></div>
                            <span className="font-bold text-slate-600">{oc.name}</span>
                        </div>
                        <span className="font-bold text-slate-900">€ {oc.value.toLocaleString()}</span>
                    </div>
                ))}
            </div>
        </div>
      </div>
      
      {/* 5. CALENDARIO PAGAMENTI (NUOVA SEZIONE CON ASSEGNAZIONE) */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100">
           <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><span>📅</span> Calendario Scadenze</h3>
           
           {calendarData.length === 0 ? (
               <div className="text-center py-10 text-slate-400 italic">
                  Nessuna data di scadenza assegnata alle voci di costo. Inserisci le date nell'Editor Dati.
               </div>
           ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {calendarData.map(([key, items]) => {
                      const [year, month] = key.split('-');
                      const dateObj = new Date(parseInt(year), parseInt(month) - 1);
                      const monthName = dateObj.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
                      
                      return (
                          <div key={key} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 h-fit">
                              <h4 className="font-bold text-slate-700 capitalize mb-3 border-b border-slate-200 pb-2 flex justify-between items-center">
                                  {monthName}
                                  <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full text-slate-500">{items.length}</span>
                              </h4>
                              <div className="space-y-2">
                                  {items.map((item, idx) => {
                                      const assignedAmount = item.assignments.reduce((sum, a) => sum + (a.amount || 0), 0);
                                      const isFullyCovered = Math.abs(assignedAmount - item.amount) < 0.01;
                                      
                                      return (
                                          <div 
                                            key={idx} 
                                            className={`flex flex-col bg-white p-2.5 rounded-xl border shadow-sm transition-all cursor-pointer hover:border-brand-300 hover:shadow-md group ${isFullyCovered ? 'border-slate-100' : 'border-amber-200'}`}
                                            onClick={() => openAssignmentModal(item)}
                                            title="Clicca per assegnare portafogli"
                                          >
                                              <div className="flex justify-between items-center mb-1">
                                                  <div className="min-w-0 pr-2">
                                                      <p className="text-[10px] font-bold text-slate-500 truncate" title={item.label}>{item.label}</p>
                                                      <p className="text-sm font-black text-slate-800">€ {item.amount.toLocaleString()}</p>
                                                  </div>
                                                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.isPaid ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-slate-300 ring-2 ring-slate-100'}`} title={item.isPaid ? 'Pagato' : 'In attesa'}></div>
                                              </div>
                                              
                                              {/* Copertura Bar */}
                                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1 relative">
                                                  <div className={`h-full ${isFullyCovered ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${Math.min((assignedAmount / item.amount) * 100, 100)}%` }}></div>
                                              </div>
                                              
                                              {/* Action Prompt */}
                                              <div className="flex justify-between items-center mt-1">
                                                  <span className={`text-[8px] font-bold uppercase ${isFullyCovered ? 'text-emerald-600' : 'text-amber-500'}`}>
                                                      {isFullyCovered ? 'Coperto' : 'Assegna Fondi'}
                                                  </span>
                                                  {!isFullyCovered && (
                                                      <div className="w-4 h-4 rounded-full border border-amber-300 flex items-center justify-center text-[8px] text-amber-500 group-hover:bg-amber-50">+</div>
                                                  )}
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                              <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                                  <span>Tot. Mese</span>
                                  <span>€ {items.reduce((acc, i) => acc + i.amount, 0).toLocaleString()}</span>
                              </div>
                          </div>
                      )
                  })}
               </div>
           )}
      </div>

      {/* 6. NUOVI GRAFICI FINANZIARI (COPERTURA & FLUSSO) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          
          {/* Grafico 1: Copertura Finanziaria */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100 flex flex-col">
               <div className="mb-6">
                   <h3 className="text-xl font-bold text-slate-900">Copertura Finanziaria</h3>
                   <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">FONDI VS ALLOCAZIONE BUDGET</p>
               </div>
               
               <div className="flex-1 min-h-[300px]">
                   <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={coverageChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold', fill: '#64748b'}} dy={10} />
                           <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                           <RechartsTooltip 
                             cursor={{fill: '#f8fafc'}}
                             contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }} 
                           />
                           <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 'bold' }} />
                           
                           {/* Stack per Fondi Disponibili */}
                           <Bar dataKey="Mutuo" stackId="a" fill="#6366f1" radius={[0, 0, 4, 4]} barSize={60} />
                           <Bar dataKey="Cash" stackId="a" fill="#10b981" radius={[12, 12, 0, 0]} barSize={60} />
                           
                           {/* Stack per Costi Previsti */}
                           <Bar dataKey="Immobile" stackId="a" fill="#4338ca" radius={[0, 0, 4, 4]} barSize={60} />
                           <Bar dataKey="Acquisto" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} barSize={60} />
                           <Bar dataKey="Ristrutturazione" stackId="a" fill="#f59e0b" radius={[12, 12, 0, 0]} barSize={60} />
                       </BarChart>
                   </ResponsiveContainer>
               </div>
          </div>

          {/* Grafico 2: Flusso Cumulativo Investimento */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100 flex flex-col">
               <div className="mb-6">
                   <h3 className="text-xl font-bold text-slate-900">Flusso Cumulativo Investimento</h3>
                   <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">ESBORSO PROGRESSIVO PER FASE DI PROGETTO</p>
               </div>

               <div className="flex-1 min-h-[300px]">
                   <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={flowChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                           <defs>
                               <linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="1">
                                   <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                   <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                               </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                           <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} dy={10} interval={0} />
                           <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                           <RechartsTooltip 
                             contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                           />
                           <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorFlow)" />
                       </AreaChart>
                   </ResponsiveContainer>
               </div>
          </div>

      </div>

      <SmartAssignmentModal 
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        totalCost={modalState.totalCost}
        currentAssignments={modalState.currentAssignments}
        portfolios={data.portfolios}
        portfolioUsage={rawPortfolioUsage}
        onConfirm={handleAssignmentUpdate}
      />

    </div>
  );
};
