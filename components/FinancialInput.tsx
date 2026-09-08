import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FinancialData, CostDetail, Scenario, RenovationItem, Attachment, Portfolio, CostAssignment, PaymentRecord, Property } from '../types.ts';
import { SmartAssignmentModal } from './SmartAssignmentModal.tsx';
import { db } from '../services/dbService';

/* =====================================================================================
   ImmoPlan · Acquisto / Editor Finanziario — "Bento Terminal" reskin.
   Logica 100% identica all'originale (scenari, portafogli, assegnazioni, breakdown).
   Stile via CSS scoped sotto `.ipb`. Tema scuro col tema "Neon", chiaro altrimenti.
   ===================================================================================== */

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
  if (typeof val === 'string') { const p = parseFloat(val); return isNaN(p) || !isFinite(p) ? 0 : p; }
  return 0;
};
const fmt = (n?: number) => Math.round(safeNum(n)).toLocaleString('it-IT');
const readFile = (file: File): Promise<Attachment> => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, data: reader.result as string, type: file.type }); reader.onerror = reject; reader.readAsDataURL(file);
});
const ic = (p: string, s = 16, sw = 1.9) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: p }} />);
const P = {
  clip: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  card: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14a2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  euro: '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/><path d="M12 18V6"/>',
  wrench: '<path d="m15 5 4 4"/><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>',
  pencil: '<path d="M12 3a2.85 2.83 0 1 1 4 4L7.5 17.5 2 19l1.5-5.5Z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
  bldg: '<path d="M3 22V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v17"/><path d="M2 22h20"/><path d="M13 22V9a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v13"/>',
};

const FileUploader = ({ attachment, onUpload, onDelete }: { attachment?: Attachment; onUpload: (file: File) => void; onDelete: () => void }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="fu">
      {attachment ? (
        <div className="fu-has">{ic(P.clip, 13)}<span>{attachment.name}</span><button onClick={e => { e.stopPropagation(); onDelete(); }}>×</button></div>
      ) : (
        <button className="fu-btn" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>{ic(P.clip, 13)} Allega File
          <input type="file" ref={fileInputRef} hidden onChange={e => { if (e.target.files?.[0]) { onUpload(e.target.files[0]); e.target.value = ''; } }} />
        </button>
      )}
    </div>
  );
};

const PortfolioManager = ({
  portfolios,
  onChange,
  owner1Name = 'Giuseppe',
  owner2Name = 'Claudia'
}: {
  portfolios: Portfolio[];
  onChange: (p: Portfolio[]) => void;
  owner1Name?: string;
  owner2Name?: string;
}) => {
  const addPortfolio = (owner: string) => onChange([...portfolios, { id: Date.now().toString(), name: `Nuovo Conto ${owner}`, owner, initialBalance: 0 }]);
  const updatePortfolio = (id: string, u: Partial<Portfolio>) => onChange(portfolios.map(p => p.id === id ? { ...p, ...u } : p));
  const deletePortfolio = (id: string) => { if (confirm('Eliminare questo portafoglio?')) onChange(portfolios.filter(p => p.id !== id)); };
  const o1Initial = owner1Name.charAt(0).toUpperCase();
  const o2Initial = owner2Name.charAt(0).toUpperCase();
  return (
    <div className="panel pad">
      <div className="pm-head">
        <div><h4>Liquidità Disponibile</h4><p className="muted">Gestisci i conti e i budget di partenza</p></div>
        <div className="pm-add">
          <button className="ownbtn g" onClick={() => addPortfolio(owner1Name)}>
            <span className="ow">{o1Initial}</span> + {owner1Name}
          </button>
          <button className="ownbtn c" onClick={() => addPortfolio(owner2Name)}>
            <span className="ow">{o2Initial}</span> + {owner2Name}
          </button>
        </div>
      </div>
      <div className="pm-grid">
        {portfolios.map(p => {
          const isOwner1 = p.owner === owner1Name || p.owner === 'Giuseppe';
          const isOwner2 = p.owner === owner2Name || p.owner === 'Claudia';
          const badgeLetter = isOwner1 ? o1Initial : isOwner2 ? o2Initial : (p.owner ? p.owner.charAt(0).toUpperCase() : '?');
          return (
            <div className="pm-card" key={p.id}>
              <div className="pm-top">
                <div className={`pm-badge ${isOwner1 ? 'g' : 'c'}`} title={`Intestato a: ${p.owner}`}>
                  {badgeLetter}
                </div>
                <button className="pm-del" onClick={() => deletePortfolio(p.id)}>
                  {ic('<path d="M18 6L6 18M6 6l12 12"/>', 13)}
                </button>
              </div>
              <input className="pm-name" type="text" value={p.name} onChange={e => updatePortfolio(p.id, { name: e.target.value })} placeholder="Nome Conto" />
              <div className="pm-money"><span className="cur">€</span><input type="number" value={p.initialBalance || ''} onChange={e => updatePortfolio(p.id, { initialBalance: parseFloat(e.target.value) || 0 })} placeholder="0" /></div>
            </div>
          );
        })}
        {portfolios.length === 0 && <div className="pm-empty">Nessun portafoglio configurato. Aggiungine uno per iniziare.</div>}
      </div>
    </div>
  );
};

const AssignmentManager = ({ amount, assignments, portfolios, onUpdate, portfolioUsage }: { amount: number; assignments: CostAssignment[]; portfolios: Portfolio[]; onUpdate: (a: CostAssignment[]) => void; portfolioUsage: Record<string, number> }) => {
  const [showSmartModal, setShowSmartModal] = useState(false);
  const assignedTotal = assignments.reduce((acc, a) => acc + (a.amount || 0), 0);
  const diff = amount - assignedTotal;
  const updateAssignment = (i: number, u: Partial<CostAssignment>) => { const next = [...assignments]; next[i] = { ...next[i], ...u }; onUpdate(next); };
  const removeAssignment = (i: number) => onUpdate(assignments.filter((_, x) => x !== i));
  return (
    <div className="asgn">
      <div className="asgn-head"><label className="micro">{ic(P.card, 13)} Pagamenti</label><span className={`asgn-tag ${Math.abs(diff) < 0.01 ? 'ok' : 'bad'}`}>{Math.abs(diff) < 0.01 ? '✓ Coperto' : `Mancano € ${fmt(diff)}`}</span></div>
      <div className="asgn-list">
        {assignments.map((asgn, i) => {
          const portfolio = portfolios.find(p => p.id === asgn.portfolioId);
          const totalUsed = portfolioUsage[asgn.portfolioId] || 0; const currentVal = asgn.amount || 0; const initial = portfolio?.initialBalance || 0;
          const availableReal = initial - (totalUsed - currentVal); const isOverdraft = currentVal > availableReal + 0.01;
          return (
            <div className={`asgn-row${isOverdraft ? ' over' : ''}`} key={i}>
              <div className="asgn-sel"><select value={asgn.portfolioId} onChange={e => updateAssignment(i, { portfolioId: e.target.value })}>{portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>{isOverdraft && <span className="over-ic">{ic(P.warn, 12)}</span>}</div>
              <div className="asgn-vals"><input type="number" value={asgn.amount === 0 ? '' : asgn.amount} onChange={e => updateAssignment(i, { amount: parseFloat(e.target.value) || 0 })} /><input type="date" value={asgn.date} onChange={e => updateAssignment(i, { date: e.target.value })} /><button onClick={() => removeAssignment(i)}>×</button></div>
            </div>
          );
        })}
        <button className="asgn-manage" onClick={() => setShowSmartModal(true)}>{ic(P.check, 12)} Gestisci Pagamenti</button>
      </div>
      <SmartAssignmentModal isOpen={showSmartModal} onClose={() => setShowSmartModal(false)} totalCost={amount} currentAssignments={assignments} portfolios={portfolios} portfolioUsage={portfolioUsage} onConfirm={(n: CostAssignment[]) => onUpdate(n)} />
    </div>
  );
};

const PayableCostInput = ({ label, cost, portfolios, onUpdate, portfolioUsage, readOnlyAmount = false, onLabelChange }: { label: string; cost: CostDetail; portfolios: Portfolio[]; onUpdate: (u: CostDetail) => void; portfolioUsage: Record<string, number>; readOnlyAmount?: boolean; onLabelChange?: (l: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localPaidInput, setLocalPaidInput] = useState(cost.paidAmount ? cost.paidAmount.toString() : '');
  useEffect(() => { const pv = safeNum(cost.paidAmount); const lv = parseFloat(localPaidInput) || 0; if (Math.abs(pv - lv) > 0.001) setLocalPaidInput(pv === 0 ? '' : pv.toString()); }, [cost.paidAmount]);
  const handlePaidChange = (valStr: string) => { setLocalPaidInput(valStr); const val = parseFloat(valStr.replace(',', '.')); const safeVal = isNaN(val) ? 0 : val; const total = safeNum(cost.amount); onUpdate({ ...cost, paidAmount: safeVal, isPaid: safeVal >= total && safeVal > 0, paymentDate: (safeVal > 0 && !cost.paymentDate) ? new Date().toISOString().split('T')[0] : cost.paymentDate, assignments: [] }); };
  const handleAssignmentUpdate = (na: CostAssignment[]) => { const newPaidTotal = na.reduce((s, a) => s + (a.amount || 0), 0); const total = safeNum(cost.amount); onUpdate({ ...cost, assignments: na, paidAmount: newPaidTotal, isPaid: newPaidTotal >= total && newPaidTotal > 0, paymentDate: na.length > 0 ? na[na.length - 1].date : cost.paymentDate }); };
  const handleAttach = async (file: File) => onUpdate({ ...cost, attachment: await readFile(file) });
  const isPaid = safeNum(cost.paidAmount) >= safeNum(cost.amount) && safeNum(cost.amount) > 0;
  const isPartial = safeNum(cost.paidAmount) > 0 && !isPaid;
  return (
    <div className={`pci${isOpen ? ' open' : ''}`}>
      <div className="pci-head" onClick={() => setIsOpen(!isOpen)}>
        <div className={`pci-stat ${isPaid ? 'paid' : isPartial ? 'part' : 'none'}`}>{isPaid ? '✓' : isPartial ? '≈' : '€'}</div>
        <div className="pci-main">
          <div className="pci-label">{onLabelChange ? <input type="text" value={label} onClick={e => e.stopPropagation()} onChange={e => onLabelChange(e.target.value)} placeholder="Nome Spesa" /> : <p>{label}</p>}
            {!isOpen && <div className="pci-meta">{cost.paymentDate && <span>{new Date(cost.paymentDate).toLocaleDateString('it-IT')}</span>}{cost.attachment && <span>{ic(P.clip, 11)} 1 All.</span>}</div>}
          </div>
          <div className="pci-amt">€ {fmt(cost.amount)}{!isOpen && isPartial && <span className="pci-pp">Pagato: €{fmt(cost.paidAmount)}</span>}</div>
          <div className="pci-badge"><span className={isPaid ? 'paid' : isPartial ? 'part' : 'none'}>{isPaid ? 'Saldato' : isPartial ? 'Parziale' : 'In Sospeso'}</span></div>
        </div>
        <div className={`pci-chev${isOpen ? ' up' : ''}`}>▼</div>
      </div>
      {isOpen && (
        <div className="pci-body">
          <div className="grid2">
            <div className="field"><label>Importo Totale</label><div className="moneyin"><input type="number" value={cost.amount === 0 ? '' : cost.amount} onChange={e => !readOnlyAmount && onUpdate({ ...cost, amount: parseFloat(e.target.value) || 0 })} readOnly={readOnlyAmount} placeholder="0" /><span className="cur">€</span></div></div>
            <div className="grid2 inner">
              <div className="field"><label>Già Pagato</label><div className="moneyin"><input type="text" inputMode="decimal" value={localPaidInput} onChange={e => handlePaidChange(e.target.value)} placeholder="0" /><span className="cur">€</span></div></div>
              <div className="field"><label>Data</label><input className="input" type="date" value={cost.paymentDate || ''} onChange={e => onUpdate({ ...cost, paymentDate: e.target.value })} /></div>
            </div>
          </div>
          <FileUploader attachment={cost.attachment} onUpload={handleAttach} onDelete={() => onUpdate({ ...cost, attachment: undefined })} />
          <div className="asgn-wrap"><AssignmentManager amount={cost.amount} assignments={cost.assignments || []} portfolios={portfolios} onUpdate={handleAssignmentUpdate} portfolioUsage={portfolioUsage} /></div>
        </div>
      )}
    </div>
  );
};

const CostBreakdown = ({ title, icon, items = [], portfolios, onBulkUpdate, portfolioUsage }: { title: string; icon: React.ReactNode; items: RenovationItem[]; portfolios: Portfolio[]; onBulkUpdate: (n: RenovationItem[], t: number) => void; portfolioUsage: Record<string, number> }) => {
  const calcTotal = (it: RenovationItem[]) => it.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
  const addItem = () => { const n = [...items, { id: Date.now().toString(), description: 'Nuova Voce', amount: 0, isPaid: false, assignments: [] }]; onBulkUpdate(n, calcTotal(n)); };
  const updateItem = (i: number, u: Partial<RenovationItem>) => { const n = [...items]; n[i] = { ...n[i], ...u }; onBulkUpdate(n, calcTotal(n)); };
  const deleteItem = (i: number) => { if (confirm('Eliminare questa voce?')) { const n = items.filter((_, x) => x !== i); onBulkUpdate(n, calcTotal(n)); } };
  return (
    <div className="cb">
      <div className="cb-head"><div className="cb-title"><span className="cb-ic">{icon}</span><h4>{title}</h4><span className="cb-count">{items.length} voci</span></div><div className="cb-sub"><span className="micro">Subtotale</span><span className="num">€ {fmt(calcTotal(items))}</span></div></div>
      <div className="cb-items">
        {items.map((item, idx) => (
          <div className="cb-item" key={item.id}>
            <PayableCostInput label={item.description} cost={item} portfolios={portfolios} portfolioUsage={portfolioUsage} onUpdate={u => updateItem(idx, u)} onLabelChange={l => updateItem(idx, { description: l })} />
            <button className="cb-del" onClick={() => deleteItem(idx)} title="Elimina">{ic('<path d="M18 6L6 18M6 6l12 12"/>', 14)}</button>
          </div>
        ))}
        <button className="cb-add" onClick={addItem}>+ Aggiungi {title}</button>
      </div>
    </div>
  );
};

export const FinancialInput: React.FC<Props> = ({ data, onChange, scenarios, activeScenarioId, onSaveScenario, onLoadScenario, onDeleteScenario, onUpdateScenario, onUpdateScenarioData, onImportScenarios }) => {
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'PURCHASE' | 'RENOVATION'>('GENERAL');
  const [newScenarioName, setNewScenarioName] = useState('');
  const [showScenarioMenu, setShowScenarioMenu] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [theme, setTheme] = useState<'DEFAULT' | 'NEON'>('DEFAULT');
  useEffect(() => { const apply = () => setTheme(document.documentElement.classList.contains('theme-neon') ? 'NEON' : 'DEFAULT'); const obs = new MutationObserver(apply); obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); apply(); return () => obs.disconnect(); }, []);
  const isNeon = theme === 'NEON';
  const activeScenario = useMemo(() => scenarios.find(s => s.id === activeScenarioId), [scenarios, activeScenarioId]);
  const [availableProps, setAvailableProps] = useState<Property[]>([]);
  useEffect(() => {
    db.getProperties().then(p => { if (p) setAvailableProps(p); });
  }, []);

  const { portfolioUsage, totalBudget, totalSpent } = useMemo(() => {
    const usage: Record<string, number> = {}; const assignments: CostAssignment[] = []; let spent = 0;
    const agg = (c: any) => { if (!c) return; assignments.push(...(c.assignments || [])); spent += safeNum(c.paidAmount) || (c.isPaid ? safeNum(c.amount) : 0); };
    (Object.values(data.purchaseCosts) as any[]).forEach(agg);
    (data.renovationCosts.worksBreakdown || []).forEach(agg);
    (data.renovationCosts.materialsBreakdown || []).forEach(agg);
    if (typeof data.renovationCosts.design === 'object') agg(data.renovationCosts.design);
    assignments.forEach(a => { usage[a.portfolioId] = (usage[a.portfolioId] || 0) + safeNum(a.amount); });
    const designTotalVal = typeof data.renovationCosts.design === 'object' ? safeNum(data.renovationCosts.design.amount) : safeNum(data.renovationCosts.design);
    const grandTotal = safeNum(data.totalPrice) + (Object.values(data.purchaseCosts) as any[]).reduce((acc: number, c: any) => acc + (c ? safeNum(c.amount) : 0), 0) - safeNum(data.purchaseCosts.deposit?.amount) - safeNum(data.purchaseCosts.balance?.amount) + safeNum(data.renovationCosts.works) + safeNum(data.renovationCosts.materials) + designTotalVal + safeNum(data.renovationCosts.contingency);
    return { portfolioUsage: usage, totalBudget: grandTotal, totalSpent: spent };
  }, [data]);

  const updatePurchaseCost = (key: string, val: CostDetail) => onChange({ ...data, purchaseCosts: { ...data.purchaseCosts, [key]: val } });
  const handleDuplicateActive = () => { if (!activeScenario) return; onSaveScenario(`${activeScenario.name} (Copia)`); setShowScenarioMenu(false); };

  return (
    <div className={`ipb${isNeon ? '' : ' light'}`}>
      <style>{IPB_FIN_CSS}</style>
      <div className="finwrap">
        {/* TOP BAR */}
        <div className="panel pad topbar">
          <div className="tb-left">
            <div className="tb-ic">{ic(P.save, 18)}</div>
            <div className="tb-scn">
              {isRenaming ? (
                <input autoFocus className="tb-rename" type="text" value={renameVal} onChange={e => setRenameVal(e.target.value)} onBlur={() => { if (activeScenario) onUpdateScenario(activeScenario.id, renameVal); setIsRenaming(false); }} onKeyDown={e => { if (e.key === 'Enter') { if (activeScenario) onUpdateScenario(activeScenario.id, renameVal); setIsRenaming(false); } }} />
              ) : (
                <><span className="micro">Scenario</span><div className="tb-name" onClick={() => setShowScenarioMenu(!showScenarioMenu)}><span>{activeScenario ? activeScenario.name : 'Bozza Corrente'}</span><span className="chev">▼</span></div></>
              )}
              {showScenarioMenu && (
                <div className="scn-menu">
                  <div className="scn-list">
                    {scenarios.length === 0 ? <p className="scn-empty">Nessuno scenario salvato</p> : scenarios.map(s => (
                      <div className="scn-row" key={s.id} onClick={() => { onLoadScenario(s.id); setShowScenarioMenu(false); }}>
                        <span className={`scn-nm${activeScenarioId === s.id ? ' on' : ''}`}>{s.name}</span>{activeScenarioId === s.id && <span className="scn-dot">●</span>}
                        <button onClick={e => { e.stopPropagation(); onDeleteScenario(s.id); }}>{ic(P.trash, 12)}</button>
                      </div>
                    ))}
                  </div>
                  <div className="scn-foot">
                    {activeScenario && <div className="scn-acts"><button className="scn-up" onClick={() => { if (activeScenarioId) onUpdateScenarioData(activeScenarioId); setShowScenarioMenu(false); }}>{ic(P.save, 12)} Aggiorna</button><button className="scn-dup" onClick={handleDuplicateActive}>{ic(P.copy, 12)} Duplica</button></div>}
                    <div className="scn-new"><input type="text" placeholder="Nuovo nome…" value={newScenarioName} onChange={e => setNewScenarioName(e.target.value)} /><button onClick={() => { if (newScenarioName) { onSaveScenario(newScenarioName); setNewScenarioName(''); } }} disabled={!newScenarioName}>+</button></div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="tb-right">
            {activeScenario && <button className="tb-save" title="Aggiorna scenario corrente" onClick={() => { if (activeScenarioId) onUpdateScenarioData(activeScenarioId); }}>{ic(P.save, 17)}</button>}
            <div className="tb-stat"><span className="micro">Totale</span><span className="num">€{fmt(totalBudget)}</span></div>
            <div className="tb-stat"><span className="micro">Speso</span><span className="num pos">€{fmt(totalSpent)}</span></div>
          </div>
        </div>

        {/* TABS */}
        <div className="fin-tabs">
          <div className="seg">
            <button className={activeTab === 'GENERAL' ? 'on' : ''} onClick={() => setActiveTab('GENERAL')}>{ic(P.home, 14)} Generale</button>
            <button className={activeTab === 'PURCHASE' ? 'on' : ''} onClick={() => setActiveTab('PURCHASE')}>{ic(P.euro, 14)} Acquisto</button>
            <button className={activeTab === 'RENOVATION' ? 'on' : ''} onClick={() => setActiveTab('RENOVATION')}>{ic(P.wrench, 14)} Lavori</button>
          </div>
        </div>

        {/* CONTENT */}
        {activeTab === 'GENERAL' && (
          <div className="grid2 gap">
            <div className="panel pad">
              <div className="sec-head">{ic(P.pencil, 20)}<div><h4>Dati Progetto</h4><p className="muted">Informazioni base immobile</p></div></div>
              <div className="formstack">
                <div className="grid2">
                  <div className="field">
                    <label>Collega a Immobile</label>
                    <select
                      className="input"
                      value={data.propertyId || ''}
                      onChange={e => {
                        const pId = e.target.value;
                        const matched = availableProps.find(p => p.id === pId);
                        onChange({
                          ...data,
                          propertyId: pId || undefined,
                          propertyName: matched ? matched.name : data.propertyName,
                          totalPrice: matched?.purchasePrice ? matched.purchasePrice : data.totalPrice
                        });
                      }}
                    >
                      <option value="">Nessuno (Nuovo Progetto / Bozza)</option>
                      {availableProps.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Nome Progetto / Immobile</label>
                    <input className="input" type="text" value={data.propertyName} onChange={e => onChange({ ...data, propertyName: e.target.value })} placeholder="Es. Via Roma 10" />
                  </div>
                </div>
                <div className="grid2">
                  <div className="field"><label>Prezzo Acquisto</label><div className="moneyin"><input type="number" value={data.totalPrice || ''} onChange={e => onChange({ ...data, totalPrice: parseFloat(e.target.value) || 0 })} placeholder="0" /><span className="cur">€</span></div></div>
                  <div className="field"><label>% Mutuo</label><div className="moneyin"><input type="number" value={data.loanPercentage || ''} onChange={e => onChange({ ...data, loanPercentage: parseFloat(e.target.value) || 0 })} placeholder="80" /><span className="cur">%</span></div></div>
                </div>
                <div className="loanbox">
                  <div><span className="micro">Mutuo Stimato</span><span className="num big">€ {fmt(data.totalPrice * (data.loanPercentage / 100))}</span></div>
                  <div className="r"><span className="micro">Equity (Anticipo)</span><span className="num big accent">€ {fmt(data.totalPrice * (1 - data.loanPercentage / 100))}</span></div>
                </div>
              </div>
            </div>
            <PortfolioManager
              portfolios={data.portfolios}
              onChange={p => onChange({ ...data, portfolios: p })}
              owner1Name={data.owner1Name || 'Giuseppe'}
              owner2Name={data.owner2Name || 'Claudia'}
            />
          </div>
        )}

        {activeTab === 'PURCHASE' && (
          <div className="panel pad">
            <div className="sec-head"><div className="sec-ic indigo">{ic(P.euro, 20)}</div><div><h3>Costi di Acquisto</h3><p className="muted">Spese accessorie e tasse</p></div></div>
            <div className="pci-stack">
              <PayableCostInput label="Anticipo / Caparra" cost={data.purchaseCosts.deposit} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('deposit', c)} />
              <PayableCostInput label="Agenzia Immobiliare" cost={data.purchaseCosts.agency} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('agency', c)} />
              <PayableCostInput label="Notaio" cost={data.purchaseCosts.notary} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('notary', c)} />
              <PayableCostInput label="Imposte di Registro" cost={data.purchaseCosts.taxes} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('taxes', c)} />
              <PayableCostInput label="Altre Spese" cost={data.purchaseCosts.other} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('other', c)} />
              <div className="pci-divider"><PayableCostInput label="Saldo al Rogito (Contanti)" cost={data.purchaseCosts.balance || { amount: 0, isPaid: false, assignments: [] }} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => updatePurchaseCost('balance', c)} /></div>
            </div>
          </div>
        )}

        {activeTab === 'RENOVATION' && (
          <div className="formstack gap">
            <div className="panel pad">
              <div className="sec-head"><div className="sec-ic amber">{ic(P.wrench, 20)}</div><div><h3>Ristrutturazione</h3><p className="muted">Lavori, materiali e tecnici</p></div></div>
              <div className="formstack big-gap">
                <CostBreakdown title="Lavori & Impianti" icon={ic(P.bldg, 18)} items={data.renovationCosts.worksBreakdown || []} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onBulkUpdate={(items, total) => onChange({ ...data, renovationCosts: { ...data.renovationCosts, worksBreakdown: items, works: total } })} />
                <hr className="hr" />
                <CostBreakdown title="Materiali & Finiture" icon={ic(P.box, 18)} items={data.renovationCosts.materialsBreakdown || []} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onBulkUpdate={(items, total) => onChange({ ...data, renovationCosts: { ...data.renovationCosts, materialsBreakdown: items, materials: total } })} />
              </div>
            </div>
            <div className="grid2 gap">
              <div className="panel pad"><h4 className="sec-h4">{ic(P.pencil, 16)} Tecnici &amp; Design</h4><PayableCostInput label="Parcelle Totali" cost={typeof data.renovationCosts.design === 'object' ? data.renovationCosts.design : { amount: data.renovationCosts.design as number, isPaid: false, assignments: [] }} portfolios={data.portfolios} portfolioUsage={portfolioUsage} onUpdate={c => onChange({ ...data, renovationCosts: { ...data.renovationCosts, design: c } })} /></div>
              <div className="panel pad"><h4 className="sec-h4">{ic(P.shield, 16)} Riserva Imprevisti</h4><div className="contbox"><label className="micro">Budget di Riserva</label><div className="moneyin"><input type="number" value={data.renovationCosts.contingency || ''} onChange={e => onChange({ ...data, renovationCosts: { ...data.renovationCosts, contingency: parseFloat(e.target.value) || 0 } })} placeholder="0" /><span className="cur">€</span></div></div></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const IPB_FIN_CSS = `
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
.ipb .finwrap{ max-width:1040px; margin:0 auto; display:flex; flex-direction:column; gap:18px; }
.ipb .micro{ font-family:var(--mono); font-size:9px; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--faint); display:inline-flex; align-items:center; gap:5px; }
.ipb .num{ font-family:var(--mono); font-weight:600; letter-spacing:-.01em; color:var(--text); } .ipb .num.pos{ color:var(--pos); } .ipb .num.accent{ color:var(--accent); } .ipb .num.big{ font-size:20px; display:block; margin-top:3px; }
.ipb .muted{ color:var(--faint); font-size:11.5px; margin:2px 0 0; }
.ipb .panel{ background:var(--panel); border:1px solid var(--border); border-radius:var(--r-lg); }
.ipb .panel.pad{ padding:20px; }
.ipb .formstack{ display:flex; flex-direction:column; gap:14px; } .ipb .formstack.gap{ gap:18px; } .ipb .formstack.big-gap{ gap:26px; }
.ipb .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:12px; } .ipb .grid2.gap{ gap:18px; } .ipb .grid2.inner{ gap:10px; }
.ipb .hr{ border:none; border-top:1px solid var(--border); margin:0; }
.ipb .field label{ display:block; font-family:var(--mono); font-size:9px; letter-spacing:.12em; text-transform:uppercase; color:var(--faint); margin:0 0 6px 2px; }
.ipb .input{ width:100%; background:var(--inset); border:1px solid var(--border); border-radius:10px; color:var(--text); font-family:var(--font); font-size:13.5px; font-weight:500; padding:11px 13px; outline:none; }
.ipb .input:focus{ border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
.ipb .moneyin{ position:relative; display:flex; align-items:center; } .ipb .moneyin input{ width:100%; background:var(--inset); border:1px solid var(--border); border-radius:10px; padding:11px 32px 11px 13px; font-family:var(--mono); font-size:14px; font-weight:600; color:var(--text); outline:none; } .ipb .moneyin input:focus{ border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); } .ipb .moneyin input[readonly]{ opacity:.6; } .ipb .moneyin .cur{ position:absolute; right:12px; color:var(--faint); font-family:var(--mono); font-size:12px; font-weight:600; }
.ipb .seg{ display:inline-flex; gap:2px; padding:3px; background:var(--inset); border:1px solid var(--border); border-radius:12px; }
.ipb .seg button{ border:none; background:transparent; cursor:pointer; font-family:var(--mono); font-size:11px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:var(--dim); padding:8px 16px; border-radius:8px; display:inline-flex; align-items:center; gap:7px; }
.ipb .seg button.on{ background:var(--panel); color:var(--text); box-shadow:0 1px 0 var(--border-2); }
.ipb .fin-tabs{ display:flex; justify-content:center; }
.ipb .sec-head{ display:flex; align-items:center; gap:12px; margin-bottom:18px; color:var(--dim); }
.ipb .sec-head h3{ margin:0; font-size:18px; font-weight:700; color:var(--text); } .ipb .sec-head h4{ margin:0; font-size:15px; font-weight:700; color:var(--text); }
.ipb .sec-ic{ width:44px; height:44px; border-radius:12px; display:grid; place-items:center; flex:none; } .ipb .sec-ic.indigo{ background:var(--indigo-soft); color:var(--indigo); } .ipb .sec-ic.amber{ background:var(--warn-soft); color:var(--warn); }
.ipb .sec-h4{ margin:0 0 14px; font-size:14px; font-weight:700; display:flex; align-items:center; gap:8px; color:var(--text); } .ipb .sec-h4 svg{ color:var(--accent); }

/* topbar */
.ipb .topbar{ display:flex; align-items:center; justify-content:space-between; gap:16px; position:relative; z-index:40; padding:14px 18px; flex-wrap:wrap; }
.ipb .tb-left{ display:flex; align-items:center; gap:12px; } .ipb .tb-ic{ width:40px; height:40px; border-radius:11px; background:var(--inset); color:var(--dim); display:grid; place-items:center; flex:none; }
.ipb .tb-scn{ position:relative; } .ipb .tb-name{ display:flex; align-items:center; gap:6px; cursor:pointer; } .ipb .tb-name span:first-child{ font-weight:700; font-size:14px; } .ipb .tb-name .chev{ font-size:9px; color:var(--faint); } .ipb .tb-name:hover span:first-child{ color:var(--accent); }
.ipb .tb-rename{ background:var(--inset); border:1px solid var(--accent); border-radius:8px; padding:6px 10px; font-size:14px; font-weight:700; color:var(--text); outline:none; }
.ipb .tb-right{ display:flex; align-items:center; gap:16px; } .ipb .tb-save{ width:38px; height:38px; border-radius:11px; background:var(--pos-soft); color:var(--pos); border:none; cursor:pointer; display:grid; place-items:center; }
.ipb .tb-stat{ text-align:right; } .ipb .tb-stat .num{ display:block; font-size:14px; margin-top:2px; }
.ipb .scn-menu{ position:absolute; top:52px; left:0; width:290px; background:var(--panel-2); border:1px solid var(--border-2); border-radius:14px; box-shadow:0 24px 60px -20px rgba(0,0,0,.7); padding:8px; z-index:50; }
.ipb .scn-list{ max-height:240px; overflow-y:auto; } .ipb .scn-empty{ font-size:11px; color:var(--faint); padding:16px; text-align:center; font-style:italic; }
.ipb .scn-row{ display:flex; align-items:center; gap:6px; padding:9px 10px; border-radius:9px; cursor:pointer; } .ipb .scn-row:hover{ background:var(--inset); } .ipb .scn-nm{ flex:1; font-size:13px; font-weight:600; color:var(--dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .ipb .scn-nm.on{ color:var(--accent); } .ipb .scn-dot{ color:var(--pos); font-size:9px; } .ipb .scn-row button{ border:none; background:transparent; color:var(--faint); cursor:pointer; padding:3px; } .ipb .scn-row button:hover{ color:var(--neg); }
.ipb .scn-foot{ border-top:1px solid var(--border); margin-top:8px; padding-top:10px; }
.ipb .scn-acts{ display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; } .ipb .scn-acts button{ border:none; border-radius:9px; padding:9px; font-family:var(--mono); font-size:9px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; } .ipb .scn-up{ background:var(--accent-soft); color:var(--accent); } .ipb .scn-dup{ background:var(--inset); color:var(--dim); }
.ipb .scn-new{ display:flex; gap:6px; } .ipb .scn-new input{ flex:1; background:var(--inset); border:1px solid var(--border); border-radius:9px; padding:9px 11px; font-size:12px; font-weight:600; color:var(--text); outline:none; } .ipb .scn-new button{ width:38px; background:var(--accent); color:#fff; border:none; border-radius:9px; font-size:16px; font-weight:700; cursor:pointer; } .ipb .scn-new button:disabled{ opacity:.4; }

/* loanbox */
.ipb .loanbox{ background:var(--indigo-soft); border:1px solid transparent; border-radius:14px; padding:16px; display:flex; justify-content:space-between; } .ipb .loanbox .r{ text-align:right; } .ipb .loanbox .micro{ color:var(--indigo); }

/* portfolio */
.ipb .pm-head{ display:flex; justify-content:space-between; align-items:center; gap:14px; margin-bottom:18px; flex-wrap:wrap; } .ipb .pm-head h4{ margin:0; font-size:15px; font-weight:700; }
.ipb .pm-add{ display:flex; gap:8px; } .ipb .ownbtn{ border:none; border-radius:10px; padding:9px 12px; font-family:var(--font); font-size:11px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:7px; } .ipb .ownbtn.g{ background:var(--accent-soft); color:var(--accent); } .ipb .ownbtn.c{ background:var(--neg-soft); color:var(--neg); } .ipb .ownbtn .ow{ width:16px; height:16px; border-radius:50%; background:rgba(255,255,255,.15); display:grid; place-items:center; font-size:8px; font-weight:700; }
.ipb .pm-grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.ipb .pm-card{ background:var(--inset); border:1px solid var(--border); border-radius:14px; padding:14px; } .ipb .pm-top{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; }
.ipb .pm-badge{ width:30px; height:30px; border-radius:9px; display:grid; place-items:center; font-family:var(--mono); font-size:12px; font-weight:700; } .ipb .pm-badge.g{ background:var(--accent-soft); color:var(--accent); } .ipb .pm-badge.c{ background:var(--neg-soft); color:var(--neg); }
.ipb .pm-del{ border:none; background:transparent; color:var(--faint); cursor:pointer; } .ipb .pm-del:hover{ color:var(--neg); }
.ipb .pm-name{ width:100%; background:transparent; border:none; padding:0; font-size:13px; font-weight:700; color:var(--text); outline:none; margin-bottom:8px; }
.ipb .pm-money{ display:flex; align-items:center; gap:5px; background:var(--panel); border:1px solid var(--border); border-radius:9px; padding:8px 11px; } .ipb .pm-money .cur{ color:var(--faint); font-family:var(--mono); font-size:12px; font-weight:600; } .ipb .pm-money input{ width:100%; background:transparent; border:none; font-family:var(--mono); font-size:17px; font-weight:600; color:var(--text); outline:none; }
.ipb .pm-empty{ grid-column:1/-1; padding:28px; text-align:center; border:1.5px dashed var(--border-2); border-radius:14px; color:var(--faint); font-size:11.5px; }

/* PayableCostInput */
.ipb .pci-stack{ display:flex; flex-direction:column; gap:12px; }
.ipb .pci-divider{ margin-top:6px; padding-top:14px; border-top:1px solid var(--border); }
.ipb .pci{ background:var(--inset); border:1px solid var(--border); border-radius:14px; transition:border-color .2s; } .ipb .pci.open{ background:var(--panel); border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
.ipb .pci-head{ display:flex; align-items:center; gap:12px; padding:14px; cursor:pointer; }
.ipb .pci-stat{ width:32px; height:32px; border-radius:50%; display:grid; place-items:center; flex:none; font-family:var(--mono); font-weight:700; border:1px solid; } .ipb .pci-stat.paid{ background:var(--pos-soft); border-color:transparent; color:var(--pos); } .ipb .pci-stat.part{ background:var(--warn-soft); border-color:transparent; color:var(--warn); } .ipb .pci-stat.none{ background:var(--bg); border-color:var(--border); color:var(--faint); }
.ipb .pci-main{ flex:1; display:grid; grid-template-columns:1.6fr 1fr 0.9fr; gap:10px; align-items:center; min-width:0; }
.ipb .pci-label input{ width:100%; background:transparent; border:none; padding:0; font-size:13.5px; font-weight:700; color:var(--text); outline:none; } .ipb .pci-label p{ margin:0; font-size:13.5px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ipb .pci-meta{ display:flex; gap:10px; margin-top:3px; } .ipb .pci-meta span{ display:inline-flex; align-items:center; gap:4px; font-family:var(--mono); font-size:9px; color:var(--faint); }
.ipb .pci-amt{ text-align:right; font-family:var(--mono); font-size:14px; font-weight:700; color:var(--text); } .ipb .pci-pp{ display:block; font-size:9px; font-weight:600; color:var(--warn); }
.ipb .pci-badge{ text-align:right; } .ipb .pci-badge span{ font-family:var(--mono); font-size:9px; font-weight:700; text-transform:uppercase; padding:3px 7px; border-radius:6px; } .ipb .pci-badge .paid{ background:var(--pos-soft); color:var(--pos); } .ipb .pci-badge .part{ background:var(--warn-soft); color:var(--warn); } .ipb .pci-badge .none{ background:var(--bg); color:var(--faint); }
.ipb .pci-chev{ color:var(--faint); font-size:10px; transition:transform .25s; flex:none; } .ipb .pci-chev.up{ transform:rotate(180deg); }
.ipb .pci-body{ padding:0 14px 16px; border-top:1px solid var(--border); padding-top:14px; display:flex; flex-direction:column; gap:14px; }
@media (max-width:640px){ .ipb .pci-main{ grid-template-columns:1.4fr 1fr; } .ipb .pci-badge{ display:none; } }

/* FileUploader */
.ipb .fu-has{ display:inline-flex; align-items:center; gap:7px; background:var(--inset); border:1px solid var(--border); border-radius:9px; padding:7px 11px; font-family:var(--mono); font-size:10px; font-weight:600; } .ipb .fu-has span{ max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .ipb .fu-has button{ border:none; background:transparent; color:var(--neg); cursor:pointer; font-weight:700; }
.ipb .fu-btn{ display:inline-flex; align-items:center; gap:6px; background:var(--accent-soft); color:var(--accent); border:none; border-radius:9px; padding:8px 13px; font-family:var(--mono); font-size:10px; font-weight:700; cursor:pointer; }

/* AssignmentManager */
.ipb .asgn-wrap{ background:var(--inset); border:1px solid var(--border); border-radius:12px; padding:13px; }
.ipb .asgn-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; } .ipb .asgn-tag{ font-family:var(--mono); font-size:8.5px; font-weight:700; text-transform:uppercase; padding:3px 8px; border-radius:6px; } .ipb .asgn-tag.ok{ background:var(--pos-soft); color:var(--pos); } .ipb .asgn-tag.bad{ background:var(--neg-soft); color:var(--neg); }
.ipb .asgn-list{ display:flex; flex-direction:column; gap:8px; }
.ipb .asgn-row{ display:flex; align-items:center; justify-content:space-between; gap:10px; background:var(--panel); border:1px solid var(--border); border-radius:9px; padding:8px 10px; } .ipb .asgn-row.over{ border-color:var(--neg); }
.ipb .asgn-sel{ display:flex; align-items:center; gap:6px; flex:1; min-width:0; } .ipb .asgn-sel select{ background:transparent; border:none; font-size:11px; font-weight:700; color:var(--text); outline:none; max-width:120px; } .ipb .over-ic{ color:var(--neg); }
.ipb .asgn-vals{ display:flex; align-items:center; gap:8px; } .ipb .asgn-vals input[type=number]{ width:64px; background:var(--inset); border:1px solid var(--border); border-radius:7px; padding:5px 7px; font-family:var(--mono); font-size:10px; font-weight:700; text-align:right; color:var(--text); outline:none; } .ipb .asgn-vals input[type=date]{ background:transparent; border:none; font-size:9px; color:var(--faint); width:78px; outline:none; } .ipb .asgn-vals button{ border:none; background:transparent; color:var(--faint); cursor:pointer; } .ipb .asgn-vals button:hover{ color:var(--neg); }
.ipb .asgn-manage{ width:100%; padding:10px; background:var(--panel); border:1px dashed var(--border-2); color:var(--dim); border-radius:9px; font-family:var(--mono); font-size:9.5px; font-weight:700; text-transform:uppercase; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; } .ipb .asgn-manage:hover{ border-color:var(--accent); color:var(--accent); }

/* CostBreakdown */
.ipb .cb-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:14px; } .ipb .cb-title{ display:flex; align-items:center; gap:9px; } .ipb .cb-title h4{ margin:0; font-size:14px; font-weight:700; } .ipb .cb-ic{ color:var(--accent); display:grid; } .ipb .cb-count{ background:var(--inset); color:var(--dim); font-family:var(--mono); font-size:9px; font-weight:700; padding:3px 8px; border-radius:20px; } .ipb .cb-sub{ text-align:right; } .ipb .cb-sub .num{ display:block; font-size:14px; margin-top:2px; }
.ipb .cb-items{ display:flex; flex-direction:column; gap:10px; } .ipb .cb-item{ position:relative; } .ipb .cb-del{ position:absolute; top:13px; right:44px; border:none; background:transparent; color:var(--faint); cursor:pointer; z-index:2; } .ipb .cb-del:hover{ color:var(--neg); }
.ipb .cb-add{ width:100%; padding:13px; border:1.5px dashed var(--border-2); border-radius:14px; background:transparent; color:var(--faint); font-family:var(--mono); font-size:10px; font-weight:700; text-transform:uppercase; cursor:pointer; } .ipb .cb-add:hover{ border-color:var(--accent); color:var(--accent); }
.ipb .contbox{ background:var(--inset); border:1px solid var(--border); border-radius:12px; padding:14px; } .ipb .contbox .micro{ display:block; margin-bottom:8px; }
@media (max-width:900px){ .ipb .grid2,.ipb .pm-grid{ grid-template-columns:1fr; } }
`;

export default FinancialInput;
