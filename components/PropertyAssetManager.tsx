import React, { useState, useEffect, useMemo } from 'react';
import {
  Property,
  RecurringCost,
  RentalRecord,
  Tenant,
  Attachment,
  ValuationRecord,
  MortgageSubrogation,
  MortgageRadarSettings,
  BankMortgageOffer,
  MarketReferenceIndices,
  EvaluatedBankOffer
} from '../types';
import { db } from '../services/dbService';
import { notificationService } from '../services/notificationService';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, Tooltip, YAxis, CartesianGrid, Legend } from 'recharts';
import { MarketForecaster } from './MarketForecaster';
import {
  getActiveMortgageAtDate,
  getPropertySubrogations,
  calculateSubrogationTimeline,
  calculatePropertyMortgageStats,
  DEFAULT_MORTGAGE_RADAR_SETTINGS,
  getDefaultMarketIndices,
  buildItalianAndMilanBankCatalog,
  evaluatePropertySubrogation,
  analyzePortfolioMortgages,
  runMortgageRadarCheck,
  fetchLiveBankRatesWithAI
} from '../services/mortgageService';


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

  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [subForm, setSubForm] = useState<Partial<MortgageSubrogation>>({
    date: new Date().toISOString().split('T')[0],
    bankName: '',
    newMonthlyPayment: 0,
    newRate: undefined,
    rateType: 'FIXED',
    newDurationYears: 20,
    residualPrincipal: undefined,
    notes: '',
    attachment: undefined
  });

  const [radarSettings, setRadarSettings] = useState<MortgageRadarSettings>(DEFAULT_MORTGAGE_RADAR_SETTINGS);
  const [marketIndices, setMarketIndices] = useState<MarketReferenceIndices>(() => getDefaultMarketIndices());
  const [bankCatalog, setBankCatalog] = useState<BankMortgageOffer[]>(() => buildItalianAndMilanBankCatalog());
  const [radarBankFilter, setRadarBankFilter] = useState<'ALL' | 'MILAN_ONLY' | 'FIXED' | 'VARIABLE'>('ALL');
  const [isScanningRates, setIsScanningRates] = useState(false);
  const [isSendingRadarTg, setIsSendingRadarTg] = useState(false);
  const [radarFeedback, setRadarFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const resetSubForm = (p?: Property | null) => {
    setEditingSubId(null);
    setSubForm({
      date: new Date().toISOString().split('T')[0],
      bankName: '',
      newMonthlyPayment: 0,
      newRate: p?.financials?.mortgageRate || undefined,
      rateType: 'FIXED',
      newDurationYears: p?.financials?.mortgageDuration || 20,
      residualPrincipal: undefined,
      notes: '',
      attachment: undefined
    });
  };

  /* ---- theme observer (immutato) ---- */
  useEffect(() => {
    const apply = () => setTheme(document.documentElement.classList.contains('theme-neon') ? 'NEON' : 'DEFAULT');
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    apply();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    loadData();
    loadRadarConfig();
  }, []);

  const loadRadarConfig = async () => {
    try {
      const settings = await notificationService.getSettings();
      if (settings?.mortgageRadar) {
        setRadarSettings({ ...DEFAULT_MORTGAGE_RADAR_SETTINGS, ...settings.mortgageRadar });
      }
      const res = await fetch('/api/mortgage-radar/rates');
      if (res.ok) {
        const data = await res.json();
        if (data?.indices) setMarketIndices(data.indices);
        if (Array.isArray(data?.bankCatalog) && data.bankCatalog.length > 0) setBankCatalog(data.bankCatalog);
        if (data?.radarSettings) setRadarSettings(prev => ({ ...prev, ...data.radarSettings }));
      }
    } catch {
      // Fallback defaults already initialized
    }
  };

  const handleRefreshBankRates = async (useAi: boolean = false) => {
    setIsScanningRates(true);
    setRadarFeedback(null);
    try {
      if (useAi) {
        const live = await fetchLiveBankRatesWithAI();
        setMarketIndices(live.indices);
        setBankCatalog(live.bankCatalog);
        setRadarFeedback({
          type: 'success',
          message: `Tassi banche Italia & Milano aggiornati (${live.indices.source === 'GEMINI_GROUNDED' ? 'Gemini AI Live Grounding' : 'Benchmark Mercato'}): IRS 20A ${live.indices.irs20Y}% · Euribor 3M ${live.indices.euribor3M}%`
        });
      } else {
        const res = await fetch('/api/mortgage-radar/rates');
        if (res.ok) {
          const data = await res.json();
          if (data?.indices) setMarketIndices(data.indices);
          if (Array.isArray(data?.bankCatalog) && data.bankCatalog.length > 0) setBankCatalog(data.bankCatalog);
        }
        setRadarFeedback({
          type: 'info',
          message: `Analisi completata su ${bankCatalog.length} offerte di banche nazionali e di Milano.`
        });
      }
    } catch (e: any) {
      setRadarFeedback({ type: 'error', message: e?.message || 'Errore aggiornamento tassi' });
    } finally {
      setIsScanningRates(false);
    }
  };

  const handleSaveRadarThresholds = async (nextSettings: MortgageRadarSettings) => {
    setRadarSettings(nextSettings);
    try {
      const fullSettings = await notificationService.getSettings();
      await notificationService.saveSettings({
        ...fullSettings,
        mortgageRadar: nextSettings
      });
      await fetch('/api/mortgage-radar/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextSettings)
      }).catch(() => {});
    } catch {}
  };

  const handleSendRadarTelegramReport = async (targetProperties?: Property[]) => {
    setIsSendingRadarTg(true);
    setRadarFeedback(null);
    try {
      const notifSettings = await notificationService.getSettings();
      const propsToCheck = targetProperties && targetProperties.length > 0 ? targetProperties : properties;
      const report = await runMortgageRadarCheck({
        properties: propsToCheck,
        settings: radarSettings,
        sendTelegram: true,
        forceSend: true,
        botToken: notifSettings?.telegram?.botToken,
        recipientChatId: radarSettings.recipientChatId || notifSettings?.telegram?.ownerChatId,
        customIndices: marketIndices,
        customBankCatalog: bankCatalog
      });

      if (report.telegramSent) {
        setRadarFeedback({
          type: 'success',
          message: `✈️ Report Tassi & Surroghe inviato con successo su Telegram! (${report.advantageousCount} offerte vantaggiose rilevate)`
        });
      } else {
        setRadarFeedback({
          type: 'error',
          message: `⚠️ Analisi eseguita, ma invio Telegram non riuscito: ${report.telegramError || 'Verifica Bot Token e Chat ID nel Pannello Admin.'}`
        });
      }
    } catch (e: any) {
      setRadarFeedback({
        type: 'error',
        message: `Errore invio report Telegram: ${e?.message || e}`
      });
    } finally {
      setIsSendingRadarTg(false);
    }
  };

  const handleApplyOfferToSubForm = (evOffer: EvaluatedBankOffer, remainingYears: number, residualPrincipal: number) => {
    setEditingSubId(null);
    setSubForm({
      date: new Date().toISOString().split('T')[0],
      bankName: evOffer.offer.bankName,
      newMonthlyPayment: evOffer.newMonthlyPayment,
      newRate: evOffer.appliedTan,
      rateType: evOffer.offer.rateType,
      newDurationYears: remainingYears,
      residualPrincipal: residualPrincipal,
      notes: `${evOffer.offer.productName} (${evOffer.offer.hqCity}) · Surroga Zero Spese L.40/2007 · TAEG ${evOffer.appliedTaeg}%`,
      attachment: undefined
    });
    setRadarFeedback({
      type: 'success',
      message: `⚡ Modulo surroga precompilato con l'offerta di ${evOffer.offer.bankName} (Rata € ${evOffer.newMonthlyPayment}/mese, TAN ${evOffer.appliedTan}%). Clicca su "Registra Surroga Mutuo" per salvarla!`
    });
  };

  const portfolioRadarReport = useMemo(() => {
    return analyzePortfolioMortgages(properties, radarSettings, marketIndices, bankCatalog);
  }, [properties, radarSettings, marketIndices, bankCatalog]);

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
      financials: { mortgageAmount: 0, mortgageDuration: 20, mortgageStartDate: new Date().toISOString().split('T')[0], mortgageRate: 0, monthlyRent: 0, condoFees: 0, defaultTaxRate: 21, subrogations: [] },
      subrogations: [],
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

  const handleSaveSubrogation = async () => {
    if (!selectedProp) return;
    if (!subForm.date) return alert('Inserisci la data di decorrenza della surroga.');
    if (!subForm.newMonthlyPayment || safeNum(subForm.newMonthlyPayment) <= 0) {
      return alert('Inserisci la nuova rata mensile del mutuo (€).');
    }

    const existingSubs = getPropertySubrogations(selectedProp);
    const entry: MortgageSubrogation = {
      id: editingSubId || `SUB-${Date.now()}`,
      date: subForm.date,
      bankName: (subForm.bankName || '').trim() || undefined,
      newMonthlyPayment: safeNum(subForm.newMonthlyPayment),
      newRate: subForm.newRate !== undefined && subForm.newRate !== null && String(subForm.newRate) !== ''
        ? safeNum(subForm.newRate)
        : undefined,
      rateType: subForm.rateType || 'FIXED',
      newDurationYears: safeNum(subForm.newDurationYears) > 0 ? safeNum(subForm.newDurationYears) : 20,
      residualPrincipal: subForm.residualPrincipal !== undefined && subForm.residualPrincipal !== null && safeNum(subForm.residualPrincipal) > 0
        ? safeNum(subForm.residualPrincipal)
        : undefined,
      notes: (subForm.notes || '').trim() || undefined,
      attachment: subForm.attachment
    };

    const updatedSubs = editingSubId
      ? existingSubs.map(s => (s.id === editingSubId ? entry : s))
      : [...existingSubs, entry];

    updatedSubs.sort((a, b) => a.date.localeCompare(b.date));

    const updatedProp: Property = {
      ...selectedProp,
      subrogations: updatedSubs,
      financials: {
        ...(selectedProp.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }),
        subrogations: updatedSubs
      }
    };

    setSelectedProp(updatedProp);
    setProperties(prev => prev.map(p => (p.id === updatedProp.id ? updatedProp : p)));
    await db.saveProperty(updatedProp);
    await loadData();
    resetSubForm(updatedProp);
  };

  const handleEditSubrogation = (sub: MortgageSubrogation) => {
    setEditingSubId(sub.id);
    setSubForm({
      date: sub.date,
      bankName: sub.bankName || '',
      newMonthlyPayment: sub.newMonthlyPayment,
      newRate: sub.newRate,
      rateType: sub.rateType || 'FIXED',
      newDurationYears: sub.newDurationYears || 20,
      residualPrincipal: sub.residualPrincipal,
      notes: sub.notes || '',
      attachment: sub.attachment
    });
  };

  const handleDeleteSubrogation = async (subId: string) => {
    if (!selectedProp) return;
    if (!window.confirm('Eliminare questa surroga/rinegoziazione dallo storico?')) return;
    const updatedSubs = getPropertySubrogations(selectedProp).filter(s => s.id !== subId);
    const updatedProp: Property = {
      ...selectedProp,
      subrogations: updatedSubs,
      financials: {
        ...(selectedProp.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }),
        subrogations: updatedSubs
      }
    };
    setSelectedProp(updatedProp);
    setProperties(prev => prev.map(p => (p.id === updatedProp.id ? updatedProp : p)));
    if (editingSubId === subId) resetSubForm(updatedProp);
    await db.saveProperty(updatedProp);
    await loadData();
  };

  const handleUploadSubrogationAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const att = await readFile(file);
      setSubForm(prev => ({ ...prev, attachment: att }));
    }
  };

  const handleUpdateTaxRegime = async (
    regime: 'ESENTE_0' | 'CEDOLARE_10' | 'CEDOLARE_21' | 'IRPEF_ORDINARIA',
    customMarginalRate?: number,
    persist: boolean = true
  ) => {
    if (!selectedProp) return;
    const curMarginal = customMarginalRate !== undefined 
      ? customMarginalRate 
      : (selectedProp.financials?.marginalTaxRate ?? 23);

    let effectiveTaxRate = 21;
    if (regime === 'ESENTE_0') effectiveTaxRate = 0;
    else if (regime === 'CEDOLARE_10') effectiveTaxRate = 10;
    else if (regime === 'CEDOLARE_21') effectiveTaxRate = 21;
    else if (regime === 'IRPEF_ORDINARIA') effectiveTaxRate = curMarginal;

    const updatedProp: Property = {
      ...selectedProp,
      financials: {
        ...(selectedProp.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }),
        taxRegime: regime,
        marginalTaxRate: curMarginal,
        defaultTaxRate: effectiveTaxRate
      }
    };
    setSelectedProp(updatedProp);
    setProperties(prev => prev.map(p => p.id === updatedProp.id ? updatedProp : p));
    if (persist) {
      await db.saveProperty(updatedProp);
    }
  };

  const calculateMortgageStats = (p: Property) => {
    return calculatePropertyMortgageStats(p, new Date());
  };

  const totalValue = properties.reduce((acc, p) => acc + safeNum(p.currentValue), 0);
  const totalCost = properties.reduce((acc, p) => acc + safeNum(p.purchasePrice), 0);
  const totalGain = totalValue - totalCost;
  const gainPct = totalCost > 0 ? (totalGain / totalCost * 100) : 0;

  const currentCosts = useMemo(() => selectedProp?.recurringCosts || [], [selectedProp]);
  const filteredCosts = useMemo(() => filterCategory === 'ALL' ? currentCosts : currentCosts.filter(c => c.category === filterCategory), [currentCosts, filterCategory]);

  const rentWidgetData = useMemo(() => {
    if (!selectedProp) return {
      totalExpenses: 0,
      mortgageMonthly: 0,
      operatingExpenses: 0,
      suggestedRent: 0,
      netProfit: 0,
      estimatedTax: 0,
      marginPercent: 0,
      taxRate: 21,
      taxRegime: 'CEDOLARE_21' as 'ESENTE_0' | 'CEDOLARE_10' | 'CEDOLARE_21' | 'IRPEF_ORDINARIA',
      marginalTaxRate: 23,
      fixedExpenses: 0,
      oneOffExpenses: 0,
      suggestedMortgageBase: 0,
      suggestedExpensesBase: 0,
      baseRentShare: 0,
      expensesShare: 0,
      isSubrogated: false,
      activeBankName: undefined as string | undefined
    };

    const activeMortgage = getActiveMortgageAtDate(selectedProp, new Date(), { monthGranularity: true });

    let fixedExpenses = 0;
    const costs = selectedProp.recurringCosts || [];
    costs.forEach(c => {
      if (c.frequency === 'MONTHLY') fixedExpenses += safeNum(c.amount);
      else if (c.frequency === 'YEARLY') fixedExpenses += safeNum(c.amount) / 12;
    });
    if (!costs.some(c => c.category === 'MORTGAGE') && activeMortgage.isActive && activeMortgage.monthlyPayment > 0) {
      fixedExpenses += safeNum(activeMortgage.monthlyPayment);
    }

    let oneOffExpenses = 0;
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    let totalOneOffInLastYear = 0;
    costs.filter(c => c.frequency === 'ONE_OFF' && c.date).forEach(c => {
      if (new Date(c.date!) >= twelveMonthsAgo) totalOneOffInLastYear += safeNum(c.amount);
    });
    oneOffExpenses = totalOneOffInLastYear / 12;
    const totalExpenses = fixedExpenses + oneOffExpenses;

    // Mutuo mensile isolato dalle altre spese (Time-Aware con supporto Surroga)
    let mortgageMonthly = 0;
    const mortgageCosts = costs.filter(c => c.category === 'MORTGAGE');
    if (mortgageCosts.length > 0) {
      mortgageCosts.forEach(c => {
        if (c.frequency === 'MONTHLY') mortgageMonthly += safeNum(c.amount);
        else if (c.frequency === 'YEARLY') mortgageMonthly += safeNum(c.amount) / 12;
      });
    } else if (activeMortgage.isActive && activeMortgage.monthlyPayment > 0) {
      mortgageMonthly = safeNum(activeMortgage.monthlyPayment);
    }
    const operatingExpenses = Math.max(0, totalExpenses - mortgageMonthly);

    const marginPercent = selectedProp.financials?.targetMargin || 0;

    // Determinazione regime fiscale e aliquota
    let taxRegime: 'ESENTE_0' | 'CEDOLARE_10' | 'CEDOLARE_21' | 'IRPEF_ORDINARIA' = selectedProp.financials?.taxRegime || 'CEDOLARE_21';
    let marginalTaxRate = selectedProp.financials?.marginalTaxRate ?? 23;
    let taxRate = 21;

    if (selectedProp.financials?.taxRegime) {
      taxRegime = selectedProp.financials.taxRegime;
      if (taxRegime === 'ESENTE_0') taxRate = 0;
      else if (taxRegime === 'CEDOLARE_10') taxRate = 10;
      else if (taxRegime === 'CEDOLARE_21') taxRate = 21;
      else if (taxRegime === 'IRPEF_ORDINARIA') taxRate = marginalTaxRate;
    } else if (selectedProp.financials?.defaultTaxRate !== undefined) {
      const dRate = selectedProp.financials.defaultTaxRate;
      taxRate = dRate;
      if (dRate === 0) taxRegime = 'ESENTE_0';
      else if (dRate === 10) taxRegime = 'CEDOLARE_10';
      else if (dRate === 21) taxRegime = 'CEDOLARE_21';
      else {
        taxRegime = 'IRPEF_ORDINARIA';
        marginalTaxRate = dRate;
      }
    }

    const desiredNetIncome = totalExpenses * (1 + (marginPercent / 100));
    const suggestedRent = taxRate < 100 ? desiredNetIncome / (1 - (taxRate / 100)) : 0;
    const estimatedTax = suggestedRent * (taxRate / 100);
    const netProfit = suggestedRent - estimatedTax - totalExpenses;

    const mortgageWeight = totalExpenses > 0 ? mortgageMonthly / totalExpenses : (mortgageMonthly > 0 ? 1 : 0);
    const expensesWeight = totalExpenses > 0 ? operatingExpenses / totalExpenses : 0;
    const suggestedMortgageBase = suggestedRent * mortgageWeight;
    const suggestedExpensesBase = suggestedRent * expensesWeight;
    const baseRentShare = mortgageMonthly + netProfit;
    const expensesShare = operatingExpenses + estimatedTax;

    return {
      totalExpenses,
      mortgageMonthly,
      operatingExpenses,
      suggestedRent,
      netProfit,
      estimatedTax,
      marginPercent,
      taxRate,
      taxRegime,
      marginalTaxRate,
      fixedExpenses,
      oneOffExpenses,
      suggestedMortgageBase,
      suggestedExpensesBase,
      baseRentShare,
      expensesShare,
      isSubrogated: activeMortgage.isSubrogated,
      activeBankName: activeMortgage.bankName
    };
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
    if (!costs.some(c => c.category === 'TAX') && p.financials?.defaultTaxRate !== undefined && p.financials.defaultTaxRate > 0 && annualRent > 0) {
      annualOperatingExpenses += annualRent * (p.financials.defaultTaxRate / 100);
    }
    
    const noi = annualRent - annualOperatingExpenses;
    const purchasePrice = safeNum(p.purchasePrice) || 1;
    const grossCapRate = (annualRent / purchasePrice) * 100;
    const netCapRate = (noi / purchasePrice) * 100;
    
    // Cashflow Netto Annuo dopo la rata del mutuo attiva (Levered Cash Flow, Time-Aware con Surroga)
    const activeMortgage = getActiveMortgageAtDate(p, new Date(), { monthGranularity: true });
    let annualMortgage = 0;
    const mortgageCosts = costs.filter(c => c.category === 'MORTGAGE');
    if (mortgageCosts.length > 0) {
      mortgageCosts.forEach(c => {
        if (c.frequency === 'MONTHLY') annualMortgage += safeNum(c.amount) * 12;
        else if (c.frequency === 'YEARLY') annualMortgage += safeNum(c.amount);
      });
    } else if (activeMortgage.isActive && activeMortgage.monthlyPayment > 0) {
      annualMortgage = safeNum(activeMortgage.monthlyPayment) * 12;
    }
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
    const hasExplicitMortgage = (selectedProp.recurringCosts || []).some(c => c.category === 'MORTGAGE');
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
      if (!hasExplicitMortgage) {
        const stepDate = isYearView
          ? new Date(targetDate.getFullYear(), i, 1)
          : new Date(targetDate.getFullYear(), targetDate.getMonth(), i + 1);
        const mortState = getActiveMortgageAtDate(selectedProp, stepDate, { monthGranularity: isYearView });
        if (mortState.isActive && mortState.monthlyPayment > 0) {
          datum['MORTGAGE'] += isYearView ? mortState.monthlyPayment : mortState.monthlyPayment / iterations;
        }
      }
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

  const formatIsoIt = (iso?: string) => {
    if (!iso) return '-';
    const parts = iso.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
  };

  const renderSubrogationsSection = (p: Property) => {
    const timeline = calculateSubrogationTimeline(p, new Date());
    const { items, activeState, originalMonthlyPayment, originalRate, originalDurationYears, originalStartDate, originalBankName } = timeline;

    return (
      <div className="subrog-wrap">
        <div className="subrog-head">
          <div>
            <div className="sectlabel" style={{ marginBottom: 3, color: 'var(--indigo)' }}>🔄 Storico Surroghe &amp; Rinegoziazioni Mutuo</div>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>
              Gestisci 1 o più surroghe cronologiche: i flussi passati conservano la vecchia rata, i periodi successivi applicano la nuova
            </div>
          </div>
          {activeState.isSubrogated ? (
            <span className="subrog-status-pill active">
              Surroga #{activeState.subrogationIndex} Attiva · {eur(activeState.monthlyPayment)}/m
            </span>
          ) : originalMonthlyPayment > 0 ? (
            <span className="subrog-status-pill orig">
              Mutuo Originario · {eur(originalMonthlyPayment)}/m
            </span>
          ) : null}
        </div>

        {/* Riepilogo Risparmio Attivo se surrogato */}
        {activeState.isSubrogated && originalMonthlyPayment > 0 && (
          <div className="subrog-hero-banner">
            <div className="shb-col">
              <span className="shb-lbl">Rata Originaria</span>
              <span className="shb-val dim" style={{ textDecoration: 'line-through' }}>{eur(originalMonthlyPayment)}/m</span>
              <span className="shb-sub">{originalBankName || 'Banca Iniziale'} · {originalDurationYears}a</span>
            </div>
            <div className="shb-arrow">➔</div>
            <div className="shb-col">
              <span className="shb-lbl">Rata Attiva (Surroga #{activeState.subrogationIndex})</span>
              <span className="shb-val indigo">{eur(activeState.configuredMonthlyPayment)}/m</span>
              <span className="shb-sub">{activeState.bankName || 'Nuova Banca'} · {activeState.rate}% · {activeState.durationYears}a</span>
            </div>
            <div className="shb-col sav">
              <span className="shb-lbl">Risparmio vs Originario</span>
              <span className={`shb-val ${originalMonthlyPayment - activeState.configuredMonthlyPayment >= 0 ? 'pos' : 'neg'}`}>
                {seur(originalMonthlyPayment - activeState.configuredMonthlyPayment)}/mese
              </span>
              <span className="shb-sub">
                {seur((originalMonthlyPayment - activeState.configuredMonthlyPayment) * 12)}/anno
              </span>
            </div>
          </div>
        )}

        {/* Timeline Cronologica */}
        <div className="subrog-timeline">
          {/* Step 0: Mutuo Originario */}
          {originalMonthlyPayment > 0 && (
            <div className={`subrog-card orig ${!activeState.isSubrogated && activeState.isActive ? 'current' : ''}`}>
              <div className="sc-top">
                <div className="sc-title">
                  <span className="sc-step">0</span>
                  <div>
                    <div className="sc-bank">Mutuo Originario {originalBankName ? `· ${originalBankName}` : ''}</div>
                    <div className="sc-date">Decorrenza: {formatIsoIt(originalStartDate)} · Durata {originalDurationYears} anni{originalRate > 0 ? ` · Tasso ${originalRate}%` : ''}</div>
                  </div>
                </div>
                <div className="sc-right">
                  <span className="sc-pay">{eur(originalMonthlyPayment)}<small>/mese</small></span>
                  <span className={`sc-badge ${!activeState.isSubrogated && activeState.isActive ? 'b-act' : 'b-hist'}`}>
                    {!activeState.isSubrogated && activeState.isActive ? 'IN CORSO' : 'SOSTITUITO'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div className="empty-sm" style={{ padding: '14px', border: '1px dashed var(--border-2)', borderRadius: 10 }}>
              Nessuna surroga o rinegoziazione registrata per questo immobile. Compila il modulo sottostante per aggiungere una surroga.
            </div>
          ) : (
            items.map((item) => {
              const { subrogation: sub, index, previousMonthlyPayment, monthlySavings, annualSavings, remainingDurationSavings, totalDurationSavings, endDate, remainingMonths, status } = item;
              const statusLabel = status === 'ACTIVE' ? 'ATTIVA' : status === 'UPCOMING' ? 'PROGRAMMATA' : status === 'REPLACED' ? 'SOSTITUITA' : 'SCADUTA';
              const statusCls = status === 'ACTIVE' ? 'b-act' : status === 'UPCOMING' ? 'b-up' : 'b-hist';

              return (
                <div key={sub.id} className={`subrog-card ${status === 'ACTIVE' ? 'current' : ''}`}>
                  <div className="sc-top">
                    <div className="sc-title">
                      <span className="sc-step indigo">{index}ª</span>
                      <div>
                        <div className="sc-bank">
                          {sub.bankName ? sub.bankName : `Surroga / Rinegoziazione #${index}`}
                          {sub.rateType && (
                            <span className="sc-ratetype">
                              {sub.rateType === 'FIXED' ? 'Tasso Fisso' : 'Tasso Variabile'}
                            </span>
                          )}
                        </div>
                        <div className="sc-date">
                          Decorrenza: <strong>{formatIsoIt(sub.date)}</strong> · Scadenza: {formatIsoIt(endDate)} ({sub.newDurationYears} anni)
                          {sub.newRate !== undefined ? ` · Tasso ${sub.newRate}%` : ''}
                          {sub.residualPrincipal ? ` · Cap. Residuo ${eur(sub.residualPrincipal)}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="sc-right">
                      <span className="sc-pay indigo">{eur(sub.newMonthlyPayment)}<small>/mese</small></span>
                      <span className={`sc-badge ${statusCls}`}>{statusLabel}</span>
                    </div>
                  </div>

                  {/* Metriche di Risparmio rispetto alla rata precedente */}
                  <div className="sc-metrics">
                    <div className="scm-box">
                      <span className="scm-l">Rata Precedente</span>
                      <span className="scm-v dim">{eur(previousMonthlyPayment)}/m</span>
                    </div>
                    <div className="scm-box">
                      <span className="scm-l">Risparmio Mensile</span>
                      <span className={`scm-v ${monthlySavings >= 0 ? 'pos' : 'neg'}`}>
                        {seur(monthlySavings)}/mese
                      </span>
                    </div>
                    <div className="scm-box">
                      <span className="scm-l">Risparmio Annuo</span>
                      <span className={`scm-v ${annualSavings >= 0 ? 'pos' : 'neg'}`}>
                        {seur(annualSavings)}/anno
                      </span>
                    </div>
                    <div className="scm-box">
                      <span className="scm-l" title={`Calcolato sui ${remainingMonths} mesi residui (Totale su ${sub.newDurationYears}a: ${seur(totalDurationSavings)})`}>
                        Risparmio Stimato Residuo
                      </span>
                      <span className={`scm-v ${remainingDurationSavings >= 0 ? 'pos' : 'neg'}`}>
                        {seur(remainingDurationSavings)}
                      </span>
                    </div>
                  </div>

                  {(sub.notes || sub.attachment || true) && (
                    <div className="sc-foot">
                      <div className="sc-notes">
                        {sub.notes && <span>📝 {sub.notes}</span>}
                        {sub.attachment && (
                          <a href={sub.attachment.data} download={sub.attachment.name} className="sc-att">
                            {ic(PATH.doc, 13)} {sub.attachment.name}
                          </a>
                        )}
                      </div>
                      <div className="sc-actions">
                        <button
                          type="button"
                          className="sc-btn edit"
                          onClick={() => handleEditSubrogation(sub)}
                          title="Modifica surroga"
                        >
                          ✎ Modifica
                        </button>
                        <button
                          type="button"
                          className="sc-btn del"
                          onClick={() => handleDeleteSubrogation(sub.id)}
                          title="Elimina surroga"
                        >
                          {ic(PATH.trash, 13)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* RADAR TASSI BANCHE (ITALIA & MILANO) & CONFRONTO SURROGA */}
        {(() => {
          const opp = evaluatePropertySubrogation(p, bankCatalog, marketIndices, radarSettings, new Date());
          if (!opp) return null;

          const filteredOffers = (opp.topOffers || []).filter(ev => {
            if (radarBankFilter === 'MILAN_ONLY') return ev.offer.isMilanFocused;
            if (radarBankFilter === 'FIXED') return ev.offer.rateType === 'FIXED';
            if (radarBankFilter === 'VARIABLE') return ev.offer.rateType === 'VARIABLE';
            return true;
          });

          const best = opp.bestOffer;

          return (
            <div className="radar-box">
              <div className="radar-head">
                <div>
                  <div className="radar-title-row">
                    <span className="radar-badge-live">📡 RADAR TASSI BANCHE · ITALIA &amp; MILANO</span>
                    {opp.isAdvantageous && best && (
                      <span className="radar-badge-hot">
                        🔥 OFFERTA VANTAGGIOSA (-{eur(best.monthlySavings)}/m)
                      </span>
                    )}
                  </div>
                  <div className="radar-sub">
                    Confronto in tempo reale del tuo mutuo attivo ({opp.currentBankName} · <strong>TAN {opp.currentRate.toFixed(2)}%</strong> · Rata <strong>{eur(opp.currentMonthlyPayment)}/m</strong> · Cap. stimato {eur(opp.estimatedResidualPrincipal)} su {opp.remainingYears}a residui) con le offerte Surroga Zero Spese (L. 40/2007)
                  </div>
                </div>
                <div className="radar-actions">
                  <button
                    type="button"
                    className="sc-btn"
                    onClick={() => handleRefreshBankRates(true)}
                    disabled={isScanningRates}
                    title="Aggiorna indici IRS/Euribor e offerte banche tramite AI Grounding"
                  >
                    {isScanningRates ? '⏳ Scansione...' : '🔍 Aggiorna Tassi Live'}
                  </button>
                  <button
                    type="button"
                    className="sc-btn tg-btn"
                    onClick={() => handleSendRadarTelegramReport([p])}
                    disabled={isSendingRadarTg}
                    title="Invia subito il report di confronto su Telegram"
                  >
                    {isSendingRadarTg ? '⏳ Invio...' : '✈️ Invia Report Telegram'}
                  </button>
                </div>
              </div>

              {/* Indici di Riferimento Mercato */}
              <div className="radar-indices-strip">
                <span className="ri-item">📊 <strong>IRS 10A:</strong> {marketIndices.irs10Y.toFixed(2)}%</span>
                <span className="ri-item"><strong>IRS 20A:</strong> {marketIndices.irs20Y.toFixed(2)}%</span>
                <span className="ri-item"><strong>IRS 25A:</strong> {marketIndices.irs25Y.toFixed(2)}%</span>
                <span className="ri-item"><strong>IRS 30A:</strong> {marketIndices.irs30Y.toFixed(2)}%</span>
                <span className="ri-item"><strong>Euribor 3M:</strong> {marketIndices.euribor3M.toFixed(2)}%</span>
                <span className="ri-item"><strong>BCE:</strong> {marketIndices.bceRate.toFixed(2)}%</span>
                <span className="ri-item" style={{ marginLeft: 'auto', opacity: 0.8 }}>
                  LTV Stimato: <strong>{opp.estimatedLtv}%</strong>{opp.isGreenProperty ? ` · 🌿 Green Classe ${opp.energyClass}` : ''}
                </span>
              </div>

              {radarFeedback && (
                <div className={`radar-feedback ${radarFeedback.type}`}>
                  <span>{radarFeedback.message}</span>
                  <button type="button" onClick={() => setRadarFeedback(null)}>✕</button>
                </div>
              )}

              {/* Callout Migliore Offerta Vantaggiosa */}
              {best && best.monthlySavings > 0 && (
                <div className={`radar-best-callout ${opp.isAdvantageous ? 'adv' : 'mild'}`}>
                  <div className="rbc-left">
                    <div className="rbc-eyebrow">
                      {opp.isAdvantageous ? '🏆 MIGLIORE OPPORTUNITÀ DI SURROGA RILEVATA' : '💡 MIGLIORE OFFERTA DISPONIBILE SUL MERCATO'}
                    </div>
                    <div className="rbc-main">
                      <strong>{best.offer.bankName}</strong> <span className="rbc-city">({best.offer.hqCity})</span> — <em>{best.offer.productName}</em>
                    </div>
                    <div className="rbc-metrics">
                      <span>Nuovo Tasso: <strong className="pos">TAN {best.appliedTan.toFixed(2)}%</strong> (TAEG {best.appliedTaeg.toFixed(2)}%) [<strong>-{best.rateDelta.toFixed(2)}% / -{best.rateDeltaBps} bps</strong>]</span>
                      <span>· Nuova Rata: <strong>{eur(best.newMonthlyPayment)}/mese</strong></span>
                    </div>
                  </div>
                  <div className="rbc-right">
                    <div className="rbc-sav-box">
                      <span className="rbc-sav-lbl">Risparmio Stimato</span>
                      <span className="rbc-sav-val">+{eur(best.monthlySavings)}/m · +{eur(best.annualSavings)}/a</span>
                      <span className="rbc-sav-tot">Totale su {opp.remainingYears}a: <strong>+{eur(best.totalRemainingSavings)}</strong></span>
                    </div>
                    <button
                      type="button"
                      className="btn primary"
                      style={{ padding: '9px 13px', fontSize: 10 }}
                      onClick={() => handleApplyOfferToSubForm(best, opp.remainingYears, opp.estimatedResidualPrincipal)}
                    >
                      ⚡ Precompila Surroga
                    </button>
                  </div>
                </div>
              )}

              {/* Filtri Tabella Banche */}
              <div className="radar-filter-bar">
                <div className="rf-pills">
                  <button
                    type="button"
                    className={`rf-pill ${radarBankFilter === 'ALL' ? 'on' : ''}`}
                    onClick={() => setRadarBankFilter('ALL')}
                  >
                    Tutte le Banche ({opp.topOffers.length})
                  </button>
                  <button
                    type="button"
                    className={`rf-pill ${radarBankFilter === 'MILAN_ONLY' ? 'on' : ''}`}
                    onClick={() => setRadarBankFilter('MILAN_ONLY')}
                  >
                    🏙️ Focus Milano ({opp.topOffers.filter(o => o.offer.isMilanFocused).length})
                  </button>
                  <button
                    type="button"
                    className={`rf-pill ${radarBankFilter === 'FIXED' ? 'on' : ''}`}
                    onClick={() => setRadarBankFilter('FIXED')}
                  >
                    🔒 Tasso Fisso ({opp.topOffers.filter(o => o.offer.rateType === 'FIXED').length})
                  </button>
                  <button
                    type="button"
                    className={`rf-pill ${radarBankFilter === 'VARIABLE' ? 'on' : ''}`}
                    onClick={() => setRadarBankFilter('VARIABLE')}
                  >
                    📈 Tasso Variabile ({opp.topOffers.filter(o => o.offer.rateType === 'VARIABLE').length})
                  </button>
                </div>
                <span className="rf-threshold-note">
                  Soglia Alert Telegram: min. <strong>€ {radarSettings.minMonthlySavings}/mese</strong> e <strong>-{radarSettings.minRateDeltaBps} bps</strong>
                </span>
              </div>

              {/* Tabella Comparativa Offerte Banche */}
              <div className="radar-table-wrap">
                <table className="radar-table">
                  <thead>
                    <tr>
                      <th>Banca &amp; Sede</th>
                      <th>Prodotto Surroga</th>
                      <th>TAN / TAEG</th>
                      <th>Nuova Rata</th>
                      <th>Risparmio Mensile / Annuo</th>
                      <th>Risparmio ({opp.remainingYears}a)</th>
                      <th style={{ textAlign: 'right' }}>Azione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOffers.map((ev) => {
                      const isPos = ev.monthlySavings > 0;
                      return (
                        <tr key={ev.offer.bankId} className={ev.isAdvantageous ? 'row-adv' : ''}>
                          <td>
                            <div className="rt-bank">
                              <strong>{ev.offer.bankName}</strong>
                              {ev.offer.isMilanFocused && <span className="rt-tag milan">🏙️ Milano</span>}
                            </div>
                            <div className="rt-sub">{ev.offer.hqCity}</div>
                          </td>
                          <td>
                            <div className="rt-prod">
                              {ev.offer.productName}
                              {ev.isGreenRateApplied && <span className="rt-tag green">🌿 Green</span>}
                            </div>
                            <div className="rt-sub">
                              {ev.offer.rateType === 'FIXED' ? 'Tasso Fisso' : 'Tasso Variabile'} ({ev.offer.referenceIndex} + {ev.offer.spread}%) · Zero Spese
                            </div>
                          </td>
                          <td>
                            <div className="rt-mono">
                              <strong style={{ color: ev.rateDelta > 0 ? 'var(--pos)' : 'var(--text)' }}>
                                {ev.appliedTan.toFixed(2)}%
                              </strong>
                              <span className="rt-sub-inline"> (TAEG {ev.appliedTaeg.toFixed(2)}%)</span>
                            </div>
                            <div className={`rt-delta ${ev.rateDelta > 0 ? 'pos' : 'neg'}`}>
                              {ev.rateDelta > 0 ? `-${ev.rateDelta.toFixed(2)}% (-${ev.rateDeltaBps} bps)` : `+${Math.abs(ev.rateDelta).toFixed(2)}%`}
                            </div>
                          </td>
                          <td>
                            <div className="rt-mono"><strong>{eur(ev.newMonthlyPayment)}</strong><small>/m</small></div>
                            <div className="rt-sub">Attuale: {eur(opp.currentMonthlyPayment)}/m</div>
                          </td>
                          <td>
                            <div className={`rt-mono ${isPos ? 'pos' : 'neg'}`}>
                              <strong>{seur(ev.monthlySavings)}/mese</strong>
                            </div>
                            <div className="rt-sub">{seur(ev.annualSavings)}/anno</div>
                          </td>
                          <td>
                            <div className={`rt-mono ${isPos ? 'pos' : 'neg'}`}>
                              <strong>{seur(ev.totalRemainingSavings)}</strong>
                            </div>
                            {ev.isAdvantageous && <span className="rt-tag adv-pill">Consigliata</span>}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="sc-btn edit"
                              onClick={() => handleApplyOfferToSubForm(ev, opp.remainingYears, opp.estimatedResidualPrincipal)}
                              title="Copia questi parametri nel modulo Nuova Surroga qui sotto"
                            >
                              ⚡ Usa Offerta
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Form Inserimento / Modifica Surroga */}
        <div className="subrog-form">
          <div className="sf-head">
            <span>{editingSubId ? '✎ Modifica Surroga / Rinegoziazione' : '+ Nuova Surroga / Rinegoziazione Mutuo'}</span>
            {editingSubId && (
              <button type="button" className="sc-btn" onClick={() => resetSubForm(p)}>
                Annulla Modifica
              </button>
            )}
          </div>
          <div className="grid3" style={{ gap: 10 }}>
            <div className="field">
              <label className="indigo">Data Decorrenza *</label>
              <input
                className="input"
                type="date"
                value={subForm.date || ''}
                onChange={e => setSubForm({ ...subForm, date: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="indigo">Nuova Banca</label>
              <input
                className="input"
                type="text"
                value={subForm.bankName || ''}
                onChange={e => setSubForm({ ...subForm, bankName: e.target.value })}
                placeholder="Es. Intesa Sanpaolo, UniCredit..."
              />
            </div>
            <div className="field">
              <label className="indigo">Nuova Rata Mensile (€) *</label>
              <input
                className="input mono"
                type="number"
                step="0.01"
                value={subForm.newMonthlyPayment || ''}
                onChange={e => setSubForm({ ...subForm, newMonthlyPayment: parseFloat(e.target.value) || 0 })}
                placeholder="Es. 460"
              />
            </div>
          </div>

          <div className="grid3" style={{ gap: 10, marginTop: 10 }}>
            <div className="field">
              <label className="indigo">Nuovo Tasso (%)</label>
              <input
                className="input mono"
                type="number"
                step="0.05"
                value={subForm.newRate ?? ''}
                onChange={e => setSubForm({ ...subForm, newRate: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                placeholder="Es. 2.55"
              />
            </div>
            <div className="field">
              <label className="indigo">Tipo Tasso</label>
              <select
                className="input"
                value={subForm.rateType || 'FIXED'}
                onChange={e => setSubForm({ ...subForm, rateType: e.target.value as 'FIXED' | 'VARIABLE' })}
              >
                <option value="FIXED">Fisso</option>
                <option value="VARIABLE">Variabile</option>
              </select>
            </div>
            <div className="field">
              <label className="indigo">Nuova Durata (Anni) *</label>
              <input
                className="input mono"
                type="number"
                min="1"
                max="40"
                value={subForm.newDurationYears || ''}
                onChange={e => setSubForm({ ...subForm, newDurationYears: parseFloat(e.target.value) || 20 })}
                placeholder="20"
              />
            </div>
          </div>

          <div className="grid3" style={{ gap: 10, marginTop: 10, alignItems: 'end' }}>
            <div className="field">
              <label className="indigo">Capitale Residuo (€ - Opz.)</label>
              <input
                className="input mono"
                type="number"
                value={subForm.residualPrincipal ?? ''}
                onChange={e => setSubForm({ ...subForm, residualPrincipal: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                placeholder="Es. 95000"
              />
            </div>
            <div className="field">
              <label className="indigo">Note / Condizioni</label>
              <input
                className="input"
                type="text"
                value={subForm.notes || ''}
                onChange={e => setSubForm({ ...subForm, notes: e.target.value })}
                placeholder="Es. Surroga a costo zero, perizia inclusa"
              />
            </div>
            <div className="field">
              <label className="indigo">Atto / Allegato PDF</label>
              <label className="subrog-file-btn">
                {ic(PATH.doc, 13)}
                <span>{subForm.attachment ? subForm.attachment.name : 'Allega PDF / Doc'}</span>
                <input type="file" accept=".pdf,.doc,.docx,.jpg,.png" onChange={handleUploadSubrogationAttachment} hidden />
              </label>
            </div>
          </div>

          <button
            type="button"
            className="btn primary wide"
            style={{ marginTop: 12, padding: '11px 16px' }}
            onClick={handleSaveSubrogation}
          >
            {ic(PATH.plus, 14, 2.4)} {editingSubId ? 'Salva Modifiche Surroga' : 'Registra Surroga Mutuo'}
          </button>
        </div>
      </div>
    );
  };

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
                  <div className="sectlabel">Dettagli Mutuo Originario</div>
                  <div className="mortbox">
                    <div className="grid2">
                      <div className="field"><label className="indigo">Rata Mensile Mutuo Originario (€)</label><input className="input mono" type="number" value={p.financials?.mortgageAmount || ''} onChange={e => setSelectedProp({ ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), mortgageAmount: parseFloat(e.target.value) || 0 } })} placeholder="Es. 550" /></div>
                      <div className="field"><label className="indigo">Banca Originaria</label><input className="input" type="text" value={p.financials?.originalBankName || ''} onChange={e => setSelectedProp({ ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), originalBankName: e.target.value } })} placeholder="Es. Banca Intesa" /></div>
                    </div>
                    <div className="grid3">
                      <div className="field"><label className="indigo">Tasso Iniziale (%)</label><input className="input mono" type="number" step="0.05" value={p.financials?.mortgageRate || ''} onChange={e => setSelectedProp({ ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), mortgageRate: parseFloat(e.target.value) || 0 } })} placeholder="Es. 3.5" /></div>
                      <div className="field"><label className="indigo">Durata (Anni)</label><input className="input mono" type="number" value={p.financials?.mortgageDuration || ''} onChange={e => setSelectedProp({ ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), mortgageDuration: parseFloat(e.target.value) || 0 } })} placeholder="20" /></div>
                      <div className="field"><label className="indigo">Data Inizio</label><input className="input" type="date" value={p.financials?.mortgageStartDate || ''} onChange={e => setSelectedProp({ ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), mortgageStartDate: e.target.value } })} /></div>
                    </div>
                  </div>
                  {renderSubrogationsSection(p)}
                </div>
                <div>
                  <div className="sectlabel">Dati Locativi e Investimento</div>
                  <div className="grid2">
                    <div className="field"><label>Canone Mensile Affitto (€)</label>
                      <input className="input mono" type="number" value={p.financials?.monthlyRent || ''} 
                        onChange={e => setSelectedProp({ ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), monthlyRent: parseFloat(e.target.value) || 0 } })} 
                        placeholder="Es. 800" />
                    </div>
                    <div className="field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label>Aliquota Tasse (%)</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            className={`badge ${p.financials?.defaultTaxRate === 0 ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                            style={{ fontSize: '10px', padding: '2px 6px', cursor: 'pointer', borderRadius: '4px', border: 'none' }}
                            onClick={() => {
                              const upd = { ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 0 }), defaultTaxRate: 0, taxRegime: 'ESENTE_0' as const } };
                              setSelectedProp(upd);
                              setProperties(prev => prev.map(item => item.id === upd.id ? upd : item));
                            }}
                            title="Comodato d'uso o canone esente (0% IRPEF/Cedolare)"
                          >
                            0% Comodato
                          </button>
                          <button
                            type="button"
                            className={`badge ${p.financials?.defaultTaxRate === 10 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                            style={{ fontSize: '10px', padding: '2px 6px', cursor: 'pointer', borderRadius: '4px', border: 'none' }}
                            onClick={() => {
                              const upd = { ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 10 }), defaultTaxRate: 10, taxRegime: 'CEDOLARE_10' as const } };
                              setSelectedProp(upd);
                              setProperties(prev => prev.map(item => item.id === upd.id ? upd : item));
                            }}
                            title="Canone concordato (10%)"
                          >
                            10%
                          </button>
                          <button
                            type="button"
                            className={`badge ${p.financials?.defaultTaxRate === 21 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                            style={{ fontSize: '10px', padding: '2px 6px', cursor: 'pointer', borderRadius: '4px', border: 'none' }}
                            onClick={() => {
                              const upd = { ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), defaultTaxRate: 21, taxRegime: 'CEDOLARE_21' as const } };
                              setSelectedProp(upd);
                              setProperties(prev => prev.map(item => item.id === upd.id ? upd : item));
                            }}
                            title="Cedolare secca ordinaria (21%)"
                          >
                            21%
                          </button>
                          <button
                            type="button"
                            className={`badge ${p.financials?.taxRegime === 'IRPEF_ORDINARIA' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                            style={{ fontSize: '10px', padding: '2px 6px', cursor: 'pointer', borderRadius: '4px', border: 'none' }}
                            onClick={() => {
                              const marginal = p.financials?.marginalTaxRate ?? 23;
                              const upd = { ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), defaultTaxRate: marginal, taxRegime: 'IRPEF_ORDINARIA' as const, marginalTaxRate: marginal } };
                              setSelectedProp(upd);
                              setProperties(prev => prev.map(item => item.id === upd.id ? upd : item));
                            }}
                            title="IRPEF Ordinaria"
                          >
                            IRPEF
                          </button>
                        </div>
                      </div>
                      <input className="input mono" type="number" min="0" max="100" step="0.5" value={p.financials?.defaultTaxRate ?? ''} 
                        onChange={e => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          let reg: 'ESENTE_0' | 'CEDOLARE_10' | 'CEDOLARE_21' | 'IRPEF_ORDINARIA' = 'CEDOLARE_21';
                          if (val === 0) reg = 'ESENTE_0';
                          else if (val === 10) reg = 'CEDOLARE_10';
                          else if (val === 21) reg = 'CEDOLARE_21';
                          else reg = 'IRPEF_ORDINARIA';
                          const upd = { ...p, financials: { ...(p.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), defaultTaxRate: val, taxRegime: reg, marginalTaxRate: reg === 'IRPEF_ORDINARIA' ? val : (p.financials?.marginalTaxRate ?? 23) } };
                          setSelectedProp(upd);
                          setProperties(prev => prev.map(item => item.id === upd.id ? upd : item));
                        }} 
                        placeholder="Es. 0 o 21" />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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

            <div className="panel pad">
              {renderSubrogationsSection(p)}
            </div>
          </div>

          <div className="econside">
            <div className="rentw">
              <div className="glow" />
              <div className="rhead">
                <span className="zap">{ic(PATH.zap, 16, 2.2)}</span>
                <span className="micro accent">Ottimizzazione Affitto</span>
              </div>

              {/* Selettore Regime Fiscale */}
              <div style={{ marginBottom: '14px' }}>
                <div className="micro accent" style={{ marginBottom: '8px', fontSize: '9.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Regime Fiscale di Default</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: 600, color: 'var(--dim)' }}>
                    Aliquota: {rentWidgetData.taxRate}%
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  {/* 🟢 0% - Comodato d'uso / Esente */}
                  <button
                    type="button"
                    className={`regime-btn ${rentWidgetData.taxRegime === 'ESENTE_0' ? 'active-esente' : ''}`}
                    onClick={() => handleUpdateTaxRegime('ESENTE_0')}
                    title="0% - Comodato d'uso / Esente da tassazione"
                  >
                    <span className="regime-dot" style={{ background: '#10b981' }} />
                    <div className="regime-text">
                      <span className="regime-val">🟢 0% Esente</span>
                      <span className="regime-sub">Comodato d'uso</span>
                    </div>
                  </button>

                  {/* 🔵 10% - Cedolare Concordata (3+2) */}
                  <button
                    type="button"
                    className={`regime-btn ${rentWidgetData.taxRegime === 'CEDOLARE_10' ? 'active-concordata' : ''}`}
                    onClick={() => handleUpdateTaxRegime('CEDOLARE_10')}
                    title="10% - Cedolare Concordata (3+2)"
                  >
                    <span className="regime-dot" style={{ background: '#3b82f6' }} />
                    <div className="regime-text">
                      <span className="regime-val">🔵 10% Concordata</span>
                      <span className="regime-sub">Cedolare (3+2)</span>
                    </div>
                  </button>

                  {/* 🟣 21% - Cedolare Libera (4+4) */}
                  <button
                    type="button"
                    className={`regime-btn ${rentWidgetData.taxRegime === 'CEDOLARE_21' ? 'active-libera' : ''}`}
                    onClick={() => handleUpdateTaxRegime('CEDOLARE_21')}
                    title="21% - Cedolare Libera (4+4)"
                  >
                    <span className="regime-dot" style={{ background: '#8b5cf6' }} />
                    <div className="regime-text">
                      <span className="regime-val">🟣 21% Libera</span>
                      <span className="regime-sub">Cedolare (4+4)</span>
                    </div>
                  </button>

                  {/* 🟠 IRPEF Ordinaria */}
                  <button
                    type="button"
                    className={`regime-btn ${rentWidgetData.taxRegime === 'IRPEF_ORDINARIA' ? 'active-irpef' : ''}`}
                    onClick={() => handleUpdateTaxRegime('IRPEF_ORDINARIA')}
                    title="IRPEF Ordinaria (con aliquota marginale personalizzata)"
                  >
                    <span className="regime-dot" style={{ background: '#f97316' }} />
                    <div className="regime-text">
                      <span className="regime-val">🟠 {rentWidgetData.marginalTaxRate}% IRPEF</span>
                      <span className="regime-sub">Ord. Marginale</span>
                    </div>
                  </button>
                </div>

                {/* Scelta Aliquota Marginale Personalizzata per IRPEF Ordinaria */}
                {rentWidgetData.taxRegime === 'IRPEF_ORDINARIA' && (
                  <div className="irpef-custom-box">
                    <div className="irpef-head">
                      <span style={{ fontWeight: 600 }}>Aliquota Marginale IRPEF:</span>
                      <div className="irpef-presets">
                        {[23, 35, 43].map(rate => (
                          <button
                            key={rate}
                            type="button"
                            className={`irpef-pill ${rentWidgetData.marginalTaxRate === rate ? 'active' : ''}`}
                            onClick={() => handleUpdateTaxRegime('IRPEF_ORDINARIA', rate, true)}
                            title={`Aliquota IRPEF ${rate}%`}
                          >
                            {rate}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="irpef-input-row">
                      <span className="micro" style={{ fontSize: '9px' }}>Personalizzata:</span>
                      <div className="irpef-input-wrap">
                        <input
                          type="number"
                          min="0"
                          max="90"
                          step="1"
                          value={rentWidgetData.marginalTaxRate || ''}
                          onChange={e => {
                            const val = e.target.value === '' ? 0 : Math.min(95, Math.max(0, parseFloat(e.target.value) || 0));
                            handleUpdateTaxRegime('IRPEF_ORDINARIA', val, false);
                          }}
                          onBlur={() => {
                            if (selectedProp) db.saveProperty(selectedProp);
                          }}
                          className="input mono irpef-input"
                          placeholder="es. 35"
                        />
                        <span className="irpef-pct">%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Parametri Spese e Margine */}
              <div className="rline">
                <div>
                  <div className="rl1">Spese Totali Stimate</div>
                  {rentWidgetData.oneOffExpenses > 0 && (
                    <div className="rl2">
                      Fisse € {Math.round(rentWidgetData.fixedExpenses)}/m · Var. € {Math.round(rentWidgetData.oneOffExpenses)}/m
                    </div>
                  )}
                </div>
                <span className="num">{eur(rentWidgetData.totalExpenses)}<span className="per">/m</span></span>
              </div>

              <div className="rline">
                <div className="rl1">Margine Target Netto</div>
                <span className="num accent">
                  <input
                    className="margin-in"
                    type="number"
                    value={selectedProp?.financials?.targetMargin || 0}
                    onChange={e => {
                      if (!selectedProp) return;
                      const val = parseFloat(e.target.value) || 0;
                      const updated = {
                        ...selectedProp,
                        financials: { ...(selectedProp.financials || { mortgageAmount: 0, condoFees: 0, defaultTaxRate: 21 }), targetMargin: val }
                      };
                      setSelectedProp(updated);
                      setProperties(prev => prev.map(p => p.id === updated.id ? updated : p));
                    }}
                    onBlur={() => {
                      if (selectedProp) db.saveProperty(selectedProp);
                    }}
                  />%
                </span>
              </div>

              {/* Canone Consigliato Totale */}
              <div className="rbig">
                <div className="micro accent">Canone Consigliato Lordo</div>
                <div className="n">{eur(rentWidgetData.suggestedRent)}<span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--faint)', marginLeft: '4px' }}>/m</span></div>
              </div>

              {/* Split del Canone: Canone Base (Mutuo + Utile) vs Quota Spese (Gestione + Tasse) */}
              <div className="rent-split-hero">
                <div className="split-badge-item base">
                  <div className="sbi-top">
                    <span className="sbi-icon">🏦</span>
                    <span className="sbi-lbl">Canone Base</span>
                  </div>
                  <div className="sbi-val">{eur(rentWidgetData.baseRentShare)}<span className="sbi-per">/m</span></div>
                  <div className="sbi-sublist">
                    <div className="sbi-subrow">
                      <span>Rata Mutuo{rentWidgetData.isSubrogated ? ' (Surroga)' : ''}</span>
                      <span>{rentWidgetData.mortgageMonthly > 0 ? `${eur(rentWidgetData.mortgageMonthly)}/m` : 'Nessun Mutuo'}</span>
                    </div>
                    {rentWidgetData.netProfit > 0 && (
                      <div className="sbi-subrow">
                        <span>Margine Netto</span>
                        <span style={{ color: 'var(--pos)' }}>+{eur(rentWidgetData.netProfit)}/m</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="split-plus">+</div>

                <div className="split-badge-item exp">
                  <div className="sbi-top">
                    <span className="sbi-icon">🏢</span>
                    <span className="sbi-lbl">Quota Spese</span>
                  </div>
                  <div className="sbi-val">{eur(rentWidgetData.expensesShare)}<span className="sbi-per">/m</span></div>
                  <div className="sbi-sublist">
                    <div className="sbi-subrow">
                      <span>Gestione & Cond.</span>
                      <span>{eur(rentWidgetData.operatingExpenses)}/m</span>
                    </div>
                    <div className="sbi-subrow">
                      <span>Tasse ({rentWidgetData.taxRate}%)</span>
                      <span style={{ color: '#fb923c' }}>{eur(rentWidgetData.estimatedTax)}/m</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra proporzionale di composizione del canone */}
              {rentWidgetData.suggestedRent > 0 && (
                <div className="rent-split-bar" title="Composizione del Canone Consigliato">
                  <div 
                    className="rsb-seg base" 
                    style={{ width: `${Math.max(0, (rentWidgetData.mortgageMonthly / rentWidgetData.suggestedRent) * 100)}%` }} 
                    title={`Mutuo: ${eur(rentWidgetData.mortgageMonthly)}/m`} 
                  />
                  <div 
                    className="rsb-seg exp" 
                    style={{ width: `${Math.max(0, (rentWidgetData.operatingExpenses / rentWidgetData.suggestedRent) * 100)}%` }} 
                    title={`Spese Gestione: ${eur(rentWidgetData.operatingExpenses)}/m`} 
                  />
                  <div 
                    className="rsb-seg tax" 
                    style={{ width: `${Math.max(0, (rentWidgetData.estimatedTax / rentWidgetData.suggestedRent) * 100)}%` }} 
                    title={`Tasse (${rentWidgetData.taxRate}%): ${eur(rentWidgetData.estimatedTax)}/m`} 
                  />
                  <div 
                    className="rsb-seg margin" 
                    style={{ width: `${Math.max(0, (rentWidgetData.netProfit / rentWidgetData.suggestedRent) * 100)}%` }} 
                    title={`Margine Netto: ${eur(rentWidgetData.netProfit)}/m`} 
                  />
                </div>
              )}

              {/* Dettaglio Ripartizione Canone Consigliato */}
              <div className="rfoot">
                <div className="sectlabel" style={{ marginBottom: '4px', fontSize: '9px' }}>Ripartizione Analitica Canone</div>
                <div className="l">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--indigo)' }}>🏦</span>
                    <span>Quota Base Copertura Mutuo{rentWidgetData.isSubrogated ? ` (${rentWidgetData.activeBankName || 'Surroga'})` : ''}</span>
                  </span>
                  <span className="num">{eur(rentWidgetData.mortgageMonthly)}/m</span>
                </div>
                <div className="l">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--accent)' }}>🏢</span>
                    <span>Quota Spese (Condominio / Gestione)</span>
                  </span>
                  <span className="num">{eur(rentWidgetData.operatingExpenses)}/m</span>
                </div>
                <div className="l">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#fb923c' }}>🏛️</span>
                    <span>Accantonamento Tasse ({rentWidgetData.taxRate}%)</span>
                  </span>
                  <span className="num" style={{ color: '#fb923c' }}>+{eur(rentWidgetData.estimatedTax)}/m</span>
                </div>
                <div className="l">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--pos)' }}>📈</span>
                    <span>Margine Netto Desiderato (+{rentWidgetData.marginPercent}%)</span>
                  </span>
                  <span className="num pos">+{eur(rentWidgetData.netProfit)}/m</span>
                </div>
                <div className="l" style={{ borderTop: '1px dashed var(--border-2)', paddingTop: '8px', marginTop: '2px', fontWeight: 600 }}>
                  <span style={{ color: 'var(--text)' }}>🎯 Totale Canone Consigliato</span>
                  <span className="num accent" style={{ fontSize: '13px' }}>{eur(rentWidgetData.suggestedRent)}/m</span>
                </div>
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
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn radar-open-btn"
            onClick={() => (document.getElementById('mortgage_radar_modal') as any)?.showModal()}
          >
            📡 Radar Tassi &amp; Banche Milano
            {portfolioRadarReport.advantageousCount > 0 && (
              <span className="radar-count-pill">{portfolioRadarReport.advantageousCount}</span>
            )}
          </button>
          <button className="btn primary" onClick={() => { setNewPropData({ name: '', address: '', type: 'RESIDENTIAL', status: 'MAIN_RESIDENCE', purchasePrice: 0, currentValue: 0, notes: '', coordinates: { lat: 0, lng: 0 } }); (document.getElementById('new_property_modal') as any)?.showModal(); }}>{ic(PATH.plus, 15, 2.4)} Aggiungi Immobile</button>
        </div>
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

      {/* Banner Opportunità Surroga Mutui se sono presenti mutui attivi */}
      {portfolioRadarReport.propertiesAnalyzedCount > 0 && (
        <div className={`radar-portfolio-banner ${portfolioRadarReport.advantageousCount > 0 ? 'has-adv' : ''}`}>
          <div className="rpb-left">
            <span className="rpb-icon">🏦</span>
            <div>
              <div className="rpb-title">
                {portfolioRadarReport.advantageousCount > 0
                  ? `🔥 Radar Mutui (Banche Italia & Milano): ${portfolioRadarReport.advantageousCount} ${portfolioRadarReport.advantageousCount === 1 ? 'Offerta Vantaggiosa Rilevata' : 'Offerte Vantaggiose Rilevate'}!`
                  : `📡 Radar Mutui Attivo su ${portfolioRadarReport.propertiesAnalyzedCount} immobili (${portfolioRadarReport.banksMonitoredCount} banche monitorate)`}
              </div>
              <div className="rpb-desc">
                {portfolioRadarReport.advantageousCount > 0
                  ? `Risparmio potenziale complessivo tramite surroga a zero spese: +${eur(portfolioRadarReport.totalPotentialMonthlySavings)}/mese (+${eur(portfolioRadarReport.totalPotentialAnnualSavings)}/anno · +${eur(portfolioRadarReport.totalPotentialRemainingSavings)} a scadenza)`
                  : `Indici attuali: IRS 20A ${marketIndices.irs20Y.toFixed(2)}% · IRS 25A ${marketIndices.irs25Y.toFixed(2)}% · Euribor 3M ${marketIndices.euribor3M.toFixed(2)}% · BCE ${marketIndices.bceRate.toFixed(2)}%`}
              </div>
            </div>
          </div>
          <div className="rpb-actions">
            <button
              type="button"
              className="sc-btn"
              onClick={() => (document.getElementById('mortgage_radar_modal') as any)?.showModal()}
            >
              📊 Confronta Banche
            </button>
            <button
              type="button"
              className="sc-btn tg-btn"
              onClick={() => handleSendRadarTelegramReport()}
              disabled={isSendingRadarTg}
            >
              {isSendingRadarTg ? '⏳ Invio...' : '✈️ Invia Report su Telegram'}
            </button>
          </div>
        </div>
      )}

      {radarFeedback && (
        <div className={`radar-feedback ${radarFeedback.type}`}>
          <span>{radarFeedback.message}</span>
          <button type="button" onClick={() => setRadarFeedback(null)}>✕</button>
        </div>
      )}

      {properties.length === 0 ? (
        <div className="emptystate">{ic(PATH.building, 40, 1.4)}<p className="t">Nessun immobile in portafoglio</p><p className="s">Fai clic su "Aggiungi Immobile" per iniziare a tracciare i tuoi asset</p></div>
      ) : (
        <div className="cards">
          {properties.map(p => {
            const ms = calculateMortgageStats(p); const gain = safeNum(p.currentValue) - safeNum(p.purchasePrice);
            const code = (p.name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            const propOpp = portfolioRadarReport.opportunities.find(o => o.propertyId === p.id);
            return (
              <div className="card" key={p.id} onClick={() => { setSelectedProp(p); resetSubForm(p); setActiveTab('ANAGRAFICA'); setFilterCategory('ALL'); }}>
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
                    <div className="mt">
                      <span className="micro indigo">Stato Mutuo{ms.isSubrogated ? ` · Surrogato${ms.bankName ? ` (${ms.bankName})` : ''}` : ''}</span>
                      <span className="num indigo sm">{ms.percent.toFixed(0)}%</span>
                    </div>
                    <div className="bar"><i style={{ width: `${ms.percent}%` }} /></div>
                    <div className="mfoot">
                      <div><div className="micro xs">Versato</div><div className="num sm">{eur(ms.paid)}</div></div>
                      <div className="r"><div className="micro xs">Residuo</div><div className="num sm">{eur(ms.remaining)}</div></div>
                    </div>
                    {propOpp?.isAdvantageous && propOpp.bestOffer && (
                      <div className="mort-adv-tag">
                        🔥 Surroga consigliata: <strong>-{eur(propOpp.bestOffer.monthlySavings)}/m</strong> ({propOpp.bestOffer.offer.bankName.split('(')[0].trim()} · {propOpp.bestOffer.appliedTan.toFixed(2)}%)
                      </div>
                    )}
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

      {/* Modal Radar Mutui & Banche (Italia & Milano) */}
      <dialog id="mortgage_radar_modal" className="ipb-modal radar-wide-modal">
        <div className="mhead">
          <div>
            <h3>📡 Radar Tassi Mutui &amp; Surroghe (Banche Italia &amp; Milano)</h3>
            <p>Monitoraggio automatico tassi IRS/Euribor, confronto coi tuoi mutui e invio report su Telegram</p>
          </div>
          <button className="mclose" onClick={() => (document.getElementById('mortgage_radar_modal') as any)?.close()}>✕</button>
        </div>
        <div className="mbody" style={{ maxHeight: '78vh', overflowY: 'auto' }}>
          {/* Barra Indici & Azioni Rapide */}
          <div className="radar-indices-strip">
            <span className="ri-item">📊 <strong>IRS 10A:</strong> {marketIndices.irs10Y.toFixed(2)}%</span>
            <span className="ri-item"><strong>IRS 20A:</strong> {marketIndices.irs20Y.toFixed(2)}%</span>
            <span className="ri-item"><strong>IRS 25A:</strong> {marketIndices.irs25Y.toFixed(2)}%</span>
            <span className="ri-item"><strong>Euribor 3M:</strong> {marketIndices.euribor3M.toFixed(2)}%</span>
            <span className="ri-item"><strong>BCE:</strong> {marketIndices.bceRate.toFixed(2)}%</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="sc-btn"
                onClick={() => handleRefreshBankRates(true)}
                disabled={isScanningRates}
              >
                {isScanningRates ? '⏳ Aggiornamento...' : '🔍 Aggiorna Tassi Live (AI)'}
              </button>
              <button
                type="button"
                className="sc-btn tg-btn"
                onClick={() => handleSendRadarTelegramReport()}
                disabled={isSendingRadarTg}
              >
                {isSendingRadarTg ? '⏳ Invio...' : '✈️ Invia Report su Telegram'}
              </button>
            </div>
          </div>

          {radarFeedback && (
            <div className={`radar-feedback ${radarFeedback.type}`}>
              <span>{radarFeedback.message}</span>
              <button type="button" onClick={() => setRadarFeedback(null)}>✕</button>
            </div>
          )}

          {/* Soglie di Configurazione Alert */}
          <div className="radar-config-bar" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Risparmio Minimo Alert (€/mese)</label>
              <input
                type="number"
                className="input mono"
                style={{ padding: '8px 10px', fontSize: 12 }}
                value={radarSettings.minMonthlySavings}
                onChange={e => handleSaveRadarThresholds({ ...radarSettings, minMonthlySavings: Math.max(0, isNaN(parseFloat(e.target.value)) ? 0 : parseFloat(e.target.value)) })}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Riduzione Tasso Minima (bps, 25 = 0.25%)</label>
              <input
                type="number"
                className="input mono"
                style={{ padding: '8px 10px', fontSize: 12 }}
                value={radarSettings.minRateDeltaBps}
                onChange={e => handleSaveRadarThresholds({ ...radarSettings, minRateDeltaBps: Math.max(0, isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10)) })}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Preferenza Tasso</label>
              <select
                className="input"
                style={{ padding: '8px 10px', fontSize: 12 }}
                value={radarSettings.preferredRateType}
                onChange={e => handleSaveRadarThresholds({ ...radarSettings, preferredRateType: e.target.value as any })}
              >
                <option value="ALL">Fisso &amp; Variabile</option>
                <option value="FIXED">Solo Tasso Fisso</option>
                <option value="VARIABLE">Solo Tasso Variabile</option>
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Chat ID Telegram (Opz.)</label>
              <input
                type="text"
                className="input mono"
                style={{ padding: '8px 10px', fontSize: 12 }}
                placeholder="Default: Chat ID Proprietario"
                value={radarSettings.recipientChatId || ''}
                onChange={e => handleSaveRadarThresholds({ ...radarSettings, recipientChatId: e.target.value || undefined })}
              />
            </div>
            <div className="field" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, paddingTop: 14 }}>
              <input
                type="checkbox"
                checked={radarSettings.autoTelegramAlert}
                onChange={e => handleSaveRadarThresholds({ ...radarSettings, autoTelegramAlert: e.target.checked })}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 11.5, fontWeight: 600 }}>Notifica Automatica Telegram</span>
            </div>
          </div>

          {/* Elenco Opportunità per Immobile */}
          {portfolioRadarReport.opportunities.length === 0 ? (
            <div className="empty-sm" style={{ border: '1px dashed var(--border-2)', borderRadius: 10 }}>
              Nessun mutuo attivo rilevato sugli immobili in portafoglio. Configura i dati del mutuo nella scheda Anagrafica di un immobile per attivare il confronto automatico.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {portfolioRadarReport.opportunities.map(opp => {
                const best = opp.bestOffer;
                return (
                  <div key={opp.propertyId} className={`subrog-card ${opp.isAdvantageous ? 'current' : ''}`}>
                    <div className="sc-top">
                      <div>
                        <div className="sc-bank">
                          🏠 {opp.propertyName}
                          {opp.isGreenProperty && <span className="rt-tag green">🌿 Classe {opp.energyClass}</span>}
                          {opp.isAdvantageous ? (
                            <span className="radar-badge-hot">🔥 Surroga Vantaggiosa</span>
                          ) : (
                            <span className="sc-ratetype">Tasso già competitivo</span>
                          )}
                        </div>
                        <div className="sc-date">
                          Mutuo attuale: <strong>{opp.currentBankName}</strong> · Rata <strong>{eur(opp.currentMonthlyPayment)}/mese</strong> · TAN <strong>{opp.currentRate.toFixed(2)}%</strong> · Durata residua {opp.remainingYears} anni (Cap. stimato {eur(opp.estimatedResidualPrincipal)})
                        </div>
                      </div>
                      <button
                        type="button"
                        className="sc-btn edit"
                        onClick={() => {
                          const targetProp = properties.find(x => x.id === opp.propertyId);
                          if (targetProp) {
                            (document.getElementById('mortgage_radar_modal') as any)?.close();
                            setSelectedProp(targetProp);
                            resetSubForm(targetProp);
                            if (best) handleApplyOfferToSubForm(best, opp.remainingYears, opp.estimatedResidualPrincipal);
                            setActiveTab('ANAGRAFICA');
                          }
                        }}
                      >
                        ⚡ Apri &amp; Simula Surroga
                      </button>
                    </div>

                    {best && (
                      <div className="sc-metrics">
                        <div className="scm-box">
                          <span className="scm-l">Migliore Banca ({best.offer.hqCity.split('(')[0].trim()})</span>
                          <span className="scm-v">{best.offer.bankName.split('(')[0].trim()} · {best.appliedTan.toFixed(2)}%</span>
                        </div>
                        <div className="scm-box">
                          <span className="scm-l">Nuova Rata Stimata</span>
                          <span className="scm-v indigo">{eur(best.newMonthlyPayment)}/mese (-{best.rateDeltaBps} bps)</span>
                        </div>
                        <div className="scm-box">
                          <span className="scm-l">Risparmio Mensile / Annuo</span>
                          <span className={`scm-v ${best.monthlySavings >= 0 ? 'pos' : 'neg'}`}>
                            {seur(best.monthlySavings)}/m · {seur(best.annualSavings)}/a
                          </span>
                        </div>
                        <div className="scm-box">
                          <span className="scm-l">Risparmio Totale ({opp.remainingYears}a)</span>
                          <span className={`scm-v ${best.totalRemainingSavings >= 0 ? 'pos' : 'neg'}`}>
                            {seur(best.totalRemainingSavings)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </dialog>

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

/* subrogations & renegotiations */
.ipb .subrog-wrap{ background:var(--inset); border:1px solid var(--border-2); border-radius:var(--r-lg); padding:16px; display:flex; flex-direction:column; gap:14px; margin-top:12px; }
.ipb .subrog-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.ipb .subrog-status-pill{ font-family:var(--mono); font-size:9px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; padding:4px 9px; border-radius:99px; background:var(--pos-soft); color:var(--pos); border:1px solid rgba(47,214,163,.3); }
.ipb .subrog-status-pill.orig{ background:var(--indigo-soft); color:var(--indigo); border-color:rgba(139,139,255,.3); }
.ipb .subrog-hero-banner{ display:grid; grid-template-columns:1fr auto 1fr 1fr; align-items:center; gap:12px; padding:12px 14px; background:var(--panel); border:1px solid var(--border); border-left:3px solid var(--pos); border-radius:var(--r-sm); }
.ipb .subrog-hero-banner .shb-col{ display:flex; flex-direction:column; gap:3px; min-width:0; }
.ipb .subrog-hero-banner .shb-col.sav{ padding-left:12px; border-left:1px dashed var(--border-2); }
.ipb .subrog-hero-banner .shb-lbl{ font-family:var(--mono); font-size:8.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); }
.ipb .subrog-hero-banner .shb-val{ font-family:var(--mono); font-size:14.5px; font-weight:700; color:var(--text); }
.ipb .subrog-hero-banner .shb-val.dim{ color:var(--dim); }
.ipb .subrog-hero-banner .shb-val.indigo{ color:var(--indigo); }
.ipb .subrog-hero-banner .shb-val.pos{ color:var(--pos); }
.ipb .subrog-hero-banner .shb-val.neg{ color:var(--neg); }
.ipb .subrog-hero-banner .shb-sub{ font-family:var(--mono); font-size:10px; color:var(--dim); }
.ipb .subrog-hero-banner .shb-arrow{ font-family:var(--mono); font-size:14px; color:var(--faint); display:flex; align-items:center; justify-content:center; }
.ipb .subrog-timeline{ display:flex; flex-direction:column; gap:10px; }
.ipb .subrog-card{ background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; gap:10px; transition:border-color .15s; }
.ipb .subrog-card.current,.ipb .subrog-card.active{ border-color:var(--indigo); box-shadow:0 0 0 1px var(--indigo-soft); }
.ipb .subrog-card .sc-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.ipb .subrog-card .sc-title,.ipb .subrog-card .sc-left{ display:flex; align-items:flex-start; gap:10px; min-width:0; }
.ipb .subrog-card .sc-step{ width:26px; height:26px; border-radius:7px; background:var(--inset); border:1px solid var(--border); color:var(--dim); font-family:var(--mono); font-size:10px; font-weight:700; display:grid; place-items:center; flex:none; margin-top:1px; }
.ipb .subrog-card .sc-step.indigo{ background:var(--indigo-soft); border-color:transparent; color:var(--indigo); }
.ipb .subrog-card .sc-bank{ font-size:13px; font-weight:700; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.ipb .subrog-card .sc-ratetype{ font-family:var(--mono); font-size:8.5px; font-weight:600; text-transform:uppercase; padding:2px 6px; border-radius:4px; background:var(--inset); border:1px solid var(--border); color:var(--dim); }
.ipb .subrog-card .sc-date{ font-family:var(--mono); font-size:10px; color:var(--dim); margin-top:3px; line-height:1.4; }
.ipb .subrog-card .sc-right{ display:flex; align-items:center; gap:8px; flex-shrink:0; }
.ipb .subrog-card .sc-pay{ font-family:var(--mono); font-size:14px; font-weight:700; color:var(--text); }
.ipb .subrog-card .sc-pay.indigo{ color:var(--indigo); }
.ipb .subrog-card .sc-pay small{ font-size:10px; font-weight:500; color:var(--faint); margin-left:2px; }
.ipb .subrog-card .sc-badge{ font-family:var(--mono); font-size:8.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; padding:3px 7px; border-radius:5px; }
.ipb .subrog-card .sc-badge.b-act,.ipb .subrog-card .sc-badge.act{ background:var(--pos-soft); color:var(--pos); }
.ipb .subrog-card .sc-badge.b-up,.ipb .subrog-card .sc-badge.fut{ background:var(--warn-soft); color:var(--warn); }
.ipb .subrog-card .sc-badge.b-hist{ background:var(--inset); color:var(--faint); border:1px solid var(--border); }
.ipb .subrog-card .sc-metrics,.ipb .subrog-card .sc-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; padding-top:9px; border-top:1px dashed var(--border-2); }
.ipb .subrog-card .scm-box,.ipb .subrog-card .sc-cell{ display:flex; flex-direction:column; gap:2px; background:var(--inset); border:1px solid var(--border); border-radius:7px; padding:7px 9px; }
.ipb .subrog-card .scm-l,.ipb .subrog-card .sc-lbl{ font-family:var(--mono); font-size:8px; letter-spacing:.08em; text-transform:uppercase; color:var(--faint); }
.ipb .subrog-card .scm-v,.ipb .subrog-card .sc-val{ font-family:var(--mono); font-size:11.5px; font-weight:600; color:var(--text); }
.ipb .subrog-card .scm-v.dim{ color:var(--dim); }
.ipb .subrog-card .scm-v.pos,.ipb .subrog-card .sc-val.pos{ color:var(--pos); }
.ipb .subrog-card .scm-v.neg,.ipb .subrog-card .sc-val.neg{ color:var(--neg); }
.ipb .subrog-card .sc-foot{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding-top:8px; border-top:1px solid var(--border); flex-wrap:wrap; }
.ipb .subrog-card .sc-notes{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:11px; color:var(--dim); }
.ipb .subrog-card .sc-att{ display:inline-flex; align-items:center; gap:5px; font-family:var(--mono); font-size:10px; font-weight:600; color:var(--accent); background:var(--accent-soft); padding:3px 8px; border-radius:6px; text-decoration:none; }
.ipb .subrog-card .sc-att:hover{ filter:brightness(1.1); }
.ipb .subrog-card .sc-actions{ display:flex; align-items:center; gap:6px; margin-left:auto; }
.ipb .sc-btn{ border:1px solid var(--border); background:var(--inset); color:var(--dim); font-family:var(--mono); font-size:9.5px; font-weight:600; padding:5px 9px; border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all .15s; }
.ipb .sc-btn:hover{ color:var(--text); border-color:var(--border-2); }
.ipb .sc-btn.edit:hover{ color:var(--indigo); border-color:var(--indigo); background:var(--indigo-soft); }
.ipb .sc-btn.del:hover{ color:var(--neg); border-color:var(--neg); background:var(--neg-soft); }
.ipb .subrog-form{ background:var(--panel); border:1px dashed var(--border-2); border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:10px; }
.ipb .subrog-form .sf-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; font-family:var(--mono); font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--indigo); margin-bottom:2px; }
.ipb .subrog-file-btn{ display:flex; align-items:center; justify-content:center; gap:6px; width:100%; height:42px; background:var(--inset); border:1px dashed var(--border-2); border-radius:10px; font-family:var(--mono); font-size:11px; font-weight:600; color:var(--dim); cursor:pointer; padding:0 10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ipb .subrog-file-btn:hover{ border-color:var(--accent); color:var(--accent); }

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

.ipb .regime-btn {
  display: flex; align-items: center; gap: 8px; background: var(--inset); border: 1px solid var(--border);
  border-radius: var(--r-sm); padding: 7px 9px; cursor: pointer; text-align: left; transition: all 0.18s ease;
  color: var(--text); width: 100%;
}
.ipb .regime-btn:hover { border-color: var(--border-2); background: var(--panel-2); }
.ipb .regime-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.ipb .regime-text { display: flex; flex-direction: column; min-width: 0; }
.ipb .regime-val { font-family: var(--mono); font-size: 10.5px; font-weight: 700; line-height: 1.2; }
.ipb .regime-sub { font-size: 8.5px; color: var(--dim); line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ipb .regime-btn.active-esente { background: rgba(16, 185, 129, 0.14); border-color: #10b981; }
.ipb .regime-btn.active-esente .regime-val { color: #10b981; }
.ipb .regime-btn.active-concordata { background: rgba(59, 130, 246, 0.14); border-color: #3b82f6; }
.ipb .regime-btn.active-concordata .regime-val { color: #3b82f6; }
.ipb .regime-btn.active-libera { background: rgba(139, 92, 246, 0.14); border-color: #8b5cf6; }
.ipb .regime-btn.active-libera .regime-val { color: #a78bfa; }
.ipb .regime-btn.active-irpef { background: rgba(249, 115, 22, 0.14); border-color: #f97316; }
.ipb .regime-btn.active-irpef .regime-val { color: #fb923c; }

.ipb .irpef-custom-box {
  margin-top: 8px; padding: 10px 12px; background: var(--inset); border: 1px dashed rgba(249, 115, 22, 0.4);
  border-radius: 9px; display: flex; flex-direction: column; gap: 8px;
}
.ipb .irpef-head { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--dim); }
.ipb .irpef-presets { display: flex; gap: 5px; }
.ipb .irpef-pill {
  border: 1px solid var(--border); background: var(--panel); color: var(--text); font-family: var(--mono);
  font-size: 10px; font-weight: 600; padding: 3px 7px; border-radius: 5px; cursor: pointer; transition: all 0.15s;
}
.ipb .irpef-pill:hover { border-color: #f97316; color: #fb923c; }
.ipb .irpef-pill.active { background: #f97316; color: #fff; border-color: #f97316; }
.ipb .irpef-input-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ipb .irpef-input-wrap { position: relative; display: inline-flex; align-items: center; }
.ipb .irpef-input { width: 68px; padding: 4px 18px 4px 8px; font-size: 12px; height: 28px; text-align: right; border-color: rgba(249, 115, 22, 0.3); }
.ipb .irpef-pct { position: absolute; right: 6px; font-family: var(--mono); font-size: 10.5px; color: var(--faint); pointer-events: none; }

.ipb .rent-split-hero {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; margin: 10px 0 8px;
  padding: 10px 12px; background: var(--inset); border: 1px solid var(--border-2); border-radius: 12px;
}
.ipb .split-badge-item {
  display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: 8px; background: var(--panel);
  border: 1px solid var(--border);
}
.ipb .split-badge-item.base { border-left: 3px solid var(--indigo); }
.ipb .split-badge-item.exp { border-left: 3px solid var(--accent); }
.ipb .sbi-top { display: flex; align-items: center; gap: 5px; }
.ipb .sbi-icon { font-size: 11px; }
.ipb .sbi-lbl { font-family: var(--mono); font-size: 8.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); }
.ipb .sbi-val { font-family: var(--mono); font-size: 15px; font-weight: 700; color: var(--text); }
.ipb .sbi-per { font-size: 10px; color: var(--faint); font-weight: 500; }
.ipb .sbi-sublist { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; border-top: 1px dashed var(--border-2); padding-top: 4px; }
.ipb .sbi-subrow { display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; color: var(--dim); }
.ipb .sbi-subrow span:last-child { font-family: var(--mono); font-weight: 600; color: var(--text); }
.ipb .split-plus { font-family: var(--mono); font-size: 15px; font-weight: 700; color: var(--faint); display: flex; align-items: center; justify-content: center; }

.ipb .rent-split-bar {
  display: flex; height: 6px; border-radius: 99px; overflow: hidden; margin: 4px 0 10px;
  background: var(--inset); border: 1px solid var(--border);
}
.ipb .rsb-seg { height: 100%; transition: width 0.25s ease; }
.ipb .rsb-seg.base { background: var(--indigo); }
.ipb .rsb-seg.exp { background: var(--accent); }
.ipb .rsb-seg.tax { background: #fb923c; }
.ipb .rsb-seg.margin { background: var(--pos); }

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
.ipb-modal.radar-wide-modal{ max-width:960px; }
.ipb-modal::backdrop{ background:rgba(4,7,14,.6); backdrop-filter:blur(3px); }
.ipb-modal .mhead{ display:flex; align-items:center; justify-content:space-between; padding:20px 22px; border-bottom:1px solid var(--border); }
.ipb-modal .mhead h3{ margin:0; font-size:16px; font-weight:700; } .ipb-modal .mhead p{ margin:3px 0 0; font-size:11px; color:var(--faint); }
.ipb-modal .mclose{ width:34px; height:34px; border-radius:9px; border:1px solid var(--border); background:var(--inset); color:var(--dim); cursor:pointer; font-size:14px; }
.ipb-modal .mclose:hover{ color:var(--neg); border-color:var(--neg); }
.ipb-modal .mbody{ padding:22px; display:grid; gap:14px; }

/* radar tassi banche & surroghe */
.ipb .radar-open-btn{ background:var(--indigo-soft); color:var(--indigo); border:1px solid rgba(139,139,255,.35); }
.ipb .radar-open-btn:hover{ background:var(--indigo); color:#fff; }
.ipb .radar-count-pill{ background:var(--pos); color:#052e16; font-family:var(--mono); font-size:10px; font-weight:800; padding:2px 6px; border-radius:99px; }
.ipb .radar-portfolio-banner{ display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px 18px; background:var(--panel); border:1px solid var(--border-2); border-left:4px solid var(--indigo); border-radius:var(--r); flex-wrap:wrap; }
.ipb .radar-portfolio-banner.has-adv{ border-left-color:var(--pos); background:linear-gradient(90deg,var(--pos-soft),var(--panel)); }
.ipb .radar-portfolio-banner .rpb-left{ display:flex; align-items:center; gap:12px; min-width:0; }
.ipb .radar-portfolio-banner .rpb-icon{ font-size:22px; }
.ipb .radar-portfolio-banner .rpb-title{ font-size:13px; font-weight:700; color:var(--text); }
.ipb .radar-portfolio-banner .rpb-desc{ font-family:var(--mono); font-size:11px; color:var(--dim); margin-top:3px; }
.ipb .radar-portfolio-banner .rpb-actions{ display:flex; gap:8px; flex-wrap:wrap; }
.ipb .mort-adv-tag{ margin-top:8px; padding:5px 8px; border-radius:6px; background:var(--pos-soft); color:var(--pos); font-family:var(--mono); font-size:9.5px; border:1px solid rgba(47,214,163,.25); }

.ipb .radar-box{ background:var(--panel); border:1px solid var(--border-2); border-radius:12px; padding:15px; display:flex; flex-direction:column; gap:12px; }
.ipb .radar-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.ipb .radar-title-row{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.ipb .radar-badge-live{ font-family:var(--mono); font-size:9.5px; font-weight:700; letter-spacing:.08em; padding:3px 8px; border-radius:6px; background:var(--accent-soft); color:var(--accent); }
.ipb .radar-badge-hot{ font-family:var(--mono); font-size:9.5px; font-weight:700; letter-spacing:.06em; padding:3px 8px; border-radius:6px; background:var(--pos-soft); color:var(--pos); border:1px solid rgba(47,214,163,.35); }
.ipb .radar-sub{ font-size:11px; color:var(--dim); margin-top:4px; line-height:1.4; }
.ipb .radar-actions{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.ipb .sc-btn.tg-btn{ background:rgba(14,165,233,.14); color:#38bdf8; border-color:rgba(56,189,248,.35); }
.ipb .sc-btn.tg-btn:hover{ background:#0284c7; color:#fff; border-color:#0284c7; }
.ipb .radar-indices-strip{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:8px 12px; background:var(--inset); border:1px solid var(--border); border-radius:8px; font-family:var(--mono); font-size:10.5px; color:var(--dim); }
.ipb .radar-indices-strip strong{ color:var(--text); }
.ipb .radar-feedback{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 12px; border-radius:8px; font-size:11.5px; font-weight:600; }
.ipb .radar-feedback.success{ background:var(--pos-soft); color:var(--pos); border:1px solid rgba(47,214,163,.35); }
.ipb .radar-feedback.error{ background:var(--neg-soft); color:var(--neg); border:1px solid rgba(251,111,134,.35); }
.ipb .radar-feedback.info{ background:var(--accent-soft); color:var(--accent); border:1px solid rgba(47,143,255,.35); }
.ipb .radar-feedback button{ background:transparent; border:none; color:inherit; cursor:pointer; font-weight:700; }

.ipb .radar-best-callout{ display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px 14px; border-radius:10px; background:var(--inset); border:1px solid var(--border-2); flex-wrap:wrap; }
.ipb .radar-best-callout.adv{ border-left:4px solid var(--pos); background:linear-gradient(90deg,var(--pos-soft),var(--inset)); }
.ipb .radar-best-callout .rbc-eyebrow{ font-family:var(--mono); font-size:9px; font-weight:700; letter-spacing:.1em; color:var(--pos); text-transform:uppercase; }
.ipb .radar-best-callout .rbc-main{ font-size:13px; color:var(--text); margin-top:3px; }
.ipb .radar-best-callout .rbc-city{ font-size:11px; color:var(--dim); }
.ipb .radar-best-callout .rbc-metrics{ font-family:var(--mono); font-size:11px; color:var(--dim); margin-top:4px; display:flex; gap:8px; flex-wrap:wrap; }
.ipb .radar-best-callout .rbc-metrics .pos{ color:var(--pos); }
.ipb .radar-best-callout .rbc-right{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.ipb .radar-best-callout .rbc-sav-box{ display:flex; flex-direction:column; align-items:flex-end; font-family:var(--mono); }
.ipb .radar-best-callout .rbc-sav-lbl{ font-size:8.5px; text-transform:uppercase; color:var(--faint); }
.ipb .radar-best-callout .rbc-sav-val{ font-size:13.5px; font-weight:700; color:var(--pos); }
.ipb .radar-best-callout .rbc-sav-tot{ font-size:10px; color:var(--dim); }

.ipb .radar-filter-bar{ display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.ipb .rf-pills{ display:flex; gap:6px; flex-wrap:wrap; }
.ipb .rf-pill{ border:1px solid var(--border); background:var(--inset); color:var(--dim); font-family:var(--mono); font-size:10px; font-weight:600; padding:5px 10px; border-radius:7px; cursor:pointer; }
.ipb .rf-pill.on{ background:var(--accent); color:#fff; border-color:transparent; }
.ipb .rf-threshold-note{ font-family:var(--mono); font-size:10px; color:var(--dim); }

.ipb .radar-table-wrap{ overflow-x:auto; border:1px solid var(--border); border-radius:9px; background:var(--inset); }
.ipb .radar-table{ width:100%; border-collapse:collapse; font-size:11.5px; text-align:left; }
.ipb .radar-table th{ font-family:var(--mono); font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--faint); padding:9px 10px; border-bottom:1px solid var(--border-2); background:var(--panel); white-space:nowrap; }
.ipb .radar-table td{ padding:9px 10px; border-bottom:1px solid var(--border); vertical-align:middle; }
.ipb .radar-table tr:last-child td{ border-bottom:none; }
.ipb .radar-table tr.row-adv{ background:rgba(47,214,163,.05); }
.ipb .radar-table .rt-bank{ display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:12px; }
.ipb .radar-table .rt-prod{ display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-weight:600; }
.ipb .radar-table .rt-sub{ font-size:10px; color:var(--dim); margin-top:2px; }
.ipb .radar-table .rt-sub-inline{ font-size:10px; color:var(--dim); }
.ipb .radar-table .rt-mono{ font-family:var(--mono); font-size:12px; }
.ipb .radar-table .rt-mono.pos,.ipb .radar-table .rt-delta.pos{ color:var(--pos); }
.ipb .radar-table .rt-mono.neg,.ipb .radar-table .rt-delta.neg{ color:var(--neg); }
.ipb .radar-table .rt-delta{ font-family:var(--mono); font-size:10px; margin-top:2px; }
.ipb .rt-tag{ font-family:var(--mono); font-size:8.5px; font-weight:700; padding:2px 5px; border-radius:4px; text-transform:uppercase; }
.ipb .rt-tag.milan{ background:var(--indigo-soft); color:var(--indigo); }
.ipb .rt-tag.green{ background:var(--pos-soft); color:var(--pos); }
.ipb .rt-tag.adv-pill{ display:inline-block; margin-top:2px; background:var(--pos-soft); color:var(--pos); }
.ipb .radar-config-bar{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; padding:12px; background:var(--inset); border:1px solid var(--border); border-radius:10px; }

@media (max-width:1100px){
  .ipb .kpis,.ipb .cards{ grid-template-columns:repeat(2,1fr); }
  .ipb .econgrid,.ipb .anbody,.ipb .split{ grid-template-columns:1fr; }
  .ipb .addcost .adgrid,.ipb .radar-config-bar{ grid-template-columns:repeat(2,1fr); }
}
@media (max-width:640px){
  .ipb .kpis,.ipb .cards,.ipb .grid2,.ipb .grid3,.ipb .subrog-hero-banner,.ipb .subrog-card .sc-grid,.ipb .subrog-card .sc-metrics,.ipb .radar-config-bar{ grid-template-columns:1fr; }
  .ipb .phead{ flex-direction:column; align-items:stretch; }
}
`;

export default PropertyAssetManager;
