
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RentalRecord, Property, Tenant, Attachment } from '../types';
import { db } from '../services/dbService';

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

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

export const RentalManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'REGISTRY' | 'SIMULATION'>('REGISTRY');
  const [records, setRecords] = useState<RentalRecord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  
  // Stati Filtri Visualizzazione
  const [filterYear, setFilterYear] = useState<number | 'ALL'>('ALL');
  const [filterMonth, setFilterMonth] = useState<number | 'ALL'>('ALL');

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<RentalRecord>>({
      transactionDate: new Date().toISOString().split('T')[0],
      income: 0, mortgage: 0, condo: 0, utilities: 0, internet: 0, maintenance: 0, taxes: 0, other: 0, isTaxable: true, notes: '', tenantId: '', attachment: undefined
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Simulation State
  const [simData, setSimData] = useState({ rent: 800, expenses: 50, tax: 21 });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [r, p, t] = await Promise.all([db.getRentalRecords(), db.getProperties(), db.getTenants()]);
    setRecords((r || []).sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()));
    setProperties(p || []);
    setTenants(t || []);
  };

  const handlePropertySelect = (propId: string) => {
      const prop = properties.find(p => p.id === propId);
      let mortgageVal = 0;
      let defaultTenantId = '';

      if (prop) {
          const mortgageCost = prop.recurringCosts?.find(c => c.category === 'MORTGAGE');
          if (mortgageCost) mortgageVal = mortgageCost.frequency === 'MONTHLY' ? mortgageCost.amount : mortgageCost.amount / 12;
          else if (prop.financials?.mortgageAmount && prop.financials.mortgageDuration) mortgageVal = prop.financials.mortgageAmount / (prop.financials.mortgageDuration * 12);
          
          if (prop.currentTenantId) defaultTenantId = prop.currentTenantId;
      }
      setFormData(prev => ({ 
          ...prev, 
          propertyId: propId, 
          mortgage: parseFloat(mortgageVal.toFixed(2)),
          tenantId: defaultTenantId 
      }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const att = await readFile(file);
        setFormData(prev => ({ ...prev, attachment: att }));
      } catch (error) {
        alert("Errore nel caricamento del file");
      }
    }
  };

  const handleRemoveAttachment = () => {
    setFormData(prev => ({ ...prev, attachment: undefined }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveRecord = async () => {
      if (!formData.propertyId) return alert("Seleziona un immobile");
      const dateObj = new Date(formData.transactionDate || new Date());
      const newRecord: RentalRecord = {
          id: formData.id || `REC-${Date.now()}`,
          propertyId: formData.propertyId,
          transactionDate: formData.transactionDate!,
          month: dateObj.getMonth(),
          year: dateObj.getFullYear(),
          income: Number(formData.income) || 0,
          isTaxable: formData.isTaxable ?? true,
          mortgage: Number(formData.mortgage) || 0,
          condo: Number(formData.condo) || 0,
          utilities: Number(formData.utilities) || 0,
          internet: Number(formData.internet) || 0,
          maintenance: Number(formData.maintenance) || 0,
          taxes: Number(formData.taxes) || 0,
          other: Number(formData.other) || 0,
          notes: formData.notes || '',
          tenantId: formData.tenantId,
          attachment: formData.attachment
      };
      await db.saveRentalRecord(newRecord);
      setIsFormOpen(false);
      loadData();
  };

  const handleDeleteRecord = async (id: string) => {
      if(confirm("Eliminare questa registrazione?")) { 
          // Blocca il sync globale per evitare che il focus refresh annulli l'eliminazione
          db.blockSync(10000); 
          await db.deleteRentalRecord(id); 
          await loadData(); 
      }
  };

  // --- Logic for Filters ---
  const availableYears = useMemo(() => {
      const years = new Set(records.map(r => Number(r.year)));
      return Array.from(years).sort((a, b) => (b as number) - (a as number));
  }, [records]);

  const filteredRecords = useMemo(() => {
      return records.filter(r => {
          if (filterYear !== 'ALL' && r.year !== filterYear) return false;
          if (filterMonth !== 'ALL' && r.month !== filterMonth) return false;
          return true;
      });
  }, [records, filterYear, filterMonth]);

  // --- Logic for Simulator ---
  const netMonthly = (Number(simData.rent) || 0) - (Number(simData.expenses) || 0) - ((Number(simData.rent) || 0) * (Number(simData.tax) || 0) / 100);
  const annualNet = netMonthly * 12;

  return (
    <div className="space-y-6 animate-fade-in relative">
       <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-slate-900">Gestione Affitti</h2>
          <div className="bg-slate-200/50 p-1.5 rounded-2xl flex gap-1">
              <button onClick={() => setActiveTab('REGISTRY')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'REGISTRY' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}>📋 Registro</button>
              <button onClick={() => setActiveTab('SIMULATION')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'SIMULATION' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}>🧮 Simulatore</button>
          </div>
       </div>

       {activeTab === 'REGISTRY' && (
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
               <div className="lg:col-span-8 space-y-4">
                   <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                       <h3 className="font-bold text-slate-700 pl-2">Storico Transazioni</h3>
                       
                       {/* FILTRI */}
                       <div className="flex items-center gap-2">
                           <select 
                             value={filterMonth} 
                             onChange={(e) => setFilterMonth(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value))}
                             className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500"
                           >
                               <option value="ALL">Tutti i Mesi</option>
                               {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                           </select>
                           <select 
                             value={filterYear} 
                             onChange={(e) => setFilterYear(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value))}
                             className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500"
                           >
                               <option value="ALL">Tutti gli Anni</option>
                               {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                           </select>
                           <button onClick={() => { setFormData({transactionDate: new Date().toISOString().split('T')[0], income: 0, mortgage: 0, condo: 0, utilities: 0, internet: 0, maintenance: 0, taxes: 0, other: 0, attachment: undefined, notes: '', tenantId: ''}); setIsFormOpen(true); }} className="bg-brand-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-brand-700 transition-all ml-2 whitespace-nowrap">
                              + Nuovo
                           </button>
                       </div>
                   </div>

                   {filteredRecords.length === 0 ? (
                       <div className="text-center py-12 text-slate-400 italic bg-white rounded-3xl border border-slate-100">
                           Nessuna transazione trovata per i filtri selezionati.
                       </div>
                   ) : (
                       filteredRecords.map(rec => {
                           const prop = properties.find(p => p.id === rec.propertyId);
                           const propName = prop?.name || 'Immobile sconosciuto';
                           
                           // Calcolo tasse automatiche se non presenti
                           const taxRate = prop?.financials?.defaultTaxRate || 0;
                           const estimatedTax = (rec.taxes === 0 && taxRate > 0) ? (rec.income * taxRate / 100) : 0;
                           
                           const totalExpenses = (rec.mortgage || 0) + (rec.condo || 0) + (rec.utilities || 0) + (rec.internet || 0) + (rec.maintenance || 0) + (rec.taxes || 0) + (rec.other || 0) + estimatedTax;
                           const net = rec.income - totalExpenses;
                           const dateLabel = new Date(rec.transactionDate).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

                           return (
                               <div key={rec.id} className="bg-white p-6 rounded-3xl shadow-soft border border-slate-100 hover:border-brand-200 transition-all group">
                                   <div className="flex justify-between items-start mb-4">
                                       <div className="flex items-center gap-3">
                                           <div className="w-12 h-12 rounded-2xl bg-slate-50 flex flex-col items-center justify-center border border-slate-100">
                                               <span className="text-[10px] font-bold text-slate-400 uppercase">{dateLabel.split(' ')[0].substring(0,3)}</span>
                                               <span className="text-sm font-black text-slate-800">{rec.year}</span>
                                           </div>
                                           <div>
                                               <h4 className="font-bold text-slate-900">{propName}</h4>
                                               <p className="text-xs text-slate-400 capitalize flex items-center gap-2">
                                                 {dateLabel}
                                                 {rec.attachment && (
                                                   <a 
                                                     href={rec.attachment.data} 
                                                     download={rec.attachment.name}
                                                     className="bg-slate-100 text-brand-600 px-2 py-0.5 rounded text-[9px] font-bold hover:bg-brand-50 flex items-center gap-1"
                                                     title="Scarica allegato"
                                                     onClick={(e) => e.stopPropagation()}
                                                   >
                                                     📎 {rec.attachment.name.length > 15 ? rec.attachment.name.substring(0,12) + '...' : rec.attachment.name}
                                                   </a>
                                                 )}
                                               </p>
                                               {rec.notes && <p className="text-[10px] text-slate-500 italic mt-1 max-w-xs truncate">{rec.notes}</p>}
                                           </div>
                                       </div>
                                       <div className="text-right">
                                           <p className="text-[10px] font-bold text-slate-400 uppercase">Cashflow Netto</p>
                                           <p className={`text-xl font-black ${net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                               {net >= 0 ? '+' : ''}€ {net.toLocaleString()}
                                           </p>
                                           {estimatedTax > 0 && <p className="text-[9px] text-slate-400">Incl. tasse est. {taxRate}%</p>}
                                       </div>
                                   </div>
                                   <div className="flex justify-end gap-3 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                       <button onClick={() => { setFormData(rec); setIsFormOpen(true); }} className="text-xs font-bold text-brand-600">Modifica</button>
                                       <button onClick={() => handleDeleteRecord(rec.id)} className="text-xs font-bold text-rose-500">Elimina</button>
                                   </div>
                               </div>
                           );
                       })
                   )}
               </div>

               {isFormOpen && (
                   <div className="lg:col-span-4 relative">
                       <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-brand-100 sticky top-8 animate-slide-in">
                           <h3 className="text-xl font-bold text-slate-900 mb-6">{formData.id ? 'Modifica' : 'Nuova'} Registrazione</h3>
                           <div className="space-y-4">
                               <select value={formData.propertyId} onChange={e => handlePropertySelect(e.target.value)} className="w-full bg-slate-50 border-0 rounded-xl px-4 py-3 text-sm font-bold ring-1 ring-slate-200">
                                   <option value="">Seleziona Immobile...</option>
                                   {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                               </select>
                               
                               <div className="grid grid-cols-2 gap-4">
                                   <div className="col-span-2">
                                       <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Inquilino / Pagante</label>
                                       <select 
                                           value={formData.tenantId || ''} 
                                           onChange={e => setFormData({...formData, tenantId: e.target.value})} 
                                           className="w-full bg-slate-50 border-0 rounded-xl px-4 py-3 text-sm font-bold ring-1 ring-slate-200"
                                       >
                                           <option value="">Seleziona Inquilino...</option>
                                           {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                       </select>
                                   </div>
                               </div>

                               <input type="date" value={formData.transactionDate} onChange={e => setFormData({...formData, transactionDate: e.target.value})} className="w-full bg-slate-50 border-0 rounded-xl px-4 py-3 text-sm font-bold ring-1 ring-slate-200" />
                               
                               <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                   <label className="text-[10px] font-bold text-emerald-600 uppercase">Incasso Affitto</label>
                                   <input type="number" value={formData.income} onChange={e => setFormData({...formData, income: parseFloat(e.target.value)})} className="w-full bg-white border-0 rounded-xl px-4 py-3 font-black text-lg ring-1 ring-emerald-200" />
                               </div>
                               
                               <div className="grid grid-cols-2 gap-3">
                                   <input type="number" placeholder="Mutuo" value={formData.mortgage} onChange={e => setFormData({...formData, mortgage: parseFloat(e.target.value)})} className="w-full bg-slate-50 border-0 rounded-xl p-2 text-sm font-bold ring-1 ring-slate-200" />
                                   <input type="number" placeholder="Internet" value={formData.internet} onChange={e => setFormData({...formData, internet: parseFloat(e.target.value)})} className="w-full bg-slate-50 border-0 rounded-xl p-2 text-sm font-bold ring-1 ring-slate-200" />
                               </div>
                               <div className="grid grid-cols-2 gap-3">
                                   <input type="number" placeholder="Condominio" value={formData.condo} onChange={e => setFormData({...formData, condo: parseFloat(e.target.value)})} className="w-full bg-slate-50 border-0 rounded-xl p-2 text-sm font-bold ring-1 ring-slate-200" />
                                   <input type="number" placeholder="Utenze" value={formData.utilities} onChange={e => setFormData({...formData, utilities: parseFloat(e.target.value)})} className="w-full bg-slate-50 border-0 rounded-xl p-2 text-sm font-bold ring-1 ring-slate-200" />
                               </div>

                               <div>
                                   <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Note</label>
                                   <textarea
                                      value={formData.notes || ''}
                                      onChange={e => setFormData({...formData, notes: e.target.value})}
                                      className="w-full bg-slate-50 border-0 rounded-xl px-4 py-3 text-sm font-medium ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500 resize-none h-20"
                                      placeholder="Note aggiuntive..."
                                   />
                               </div>

                               {/* Sezione Allegato */}
                               <div className="pt-2 border-t border-slate-100">
                                 <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Allegato (Ricevuta/Bonifico)</label>
                                 {formData.attachment ? (
                                   <div className="flex items-center justify-between bg-slate-100 p-3 rounded-xl border border-slate-200">
                                      <div className="flex items-center gap-2 overflow-hidden">
                                         <span className="text-xl">📎</span>
                                         <span className="text-xs font-bold text-slate-700 truncate">{formData.attachment.name}</span>
                                      </div>
                                      <button onClick={handleRemoveAttachment} className="text-rose-500 font-bold px-2 hover:bg-rose-50 rounded-lg">✕</button>
                                   </div>
                                 ) : (
                                   <div className="relative">
                                     <input 
                                        type="file" 
                                        accept="image/*,application/pdf"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload} 
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                     />
                                     <div className="w-full border-2 border-dashed border-slate-200 rounded-xl py-3 text-center hover:bg-slate-50 transition-colors">
                                        <span className="text-xs font-bold text-slate-400">Clicca per caricare PDF o Immagine</span>
                                     </div>
                                   </div>
                                 )}
                               </div>

                               <div className="flex gap-2 pt-2">
                                   <button onClick={() => setIsFormOpen(false)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-bold uppercase text-[10px]">Annulla</button>
                                   <button onClick={handleSaveRecord} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold uppercase text-[10px]">Salva</button>
                               </div>
                           </div>
                       </div>
                   </div>
               )}
           </div>
       )}

       {activeTab === 'SIMULATION' && (
           <div className="max-w-4xl mx-auto bg-white p-10 rounded-[2.5rem] shadow-soft border border-slate-100">
               <div className="text-center mb-10">
                  <h3 className="font-bold text-2xl text-slate-900 mb-2">Calcolatore Rendimento</h3>
                  <p className="text-slate-500">Stima rapidamente il cashflow netto di una potenziale operazione.</p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                   {/* Input Canone */}
                   <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                       <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Canone Mensile Atteso</label>
                       <div className="relative">
                          <input 
                            type="number" 
                            value={simData.rent} 
                            onChange={(e) => setSimData({...simData, rent: parseFloat(e.target.value) || 0})}
                            className="w-full bg-white border-0 rounded-xl px-4 py-3 font-black text-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span>
                       </div>
                   </div>

                   {/* Input Spese */}
                   <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                       <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Spese Mensili (Cond/Imprev)</label>
                       <div className="relative">
                          <input 
                            type="number" 
                            value={simData.expenses} 
                            onChange={(e) => setSimData({...simData, expenses: parseFloat(e.target.value) || 0})}
                            className="w-full bg-white border-0 rounded-xl px-4 py-3 font-black text-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span>
                       </div>
                   </div>

                   {/* Input Tasse */}
                   <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                       <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tassazione (Cedolare/IRPEF)</label>
                       <div className="relative">
                          <input 
                            type="number" 
                            value={simData.tax} 
                            onChange={(e) => setSimData({...simData, tax: parseFloat(e.target.value) || 0})}
                            className="w-full bg-white border-0 rounded-xl px-4 py-3 font-black text-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                       </div>
                   </div>
               </div>
               
               <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-xl flex flex-col md:flex-row justify-around items-center gap-6">
                   <div className="text-center">
                        <p className="text-slate-400 text-xs font-bold uppercase mb-1">Cashflow Netto Mensile</p>
                        <div className="flex justify-center items-end gap-1">
                             <span className="text-5xl font-black tracking-tighter">€ {netMonthly.toFixed(0)}</span>
                        </div>
                   </div>
                   <div className="w-px h-16 bg-slate-700 hidden md:block"></div>
                   <div className="text-center">
                        <p className="text-slate-400 text-xs font-bold uppercase mb-1">Netto Annuale Stimato</p>
                        <div className="flex justify-center items-end gap-1">
                             <span className="text-4xl font-bold tracking-tighter text-emerald-400">€ {annualNet.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        </div>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};
