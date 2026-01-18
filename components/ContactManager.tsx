
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Tenant, Landlord, Attachment, Property, RentalRecord } from '../types';
import { db } from '../services/dbService';

export const ContactManager: React.FC = () => {
  const [activeType, setActiveType] = useState<'TENANT' | 'LANDLORD'>('TENANT');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [records, setRecords] = useState<RentalRecord[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form States
  const [formData, setFormData] = useState<any>({
    name: '', email: '', phone: '', iban: '', taxCode: '', notes: '', attachments: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await db.init();
    const [t, l, p, r] = await Promise.all([
      db.getTenants(), db.getLandlords(), db.getProperties(), db.getRentalRecords()
    ]);
    setTenants(t || []);
    setLandlords(l || []);
    setProperties(p || []);
    setRecords(r || []);
  };

  const handleSave = async () => {
    if (!formData.name) return alert("Il nome è obbligatorio");
    
    if (activeType === 'TENANT') {
      const tenant: Tenant = {
        ...formData,
        id: editingId || `T-${Date.now()}`,
        createdAt: formData.createdAt || new Date().toISOString()
      };
      await db.saveTenant(tenant);
    } else {
      const landlord: Landlord = {
        ...formData,
        id: editingId || `L-${Date.now()}`,
        createdAt: formData.createdAt || new Date().toISOString()
      };
      await db.saveLandlord(landlord);
    }
    
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ name: '', email: '', phone: '', iban: '', taxCode: '', notes: '', attachments: [] });
    loadData();
  };

  const handleEdit = (item: any) => {
    setFormData(item);
    setEditingId(item.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo contatto?")) return;
    if (activeType === 'TENANT') await db.deleteTenant(id);
    else await db.deleteLandlord(id);
    loadData();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const att: Attachment = { name: file.name, data: reader.result as string, type: file.type };
        setFormData({ ...formData, attachments: [...(formData.attachments || []), att] });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAttachment = (index: number) => {
    const updated = [...(formData.attachments || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, attachments: updated });
  };

  // Stats Helpers con calcolo Volume robusto
  const getContactStats = (id: string) => {
    if (activeType === 'TENANT') {
      const associatedProps = properties.filter(p => p.currentTenantId === id);
      const associatedRecords = records.filter(r => r.tenantId === id);
      const totalPaid = associatedRecords.reduce((acc, r) => acc + (Number(r.income) || 0), 0);
      return { count: associatedProps.length, money: totalPaid };
    } else {
      const associatedRecords = records.filter(r => r.landlordId === id);
      const totalSent = associatedRecords.reduce((acc, r) => acc + (Number(r.income) || 0), 0);
      return { count: 0, money: totalSent };
    }
  };

  const list = activeType === 'TENANT' ? tenants : landlords;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Portfolio Selector */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Rubrica Professionale</h2>
          <p className="text-slate-500 text-sm">Gestione anagrafica avanzata per il tuo ecosistema immobiliare.</p>
        </div>
        <div className="flex bg-slate-200/50 p-1.5 rounded-2xl">
          <button 
            onClick={() => setActiveType('TENANT')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeType === 'TENANT' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}
          >
            👤 Inquilini
          </button>
          <button 
            onClick={() => setActiveType('LANDLORD')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeType === 'LANDLORD' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}
          >
            🏢 Locatori
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Contact List */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-slate-700">Contatti salvati ({list.length})</h3>
            <button 
              onClick={() => { setEditingId(null); setFormData({ name: '', email: '', phone: '', iban: '', taxCode: '', notes: '', attachments: [] }); setIsFormOpen(true); }}
              className="bg-brand-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-brand-700 transition-all"
            >
              + Nuovo Contatto
            </button>
          </div>

          {list.length === 0 ? (
            <div className="bg-white p-12 rounded-[2.5rem] text-center border border-slate-100 opacity-60">
              <span className="text-4xl mb-4 block">📇</span>
              <p className="font-bold text-slate-900">Nessun contatto registrato</p>
              <p className="text-sm">Inizia aggiungendo il primo {activeType === 'TENANT' ? 'inquilino' : 'locatore'}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {list.map(item => {
                const stats = getContactStats(item.id);
                return (
                  <div key={item.id} className="bg-white p-6 rounded-3xl shadow-soft border border-slate-100 hover:border-brand-200 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-brand-50 rounded-full -mr-12 -mt-12 opacity-0 group-hover:opacity-50 transition-all"></div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div>
                        <h4 className="font-bold text-lg text-slate-900">{item.name}</h4>
                        <p className="text-xs text-slate-400 font-medium">{item.email || 'Email non fornita'}</p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(item)} className="p-2 hover:bg-slate-50 rounded-lg text-brand-600">📝</button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-rose-50 rounded-lg text-rose-500">🗑️</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-50 p-3 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Immobili</p>
                        <p className="text-lg font-black text-slate-700">{stats.count}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Volume (Tot. Pagato)</p>
                        <p className="text-lg font-black text-emerald-600">€{stats.money.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 border-t border-slate-50 pt-4">
                      <span>📞 {item.phone || 'N/D'}</span>
                      {(item.attachments?.length ?? 0) > 0 && (
                        <span className="ml-auto bg-brand-50 text-brand-600 px-2 py-1 rounded-lg font-bold">📂 {item.attachments?.length} doc</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Editor Side Panel */}
        {isFormOpen && (
          <div className="lg:col-span-4 bg-white p-8 rounded-[2.5rem] shadow-2xl border border-brand-100 animate-slide-in sticky top-8">
            <h3 className="text-xl font-bold text-slate-900 mb-6">{editingId ? 'Modifica' : 'Nuovo'} {activeType === 'TENANT' ? 'Inquilino' : 'Locatore'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nome Completo</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border-0 rounded-xl px-4 py-3 font-bold ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Telefono</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-50 border-0 rounded-xl px-4 py-3 text-sm ring-1 ring-slate-200" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Cod. Fiscale</label>
                  <input type="text" value={formData.taxCode} onChange={e => setFormData({...formData, taxCode: e.target.value})} className="w-full bg-slate-50 border-0 rounded-xl px-4 py-3 text-sm ring-1 ring-slate-200" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border-0 rounded-xl px-4 py-3 text-sm ring-1 ring-slate-200" />
              </div>
              {activeType === 'LANDLORD' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">IBAN</label>
                  <input type="text" value={formData.iban} onChange={e => setFormData({...formData, iban: e.target.value})} className="w-full bg-slate-50 border-0 rounded-xl px-4 py-3 text-sm ring-1 ring-slate-200 font-mono" />
                </div>
              )}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Documenti & Allegati</label>
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {formData.attachments?.map((att: Attachment, i: number) => (
                      <div key={i} className="bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-2 text-[10px] font-bold">
                        <span className="truncate max-w-[80px]">{att.name}</span>
                        <button onClick={() => removeAttachment(i)} className="text-rose-500">✕</button>
                      </div>
                    ))}
                  </div>
                  <input type="file" onChange={handleFileUpload} className="hidden" id="contact-file" />
                  <label htmlFor="contact-file" className="block text-center border-2 border-dashed border-slate-200 rounded-xl py-3 text-xs font-bold text-slate-400 cursor-pointer hover:bg-slate-50 transition-all">
                    📎 Carica file (PDF/IMG)
                  </label>
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button onClick={() => setIsFormOpen(false)} className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest">Annulla</button>
                <button onClick={handleSave} className="flex-2 bg-slate-900 text-white py-4 px-8 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-xl shadow-slate-200">Salva Contatto</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
