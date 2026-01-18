
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { FinancialData, CostDetail } from '../types';

// Robust Safe Number Helper
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
}

export const Dashboard: React.FC<Props> = ({ data }) => {
  // Calcoli Generali Costi Totali
  const purchaseCostsTotal = (Object.values(data.purchaseCosts) as CostDetail[]).reduce((acc, cost) => acc + safeNum(cost.amount), 0);
  const worksTotal = safeNum(data.renovationCosts.works);
  const materialsTotal = safeNum(data.renovationCosts.materials);
  // Gestione backward compatibility se design è ancora un numero nel DB
  const designTotal = typeof data.renovationCosts.design === 'object' ? safeNum(data.renovationCosts.design.amount) : safeNum(data.renovationCosts.design);
  const contingencyTotal = safeNum(data.renovationCosts.contingency);
  
  const totalRenovation = worksTotal + materialsTotal + designTotal + contingencyTotal;
  const totalPrice = safeNum(data.totalPrice);
  const totalProjectCost = totalPrice + purchaseCostsTotal + totalRenovation;
  
  // Calcoli Liquidità e Mutuo
  const loanPercentage = safeNum(data.loanPercentage);
  const mortgageAmount = totalPrice * (loanPercentage / 100);
  const currentLiquidity = safeNum(data.liquidityGiuseppe) + safeNum(data.liquidityClaudia);
  const downPayment = totalPrice - mortgageAmount;
  const totalCashRequired = downPayment + purchaseCostsTotal + totalRenovation;
  const liquiditySurplus = currentLiquidity - totalCashRequired;
  const isLiquiditySufficient = liquiditySurplus >= 0;

  // --- NUOVI CALCOLI STATO PAGAMENTI (PAID vs REMAINING) ---
  const paidPurchase = (Object.values(data.purchaseCosts) as CostDetail[]).reduce((acc, c) => {
      // Priorità a paidAmount (pagamento parziale), altrimenti fallback a isPaid (pagamento totale)
      const val = c.paidAmount !== undefined ? safeNum(c.paidAmount) : (c.isPaid ? safeNum(c.amount) : 0);
      return acc + val;
  }, 0);

  const paidWorks = (data.renovationCosts.worksBreakdown || []).reduce((acc, i) => acc + (i.isPaid ? safeNum(i.amount) : 0), 0);
  const paidMaterials = (data.renovationCosts.materialsBreakdown || []).reduce((acc, i) => acc + (i.isPaid ? safeNum(i.amount) : 0), 0);
  
  // Per design, controlliamo se è oggetto e calcoliamo parziale o totale
  let paidDesign = 0;
  if (typeof data.renovationCosts.design === 'object') {
      const d = data.renovationCosts.design;
      paidDesign = d.paidAmount !== undefined ? safeNum(d.paidAmount) : (d.isPaid ? safeNum(d.amount) : 0);
  }

  // Calcolo Acconti Prezzo Immobile
  const propertyPaymentsList = data.propertyPayments || [];
  const paidPropertyPrice = propertyPaymentsList.reduce((acc, i) => acc + (i.isPaid ? safeNum(i.amount) : 0), 0);
  
  const totalPaid = paidPurchase + paidWorks + paidMaterials + paidDesign + paidPropertyPrice; 
  const totalRemaining = Math.max(0, totalProjectCost - totalPaid);
  const progressPercent = totalProjectCost > 0 ? Math.min(100, (totalPaid / totalProjectCost) * 100) : 0;
  // ---------------------------------------------------------

  // Dati per Grafico BarChart (Fondi vs Costi)
  const barChartData = [
    { name: 'Fondi Disponibili', Mutuo: mortgageAmount, Liquidità: currentLiquidity },
    { name: 'Costi Previsti', Immobile: totalPrice, Acquisto: purchaseCostsTotal, Ristrutturazione: totalRenovation }
  ];

  // Dati per Grafico Flusso Cumulativo (Esborso nel tempo/fasi)
  const investmentFlowData = useMemo(() => {
    let cumulative = 0;
    const steps = [
      { name: 'Prezzo Immobile', val: totalPrice },
      { name: '+ Oneri Acquisto', val: purchaseCostsTotal },
      { name: '+ Lavori Edili', val: worksTotal },
      { name: '+ Materiali', val: materialsTotal },
      { name: '+ Tecnici', val: designTotal },
      { name: '+ Imprevisti', val: contingencyTotal },
    ];

    return steps.map(step => {
      cumulative += step.val;
      return { phase: step.name, total: cumulative, incremental: step.val };
    });
  }, [totalPrice, purchaseCostsTotal, worksTotal, materialsTotal, designTotal, contingencyTotal]);

  // Tabella Riepilogativa Completa
  const allCosts = useMemo(() => {
    const list: { category: string, item: string, amount: number, isPaid?: boolean, date?: string, paidAmount?: number }[] = [];

    // Gestione Breakdown Prezzo Immobile vs Voce Unica
    if (propertyPaymentsList.length > 0) {
        propertyPaymentsList.forEach(pp => {
            list.push({ category: 'Generale', item: pp.description || 'Acconto/Rata Prezzo', amount: safeNum(pp.amount), isPaid: pp.isPaid, date: pp.paymentDate });
        });
        // Aggiungi saldo residuo se il totale acconti non copre il prezzo
        const remainingPrice = totalPrice - propertyPaymentsList.reduce((acc, p) => acc + safeNum(p.amount), 0);
        if (remainingPrice > 0) {
            list.push({ category: 'Generale', item: 'Saldo Prezzo (Residuo)', amount: remainingPrice, isPaid: false });
        }
    } else {
        list.push({ category: 'Generale', item: 'Prezzo Immobile', amount: totalPrice });
    }

    list.push(
      { category: 'Spese Acquisto', item: 'Notaio', amount: safeNum(data.purchaseCosts.notary.amount), isPaid: data.purchaseCosts.notary.isPaid, paidAmount: data.purchaseCosts.notary.paidAmount, date: data.purchaseCosts.notary.paymentDate },
      { category: 'Spese Acquisto', item: 'Agenzia', amount: safeNum(data.purchaseCosts.agency.amount), isPaid: data.purchaseCosts.agency.isPaid, paidAmount: data.purchaseCosts.agency.paidAmount, date: data.purchaseCosts.agency.paymentDate },
      { category: 'Spese Acquisto', item: 'Imposte', amount: safeNum(data.purchaseCosts.taxes.amount), isPaid: data.purchaseCosts.taxes.isPaid, paidAmount: data.purchaseCosts.taxes.paidAmount, date: data.purchaseCosts.taxes.paymentDate },
      { category: 'Spese Acquisto', item: 'Altro', amount: safeNum(data.purchaseCosts.other.amount), isPaid: data.purchaseCosts.other.isPaid, paidAmount: data.purchaseCosts.other.paidAmount, date: data.purchaseCosts.other.paymentDate }
    );

    (data.renovationCosts.worksBreakdown || []).forEach(w => {
      list.push({ category: 'Ristrutturazione (Lavori)', item: w.description || 'Lavoro senza nome', amount: safeNum(w.amount), isPaid: w.isPaid, date: w.paymentDate });
    });

    (data.renovationCosts.materialsBreakdown || []).forEach(m => {
      list.push({ category: 'Ristrutturazione (Materiali)', item: m.description || 'Materiale senza nome', amount: safeNum(m.amount), isPaid: m.isPaid, date: m.paymentDate });
    });

    if (typeof data.renovationCosts.design === 'object') {
        list.push({ 
            category: 'Professionali', 
            item: 'Progettisti e Onorari', 
            amount: safeNum(data.renovationCosts.design.amount), 
            isPaid: data.renovationCosts.design.isPaid, 
            paidAmount: data.renovationCosts.design.paidAmount,
            date: data.renovationCosts.design.paymentDate 
        });
    } else {
        list.push({ category: 'Professionali', item: 'Progettisti e Onorari', amount: safeNum(data.renovationCosts.design) });
    }
    
    list.push({ category: 'Sicurezza', item: 'Fondo Imprevisti', amount: safeNum(data.renovationCosts.contingency) });

    return list.filter(c => c.amount > 0);
  }, [data, totalPrice, propertyPaymentsList]);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* SEZIONE MONITORAGGIO PAGAMENTI (NUOVA) */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden border border-slate-700">
         <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500 rounded-full blur-[100px] opacity-20 -mr-20 -mt-20 pointer-events-none"></div>
         <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8 items-end">
            <div className="w-full md:w-1/2">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl">💸</div>
                  <div>
                    <h3 className="text-xl font-bold">Stato Pagamenti</h3>
                    <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Flusso di cassa in uscita</p>
                  </div>
               </div>
               
               <div className="mb-2 flex justify-between items-end">
                  <span className="text-4xl font-black tracking-tight">€ {safeNum(totalRemaining).toLocaleString()}</span>
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-1.5">Ancora da saldare</span>
               </div>

               {/* Progress Bar */}
               <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden mb-2 ring-1 ring-slate-700">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000 ease-out relative"
                    style={{ width: `${progressPercent}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
               </div>
               <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Saldato: {progressPercent.toFixed(1)}%</span>
                  <span>Totale: € {safeNum(totalProjectCost).toLocaleString()}</span>
               </div>
            </div>

            <div className="w-full md:w-1/2 grid grid-cols-2 gap-4">
               <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-emerald-400 text-xs font-bold uppercase mb-1">Già Saldato</p>
                  <p className="text-2xl font-bold">€ {safeNum(totalPaid).toLocaleString()}</p>
               </div>
               <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-brand-300 text-xs font-bold uppercase mb-1">Valore Immobile</p>
                  <p className="text-2xl font-bold">€ {safeNum(totalPrice).toLocaleString()}</p>
                  <p className="text-[9px] text-slate-500 mt-1">Incluso nel totale</p>
               </div>
            </div>
         </div>
      </div>

      {/* Alert Sostenibilità (Esistente) */}
      <div className={`p-8 rounded-[2.5rem] border flex items-start gap-6 shadow-soft transition-all ${isLiquiditySufficient ? 'bg-emerald-50/40 border-emerald-100' : 'bg-rose-50/40 border-rose-100'}`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm shrink-0 ${isLiquiditySufficient ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
          {isLiquiditySufficient ? '✓' : '!'}
        </div>
        <div>
          <h3 className={`font-bold text-xl ${isLiquiditySufficient ? 'text-emerald-900' : 'text-rose-900'}`}>
            {isLiquiditySufficient ? 'Piano di Investimento Sostenibile' : 'Attenzione: Budget Insufficiente'}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 max-w-2xl">
            {isLiquiditySufficient 
              ? `Il progetto è coperto dai fondi attuali. Avete un margine residuo di sicurezza di € ${safeNum(liquiditySurplus).toLocaleString()} per gestire extra o variazioni in corso d'opera.` 
              : `L'operazione richiede un'integrazione di € ${Math.abs(safeNum(liquiditySurplus)).toLocaleString()}. Valutate di aumentare la percentuale del mutuo o ridurre le voci di ristrutturazione non essenziali.`}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Mutuo Richiesto', val: `€ ${safeNum(mortgageAmount).toLocaleString()}`, sub: `${loanPercentage}% del valore immobile`, color: 'bg-indigo-50 border-indigo-100 text-indigo-900' },
          { label: 'Costo Totale', val: `€ ${safeNum(totalProjectCost).toLocaleString()}`, sub: 'Investimento complessivo', color: 'bg-white border-slate-100 text-slate-900' },
          { label: 'Cash Necessario', val: `€ ${safeNum(totalCashRequired).toLocaleString()}`, sub: 'Anticipo + Oneri + Lavori', color: 'bg-white border-slate-100 text-slate-900' },
          { label: 'Margine Liquidità', val: `€ ${safeNum(liquiditySurplus).toLocaleString()}`, sub: 'Fondi residui post-operazione', color: isLiquiditySufficient ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-rose-50 border-rose-100 text-rose-900' }
        ].map((kpi, i) => (
          <div key={i} className={`p-6 rounded-3xl border shadow-soft ${kpi.color}`}>
            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">{kpi.label}</p>
            <p className="text-2xl font-black">{kpi.val}</p>
            <p className="text-[11px] font-medium opacity-70 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Grafico BarChart: Confronto Fondi vs Costi */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100 min-h-[450px]">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Copertura Finanziaria</h3>
              <p className="text-xs text-slate-400 font-bold uppercase mt-1">Fondi vs Allocazione Budget</p>
            </div>
            <div className="flex gap-4">
               <div className="flex items-center gap-2"><span className="w-3 h-3 bg-indigo-600 rounded-full"></span><span className="text-[10px] font-bold text-slate-400">MUTUO</span></div>
               <div className="flex items-center gap-2"><span className="w-3 h-3 bg-emerald-500 rounded-full"></span><span className="text-[10px] font-bold text-slate-400">CASH</span></div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barChartData} barSize={60}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
              <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
              <Bar dataKey="Mutuo" stackId="a" fill="#4f46e5" radius={[0,0,4,4]} />
              <Bar dataKey="Liquidità" stackId="a" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="Immobile" stackId="b" fill="#6366f1" radius={[0,0,4,4]} />
              <Bar dataKey="Acquisto" stackId="b" fill="#8b5cf6" />
              <Bar dataKey="Ristrutturazione" stackId="b" fill="#f59e0b" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Grafico Flusso Cumulativo Investimento */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100 min-h-[450px]">
          <div className="mb-10">
            <h3 className="text-lg font-bold text-slate-900">Flusso Cumulativo Investimento</h3>
            <p className="text-xs text-slate-400 font-bold uppercase mt-1">Esborso progressivo per fase di progetto</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={investmentFlowData}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="phase" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
              <RechartsTooltip 
                formatter={(v) => `€ ${safeNum(v).toLocaleString()}`} 
                labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabella Dettaglio Costi e Pagamenti */}
      <div className="bg-white rounded-[2.5rem] shadow-soft border border-slate-100 overflow-hidden">
        <div className="px-8 py-6 bg-slate-50 border-b border-slate-100">
           <h3 className="text-lg font-bold text-slate-900">Dettaglio Voci di Spesa</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoria</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrizione</th>
                <th className="px-8 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Importo</th>
                <th className="px-8 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stato</th>
                <th className="px-8 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pagato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {allCosts.map((row, i) => {
                 const isPaid = row.isPaid;
                 // Per voci parziali, consideriamo pagato se paidAmount > 0 o isPaid = true
                 const paidVal = row.paidAmount !== undefined ? row.paidAmount : (isPaid ? row.amount : 0);
                 const isPartial = paidVal > 0 && paidVal < row.amount;
                 
                 return (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-4 text-xs font-bold text-slate-500">{row.category}</td>
                    <td className="px-8 py-4 text-sm font-bold text-slate-800">
                      {row.item}
                      {row.date && isPaid && <span className="block text-[9px] text-emerald-600 font-medium mt-0.5">Pagato il {new Date(row.date).toLocaleDateString()}</span>}
                    </td>
                    <td className="px-8 py-4 text-right text-sm font-bold text-slate-600">€ {row.amount.toLocaleString()}</td>
                    <td className="px-8 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${isPaid ? 'bg-emerald-100 text-emerald-700' : isPartial ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                        {isPaid ? 'SALDATO' : isPartial ? 'PARZIALE' : 'DA PAGARE'}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                       {paidVal > 0 ? (
                           <span className="text-emerald-600 font-bold text-sm">€ {paidVal.toLocaleString()}</span>
                       ) : (
                           <span className="text-slate-300 text-xs">-</span>
                       )}
                    </td>
                  </tr>
                 );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
