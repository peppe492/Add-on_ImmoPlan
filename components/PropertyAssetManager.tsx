import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Property, RecurringCost, RentalRecord, Tenant, Attachment } from '../types';
import { db } from '../services/dbService';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, Tooltip, YAxis, CartesianGrid, Legend } from 'recharts';

type DetailTab = 'ANAGRAFICA' | 'ECONOMICA' | 'ANALISI';

const CATEGORIES = [
  { id: 'MORTGAGE', label: 'MUTUO/PRESTITO', icon: '🏦', color: 'bg-indigo-50 text-indigo-600', stroke: '#4f46e5' },
  { id: 'TAX', label: 'TASSE (IMU/TARI)', icon: '🏛️', color: 'bg-slate-50 text-slate-600', stroke: '#64748b' },
  { id: 'MAINTENANCE', label: 'CONDOMINIO/MANUT.', icon: '🛠️', color: 'bg-amber-50 text-amber-600', stroke: '#d97706' },
  { id: 'UTILITY', label: 'UTENZE', icon: '💡', color: 'bg-yellow-50 text-yellow-500', stroke: '#eab308' },
  { id: 'INTERNET', label: 'INTERNET', icon: '🌐', color: 'bg-cyan-50 text-cyan-600', stroke: '#06b6d4' },
  { id: 'INSURANCE', label: 'ASSICURAZIONE', icon: '🛡️', color: 'bg-emerald-50 text-emerald-600', stroke: '#10b981' },
  { id: 'OTHER', label: 'ALTRO', icon: '📦', color: 'bg-gray-50 text-gray-600', stroke: '#94a3b8' },
] as const;

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 11 }, (_, i) => currentYear - 1 + i);

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

export const PropertyAssetManager: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [records, setRecords] = useState<RentalRecord[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedProp, setSelectedProp] = useState<Property | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('ANAGRAFICA');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  
  const [analysisFilterType, setAnalysisFilterType] = useState<'DAY' | 'MONTH' | 'YEAR'>('YEAR');
  const [analysisDate, setAnalysisDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [newCost, setNewCost] = useState<Partial<RecurringCost>>({
    category: 'OTHER', 
    frequency: 'MONTHLY', 
    amount: 0, 
    name: '', 
    referenceMonth: new Date().getMonth(), 
    referenceYear: new Date().getFullYear(), 
    date: new Date().toISOString().split('T')[0]
  });

  const [newPropData, setNewPropData] = useState<Partial<Property>>({
    name: '', address: '', type: 'RESIDENTIAL', status: 'MAIN_RESIDENCE', purchasePrice: 0, currentValue: 0, notes: '', coordinates: { lat: 0, lng: 0 }
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [loadedProps, loadedRecords, loadedTenants] = await Promise.all([db.getProperties(), db.getRentalRecords(), db.getTenants()]);
    const uniqueProps = Array.from(new Map((loadedProps || []).map(p => [p.id, p])).values());
    setProperties(uniqueProps);
    setRecords(loadedRecords || []);
    setTenants(loadedTenants || []);
    // Non sovrascriviamo selectedProp qui per evitare conflitti durante l'editing
  };

  const handleCreateProperty = async () => {
    if (!newPropData.name) return alert("Inserisci il nome");
    const p: Property = {
        id: `PROP-${Date.now()}`,
        name: newPropData.name!,
        address: newPropData.address || '',
        type: newPropData.type as any || 'RESIDENTIAL',
        status: newPropData.status as any || 'MAIN_RESIDENCE',
        purchasePrice: safeNum(newPropData.purchasePrice), 
        currentValue: safeNum(newPropData.currentValue), 
        purchaseDate: new Date().toISOString().split('T')[0],
        recurringCosts: [],
        financials: { mortgageAmount: 0, mortgageDuration: 20, mortgageStartDate: new Date().toISOString().split('T')[0], mortgageRate: 0, monthlyRent: 0, condoFees: 0, defaultTaxRate: 21 },
        coordinates: newPropData.coordinates || { lat: 0, lng: 0 },
        notes: newPropData.notes,
        documents: []
    };
    await db.saveProperty(p);
    setNewPropData({ name: '', address: '', type: 'RESIDENTIAL', status: 'MAIN_RESIDENCE', purchasePrice: 0, currentValue: 0, notes: '', coordinates: { lat: 0, lng: 0 } });
    loadData();
  };

  // Funzione per salvare su DB (usata dal pulsante "Salva")
  const savePropertyToDB = async (propToSave: Property) => {
    await db.saveProperty(propToSave);
    await loadData();
    alert("Modifiche salvate con successo!");
  };
  
  const handleDeleteProperty = async (id: string, e?: React.MouseEvent) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (window.confirm("Eliminare definitivamente l'immobile?")) {
          setProperties(prev => prev.filter(p => p.id !== id));
          if (selectedProp?.id === id) setSelectedProp(null);
          await db.deleteProperty(id);
          await loadData(); 
      }
  };

  const handleAddCost = async () => {
    if (!selectedProp || !newCost.amount || !newCost.name) return;
    const cost: RecurringCost = { ...newCost as RecurringCost, id: `COST-${Date.now()}` };
    const updatedProp = { ...selectedProp, recurringCosts: [...(selectedProp.recurringCosts || []), cost] };
    
    // Aggiorniamo sia lo stato locale che il DB per i costi
    setSelectedProp(updatedProp);
    await db.saveProperty(updatedProp);
    await loadData();

    setNewCost({ 
        category: 'OTHER', 
        frequency: 'MONTHLY', 
        amount: 0, 
        name: '', 
        referenceMonth: new Date().getMonth(), 
        referenceYear: new Date().getFullYear(), 
        date: new Date().toISOString().split('T')[0] 
    });
  };

  const handleDeleteCost = async (costId: string) => {
      if(!selectedProp) return;
      const updatedProp = { ...selectedProp, recurringCosts: (selectedProp.recurringCosts || []).filter(c => c.id !== costId) };
      setSelectedProp(updatedProp);
      await db.saveProperty(updatedProp);
      await loadData();
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedProp) {
        const customName = window.prompt("Nome documento:", file.name);
        if (customName !== null) {
            const att = await readFile(file);
            if (customName) att.name = customName;
            const updatedDocs = [...(selectedProp.documents || []), att];
            const updatedProp = { ...selectedProp, documents: updatedDocs };
            setSelectedProp(updatedProp);
            await db.saveProperty(updatedProp);
            await loadData();
        }
    }
  };

  const handleDeleteDocument = async (index: number) => {
      if (selectedProp && selectedProp.documents && window.confirm("Rimuovere documento?")) {
          const updatedDocs = [...selectedProp.documents];
          updatedDocs.splice(index, 1);
          const updatedProp = { ...selectedProp, documents: updatedDocs };
          setSelectedProp(updatedProp);
          await db.saveProperty(updatedProp);
          await loadData();
      }
  };

  // Helper per il calcolo avanzato progresso mutuo (con rate)
  const calculateMortgageStats = (p: Property) => {
      if (!p.financials?.mortgageAmount || !p.financials?.mortgageDuration || !p.financials?.mortgageStartDate) return null;
      
      const installment = safeNum(p.financials.mortgageAmount);
      const start = new Date(p.financials.mortgageStartDate);
      const now = new Date();
      const totalMonths = p.financials.mortgageDuration * 12;
      
      // Calcolo mesi trascorsi
      let elapsedMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      elapsedMonths = Math.max(0, Math.min(elapsedMonths, totalMonths)); // Clamp tra 0 e totale
      
      const percent = (elapsedMonths / totalMonths) * 100;
      
      const totalToPay = installment * totalMonths;
      const paid = installment * elapsedMonths;
      const remaining = totalToPay - paid;

      return { percent, paid, remaining, totalToPay, elapsedMonths, totalMonths };
  };

  const totalValue = properties.reduce((acc, p) => acc + safeNum(p.currentValue), 0);
  const totalCost = properties.reduce((acc, p) => acc + safeNum(p.purchasePrice), 0);
  const totalGain = totalValue - totalCost;

  const currentCosts = useMemo(() => selectedProp?.recurringCosts || [], [selectedProp]);
  const filteredCosts = useMemo(() => filterCategory === 'ALL' ? currentCosts : currentCosts.filter(c => c.category === filterCategory), [currentCosts, filterCategory]);

  const rentWidgetData = useMemo(() => {
    if (!selectedProp) return { totalExpenses: 0, suggestedRent: 0, netProfit: 0, estimatedTax: 0, marginPercent: 0, taxRate: 21 };
    let monthlyExpenses = 0;
    const costs = selectedProp.recurringCosts || [];
    costs.forEach(c => {
        if (c.frequency === 'MONTHLY') monthlyExpenses += safeNum(c.amount);
        else if (c.frequency === 'YEARLY') monthlyExpenses += safeNum(c.amount) / 12;
    });
    // Se non c'è una voce di costo esplicita per il mutuo, lo calcoliamo dai financials
    // NOTA: mortgageAmount è ora la RATA MENSILE
    if (!costs.some(c => c.category === 'MORTGAGE') && selectedProp.financials?.mortgageAmount) {
        monthlyExpenses += safeNum(selectedProp.financials.mortgageAmount);
    }
    const marginPercent = selectedProp.financials?.targetMargin || 0;
    const taxRate = selectedProp.financials?.defaultTaxRate || 21;
    const desiredNetIncome = monthlyExpenses * (1 + (marginPercent / 100));
    const suggestedRent = taxRate < 100 ? desiredNetIncome / (1 - (taxRate / 100)) : 0;
    const estimatedTax = suggestedRent * (taxRate / 100);
    const netProfit = suggestedRent - estimatedTax - monthlyExpenses;
    return { totalExpenses: monthlyExpenses, suggestedRent, netProfit, estimatedTax, marginPercent, taxRate };
  }, [selectedProp]);

  const lineData = useMemo(() => {
      if (!selectedProp) return [];
      const targetDate = new Date(analysisDate);
      const isYearView = analysisFilterType === 'YEAR';
      const iterations = isYearView ? 12 : new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
      return Array.from({length: iterations}, (_, i) => {
          const label = isYearView ? new Date(targetDate.getFullYear(), i, 1).toLocaleString('it-IT', { month: 'short' }) : (i + 1).toString();
          const datum: any = { name: label };
          CATEGORIES.forEach(cat => datum[cat.id] = 0);
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
      const totals: any = {};
      CATEGORIES.forEach(c => totals[c.id] = 0);
      lineData.forEach((d: any) => CATEGORIES.forEach(c => totals[c.id] += safeNum(d[c.id])));
      const chartData = CATEGORIES.map(c => ({ name: c.id, value: totals[c.id], label: c.label, color: c.stroke })).filter(d => d.value > 0);
      return { pieData: chartData, averageMonthly: analysisFilterType === 'YEAR' ? chartData.reduce((a, b) => a + b.value, 0) / 12 : chartData.reduce((a, b) => a + b.value, 0) };
  }, [lineData, analysisFilterType]);

  if (selectedProp) {
      return (
          <div className="space-y-6 animate-fade-in pb-20 lg:pb-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                      <button onClick={() => setSelectedProp(null)} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">←</button>
                      <h2 className="text-xl lg:text-2xl font-black text-slate-800 truncate">{selectedProp.name}</h2>
                  </div>
                  <div className="flex bg-slate-200/50 p-1 rounded-2xl overflow-x-auto no-scrollbar shrink-0 no-print scrollbar-hide">
                      {(['ANAGRAFICA', 'ECONOMICA', 'ANALISI'] as const).map(tab => (
                          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${activeTab === tab ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500'}`}>
                              {tab}
                          </button>
                      ))}
                  </div>
              </div>

              {activeTab === 'ANAGRAFICA' && (
                  <div className="bg-white p-5 lg:p-8 rounded-[2rem] shadow-soft border border-slate-100">
                      <div className="space-y-8 max-w-4xl mx-auto">
                           <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Nome Immobile</label>
                                    <input type="text" value={selectedProp.name} onChange={e => setSelectedProp({...selectedProp, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base lg:text-lg outline-none focus:ring-2 focus:ring-brand-500 text-slate-900" placeholder="Nome Immobile" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Indirizzo</label>
                                    <input type="text" value={selectedProp.address} onChange={e => setSelectedProp({...selectedProp, address: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900" placeholder="Indirizzo" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Tipo</label>
                                        <select value={selectedProp.type} onChange={e => setSelectedProp({...selectedProp, type: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900">
                                            <option value="RESIDENTIAL">Residenziale</option>
                                            <option value="COMMERCIAL"> Commerciale</option>
                                            <option value="LAND">Terreno</option>
                                            <option value="GARAGE">Garage</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Stato</label>
                                        <select value={selectedProp.status} onChange={e => setSelectedProp({...selectedProp, status: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900">
                                            <option value="MAIN_RESIDENCE">Abitazione Principale</option>
                                            <option value="RENTED">Affittato</option>
                                            <option value="EMPTY">Sfitto</option>
                                            <option value="RENOVATION">Ristrutturazione</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Inquilino Attivo</label>
                                        <select value={selectedProp.currentTenantId || ''} onChange={e => setSelectedProp({...selectedProp, currentTenantId: e.target.value || undefined})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900">
                                            <option value="">Nessun Inquilino</option>
                                            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                           </div>

                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                               <div className="space-y-6">
                                   <div className="space-y-4">
                                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Valutazione Immobiliare</label>
                                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                           <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                               <span className="text-[10px] font-bold text-slate-400 block mb-1">Prezzo Acquisto</span>
                                               <div className="flex items-center">
                                                    <span className="text-slate-400 font-bold mr-1">€</span>
                                                    <input type="number" value={selectedProp.purchasePrice} onChange={e => setSelectedProp({...selectedProp, purchasePrice: parseFloat(e.target.value)})} className="w-full bg-transparent font-black text-lg outline-none text-slate-900" />
                                               </div>
                                           </div>
                                           <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                               <span className="text-[10px] font-bold text-slate-400 block mb-1">Valore Attuale</span>
                                               <div className="flex items-center">
                                                    <span className="text-slate-400 font-bold mr-1">€</span>
                                                    <input type="number" value={selectedProp.currentValue} onChange={e => setSelectedProp({...selectedProp, currentValue: parseFloat(e.target.value)})} className="w-full bg-transparent font-black text-lg outline-none text-slate-900" />
                                               </div>
                                           </div>
                                       </div>
                                   </div>

                                   <div className="space-y-4">
                                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Dettagli Mutuo</label>
                                       <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-4">
                                            <div>
                                                <span className="text-[10px] font-bold text-indigo-400 block mb-1">Rata Mensile Mutuo</span>
                                                <div className="relative">
                                                    <input 
                                                        type="number" 
                                                        value={selectedProp.financials?.mortgageAmount || ''} 
                                                        onChange={e => setSelectedProp({
                                                            ...selectedProp, 
                                                            financials: { ...(selectedProp.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), mortgageAmount: parseFloat(e.target.value) || 0 }
                                                        })} 
                                                        className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder-indigo-300" 
                                                        placeholder="Es. 550" 
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-300 font-bold text-xs">€/mese</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-[10px] font-bold text-indigo-400 block mb-1">Durata (Anni)</span>
                                                    <input 
                                                        type="number" 
                                                        value={selectedProp.financials?.mortgageDuration || ''} 
                                                        onChange={e => setSelectedProp({
                                                            ...selectedProp, 
                                                            financials: { ...(selectedProp.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), mortgageDuration: parseFloat(e.target.value) || 0 }
                                                        })} 
                                                        className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder-indigo-300" 
                                                        placeholder="20" 
                                                    />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-indigo-400 block mb-1">Data Inizio</span>
                                                    <input 
                                                        type="date" 
                                                        value={selectedProp.financials?.mortgageStartDate || ''} 
                                                        onChange={e => setSelectedProp({
                                                            ...selectedProp, 
                                                            financials: { ...(selectedProp.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), mortgageStartDate: e.target.value }
                                                        })} 
                                                        className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900" 
                                                    />
                                                </div>
                                            </div>
                                       </div>
                                   </div>
                               </div>
                               <div className="space-y-4">
                                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Documentazione</label>
                                   <div className="grid grid-cols-1 gap-2">
                                       {(selectedProp.documents || []).map((doc, idx) => (
                                           <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:border-brand-300 transition-all">
                                               <span className="text-xs font-bold text-slate-700 truncate flex-1">{doc.name}</span>
                                               <div className="flex gap-2 shrink-0">
                                                   <a href={doc.data} download={doc.name} className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs hover:bg-white">⬇️</a>
                                                   <button onClick={() => handleDeleteDocument(idx)} className="p-2 bg-rose-50 text-rose-500 rounded-lg text-xs hover:bg-rose-100 transition-colors">🗑️</button>
                                               </div>
                                           </div>
                                       ))}
                                       <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 cursor-pointer transition-all hover:border-brand-400">
                                           <input type="file" onChange={handleUploadDocument} className="absolute inset-0 opacity-0 cursor-pointer" />
                                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">+ Aggiungi Documento</span>
                                       </div>
                                   </div>
                               </div>
                           </div>
                           <button onClick={() => savePropertyToDB(selectedProp)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all">Salva Modifiche Patrimonio</button>
                      </div>
                  </div>
              )}

              {activeTab === 'ECONOMICA' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                       <div className="lg:col-span-8 space-y-6">
                           <div className="bg-white p-5 lg:p-6 rounded-[2rem] shadow-soft border border-slate-100">
                               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                   <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><span>🧾</span> Spese Ricorrenti</h3>
                                   <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto scrollbar-hide pb-2">
                                       <button onClick={() => setFilterCategory('ALL')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase shrink-0 transition-all ${filterCategory === 'ALL' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Tutte</button>
                                       {CATEGORIES.map(cat => (
                                           <button key={cat.id} onClick={() => setFilterCategory(cat.id)} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase shrink-0 transition-all ${filterCategory === cat.id ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{cat.icon} {cat.label.split('/')[0]}</button>
                                       ))}
                                   </div>
                               </div>

                               <div className="space-y-3">
                                   {filteredCosts.length === 0 ? (
                                       <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl text-slate-400 text-sm italic">Nessuna spesa registrata in questa categoria</div>
                                   ) : (
                                       filteredCosts.map(cost => {
                                           const cat = CATEGORIES.find(c => c.id === cost.category);
                                           return (
                                               <div key={cost.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-brand-200 group transition-all">
                                                   <div className="flex items-center gap-4 flex-1 w-full mb-4 sm:mb-0">
                                                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${cat?.color || 'bg-slate-100 text-slate-500'}`}>{cat?.icon || '📦'}</div>
                                                       <div className="min-w-0 flex-1">
                                                           <p className="font-bold text-slate-800 text-sm truncate">{cost.name}</p>
                                                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                               {cost.frequency === 'MONTHLY' ? `Mensile (${MONTHS[cost.referenceMonth || 0].substring(0, 3)} ${cost.referenceYear})` : 
                                                                cost.frequency === 'YEARLY' ? `Annuale (${cost.referenceYear})` : 
                                                                `Una Tantum (${new Date(cost.date || '').toLocaleDateString('it-IT')})`}
                                                           </p>
                                                       </div>
                                                   </div>
                                                   <div className="flex items-center justify-between w-full sm:w-auto gap-6 sm:gap-10">
                                                       <div className="text-right">
                                                           <p className="text-lg font-black text-slate-900">€ {safeNum(cost.amount).toLocaleString()}</p>
                                                           <p className="text-[9px] font-bold text-slate-400 uppercase">{cost.frequency === 'MONTHLY' ? '€/mese' : 'Totale'}</p>
                                                       </div>
                                                       <button onClick={() => handleDeleteCost(cost.id)} className="w-10 h-10 rounded-full bg-white border border-slate-200 text-rose-500 flex items-center justify-center hover:bg-rose-50 hover:border-rose-200 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100">🗑️</button>
                                                   </div>
                                               </div>
                                           );
                                       })
                                   )}
                               </div>
                           </div>

                           <div className="bg-white p-5 lg:p-8 rounded-[2rem] shadow-soft border border-slate-100">
                               <h3 className="font-bold text-lg text-slate-800 mb-6">Aggiungi Nuova Spesa</h3>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                   <div className="col-span-1 sm:col-span-2">
                                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Descrizione Spesa</label>
                                       <input type="text" value={newCost.name} onChange={e => setNewCost({...newCost, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900" placeholder="Es. Manutenzione Giardino" />
                                   </div>
                                   <div>
                                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Importo</label>
                                       <div className="relative">
                                           <input type="number" value={newCost.amount || ''} onChange={e => setNewCost({...newCost, amount: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900" placeholder="0" />
                                           <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">€</span>
                                       </div>
                                   </div>
                                   <div>
                                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Categoria</label>
                                       <select value={newCost.category} onChange={e => setNewCost({...newCost, category: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900">
                                           {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                                       </select>
                                   </div>
                                   <div className="col-span-1 sm:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                                       <div>
                                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Frequenza</label>
                                           <select value={newCost.frequency} onChange={e => setNewCost({...newCost, frequency: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900">
                                               <option value="MONTHLY">Mensile</option>
                                               <option value="YEARLY">Annuale</option>
                                               <option value="ONE_OFF">Una Tantum</option>
                                           </select>
                                       </div>

                                       <div className="flex gap-3">
                                           {newCost.frequency === 'MONTHLY' && (
                                               <>
                                                   <div className="flex-1">
                                                       <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1.5 block">Mese Inizio</label>
                                                       <select value={newCost.referenceMonth} onChange={e => setNewCost({...newCost, referenceMonth: parseInt(e.target.value)})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900">
                                                           {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                                       </select>
                                                   </div>
                                                   <div className="flex-1">
                                                       <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1.5 block">Anno Inizio</label>
                                                       <select value={newCost.referenceYear} onChange={e => setNewCost({...newCost, referenceYear: parseInt(e.target.value)})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900">
                                                           {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                                       </select>
                                                   </div>
                                               </>
                                           )}
                                           {newCost.frequency === 'YEARLY' && (
                                               <div className="flex-1">
                                                   <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1.5 block">Anno di Riferimento</label>
                                                   <select value={newCost.referenceYear} onChange={e => setNewCost({...newCost, referenceYear: parseInt(e.target.value)})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900">
                                                       {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                                   </select>
                                               </div>
                                           )}
                                           {newCost.frequency === 'ONE_OFF' && (
                                               <div className="flex-1">
                                                   <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1.5 block">Data Scadenza</label>
                                                   <input type="date" value={newCost.date} onChange={e => setNewCost({...newCost, date: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900" />
                                               </div>
                                           )}
                                       </div>
                                   </div>
                                   <div className="col-span-1 sm:col-span-2 pt-2">
                                       <button onClick={handleAddCost} className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold uppercase text-[11px] tracking-widest shadow-lg hover:bg-brand-700 active:scale-95 transition-all">Aggiungi Spesa</button>
                                   </div>
                               </div>
                           </div>
                       </div>

                       <div className="lg:col-span-4 space-y-6">
                           <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden">
                               <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                               <h4 className="text-sm font-bold text-brand-400 uppercase tracking-widest mb-4">Ottimizzazione Affitto</h4>
                               <div className="space-y-4">
                                   <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                                       <span className="text-xs text-slate-400">Spese Mensili Totali</span>
                                       <span className="font-bold">€ {rentWidgetData.totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                   </div>
                                   <div className="flex justify-between items-center py-3 border-b border-slate-800">
                                       <div className="flex flex-col">
                                          <span className="text-xs text-slate-400">Target Margine</span>
                                          <input type="number" value={selectedProp.financials?.targetMargin || 0} onChange={e => setSelectedProp({...selectedProp, financials: {...selectedProp.financials!, targetMargin: parseFloat(e.target.value)}})} className="bg-transparent text-[10px] font-bold text-brand-400 border-none p-0 focus:ring-0" />
                                       </div>
                                       <span className="font-bold text-brand-400">{rentWidgetData.marginPercent}%</span>
                                   </div>
                                   <div className="py-4">
                                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 text-center">Canone Suggerito (Netto Tasse)</p>
                                       <p className="text-3xl font-black text-center text-white">€ {rentWidgetData.suggestedRent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                   </div>
                                   <div className="bg-slate-800/50 p-4 rounded-2xl">
                                       <div className="flex justify-between items-center text-[10px] mb-1">
                                           <span className="text-slate-400">Utile Netto Stimato</span>
                                           <span className="font-bold text-emerald-400">+ € {rentWidgetData.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mese</span>
                                       </div>
                                       <div className="flex justify-between items-center text-[10px]">
                                           <span className="text-slate-400">Accantonamento Tasse ({rentWidgetData.taxRate}%)</span>
                                           <span className="font-bold text-rose-400">- € {rentWidgetData.estimatedTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                       </div>
                                   </div>
                               </div>
                           </div>
                           
                           <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-soft">
                               <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4">Note Strategiche</h4>
                               <textarea 
                                    value={selectedProp.notes || ''} 
                                    onChange={e => setSelectedProp({...selectedProp, notes: e.target.value})}
                                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-xs font-medium h-40 focus:ring-2 focus:ring-brand-500 resize-none text-slate-900"
                                    placeholder="Annotazioni su inquilini, manutenzioni future, potenziale di vendita..."
                               />
                           </div>
                       </div>
                  </div>
              )}

              {activeTab === 'ANALISI' && (
                  <div className="space-y-6">
                      <div className="bg-white p-5 lg:p-8 rounded-[2rem] shadow-soft border border-slate-100">
                          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
                               <div>
                                   <h3 className="text-xl font-bold text-slate-800">Analisi Flussi di Cassa</h3>
                                   <p className="text-xs text-slate-400 font-medium">Andamento previsionale delle uscite</p>
                               </div>
                               <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                                   <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner shrink-0">
                                       <button onClick={() => setAnalysisFilterType('MONTH')} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${analysisFilterType === 'MONTH' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}>Mese</button>
                                       <button onClick={() => setAnalysisFilterType('YEAR')} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${analysisFilterType === 'YEAR' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}>Anno</button>
                                   </div>
                                   <input type={analysisFilterType === 'MONTH' ? 'month' : 'date'} value={analysisFilterType === 'MONTH' ? analysisDate.substring(0, 7) : analysisDate} onChange={e => setAnalysisDate(analysisFilterType === 'MONTH' ? e.target.value + '-01' : e.target.value)} className="bg-slate-50 border border-slate-200 py-2 px-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 flex-1 lg:flex-none text-slate-900" />
                               </div>
                          </div>

                          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                              <div className="xl:col-span-8 h-[300px] lg:h-[400px]">
                                  <ResponsiveContainer width="100%" height="100%">
                                      <LineChart data={lineData}>
                                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10} />
                                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                                          <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'}} />
                                          <Legend iconType="circle" verticalAlign="top" height={36}/>
                                          {CATEGORIES.map(cat => (
                                              <Line key={cat.id} type="monotone" dataKey={cat.id} name={cat.label} stroke={cat.stroke} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                          ))}
                                      </LineChart>
                                  </ResponsiveContainer>
                              </div>

                              <div className="xl:col-span-4 flex flex-col items-center justify-center p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                                   <div className="relative w-full aspect-square max-w-[280px]">
                                       <ResponsiveContainer width="100%" height="100%">
                                           <PieChart>
                                               <Pie data={pieData} innerRadius="65%" outerRadius="90%" paddingAngle={5} dataKey="value" cornerRadius={8}>
                                                   {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                               </Pie>
                                               <Tooltip />
                                           </PieChart>
                                       </ResponsiveContainer>
                                       <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Media Mese</p>
                                           <p className="text-2xl font-black text-slate-800">€ {averageMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                       </div>
                                   </div>
                                   <div className="w-full mt-6 space-y-2">
                                       {pieData.map((item, i) => (
                                           <div key={i} className="flex justify-between items-center text-[10px] font-bold">
                                               <div className="flex items-center gap-2">
                                                   <div className="w-2 h-2 rounded-full" style={{backgroundColor: item.color}}></div>
                                                   <span className="text-slate-500 uppercase">{item.label}</span>
                                               </div>
                                               <span className="text-slate-900">€ {item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                           </div>
                                       ))}
                                   </div>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-20 lg:pb-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-slate-900">Il Mio Patrimonio</h2>
          <p className="text-slate-500 text-sm mt-1">Gestione centralizzata e analisi del portafoglio immobiliare.</p>
        </div>
        <button onClick={() => { setNewPropData({ name: '', address: '', type: 'RESIDENTIAL', status: 'MAIN_RESIDENCE', purchasePrice: 0, currentValue: 0, notes: '', coordinates: { lat: 0, lng: 0 } }); (document.getElementById('new_property_modal') as any).showModal(); }} className="bg-brand-600 text-white px-8 py-4 rounded-2xl font-bold shadow-glow hover:bg-brand-700 transition-all active:scale-95 w-full md:w-auto">
          + Nuovo Immobile
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <p className="text-brand-400 font-bold text-[10px] uppercase tracking-widest mb-1 relative z-10">Patrimonio Totale</p>
          <h3 className="text-3xl font-black relative z-10">€ {totalValue.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100">
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Costo Totale Acq.</p>
          <h3 className="text-3xl font-black text-slate-800">€ {totalCost.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100">
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Plusvalenza Potenziale</p>
          <h3 className={`text-3xl font-black ${totalGain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>€ {totalGain.toLocaleString()}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties.length === 0 ? (
          <div className="col-span-full py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
            <span className="text-5xl mb-4">🏠</span>
            <p className="font-bold text-lg">Nessun immobile registrato</p>
            <p className="text-sm">Inizia aggiungendo la tua prima proprietà</p>
          </div>
        ) : (
          properties.map(p => {
            const mStats = calculateMortgageStats(p);
            return (
              <div key={p.id} onClick={() => setSelectedProp(p)} className="bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-100 hover:border-brand-200 transition-all cursor-pointer group relative overflow-hidden text-left">
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-50 rounded-full -mr-12 -mt-12 opacity-0 group-hover:opacity-100 transition-all"></div>
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="flex flex-col min-w-0 pr-4">
                    <h4 className="font-black text-lg text-slate-900 truncate">{p.name}</h4>
                    <p className="text-xs text-slate-400 truncate font-medium">{p.address || 'Nessun indirizzo'}</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase shrink-0 ${
                    p.status === 'RENTED' ? 'bg-emerald-50 text-emerald-600' :
                    p.status === 'RENOVATION' ? 'bg-amber-50 text-amber-600' :
                    p.status === 'EMPTY' ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    {p.status === 'RENTED' ? 'Affittato' :
                    p.status === 'RENOVATION' ? 'Cantiere' :
                    p.status === 'EMPTY' ? 'Sfitto' : 'Residenza'}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4 relative z-10">
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Valore Attuale</p>
                    <p className="text-sm font-black text-slate-800">€ {safeNum(p.currentValue).toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Costo Acq.</p>
                    <p className="text-sm font-black text-slate-600">€ {safeNum(p.purchasePrice).toLocaleString()}</p>
                  </div>
                </div>

                {/* Banner Avanzamento Mutuo Dettagliato */}
                {mStats && (
                  <div className="mb-6 relative z-10 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">Stato Mutuo</span>
                       <span className="text-[9px] font-black text-indigo-600">{mStats.percent.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white rounded-full overflow-hidden mb-2">
                       <div 
                         className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                         style={{ width: `${mStats.percent}%` }}
                       ></div>
                    </div>
                    <div className="flex justify-between text-[9px] font-bold text-indigo-900">
                        <div className="flex flex-col">
                            <span className="text-indigo-400 text-[8px] uppercase">Versato</span>
                            <span>€ {mStats.paid.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-indigo-400 text-[8px] uppercase">Residuo</span>
                            <span>€ {mStats.remaining.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-50 relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">{p.type === 'RESIDENTIAL' ? '🏠' : p.type === 'COMMERCIAL' ? '🏢' : '🌳'} {p.type}</span>
                  </div>
                  <button onClick={(e) => handleDeleteProperty(p.id, e)} className="text-slate-300 hover:text-rose-500 transition-colors p-2 lg:opacity-0 lg:group-hover:opacity-100">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Nuovo Immobile */}
      <dialog id="new_property_modal" className="modal p-0 rounded-[2.5rem] shadow-2xl border-none w-full max-w-lg bg-white overflow-hidden text-left">
        <div className="flex flex-col">
            <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                   <h3 className="text-xl font-black text-slate-800">Nuovo Immobile</h3>
                   <p className="text-xs text-slate-400 font-medium">Aggiungi una proprietà al portafoglio</p>
                </div>
                <button onClick={() => (document.getElementById('new_property_modal') as any).close()} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all">✕</button>
            </div>
            <div className="p-8 space-y-5">
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Nome Identificativo</label>
                    <input type="text" value={newPropData.name} onChange={e => setNewPropData({...newPropData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900" placeholder="Es. Loft Via Tortona" />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Indirizzo</label>
                    <input type="text" value={newPropData.address} onChange={e => setNewPropData({...newPropData, address: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500 text-slate-900" placeholder="Via/Piazza, Civico, Città" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Prezzo Acquisto</label>
                        <input type="number" value={newPropData.purchasePrice || ''} onChange={e => setNewPropData({...newPropData, purchasePrice: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm text-slate-900" placeholder="€" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Valore Stimato</label>
                        <input type="number" value={newPropData.currentValue || ''} onChange={e => setNewPropData({...newPropData, currentValue: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm text-slate-900" placeholder="€" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Tipo</label>
                        <select value={newPropData.type} onChange={e => setNewPropData({...newPropData, type: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-900">
                            <option value="RESIDENTIAL">Residenziale</option>
                            <option value="COMMERCIAL"> Commerciale</option>
                            <option value="LAND">Terreno</option>
                            <option value="GARAGE">Garage</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Stato Iniziale</label>
                        <select value={newPropData.status} onChange={e => setNewPropData({...newPropData, status: e.target.value as any})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-900">
                            <option value="MAIN_RESIDENCE">Abitazione</option>
                            <option value="RENTED">Affittato</option>
                            <option value="EMPTY">Sfitto</option>
                            <option value="RENOVATION">Cantiere</option>
                        </select>
                    </div>
                </div>
                <div className="pt-4">
                   <button onClick={() => { handleCreateProperty(); (document.getElementById('new_property_modal') as any).close(); }} className="w-full bg-brand-600 text-white py-4 rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-xl hover:bg-brand-700 active:scale-95 transition-all">Crea Immobile</button>
                </div>
            </div>
        </div>
      </dialog>
    </div>
  );
};
