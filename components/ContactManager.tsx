import React, { useState, useEffect } from 'react';
import { Tenant, Landlord, Attachment, Property, RentalRecord } from '../types';
import { db } from '../services/dbService';

/* =====================================================================================
   ImmoPlan · Contatti (Rubrica) — "Bento Terminal" reskin. Logica identica.
   Inquilini / Locatori, card con statistiche, form laterale. CSS scoped sotto `.ipb`.
   ===================================================================================== */

const fmt = (n: number) => Math.round(n || 0).toLocaleString('it-IT');
const initials = (s: string) => (s || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
const ic = (p: string, s = 16, sw = 1.9) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: p }} />);
const PATH = {
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  building: '<path d="M3 22V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v17"/><path d="M14 22V10a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v12"/><path d="M2 22h20"/><path d="M6 12h2M6 16h2M16 12h2M16 16h2"/>',
  pencil: '<path d="M12 3a2.85 2.83 0 1 1 4 4L7.5 17.5 2 19l1.5-5.5Z"/><path d="m15 5 2 2"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  clip: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  doc: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 8h10"/><path d="M7 12h10"/><path d="M7 16h6"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
};

export const ContactManager: React.FC = () => {
  const [activeType, setActiveType] = useState<'TENANT' | 'LANDLORD'>('TENANT');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [records, setRecords] = useState<RentalRecord[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'DEFAULT' | 'NEON'>('DEFAULT');
  const blank = { name: '', email: '', phone: '', iban: '', taxCode: '', notes: '', attachments: [] as Attachment[] };
  const [formData, setFormData] = useState<any>(blank);

  useEffect(() => {
    const apply = () => setTheme(document.documentElement.classList.contains('theme-neon') ? 'NEON' : 'DEFAULT');
    const obs = new MutationObserver(apply); obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); apply();
    return () => obs.disconnect();
  }, []);
  const isNeon = theme === 'NEON';

  useEffect(() => { loadData(); }, []);
  const loadData = async () => {
    await db.init();
    const [t, l, p, r] = await Promise.all([db.getTenants(), db.getLandlords(), db.getProperties(), db.getRentalRecords()]);
    setTenants(t || []); setLandlords(l || []); setProperties(p || []); setRecords(r || []);
  };
  const handleSave = async () => {
    if (!formData.name) return alert('Il nome è obbligatorio');
    if (activeType === 'TENANT') await db.saveTenant({ ...formData, id: editingId || `T-${Date.now()}`, createdAt: formData.createdAt || new Date().toISOString() });
    else await db.saveLandlord({ ...formData, id: editingId || `L-${Date.now()}`, createdAt: formData.createdAt || new Date().toISOString() });
    setIsFormOpen(false); setEditingId(null); setFormData(blank); loadData();
  };
  const handleEdit = (item: any) => { setFormData(item); setEditingId(item.id); setIsFormOpen(true); };
  const handleDelete = async (id: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo contatto?')) return;
    if (activeType === 'TENANT') await db.deleteTenant(id); else await db.deleteLandlord(id); loadData();
  };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFormData({ ...formData, attachments: [...(formData.attachments || []), { name: file.name, data: reader.result as string, type: file.type }] });
    reader.readAsDataURL(file);
  };
  const removeAttachment = (index: number) => { const u = [...(formData.attachments || [])]; u.splice(index, 1); setFormData({ ...formData, attachments: u }); };
  const getContactStats = (id: string) => {
    if (activeType === 'TENANT') {
      const associatedProps = properties.filter(p => p.currentTenantId === id);
      const totalPaid = records.filter(r => r.tenantId === id).reduce((acc, r) => acc + (Number(r.income) || 0), 0);
      return { count: associatedProps.length, money: totalPaid };
    }
    const totalSent = records.filter(r => r.landlordId === id).reduce((acc, r) => acc + (Number(r.income) || 0), 0);
    return { count: 0, money: totalSent };
  };
  const list = activeType === 'TENANT' ? tenants : landlords;

  return (
    <div className={`ipb${isNeon ? '' : ' light'}`}>
      <style>{IPB_CONTACT_CSS}</style>
      <div className="body">
        <div className="phead">
          <div><div className="eyebrow">Rubrica Professionale</div><h2>Anagrafica Contatti</h2><p>Gestione anagrafica avanzata per il tuo ecosistema immobiliare.</p></div>
          <div className="seg">
            <button className={activeType === 'TENANT' ? 'on' : ''} onClick={() => setActiveType('TENANT')}>{ic(PATH.users, 14)} Inquilini</button>
            <button className={activeType === 'LANDLORD' ? 'on' : ''} onClick={() => setActiveType('LANDLORD')}>{ic(PATH.building, 14)} Locatori</button>
          </div>
        </div>

        <div className="clayout" style={{ gridTemplateColumns: isFormOpen ? '1fr 360px' : '1fr' }}>
          <div className="cmain">
            <div className="csubhead"><h3>Contatti salvati ({list.length})</h3><button className="btn primary" onClick={() => { setEditingId(null); setFormData(blank); setIsFormOpen(true); }}>{ic(PATH.plus, 14, 2.4)} Nuovo Contatto</button></div>
            {list.length === 0 ? (
              <div className="empty">{ic(PATH.doc, 40, 1.5)}<p className="e1">Nessun contatto registrato</p><p className="e2">Inizia aggiungendo il primo {activeType === 'TENANT' ? 'inquilino' : 'locatore'}.</p></div>
            ) : (
              <div className="cgrid" style={{ gridTemplateColumns: isFormOpen ? '1fr' : 'repeat(2,1fr)' }}>
                {list.map(item => {
                  const stats = getContactStats(item.id);
                  return (
                    <div className="ccard" key={item.id}>
                      <div className="cctop">
                        <div className="ccwho"><div className="ccava">{initials(item.name)}</div><div><h4>{item.name}</h4><span className="ccmail">{item.email || 'Email non fornita'}</span></div></div>
                        <div className="ccact"><button onClick={() => handleEdit(item)}>{ic(PATH.pencil, 14)}</button><button className="del" onClick={() => handleDelete(item.id)}>{ic(PATH.trash, 14)}</button></div>
                      </div>
                      <div className="ccstats">
                        <div className="ccstat"><span className="micro">Immobili</span><span className="num v">{stats.count}</span></div>
                        <div className="ccstat"><span className="micro">Volume (Tot. Pagato)</span><span className="num v pos">€ {fmt(stats.money)}</span></div>
                      </div>
                      <div className="ccfoot"><span className="ccphone">{ic(PATH.phone, 12)} {item.phone || 'N/D'}</span>{(item.attachments?.length ?? 0) > 0 && <span className="ccdocs">{ic(PATH.clip, 11)} {item.attachments?.length} doc</span>}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {isFormOpen && (
            <div className="formpanel">
              <div className="panel pad">
                <h3 className="formtitle">{editingId ? 'Modifica' : 'Nuovo'} {activeType === 'TENANT' ? 'Inquilino' : 'Locatore'}</h3>
                <div className="formstack">
                  <div className="field"><label>Nome Completo</label><input className="input" type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                  <div className="grid2">
                    <div className="field"><label>Telefono</label><input className="input" type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                    <div className="field"><label>Cod. Fiscale</label><input className="input mono" type="text" value={formData.taxCode} onChange={e => setFormData({ ...formData, taxCode: e.target.value })} /></div>
                  </div>
                  <div className="field"><label>Email</label><input className="input" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                  {activeType === 'LANDLORD' && <div className="field"><label>IBAN</label><input className="input mono" type="text" value={formData.iban} onChange={e => setFormData({ ...formData, iban: e.target.value })} /></div>}
                  <div className="field"><label>Documenti &amp; Allegati</label>
                    {(formData.attachments?.length ?? 0) > 0 && <div className="attchips">{formData.attachments.map((att: Attachment, i: number) => <div className="attchip" key={i}><span>{att.name}</span><button onClick={() => removeAttachment(i)}>✕</button></div>)}</div>}
                    <div className="dropzone"><input type="file" onChange={handleFileUpload} /><span>{ic(PATH.clip, 13)} Carica file (PDF/IMG)</span></div>
                  </div>
                  <div className="formbtns"><button className="btn ghost" onClick={() => setIsFormOpen(false)}>Annulla</button><button className="btn dark" onClick={handleSave}>Salva Contatto</button></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const IPB_CONTACT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&display=swap');
.ipb{ --font:'Geist','DM Sans',system-ui,sans-serif; --mono:'Geist Mono',ui-monospace,monospace;
  --bg:#0a0e16; --panel:#111827; --panel-2:#151d2d; --inset:#0c121e; --border:rgba(255,255,255,.07); --border-2:rgba(255,255,255,.12);
  --text:#eaeff7; --dim:#8b97ab; --faint:#58637a; --accent:#2f8fff; --accent-2:#6f63ff; --accent-soft:rgba(47,143,255,.14); --glow:rgba(47,143,255,.28);
  --pos:#2fd6a3; --pos-soft:rgba(47,214,163,.14); --neg:#fb6f86; --neg-soft:rgba(251,111,134,.14); --r:11px; --r-sm:8px; --r-lg:16px;
  font-family:var(--font); color:var(--text); text-align:left; }
.ipb.light{ --bg:#f4f6fb; --panel:#fff; --panel-2:#fff; --inset:#f1f4f9; --border:rgba(15,23,42,.09); --border-2:rgba(15,23,42,.16);
  --text:#0c1424; --dim:#5a6679; --faint:#9aa6bb; --accent:#0a6cff; --accent-2:#5b4bff; --accent-soft:rgba(10,108,255,.10); --glow:rgba(10,108,255,.18);
  --pos:#0fa47a; --pos-soft:rgba(15,164,122,.12); --neg:#e23d63; --neg-soft:rgba(226,61,99,.10); }
.ipb *{ box-sizing:border-box; }
.ipb .body{ display:flex; flex-direction:column; gap:18px; }
.ipb .micro{ font-family:var(--mono); font-size:9px; font-weight:500; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); }
.ipb .num{ font-family:var(--mono); font-weight:600; letter-spacing:-.01em; color:var(--text); }
.ipb .panel{ background:var(--panel); border:1px solid var(--border); border-radius:var(--r-lg); }
.ipb .panel.pad{ padding:20px; }
.ipb .phead{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; }
.ipb .phead .eyebrow{ font-family:var(--mono); font-size:10px; font-weight:600; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); }
.ipb .phead h2{ margin:4px 0 3px; font-size:24px; font-weight:700; letter-spacing:-.02em; } .ipb .phead p{ margin:0; font-size:12.5px; color:var(--dim); }
.ipb .seg{ display:inline-flex; gap:2px; padding:3px; background:var(--inset); border:1px solid var(--border); border-radius:12px; }
.ipb .seg button{ border:none; background:transparent; cursor:pointer; font-family:var(--mono); font-size:11px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:var(--dim); padding:8px 14px; border-radius:8px; display:inline-flex; align-items:center; gap:7px; }
.ipb .seg button.on{ background:var(--panel); color:var(--text); box-shadow:0 1px 0 var(--border-2); }
.ipb .btn{ border:none; cursor:pointer; font-family:var(--font); font-weight:700; font-size:11px; letter-spacing:.06em; text-transform:uppercase; padding:11px 16px; border-radius:10px; display:inline-flex; align-items:center; gap:7px; white-space:nowrap; }
.ipb .btn.primary{ background:var(--accent); color:#fff; box-shadow:0 8px 24px -10px var(--glow); } .ipb .btn.primary:hover{ filter:brightness(1.08); }
.ipb .btn.ghost{ background:var(--inset); color:var(--dim); border:1px solid var(--border); flex:1; justify-content:center; } .ipb .btn.ghost:hover{ color:var(--text); }
.ipb .btn.dark{ background:var(--text); color:var(--bg); flex:1; justify-content:center; }
.ipb .input{ width:100%; background:var(--inset); border:1px solid var(--border); border-radius:10px; color:var(--text); font-family:var(--font); font-size:13.5px; font-weight:500; padding:11px 13px; outline:none; }
.ipb .input:focus{ border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); } .ipb .input.mono{ font-family:var(--mono); font-weight:600; }
.ipb .field label{ display:block; font-family:var(--mono); font-size:9px; letter-spacing:.12em; text-transform:uppercase; color:var(--faint); margin:0 0 6px 2px; }

.ipb .clayout{ display:grid; gap:18px; align-items:start; }
.ipb .cmain{ display:flex; flex-direction:column; gap:14px; }
.ipb .csubhead{ display:flex; align-items:center; justify-content:space-between; gap:12px; } .ipb .csubhead h3{ margin:0; font-size:14px; font-weight:700; }
.ipb .empty{ background:var(--panel); border:1px solid var(--border); border-radius:var(--r-lg); padding:54px; text-align:center; color:var(--faint); } .ipb .empty .e1{ margin:14px 0 4px; font-weight:700; color:var(--text); font-size:15px; } .ipb .empty .e2{ margin:0; font-size:13px; }
.ipb .cgrid{ display:grid; gap:14px; }
.ipb .ccard{ background:var(--panel); border:1px solid var(--border); border-radius:var(--r-lg); padding:18px; transition:border-color .18s; }
.ipb .ccard:hover{ border-color:var(--accent); }
.ipb .cctop{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:16px; }
.ipb .ccwho{ display:flex; align-items:center; gap:11px; min-width:0; }
.ipb .ccava{ width:42px; height:42px; border-radius:12px; background:var(--accent-soft); color:var(--accent); display:grid; place-items:center; font-family:var(--mono); font-size:13px; font-weight:700; flex:none; }
.ipb .ccwho h4{ margin:0; font-size:15px; font-weight:700; } .ipb .ccmail{ font-size:11px; color:var(--faint); }
.ipb .ccact{ display:flex; gap:6px; } .ipb .ccact button{ width:30px; height:30px; border-radius:8px; border:1px solid var(--border); background:var(--inset); color:var(--accent); cursor:pointer; display:grid; place-items:center; } .ipb .ccact button.del{ color:var(--neg); } .ipb .ccact button:hover{ border-color:var(--border-2); }
.ipb .ccstats{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
.ipb .ccstat{ background:var(--inset); border:1px solid var(--border); border-radius:12px; padding:11px 13px; text-align:center; } .ipb .ccstat .v{ display:block; font-size:18px; margin-top:4px; } .ipb .ccstat .v.pos{ color:var(--pos); }
.ipb .ccfoot{ display:flex; align-items:center; gap:10px; border-top:1px solid var(--border); padding-top:12px; }
.ipb .ccphone{ display:flex; align-items:center; gap:6px; font-size:11px; color:var(--dim); } .ipb .ccphone svg{ color:var(--faint); }
.ipb .ccdocs{ margin-left:auto; display:inline-flex; align-items:center; gap:4px; font-family:var(--mono); font-size:9px; font-weight:600; color:var(--accent); background:var(--accent-soft); padding:3px 8px; border-radius:7px; }

.ipb .formpanel{ position:sticky; top:18px; } .ipb .formtitle{ margin:0 0 18px; font-size:17px; font-weight:700; }
.ipb .formstack{ display:flex; flex-direction:column; gap:14px; } .ipb .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.ipb .attchips{ display:flex; flex-wrap:wrap; gap:7px; margin-bottom:9px; }
.ipb .attchip{ display:flex; align-items:center; gap:6px; background:var(--inset); border:1px solid var(--border); border-radius:8px; padding:5px 9px; font-family:var(--mono); font-size:10px; font-weight:600; } .ipb .attchip span{ max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .ipb .attchip button{ border:none; background:transparent; color:var(--neg); cursor:pointer; }
.ipb .dropzone{ position:relative; border:1.5px dashed var(--border-2); border-radius:10px; padding:14px; text-align:center; } .ipb .dropzone input{ position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; } .ipb .dropzone span{ display:inline-flex; align-items:center; gap:6px; font-family:var(--mono); font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--faint); }
.ipb .formbtns{ display:flex; gap:10px; padding-top:4px; }

@media (max-width:1100px){ .ipb .clayout{ grid-template-columns:1fr !important; } .ipb .cgrid{ grid-template-columns:1fr !important; } .ipb .formpanel{ position:static; } }
`;

export default ContactManager;
