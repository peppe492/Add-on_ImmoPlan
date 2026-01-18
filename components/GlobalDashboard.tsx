
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { db } from '../services/dbService';
import { Property, RentalRecord, Scenario } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

// Categorie e Colori coerenti con PropertyAssetManager
const CATEGORIES_CONFIG = [
  { id: 'MORTGAGE', label: 'Mutuo', color: '#4f46e5' }, // Indigo
  { id: 'TAX', label: 'Tasse', color: '#64748b' },      // Slate
  { id: 'MAINTENANCE', label: 'Manutenzione', color: '#d97706' }, // Amber
  { id: 'UTILITY', label: 'Utenze', color: '#eab308' }, // Yellow
  { id: 'INTERNET', label: 'Internet', color: '#06b6d4' }, // Cyan
  { id: 'INSURANCE', label: 'Assicurazione', color: '#10b981' }, // Emerald
  { id: 'OTHER', label: 'Altro', color: '#94a3b8' },    // Gray
];

// Helper per sicurezza numerica
const safeNum = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) || !isFinite(val) ? 0 : val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
    }
    return 0;
};

export const GlobalDashboard: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [records, setRecords] = useState<RentalRecord[]>([]);
  const [, setScenarios] = useState<Scenario[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('ALL');
  
  // Default impostato a '6MONTHS' come richiesto
  const [filterType, setFilterType] = useState<'DAY' | 'MONTH' | 'YEAR' | '6MONTHS'>('6MONTHS');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await db.init();
        const [props, recs, scens] = await Promise.all([
          db.getProperties(),
          db.getRentalRecords(),
          db.getScenarios()
        ]);
        setProperties(props || []);
        setRecords(recs || []);
        setScenarios(scens || []);
      } catch (e) {
        console.error("Errore caricamento dashboard:", e);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([41.9028, 12.4964], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(mapRef.current);
    }

    mapRef.current.eachLayer((layer: any) => {
        if (!layer._url) mapRef.current.removeLayer(layer);
    });

    const markers: any[] = [];
    const propsToMap = selectedPropertyId === 'ALL' ? properties : properties.filter(p => p.id === selectedPropertyId);

    propsToMap.forEach(p => {
        if (p.coordinates && p.coordinates.lat !== 0 && p.coordinates.lng !== 0) {
            const marker = L.marker([p.coordinates.lat, p.coordinates.lng])
                .addTo(mapRef.current)
                .bindPopup(`<b>${p.name}</b><br/>€ ${safeNum(p.currentValue).toLocaleString()}`);
            markers.push(marker);
        }
    });

    if (markers.length > 0) {
        const group = new L.FeatureGroup(markers);
        mapRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  }, [properties, selectedPropertyId]);

  // Calcolo anni disponibili
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    let maxYear = new Date().getFullYear(); 

    properties.forEach(p => {
        if (p.purchaseDate) years.add(new Date(p.purchaseDate).getFullYear());
        if (p.recurringCosts) {
            p.recurringCosts.forEach(cost => {
                if (cost.referenceYear && cost.referenceYear > maxYear) maxYear = cost.referenceYear;
                if (cost.date) {
                    const dYear = new Date(cost.date).getFullYear();
                    if (dYear > maxYear) maxYear = dYear;
                }
            });
        }
    });

    records.forEach(r => {
        const rYear = r.year || new Date(r.transactionDate).getFullYear();
        years.add(rYear);
        if (rYear > maxYear) maxYear = rYear;
    });

    for (let y = 2021; y <= maxYear; y++) years.add(y);
    return Array.from(years).sort((a, b) => b - a);
  }, [records, properties]);

  const filteredProperties = useMemo(() => {
    if (selectedPropertyId === 'ALL') return properties;
    return properties.filter(p => p.id === selectedPropertyId);
  }, [properties, selectedPropertyId]);

  // Helper per calcolare le spese da Scheda Economica per un dato range temporale
  const calculateProjectedExpenses = (props: Property[], startDate: Date, endDate: Date) => {
    let total = 0;
    const categoryTotals: Record<string, number> = {};
    
    // Inizializza tutte le categorie a 0 per sicurezza
    CATEGORIES_CONFIG.forEach(c => categoryTotals[c.id] = 0);

    props.forEach(p => {
        // Fallback Mutuo da Financials (se non presente nei costi ricorrenti)
        const hasMortgageCost = p.recurringCosts?.some(c => c.category === 'MORTGAGE');
        if (!hasMortgageCost && p.financials?.mortgageAmount && p.financials.mortgageDuration) {
            const monthlyMortgage = p.financials.mortgageAmount / (p.financials.mortgageDuration * 12);
            // Itera sui mesi del range
            let cursor = new Date(startDate);
            // Normalizza cursore al primo del mese per evitare salti di giorni
            cursor.setDate(1);

            while (cursor <= endDate) {
                 const mStart = new Date(p.financials.mortgageStartDate || '');
                 const mEnd = new Date(mStart);
                 mEnd.setFullYear(mStart.getFullYear() + p.financials.mortgageDuration);
                 
                 // Controlla se il cursore cade nel periodo del mutuo
                 const cursorEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

                 if (cursorEnd >= mStart && cursor <= mEnd) {
                     total += monthlyMortgage;
                     categoryTotals['MORTGAGE'] += monthlyMortgage;
                 }
                 cursor.setMonth(cursor.getMonth() + 1);
            }
        }

        const costs = p.recurringCosts || [];
        costs.forEach(cost => {
            const amount = safeNum(cost.amount);
            if (amount <= 0) return;

            // Determina ID categoria valido (fallback a OTHER se non trovato)
            const catId = CATEGORIES_CONFIG.some(c => c.id === cost.category) ? cost.category : 'OTHER';
            
            if (cost.frequency === 'MONTHLY') {
                // Aggiungi per ogni mese nel range
                let cursor = new Date(startDate);
                cursor.setDate(1); 
                
                // Se referenceYear non c'è, assumiamo sia attivo da sempre (es. 1900)
                const costStart = new Date(cost.referenceYear || 1900, cost.referenceMonth || 0, 1);
                
                while (cursor <= endDate) {
                    const cursorEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
                    if (cursorEnd >= costStart) {
                        total += amount;
                        categoryTotals[catId] += amount;
                    }
                    cursor.setMonth(cursor.getMonth() + 1);
                }
            } else if (cost.frequency === 'YEARLY') {
                 // Aggiungi se il mese di riferimento cade nel range per quell'anno
                 let cursor = new Date(startDate);
                 cursor.setDate(1);

                 while (cursor <= endDate) {
                     const checkMonth = cost.referenceMonth || 0;
                     const startYear = cost.referenceYear || 1900;
                     
                     if (cursor.getMonth() === checkMonth && cursor.getFullYear() >= startYear) {
                         total += amount;
                         categoryTotals[catId] += amount;
                     }
                     cursor.setMonth(cursor.getMonth() + 1);
                 }
            } else if (cost.frequency === 'ONE_OFF' && cost.date) {
                 const costDate = new Date(cost.date);
                 if (costDate >= startDate && costDate <= endDate) {
                     total += amount;
                     categoryTotals[catId] += amount;
                 }
            }
        });
    });

    return { total, categoryTotals };
  };

  // --- STATS PRINCIPALI ---
  const stats = useMemo(() => {
    const targetDate = new Date(selectedDate);
    
    // Asset Value (Calcolato sempre sul totale attuale)
    const totalAssets = filteredProperties.reduce((acc, p) => acc + safeNum(p.currentValue), 0);
    const purchaseCost = filteredProperties.reduce((acc, p) => acc + safeNum(p.purchasePrice), 0);
    
    // --- GESTIONE SPECIFICA PER "CASFLOW GIORNALIERO" (Media Annuale) ---
    if (filterType === 'DAY') {
        const year = targetDate.getFullYear();
        // Calcola giorni nell'anno (bisestile check)
        const daysInYear = ((year % 4 === 0 && year % 100 > 0) || year % 400 === 0) ? 366 : 365;
        
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31);

        // 1. Totale Entrate Annuali (Reali da Records)
        const annualRecords = records.filter(r => {
            if (selectedPropertyId !== 'ALL' && r.propertyId !== selectedPropertyId) return false;
            const rDate = new Date(r.transactionDate);
            return rDate >= startOfYear && rDate <= endOfYear;
        });
        const annualIncome = annualRecords.reduce((acc, r) => acc + safeNum(r.income), 0);

        // 2. Totale Uscite Annuali (Proiettate da Scheda Economica)
        const { total: annualExpenses } = calculateProjectedExpenses(filteredProperties, startOfYear, endOfYear);

        // 3. Calcolo Medie Giornaliere
        const dailyIncome = annualIncome / daysInYear;
        const dailyExpenses = annualExpenses / daysInYear;
        const dailyCashflow = (annualIncome - annualExpenses) / daysInYear;

        return {
            totalAssets,
            portfolioGrowth: totalAssets - purchaseCost,
            periodIncome: dailyIncome,
            periodExpenses: dailyExpenses,
            periodCashflow: dailyCashflow
        };
    }

    // --- GESTIONE PERIODI STANDARD (Mese, Anno, 6 Mesi) ---
    let startDate = new Date(selectedDate);
    let endDate = new Date(selectedDate);

    if (filterType === 'YEAR') {
        startDate = new Date(targetDate.getFullYear(), 0, 1);
        endDate = new Date(targetDate.getFullYear(), 11, 31);
    } else if (filterType === 'MONTH') {
        startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    } else if (filterType === '6MONTHS') {
        // Ultimi 6 mesi (incluso corrente)
        endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
        startDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 5, 1);
    }

    // 1. Calcolo Entrate Reali (da Records) nel periodo
    const activeRecords = records.filter(r => {
        if (selectedPropertyId !== 'ALL' && r.propertyId !== selectedPropertyId) return false;
        const rDate = new Date(r.transactionDate);
        return rDate >= startDate && rDate <= endDate;
    });
    const periodIncome = activeRecords.reduce((acc, r) => acc + safeNum(r.income), 0);

    // 2. Calcolo Uscite Previsionali (da Scheda Economica) nel periodo
    const { total: periodExpenses } = calculateProjectedExpenses(filteredProperties, startDate, endDate);

    return { 
        totalAssets, 
        portfolioGrowth: totalAssets - purchaseCost, 
        periodIncome, 
        periodExpenses, 
        periodCashflow: periodIncome - periodExpenses 
    };
  }, [filteredProperties, records, filterType, selectedDate, selectedPropertyId]);

  // --- LOGICA TREND DINAMICO ---
  const financialTrend = useMemo(() => {
    const res = [];
    const targetDate = new Date(selectedDate);
    
    // Configurazione Iterazioni
    let iterations = 0;
    let getLabel = (i: number) => "";
    let getDateRange = (i: number) => ({ start: new Date(), end: new Date() });

    if (filterType === 'YEAR') {
        iterations = 12;
        getLabel = (i) => new Date(targetDate.getFullYear(), i, 1).toLocaleString('it-IT', { month: 'short' });
        getDateRange = (i) => ({ 
            start: new Date(targetDate.getFullYear(), i, 1), 
            end: new Date(targetDate.getFullYear(), i + 1, 0) 
        });
    } else if (filterType === '6MONTHS') {
        iterations = 6;
        getLabel = (i) => {
            const d = new Date(targetDate);
            d.setMonth(d.getMonth() - (5 - i));
            return d.toLocaleString('it-IT', { month: 'short', year: '2-digit' });
        };
        getDateRange = (i) => {
            const d = new Date(targetDate);
            d.setMonth(d.getMonth() - (5 - i));
            return { 
                start: new Date(d.getFullYear(), d.getMonth(), 1), 
                end: new Date(d.getFullYear(), d.getMonth() + 1, 0) 
            };
        };
    } else {
        // MONTH o DAY - Mostra andamento giornaliero del mese selezionato
        const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
        iterations = daysInMonth;
        getLabel = (i) => (i + 1).toString();
        getDateRange = (i) => {
            const d = new Date(targetDate.getFullYear(), targetDate.getMonth(), i + 1);
            return { start: d, end: d };
        };
    }

    for (let i = 0; i < iterations; i++) {
        const { start, end } = getDateRange(i);
        const datum: any = { name: getLabel(i) };
        CATEGORIES_CONFIG.forEach(cat => datum[cat.id] = 0);
        
        // 1. Entrate (Records) nel bucket
        const bucketRecords = records.filter(r => {
             if (selectedPropertyId !== 'ALL' && r.propertyId !== selectedPropertyId) return false;
             const rd = new Date(r.transactionDate);
             return rd >= start && rd <= end;
        });
        datum['INCOME'] = bucketRecords.reduce((acc, r) => acc + safeNum(r.income), 0);

        // 2. Uscite (Scheda Economica) nel bucket
        const { total: bucketExpenses, categoryTotals } = calculateProjectedExpenses(filteredProperties, start, end);
        datum['TOTAL_EXPENSES'] = bucketExpenses;

        // Popola categorie
        Object.keys(categoryTotals).forEach(k => {
            datum[k] = categoryTotals[k];
        });

        res.push(datum);
    }
    return res;
  }, [records, filteredProperties, filterType, selectedDate, selectedPropertyId]);

  const chartTitle = useMemo(() => {
      if (filterType === 'YEAR') return new Date(selectedDate).getFullYear();
      if (filterType === '6MONTHS') return "Ultimi 6 Mesi";
      return `${new Date(selectedDate).toLocaleString('it-IT', { month: 'long', year: 'numeric' })}`;
  }, [filterType, selectedDate]);

  const pieChartData = useMemo(() => {
      const totals: any = {};
      CATEGORIES_CONFIG.forEach(c => totals[c.id] = 0);

      // Aggrega i totali dal financialTrend calcolato (che già usa la logica Scheda Economica)
      financialTrend.forEach((pt: any) => {
          CATEGORIES_CONFIG.forEach(cat => {
              totals[cat.id] += pt[cat.id];
          });
      });

      return CATEGORIES_CONFIG.map(cat => ({
          name: cat.label,
          value: totals[cat.id],
          color: cat.color
      })).filter(d => d.value > 0);
  }, [financialTrend]);

  // Calcolo Totale Periodo per Donut Center
  const totalPeriodExpenses = useMemo(() => {
      return pieChartData.reduce((acc, curr) => acc + curr.value, 0);
  }, [pieChartData]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 mb-8">
        <div>
           <h2 className="text-3xl font-bold text-brand-900 tracking-tight">
             {selectedPropertyId === 'ALL' ? 'Portafoglio Globale' : properties.find(p => p.id === selectedPropertyId)?.name}
           </h2>
        </div>
        <div className="flex flex-col md:flex-row items-end md:items-center gap-3 w-full md:w-auto">
           <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
              <button onClick={() => setFilterType('DAY')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'DAY' ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`}>Giorno</button>
              <button onClick={() => setFilterType('MONTH')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'MONTH' ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`}>Mese</button>
              <button onClick={() => setFilterType('6MONTHS')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === '6MONTHS' ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`}>6 Mesi</button>
              <button onClick={() => setFilterType('YEAR')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'YEAR' ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`}>Anno</button>
           </div>
           
           {/* Selettore Dinamico */}
           {filterType === 'YEAR' ? (
               <select 
                 value={new Date(selectedDate).getFullYear()} 
                 onChange={(e) => setSelectedDate(`${e.target.value}-01-01`)}
                 className="bg-white border border-slate-200 py-2.5 px-4 rounded-xl text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-brand-500"
               >
                 {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                 ))}
               </select>
           ) : (
               <input 
                 type={filterType === 'DAY' ? 'date' : 'month'} 
                 value={filterType === 'DAY' ? selectedDate : selectedDate.substring(0, 7)} 
                 onChange={(e) => setSelectedDate(filterType === 'DAY' ? e.target.value : e.target.value + '-01')} 
                 className="bg-white border border-slate-200 py-2 px-3 rounded-xl text-xs font-bold shadow-sm" 
               />
           )}

           <select value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} className="bg-white border border-slate-200 py-2.5 px-4 rounded-xl text-sm font-bold shadow-sm outline-none">
               <option value="ALL">🏢 Tutto il Portafoglio</option>
               {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
           </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <div className="bg-brand-600 text-white p-6 rounded-[2rem] shadow-glow">
            <p className="text-brand-100 font-bold text-xs uppercase mb-2">Valore Asset</p>
            <h3 className="text-3xl font-black">€ {stats.totalAssets.toLocaleString()}</h3>
         </div>
         <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100">
            <p className="text-slate-400 font-bold text-xs uppercase mb-2">
               {filterType === 'DAY' ? 'Cashflow Giornaliero (Media Annua)' : 
                filterType === 'YEAR' ? 'Cashflow Annuo' : 
                filterType === '6MONTHS' ? 'Cashflow (Ultimi 6 Mesi)' : 
                'Cashflow Mensile'}
            </p>
            <h3 className={`text-3xl font-black ${stats.periodCashflow >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>€ {stats.periodCashflow.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 })}</h3>
            <div className="mt-2 flex items-center gap-2">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Netto Reale</span>
               {stats.periodIncome > 0 && (
                   <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${stats.periodCashflow >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                      {((stats.periodCashflow / stats.periodIncome) * 100).toFixed(1)}% Margin
                   </span>
               )}
            </div>
         </div>
         <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100">
            <p className="text-slate-400 font-bold text-xs uppercase mb-2">Uscite {filterType === 'DAY' ? '(Media/Giorno)' : '(Totale)'}</p>
            <h3 className="text-3xl font-black text-slate-800">€ {stats.periodExpenses.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 })}</h3>
         </div>
         <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100">
            <p className="text-slate-400 font-bold text-xs uppercase mb-2">Entrate {filterType === 'DAY' ? '(Media/Giorno)' : '(Totale)'}</p>
            <h3 className="text-3xl font-black text-slate-800">€ {stats.periodIncome.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 })}</h3>
         </div>
      </div>

      <div className="bg-white p-2 rounded-[2.5rem] shadow-soft border border-slate-100">
         <div className="h-[400px] w-full rounded-[2rem] overflow-hidden" ref={mapContainerRef}></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100">
            <h3 className="font-bold text-xl mb-8">Trend Finanziario {chartTitle}</h3>
            <div className="h-[300px]">
               <ResponsiveContainer>
                  <LineChart data={financialTrend}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                     <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                     <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px' }}/>
                     
                     {/* Linea Entrate Reali */}
                     <Line type="monotone" dataKey="INCOME" name="Entrate (Reali)" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{r: 6}} />
                     
                     {/* Linea Uscite Scheda Economica */}
                     {filterType === '6MONTHS' ? (
                         <Line 
                           type="monotone" 
                           dataKey="TOTAL_EXPENSES" 
                           name="Uscite (Scheda Ec.)" 
                           stroke="#ef4444" 
                           strokeWidth={3} 
                           dot={false}
                           activeDot={{r: 6}}
                         />
                     ) : (
                         /* ALTRIMENTI: Mostra dettaglio categorie */
                         CATEGORIES_CONFIG.map(cat => (
                             <Line 
                               key={cat.id}
                               type="monotone" 
                               dataKey={cat.id} 
                               name={cat.label} 
                               stroke={cat.color} 
                               strokeWidth={2} 
                               dot={false}
                               activeDot={{r: 4}}
                             />
                         ))
                     )}
                  </LineChart>
               </ResponsiveContainer>
            </div>
         </div>
         
         {/* Donut Chart + Legenda */}
         <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100 flex flex-col">
            <div className="mb-6">
               <h3 className="font-bold text-xl text-slate-900">Ripartizione Spese Periodo</h3>
               <p className="text-slate-400 text-xs font-medium mt-1">Breakdown uscite per {chartTitle}</p>
            </div>
            
            <div className="flex flex-col xl:flex-row items-center gap-8 flex-1">
               <div className="relative w-[180px] h-[180px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                        <Pie 
                           data={pieChartData} 
                           innerRadius={65} 
                           outerRadius={85} 
                           paddingAngle={5} 
                           dataKey="value"
                           stroke="none"
                           cornerRadius={5}
                        >
                           {pieChartData.map((entry, i) => (
                              <Cell key={`cell-${i}`} fill={entry.color} />
                           ))}
                        </Pie>
                        <Tooltip />
                     </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-xl font-black text-slate-800">€ {totalPeriodExpenses.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                     <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">TOTALE</span>
                  </div>
               </div>
               
               <div className="flex-1 w-full space-y-3">
                  {pieChartData.map((item, i) => (
                     <div key={i} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                           <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                           <span className="text-xs font-bold text-slate-600">{item.name}</span>
                        </div>
                        <span className="text-xs font-black text-slate-800">€ {item.value.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                     </div>
                  ))}
                  {pieChartData.length === 0 && (
                     <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs italic opacity-60">
                        <span className="text-2xl mb-1">💸</span>
                        Nessuna spesa
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
