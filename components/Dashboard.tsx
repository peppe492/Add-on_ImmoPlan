import React, { useMemo, useState, useEffect } from 'react';
import { CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie, XAxis, YAxis, BarChart, Bar, Legend } from 'recharts';
import { FinancialData, CostDetail, Portfolio, CostAssignment, RenovationItem } from '../types';
import { SmartAssignmentModal } from './SmartAssignmentModal';

/* =====================================================================================
   ImmoPlan · Report Acquisto — "Bento Terminal" reskin. Logica 100% identica.
   Recharts conservato, colori adattati al tema. CSS scoped sotto `.ipb`.
   ===================================================================================== */

const safeNum = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) || !isFinite(val) ? 0 : val;
  if (typeof val === 'string') { const p = parseFloat(val); return isNaN(p) || !isFinite(p) ? 0 : p; }
  return 0;
};
const fmt = (n: number) => Math.round(safeNum(n)).toLocaleString('it-IT');

interface Props { data: FinancialData; onChange?: (newData: FinancialData) => void; }
interface ModalConfig { isOpen: boolean; itemSource?: { type: 'purchase' | 'work' | 'design'; key?: string; id?: string }; totalCost: number; currentAssignments: CostAssignment[]; }

export const Dashboard: React.FC<Props> = ({ data, onChange }) => {
  const [modalState, setModalState] = useState<ModalConfig>({ isOpen: false, totalCost: 0, currentAssignments: [] });
  const [theme, setTheme] = useState<'DEFAULT' | 'NEON'>('DEFAULT');
  useEffect(() => { const apply = () => setTheme(document.documentElement.classList.contains('theme-neon') ? 'NEON' : 'DEFAULT'); const obs = new MutationObserver(apply); obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); apply(); return () => obs.disconnect(); }, []);
  const isNeon = theme === 'NEON';
  const CH = isNeon
    ? { grid: 'rgba(255,255,255,.06)', axis: '#58637a', tip: '#151d2d', tipBorder: 'rgba(255,255,255,.12)', accent: '#6f63ff', accentSoft: '#2f8fff', cash: '#2fd6a3', immobile: '#4f46e5', reno: '#f5b942', gius: '#2f8fff', clau: '#fb6f86', flow: '#6f63ff' }
    : { grid: '#f1f5f9', axis: '#94a3b8', tip: '#ffffff', tipBorder: 'rgba(15,23,42,.08)', accent: '#6366f1', accentSoft: '#0a6cff', cash: '#0fa47a', immobile: '#4338ca', reno: '#f59e0b', gius: '#0ea5e9', clau: '#f43f5e', flow: '#6366f1' };

  const depositAmount = safeNum(data.purchaseCosts.deposit?.amount);
  const balanceAmount = safeNum(data.purchaseCosts.balance?.amount);
  const purchaseCostsTotal = (Object.values(data.purchaseCosts) as CostDetail[]).reduce((acc, cost) => acc + safeNum(cost.amount), 0);
  const feesTotal = purchaseCostsTotal - depositAmount - balanceAmount;
  const worksTotal = safeNum(data.renovationCosts.works);
  const materialsTotal = safeNum(data.renovationCosts.materials);
  const designTotal = typeof data.renovationCosts.design === 'object' ? safeNum(data.renovationCosts.design.amount) : safeNum(data.renovationCosts.design);
  const contingencyTotal = safeNum(data.renovationCosts.contingency);
  const totalRenovation = worksTotal + materialsTotal + designTotal + contingencyTotal;
  const totalPrice = safeNum(data.totalPrice);
  const totalProjectCost = totalPrice + feesTotal + totalRenovation;
  const loanPercentage = safeNum(data.loanPercentage);
  const mortgageAmount = totalPrice * (loanPercentage / 100);
  const currentLiquidity = (data.portfolios || []).reduce((acc, p) => acc + safeNum(p.initialBalance), 0);
  const downPaymentRequired = totalPrice - mortgageAmount;
  const cashNeededForPurchase = downPaymentRequired + feesTotal;
  const liquidityAfterPurchase = currentLiquidity - cashNeededForPurchase;
  const isPurchaseSustainable = liquidityAfterPurchase >= 0;
  const totalCashRequired = cashNeededForPurchase + totalRenovation;
  const liquidityMargin = currentLiquidity - totalCashRequired;
  const isRenovationSustainable = liquidityMargin >= 0;
  const financialStatus = !isPurchaseSustainable ? 'CRITICAL' : (!isRenovationSustainable ? 'WARNING' : 'SAFE');

  const paymentStats = useMemo(() => {
    const items: { label: string; amount: number; paidAmount: number; isPaid: boolean; date?: string; portfolios: string[]; assignments: CostAssignment[]; source: any }[] = [];
    const pcLabels: Record<string, string> = { deposit: 'Anticipo Caparra', balance: 'Saldo al Rogito', notary: 'Notaio', agency: 'Agenzia Immobiliare', taxes: 'Imposte di Registro', other: 'Altre Spese Acquisto' };
    Object.entries(data.purchaseCosts).forEach(([key, cost]: [string, any]) => {
      if (safeNum(cost.amount) <= 0) return;
      const pAmount = safeNum(cost.paidAmount); const isFull = pAmount >= safeNum(cost.amount) || !!cost.isPaid;
      items.push({ label: pcLabels[key] || key, amount: safeNum(cost.amount), paidAmount: isFull ? safeNum(cost.amount) : pAmount, isPaid: isFull, date: cost.paymentDate || cost.assignments?.[0]?.date, portfolios: (cost.assignments || []).map((a: any) => { const p = data.portfolios.find(pf => pf.id === a.portfolioId); return p ? p.name : 'N/D'; }), assignments: cost.assignments || [], source: { type: 'purchase', key } });
    });
    (data.renovationCosts.worksBreakdown || []).forEach(w => { const amt = safeNum(w.amount); items.push({ label: `Lavoro: ${w.description || 'Senza nome'}`, amount: amt, paidAmount: w.isPaid ? amt : 0, isPaid: !!w.isPaid, date: w.assignments?.[0]?.date, portfolios: (w.assignments || []).map((a: any) => { const p = data.portfolios.find(pf => pf.id === a.portfolioId); return p ? p.name : 'N/D'; }), assignments: w.assignments || [], source: { type: 'work', id: w.id } }); });
    if (designTotal > 0) { const designPaid = data.renovationCosts.design?.isPaid ? designTotal : safeNum(data.renovationCosts.design?.paidAmount); items.push({ label: 'Progettazione & Tecnici', amount: designTotal, paidAmount: designPaid, isPaid: !!data.renovationCosts.design?.isPaid || designPaid >= designTotal, date: data.renovationCosts.design?.paymentDate || data.renovationCosts.design?.assignments?.[0]?.date, portfolios: [], assignments: data.renovationCosts.design?.assignments || [], source: { type: 'design' } }); }
    const paidTotal = items.reduce((acc, i) => acc + i.paidAmount, 0);
    const pendingTotal = Math.max(0, totalProjectCost - paidTotal);
    return { items, paidTotal, pendingTotal, progress: totalProjectCost > 0 ? (paidTotal / totalProjectCost) * 100 : 0 };
  }, [data, totalProjectCost, designTotal]);

  const milestones = useMemo(() => {
    let cum = 0;
    const sorted = [...paymentStats.items].sort((a, b) => { const dA = a.date ? new Date(a.date).getTime() : 0; const dB = b.date ? new Date(b.date).getTime() : 0; if (dA !== 0 && dB !== 0) return dA - dB; if (a.paidAmount > 0 && b.paidAmount === 0) return -1; if (a.paidAmount === 0 && b.paidAmount > 0) return 1; return 0; });
    return sorted.map(item => { cum += item.amount; return { ...item, endPosition: (cum / totalProjectCost) * 100 }; }).filter(item => item.amount > (totalProjectCost * 0.02));
  }, [paymentStats.items, totalProjectCost]);

  const calendarData = useMemo(() => {
    const withDates = paymentStats.items.filter(i => i.date).sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
    const grouped = new Map<string, typeof withDates>();
    withDates.forEach(item => { const d = new Date(item.date!); const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (!grouped.has(sortKey)) grouped.set(sortKey, []); grouped.get(sortKey)!.push(item); });
    return Array.from(grouped.entries());
  }, [paymentStats.items]);

  const { portfolioUsage, rawPortfolioUsage } = useMemo(() => {
    const usage: Record<string, number> = {}; const assignments: CostAssignment[] = [];
    Object.values(data.purchaseCosts).forEach((c: any) => assignments.push(...(c.assignments || [])));
    (data.renovationCosts.worksBreakdown || []).forEach(w => assignments.push(...(w.assignments || [])));
    (data.renovationCosts.materialsBreakdown || []).forEach(m => assignments.push(...(m.assignments || [])));
    if (typeof data.renovationCosts.design === 'object') assignments.push(...(data.renovationCosts.design.assignments || []));
    assignments.forEach(a => { usage[a.portfolioId] = (usage[a.portfolioId] || 0) + safeNum(a.amount); });
    const mapped = data.portfolios.map(p => { const used = usage[p.id] || 0; return { ...p, used, remaining: p.initialBalance - used, percent: p.initialBalance > 0 ? (used / p.initialBalance) * 100 : 0 }; });
    return { portfolioUsage: mapped, rawPortfolioUsage: usage };
  }, [data]);

  const ownerContribution = useMemo(() => {
    const o1 = data.owner1Name || 'Giuseppe';
    const o2 = data.owner2Name || 'Claudia';
    const isOwner1 = (owner: string) => owner === o1 || owner === 'Giuseppe';
    const isOwner2 = (owner: string) => owner === o2 || owner === 'Claudia';

    const val1 = portfolioUsage.filter(p => isOwner1(p.owner)).reduce((acc, p) => acc + p.used, 0);
    const val2 = portfolioUsage.filter(p => isOwner2(p.owner) && !isOwner1(p.owner)).reduce((acc, p) => acc + p.used, 0);
    return [
      { name: o1, value: val1, color: CH.gius },
      { name: o2, value: val2, color: CH.clau }
    ].filter(v => v.value > 0);
  }, [portfolioUsage, isNeon, data.owner1Name, data.owner2Name]);

  const coverageChartData = useMemo(() => [
    { name: 'Fondi Disponibili', Mutuo: mortgageAmount, Cash: currentLiquidity, Immobile: 0, Acquisto: 0, Ristrutturazione: 0 },
    { name: 'Costi Previsti', Mutuo: 0, Cash: 0, Immobile: totalPrice, Acquisto: feesTotal, Ristrutturazione: totalRenovation },
  ], [mortgageAmount, currentLiquidity, totalPrice, feesTotal, totalRenovation]);

  const flowChartData = useMemo(() => [
    { stage: 'Start', value: 0 }, { stage: 'Prezzo Immobile', value: totalPrice }, { stage: '+ Oneri Acquisto', value: totalPrice + feesTotal },
    { stage: '+ Lavori Edili', value: totalPrice + feesTotal + worksTotal }, { stage: '+ Materiali', value: totalPrice + feesTotal + worksTotal + materialsTotal },
    { stage: '+ Tecnici', value: totalPrice + feesTotal + worksTotal + materialsTotal + designTotal }, { stage: '+ Imprevisti', value: totalProjectCost },
  ], [totalPrice, feesTotal, worksTotal, materialsTotal, designTotal, totalProjectCost]);

  const openAssignmentModal = (item: any) => setModalState({ isOpen: true, itemSource: item.source, totalCost: item.amount, currentAssignments: item.assignments });
  const handleAssignmentUpdate = (newAssignments: CostAssignment[]) => {
    if (!modalState.itemSource || !onChange) return;
    const { type, key, id } = modalState.itemSource; let newData = { ...data };
    if (type === 'purchase' && key) { /* @ts-ignore */ newData.purchaseCosts = { ...newData.purchaseCosts, [key]: { ...newData.purchaseCosts[key as keyof typeof newData.purchaseCosts], assignments: newAssignments } }; }
    else if (type === 'work' && id) { newData.renovationCosts = { ...newData.renovationCosts, worksBreakdown: newData.renovationCosts.worksBreakdown.map(w => w.id === id ? { ...w, assignments: newAssignments } : w) }; }
    else if (type === 'design') { newData.renovationCosts = { ...newData.renovationCosts, design: { ...newData.renovationCosts.design, assignments: newAssignments } }; }
    onChange(newData); setModalState({ ...modalState, isOpen: false });
  };

  const tipStyle = { borderRadius: '12px', border: `1px solid ${CH.tipBorder}`, background: CH.tip, boxShadow: '0 16px 36px -12px rgba(0,0,0,.4)', fontSize: '12px', color: CH.axis };

  return (
    <div className={`ipb${isNeon ? '' : ' light'}`}>
      <style>{IPB_REPORT_CSS}</style>
      <div className="repwrap">
        {/* 1. STATO PAGAMENTI */}
        <div className="paycard">
          <div className="pay-grid">
            <div className="pay-left">
              <div>
                <div className="pay-head"><div className="pay-ic">{svgI('<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', 20)}</div><div><h2>Stato Pagamenti</h2><p className="micro" style={{ color: '#8b97ab' }}>Flusso di cassa in uscita</p></div></div>
                <div className="pay-total"><h3>€ {fmt(paymentStats.paidTotal)}</h3><span>/ € {fmt(totalProjectCost)}</span></div>
              </div>
              <div className="pay-prog">
                <div className="pay-prog-head"><span className="micro" style={{ color: '#8b97ab' }}>Timeline Milestones</span><span className="micro" style={{ color: paymentStats.progress >= 100 ? '#2fd6a3' : '#59b0ff' }}>{paymentStats.progress.toFixed(1)}% versato</span></div>
                <div className="pbar"><div className="pbar-fill" style={{ width: `${paymentStats.progress}%` }}><span className="pbar-dot" /></div>
                  {milestones.map((m, idx) => { const isPartial = m.paidAmount > 0 && !m.isPaid; return (
                    <div className="mile" key={idx} style={{ left: `${m.endPosition}%` }}><div className={`mile-dot ${m.isPaid ? 'paid' : isPartial ? 'part' : 'none'}`} />
                      <div className="mile-tip"><div className="mt-lab">{m.isPaid ? '✓' : isPartial ? '~' : '⌛'} {m.label}</div><div className="mt-num">Tot: € {fmt(m.amount)}</div>{isPartial && <div className="mt-num pos">Vers: € {fmt(m.paidAmount)}</div>}<div className="mt-date">{m.date ? new Date(m.date).toLocaleDateString('it-IT') : 'Data N/D'}</div></div>
                    </div>); })}
                </div>
                <div className="pay-prog-foot"><span>Start</span><span>Completamento</span></div>
              </div>
            </div>
            <div className="pay-right">
              <div className="pay-mini"><p className="micro warn">Ancora da saldare</p><p className="pm-big">€ {fmt(paymentStats.pendingTotal)}</p><p className="pm-sub">Impegni futuri</p></div>
              <div className="pay-mini"><p className="micro acc">Valore immobile</p><p className="pm-big">€ {fmt(totalPrice)}</p><p className="pm-sub">Budget allocato</p></div>
            </div>
          </div>
        </div>

        {/* 2. SOSTENIBILITÀ */}
        <div className={`sust ${financialStatus.toLowerCase()}`}>
          <div className="sust-top">
            <div className="sust-ic">{financialStatus === 'SAFE' ? '✓' : financialStatus === 'WARNING' ? '!' : '✕'}</div>
            <div><h3>{financialStatus === 'SAFE' ? 'Progetto Sostenibile' : financialStatus === 'WARNING' ? 'Sostenibilità Parziale (Solo Acquisto)' : 'Progetto Insostenibile'}</h3>
              <p>{financialStatus === 'SAFE' ? `Hai liquidità sufficiente per coprire l'acquisto, le spese accessorie e tutti i lavori di ristrutturazione previsti, con un margine di sicurezza di € ${fmt(liquidityMargin)}.` : financialStatus === 'WARNING' ? `Attenzione: la liquidità copre l'acquisto dell'immobile (€ ${fmt(cashNeededForPurchase)}), ma NON è sufficiente per completare la ristrutturazione. Mancano € ${fmt(Math.abs(liquidityMargin))}.` : `Critico: la liquidità attuale non è sufficiente nemmeno per coprire l'acquisto e le spese accessorie. Mancano € ${fmt(Math.abs(liquidityAfterPurchase))} solo per arrivare al rogito.`}</p>
            </div>
          </div>
          <div className="sust-phases">
            <div className={`phase ${isPurchaseSustainable ? 'ok' : 'bad'}`}><div><p className="micro">Fase 1: Rogito (Equity + Spese)</p><p className="phase-v">€ {fmt(cashNeededForPurchase)}</p><p className="phase-s">Anticipo: € {fmt(downPaymentRequired)} + Spese: € {fmt(feesTotal)}</p></div><span className={`phase-tag ${isPurchaseSustainable ? 'ok' : 'bad'}`}>{isPurchaseSustainable ? 'Coperto' : 'Scoperto'}</span></div>
            <div className={`phase ${isRenovationSustainable ? 'ok' : totalRenovation > 0 ? 'warn' : ''}`}><div><p className="micro">Fase 2: Ristrutturazione</p><p className="phase-v">€ {fmt(totalRenovation)}</p><p className="phase-s">Edili/Mat: €{fmt(worksTotal + materialsTotal)} + Tecnici: €{fmt(designTotal)} + Varie: €{fmt(contingencyTotal)}</p></div><span className={`phase-tag ${totalRenovation === 0 ? 'na' : isRenovationSustainable ? 'ok' : 'warn'}`}>{totalRenovation === 0 ? 'N/A' : isRenovationSustainable ? 'Coperto' : 'Parziale'}</span></div>
          </div>
        </div>

        {/* 3. WIDGETS */}
        <div className="kpis4">
          <div className="kpi indigo"><p className="micro">Mutuo Richiesto</p><h3>€ {fmt(mortgageAmount)}</h3><p className="kpi-s">{loanPercentage}% del valore immobile</p></div>
          <div className="kpi"><p className="micro">Costo Totale</p><h3>€ {fmt(totalProjectCost)}</h3><p className="kpi-s">Investimento complessivo</p></div>
          <div className="kpi"><p className="micro">Cash Necessario</p><h3>€ {fmt(totalCashRequired)}</h3><p className="kpi-s">Anticipo + Oneri + Lavori</p></div>
          <div className={`kpi ${liquidityMargin < 0 ? 'neg' : 'pos'}`}><p className="micro">Margine Liquidità</p><h3>€ {fmt(liquidityMargin)}</h3><p className="kpi-s">Fondi residui post-operazione</p></div>
        </div>

        {/* 4. DETTAGLI */}
        <div className="ops">
          <div className="panel pad ops-table">
            <h4>Dettaglio Voci &amp; Scadenze</h4>
            <div className="tablewrap"><table><thead><tr><th>Voce</th><th>Importo</th><th>Versato</th><th>Stato</th><th>Scadenza</th><th>Wallet</th></tr></thead>
              <tbody>{paymentStats.items.map((item, idx) => (
                <tr key={idx}><td className="td-lab">{item.label}</td><td className="td-amt">€ {fmt(item.amount)}</td><td className="td-paid">€ {fmt(item.paidAmount)}</td>
                  <td><span className={`st ${item.isPaid ? 'paid' : item.paidAmount > 0 ? 'part' : 'none'}`}>{item.isPaid ? 'Saldato' : item.paidAmount > 0 ? 'Parziale' : 'In Attesa'}</span></td>
                  <td className="td-date">{item.date ? new Date(item.date).toLocaleDateString('it-IT') : '-'}</td><td className="td-wal">{item.portfolios.join(', ') || '-'}</td></tr>))}
              </tbody></table></div>
          </div>
          <div className="panel pad ops-pie">
            <h4>Fonti di Finanziamento</h4>
            <div className="pie-area"><ResponsiveContainer><PieChart><Pie data={ownerContribution} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" cornerRadius={5}>{ownerContribution.map((entry, index) => <Cell key={index} fill={entry.color} />)}</Pie><RechartsTooltip contentStyle={tipStyle} /></PieChart></ResponsiveContainer>
              <div className="pie-center"><span className="micro">Cash Totale</span><span className="pie-num">€ {fmt(ownerContribution.reduce((a, b) => a + b.value, 0))}</span></div></div>
            <div className="pie-leg">{ownerContribution.map((oc, i) => <div className="pie-leg-row" key={i}><div className="lft"><span className="dot" style={{ background: oc.color }} />{oc.name}</div><span className="num">€ {fmt(oc.value)}</span></div>)}</div>
          </div>
        </div>

        {/* 5. CALENDARIO */}
        <div className="panel pad">
          <h3 className="cal-h3">{svgI('<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>', 18)} Calendario Scadenze</h3>
          {calendarData.length === 0 ? <div className="cal-empty">Nessuna data di scadenza assegnata alle voci di costo. Inserisci le date nell'Editor Dati.</div> : (
            <div className="cal-grid">{calendarData.map(([key, items]) => { const [year, month] = key.split('-'); const dateObj = new Date(parseInt(year), parseInt(month) - 1); const monthName = dateObj.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
              return (<div className="cal-month" key={key}><h4>{monthName}<span className="cal-count">{items.length}</span></h4>
                <div className="cal-items">{items.map((item, idx) => { const assignedAmount = item.assignments.reduce((s, a) => s + (a.amount || 0), 0); const isFullyCovered = Math.abs(assignedAmount - item.amount) < 0.01;
                  return (<div className={`cal-item${isFullyCovered ? '' : ' uncov'}`} key={idx} onClick={() => openAssignmentModal(item)} title="Clicca per assegnare portafogli">
                    <div className="ci-top"><div className="ci-info"><p className="ci-lab">{item.label}</p><p className="ci-amt">€ {fmt(item.amount)}</p></div><div className={`ci-dot ${item.isPaid ? 'paid' : 'wait'}`} /></div>
                    <div className="ci-bar"><div className={`ci-fill ${isFullyCovered ? 'ok' : 'warn'}`} style={{ width: `${Math.min((assignedAmount / item.amount) * 100, 100)}%` }} /></div>
                    <div className="ci-foot"><span className={isFullyCovered ? 'ok' : 'warn'}>{isFullyCovered ? 'Coperto' : 'Assegna Fondi'}</span>{!isFullyCovered && <div className="ci-plus">+</div>}</div></div>); })}
                </div>
                <div className="cal-foot"><span>Tot. Mese</span><span>€ {fmt(items.reduce((acc, i) => acc + i.amount, 0))}</span></div></div>); })}
            </div>)}
        </div>

        {/* 6. GRAFICI */}
        <div className="charts2">
          <div className="panel pad chartcard">
            <div className="cc-head"><h3>Copertura Finanziaria</h3><p className="micro">Fondi vs allocazione budget</p></div>
            <div className="cc-body"><ResponsiveContainer width="100%" height="100%"><BarChart data={coverageChartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CH.grid} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: CH.axis }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: CH.axis }} />
              <RechartsTooltip cursor={{ fill: isNeon ? 'rgba(255,255,255,.04)' : '#f8fafc' }} contentStyle={tipStyle} /><Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 700, color: CH.axis }} />
              <Bar dataKey="Mutuo" stackId="a" fill={CH.accent} radius={[0, 0, 4, 4]} barSize={60} /><Bar dataKey="Cash" stackId="a" fill={CH.cash} radius={[12, 12, 0, 0]} barSize={60} />
              <Bar dataKey="Immobile" stackId="a" fill={CH.immobile} radius={[0, 0, 4, 4]} barSize={60} /><Bar dataKey="Acquisto" stackId="a" fill={CH.accent} barSize={60} /><Bar dataKey="Ristrutturazione" stackId="a" fill={CH.reno} radius={[12, 12, 0, 0]} barSize={60} />
            </BarChart></ResponsiveContainer></div>
          </div>
          <div className="panel pad chartcard">
            <div className="cc-head"><h3>Flusso Cumulativo Investimento</h3><p className="micro">Esborso progressivo per fase</p></div>
            <div className="cc-body"><ResponsiveContainer width="100%" height="100%"><AreaChart data={flowChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs><linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={CH.flow} stopOpacity={0.25} /><stop offset="95%" stopColor={CH.flow} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CH.grid} /><XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: CH.axis }} dy={10} interval={0} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: CH.axis }} />
              <RechartsTooltip contentStyle={tipStyle} /><Area type="monotone" dataKey="value" stroke={CH.flow} strokeWidth={3} fillOpacity={1} fill="url(#colorFlow)" />
            </AreaChart></ResponsiveContainer></div>
          </div>
        </div>

        <SmartAssignmentModal isOpen={modalState.isOpen} onClose={() => setModalState({ ...modalState, isOpen: false })} totalCost={modalState.totalCost} currentAssignments={modalState.currentAssignments} portfolios={data.portfolios} portfolioUsage={rawPortfolioUsage} onConfirm={handleAssignmentUpdate} />
      </div>
    </div>
  );
};

const svgI = (p: string, s = 16, sw = 2) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: p }} />);

const IPB_REPORT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&display=swap');
.ipb{ --font:'Geist','DM Sans',system-ui,sans-serif; --mono:'Geist Mono',ui-monospace,monospace;
  --bg:#0a0e16; --panel:#111827; --panel-2:#151d2d; --inset:#0c121e; --border:rgba(255,255,255,.07); --border-2:rgba(255,255,255,.12);
  --text:#eaeff7; --dim:#8b97ab; --faint:#58637a; --accent:#2f8fff; --accent-2:#6f63ff; --accent-soft:rgba(47,143,255,.14); --glow:rgba(47,143,255,.28);
  --pos:#2fd6a3; --pos-soft:rgba(47,214,163,.14); --neg:#fb6f86; --neg-soft:rgba(251,111,134,.14); --warn:#f5b942; --warn-soft:rgba(245,185,66,.14);
  --indigo:#8b8bff; --indigo-soft:rgba(139,139,255,.12); --r:11px; --r-sm:8px; --r-lg:16px; font-family:var(--font); color:var(--text); text-align:left; }
.ipb.light{ --bg:#f4f6fb; --panel:#fff; --panel-2:#fff; --inset:#f1f4f9; --border:rgba(15,23,42,.09); --border-2:rgba(15,23,42,.16);
  --text:#0c1424; --dim:#5a6679; --faint:#9aa6bb; --accent:#0a6cff; --accent-2:#5b4bff; --accent-soft:rgba(10,108,255,.10); --glow:rgba(10,108,255,.18);
  --pos:#0fa47a; --pos-soft:rgba(15,164,122,.12); --neg:#e23d63; --neg-soft:rgba(226,61,99,.10); --warn:#d98a0b; --warn-soft:rgba(217,138,11,.12); --indigo:#5b4bff; --indigo-soft:rgba(91,75,255,.10); }
.ipb *{ box-sizing:border-box; }
.ipb .repwrap{ display:flex; flex-direction:column; gap:20px; }
.ipb .micro{ font-family:var(--mono); font-size:9px; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--faint); } .ipb .micro.warn{ color:var(--warn); } .ipb .micro.acc{ color:var(--accent); }
.ipb .num{ font-family:var(--mono); font-weight:600; color:var(--text); }
.ipb .panel{ background:var(--panel); border:1px solid var(--border); border-radius:var(--r-lg); } .ipb .panel.pad{ padding:22px; }

/* paycard */
.ipb .paycard{ background:linear-gradient(150deg,#10182b,#0a0e16); color:#fff; border:1px solid rgba(255,255,255,.08); border-radius:24px; padding:30px; }
.ipb.light .paycard{ background:linear-gradient(150deg,#0f172a,#1e293b); }
.ipb .pay-grid{ display:grid; grid-template-columns:1.4fr 1fr; gap:40px; }
.ipb .pay-left{ display:flex; flex-direction:column; justify-content:space-between; gap:40px; }
.ipb .pay-head{ display:flex; align-items:center; gap:14px; } .ipb .pay-ic{ width:46px; height:46px; border-radius:14px; background:rgba(255,255,255,.1); display:grid; place-items:center; } .ipb .pay-head h2{ margin:0; font-size:19px; font-weight:700; color:#fff; }
.ipb .pay-total{ display:flex; align-items:baseline; gap:14px; margin-top:24px; } .ipb .pay-total h3{ margin:0; font-family:var(--mono); font-size:44px; font-weight:700; letter-spacing:-.03em; color:#fff; } .ipb .pay-total span{ color:#8b97ab; font-weight:600; font-size:14px; }
.ipb .pay-prog-head{ display:flex; justify-content:space-between; margin-bottom:12px; }
.ipb .pbar{ position:relative; width:100%; height:12px; background:rgba(255,255,255,.08); border-radius:20px; }
.ipb .pbar-fill{ position:absolute; left:0; top:0; height:100%; background:#2fd6a3; border-radius:20px; z-index:1; transition:width 1s ease-out; } .ipb .pbar-dot{ position:absolute; right:0; top:50%; transform:translateY(-50%); width:8px; height:8px; background:#fff; border-radius:50%; box-shadow:0 0 10px rgba(47,214,163,.8); }
.ipb .mile{ position:absolute; top:50%; transform:translateY(-50%); z-index:2; }
.ipb .mile-dot{ width:13px; height:13px; border-radius:50%; border:2px solid; cursor:pointer; transition:transform .15s; } .ipb .mile:hover .mile-dot{ transform:scale(1.25); } .ipb .mile-dot.paid{ background:#2fd6a3; border-color:#9af5db; } .ipb .mile-dot.part{ background:#f5b942; border-color:#fbe2a8; } .ipb .mile-dot.none{ background:#334155; border-color:#64748b; }
.ipb .mile-tip{ position:absolute; bottom:22px; left:50%; transform:translateX(-50%); opacity:0; transition:opacity .15s; background:#0a0e16; border:1px solid rgba(255,255,255,.14); border-radius:9px; padding:7px 11px; white-space:nowrap; pointer-events:none; z-index:30; } .ipb .mile:hover .mile-tip{ opacity:1; }
.ipb .mt-lab{ font-size:10px; font-weight:700; color:#fff; margin-bottom:3px; } .ipb .mt-num{ font-family:var(--mono); font-size:10px; color:#cbd5e1; } .ipb .mt-num.pos{ color:#2fd6a3; } .ipb .mt-date{ font-size:8px; color:#64748b; text-transform:uppercase; font-weight:700; margin-top:3px; }
.ipb .pay-prog-foot{ display:flex; justify-content:space-between; margin-top:14px; font-family:var(--mono); font-size:9px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.1em; }
.ipb .pay-right{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.ipb .pay-mini{ background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:18px; padding:22px; display:flex; flex-direction:column; justify-content:center; } .ipb .pm-big{ font-family:var(--mono); font-size:23px; font-weight:700; color:#fff; margin:6px 0 0; } .ipb .pm-sub{ font-size:9px; color:#64748b; margin:4px 0 0; }

/* sostenibilità */
.ipb .sust{ border:1px solid; border-radius:24px; padding:28px; display:flex; flex-direction:column; gap:22px; }
.ipb .sust.safe{ background:var(--pos-soft); border-color:transparent; } .ipb .sust.warning{ background:var(--warn-soft); border-color:transparent; } .ipb .sust.critical{ background:var(--neg-soft); border-color:transparent; }
.ipb .sust-top{ display:flex; gap:18px; align-items:flex-start; }
.ipb .sust-ic{ width:60px; height:60px; border-radius:18px; display:grid; place-items:center; font-size:26px; font-weight:700; flex:none; } .ipb .sust.safe .sust-ic{ background:var(--pos-soft); color:var(--pos); } .ipb .sust.warning .sust-ic{ background:var(--warn-soft); color:var(--warn); } .ipb .sust.critical .sust-ic{ background:var(--neg-soft); color:var(--neg); }
.ipb .sust-top h3{ margin:0 0 6px; font-size:19px; font-weight:700; } .ipb .sust.safe h3{ color:var(--pos); } .ipb .sust.warning h3{ color:var(--warn); } .ipb .sust.critical h3{ color:var(--neg); }
.ipb .sust-top p{ margin:0; font-size:13px; line-height:1.6; color:var(--dim); max-width:680px; }
.ipb .sust-phases{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.ipb .phase{ background:var(--panel); border:1px solid var(--border); border-radius:16px; padding:16px; display:flex; align-items:center; justify-content:space-between; gap:12px; } .ipb .phase.ok{ border-color:var(--pos-soft); } .ipb .phase.bad{ border-color:var(--neg-soft); } .ipb .phase.warn{ border-color:var(--warn-soft); }
.ipb .phase-v{ font-family:var(--mono); font-size:18px; font-weight:700; margin:4px 0; } .ipb .phase-s{ font-size:10px; color:var(--faint); margin:0; }
.ipb .phase-tag{ font-family:var(--mono); font-size:10px; font-weight:700; text-transform:uppercase; padding:5px 11px; border-radius:8px; flex:none; } .ipb .phase-tag.ok{ background:var(--pos-soft); color:var(--pos); } .ipb .phase-tag.bad{ background:var(--neg-soft); color:var(--neg); } .ipb .phase-tag.warn{ background:var(--warn-soft); color:var(--warn); } .ipb .phase-tag.na{ background:var(--inset); color:var(--faint); }

/* kpis4 */
.ipb .kpis4{ display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
.ipb .kpi{ background:var(--panel); border:1px solid var(--border); border-radius:20px; padding:22px; } .ipb .kpi.indigo{ background:var(--indigo-soft); border-color:transparent; } .ipb .kpi.pos{ background:var(--pos-soft); border-color:transparent; } .ipb .kpi.neg{ background:var(--neg-soft); border-color:transparent; }
.ipb .kpi h3{ margin:8px 0 4px; font-family:var(--mono); font-size:26px; font-weight:700; letter-spacing:-.02em; } .ipb .kpi.indigo h3{ color:var(--indigo); } .ipb .kpi.pos h3{ color:var(--pos); } .ipb .kpi.neg h3{ color:var(--neg); }
.ipb .kpi .kpi-s{ font-size:11px; color:var(--dim); margin:0; } .ipb .kpi.indigo .micro{ color:var(--indigo); }

/* ops */
.ipb .ops{ display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.ipb .ops h4{ margin:0 0 18px; font-size:18px; font-weight:700; }
.ipb .tablewrap{ overflow-x:auto; } .ipb table{ width:100%; border-collapse:collapse; }
.ipb thead th{ text-align:left; font-family:var(--mono); font-size:9px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); padding:0 8px 12px; border-bottom:1px solid var(--border); }
.ipb tbody td{ padding:11px 8px; border-bottom:1px solid var(--border); font-size:13px; } .ipb tbody tr:hover{ background:var(--inset); }
.ipb .td-lab{ font-weight:700; } .ipb .td-amt{ font-family:var(--mono); font-weight:700; } .ipb .td-paid{ font-family:var(--mono); font-weight:700; color:var(--pos); } .ipb .td-date{ font-size:11px; color:var(--dim); } .ipb .td-wal{ font-family:var(--mono); font-size:10px; color:var(--faint); }
.ipb .st{ font-family:var(--mono); font-size:9px; font-weight:700; text-transform:uppercase; padding:4px 8px; border-radius:6px; } .ipb .st.paid{ background:var(--pos-soft); color:var(--pos); } .ipb .st.part{ background:var(--warn-soft); color:var(--warn); } .ipb .st.none{ background:var(--inset); color:var(--faint); }
.ipb .ops-pie{ display:flex; flex-direction:column; } .ipb .pie-area{ flex:1; min-height:230px; position:relative; } .ipb .pie-center{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; } .ipb .pie-num{ font-family:var(--mono); font-size:19px; font-weight:700; margin-top:3px; }
.ipb .pie-leg{ margin-top:14px; display:flex; flex-direction:column; gap:8px; } .ipb .pie-leg-row{ display:flex; align-items:center; justify-content:space-between; font-size:12px; } .ipb .pie-leg-row .lft{ display:flex; align-items:center; gap:8px; font-weight:700; color:var(--dim); } .ipb .dot{ width:11px; height:11px; border-radius:50%; }

/* calendar */
.ipb .cal-h3{ margin:0 0 18px; font-size:18px; font-weight:700; display:flex; align-items:center; gap:9px; } .ipb .cal-h3 svg{ color:var(--dim); }
.ipb .cal-empty{ text-align:center; padding:34px; color:var(--faint); font-style:italic; font-size:13px; }
.ipb .cal-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; }
.ipb .cal-month{ background:var(--inset); border:1px solid var(--border); border-radius:16px; padding:14px; height:fit-content; }
.ipb .cal-month h4{ margin:0 0 12px; font-size:13px; font-weight:700; text-transform:capitalize; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:9px; } .ipb .cal-count{ font-family:var(--mono); font-size:9px; background:var(--panel); padding:2px 7px; border-radius:20px; color:var(--dim); }
.ipb .cal-items{ display:flex; flex-direction:column; gap:8px; }
.ipb .cal-item{ background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:10px; cursor:pointer; transition:border-color .15s; } .ipb .cal-item:hover{ border-color:var(--accent); } .ipb .cal-item.uncov{ border-color:var(--warn-soft); }
.ipb .ci-top{ display:flex; justify-content:space-between; align-items:center; margin-bottom:7px; } .ipb .ci-info{ min-width:0; padding-right:8px; } .ipb .ci-lab{ font-size:10px; font-weight:700; color:var(--dim); margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .ipb .ci-amt{ font-family:var(--mono); font-size:14px; font-weight:700; margin:2px 0 0; }
.ipb .ci-dot{ width:10px; height:10px; border-radius:50%; flex:none; } .ipb .ci-dot.paid{ background:var(--pos); box-shadow:0 0 0 3px var(--pos-soft); } .ipb .ci-dot.wait{ background:var(--faint); box-shadow:0 0 0 3px var(--inset); }
.ipb .ci-bar{ width:100%; height:6px; background:var(--inset); border-radius:20px; overflow:hidden; margin-top:4px; } .ipb .ci-fill{ height:100%; } .ipb .ci-fill.ok{ background:var(--pos); } .ipb .ci-fill.warn{ background:var(--warn); }
.ipb .ci-foot{ display:flex; justify-content:space-between; align-items:center; margin-top:6px; } .ipb .ci-foot span{ font-family:var(--mono); font-size:8px; font-weight:700; text-transform:uppercase; } .ipb .ci-foot .ok{ color:var(--pos); } .ipb .ci-foot .warn{ color:var(--warn); } .ipb .ci-plus{ width:16px; height:16px; border-radius:50%; border:1px solid var(--warn); display:grid; place-items:center; font-size:9px; color:var(--warn); }
.ipb .cal-foot{ margin-top:12px; padding-top:9px; border-top:1px solid var(--border); display:flex; justify-content:space-between; font-family:var(--mono); font-size:9px; font-weight:700; text-transform:uppercase; color:var(--faint); }

/* charts */
.ipb .charts2{ display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.ipb .chartcard{ display:flex; flex-direction:column; } .ipb .cc-head{ margin-bottom:18px; } .ipb .cc-head h3{ margin:0 0 4px; font-size:18px; font-weight:700; } .ipb .cc-body{ flex:1; min-height:290px; }

@media (max-width:1000px){ .ipb .pay-grid,.ipb .sust-phases,.ipb .ops,.ipb .charts2{ grid-template-columns:1fr; } .ipb .kpis4{ grid-template-columns:1fr 1fr; } .ipb .pay-right{ grid-template-columns:1fr 1fr; } }
@media (max-width:600px){ .ipb .kpis4,.ipb .pay-right{ grid-template-columns:1fr; } }
`;

export default Dashboard;
