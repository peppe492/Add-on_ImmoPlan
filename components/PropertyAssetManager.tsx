

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
const YEARS = Array.from({ length: 11 }, (_, i) => currentYear - 1 + i); // Anno scorso -> +10 anni

// Robust Safe Number Helper
const safeNum = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) || !isFinite(val) ? 0 : val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
    }
    return 0;
};

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

export const PropertyAssetManager: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [records, setRecords] = useState<RentalRecord[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedProp, setSelectedProp] = useState<Property | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('ANAGRAFICA');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [haEntities, setHaEntities] = useState<any[]>([]);
  
  // Stati per filtri Analisi
  const [analysisFilterType, setAnalysisFilterType] = useState<'DAY' | 'MONTH' | 'YEAR'>('YEAR');
  const [analysisDate, setAnalysisDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State per Nuova Spesa
  const [newCost, setNewCost] = useState<Partial<RecurringCost>>({
    category: 'OTHER', 
    frequency: 'MONTHLY', 
    amount: 0, 
    name: '',
    referenceMonth: new Date().getMonth(),
    referenceYear: new Date().getFullYear(),
    date: new Date().toISOString().split('T')[0]
  });

  // Form State per Nuovo Immobile (Lista)
  const [newPropData, setNewPropData] = useState<Partial<Property>>({
    name: '', 
    address: '', 
    type: 'RESIDENTIAL', 
    status: 'MAIN_RESIDENCE',
    purchasePrice: 0,
    currentValue: 0,
    notes: '',
    coordinates: { lat: 0, lng: 0 }
  });

  useEffect(() => {
    loadData();
    fetchHAEntities();
  }, []);

  const loadData = async () => {
    const [loadedProps, loadedRecords, loadedTenants] = await Promise.all([
        db.getProperties(),
        db.getRentalRecords(),
        db.getTenants()
    ]);
    // Deduplica proprietà per sicurezza
    const uniqueProps = Array.from(new Map((loadedProps || []).map(p => [p.id, p])).values());
    setProperties(uniqueProps);
    setRecords(loadedRecords || []);
    setTenants(loadedTenants || []);
    
    // Se c'era una proprietà selezionata, aggiornala
    if (selectedProp) {
        const updated = uniqueProps.find(p => p.id === selectedProp.id);
        if (updated) setSelectedProp(updated);
    }
  };

  const fetchHAEntities = async () => {
    try {
      const res = await fetch('api/ha/entities');
      const data = await res.json();
      if (Array.isArray(data)) setHaEntities(data.filter(e => e.entity_id.startsWith('sensor.')));
    } catch (e) {}
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
    setNewPropData({ 
        name: '', 
        address: '', 
        type: 'RESIDENTIAL', 
        status: 'MAIN_RESIDENCE',
        purchasePrice: 0,
        currentValue: 0,
        notes: '',
        coordinates: { lat: 0, lng: 0 }
    });
    loadData();
  };

  const handleUpdateProperty = async (updated: Property, showFeedback = false) => {
    await db.saveProperty(updated);
    setSelectedProp(updated);
    await loadData();
    if (showFeedback) alert("Modifiche salvate correttamente!");
  };
  
  const handleDeleteProperty = async (id: string, e?: React.MouseEvent) => {
      // Blocca propagazione evento per evitare apertura dettaglio
      if (e) {
          e.preventDefault();
          e.stopPropagation();
      }

      if (window.confirm("Sei sicuro di voler eliminare definitivamente questo immobile? L'operazione è irreversibile.")) {
          // 1. Aggiornamento Ottimistico UI: Rimuovi subito dalla lista visibile
          setProperties(prev => prev.filter(p => p.id !== id));
          if (selectedProp?.id === id) {
              setSelectedProp(null);
          }

          // 2. Operazione Database
          await db.deleteProperty(id);
          
          // 3. Ricarica dati sicura dal server/db
          await loadData(); 
      }
  };

  const updateLocalProperty = (updated: Property) => {
      setSelectedProp(updated);
  };

  const handleAddCost = async () => {
    if (!selectedProp || !newCost.amount || !newCost.name) return;
    const cost: RecurringCost = { ...newCost as RecurringCost, id: `COST-${Date.now()}` };
    const currentCosts = Array.isArray(selectedProp.recurringCosts) ? selectedProp.recurringCosts : [];
    const updatedProp = { 
        ...selectedProp, 
        recurringCosts: [...currentCosts, cost] 
    };
    await handleUpdateProperty(updatedProp);
    
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
      const currentCosts = Array.isArray(selectedProp.recurringCosts) ? selectedProp.recurringCosts : [];
      const updatedProp = {
          ...selectedProp,
          recurringCosts: currentCosts.filter(c => c.id !== costId)
      };
      await handleUpdateProperty(updatedProp);
  };

  // --- Document Handling ---
  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedProp) {
        const customName = window.prompt("Nome del documento:", file.name);
        if (customName !== null) { // User didn't cancel
            const att = await readFile(file);
            // Override name if provided
            if (customName) att.name = customName;
            
            const updatedDocs = [...(selectedProp.documents || []), att];
            updateLocalProperty({ ...selectedProp, documents: updatedDocs });
            // Note: Saving happens when the user clicks "Salva Modifiche Anagrafica" or we can auto-save.
            // Let's rely on the main "Salva" button for consistency with other fields in this tab.
        }
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteDocument = (index: number) => {
      if (selectedProp && selectedProp.documents) {
          if (window.confirm("Rimuovere questo documento?")) {
              const updatedDocs = [...selectedProp.documents];
              updatedDocs.splice(index, 1);
              updateLocalProperty({ ...selectedProp, documents: updatedDocs });
          }
      }
  };

  // KPI Globali
  const totalValue = properties.reduce((acc, p) => acc + safeNum(p.currentValue), 0);
  const totalCost = properties.reduce((acc, p) => acc + safeNum(p.purchasePrice), 0);
  const totalGain = totalValue - totalCost;

  const currentCosts = useMemo(() => 
      selectedProp && Array.isArray(selectedProp.recurringCosts) ? selectedProp.recurringCosts : [], 
  [selectedProp]);

  const filteredCosts = useMemo(() => {
      if (filterCategory === 'ALL') return currentCosts;
      return currentCosts.filter(c => c.category === filterCategory);
  }, [currentCosts, filterCategory]);

  // --- WIDGET CALCOLO CANONE ---
  const rentWidgetData = useMemo(() => {
    if (!selectedProp) return { totalExpenses: 0, suggestedRent: 0, netProfit: 0, estimatedTax: 0, marginPercent: 0, taxRate: 21 };
    
    // 1. Totale Spese Mensili (ricorrenti + mutuo + 1/12 annuali)
    let monthlyExpenses = 0;
    const costs = selectedProp.recurringCosts || [];
    
    // Somma costi espliciti
    costs.forEach(c => {
        if (c.frequency === 'MONTHLY') monthlyExpenses += safeNum(c.amount);
        else if (c.frequency === 'YEARLY') monthlyExpenses += safeNum(c.amount) / 12;
    });

    // Aggiungi mutuo dai financials se non presente come spesa esplicita
    const hasMortgageItem = costs.some(c => c.category === 'MORTGAGE');
    if (!hasMortgageItem && selectedProp.financials?.mortgageAmount && selectedProp.financials?.mortgageDuration) {
        monthlyExpenses += safeNum(selectedProp.financials.mortgageAmount) / (selectedProp.financials.mortgageDuration * 12);
    }

    const marginPercent = selectedProp.financials?.targetMargin || 0;
    const taxRate = selectedProp.financials?.defaultTaxRate || 21; // Default cedolare 21%

    // 2. Calcolo Canone Target
    // Formula: (Spese + ProfittoNetto) / (1 - TaxRate) = CanoneLordo
    // Dove ProfittoNetto = Spese * (MarginPercent / 100)
    
    const desiredNetIncome = monthlyExpenses * (1 + (marginPercent / 100)); // Quello che deve rimanere in tasca per coprire spese + margine
    
    // Canone Lordo necessario per ottenere desiredNetIncome dopo le tasse
    // Lordo - (Lordo * Tax) = Netto
    // Lordo * (1 - Tax) = Netto
    // Lordo = Netto / (1 - Tax)
    
    const suggestedRent = taxRate < 100 ? desiredNetIncome / (1 - (taxRate / 100)) : 0;
    const estimatedTax = suggestedRent * (taxRate / 100);
    const netProfit = suggestedRent - estimatedTax - monthlyExpenses;

    return { 
        totalExpenses: monthlyExpenses, 
        suggestedRent, 
        netProfit, 
        estimatedTax, 
        marginPercent,
        taxRate 
    };
  }, [selectedProp]);

  // --- Multi-line Trend Logic (PURA PROIEZIONE SCHEDA ECONOMICA) ---
  const lineData = useMemo(() => {
      if (!selectedProp) return [];

      const targetDate = new Date(analysisDate);
      const targetYear = targetDate.getFullYear();
      const targetMonth = targetDate.getMonth();
      const isYearView = analysisFilterType === 'YEAR';
      const iterations = isYearView ? 12 : new Date(targetYear, targetMonth + 1, 0).getDate();
      
      return Array.from({length: iterations}, (_, i) => {
          const label = isYearView 
              ? new Date(targetYear, i, 1).toLocaleString('it-IT', { month: 'short' })
              : (i + 1).toString();

          const datum: any = { name: label };
          CATEGORIES.forEach(cat => datum[cat.id] = 0);

          // 1. Calcola Proiezioni basate SOLAMENTE su recurringCosts e financials (Scheda Economica)
          const costs = Array.isArray(selectedProp.recurringCosts) ? selectedProp.recurringCosts : [];
          costs.forEach(c => {
              let applies = false;
              if (isYearView) {
                  // Vista Annuale: Mesi
                  if (c.frequency === 'MONTHLY') applies = true;
                  if (c.frequency === 'YEARLY' && c.referenceMonth === i) applies = true;
                  if (c.frequency === 'ONE_OFF') {
                      const d = new Date(c.date || '');
                      if (d.getFullYear() === targetYear && d.getMonth() === i) applies = true;
                  }
              } else {
                  // Vista Mensile: Giorni
                  if (c.frequency === 'MONTHLY') applies = true;
                  if (c.frequency === 'YEARLY' && c.referenceMonth === targetMonth) applies = true;
                  if (c.frequency === 'ONE_OFF') {
                      const d = new Date(c.date || '');
                      if (d.getFullYear() === targetYear && d.getMonth() === targetMonth && d.getDate() === (i + 1)) applies = true;
                  }
              }
              
              if (applies) {
                   const amount = safeNum(c.amount);
                   // Se visualizzo i giorni, spalmo il costo mensile o lo applico intero?
                   // Per un trend di "costo giornaliero", spalmare ha senso per i costi fissi.
                   // Per una view annuale, sommo.
                   const dailyAmount = amount / iterations; 
                   datum[c.category] += isYearView ? amount : dailyAmount;
              }
          });

          // Fallback speciale per Mutuo da Financials se non esiste nei costi ricorrenti
          const hasMortgageItem = costs.some(c => c.category === 'MORTGAGE');
          if (!hasMortgageItem && selectedProp.financials?.mortgageAmount) {
              const duration = safeNum(selectedProp.financials.mortgageDuration) || 20;
              const monthlyMortgage = (safeNum(selectedProp.financials.mortgageAmount) / (duration * 12));
              
              // Applica mutuo se siamo entro la durata
              const start = new Date(selectedProp.financials.mortgageStartDate || '');
              const end = new Date(start);
              end.setFullYear(start.getFullYear() + duration);
              
              const currentDate = isYearView 
                  ? new Date(targetYear, i, 1) 
                  : new Date(targetYear, targetMonth, i + 1);

              if (currentDate >= start && currentDate <= end) {
                  datum['MORTGAGE'] += isYearView ? monthlyMortgage : (monthlyMortgage / iterations);
              }
          }

          return datum;
      });
  }, [selectedProp, analysisFilterType, analysisDate]);
  
  // -- Pie Data & Averages --
  const { pieData, averageMonthly } = useMemo(() => {
      // Usa lineData per aggregare i totali del periodo selezionato
      const totals: any = {};
      CATEGORIES.forEach(c => totals[c.id] = 0);
      
      lineData.forEach((d: any) => {
          CATEGORIES.forEach(c => {
              totals[c.id] += safeNum(d[c.id]);
          });
      });
      
      const chartData = CATEGORIES.map(c => ({
          name: c.id,
          value: totals[c.id],
          label: c.label,
          color: c.stroke
      })).filter(d => d.value > 0);

      const totalPeriodCost = chartData.reduce((acc, curr) => acc + curr.value, 0);
      
      // Calcolo Media Mensile
      let avg = 0;
      if (analysisFilterType === 'YEAR') {
          avg = totalPeriodCost / 12;
      } else if (analysisFilterType === 'MONTH') {
          avg = totalPeriodCost; 
      } else {
          avg = totalPeriodCost; // Daily view total
      }

      return { pieData: chartData, averageMonthly: avg };
  }, [lineData, analysisFilterType]);

  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#8b5cf6', '#64748b'];

  // Helper calcolo mutuo lista
  const calculateMortgageProgress = (p: Property) => {
    const f = p.financials;
    if (!f || !f.mortgageStartDate || !f.mortgageDuration) return null;

    // Cerca se esiste una voce di spesa ricorrente di tipo MUTUO
    const mortgageCost = p.recurringCosts?.find(c => c.category === 'MORTGAGE');
    
    // Se non c'è la spesa mutuo registrata, non mostriamo il banner
    if (!mortgageCost) return null;

    // Calcoliamo il totale stimato basandoci sulla rata mensile
    const monthlyAmount = mortgageCost.frequency === 'MONTHLY' 
        ? safeNum(mortgageCost.amount) 
        : safeNum(mortgageCost.amount) / 12;

    const start = new Date(f.mortgageStartDate);
    const end = new Date(start);
    end.setFullYear(start.getFullYear() + f.mortgageDuration);
    
    const now = new Date();
    const totalMonths = f.mortgageDuration * 12;
    const monthsPassed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    
    // Calcolo semplice lineare temporale
    const progress = Math.min(100, Math.max(0, (monthsPassed / totalMonths) * 100));
    
    // Stima del pagato e residuo basata sul tempo e sulla rata
    const totalEstimatedCapital = monthlyAmount * totalMonths;
    const paid = monthlyAmount * Math.max(0, monthsPassed);
    const remaining = Math.max(0, totalEstimatedCapital - paid);

    return { 
        progress, 
        paid, 
        remaining, 
        endLabel: end.toLocaleDateString('it-IT', {month: 'long', year: 'numeric'}) 
    };
  };

  // Helper spese mensili lista
  const calculateMonthlyExpenses = (p: Property) => {
      let monthly = 0;
      if (p.recurringCosts) {
          monthly += p.recurringCosts.filter(c => c.frequency === 'MONTHLY').reduce((acc, c) => acc + safeNum(c.amount), 0);
      }
      return monthly;
  };


  // Render VISTA DETTAGLIO
  if (selectedProp) {
      return (
          <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-4 mb-2">
                  <button onClick={() => setSelectedProp(null)} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm font-bold">
                      ← Indietro
                  </button>
                  <h2 className="text-2xl font-bold text-slate-800">Gestione: {selectedProp.name}</h2>
                  <div className="ml-auto bg-slate-100 p-1 rounded-xl flex gap-1">
                      {(['ANAGRAFICA', 'ECONOMICA', 'ANALISI'] as const).map(tab => (
                          <button 
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              {tab.charAt(0) + tab.slice(1).toLowerCase()}
                          </button>
                      ))}
                  </div>
              </div>

              {activeTab === 'ANAGRAFICA' && (
                  <div className="bg-white p-8 rounded-[2rem] shadow-soft border border-slate-100">
                      <div className="space-y-6 max-w-4xl mx-auto">
                           <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dati Identificativi</label>
                              <div className="space-y-4 mt-2">
                                  <input type="text" value={selectedProp.name} onChange={e => updateLocalProperty({...selectedProp, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Nome Immobile" />
                                  <input type="text" value={selectedProp.address} onChange={e => updateLocalProperty({...selectedProp, address: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Indirizzo Completo" />
                                  <div className="grid grid-cols-2 gap-4">
                                      <select value={selectedProp.type} onChange={e => updateLocalProperty({...selectedProp, type: e.target.value as any})} className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm">
                                          <option value="RESIDENTIAL">Residenziale</option>
                                          <option value="COMMERCIAL">Commerciale</option>
                                          <option value="LAND">Terreno</option>
                                          <option value="GARAGE">Garage</option>
                                      </select>
                                      {/* Sezione Stato e Inquilino */}
                                      <div className="grid grid-cols-2 gap-2">
                                         <select value={selectedProp.status} onChange={e => updateLocalProperty({...selectedProp, status: e.target.value as any})} className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm">
                                             <option value="MAIN_RESIDENCE">Abitazione Principale</option>
                                             <option value="RENTED">Affittato</option>
                                             <option value="EMPTY">Sfitto</option>
                                             <option value="RENOVATION">Ristrutturazione</option>
                                         </select>
                                         <select 
                                            value={selectedProp.currentTenantId || ''} 
                                            onChange={e => updateLocalProperty({...selectedProp, currentTenantId: e.target.value || undefined})} 
                                            className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm"
                                         >
                                             <option value="">Nessun Inquilino</option>
                                             {tenants.map(t => (
                                                 <option key={t.id} value={t.id}>{t.name}</option>
                                             ))}
                                         </select>
                                      </div>
                                  </div>
                              </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-50">
                               <div>
                                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valutazione</label>
                                   <div className="space-y-4 mt-2">
                                       <div>
                                           <span className="text-xs font-bold text-slate-500 block mb-1">Prezzo Acquisto</span>
                                           <input type="number" value={selectedProp.purchasePrice} onChange={e => updateLocalProperty({...selectedProp, purchasePrice: parseFloat(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" />
                                       </div>
                                       <div>
                                           <span className="text-xs font-bold text-slate-500 block mb-1">Valore Attuale</span>
                                           <input type="number" value={selectedProp.currentValue} onChange={e => updateLocalProperty({...selectedProp, currentValue: parseFloat(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" />
                                       </div>
                                       <div>
                                           <span className="text-xs font-bold text-slate-500 block mb-1">Data Acquisto</span>
                                           <input type="date" value={selectedProp.purchaseDate} onChange={e => updateLocalProperty({...selectedProp, purchaseDate: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" />
                                       </div>
                                   </div>
                               </div>
                               <div>
                                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Geolocalizzazione</label>
                                   <div className="space-y-4 mt-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                       <div className="grid grid-cols-2 gap-2">
                                           <input type="number" placeholder="Lat" value={selectedProp.coordinates?.lat} onChange={e => updateLocalProperty({...selectedProp, coordinates: {...selectedProp.coordinates!, lat: parseFloat(e.target.value)}})} className="p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                                           <input type="number" placeholder="Lng" value={selectedProp.coordinates?.lng} onChange={e => updateLocalProperty({...selectedProp, coordinates: {...selectedProp.coordinates!, lng: parseFloat(e.target.value)}})} className="p-2 bg-white border border-slate-200 rounded-lg text-xs" />
                                       </div>
                                       <div className="h-32 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-xs">
                                           Mappa Anteprima
                                       </div>
                                   </div>
                               </div>
                           </div>

                           {/* SEZIONE DOCUMENTI */}
                           <div className="pt-6 border-t border-slate-50">
                               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documenti & Allegati</label>
                               <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                   {/* Lista Documenti Esistenti */}
                                   {(selectedProp.documents || []).map((doc, idx) => (
                                       <div key={idx} className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center justify-between group hover:border-brand-200 transition-all">
                                           <div className="flex items-center gap-3 overflow-hidden">
                                               <span className="text-xl shrink-0">{doc.type.includes('image') ? '🖼️' : '📄'}</span>
                                               <div className="min-w-0">
                                                   <p className="text-xs font-bold text-slate-800 truncate">{doc.name}</p>
                                                   <p className="text-[9px] text-slate-400 uppercase">Allegato</p>
                                               </div>
                                           </div>
                                           <div className="flex gap-2 shrink-0">
                                               <a 
                                                 href={doc.data} 
                                                 download={doc.name} 
                                                 className="p-1.5 bg-white text-brand-600 rounded-lg border border-slate-200 hover:bg-brand-50"
                                                 title="Scarica"
                                               >
                                                   ⬇️
                                               </a>
                                               <button 
                                                 onClick={() => handleDeleteDocument(idx)}
                                                 className="p-1.5 bg-white text-rose-500 rounded-lg border border-slate-200 hover:bg-rose-50"
                                                 title="Elimina"
                                               >
                                                   🗑️
                                               </button>
                                           </div>
                                       </div>
                                   ))}

                                   {/* Upload Button */}
                                   <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 hover:border-brand-300 transition-all cursor-pointer h-full min-h-[80px]">
                                       <input 
                                         type="file" 
                                         ref={fileInputRef}
                                         onChange={handleUploadDocument}
                                         accept="image/*,application/pdf"
                                         className="absolute inset-0 opacity-0 cursor-pointer"
                                       />
                                       <span className="text-xl mb-1">📎</span>
                                       <span className="text-[10px] font-bold text-slate-500 uppercase">Carica Documento</span>
                                   </div>
                               </div>
                           </div>

                           <div className="flex justify-end pt-4">
                              <button onClick={() => handleUpdateProperty(selectedProp, true)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-brand-600 transition-colors shadow-lg active:scale-95">
                                  Salva Modifiche Anagrafica
                              </button>
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'ECONOMICA' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      {/* COLONNA SINISTRA: Form e Impostazioni */}
                      <div className="lg:col-span-7 space-y-6">
                           {/* WIDGET CALCOLO CANONE AFFITTO (NUOVO) */}
                           <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-slate-700">
                               <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full blur-[60px] opacity-20 -mr-10 -mt-10 pointer-events-none"></div>
                               <div className="flex justify-between items-start mb-6 relative z-10">
                                   <div>
                                       <h3 className="font-bold text-lg flex items-center gap-2">
                                           <span>⚖️</span> Calcolatore Canone
                                       </h3>
                                       <p className="text-slate-400 text-xs">Simulazione Break-even point & Profitto</p>
                                   </div>
                                   <div className="text-right">
                                       <p className="text-[10px] font-bold text-slate-400 uppercase">Suggerito (Lordo)</p>
                                       <p className="text-3xl font-black text-emerald-400">€ {rentWidgetData.suggestedRent.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                                   </div>
                               </div>

                               <div className="space-y-4 relative z-10">
                                   {/* Slider Margine */}
                                   <div>
                                       <div className="flex justify-between items-end mb-2">
                                           <label className="text-[10px] font-bold text-slate-400 uppercase">Margine Profitto (sul Netto Spese)</label>
                                           <span className="text-xl font-bold">{rentWidgetData.marginPercent}%</span>
                                       </div>
                                       <input 
                                         type="range" 
                                         min="0" 
                                         max="100" 
                                         step="1"
                                         value={rentWidgetData.marginPercent}
                                         onChange={(e) => updateLocalProperty({...selectedProp, financials: {...selectedProp.financials!, targetMargin: parseInt(e.target.value)}})}
                                         className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                       />
                                       <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-bold">
                                           <span>0% (Break-even)</span>
                                           <span>50%</span>
                                           <span>100%</span>
                                       </div>
                                   </div>

                                   {/* Breakdown Visivo */}
                                   <div className="grid grid-cols-3 gap-2 text-center pt-2">
                                       <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                           <p className="text-[9px] font-bold text-rose-300 uppercase mb-1">Spese</p>
                                           <p className="text-sm font-bold">€ {rentWidgetData.totalExpenses.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                                       </div>
                                       <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                           <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Tasse ({rentWidgetData.taxRate}%)</p>
                                           <p className="text-sm font-bold">€ {rentWidgetData.estimatedTax.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                                       </div>
                                       <div className="bg-emerald-500/20 p-3 rounded-xl border border-emerald-500/30">
                                           <p className="text-[9px] font-bold text-emerald-400 uppercase mb-1">Profitto Netto</p>
                                           <p className="text-sm font-bold">€ {rentWidgetData.netProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                                       </div>
                                   </div>
                                   
                                   <div className="flex justify-end">
                                      <button onClick={() => handleUpdateProperty(selectedProp, true)} className="text-[10px] font-bold text-slate-400 hover:text-white underline decoration-dashed">
                                          Salva preferenza margine
                                      </button>
                                   </div>
                               </div>
                           </div>

                           {/* Impostazioni Fiscali & Mutuo */}
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                               <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100">
                                   <h3 className="font-bold text-slate-800 mb-4 text-sm">Impostazioni Fiscali</h3>
                                   <div className="relative">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-2 block">Aliquota (Cedolare/IRPEF)</label>
                                      <div className="flex items-center">
                                          <input type="number" value={selectedProp.financials?.defaultTaxRate} onChange={e => updateLocalProperty({...selectedProp, financials: {...selectedProp.financials!, defaultTaxRate: parseFloat(e.target.value)}})} className="w-full bg-slate-50 border-0 rounded-xl px-4 py-3 font-bold text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500" />
                                          <span className="absolute right-4 font-bold text-slate-400 text-xs">%</span>
                                      </div>
                                   </div>
                               </div>
                               
                               <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100">
                                   <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm"><span>🏦</span> Parametri Temporali Mutuo</h3>
                                   
                                   <div className="grid grid-cols-2 gap-3">
                                      <div>
                                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Durata (Anni)</label>
                                          <input type="number" value={selectedProp.financials?.mortgageDuration} onChange={e => updateLocalProperty({...selectedProp, financials: {...selectedProp.financials!, mortgageDuration: parseFloat(e.target.value)}})} className="w-full bg-slate-50 border-0 rounded-xl px-3 py-2 font-bold text-xs ring-1 ring-slate-200" />
                                      </div>
                                      <div>
                                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Data Inizio</label>
                                          <input type="date" value={selectedProp.financials?.mortgageStartDate} onChange={e => updateLocalProperty({...selectedProp, financials: {...selectedProp.financials!, mortgageStartDate: e.target.value}})} className="w-full bg-slate-50 border-0 rounded-xl px-3 py-2 font-bold text-xs ring-1 ring-slate-200" />
                                      </div>
                                   </div>
                                   <p className="text-[9px] text-slate-400 mt-2 leading-tight">
                                      Per abilitare il banner di avanzamento, aggiungi una voce di spesa "MUTUO" qui sotto.
                                   </p>
                               </div>
                           </div>

                           {/* Nuova Voce di Spesa */}
                           <div className="bg-white p-6 rounded-[2.5rem] shadow-soft border border-brand-100 relative overflow-hidden">
                               <div className="absolute top-0 right-0 w-24 h-24 bg-brand-50 rounded-full -mr-10 -mt-10 pointer-events-none"></div>
                               <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2 relative z-10">
                                  <span className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-xs">+</span>
                                  Nuova Voce di Spesa
                               </h3>

                               <div className="space-y-4 relative z-10">
                                   <div>
                                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-2 block">Categoria</label>
                                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                          {CATEGORIES.map(cat => (
                                              <button 
                                                key={cat.id} 
                                                onClick={() => setNewCost({...newCost, category: cat.id as any})}
                                                className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${newCost.category === cat.id ? 'bg-brand-600 border-brand-600 text-white shadow-md scale-105' : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-brand-200 hover:bg-white'}`}
                                              >
                                                  <span className="text-xl mb-1">{cat.icon}</span>
                                                  <span className="text-[8px] font-bold uppercase truncate w-full text-center">{cat.label.split(' ')[0]}</span>
                                              </button>
                                          ))}
                                      </div>
                                   </div>

                                   <div className="bg-slate-100 p-1 rounded-xl flex">
                                       {['MONTHLY', 'YEARLY', 'ONE_OFF'].map((freq) => (
                                           <button
                                             key={freq}
                                             onClick={() => setNewCost({...newCost, frequency: freq as any})}
                                             className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${newCost.frequency === freq ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                           >
                                              {freq === 'MONTHLY' ? 'Mensile' : freq === 'YEARLY' ? 'Annuale' : 'Una Tantum'}
                                           </button>
                                       ))}
                                   </div>

                                   <div className="space-y-3">
                                       <div>
                                          <input type="text" placeholder="Descrizione (Es. Rata Mutuo)" value={newCost.name} onChange={e => setNewCost({...newCost, name: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                                       </div>
                                       
                                       <div className="grid grid-cols-2 gap-3">
                                          <div className="relative">
                                              <input type="number" placeholder="0" value={newCost.amount} onChange={e => setNewCost({...newCost, amount: parseFloat(e.target.value)})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                                              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">€</span>
                                          </div>
                                          <div className="flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 font-bold text-slate-500 text-xs relative">
                                              {newCost.frequency === 'ONE_OFF' && (
                                                  <input 
                                                    type="date" 
                                                    value={newCost.date} 
                                                    onChange={e => setNewCost({...newCost, date: e.target.value})}
                                                    className="w-full h-full bg-transparent outline-none text-center px-2"
                                                  />
                                              )}
                                              {newCost.frequency === 'MONTHLY' && (
                                                  <div className="flex w-full h-full">
                                                      <select 
                                                        value={newCost.referenceMonth} 
                                                        onChange={e => setNewCost({...newCost, referenceMonth: parseInt(e.target.value)})} 
                                                        className="bg-transparent outline-none text-center w-1/2 h-full border-r border-slate-200"
                                                        title="Mese Inizio"
                                                      >
                                                          {MONTHS.map((m, i) => <option key={i} value={i}>{m.substring(0,3)}</option>)}
                                                      </select>
                                                      <select 
                                                        value={newCost.referenceYear} 
                                                        onChange={e => setNewCost({...newCost, referenceYear: parseInt(e.target.value)})} 
                                                        className="bg-transparent outline-none text-center w-1/2 h-full"
                                                        title="Anno Inizio"
                                                      >
                                                          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                                      </select>
                                                  </div>
                                              )}
                                              {newCost.frequency === 'YEARLY' && (
                                                  <select 
                                                    value={newCost.referenceYear} 
                                                    onChange={e => setNewCost({...newCost, referenceYear: parseInt(e.target.value)})} 
                                                    className="bg-transparent outline-none text-center w-full h-full"
                                                    title="Anno di Riferimento"
                                                  >
                                                      {YEARS.map(y => <option key={y} value={y}>Anno {y}</option>)}
                                                  </select>
                                              )}
                                          </div>
                                       </div>

                                       <button onClick={handleAddCost} className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold uppercase text-xs shadow-lg hover:bg-brand-700 transition-all active:scale-95">
                                          + Aggiungi Spesa
                                       </button>
                                   </div>
                               </div>
                           </div>
                           
                           <button onClick={() => handleUpdateProperty(selectedProp, true)} className="w-full bg-slate-900 text-white px-8 py-3 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-slate-800 transition-colors shadow-lg">
                              Salva Modifiche
                           </button>
                      </div>

                      {/* COLONNA DESTRA: Lista Spese Esistenti */}
                      <div className="lg:col-span-5 space-y-4">
                           <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100 min-h-[400px] flex flex-col">
                                <div className="flex justify-between items-center mb-4">
                                   <h3 className="font-bold text-slate-800 text-sm">Spese Registrate</h3>
                                   <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-bold">{filteredCosts.length} voci</span>
                                </div>
                                
                                {/* Filtri Categoria Rapidi */}
                                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
                                    <button onClick={() => setFilterCategory('ALL')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all shrink-0 ${filterCategory === 'ALL' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 bg-white border border-slate-200 hover:bg-slate-50'}`}>Tutte</button>
                                    {CATEGORIES.map(c => (
                                        <button key={c.id} onClick={() => setFilterCategory(c.id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap border flex items-center gap-1 transition-all shrink-0 ${filterCategory === c.id ? `bg-white border-brand-300 text-brand-600 ring-1 ring-brand-100` : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}>{c.icon} {c.label.split(' ')[0]}</button>
                                    ))}
                                </div>

                                <div className="space-y-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-2 flex-1">
                                    {filteredCosts.length === 0 ? (
                                        <div className="text-center py-10 text-slate-400 text-xs italic">Nessuna spesa in questa categoria</div>
                                    ) : (
                                        filteredCosts.map(cost => {
                                            const cat = CATEGORIES.find(c => c.id === cost.category) || CATEGORIES[5];
                                            let timeLabel = '';
                                            if (cost.frequency === 'MONTHLY') {
                                                timeLabel = `Dal ${MONTHS[cost.referenceMonth || 0].substring(0,3)}/${cost.referenceYear || currentYear}`;
                                            } else if (cost.frequency === 'YEARLY') {
                                                timeLabel = `Anno ${cost.referenceYear || currentYear}`;
                                            } else {
                                                timeLabel = cost.date ? new Date(cost.date).toLocaleDateString('it-IT') : 'Data N/D';
                                            }

                                            return (
                                                <div key={cost.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-100 transition-all group">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${cat.color.replace('text', 'bg').replace('50', '100')} ${cat.color.split(' ')[1]}`}>{cat.icon}</div>
                                                        <div>
                                                            <p className="font-bold text-xs text-slate-800 line-clamp-1">{cost.name}</p>
                                                            <p className="text-[9px] text-slate-400 font-bold uppercase">{timeLabel}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right pl-2">
                                                        <p className="font-bold text-slate-800 text-sm">€ {safeNum(cost.amount).toLocaleString()}</p>
                                                        <button onClick={() => handleDeleteCost(cost.id!)} className="text-rose-400 opacity-0 group-hover:opacity-100 text-[10px] font-bold hover:text-rose-600 transition-all">Elimina</button>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                   <button onClick={() => handleUpdateProperty(selectedProp, true)} className="w-full bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-emerald-700 transition-colors shadow-lg">
                                      💾 Salva Dati Economici
                                   </button>
                                </div>
                           </div>
                      </div>
                  </div>
              )}

              {activeTab === 'ANALISI' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                       {/* Control Bar */}
                       <div className="lg:col-span-12 flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-[1.5rem] shadow-sm border border-slate-100 gap-4">
                           <h3 className="font-bold text-slate-800 pl-2">Periodo Analisi</h3>
                           <div className="flex items-center gap-3">
                               <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                                  <button onClick={() => setAnalysisFilterType('DAY')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${analysisFilterType === 'DAY' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400'}`}>Giorno</button>
                                  <button onClick={() => setAnalysisFilterType('MONTH')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${analysisFilterType === 'MONTH' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400'}`}>Mese</button>
                                  <button onClick={() => setAnalysisFilterType('YEAR')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${analysisFilterType === 'YEAR' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400'}`}>Anno</button>
                               </div>
                               {analysisFilterType === 'YEAR' ? (
                                   <select 
                                     value={new Date(analysisDate).getFullYear()} 
                                     onChange={(e) => setAnalysisDate(`${e.target.value}-01-01`)}
                                     className="bg-white border border-slate-200 py-2 px-3 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-brand-500"
                                   >
                                     {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                        <option key={y} value={y}>{y}</option>
                                     ))}
                                   </select>
                               ) : (
                                   <input 
                                     type={analysisFilterType === 'DAY' ? 'date' : 'month'} 
                                     value={analysisFilterType === 'DAY' ? analysisDate : analysisDate.substring(0, 7)} 
                                     onChange={(e) => setAnalysisDate(analysisFilterType === 'DAY' ? e.target.value : e.target.value + '-01')} 
                                     className="bg-white border border-slate-200 py-2 px-3 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-brand-500" 
                                   />
                               )}
                           </div>
                       </div>

                       {/* GRAFICO DONUT CHART + LEGENDA */}
                       <div className="lg:col-span-4 bg-white p-8 rounded-[2rem] shadow-soft border border-slate-100 h-[450px] flex flex-col">
                           <div className="mb-4">
                                <h3 className="font-bold text-slate-800">Ripartizione Costi</h3>
                                <p className="text-slate-400 text-xs font-medium mt-1">Budget allocato per categoria</p>
                           </div>
                           
                           <div className="flex-1 flex flex-col items-center justify-center relative">
                               <ResponsiveContainer width="100%" height={220}>
                                   <PieChart>
                                       <Pie
                                         data={pieData}
                                         cx="50%"
                                         cy="50%"
                                         innerRadius={65}
                                         outerRadius={85}
                                         paddingAngle={5}
                                         dataKey="value"
                                         stroke="none"
                                         cornerRadius={5}
                                       >
                                           {pieData.map((entry, index) => (
                                               <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                           ))}
                                       </Pie>
                                       <Tooltip />
                                   </PieChart>
                               </ResponsiveContainer>
                               {/* Testo Centrale */}
                               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-xl font-black text-slate-800">€ {averageMonthly.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">TOTALE</span>
                               </div>
                           </div>

                           {/* Legenda Custom */}
                           <div className="w-full space-y-2 mt-4 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                               {pieData.map((item, i) => (
                                  <div key={i} className="flex items-center justify-between group">
                                     <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                                        <span className="text-xs font-bold text-slate-600 truncate max-w-[120px]">{item.label}</span>
                                     </div>
                                     <span className="text-xs font-black text-slate-800">€ {item.value.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                  </div>
                               ))}
                               {pieData.length === 0 && (
                                  <div className="text-center text-slate-300 text-xs italic py-2">Nessun dato previsionale</div>
                               )}
                           </div>
                       </div>

                       <div className="lg:col-span-8 bg-white p-8 rounded-[2rem] shadow-soft border border-slate-100 h-[450px] flex flex-col">
                           <h3 className="font-bold text-slate-800 mb-6">Trend Spese {analysisFilterType === 'YEAR' ? 'Annuale' : analysisFilterType === 'MONTH' ? 'Mensile' : 'Giornaliero'}</h3>
                           <div className="flex-1 min-h-0">
                               <ResponsiveContainer width="100%" height="100%">
                                   <LineChart data={lineData}>
                                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10} />
                                       <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                                       <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 20px -5px rgba(0,0,0,0.1)'}} />
                                       <Legend iconType="circle" wrapperStyle={{fontSize: '10px', paddingTop: '10px'}} />
                                       
                                       {CATEGORIES.map((cat, idx) => (
                                           <Line 
                                             key={cat.id}
                                             type="monotone" 
                                             dataKey={cat.id} 
                                             name={cat.label}
                                             stroke={cat.stroke} 
                                             strokeWidth={2} 
                                             dot={{r: 0}} 
                                             activeDot={{r: 4}} 
                                           />
                                       ))}
                                   </LineChart>
                               </ResponsiveContainer>
                           </div>
                       </div>
                  </div>
              )}
          </div>
      );
  }

  // Render VISTA LISTA (Dashboard Patrimonio)
  return (
    <div className="space-y-8 animate-fade-in">
       {/* Global Stats Header (Dark) */}
       <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-slate-800">
           <div>
               <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">Valore Totale Portafoglio</p>
               <h2 className="text-4xl font-black tracking-tighter">€ {safeNum(totalValue).toLocaleString()}</h2>
           </div>
           <div>
               <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">Costo Acquisto Totale</p>
               <h2 className="text-2xl font-bold opacity-90">€ {safeNum(totalCost).toLocaleString()}</h2>
           </div>
           <div className="bg-white/10 px-6 py-4 rounded-2xl border border-white/5">
               <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">Plusvalenza Stimata</p>
               <h2 className={`text-2xl font-black ${totalGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                   {totalGain >= 0 ? '+' : ''}€ {safeNum(totalGain).toLocaleString()}
               </h2>
           </div>
       </div>
       <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           <div className="lg:col-span-4 bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100 h-fit">
               <h3 className="font-bold text-xl text-slate-800 mb-6">Nuovo Immobile</h3>
               
               <div className="space-y-6">
                   {/* Dati Identificativi */}
                   <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 space-y-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Dati Identificativi</label>
                        
                        <input type="text" value={newPropData.name} onChange={e => setNewPropData({...newPropData, name: e.target.value})} className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500" placeholder="Nome Immobile (es. Via Roma 10)" />
                        
                        <input type="text" value={newPropData.address} onChange={e => setNewPropData({...newPropData, address: e.target.value})} className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500" placeholder="Indirizzo Completo" />
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Tipologia</label>
                               <select value={newPropData.type} onChange={e => setNewPropData({...newPropData, type: e.target.value as any})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500">
                                   <option value="RESIDENTIAL">Residenziale</option>
                                   <option value="COMMERCIAL">Commerciale</option>
                                   <option value="LAND">Terreno</option>
                                   <option value="GARAGE">Garage</option>
                               </select>
                            </div>
                            <div>
                               <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Stato Occupazionale</label>
                               <select value={newPropData.status} onChange={e => setNewPropData({...newPropData, status: e.target.value as any})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500">
                                   <option value="MAIN_RESIDENCE">Abitazione Principale</option>
                                   <option value="RENTED">Affittato</option>
                                   <option value="EMPTY">Sfitto</option>
                                   <option value="RENOVATION">Ristrutturazione</option>
                               </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                            <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Latitudine</label>
                                <input type="number" value={newPropData.coordinates?.lat || 0} onChange={e => setNewPropData({...newPropData, coordinates: { ...newPropData.coordinates!, lat: parseFloat(e.target.value) }})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500" placeholder="0.0000" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Longitudine</label>
                                <input type="number" value={newPropData.coordinates?.lng || 0} onChange={e => setNewPropData({...newPropData, coordinates: { ...newPropData.coordinates!, lng: parseFloat(e.target.value) }})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500" placeholder="0.0000" />
                            </div>
                            <button className="p-3 bg-brand-50 text-brand-600 rounded-xl border border-brand-100 hover:bg-brand-100 transition-colors" title="Trova posizione">📍</button>
                        </div>
                   </div>

                   {/* Valori & Note */}
                   <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 space-y-4">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Valori & Note</label>
                       
                       <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Prezzo Acquisto</label>
                                <div className="relative">
                                   <input type="number" value={newPropData.purchasePrice || 0} onChange={e => setNewPropData({...newPropData, purchasePrice: parseFloat(e.target.value)})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500" placeholder="0" />
                                   <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">€</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Valore Attuale</label>
                                <div className="relative">
                                   <input type="number" value={newPropData.currentValue || 0} onChange={e => setNewPropData({...newPropData, currentValue: parseFloat(e.target.value)})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500" placeholder="0" />
                                   <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">€</span>
                                </div>
                            </div>
                       </div>

                       <textarea 
                           value={newPropData.notes || ''} 
                           onChange={e => setNewPropData({...newPropData, notes: e.target.value})} 
                           className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 min-h-[100px] resize-none" 
                           placeholder="Note aggiuntive..." 
                       />
                   </div>

                   <button onClick={handleCreateProperty} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-brand-600 transition-colors shadow-lg active:scale-95">
                       Crea Immobile
                   </button>
               </div>
           </div>
           
           {/* LISTA PORTAFOGLIO CARD */}
           <div className="lg:col-span-8 space-y-6">
               <div className="flex justify-between items-center px-2">
                   <h3 className="font-bold text-slate-800">Il tuo Portafoglio</h3>
                   <div className="flex gap-2">
                       <button className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-50">📥 Importa</button>
                       <button className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-50">📤 Esporta</button>
                   </div>
               </div>
               
               {properties.map(p => {
                   const gain = p.currentValue - p.purchasePrice;
                   const mortgageProgress = calculateMortgageProgress(p);
                   const monthlyExpenses = calculateMonthlyExpenses(p);

                   return (
                   <div 
                        key={p.id} 
                        className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100 hover:border-brand-200 hover:shadow-md transition-all group relative cursor-pointer"
                        onClick={() => setSelectedProp(p)}
                   >
                       <div className="flex justify-between items-start mb-6">
                           <div>
                               <div className="flex items-center gap-2 mb-1">
                                   <h4 className="font-bold text-xl text-slate-800 group-hover:text-brand-600 transition-colors">{p.name}</h4>
                                   <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${p.status === 'MAIN_RESIDENCE' ? 'bg-indigo-100 text-indigo-700' : p.status === 'RENTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                       {p.status === 'MAIN_RESIDENCE' ? 'Abitazione Principale' : p.status === 'RENTED' ? 'Affittato' : p.status === 'RENOVATION' ? 'Ristrutturazione' : 'Sfitto'}
                                   </span>
                               </div>
                               <p className="text-slate-500 text-sm mb-3">{p.address}</p>
                               
                               <div className="flex gap-2">
                                  {monthlyExpenses > 0 && (
                                      <span className="bg-rose-50 text-rose-600 border border-rose-100 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">
                                          Uscite: € {monthlyExpenses}/mese
                                      </span>
                                  )}
                                  {p.coordinates?.lat !== 0 && (
                                      <button 
                                        className="bg-slate-50 text-slate-600 border border-slate-100 px-2 py-1 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-100 flex items-center gap-1"
                                        onClick={(e) => { e.stopPropagation(); /* Map logic future */ }}
                                      >
                                          📍 Mappa
                                      </button>
                                  )}
                               </div>
                           </div>
                           <div className="text-right">
                               <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Valore Attuale</p>
                               <p className="text-2xl font-black text-slate-900 mb-1">€ {safeNum(p.currentValue).toLocaleString()}</p>
                               <p className={`text-xs font-bold ${gain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                   {gain >= 0 ? '▲' : '▼'} € {Math.abs(gain).toLocaleString()}
                               </p>
                           </div>
                       </div>
                       
                       {/* Sezione Mutuo Progress Bar (se presente) */}
                       {mortgageProgress && (
                           <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 mb-4">
                               <div className="flex justify-between items-end mb-2">
                                   <p className="text-[10px] font-bold text-indigo-400 uppercase">Stato Avanzamento Mutuo</p>
                               </div>
                               <div className="flex justify-between items-end mb-2">
                                   <p className="text-sm font-bold text-indigo-900">Fine prevista: {mortgageProgress.endLabel}</p>
                                   <p className="text-xs font-black text-indigo-600">{mortgageProgress.progress.toFixed(1)}%</p>
                               </div>
                               <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden mb-2">
                                   <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${mortgageProgress.progress}%` }}></div>
                               </div>
                               <div className="flex justify-between text-[9px] font-bold text-indigo-400 uppercase">
                                   <span>Versato: € {mortgageProgress.paid.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                   <span>Residuo: € {mortgageProgress.remaining.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                               </div>
                           </div>
                       )}

                       <div className="flex justify-end pt-2 relative z-10">
                           <button 
                             onClick={(e) => handleDeleteProperty(p.id, e)} 
                             className="text-rose-400 hover:text-rose-600 text-xs font-bold transition-colors"
                           >
                             Elimina
                           </button>
                       </div>
                   </div>
                   );
               })}
           </div>
       </div>
    </div>
  );
};
