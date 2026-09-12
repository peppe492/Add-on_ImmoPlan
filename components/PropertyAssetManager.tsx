import React, { useState, useEffect, useMemo } from 'react';
import { Property, RecurringCost, RentalRecord, Tenant, Attachment, ValuationRecord } from '../types';
import { db } from '../services/dbService';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, Tooltip, YAxis, CartesianGrid, Legend } from 'recharts';
import { MarketForecaster } from './MarketForecaster';

/* =====================================================================================
   ImmoPlan · Patrimonio — "Bento Terminal" design
   Reskin completo della pagina Patrimonio. Tutta la logica (db, handler, recharts, modale)
   è identica all'originale: cambia solo la presentazione, tramite CSS scoped sotto `.ipb`
   (indipendente da Tailwind, così non confligge col resto dell'app).
   Si aggancia al tema esistente: scuro col tema "Neon", chiaro altrimenti (classe .light).
   ===================================================================================== */

type DetailTab = 'ANAGRAFICA' | 'ECONOMICA' | 'ANALISI' | 'PREVISIONI';

const CATEGORIES = [
  { id: 'MORTGAGE',    label: 'Mutuo/Prestito',     stroke: '#2f8fff' },
  { id: 'TAX',         label: 'Tasse (IMU/TARI)',   stroke: '#f5b942' },
  { id: 'MAINTENANCE', label: 'Condominio/Manut.',  stroke: '#6f63ff' },
  { id: 'UTILITY',     label: 'Utenze',             stroke: '#2fd6a3' },
  { id: 'INTERNET',    label: 'Internet',           stroke: '#59b0ff' },
  { id: 'INSURANCE',   label: 'Assicurazione',      stroke: '#fb6f86' },
  { id: 'OTHER',       label: 'Altro',              stroke: '#8b97ab' },
] as const;

const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 11 }, (_, i) => currentYear - 1 + i);

const safeNum = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) || !isFinite(val) ? 0 : val;
  if (typeof val === 'string') { const p = parseFloat(val); return isNaN(p) || !isFinite(p) ? 0 : p; }
  return 0;
};
const readFile = (file: File): Promise<Attachment> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve({ name: file.name, data: reader.result as string, type: file.type });
  reader.onerror = reject;
  reader.readAsDataURL(file);
});
const eur = (n: number) => '€ ' + Math.round(safeNum(n)).toLocaleString('it-IT');
const seur = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + '€ ' + Math.abs(Math.round(safeNum(n))).toLocaleString('it-IT');

const CAT_COLOR: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.id, c.stroke]));
const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));

/* ---- icons --------------------------------------------------------------------------- */
const ic = (p: string, s = 18, sw = 1.8) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: p }} />
);
const PATH = {
  building: '<path d="M3 22V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v17"/><path d="M14 22V10a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v12"/><path d="M2 22h20"/><path d="M6 12h2M6 16h2M16 12h2M16 16h2"/>',
  home: '<path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10"/>',
  car: '<path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13M5 13h14v4a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/>',
  land: '<path d="M5 3v4M3 5h4M13 3l2.3 6.9L22 12l-6.7 2.1L13 21l-2.3-6.9L4 12l6.7-2.1z"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  up: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  down: '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
  back: '<polyline points="15 18 9 12 15 6"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 11 2 2 4-4"/>',
  wifi: '<path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M2 9a15 15 0 0 1 20 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="0.6"/>',
};
const CAT_ICON: Record<string, string> = { MORTGAGE: PATH.home, TAX: PATH.doc, MAINTENANCE: PATH.building, UTILITY: PATH.bolt, INTERNET: PATH.wifi, INSURANCE: PATH.shield, OTHER: PATH.cart };
const typeIcon = (t: string) => t === 'GARAGE' ? PATH.car : t === 'LAND' ? PATH.land : t === 'COMMERCIAL' ? PATH.building : PATH.home;
const TYPE_LABEL: Record<string, string> = { RESIDENTIAL: 'Residenziale', COMMERCIAL: 'Commerciale', LAND: 'Terreno', GARAGE: 'Garage' };
const STATUS_LABEL: Record<string, string> = { RENTED: 'Affittato', RENOVATION: 'Cantiere', EMPTY: 'Sfitto', MAIN_RESIDENCE: 'Residenza' };
const STATUS_CLASS: Record<string, string> = { RENTED: 'b-rent', RENOVATION: 'b-cant', EMPTY: 'b-empty', MAIN_RESIDENCE: 'b-main' };

/* ---- recharts tooltip ----------------------------------------------------------------- */
const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="ipb-tip">
      <p className="tlab">{label}</p>
      {payload.map((pld: any, i: number) => (
        <div className="trow" key={i}>
          <span className="nm"><span className="dot" style={{ background: pld.color || pld.stroke }} />{pld.name}</span>
          <span className="num">{eur(safeNum(pld.value))}</span>
        </div>
      ))}
    </div>
  );
};

const formatCostDate = (cost: RecurringCost) => {
  if (cost.frequency === 'ONE_OFF') {
    if (!cost.date) return '-';
    const parts = cost.date.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return cost.date;
  }
  if (cost.frequency === 'MONTHLY') {
    if (cost.referenceMonth == null || cost.referenceYear == null) return '-';
    const mLabel = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'][cost.referenceMonth];
    return `${mLabel} ${cost.referenceYear}`;
  }
  if (cost.frequency === 'YEARLY') {
    if (cost.referenceYear == null) return '-';
    return `${cost.referenceYear}`;
  }
  return '-';
};

/* ===================================================================================== */
export const PropertyAssetManager: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [records, setRecords] = useState<RentalRecord[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedProp, setSelectedProp] = useState<Property | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('ANAGRAFICA');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [analysisFilterType, setAnalysisFilterType] = useState<'MONTH' | 'YEAR'>('YEAR');
  const [analysisDate, setAnalysisDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [theme, setTheme] = useState<'DEFAULT' | 'NEON'>('DEFAULT');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const [newCost, setNewCost] = useState<Partial<RecurringCost>>({
    category: 'OTHER', frequency: 'MONTHLY', amount: 0, name: '',
    referenceMonth: new Date().getMonth(), referenceYear: new Date().getFullYear(), date: new Date().toISOString().split('T')[0]
  });
  const [newPropData, setNewPropData] = useState<Partial<Property>>({
    name: '', address: '', type: 'RESIDENTIAL', status: 'MAIN_RESIDENCE', purchasePrice: 0, currentValue: 0, notes: '', coordinates: { lat: 0, lng: 0 }
  });

  const [newValuationDate, setNewValuationDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newValuationValue, setNewValuationValue] = useState<number>(0);

  /* ---- theme observer (immutato) ---- */
  useEffect(() => {
    const apply = () => setTheme(document.documentElement.classList.contains('theme-neon') ? 'NEON' : 'DEFAULT');
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    apply();
    return () => observer.disconnect();
  }, []);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [loadedProps, loadedRecords, loadedTenants] = await Promise.all([db.getProperties(), db.getRentalRecords(), db.getTenants()]);
    const uniqueProps = Array.from(new Map((loadedProps || []).map(p => [p.id, p])).values());
    setProperties(uniqueProps);
    setRecords(loadedRecords || []);
    setTenants(loadedTenants || []);
  };

  const handleCreateProperty = async () => {
    if (!newPropData.name) return alert('Inserisci il nome');
    const p: Property = {
      id: `PROP-${Date.now()}`, name: newPropData.name!, address: newPropData.address || '',
      type: (newPropData.type as any) || 'RESIDENTIAL', status: (newPropData.status as any) || 'MAIN_RESIDENCE',
      purchasePrice: safeNum(newPropData.purchasePrice), currentValue: safeNum(newPropData.currentValue),
      purchaseDate: new Date().toISOString().split('T')[0], recurringCosts: [],
      financials: { mortgageAmount: 0, mortgageDuration: 20, mortgageStartDate: new Date().toISOString().split('T')[0], mortgageRate: 0, monthlyRent: 0, condoFees: 0, defaultTaxRate: 21 },
      coordinates: newPropData.coordinates || { lat: 0, lng: 0 }, notes: newPropData.notes, documents: []
    };
    await db.saveProperty(p);
    setNewPropData({ name: '', address: '', type: 'RESIDENTIAL', status: 'MAIN_RESIDENCE', purchasePrice: 0, currentValue: 0, notes: '', coordinates: { lat: 0, lng: 0 } });
    loadData();
  };
  const savePropertyToDB = async (propToSave: Property) => { await db.saveProperty(propToSave); await loadData(); alert('Modifiche salvate con successo!'); };
  const handleDeleteProperty = async (id: string, e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (window.confirm("Eliminare definitivamente l'immobile?")) {
      setProperties(prev => prev.filter(p => p.id !== id));
      if (selectedProp?.id === id) setSelectedProp(null);
      await db.deleteProperty(id); await loadData();
    }
  };
  const handleAddCost = async () => {
    if (!selectedProp || !newCost.amount || !newCost.name) return;
    const cost: RecurringCost = { ...newCost as RecurringCost, id: `COST-${Date.now()}` };
    const updatedProp = { ...selectedProp, recurringCosts: [...(selectedProp.recurringCosts || []), cost] };
    setSelectedProp(updatedProp); await db.saveProperty(updatedProp); await loadData();
    setNewCost({ category: 'OTHER', frequency: 'MONTHLY', amount: 0, name: '', referenceMonth: new Date().getMonth(), referenceYear: new Date().getFullYear(), date: new Date().toISOString().split('T')[0] });
  };
  const handleDeleteCost = async (costId: string) => {
    if (!selectedProp) return;
    const updatedProp = { ...selectedProp, recurringCosts: (selectedProp.recurringCosts || []).filter(c => c.id !== costId) };
    setSelectedProp(updatedProp); await db.saveProperty(updatedProp); await loadData();
  };
  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedProp) {
      const customName = window.prompt('Nome documento:', file.name);
      if (customName !== null) {
        const att = await readFile(file); if (customName) att.name = customName;
        const updatedProp = { ...selectedProp, documents: [...(selectedProp.documents || []), att] };
        setSelectedProp(updatedProp); await db.saveProperty(updatedProp); await loadData();
      }
    }
  };
  const handleDeleteDocument = async (index: number) => {
    if (selectedProp && selectedProp.documents && window.confirm('Rimuovere documento?')) {
      const updatedDocs = [...selectedProp.documents]; updatedDocs.splice(index, 1);
      const updatedProp = { ...selectedProp, documents: updatedDocs };
      setSelectedProp(updatedProp); await db.saveProperty(updatedProp); await loadData();
    }
  };

  const handleAddValuation = async () => {
    if (!selectedProp || !newValuationDate || !newValuationValue) return;
    const record: ValuationRecord = {
      id: `VAL-${Date.now()}`,
      date: newValuationDate,
      value: newValuationValue
    };
    const updatedValuations = [...(selectedProp.valuations || []), record];
    
    // Auto-update currentValue based on chronologically latest record
    const sorted = [...updatedValuations].sort((a, b) => a.date.localeCompare(b.date));
    const latestVal = sorted[sorted.length - 1].value;
    
    const updatedProp = {
      ...selectedProp,
      valuations: updatedValuations,
      currentValue: latestVal
    };
    setSelectedProp(updatedProp);
    await db.saveProperty(updatedProp);
    await loadData();
    setNewValuationValue(0);
  };

  const handleDeleteValuation = async (valId: string) => {
    if (!selectedProp) return;
    if (window.confirm("Eliminare questa valutazione storica?")) {
      const updatedValuations = (selectedProp.valuations || []).filter(v => v.id !== valId);
      
      // Auto-update currentValue to previous latest if history not empty
      let latestVal = selectedProp.currentValue;
      if (updatedValuations.length > 0) {
        const sorted = [...updatedValuations].sort((a, b) => a.date.localeCompare(b.date));
        latestVal = sorted[sorted.length - 1].value;
      }
      
      const updatedProp = {
        ...selectedProp,
        valuations: updatedValuations,
        currentValue: latestVal
      };
      setSelectedProp(updatedProp);
      await db.saveProperty(updatedProp);
      await loadData();
    }
  };
  const calculateMortgageStats = (p: Property) => {
    if (!p.financials?.mortgageAmount || !p.financials?.mortgageDuration || !p.financials?.mortgageStartDate) return null;
    const installment = safeNum(p.financials.mortgageAmount);
    const start = new Date(p.financials.mortgageStartDate); const now = new Date();
    const totalMonths = p.financials.mortgageDuration * 12;
    let elapsedMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    elapsedMonths = Math.max(0, Math.min(elapsedMonths, totalMonths));
    const percent = (elapsedMonths / totalMonths) * 100;
    const totalToPay = installment * totalMonths; const paid = installment * elapsedMonths; const remaining = totalToPay - paid;
    return { percent, paid, remaining, totalToPay, elapsedMonths, totalMonths };
  };

  const totalValue = properties.reduce((acc, p) => acc + safeNum(p.currentValue), 0);
  const totalCost = properties.reduce((acc, p) => acc + safeNum(p.purchasePrice), 0);
  const totalGain = totalValue - totalCost;
  const gainPct = totalCost > 0 ? (totalGain / totalCost * 100) : 0;

  const currentCosts = useMemo(() => selectedProp?.recurringCosts || [], [selectedProp]);
  const filteredCosts = useMemo(() => filterCategory === 'ALL' ? currentCosts : currentCosts.filter(c => c.category === filterCategory), [currentCosts, filterCategory]);

  const rentWidgetData = useMemo(() => {
    if (!selectedProp) return { totalExpenses: 0, suggestedRent: 0, netProfit: 0, estimatedTax: 0, marginPercent: 0, taxRate: 21, fixedExpenses: 0, oneOffExpenses: 0 };
    let fixedExpenses = 0; const costs = selectedProp.recurringCosts || [];
    costs.forEach(c => { if (c.frequency === 'MONTHLY') fixedExpenses += safeNum(c.amount); else if (c.frequency === 'YEARLY') fixedExpenses += safeNum(c.amount) / 12; });
    if (!costs.some(c => c.category === 'MORTGAGE') && selectedProp.financials?.mortgageAmount) fixedExpenses += safeNum(selectedProp.financials.mortgageAmount);
    let oneOffExpenses = 0; const twelveMonthsAgo = new Date(); twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    let totalOneOffInLastYear = 0;
    costs.filter(c => c.frequency === 'ONE_OFF' && c.date).forEach(c => { if (new Date(c.date!) >= twelveMonthsAgo) totalOneOffInLastYear += safeNum(c.amount); });
    oneOffExpenses = totalOneOffInLastYear / 12;
    const totalExpenses = fixedExpenses + oneOffExpenses;
    const marginPercent = selectedProp.financials?.targetMargin || 0;
    const taxRate = selectedProp.financials?.defaultTaxRate || 21;
    const desiredNetIncome = totalExpenses * (1 + (marginPercent / 100));
    const suggestedRent = taxRate < 100 ? desiredNetIncome / (1 - (taxRate / 100)) : 0;
    const estimatedTax = suggestedRent * (taxRate / 100);
    const netProfit = suggestedRent - estimatedTax - totalExpenses;
    return { totalExpenses, suggestedRent, netProfit, estimatedTax, marginPercent, taxRate, fixedExpenses, oneOffExpenses };
  }, [selectedProp]);
  const yieldData = useMemo(() => {
    if (!selectedProp) return { grossCapRate: 0, netCapRate: 0, cashOnCash: 0, annualRent: 0, noi: 0, leveredCashFlow: 0, initialCash: 0 };
    const p = selectedProp;
    const annualRent = (p.financials?.monthlyRent || 0) * 12;
    
    // Operating expenses (esclude rata mutuo per il Cap Rate Netto)
    let annualOperatingExpenses = 0;
    const costs = p.recurringCosts || [];
    costs.forEach(c => {
      if (c.category !== 'MORTGAGE') {
        if (c.frequency === 'MONTHLY') annualOperatingExpenses += safeNum(c.amount) * 12;
        else if (c.frequency === 'YEARLY') annualOperatingExpenses += safeNum(c.amount);
      }
    });
    
    // Aggiungi tasse in base all'aliquota se non presenti nella lista spese
    if (!costs.some(c => c.category === 'TAX') && p.financials?.defaultTaxRate && annualRent > 0) {
      annualOperatingExpenses += annualRent * (p.financials.defaultTaxRate / 100);
    }
    
    const noi = annualRent - annualOperatingExpenses;
    const purchasePrice = safeNum(p.purchasePrice) || 1;
    const grossCapRate = (annualRent / purchasePrice) * 100;
    const netCapRate = (noi / purchasePrice) * 100;
    
    // Cashflow Netto Annuo dopo la rata del mutuo (Levered Cash Flow)
    const annualMortgage = (p.financials?.mortgageAmount || 0) * 12;
    const leveredCashFlow = noi - annualMortgage;
    
    // Capitale liquido investito: inserito dall'utente o stimato al 30% del prezzo acquisto
    const initialCash = p.financials?.initialInvestment || (safeNum(p.purchasePrice) * 0.30);
    const cashOnCash = initialCash > 0 ? (leveredCashFlow / initialCash) * 100 : 0;
    
    return { grossCapRate, netCapRate, cashOnCash, annualRent, noi, leveredCashFlow, initialCash };
  }, [selectedProp]);

  const lineData = useMemo(() => {
    if (!selectedProp) return [];
    const targetDate = new Date(analysisDate); const isYearView = analysisFilterType === 'YEAR';
    const iterations = isYearView ? 12 : new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    return Array.from({ length: iterations }, (_, i) => {
      const label = isYearView ? new Date(targetDate.getFullYear(), i, 1).toLocaleString('it-IT', { month: 'short' }) : (i + 1).toString();
      const datum: any = { name: label }; CATEGORIES.forEach(cat => datum[cat.id] = 0);
      (selectedProp.recurringCosts || []).forEach(c => {
        let applies = false;
        if (isYearView) {
          if (c.frequency === 'MONTHLY') applies = true;
          if (c.frequency === 'YEARLY' && c.referenceMonth === i) applies = true;
          if (c.frequency === 'ONE_OFF') { const d = new Date(c.date || ''); if (d.getFullYear() === targetDate.getFullYear() && d.getMonth() === i) applies = true; }
        } else {
          if (c.frequency === 'MONTHLY') applies = true;
          if (c.frequency === 'YEARLY' && c.referenceMonth === targetDate.getMonth()) applies = true;
          if (c.frequency === 'ONE_OFF') { const d = new Date(c.date || ''); if (d.getFullYear() === targetDate.getFullYear() && d.getMonth() === targetDate.getMonth() && d.getDate() === (i + 1)) applies = true; }
        }
        if (applies) datum[c.category] += isYearView ? safeNum(c.amount) : safeNum(c.amount) / iterations;
      });
      return datum;
    });
  }, [selectedProp, analysisFilterType, analysisDate]);

  const { pieData, averageMonthly } = useMemo(() => {
    const totals: any = {}; CATEGORIES.forEach(c => totals[c.id] = 0);
    lineData.forEach((d: any) => CATEGORIES.forEach(c => totals[c.id] += safeNum(d[c.id])));
    const chartData = CATEGORIES.map(c => ({ id: c.id, name: c.id, value: totals[c.id], label: c.label, color: c.stroke })).filter(d => d.value > 0);
    return { pieData: chartData, averageMonthly: analysisFilterType === 'YEAR' ? chartData.reduce((a, b) => a + b.value, 0) / 12 : chartData.reduce((a, b) => a + b.value, 0) };
  }, [lineData, analysisFilterType]);

  const wrapClass = `ipb${theme === 'NEON' ? '' : ' light'}`;

  /* ============================ DETAIL ============================ */
  const renderDetail = (p: Property) => (
    <div className="body">
      <div className="panel pad crumb">
        <div className="left">
          <button className="backbtn" onClick={() => setSelectedProp(null)}>{ic(PATH.back, 18, 2.4)}</button>
          <div><div className="micro accent">Patrimonio · Editor</div><h2 className="ttl">{p.name}</h2></div>
        </div>
        <div className="seg">
          {(['ANAGRAFICA', 'ECONOMICA', 'ANALISI', 'PREVISIONI'] as const).map(t => (
            <button key={t} className={activeTab === t ? 'on' : ''} onClick={() => setActiveTab(t)}>
              {t === 'PREVISIONI' ? '📈 PREVISIONI' : t}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'ANAGRAFICA' && (
        <div className="econgrid">
          {/* Main Anagrafica Panel */}
          <div className="panel pad">
            <div className="pTitle">
              <div className="ptl">
                <span className="iconpill">{ic(PATH.home, 16)}</span>
                <div><h3>Dati Anagrafici</h3><div className="subt">Informazioni generali e parametri economici</div></div>
              </div>
            </div>
            <div className="formwrap" style={{ maxWidth: 'none', margin: '0' }}>
              <div className="field"><label>Nome Immobile</label><input className="input lg" value={p.name} onChange={e => setSelectedProp({ ...p, name: e.target.value })} placeholder="Nome Immobile" /></div>
              <div className="field"><label>Indirizzo</label><input className="input" value={p.address} onChange={e => setSelectedProp({ ...p, address: e.target.value })} placeholder="Indirizzo dell'immobile" /></div>
              <div className="grid3">
                <div className="field"><label>Tipologia Asset</label>
                  <select className="input" value={p.type} onChange={e => setSelectedProp({ ...p, type: e.target.value as any })}>
                    <option value="RESIDENTIAL">Residenziale</option><option value="COMMERCIAL">Commerciale</option><option value="LAND">Terreno</option><option value="GARAGE">Garage</option>
                  </select></div>
                <div className="field"><label>Stato Locativo</label>
                  <select className="input" value={p.status} onChange={e => setSelectedProp({ ...p, status: e.target.value as any })}>
                    <option value="MAIN_RESIDENCE">Abitazione Principale</option><option value="RENTED">Affittato</option><option value="EMPTY">Sfitto</option><option value="RENOVATION">Ristrutturazione</option>
                  </select></div>
                <div className="field"><label>Inquilino Collegato</label>
                  <select className="input" value={p.currentTenantId || ''} onChange={e => setSelectedProp({ ...p, currentTenantId: e.target.value || undefined })}>
                    <option value="">Nessun Inquilino</option>{tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select></div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '18px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <div className="sectlabel">Valutazione Immobiliare</div>
                  <div className="grid2">
                    <div className="moneybox"><div className="l">Prezzo Acquisto</div><div className="row"><span className="cur">€</span><input type="number" value={p.purchasePrice || ''} onChange={e => setSelectedProp({ ...p, purchasePrice: parseFloat(e.target.value) || 0 })} /></div></div>
                    <div className="moneybox"><div className="l">Valore Attuale</div><div className="row"><span className="cur">€</span><input type="number" value={p.currentValue || ''} onChange={e => setSelectedProp({ ...p, currentValue: parseFloat(e.target.value) || 0 })} /></div></div>
                  </div>
                  <div className="grid2" style={{ marginTop: '10px' }}>
                    <div className="field"><label>Superficie (m²)</label><input className="input mono" type="number" value={p.surfaceSqm || ''} onChange={e => setSelectedProp({ ...p, surfaceSqm: parseFloat(e.target.value) || undefined })} placeholder="70" /></div>
                    <div className="field"><label>Classe Energetica</label>
                      <select className="input" value={p.energyClass || 'D'} onChange={e => setSelectedProp({ ...p, energyClass: e.target.value as any })}>
                        <option value="A">Classe A</option><option value="B">Classe B</option><option value="C">Classe C</option><option value="D">Classe D</option><option value="E">Classe E</option><option value="F">Classe F</option><option value="G">Classe G</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="sectlabel">Dettagli Mutuo</div>
                  <div className="mortbox">
                    <div className="field"><label className="indigo">Rata Mensile Mutuo</label><input className="input mono" type="number" value={p.financials?.mortgageAmount || ''} onChange={e => setSelectedProp({ ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), mortgageAmount: parseFloat(e.target.value) || 0 } })} placeholder="Es. 550" /></div>
                    <div className="grid2">
                      <div className="field"><label className="indigo">Durata (Anni)</label><input className="input mono" type="number" value={p.financials?.mortgageDuration || ''} onChange={e => setSelectedProp({ ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), mortgageDuration: parseFloat(e.target.value) || 0 } })} placeholder="20" /></div>
                      <div className="field"><label className="indigo">Data Inizio</label><input className="input" type="date" value={p.financials?.mortgageStartDate || ''} onChange={e => setSelectedProp({ ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), mortgageStartDate: e.target.value } })} /></div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="sectlabel">Dati Locativi e Investimento</div>
                  <div className="grid2">
                    <div className="field"><label>Canone Mensile Affitto (€)</label>
                      <input className="input mono" type="number" value={p.financials?.monthlyRent || ''} 
                        onChange={e => setSelectedProp({ ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), monthlyRent: parseFloat(e.target.value) || 0 } })} 
                        placeholder="Es. 800" />
                    </div>
                    <div className="field"><label>Aliquota Tasse (%)</label>
                      <input className="input mono" type="number" value={p.financials?.defaultTaxRate || ''} 
                        onChange={e => setSelectedProp({ ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), defaultTaxRate: parseFloat(e.target.value) || 0 } })} 
                        placeholder="Es. 21" />
                    </div>
                  </div>
                  <div className="field" style={{ marginTop: '10px' }}><label>Capitale Iniziale Investito (Anticipo + Spese Rogito)</label>
                    <input className="input mono" type="number" value={p.financials?.initialInvestment || ''} 
                      onChange={e => setSelectedProp({ ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), initialInvestment: parseFloat(e.target.value) || 0 } })} 
                      placeholder="Stimato se vuoto (30% del prezzo acquisto)" />
                  </div>
                </div>
              </div>
              
              <button className="btn dark wide" style={{ marginTop: '10px' }} onClick={() => savePropertyToDB(p)}>Salva Modifiche Immobile</button>
            </div>
          </div>

          {/* Right Column: Documents and Historical Valuations */}
          <div className="econside">
            {/* Archived Documents Card */}
            <div className="panel pad">
              <div className="pTitle">
                <div className="ptl">
                  <span className="iconpill">{ic(PATH.doc, 16)}</span>
                  <div><h3>Documentazione</h3><div className="subt">Documenti e allegati archiviati</div></div>
                </div>
              </div>
              <div className="doclist">
                {(p.documents || []).map((doc, idx) => (
                  <div className="doc" key={idx}>
                    <div className="dn">{ic(PATH.doc, 17)}<span>{doc.name}</span></div>
                    <div className="docact">
                      <a href={doc.data} download={doc.name}>{ic(PATH.dl, 15)}</a>
                      <button className="del" onClick={() => handleDeleteDocument(idx)}>{ic(PATH.trash, 15)}</button>
                    </div>
                  </div>
                ))}
                <label className="dropzone">{ic(PATH.plus, 14, 2.4)} Carica Nuovo Documento<input type="file" onChange={handleUploadDocument} hidden /></label>
              </div>
            </div>

            {/* Historical Valuations Card */}
            <div className="panel pad">
              <div className="pTitle">
                <div className="ptl">
                  <span className="iconpill">{ic(PATH.building, 16)}</span>
                  <div><h3>Storico Valutazioni Reali</h3><div className="subt">Cronologia del valore di mercato</div></div>
                </div>
              </div>
              <div className="doclist" style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                {(!p.valuations || p.valuations.length === 0) ? (
                  <div className="empty-sm">Nessuna valutazione storica registrata</div>
                ) : (
                  [...p.valuations]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((val) => {
                      const dateParts = val.date.split('-');
                      const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : val.date;
                      return (
                        <div className="doc" key={val.id}>
                          <div className="dn">
                            <span style={{ fontSize: '11px', color: 'var(--faint)', fontFamily: 'var(--mono)' }}>{formattedDate}</span>
                            <span style={{ marginLeft: '12px', fontSize: '13px', fontWeight: 600 }}>{eur(val.value)}</span>
                          </div>
                          <div className="docact">
                            <button className="del" onClick={() => handleDeleteValuation(val.id)} title="Elimina">{ic(PATH.trash, 14)}</button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              <div className="addcost" style={{ marginTop: '16px', borderTop: '1px dashed var(--border-2)', paddingTop: '16px' }}>
                <div className="adtitle" style={{ fontSize: '11px', fontFamily: 'var(--mono)', textTransform: 'uppercase', color: 'var(--faint)', letterSpacing: '0.08em', marginBottom: '8px' }}>Nuova Valutazione</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                  <div className="field" style={{ margin: 0 }}>
                    <label style={{ fontSize: '8px' }}>Data</label>
                    <input className="input" type="date" style={{ padding: '8px 10px', fontSize: '12px' }} value={newValuationDate} onChange={e => setNewValuationDate(e.target.value)} />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label style={{ fontSize: '8px' }}>Valore €</label>
                    <input className="input mono" type="number" style={{ padding: '8px 10px', fontSize: '12px' }} value={newValuationValue || ''} onChange={e => setNewValuationValue(parseFloat(e.target.value) || 0)} placeholder="0" />
                  </div>
                  <button className="btn primary" style={{ padding: '9px 12px', borderRadius: '10px', height: '35px' }} onClick={handleAddValuation}>
                    {ic(PATH.plus, 12, 2.4)} Aggiungi
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ECONOMICA' && (
        <div className="econgrid">
          <div className="panel pad">
            <div className="pTitle">
              <div className="ptl"><span className="iconpill">{ic(PATH.cart, 16)}</span>
                <div><h3>Spese Ricorrenti</h3><div className="subt">Uscite associate a questa proprietà</div></div></div>
            </div>
            <div className="catrow">
              <button className={`catpill${filterCategory === 'ALL' ? ' on' : ''}`} style={filterCategory === 'ALL' ? { background: 'var(--accent)', color: '#fff', borderColor: 'transparent' } : undefined} onClick={() => setFilterCategory('ALL')}>Tutte</button>
              {CATEGORIES.map(c => (
                <button key={c.id} className={`catpill${filterCategory === c.id ? ' on' : ''}`} style={filterCategory === c.id ? { background: c.stroke, color: '#fff', borderColor: 'transparent' } : undefined} onClick={() => setFilterCategory(c.id)}>
                  <span className="dot" style={{ background: c.stroke }} />{c.label}
                </button>
              ))}
            </div>
            <div className="costlist">
              {filteredCosts.length === 0 ? (
                <div className="empty-sm">Nessuna spesa in questa categoria</div>
              ) : filteredCosts.map(cost => (
                <div className="costrow" key={cost.id}>
                  <div className="cati" style={{ background: (CAT_COLOR[cost.category] || '#8b97ab') + '22', color: CAT_COLOR[cost.category] || '#8b97ab' }}>{ic(CAT_ICON[cost.category] || PATH.cart, 15)}</div>
                  <div className="cinfo"><div className="cdesc">{cost.name}</div><div className="cfreq">{CAT_LABEL[cost.category]}</div></div>
                  <div className="num camt">{eur(cost.amount)}</div>
                  <div className="cdate">{formatCostDate(cost)}</div>
                  <div><span className="freqpill">{cost.frequency === 'MONTHLY' ? 'Mensile' : cost.frequency === 'YEARLY' ? 'Annuale' : 'Una tantum'}</span></div>
                  <button className="delc" onClick={() => handleDeleteCost(cost.id)} title="Elimina spesa">{ic(PATH.trash, 15)}</button>
                </div>
              ))}
            </div>
            <div className="addcost">
              <div className="adtitle">Nuova Spesa Economica</div>
              <div className="adgrid">
                <div className="field span2"><label>Descrizione Voce</label><input className="input" value={newCost.name} onChange={e => setNewCost({ ...newCost, name: e.target.value })} placeholder="Es. Spesa Condominiale Ordinaria" /></div>
                <div className="field"><label>Importo €</label><input className="input mono" type="number" value={newCost.amount || ''} onChange={e => setNewCost({ ...newCost, amount: parseFloat(e.target.value) || 0 })} placeholder="0" /></div>
                <div className="field"><label>Categoria</label>
                  <select className="input" value={newCost.category} onChange={e => setNewCost({ ...newCost, category: e.target.value as any })}>{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
                <div className="field"><label>Frequenza</label>
                  <select className="input" value={newCost.frequency} onChange={e => setNewCost({ ...newCost, frequency: e.target.value as any })}>
                    <option value="MONTHLY">Mensile</option><option value="YEARLY">Annuale</option><option value="ONE_OFF">Una Tantum</option></select></div>
                {newCost.frequency === 'MONTHLY' && (<>
                  <div className="field"><label>Mese Inizio</label><select className="input" value={newCost.referenceMonth} onChange={e => setNewCost({ ...newCost, referenceMonth: parseInt(e.target.value) })}>{MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}</select></div>
                  <div className="field"><label>Anno Inizio</label><select className="input" value={newCost.referenceYear} onChange={e => setNewCost({ ...newCost, referenceYear: parseInt(e.target.value) })}>{YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                </>)}
                {newCost.frequency === 'YEARLY' && (
                  <div className="field"><label>Anno Riferimento</label><select className="input" value={newCost.referenceYear} onChange={e => setNewCost({ ...newCost, referenceYear: parseInt(e.target.value) })}>{YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                )}
                {newCost.frequency === 'ONE_OFF' && (
                  <div className="field"><label>Data Scadenza</label><input className="input" type="date" value={newCost.date} onChange={e => setNewCost({ ...newCost, date: e.target.value })} /></div>
                )}
              </div>
              <button className="btn primary wide" onClick={handleAddCost}>{ic(PATH.plus, 14, 2.4)} Inserisci Spesa</button>
            </div>
          </div>

          <div className="econside">
            <div className="rentw">
              <div className="glow" />
              <div className="rhead"><span className="zap">{ic(PATH.zap, 16, 2.2)}</span><span className="micro accent">Ottimizzazione Affitto</span></div>
              <div className="rline"><div><div className="rl1">Spese Totali Stimate</div>{rentWidgetData.oneOffExpenses > 0 && <div className="rl2">Fisse € {Math.round(rentWidgetData.fixedExpenses)}/m · Var. € {Math.round(rentWidgetData.oneOffExpenses)}/m</div>}</div><span className="num">{eur(rentWidgetData.totalExpenses)}<span className="per">/m</span></span></div>
              <div className="rline"><div className="rl1">Margine Target</div>
                <span className="num accent">
                  <input className="margin-in" type="number" value={selectedProp?.financials?.targetMargin || 0} onChange={e => selectedProp && setSelectedProp({ ...selectedProp, financials: { ...selectedProp.financials!, targetMargin: parseFloat(e.target.value) || 0 } })} />%
                </span>
              </div>
              <div className="rbig"><div className="micro">Canone Consigliato (netto tasse)</div><div className="n">{eur(rentWidgetData.suggestedRent)}</div></div>
              <div className="rfoot">
                <div className="l"><span>Utile Netto Previsto</span><span className="num pos">+{eur(rentWidgetData.netProfit)}/m</span></div>
                <div className="l"><span>Accantonamento Tasse ({rentWidgetData.taxRate}%)</span><span className="num neg">−{eur(rentWidgetData.estimatedTax)}</span></div>
              </div>
            </div>
            <div className="rentw" style={{ marginTop: '16px', border: '1px solid var(--indigo-soft)' }}>
              <div className="glow" style={{ background: 'var(--indigo-soft)', filter: 'blur(20px)' }} />
              <div className="rhead"><span className="zap" style={{ color: 'var(--indigo)' }}>{ic(PATH.shield, 16, 2.2)}</span><span className="micro accent" style={{ color: 'var(--indigo)' }}>Rendimento Immobiliare</span></div>
              <div className="rline"><div className="rl1">Cap Rate Lordo</div><span className="num" style={{ fontSize: '15px' }}>{yieldData.grossCapRate.toFixed(2)}%</span></div>
              <div className="rline"><div className="rl1">Cap Rate Netto (NOI)</div><span className="num accent" style={{ fontSize: '15px', color: 'var(--accent)' }}>{yieldData.netCapRate.toFixed(2)}%</span></div>
              <div className="rline"><div className="rl1">Cash-on-Cash Return</div><span className="num pos" style={{ fontSize: '15px', color: yieldData.cashOnCash >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{yieldData.cashOnCash.toFixed(2)}%</span></div>
              <div className="rfoot">
                <div className="l"><span>Rend. Netto Operativo (NOI)</span><span className="num">{eur(yieldData.noi / 12)}/m</span></div>
                <div className="l"><span>Flusso Netto (dopo Mutuo)</span><span className="num" style={{ color: yieldData.leveredCashFlow >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{seur(yieldData.leveredCashFlow / 12)}/m</span></div>
                <div className="l"><span>Capitale Investito</span><span className="num">{eur(yieldData.initialCash)}</span></div>
              </div>
            </div>
            <div className="panel pad">
              <div className="micro nb">Note Strategiche</div>
              <textarea className="input" value={selectedProp?.notes || ''} onChange={e => selectedProp && setSelectedProp({ ...selectedProp, notes: e.target.value })} placeholder="Annotazioni di portafoglio: inquilino corrente, potenziale rivalutazione, lavori straordinari, ecc." />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ANALISI' && (
        <div className="panel pad">
          <div className="pTitle col-head">
            <div><h3>Flussi di Cassa &amp; Ripartizione</h3><div className="subt">Analisi storica e previsionale delle spese di gestione</div></div>
            <div className="anfilters">
              <div className="seg sm">
                <button className={analysisFilterType === 'MONTH' ? 'on' : ''} onClick={() => setAnalysisFilterType('MONTH')}>Mese</button>
                <button className={analysisFilterType === 'YEAR' ? 'on' : ''} onClick={() => setAnalysisFilterType('YEAR')}>Anno</button>
              </div>
              <div className="dateinput">
                <span className="clc">{ic(PATH.cal, 14, 1.7)}</span>
                <input type={analysisFilterType === 'MONTH' ? 'month' : 'date'} value={analysisFilterType === 'MONTH' ? analysisDate.substring(0, 7) : analysisDate} onChange={e => setAnalysisDate(analysisFilterType === 'MONTH' ? e.target.value + '-01' : e.target.value)} />
              </div>
            </div>
          </div>
          <div className="anbody">
            <div className="chartcol">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--grid-line)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--faint)' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--faint)' }} />
                  <Tooltip content={<ChartTip />} cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeOpacity: 0.4 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingBottom: 18, fontSize: 9.5, fontWeight: 700, opacity: 0.85 }} />
                  {CATEGORIES.map(cat => (
                    <Line key={cat.id} type="monotone" dataKey={cat.id} name={cat.label} stroke={cat.stroke}
                      strokeWidth={hoveredCategory === cat.id ? 4.5 : 2} strokeOpacity={hoveredCategory === null || hoveredCategory === cat.id ? 1 : 0.15}
                      dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="panel pad donutcol">
              <div className="donutwrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} innerRadius="70%" outerRadius="90%" paddingAngle={4} dataKey="value" cornerRadius={6} stroke="none"
                      onMouseEnter={(_, index) => { const id = pieData[index]?.id; if (id) setHoveredCategory(id); }} onMouseLeave={() => setHoveredCategory(null)}>
                      {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donutc"><div className="micro">Media periodo</div><div className="num big">{eur(averageMonthly)}</div></div>
              </div>
              <div className="leglist">
                {pieData.length === 0 ? <div className="empty-sm">Nessuna spesa nel periodo</div> : pieData.map((item, i) => (
                  <div className={`legrow${hoveredCategory === item.id ? ' hov' : ''}`} key={i} onMouseEnter={() => setHoveredCategory(item.id)} onMouseLeave={() => setHoveredCategory(null)}>
                    <div className="lft"><span className="dot" style={{ background: item.color }} />{item.label}</div>
                    <span className="num">{eur(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'PREVISIONI' && (
        <MarketForecaster
          property={p}
          onSaveForecast={(updatedProp) => {
            setSelectedProp(updatedProp);
            savePropertyToDB(updatedProp);
          }}
        />
      )}
    </div>
  );

  /* ============================ LIST ============================ */
  const renderList = () => (
    <div className="body">
      <div className="phead">
        <div>
          <div className="eyebrow">Patrimonio Immobiliare</div>
          <h2>Il Mio Patrimonio</h2>
          <p>Gestione centralizzata e ottimizzazione dei tuoi asset immobiliari</p>
        </div>
        <button className="btn primary" onClick={() => { setNewPropData({ name: '', address: '', type: 'RESIDENTIAL', status: 'MAIN_RESIDENCE', purchasePrice: 0, currentValue: 0, notes: '', coordinates: { lat: 0, lng: 0 } }); (document.getElementById('new_property_modal') as any)?.showModal(); }}>{ic(PATH.plus, 15, 2.4)} Aggiungi Immobile</button>
      </div>

      <div className="kpis">
        <div className="kpi hero"><div className="glow" />
          <div className="top2"><span className="micro">Valutazione Patrimonio</span><span className="iconpill">{ic(PATH.building, 16)}</span></div>
          <div className="v">{eur(totalValue)}</div>
        </div>
        <div className="kpi">
          <div className="top2"><span className="micro">Costo Acquisizione</span><span className="iconpill muted">{ic(PATH.cart, 16)}</span></div>
          <div className="v dim">{eur(totalCost)}</div>
        </div>
        <div className="kpi">
          <div className="top2"><span className="micro">Plusvalenza Potenziale</span><span className={`chip ${totalGain >= 0 ? 'pos' : 'neg'}`}>{ic(totalGain >= 0 ? PATH.up : PATH.down, 12)} {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%</span></div>
          <div className="v" style={{ color: totalGain >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{seur(totalGain)}</div>
        </div>
      </div>

      {properties.length === 0 ? (
        <div className="emptystate">{ic(PATH.building, 40, 1.4)}<p className="t">Nessun immobile in portafoglio</p><p className="s">Fai clic su "Aggiungi Immobile" per iniziare a tracciare i tuoi asset</p></div>
      ) : (
        <div className="cards">
          {properties.map(p => {
            const ms = calculateMortgageStats(p); const gain = safeNum(p.currentValue) - safeNum(p.purchasePrice);
            const code = (p.name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div className="card" key={p.id} onClick={() => { setSelectedProp(p); setActiveTab('ANAGRAFICA'); setFilterCategory('ALL'); }}>
                <div className="chead">
                  <div className="cl"><div className="tag2">{code}</div><div className="cmin"><div className="nm">{p.name}</div><div className="ad">{p.address || 'Nessun indirizzo inserito'}</div></div></div>
                  <span className={`badge ${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                </div>
                <div className="cgrid">
                  <div className="cell"><div className="l">Valore Corrente</div><div className="n">{eur(p.currentValue)}</div></div>
                  <div className="cell"><div className="l">Plusvalenza</div><div className="n" style={{ color: gain >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{seur(gain)}</div></div>
                </div>
                {ms ? (
                  <div className="mort">
                    <div className="mt"><span className="micro indigo">Stato Mutuo</span><span className="num indigo sm">{ms.percent.toFixed(0)}%</span></div>
                    <div className="bar"><i style={{ width: `${ms.percent}%` }} /></div>
                    <div className="mfoot">
                      <div><div className="micro xs">Versato</div><div className="num sm">{eur(ms.paid)}</div></div>
                      <div className="r"><div className="micro xs">Residuo</div><div className="num sm">{eur(ms.remaining)}</div></div>
                    </div>
                  </div>
                ) : (
                  <div className="mort none">{ic(PATH.home, 15)}<span>Nessun mutuo attivo</span></div>
                )}
                <div className="cfoot">
                  <div className="ctype">{ic(typeIcon(p.type), 15)} {TYPE_LABEL[p.type]}</div>
                  <button className="delprop" onClick={e => handleDeleteProperty(p.id, e)}>{ic(PATH.trash, 14)}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <dialog id="new_property_modal" className="ipb-modal">
        <div className="mhead"><div><h3>Nuovo Immobile</h3><p>Inserisci un nuovo asset nel tuo patrimonio</p></div>
          <button className="mclose" onClick={() => (document.getElementById('new_property_modal') as any)?.close()}>✕</button></div>
        <div className="mbody">
          <div className="field"><label>Nome Identificativo</label><input className="input" value={newPropData.name} onChange={e => setNewPropData({ ...newPropData, name: e.target.value })} placeholder="Es. Bilocale Porta Romana" /></div>
          <div className="field"><label>Indirizzo Completo</label><input className="input" value={newPropData.address} onChange={e => setNewPropData({ ...newPropData, address: e.target.value })} placeholder="Via, Civico, Città" /></div>
          <div className="grid2">
            <div className="field"><label>Prezzo Acquisto</label><input className="input mono" type="number" value={newPropData.purchasePrice || ''} onChange={e => setNewPropData({ ...newPropData, purchasePrice: parseFloat(e.target.value) || 0 })} placeholder="€" /></div>
            <div className="field"><label>Valore Attuale</label><input className="input mono" type="number" value={newPropData.currentValue || ''} onChange={e => setNewPropData({ ...newPropData, currentValue: parseFloat(e.target.value) || 0 })} placeholder="€" /></div>
          </div>
          <div className="grid2">
            <div className="field"><label>Tipologia</label><select className="input" value={newPropData.type} onChange={e => setNewPropData({ ...newPropData, type: e.target.value as any })}><option value="RESIDENTIAL">Residenziale</option><option value="COMMERCIAL">Commerciale</option><option value="LAND">Terreno</option><option value="GARAGE">Garage</option></select></div>
            <div className="field"><label>Stato Iniziale</label><select className="input" value={newPropData.status} onChange={e => setNewPropData({ ...newPropData, status: e.target.value as any })}><option value="MAIN_RESIDENCE">Abitazione</option><option value="RENTED">Affittato</option><option value="EMPTY">Sfitto</option><option value="RENOVATION">Cantiere</option></select></div>
          </div>
          <button className="btn primary wide" onClick={() => { handleCreateProperty(); (document.getElementById('new_property_modal') as any)?.close(); }}>Crea Immobile</button>
        </div>
      </dialog>
    </div>
  );

  return (
    <div className={wrapClass}>
      <style>{IPB_CSS}</style>
      {selectedProp ? renderDetail(selectedProp) : renderList()}
    </div>
  );
};

/* ===================================================================================== */
const IPB_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&display=swap');
.ipb{
  --font:'Geist','DM Sans',system-ui,sans-serif; --mono:'Geist Mono',ui-monospace,monospace;
  --bg:#0a0e16; --panel:#111827; --panel-2:#151d2d; --inset:#0c121e;
  --border:rgba(255,255,255,.07); --border-2:rgba(255,255,255,.12);
  --text:#eaeff7; --dim:#8b97ab; --faint:#58637a;
  --accent:#2f8fff; --accent-2:#6f63ff; --accent-soft:rgba(47,143,255,.14); --glow:rgba(47,143,255,.28);
  --pos:#2fd6a3; --pos-soft:rgba(47,214,163,.14); --neg:#fb6f86; --neg-soft:rgba(251,111,134,.14);
  --warn:#f5b942; --warn-soft:rgba(245,185,66,.14); --indigo:#8b8bff; --indigo-soft:rgba(139,139,255,.12);
  --grid-line:rgba(255,255,255,.05); --r:11px; --r-sm:8px; --r-lg:16px;
  font-family:var(--font); color:var(--text); text-align:left;
}
.ipb.light{
  --bg:#f4f6fb; --panel:#fff; --panel-2:#fff; --inset:#f1f4f9;
  --border:rgba(15,23,42,.09); --border-2:rgba(15,23,42,.16);
  --text:#0c1424; --dim:#5a6679; --faint:#9aa6bb;
  --accent:#0a6cff; --accent-2:#5b4bff; --accent-soft:rgba(10,108,255,.10); --glow:rgba(10,108,255,.18);
  --pos:#0fa47a; --pos-soft:rgba(15,164,122,.12); --neg:#e23d63; --neg-soft:rgba(226,61,99,.10);
  --warn:#d98a0b; --warn-soft:rgba(217,138,11,.12); --indigo:#5b4bff; --indigo-soft:rgba(91,75,255,.10);
  --grid-line:rgba(15,23,42,.06);
}
.ipb *{ box-sizing:border-box; }
.ipb .body{ display:flex; flex-direction:column; gap:18px; }
.ipb .micro{ font-family:var(--mono); font-size:10px; font-weight:500; letter-spacing:.12em; text-transform:uppercase; color:var(--faint); }
.ipb .micro.accent{ color:var(--accent); } .ipb .micro.indigo{ color:var(--indigo); } .ipb .micro.xs{ font-size:8px; } .ipb .micro.nb{ margin-bottom:11px; }
.ipb .num{ font-family:var(--mono); font-weight:600; letter-spacing:-.01em; color:var(--text); font-feature-settings:"tnum" 1; }
.ipb .num.sm{ font-size:11px; } .ipb .num.big{ font-size:20px; margin-top:4px; } .ipb .num.pos{ color:var(--pos);} .ipb .num.neg{ color:var(--neg);} .ipb .num.accent{ color:var(--accent);} .ipb .num.indigo{ color:var(--indigo);}
.ipb .dot{ width:7px; height:7px; border-radius:50%; display:inline-block; }
.ipb .chip{ display:inline-flex; align-items:center; gap:5px; font-family:var(--mono); font-size:10.5px; font-weight:600; padding:4px 8px; border-radius:7px; }
.ipb .chip.pos{ color:var(--pos); background:var(--pos-soft);} .ipb .chip.neg{ color:var(--neg); background:var(--neg-soft);}
.ipb .panel{ background:var(--panel); border:1px solid var(--border); border-radius:var(--r); position:relative; }
.ipb .panel.pad{ padding:20px; }
.ipb .pTitle{ display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
.ipb .pTitle h3{ margin:0; font-size:13px; font-weight:600; } .ipb .pTitle .subt{ font-size:11px; color:var(--dim); margin-top:3px; }
.ipb .pTitle .ptl{ display:flex; align-items:center; gap:11px; }
.ipb .iconpill{ width:30px; height:30px; border-radius:8px; display:grid; place-items:center; background:var(--accent-soft); color:var(--accent); flex:none; }
.ipb .iconpill.muted{ background:var(--inset); color:var(--dim); }

/* buttons */
.ipb .btn{ border:none; cursor:pointer; font-family:var(--font); font-weight:700; font-size:11px; letter-spacing:.06em; text-transform:uppercase; padding:11px 18px; border-radius:10px; display:inline-flex; align-items:center; gap:7px; }
.ipb .btn.primary{ background:var(--accent); color:#fff; box-shadow:0 8px 24px -10px var(--glow); }
.ipb .btn.primary:hover{ filter:brightness(1.08); }
.ipb .btn.dark{ background:var(--text); color:var(--bg); }
.ipb .btn.wide{ width:100%; justify-content:center; padding:15px; }

/* list header */
.ipb .phead{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px; }
.ipb .phead .eyebrow{ font-family:var(--mono); font-size:10px; font-weight:600; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); }
.ipb .phead h2{ margin:4px 0 3px; font-size:26px; font-weight:700; letter-spacing:-.02em; }
.ipb .phead p{ margin:0; font-size:12.5px; color:var(--dim); }

/* kpis */
.ipb .kpis{ display:grid; grid-template-columns:1.1fr 1fr 1fr; gap:16px; }
.ipb .kpi{ border-radius:var(--r); padding:18px 20px; border:1px solid var(--border); position:relative; overflow:hidden; background:var(--panel); }
.ipb .kpi.hero{ background:linear-gradient(150deg,var(--panel-2),var(--panel)); }
.ipb .kpi .glow{ position:absolute; top:-40px; right:-30px; width:130px; height:130px; border-radius:50%; background:var(--accent-soft); filter:blur(28px); pointer-events:none; }
.ipb .kpi .top2{ display:flex; align-items:center; justify-content:space-between; }
.ipb .kpi .v{ font-family:var(--mono); font-size:28px; font-weight:600; letter-spacing:-.02em; margin-top:12px; }
.ipb .kpi .v.dim{ color:var(--dim); }

/* cards */
.ipb .cards{ display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
.ipb .card{ background:var(--panel); border:1px solid var(--border); border-radius:var(--r-lg); padding:18px; cursor:pointer; transition:border-color .18s,transform .18s; display:flex; flex-direction:column; gap:14px; }
.ipb .card:hover{ border-color:var(--accent); transform:translateY(-2px); }
.ipb .card .chead{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.ipb .card .cl{ display:flex; gap:11px; align-items:flex-start; min-width:0; }
.ipb .card .cmin{ min-width:0; } .ipb .card .nm{ font-size:14.5px; font-weight:700; letter-spacing:-.01em; } .ipb .card .ad{ font-size:11px; color:var(--faint); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ipb .tag2{ width:30px; height:30px; border-radius:8px; background:var(--accent-soft); color:var(--accent); display:grid; place-items:center; font-family:var(--mono); font-size:10px; font-weight:700; flex:none; }
.ipb .badge{ font-family:var(--mono); font-size:9px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; padding:4px 8px; border-radius:6px; flex:none; }
.ipb .b-rent{ background:var(--pos-soft); color:var(--pos);} .ipb .b-cant{ background:var(--warn-soft); color:var(--warn);} .ipb .b-empty{ background:var(--neg-soft); color:var(--neg);} .ipb .b-main{ background:var(--indigo-soft); color:var(--indigo);}
.ipb .cgrid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.ipb .cell{ background:var(--inset); border:1px solid var(--border); border-radius:var(--r-sm); padding:10px 12px; }
.ipb .cell .l{ font-family:var(--mono); font-size:8.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); }
.ipb .cell .n{ font-family:var(--mono); font-size:14px; font-weight:600; margin-top:4px; }
.ipb .mort{ background:var(--inset); border:1px solid var(--border); border-radius:var(--r-sm); padding:11px 12px; }
.ipb .mort.none{ display:flex; align-items:center; gap:9px; color:var(--faint); font-size:11.5px; }
.ipb .mort .mt{ display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; }
.ipb .bar{ height:5px; border-radius:4px; background:var(--bg); overflow:hidden; } .ipb .bar>i{ display:block; height:100%; border-radius:4px; background:var(--indigo); }
.ipb .mfoot{ display:flex; justify-content:space-between; margin-top:8px; } .ipb .mfoot .r{ text-align:right; }
.ipb .cfoot{ display:flex; align-items:center; justify-content:space-between; padding-top:12px; border-top:1px solid var(--border); }
.ipb .ctype{ display:flex; align-items:center; gap:6px; font-family:var(--mono); font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--dim); }
.ipb .delprop{ width:28px; height:28px; border-radius:8px; border:none; background:transparent; color:var(--faint); cursor:pointer; display:grid; place-items:center; }
.ipb .delprop:hover{ color:var(--neg); background:var(--neg-soft); }
.ipb .emptystate{ border:1.5px dashed var(--border-2); border-radius:var(--r-lg); padding:60px; display:flex; flex-direction:column; align-items:center; gap:10px; color:var(--faint); }
.ipb .emptystate .t{ font-weight:700; font-size:15px; color:var(--dim); margin:6px 0 0; } .ipb .emptystate .s{ font-size:12px; margin:0; }

/* detail */
.ipb .crumb{ display:flex; align-items:center; justify-content:space-between; gap:14px; }
.ipb .crumb .left{ display:flex; align-items:center; gap:12px; }
.ipb .backbtn{ width:38px; height:38px; border-radius:10px; background:var(--inset); border:1px solid var(--border); color:var(--dim); display:grid; place-items:center; cursor:pointer; }
.ipb .backbtn:hover{ color:var(--text); border-color:var(--border-2); }
.ipb .crumb .ttl{ margin:2px 0 0; font-size:20px; font-weight:700; letter-spacing:-.01em; }
.ipb .seg{ display:inline-flex; gap:2px; padding:3px; background:var(--inset); border:1px solid var(--border); border-radius:10px; }
.ipb .seg button{ border:none; background:transparent; cursor:pointer; font-family:var(--mono); font-size:11px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:var(--dim); padding:7px 14px; border-radius:7px; }
.ipb .seg button.on{ background:var(--panel); color:var(--text); box-shadow:0 1px 0 var(--border-2); }
.ipb .seg.sm button{ font-size:10px; padding:6px 11px; }

/* forms */
.ipb .formwrap{ display:grid; gap:18px; max-width:980px; margin:0 auto; }
.ipb .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.ipb .grid3{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
.ipb .split{ display:grid; grid-template-columns:1fr 1fr; gap:28px; padding-top:18px; border-top:1px solid var(--border); }
.ipb .col{ display:flex; flex-direction:column; gap:20px; }
.ipb .field label{ display:block; font-family:var(--mono); font-size:9px; letter-spacing:.12em; text-transform:uppercase; color:var(--faint); margin:0 0 7px 2px; }
.ipb .field label.indigo{ color:var(--indigo); }
.ipb .input{ width:100%; background:var(--inset); border:1px solid var(--border); border-radius:10px; color:var(--text); font-family:var(--font); font-size:13.5px; font-weight:500; padding:12px 14px; outline:none; }
.ipb .input:focus{ border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
.ipb .input.lg{ font-size:16px; font-weight:600; } .ipb .input.mono{ font-family:var(--mono); font-weight:600; }
.ipb select.input{ appearance:none; -webkit-appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238b97ab' stroke-width='2.4' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; padding-right:34px; cursor:pointer; }
.ipb textarea.input{ resize:none; min-height:120px; line-height:1.5; }
.ipb .moneybox{ background:var(--inset); border:1px solid var(--border); border-radius:10px; padding:12px 14px; }
.ipb .moneybox .l{ font-family:var(--mono); font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); }
.ipb .moneybox .row{ display:flex; align-items:center; gap:6px; margin-top:6px; }
.ipb .moneybox input{ background:transparent; border:none; outline:none; color:var(--text); font-family:var(--mono); font-size:17px; font-weight:600; width:100%; }
.ipb .moneybox .cur{ color:var(--faint); font-family:var(--mono); font-weight:600; }
.ipb .mortbox{ background:var(--indigo-soft); border:1px solid transparent; border-radius:var(--r-lg); padding:16px; display:grid; gap:14px; }
.ipb .sectlabel{ font-family:var(--mono); font-size:9px; letter-spacing:.14em; text-transform:uppercase; color:var(--faint); margin-bottom:12px; }
.ipb .doclist{ display:flex; flex-direction:column; gap:9px; }
.ipb .doc{ display:flex; align-items:center; justify-content:space-between; padding:11px 13px; background:var(--inset); border:1px solid var(--border); border-radius:10px; }
.ipb .doc .dn{ display:flex; align-items:center; gap:10px; font-size:12.5px; font-weight:600; min-width:0; } .ipb .doc .dn span{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .ipb .doc .dn svg{ color:var(--faint); flex:none; }
.ipb .docact{ display:flex; gap:6px; }
.ipb .docact a,.ipb .docact button{ width:30px; height:30px; border-radius:8px; border:1px solid var(--border); background:var(--bg); color:var(--dim); display:grid; place-items:center; cursor:pointer; }
.ipb .docact a:hover,.ipb .docact button:hover{ color:var(--text); border-color:var(--border-2); } .ipb .docact .del:hover{ color:var(--neg); border-color:var(--neg); }
.ipb .dropzone{ border:1.5px dashed var(--border-2); border-radius:10px; padding:18px; text-align:center; font-family:var(--mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; }
.ipb .dropzone:hover{ border-color:var(--accent); color:var(--dim); }

/* economica */
.ipb .econgrid{ display:grid; grid-template-columns:1.7fr 1fr; gap:18px; align-items:start; }
.ipb .econside{ display:flex; flex-direction:column; gap:18px; }
.ipb .catrow{ display:flex; gap:7px; flex-wrap:wrap; margin-bottom:6px; }
.ipb .catpill{ border:1px solid var(--border); background:var(--inset); color:var(--dim); font-family:var(--mono); font-size:9.5px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; padding:7px 11px; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
.ipb .catpill:hover{ color:var(--text); border-color:var(--border-2); }
.ipb .costlist{ margin-top:8px; }
.ipb .costrow{ display:grid; grid-template-columns:30px 1.5fr 1fr 1fr 1fr 32px; gap:12px; align-items:center; padding:12px 8px; border-top:1px solid var(--border); }
.ipb .cdate{ font-family:var(--mono); font-size:11.5px; color:var(--dim); }
.ipb .costrow:first-child{ border-top:none; }
.ipb .cati{ width:30px; height:30px; border-radius:8px; display:grid; place-items:center; }
.ipb .cinfo{ min-width:0; } .ipb .cdesc{ font-size:13px; font-weight:600; } .ipb .cfreq{ font-family:var(--mono); font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--faint); margin-top:1px; }
.ipb .camt{ font-size:13px; }
.ipb .freqpill{ font-family:var(--mono); font-size:10px; font-weight:600; padding:4px 8px; border-radius:7px; background:var(--inset); color:var(--dim); border:1px solid var(--border); }
.ipb .delc{ width:30px; height:30px; border-radius:8px; border:none; background:transparent; color:var(--faint); cursor:pointer; display:grid; place-items:center; }
.ipb .delc:hover{ color:var(--neg); background:var(--neg-soft); }
.ipb .empty-sm{ padding:28px; text-align:center; color:var(--faint); font-size:12.5px; }
.ipb .addcost{ padding-top:16px; margin-top:10px; border-top:1px dashed var(--border-2); }
.ipb .addcost .adtitle{ font-size:13px; font-weight:600; margin-bottom:14px; }
.ipb .addcost .adgrid{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:14px; }
.ipb .addcost .span2{ grid-column:span 2; }

/* rent widget */
.ipb .rentw{ background:linear-gradient(160deg,var(--panel-2),var(--panel)); border:1px solid var(--accent-soft); border-radius:var(--r-lg); padding:20px; position:relative; overflow:hidden; }
.ipb .rentw .glow{ position:absolute; top:-30px; right:-30px; width:120px; height:120px; border-radius:50%; background:var(--accent-soft); filter:blur(26px); }
.ipb .rhead{ display:flex; align-items:center; gap:8px; margin-bottom:14px; } .ipb .rhead .zap{ color:var(--accent); }
.ipb .rline{ display:flex; align-items:center; justify-content:space-between; padding:11px 0; border-top:1px solid var(--border); }
.ipb .rline:first-of-type{ border-top:none; }
.ipb .rline .rl1{ font-size:12px; color:var(--dim); font-weight:500; } .ipb .rline .rl2{ font-size:9px; color:var(--faint); margin-top:2px; } .ipb .rline .per{ color:var(--faint); font-size:10px; }
.ipb .margin-in{ width:42px; background:transparent; border:none; outline:none; color:var(--accent); font-family:var(--mono); font-weight:600; font-size:13px; text-align:right; }
.ipb .rbig{ text-align:center; padding:16px 0 4px; } .ipb .rbig .n{ font-family:var(--mono); font-size:30px; font-weight:600; color:var(--accent); margin-top:6px; }
.ipb .rfoot{ background:var(--inset); border:1px solid var(--border); border-radius:10px; padding:13px 15px; margin-top:14px; display:flex; flex-direction:column; gap:9px; }
.ipb .rfoot .l{ display:flex; align-items:center; justify-content:space-between; font-size:11px; color:var(--dim); }

/* analisi */
.ipb .col-head{ align-items:flex-start; }
.ipb .anfilters{ display:flex; gap:10px; align-items:center; }
.ipb .dateinput{ position:relative; display:inline-flex; align-items:center; }
.ipb .dateinput .clc{ position:absolute; left:11px; color:var(--accent); display:grid; pointer-events:none; }
.ipb .dateinput input{ background:var(--inset); border:1px solid var(--border); border-radius:9px; color:var(--text); font-family:var(--font); font-size:12.5px; font-weight:600; padding:8px 12px 8px 32px; outline:none; }
.ipb .dateinput input:focus{ border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
.ipb.light .dateinput input::-webkit-calendar-picker-indicator{ filter:none; }
.ipb .dateinput input::-webkit-calendar-picker-indicator{ filter:invert(.6); cursor:pointer; }
.ipb .anbody{ display:grid; grid-template-columns:1.55fr 1fr; gap:22px; align-items:stretch; }
.ipb .chartcol{ min-height:340px; height:340px; }
.ipb .donutcol{ padding: 18px 16px; background:var(--inset); display:flex; flex-direction:column; align-items:center; gap:12px; }
.ipb .donutwrap{ position:relative; width:150px; height:150px; flex:none; }
.ipb .donutc{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; pointer-events:none; line-height:1.25; }
.ipb .donutc .micro{ font-size:9px; opacity:0.85; }
.ipb .donutc .num.big{ font-size:18px; margin-top:2px; }
.ipb .leglist{ width:100%; max-height:140px; overflow-y:auto; }
.ipb .legrow{ display:flex; align-items:center; justify-content:space-between; padding:5px 8px; margin:0 -8px; border-radius:8px; }
.ipb .legrow:hover,.ipb .legrow.hov{ background:var(--panel); }
.ipb .legrow .lft{ display:flex; align-items:center; gap:9px; font-size:11.5px; color:var(--dim); }

/* recharts tooltip */
.ipb-tip{ background:var(--panel-2,#151d2d); border:1px solid var(--border-2,rgba(255,255,255,.12)); border-radius:10px; padding:10px 12px; box-shadow:0 16px 36px -12px rgba(0,0,0,.6); min-width:150px; }
.ipb-tip .tlab{ font-family:var(--mono); font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint,#58637a); margin:0 0 7px; }
.ipb-tip .trow{ display:flex; align-items:center; justify-content:space-between; gap:16px; padding:2px 0; font-size:11px; }
.ipb-tip .trow .nm{ display:flex; align-items:center; gap:6px; color:var(--dim,#8b97ab); }
.ipb-tip .dot{ width:8px; height:8px; border-radius:50%; display:inline-block; }
.ipb-tip .num{ font-family:var(--mono); font-weight:600; font-size:11px; }

/* modal */
.ipb-modal{ padding:0; border:none; border-radius:var(--r-lg); width:100%; max-width:440px; background:var(--panel); color:var(--text); box-shadow:0 40px 120px -30px rgba(0,0,0,.8); }
.ipb-modal::backdrop{ background:rgba(4,7,14,.6); backdrop-filter:blur(3px); }
.ipb-modal .mhead{ display:flex; align-items:center; justify-content:space-between; padding:20px 22px; border-bottom:1px solid var(--border); }
.ipb-modal .mhead h3{ margin:0; font-size:16px; font-weight:700; } .ipb-modal .mhead p{ margin:3px 0 0; font-size:11px; color:var(--faint); }
.ipb-modal .mclose{ width:34px; height:34px; border-radius:9px; border:1px solid var(--border); background:var(--inset); color:var(--dim); cursor:pointer; font-size:14px; }
.ipb-modal .mclose:hover{ color:var(--neg); border-color:var(--neg); }
.ipb-modal .mbody{ padding:22px; display:grid; gap:14px; }

@media (max-width:1100px){
  .ipb .kpis,.ipb .cards{ grid-template-columns:repeat(2,1fr); }
  .ipb .econgrid,.ipb .anbody,.ipb .split{ grid-template-columns:1fr; }
  .ipb .addcost .adgrid{ grid-template-columns:repeat(2,1fr); }
}
@media (max-width:640px){
  .ipb .kpis,.ipb .cards,.ipb .grid2,.ipb .grid3{ grid-template-columns:1fr; }
  .ipb .phead{ flex-direction:column; align-items:stretch; }
}
`;

export default PropertyAssetManager;
