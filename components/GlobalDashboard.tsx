import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db } from '../services/dbService';
import { Property, RentalRecord, ValuationRecord } from '../types';

/* =====================================================================================
   ImmoPlan · Dashboard — "Bento Terminal" (port del prototipo dashboard-bento-filtro)
   Carica i dati reali (proprietà + costi) come l'originale GlobalDashboard.
   Filtro data funzionante: Giorno · Mese · 6 Mesi · Anno (con popover calendario).
   Stile via CSS scoped sotto `.ipb`. Tema scuro col tema "Neon", chiaro altrimenti.
   ===================================================================================== */

const MA = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const MF = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const WD = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const CAT_COLOR: Record<string, string> = { MORTGAGE:'#2f8fff', TAX:'#f5b942', MAINTENANCE:'#6f63ff', UTILITY:'#2fd6a3', INTERNET:'#59b0ff', INSURANCE:'#fb6f86', OTHER:'#8b97ab' };
const CAT_LABEL: Record<string, string> = { MORTGAGE:'Mutuo', TAX:'Tasse', MAINTENANCE:'Condominio', UTILITY:'Utenze', INTERNET:'Internet', INSURANCE:'Assicurazione', OTHER:'Altro' };

const safeNum = (v: any): number => { const n = typeof v === 'string' ? parseFloat(v) : v; return typeof n === 'number' && isFinite(n) ? n : 0; };
const fmt = (n: number) => Math.round(safeNum(n)).toLocaleString('it-IT');
const eur = (n: number) => '€ ' + fmt(n);
const seur = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + '€ ' + Math.abs(Math.round(safeNum(n))).toLocaleString('it-IT');
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const jsDow = (y: number, m: number, d: number) => new Date(y, m, d).getDay();
const addMonths = (y: number, m: number, d: number) => { let yy = y, mm = m + d; while (mm < 0) { mm += 12; yy--; } while (mm > 11) { mm -= 12; yy++; } return { y: yy, m: mm }; };
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const rnd = (k: string) => (hash(k) % 1000) / 1000;
const initials = (s: string) => (s || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const ic = (p: string, s = 18, sw = 1.8) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: p }} />
);
const PATH = {
  building: '<path d="M3 22V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v17"/><path d="M14 22V10a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v12"/><path d="M2 22h20"/><path d="M6 12h2M6 16h2M16 12h2M16 16h2"/>',
  home: '<path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10"/>',
  car: '<path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13M5 13h14v4a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/>',
  up: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  down: '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
  chevL: '<polyline points="15 18 9 12 15 6"/>', chevR: '<polyline points="9 18 15 12 9 6"/>',
};
const typeIcon = (t: string) => t === 'GARAGE' ? PATH.car : t === 'LAND' || t === 'COMMERCIAL' ? PATH.building : PATH.home;
const STATUS: Record<string, { t: string; c: string }> = { RENTED:{t:'Affittato',c:'b-rent'}, RENOVATION:{t:'Cantiere',c:'b-cant'}, EMPTY:{t:'Sfitto',c:'b-empty'}, MAIN_RESIDENCE:{t:'Residenza',c:'b-main'} };

type TF = 'GIORNO' | 'MESE' | '6M' | 'ANNO';
type Anchor = { y: number; m: number; d: number };
const today = new Date();
const NOW: Anchor = { y: today.getFullYear(), m: today.getMonth(), d: today.getDate() };
const GROWTH: Record<TF, number> = { GIORNO: 0.004, MESE: 0.012, '6M': 0.045, ANNO: 0.075 };
const FACTOR: Record<TF, number> = { GIORNO: 1 / 30, MESE: 1 / 4.33, '6M': 1, ANNO: 1 };

interface Derived { id: string; name: string; code: string; address: string; cur: number; buy: number; inc: number; exp: number; status: string; type: string; coords?: { lat: number; lng: number }; costs: any[]; mortgage: number; condoFees: number; defaultTaxRate: number; mortgageStartDate?: string; mortgageDuration?: number; initialInvestment?: number; valuations?: ValuationRecord[]; }
const monthlyExp = (p: Property) => {
  let m = 0; const costs = p.recurringCosts || [];
  costs.forEach(c => {
    if (c.frequency === 'MONTHLY') {
      let active = true;
      if (c.referenceYear != null && c.referenceMonth != null) {
        const costStart = new Date(c.referenceYear, c.referenceMonth, 1);
        const now = new Date();
        if (now < costStart) {
          active = false;
        }
      }
      if (active) m += safeNum(c.amount);
    } else if (c.frequency === 'YEARLY') {
      m += safeNum(c.amount) / 12;
    }
  });
  if (!costs.some(c => c.category === 'MAINTENANCE') && p.financials?.condoFees) m += safeNum(p.financials.condoFees);
  if (!costs.some(c => c.category === 'TAX') && p.financials?.defaultTaxRate && p.financials?.monthlyRent) {
    m += safeNum(p.financials.monthlyRent) * safeNum(p.financials.defaultTaxRate) / 100;
  }
  if (!costs.some(c => c.category === 'MORTGAGE') && p.financials?.mortgageAmount) {
    const mortgageAmt = safeNum(p.financials.mortgageAmount);
    const startStr = p.financials.mortgageStartDate;
    const duration = p.financials.mortgageDuration || 20;
    let active = true;
    if (startStr) {
      const mStart = new Date(startStr);
      if (!isNaN(mStart.getTime())) {
        const mEnd = new Date(mStart.getFullYear() + duration, mStart.getMonth(), mStart.getDate());
        const now = new Date();
        if (now < mStart || now > mEnd) {
          active = false;
        }
      }
    }
    if (active) m += mortgageAmt;
  }
  return m;
};
const derive = (p: Property): Derived => ({
  id: p.id,
  name: p.name,
  code: initials(p.name),
  address: p.address,
  cur: safeNum(p.currentValue),
  buy: safeNum(p.purchasePrice),
  inc: safeNum(p.financials?.monthlyRent),
  exp: monthlyExp(p),
  status: p.status,
  type: p.type,
  coords: p.coordinates,
  costs: p.recurringCosts || [],
  mortgage: safeNum(p.financials?.mortgageAmount),
  condoFees: safeNum(p.financials?.condoFees),
  defaultTaxRate: safeNum(p.financials?.defaultTaxRate),
  mortgageStartDate: p.financials?.mortgageStartDate,
  mortgageDuration: p.financials?.mortgageDuration,
  initialInvestment: p.financials?.initialInvestment,
  valuations: p.valuations || []
});

function getPropertyValueAtDate(p: Derived | Property, date: Date): number | null {
  if (!p.valuations || p.valuations.length === 0) return null;
  const sorted = [...p.valuations].sort((a, b) => a.date.localeCompare(b.date));
  const targetStr = date.toISOString().split('T')[0];
  let latestVal: number | null = null;
  for (const val of sorted) {
    if (val.date <= targetStr) {
      latestVal = val.value;
    } else {
      break;
    }
  }
  return latestVal;
}

const getPropertyNetCapRate = (p: Derived): number => {
  const annualRent = p.inc * 12;
  if (annualRent === 0) return 0;
  let annualOperatingExpenses = 0;
  const costs = p.costs || [];
  costs.forEach(c => {
    if (c.category !== 'MORTGAGE') {
      if (c.frequency === 'MONTHLY') annualOperatingExpenses += safeNum(c.amount) * 12;
      else if (c.frequency === 'YEARLY') annualOperatingExpenses += safeNum(c.amount);
    }
  });
  if (!costs.some(c => c.category === 'TAX') && p.defaultTaxRate && annualRent > 0) {
    annualOperatingExpenses += annualRent * (p.defaultTaxRate / 100);
  }
  const noi = annualRent - annualOperatingExpenses;
  const purchasePrice = p.buy || 1;
  return (noi / purchasePrice) * 100;
};

const getPortfolioNetCapRate = (propertiesList: Derived[]): number => {
  let totalNoi = 0;
  let totalPurchasePrice = 0;
  propertiesList.forEach(p => {
    const annualRent = p.inc * 12;
    let annualOperatingExpenses = 0;
    const costs = p.costs || [];
    costs.forEach(c => {
      if (c.category !== 'MORTGAGE') {
        if (c.frequency === 'MONTHLY') annualOperatingExpenses += safeNum(c.amount) * 12;
        else if (c.frequency === 'YEARLY') annualOperatingExpenses += safeNum(c.amount);
      }
    });
    if (!costs.some(c => c.category === 'TAX') && p.defaultTaxRate && annualRent > 0) {
      annualOperatingExpenses += annualRent * (p.defaultTaxRate / 100);
    }
    const noi = annualRent - annualOperatingExpenses;
    totalNoi += noi;
    totalPurchasePrice += p.buy;
  });
  return totalPurchasePrice > 0 ? (totalNoi / totalPurchasePrice) * 100 : 0;
};


const getStepDate = (tf: TF, sd: string) => {
  if (tf === 'GIORNO') {
    const parts = sd.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
  }
  if (tf === 'MESE') {
    const parts = sd.split('-');
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    const w = parseInt(parts[2].replace('w', ''));
    return new Date(y, m, w * 7 + 1);
  }
  const parts = sd.split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]), 1);
};

const getActiveMonthlyAmount = (tf: TF, anchor: Anchor, start: Date, end: Date, amt: number, refY?: number, refM?: number) => {
  if (refY == null || refM == null) {
    if (tf === 'GIORNO') return amt * (7 / 30);
    if (tf === 'MESE') return amt;
    if (tf === '6M') return amt * 6;
    return amt * 12;
  }

  const costStart = new Date(refY, refM, 1);

  if (tf === 'GIORNO') {
    let activeDays = 0;
    const weekStart = new Date(start);
    for (let d = 0; d < 7; d++) {
      const currentDay = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + d);
      if (currentDay >= costStart) {
        activeDays++;
      }
    }
    return amt * (activeDays / 30);
  }

  if (tf === 'MESE') {
    const currentMonth = new Date(anchor.y, anchor.m, 1);
    return currentMonth >= costStart ? amt : 0;
  }

  if (tf === '6M') {
    let activeMonths = 0;
    for (let i = 5; i >= 0; i--) {
      const p = addMonths(anchor.y, anchor.m, -i);
      const currentMonth = new Date(p.y, p.m, 1);
      if (currentMonth >= costStart) {
        activeMonths++;
      }
    }
    return amt * activeMonths;
  }

  let activeMonths = 0;
  for (let m = 0; m < 12; m++) {
    const currentMonth = new Date(anchor.y, m, 1);
    if (currentMonth >= costStart) {
      activeMonths++;
    }
  }
  return amt * activeMonths;
};

const getActiveMortgageAmount = (tf: TF, anchor: Anchor, start: Date, end: Date, amt: number, startDateStr?: string, durationYears?: number) => {
  if (!startDateStr) {
    if (tf === 'GIORNO') return amt * (7 / 30);
    if (tf === 'MESE') return amt;
    if (tf === '6M') return amt * 6;
    return amt * 12;
  }

  const mStart = new Date(startDateStr);
  if (isNaN(mStart.getTime())) {
    if (tf === 'GIORNO') return amt * (7 / 30);
    if (tf === 'MESE') return amt;
    if (tf === '6M') return amt * 6;
    return amt * 12;
  }

  const duration = durationYears && durationYears > 0 ? durationYears : 20;
  const mEnd = new Date(mStart.getFullYear() + duration, mStart.getMonth(), mStart.getDate());

  if (tf === 'GIORNO') {
    let activeDays = 0;
    const weekStart = new Date(start);
    for (let d = 0; d < 7; d++) {
      const currentDay = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + d);
      if (currentDay >= mStart && currentDay <= mEnd) {
        activeDays++;
      }
    }
    return amt * (activeDays / 30);
  }

  if (tf === 'MESE') {
    const currentMonth = new Date(anchor.y, anchor.m, 1);
    return (currentMonth >= mStart && currentMonth <= mEnd) ? amt : 0;
  }

  if (tf === '6M') {
    let activeMonths = 0;
    for (let i = 5; i >= 0; i--) {
      const p = addMonths(anchor.y, anchor.m, -i);
      const currentMonth = new Date(p.y, p.m, 1);
      if (currentMonth >= mStart && currentMonth <= mEnd) {
        activeMonths++;
      }
    }
    return amt * activeMonths;
  }

  let activeMonths = 0;
  for (let m = 0; m < 12; m++) {
    const currentMonth = new Date(anchor.y, m, 1);
    if (currentMonth >= mStart && currentMonth <= mEnd) {
      activeMonths++;
    }
  }
  return amt * activeMonths;
};

const getPeriodIncome = (p: Derived, tf: TF, anchor: Anchor, start: Date, end: Date, records: RentalRecord[]) => {
  const propRecords = records.filter(r => r.propertyId === p.id);
  if (propRecords.length > 0) {
    if (tf === 'GIORNO') {
      const r = propRecords.find(rec => rec.year === anchor.y && rec.month === anchor.m);
      return r ? safeNum(r.income) * (7 / 30) : 0;
    }
    if (tf === 'MESE') {
      const r = propRecords.find(rec => rec.year === anchor.y && rec.month === anchor.m);
      return r ? safeNum(r.income) : 0;
    }
    if (tf === '6M') {
      let total = 0;
      for (let i = 5; i >= 0; i--) {
        const target = addMonths(anchor.y, anchor.m, -i);
        const r = propRecords.find(rec => rec.year === target.y && rec.month === target.m);
        if (r) total += safeNum(r.income);
      }
      return total;
    }
    let total = 0;
    for (let m = 0; m < 12; m++) {
      const r = propRecords.find(rec => rec.year === anchor.y && rec.month === m);
      if (r) total += safeNum(r.income);
    }
    return total;
  }
  const factor = tf === 'GIORNO' ? 7 / 30 : tf === 'MESE' ? 1 : tf === '6M' ? 6 : 12;
  return p.inc * factor;
};

function periodTitle(tf: TF, a: Anchor) {
  if (tf === 'GIORNO') return WD[jsDow(a.y, a.m, a.d)] + ' ' + a.d + ' ' + MA[a.m] + ' ' + a.y;
  if (tf === 'MESE') return MF[a.m] + ' ' + a.y;
  if (tf === '6M') { const s = addMonths(a.y, a.m, -5); return MA[s.m] + (s.y !== a.y ? " '" + String(s.y).slice(2) : '') + ' – ' + MA[a.m] + ' ' + a.y; }
  return '' + a.y;
}

function buildAxis(tf: TF, a: Anchor) {
  if (tf === 'GIORNO') {
    const dow = (jsDow(a.y, a.m, a.d) + 6) % 7; const start = new Date(a.y, a.m, a.d - dow);
    const labels: string[] = [], seeds: string[] = [];
    for (let i = 0; i < 7; i++) { const dt = new Date(start); dt.setDate(start.getDate() + i); labels.push('' + dt.getDate()); seeds.push(dt.getFullYear() + '-' + dt.getMonth() + '-' + dt.getDate()); }
    return { labels, seeds, n: 7, periodLabel: 'Settimana', refY: a.y, refM: a.m };
  }
  if (tf === 'MESE') {
    const wk = Math.ceil(daysInMonth(a.y, a.m) / 7); const labels: string[] = [], seeds: string[] = [];
    for (let i = 0; i < wk; i++) { labels.push('S' + (i + 1)); seeds.push(a.y + '-' + a.m + '-w' + i); }
    return { labels, seeds, n: wk, periodLabel: MF[a.m] + ' ' + a.y, refY: a.y, refM: a.m };
  }
  if (tf === '6M') {
    const labels: string[] = [], seeds: string[] = [];
    for (let i = 5; i >= 0; i--) { const p = addMonths(a.y, a.m, -i); labels.push(MA[p.m]); seeds.push(p.y + '-' + p.m); }
    return { labels, seeds, n: 6, periodLabel: '6 Mesi', refY: a.y, refM: a.m };
  }
  const labels: string[] = [], seeds: string[] = []; for (let i = 0; i < 12; i++) { labels.push(MA[i]); seeds.push(a.y + '-' + i); }
  return { labels, seeds, n: 12, periodLabel: '' + a.y, refY: a.y, refM: 11 };
}
function computeModel(scopeAll: Derived[], tf: TF, propId: string, anchor: Anchor, records: RentalRecord[]) {
  const ax = buildAxis(tf, anchor);
  const scope = propId === 'ALL' ? scopeAll : scopeAll.filter(p => p.id === propId);
  const n = ax.n, growth = GROWTH[tf], factor = FACTOR[tf];
  const vScale = Math.pow(1.006, (ax.refY - NOW.y) * 12 + (ax.refM - NOW.m));

  let start: Date;
  let end: Date;

  if (tf === 'GIORNO') {
    const dow = (jsDow(anchor.y, anchor.m, anchor.d) + 6) % 7;
    start = new Date(anchor.y, anchor.m, anchor.d - dow, 0, 0, 0);
    end = new Date(anchor.y, anchor.m, anchor.d - dow + 6, 23, 59, 59);
  } else if (tf === 'MESE') {
    start = new Date(anchor.y, anchor.m, 1, 0, 0, 0);
    end = new Date(anchor.y, anchor.m, daysInMonth(anchor.y, anchor.m), 23, 59, 59);
  } else if (tf === '6M') {
    const p = addMonths(anchor.y, anchor.m, -5);
    start = new Date(p.y, p.m, 1, 0, 0, 0);
    end = new Date(anchor.y, anchor.m, daysInMonth(anchor.y, anchor.m), 23, 59, 59);
  } else {
    start = new Date(anchor.y, 0, 1, 0, 0, 0);
    end = new Date(anchor.y, 11, 31, 23, 59, 59);
  }

  const catActual: Record<string, number> = {};
  Object.keys(CAT_LABEL).forEach(cat => { catActual[cat] = 0; });

  scope.forEach(p => {
    (p.costs || []).forEach((c: any) => {
      const amt = safeNum(c.amount);
      if (amt <= 0) return;

      if (c.frequency === 'MONTHLY') {
        const activeAmt = getActiveMonthlyAmount(tf, anchor, start, end, amt, c.referenceYear, c.referenceMonth);
        catActual[c.category] = (catActual[c.category] || 0) + activeAmt;
      } else if (c.frequency === 'YEARLY') {
        const startY = start.getFullYear();
        const endY = end.getFullYear();
        const refM = c.referenceMonth != null ? c.referenceMonth : 0;
        for (let y = startY; y <= endY; y++) {
          const d = new Date(y, refM, 1);
          if (d >= start && d <= end) catActual[c.category] = (catActual[c.category] || 0) + amt;
        }
      } else if (c.frequency === 'ONE_OFF' && c.date) {
        const d = new Date(c.date);
        if (d >= start && d <= end) catActual[c.category] = (catActual[c.category] || 0) + amt;
      }
    });

    if (!(p.costs || []).some(c => c.category === 'MORTGAGE') && p.mortgage > 0) {
      const activeAmt = getActiveMortgageAmount(tf, anchor, start, end, p.mortgage, p.mortgageStartDate, p.mortgageDuration);
      catActual['MORTGAGE'] = (catActual['MORTGAGE'] || 0) + activeAmt;
    }
    if (!(p.costs || []).some(c => c.category === 'MAINTENANCE') && p.condoFees > 0) {
      const activeAmt = getActiveMonthlyAmount(tf, anchor, start, end, p.condoFees);
      catActual['MAINTENANCE'] = (catActual['MAINTENANCE'] || 0) + activeAmt;
    }
    if (!(p.costs || []).some(c => c.category === 'TAX') && p.defaultTaxRate > 0 && p.inc > 0) {
      const activeAmt = getActiveMonthlyAmount(tf, anchor, start, end, (p.inc * p.defaultTaxRate / 100));
      catActual['TAX'] = (catActual['TAX'] || 0) + activeAmt;
    }
  });

  const trendCategories: { id: string; name: string; color: string }[] = [];
  if (propId !== 'ALL' && scope.length === 1) {
    const p = scope[0];
    if (p.inc > 0 || records.some(r => r.propertyId === p.id)) trendCategories.push({ id: 'INCOME', name: 'Entrate', color: 'var(--accent)' });
    Object.keys(CAT_LABEL).forEach(cat => {
      if ((p.costs || []).some(c => c.category === cat) || (cat === 'MORTGAGE' && p.mortgage > 0) || (cat === 'MAINTENANCE' && p.condoFees > 0) || (cat === 'TAX' && p.defaultTaxRate > 0 && p.inc > 0)) {
        trendCategories.push({ id: cat, name: CAT_LABEL[cat] || cat, color: CAT_COLOR[cat] || '#8b97ab' });
      }
    });
  }

  const chart: any[] = [];
  for (let i = 0; i < n; i++) {
    let v = 0, inc = 0, exp = 0; const t = n > 1 ? i / (n - 1) : 1; const sd = ax.seeds[i];
    const catVals: Record<string, number> = {};
    Object.keys(CAT_LABEL).forEach(cat => { catVals[cat] = 0; });
    const stepDate = getStepDate(tf, sd);
    let stepStart: Date;
    let stepEnd: Date;
    if (tf === 'GIORNO') {
      stepStart = new Date(stepDate.getFullYear(), stepDate.getMonth(), stepDate.getDate(), 0, 0, 0);
      stepEnd = new Date(stepDate.getFullYear(), stepDate.getMonth(), stepDate.getDate(), 23, 59, 59);
    } else if (tf === 'MESE') {
      stepStart = new Date(stepDate.getFullYear(), stepDate.getMonth(), stepDate.getDate(), 0, 0, 0);
      stepEnd = new Date(stepDate.getFullYear(), stepDate.getMonth(), stepDate.getDate() + 6, 23, 59, 59);
    } else {
      stepStart = new Date(stepDate.getFullYear(), stepDate.getMonth(), 1, 0, 0, 0);
      stepEnd = new Date(stepDate.getFullYear(), stepDate.getMonth(), daysInMonth(stepDate.getFullYear(), stepDate.getMonth()), 23, 59, 59);
    }

    scope.forEach(p => {
      const realVal = getPropertyValueAtDate(p, stepDate);
      if (realVal !== null) {
        v += realVal;
      } else {
        v += p.cur * vScale * (1 - growth * (1 - t)) * (1 + (rnd(p.id + 'v' + sd) - 0.5) * 0.01);
      }
      
      let stepInc = 0;
      const propRecords = records.filter(r => r.propertyId === p.id);
      const stepYear = stepDate.getFullYear();
      const stepMonth = stepDate.getMonth();
      const activeRecord = propRecords.find(r => r.year === stepYear && r.month === stepMonth);
      if (activeRecord) {
        stepInc = safeNum(activeRecord.income) * factor;
      } else if (propRecords.length > 0) {
        stepInc = 0;
      } else {
        stepInc = p.inc * factor;
      }
      inc += stepInc;

      let mortgageActive = true;
      if (p.mortgageStartDate) {
        const mStart = new Date(p.mortgageStartDate);
        if (!isNaN(mStart.getTime())) {
          const duration = p.mortgageDuration && p.mortgageDuration > 0 ? p.mortgageDuration : 20;
          const mEnd = new Date(mStart.getFullYear() + duration, mStart.getMonth(), mStart.getDate());
          if (stepDate < mStart || stepDate > mEnd) mortgageActive = false;
        }
      }

      if (propId !== 'ALL') {
        catVals['INCOME'] = +(stepInc / 1000).toFixed(2);
      }
      Object.keys(CAT_LABEL).forEach(cat => {
        let activeAmt = 0;
        (p.costs || []).forEach((c: any) => {
          if (c.category === cat) {
            if (c.frequency === 'MONTHLY') {
              const amt = safeNum(c.amount);
              if (c.referenceYear != null && c.referenceMonth != null) {
                const costStart = new Date(c.referenceYear, c.referenceMonth, 1);
                if (stepDate >= costStart) activeAmt += amt;
              } else activeAmt += amt;
            } else if (c.frequency === 'YEARLY') {
              activeAmt += safeNum(c.amount) / 12;
            } else if (c.frequency === 'ONE_OFF' && c.date) {
              const d = new Date(c.date);
              if (d >= stepStart && d <= stepEnd) {
                activeAmt += safeNum(c.amount) / factor;
              }
            }
          }
        });
        if (cat === 'MORTGAGE' && !(p.costs || []).some(c => c.category === 'MORTGAGE') && p.mortgage > 0 && mortgageActive) activeAmt += p.mortgage;
        if (cat === 'MAINTENANCE' && !(p.costs || []).some(c => c.category === 'MAINTENANCE') && p.condoFees > 0) activeAmt += p.condoFees;
        if (cat === 'TAX' && !(p.costs || []).some(c => c.category === 'TAX') && p.defaultTaxRate > 0 && p.inc > 0) activeAmt += p.inc * p.defaultTaxRate / 100;
        catVals[cat] = (catVals[cat] || 0) + (activeAmt * factor) / 1000;
      });

      let stepExp = 0;
      (p.costs || []).forEach((c: any) => {
        if (c.frequency === 'MONTHLY') {
          const amt = safeNum(c.amount);
          if (c.referenceYear != null && c.referenceMonth != null) {
            const costStart = new Date(c.referenceYear, c.referenceMonth, 1);
            if (stepDate >= costStart) stepExp += amt;
          } else stepExp += amt;
        } else if (c.frequency === 'YEARLY') {
          stepExp += safeNum(c.amount) / 12;
        } else if (c.frequency === 'ONE_OFF' && c.date) {
          const d = new Date(c.date);
          if (d >= stepStart && d <= stepEnd) {
            stepExp += safeNum(c.amount) / factor;
          }
        }
      });
      if (!(p.costs || []).some(c => c.category === 'MORTGAGE') && p.mortgage > 0 && mortgageActive) stepExp += p.mortgage;
      if (!(p.costs || []).some(c => c.category === 'MAINTENANCE') && p.condoFees > 0) stepExp += p.condoFees;
      if (!(p.costs || []).some(c => c.category === 'TAX') && p.defaultTaxRate > 0 && p.inc > 0) stepExp += p.inc * p.defaultTaxRate / 100;
      exp += stepExp * factor;
    });

    Object.keys(catVals).forEach(cat => {
      catVals[cat] = Number(catVals[cat].toFixed(2));
    });

    chart.push({ name: ax.labels[i], value: Math.round(v / 1000), income: +(inc / 1000).toFixed(2), expense: +(exp / 1000).toFixed(2), ...catVals });
  }
  const cur = Math.round(scope.reduce((s, p) => {
    const realVal = getPropertyValueAtDate(p, end);
    return s + (realVal !== null ? realVal : p.cur * vScale);
  }, 0));
  const buy = scope.reduce((s, p) => s + p.buy, 0);
  const cats = Object.keys(CAT_LABEL).map(id => ({ id, name: CAT_LABEL[id] || id, color: CAT_COLOR[id] || '#8b97ab', v: Math.round(catActual[id] || 0) })).sort((a, b) => b.v - a.v);
  const periodInc = scope.reduce((s, p) => s + getPeriodIncome(p, tf, anchor, start, end, records), 0);
  const periodExp = cats.reduce((a, b) => a + b.v, 0);
  const cash = periodInc - periodExp;
  const margin = periodInc > 0 ? cash / periodInc : 0;
  const yield_ = cur > 0 ? (scope.reduce((a, p) => a + p.inc * 12, 0) / cur * 100) : 0;
  const growthPct = chart[0]?.value > 0 ? ((chart[n - 1].value - chart[0].value) / chart[0].value * 100) : 0;
  return { scope, chart, cur, plus: cur - buy, periodInc, periodExp, cash, margin, yield_, growthPct, periodLabel: ax.periodLabel, cats, trendCategories, start, end };
}
function nextDue(scope: Derived[], tf: TF, anchor: Anchor, start?: Date, end?: Date) {
  let dueStart: Date;
  let dueEnd: Date;

  if (tf === 'GIORNO') {
    dueStart = new Date(anchor.y, anchor.m, anchor.d || 1, 0, 0, 0);
    dueEnd = new Date(anchor.y, anchor.m + 1, anchor.d || 1, 23, 59, 59);
  } else {
    dueStart = start || new Date();
    dueEnd = end || new Date();
  }

  const list: { date: Date; name: string; prop: string; amount: number }[] = [];
  scope.forEach(p => (p.costs || []).forEach((c: any) => {
    let due: Date | null = null;
    if (c.frequency === 'ONE_OFF' && c.date) {
      const d = new Date(c.date);
      if (d >= dueStart && d <= dueEnd) due = d;
    } else if (c.frequency === 'YEARLY' && c.referenceMonth != null) {
      const startYear = dueStart.getFullYear();
      const endYear = dueEnd.getFullYear();
      for (let y = startYear; y <= endYear; y++) {
        const d = new Date(y, c.referenceMonth, 1);
        if (d >= dueStart && d <= dueEnd) {
          due = d;
        }
      }
    }
    if (due) {
      list.push({ date: due, name: c.name, prop: p.name, amount: safeNum(c.amount) });
    }
  }));

  list.sort((a, b) => a.date.getTime() - b.date.getTime());
  return list;
}

/* ---- chart components (SVG nativo) ---- */
function AreaChart({ data, height, accent }: { data: any[]; height: number; accent: string }) {
  const [hi, setHi] = useState<number | null>(null);
  const W = 600, H = height, pad = { l: 6, r: 6, t: 14, b: 22 };
  const vals = data.map(d => d.value);
  let min = Math.min(...vals), max = Math.max(...vals); const sp = (max - min) || 1; min -= sp * 0.18; max += sp * 0.12;
  const ix = (i: number) => pad.l + i * (W - pad.l - pad.r) / ((data.length - 1) || 1);
  const iy = (v: number) => H - pad.b - (v - min) / (max - min) * (H - pad.t - pad.b);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${ix(i).toFixed(1)},${iy(v).toFixed(1)}`).join(' ');
  const area = `${line} L${ix(vals.length - 1)},${H - pad.b} L${ix(0)},${H - pad.b} Z`;
  const gid = 'g' + Math.round(min);
  const onMove = (e: React.MouseEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); const i = Math.round((e.clientX - r.left) / r.width * (data.length - 1)); setHi(Math.max(0, Math.min(data.length - 1, i))); };
  return (
    <div className="chartbox" onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={accent} stopOpacity="0.32" /><stop offset="100%" stopColor={accent} stopOpacity="0" /></linearGradient></defs>
        {[0,1,2,3].map(g => { const y = pad.t + g * (H - pad.t - pad.b) / 3; return <line key={g} x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--grid-line)" vectorEffect="non-scaling-stroke" />; })}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {hi != null && <line x1={ix(hi)} x2={ix(hi)} y1={pad.t} y2={H - pad.b} stroke={accent} strokeWidth="1" opacity="0.5" vectorEffect="non-scaling-stroke" />}
        {data.map((d, i) => <text key={i} x={ix(i)} y={H - 6} textAnchor="middle" fontFamily="var(--mono)" fontSize="9" fill="var(--faint)">{d.name}</text>)}
      </svg>
      {hi != null && <div className="tip" style={{ left: `${ix(hi) / W * 100}%`, top: `${iy(vals[hi]) / H * 100}%` }}><div className="tlab">{data[hi].name}</div><div className="num">{eur(vals[hi] * 1000)}</div></div>}
    </div>
  );
}
function DualLine({ data, height }: { data: any[]; height: number }) {
  const [hi, setHi] = useState<number | null>(null);
  const W = 600, H = height, pad = { l: 6, r: 6, t: 14, b: 22 };
  const all = data.flatMap(d => [d.income, d.expense]); let min = Math.min(...all), max = Math.max(...all); const sp = (max - min) || 1; min -= sp * 0.18; max += sp * 0.12;
  const ix = (i: number) => pad.l + i * (W - pad.l - pad.r) / ((data.length - 1) || 1);
  const iy = (v: number) => H - pad.b - (v - min) / (max - min) * (H - pad.t - pad.b);
  const path = (key: string) => data.map((d, i) => `${i ? 'L' : 'M'}${ix(i).toFixed(1)},${iy(d[key]).toFixed(1)}`).join(' ');
  const onMove = (e: React.MouseEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); const i = Math.round((e.clientX - r.left) / r.width * (data.length - 1)); setHi(Math.max(0, Math.min(data.length - 1, i))); };
  return (
    <div className="chartbox" onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {[0,1,2,3].map(g => { const y = pad.t + g * (H - pad.t - pad.b) / 3; return <line key={g} x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--grid-line)" vectorEffect="non-scaling-stroke" />; })}
        <path d={path('income')} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d={path('expense')} fill="none" stroke="var(--neg)" strokeWidth="1.8" strokeDasharray="3 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hi != null && <line x1={ix(hi)} x2={ix(hi)} y1={pad.t} y2={H - pad.b} stroke="var(--accent)" strokeWidth="1" opacity="0.5" vectorEffect="non-scaling-stroke" />}
        {data.map((d, i) => <text key={i} x={ix(i)} y={H - 6} textAnchor="middle" fontFamily="var(--mono)" fontSize="9" fill="var(--faint)">{d.name}</text>)}
      </svg>
      {hi != null && <div className="tip" style={{ left: `${ix(hi) / W * 100}%`, top: '14%' }}>
        <div className="tlab">{data[hi].name}</div>
        <div className="trow"><span className="nm"><span className="dot" style={{ background: 'var(--accent)' }} />Entrate</span><span className="num">{eur(data[hi].income * 1000)}</span></div>
        <div className="trow"><span className="nm"><span className="dot" style={{ background: 'var(--neg)' }} />Uscite</span><span className="num">{eur(data[hi].expense * 1000)}</span></div>
      </div>}
    </div>
  );
}

function CategoryTrendChart({ data, categories, height }: { data: any[]; categories: { id: string; name: string; color: string }[]; height: number }) {
  const [hi, setHi] = useState<number | null>(null);
  const W = 600, H = height, pad = { l: 6, r: 6, t: 14, b: 22 };

  const allVals = data.flatMap(d => categories.map(cat => safeNum(d[cat.id])));
  let min = Math.min(...allVals), max = Math.max(...allVals);
  const sp = (max - min) || 1;
  min -= sp * 0.18;
  max += sp * 0.12;
  if (min < 0) min = 0;

  const ix = (i: number) => pad.l + i * (W - pad.l - pad.r) / ((data.length - 1) || 1);
  const iy = (v: number) => H - pad.b - (v - min) / (max - min) * (H - pad.t - pad.b);
  const path = (catId: string) => data.map((d, i) => `${i ? 'L' : 'M'}${ix(i).toFixed(1)},${iy(safeNum(d[catId])).toFixed(1)}`).join(' ');
  const onMove = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const i = Math.round((e.clientX - r.left) / r.width * (data.length - 1));
    setHi(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div className="chartbox" onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {[0, 1, 2, 3].map(g => {
          const y = pad.t + g * (H - pad.t - pad.b) / 3;
          return <line key={g} x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--grid-line)" vectorEffect="non-scaling-stroke" />;
        })}
        {categories.map(cat => (
          <path
            key={cat.id}
            d={path(cat.id)}
            fill="none"
            stroke={cat.color}
            strokeWidth="2.0"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {hi != null && <line x1={ix(hi)} x2={ix(hi)} y1={pad.t} y2={H - pad.b} stroke="var(--accent)" strokeWidth="1" opacity="0.5" vectorEffect="non-scaling-stroke" />}
        {data.map((d, i) => <text key={i} x={ix(i)} y={H - 6} textAnchor="middle" fontFamily="var(--mono)" fontSize="9" fill="var(--faint)">{d.name}</text>)}
      </svg>
      {hi != null && (
        <div className="tip" style={{ left: `${ix(hi) / W * 100}%`, top: '14%' }}>
          <div className="tlab">{data[hi].name}</div>
          {categories.map(cat => (
            <div className="trow" key={cat.id}>
              <span className="nm">
                <span className="dot" style={{ background: cat.color }} />
                {cat.name}
              </span>
              <span className="num">{eur(safeNum(data[hi][cat.id]) * 1000)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function Ring({ pct, color }: { pct: number; color: string }) {
  const size = 136, r = size / 2 - 8, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--inset)" strokeWidth="10" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}
function Donut({ items, size, onToggleCategory }: { items: any[]; size: number; onToggleCategory?: (id: string) => void }) {
  const total = items.reduce((a, b) => a + b.v, 0) || 1; const r = size / 2 - 7, c = 2 * Math.PI * r; let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {items.length === 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--inset)" strokeWidth="11" />}
      {items.map((it, i) => { 
        const len = c * (it.v / total); 
        const el = (
          <circle 
            key={i} 
            cx={size / 2} 
            cy={size / 2} 
            r={r} 
            fill="none" 
            stroke={it.color} 
            strokeWidth="11" 
            strokeDasharray={`${len} ${c - len}`} 
            strokeDashoffset={-off} 
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ cursor: 'pointer', transition: 'stroke-width 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.strokeWidth = '14'; }}
            onMouseLeave={(e) => { e.currentTarget.style.strokeWidth = '11'; }}
            onClick={() => onToggleCategory && onToggleCategory(it.id)}
          />
        ); 
        off += len; 
        return el; 
      })}
    </svg>
  );
}

interface MiniMapProps {
  scope: Derived[];
  all: Derived[];
  selectedId: string;
  theme: 'DEFAULT' | 'NEON';
  onSelectProperty?: (id: string) => void;
}

/* ---- mini mappa geografica (Leaflet) ---- */
function MiniMap({ scope, all, selectedId, theme, onSelectProperty }: MiniMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  const withCo = all.filter(p => p.coords && p.coords.lat !== 0 && p.coords.lng !== 0);

  useEffect(() => {
    if (!mapRef.current) return;
    if (withCo.length === 0) return;

    // Centra sui marker
    const lats = withCo.map(p => p.coords!.lat);
    const lngs = withCo.map(p => p.coords!.lng);
    const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

    const map = L.map(mapRef.current, {
      center: [centerLat, centerLng],
      zoom: 12,
      zoomControl: false,
      attributionControl: false
    });

    const isDark = theme === 'NEON';
    const tileUrl = isDark 
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, {
      maxZoom: 19
    }).addTo(map);

    const bounds = L.latLngBounds(withCo.map(p => [p.coords!.lat, p.coords!.lng]));
    map.fitBounds(bounds, { padding: [30, 30] });

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [withCo.length, theme]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    withCo.forEach(p => {
      const isSelected = selectedId === 'ALL' || selectedId === p.id;
      const color = isSelected ? 'var(--accent)' : 'var(--faint)';
      const icon = createMarkerIcon(selectedId === p.id || selectedId === 'ALL', p.code, 'var(--accent)');
      const marker = L.marker([p.coords!.lat, p.coords!.lng], { icon }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: var(--font);">
          <strong style="font-size: 13px; color: var(--text);">${p.name}</strong>
          <div style="font-size: 11px; color: var(--dim); margin-top: 2px;">${p.address}</div>
          <div style="font-family: var(--mono); font-size: 12px; font-weight: 600; color: var(--accent); margin-top: 4px;">${eur(p.cur)}</div>
        </div>
      `);

      if (onSelectProperty) {
        marker.on('click', () => {
          onSelectProperty(selectedId === p.id ? 'ALL' : p.id);
        });
      }

      markersRef.current[p.id] = marker;
    });

    if (selectedId !== 'ALL') {
      const activeProp = withCo.find(p => p.id === selectedId);
      if (activeProp && activeProp.coords) {
        map.setView([activeProp.coords.lat, activeProp.coords.lng], 14, { animate: true });
      }
    } else if (withCo.length > 0) {
      const bounds = L.latLngBounds(withCo.map(p => [p.coords!.lat, p.coords!.lng]));
      map.fitBounds(bounds, { padding: [40, 40], animate: true });
    }
  }, [selectedId, withCo, onSelectProperty]);

  if (withCo.length === 0) {
    return <div className="map empty">{ic(PATH.building, 22)}<span>Nessuna coordinata impostata</span></div>;
  }

  return (
    <div ref={mapRef} className="map" style={{ width: '100%', height: '100%', minHeight: '220px', zIndex: 1 }} />
  );
}

const createMarkerIcon = (isSelected: boolean, code: string, color: string) => {
  const bg = isSelected ? color : 'var(--faint)';
  const glow = isSelected ? `box-shadow: 0 0 10px ${color}; z-index: 1000;` : 'box-shadow: 0 2px 4px rgba(0,0,0,0.15);';
  const labelColor = isSelected ? 'var(--text)' : 'var(--dim)';
  const labelWeight = isSelected ? '700' : '500';
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div style="background: ${bg}; padding: 3px 6px; border-radius: 6px; border: 1px solid var(--border-2); font-family: var(--mono); font-size: 9px; font-weight: ${labelWeight}; color: ${labelColor}; white-space: nowrap; ${glow} margin-bottom: 2px;">
          ${code}
        </div>
        <div style="background: ${bg}; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--panel); ${glow}"></div>
      </div>
    `,
    iconSize: [60, 36],
    iconAnchor: [30, 28]
  });
};

/* ===================================================================================== */
interface GlobalDashboardProps {
  portalTarget?: HTMLDivElement | null;
}

export const GlobalDashboard: React.FC<GlobalDashboardProps> = ({ portalTarget }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [records, setRecords] = useState<RentalRecord[]>([]);
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);
  const [theme, setTheme] = useState<'DEFAULT' | 'NEON'>('DEFAULT');
  const [isLoading, setIsLoading] = useState(true);
  const [propId, setPropId] = useState('ALL');
  const [tf, setTf] = useState<TF>('6M');
  const [anchor, setAnchor] = useState<Anchor>({ ...NOW });
  const [picker, setPicker] = useState(false);
  const [view, setView] = useState({ y: NOW.y, m: NOW.m });
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);
  const pickRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  useEffect(() => {
    const apply = () => setTheme(document.documentElement.classList.contains('theme-neon') ? 'NEON' : 'DEFAULT');
    const obs = new MutationObserver(apply); obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); apply();
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    (async () => {
      try { setIsLoading(true); if (db.init) await db.init(); const [props, recs] = await Promise.all([db.getProperties(), db.getRentalRecords()]); setProperties(props || []); setRecords(recs || []); }
      catch (e) { console.error('Errore caricamento dashboard:', e); } finally { setIsLoading(false); }
    })();
  }, []);
  useEffect(() => {
    if (!picker) return;
    const h = (e: MouseEvent) => { if (pickRef.current && !pickRef.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('[data-datebtn]')) setPicker(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [picker]);

  const derived = useMemo(() => properties.map(derive), [properties]);
  const averageNetCapRate = useMemo(() => getPortfolioNetCapRate(derived), [derived]);
  const m = useMemo(() => computeModel(derived, tf, propId, anchor, records), [derived, tf, propId, anchor, records]);
  
  const toggleCategory = (catId: string) => {
    setExcludedCategories(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const { activeCats, periodExpFiltered, cashFiltered, marginFiltered, filteredChartData, filteredTrendCategories } = useMemo(() => {
    const activeCats = m.cats.filter(c => !excludedCategories.includes(c.id));
    const periodExpFiltered = activeCats.reduce((sum, c) => sum + c.v, 0);
    const cashFiltered = m.periodInc - periodExpFiltered;
    const marginFiltered = m.periodInc > 0 ? cashFiltered / m.periodInc : 0;

    const filteredChartData = m.chart.map(item => {
      let activeExpense = 0;
      Object.keys(CAT_LABEL).forEach(cat => {
        if (!excludedCategories.includes(cat)) {
          activeExpense += Number(item[cat]) || 0;
        }
      });
      return {
        ...item,
        expense: Number(activeExpense.toFixed(2))
      };
    });

    const filteredTrendCategories = (m.trendCategories || []).filter(cat => !excludedCategories.includes(cat.id));

    return {
      activeCats,
      periodExpFiltered,
      cashFiltered,
      marginFiltered,
      filteredChartData,
      filteredTrendCategories
    };
  }, [m, excludedCategories]);

  const dueList = useMemo(() => nextDue(m.scope, tf, anchor, m.start, m.end), [m.scope, tf, anchor, m.start, m.end]);

  const stepAnchor = (dir: number) => {
    if (tf === 'GIORNO') { const dt = new Date(anchor.y, anchor.m, anchor.d + dir); setAnchor({ y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate() }); }
    else if (tf === 'ANNO') setAnchor({ ...anchor, y: anchor.y + dir });
    else { const q = addMonths(anchor.y, anchor.m, dir); setAnchor({ ...anchor, y: q.y, m: q.m }); }
  };
  const openPicker = () => { setView({ y: anchor.y, m: anchor.m }); setPicker(p => !p); };
  const commit = (a: Anchor) => { setAnchor(a); setPicker(false); };

  const monthlyCash = m.scope.reduce((a, p) => a + (p.inc - p.exp), 0);

  const ctrlsJSX = (
    <div className="ctrls">
      <div className="selbox">
        <span className="lic">{ic(PATH.building, 15, 1.7)}</span>
        <select value={propId} onChange={e => setPropId(e.target.value)}>
          <option value="ALL">Tutto il Portafoglio</option>
          {derived.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="seg">
        {(['GIORNO','MESE','6M','ANNO'] as TF[]).map(t => <button key={t} className={tf === t ? 'on' : ''} onClick={() => { setPicker(false); setTf(t); }}>{t === '6M' ? '6 Mesi' : t.charAt(0) + t.slice(1).toLowerCase()}</button>)}
      </div>
      <div className="datectl" style={{ position: 'relative' }}>
        <button className="dnav" onClick={() => { setPicker(false); stepAnchor(-1); }}>{ic(PATH.chevL, 16)}</button>
        <button className="dlabel" data-datebtn onClick={openPicker}><span className="clc">{ic(PATH.cal, 14, 1.7)}</span><span>{periodTitle(tf, anchor)}</span></button>
        <button className="dnav" onClick={() => { setPicker(false); stepAnchor(1); }}>{ic(PATH.chevR, 16)}</button>
        {picker && <DatePicker tf={tf} view={view} setView={setView} anchor={anchor} onCommit={commit} pickRef={pickRef} />}
      </div>
    </div>
  );

  const portalContainer = portalTarget;

  return (
    <div className={`ipb${theme === 'NEON' ? '' : ' light'}`}>
      <style>{IPB_DASH_CSS}</style>
      <div className="body">
        {isDesktop && portalContainer ? createPortal(
          <div className={`ipb ${theme === 'NEON' ? '' : 'light'}`} style={{ background: 'transparent' }}>
            {ctrlsJSX}
          </div>,
          portalContainer
        ) : null}

        <div className="phead">
          <div>
            <div className="eyebrow">Property Terminal</div>
            <h2>Dashboard Patrimonio</h2>
          </div>
          {!isDesktop || !portalContainer ? ctrlsJSX : null}
        </div>

        {isLoading ? <div className="loading">Caricamento dati…</div> : (
        <div className="bento">
          <div className="panel pad p-value">
            <div className="ph"><h3 className="micro">Valore Patrimonio · {m.periodLabel}</h3><span className={`chip ${m.growthPct >= 0 ? 'pos' : 'neg'}`}>{ic(m.growthPct >= 0 ? PATH.up : PATH.down, 12)} {m.growthPct >= 0 ? '+' : ''}{m.growthPct.toFixed(1)}%</span></div>
            <div className="hero">{eur(m.cur)}</div>
            <AreaChart data={m.chart} height={96} accent="var(--accent)" />
          </div>

          <div className="panel pad p-cash">
            <div className="ringwrap"><Ring pct={marginFiltered} color={cashFiltered >= 0 ? 'var(--pos)' : 'var(--neg)'} />
              <div className="ringc"><div className="num" style={{ fontSize: 28, color: cashFiltered >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{Math.round(marginFiltered * 100)}%</div><div className="micro" style={{ fontSize: 9.5, marginTop: 2 }}>margine</div></div>
            </div>
            <div>
              <div className="micro" style={{ fontSize: 10.5, letterSpacing: '0.12em', marginBottom: 2 }}>Cashflow · {m.periodLabel}</div>
              <div className="num cashv" style={{ color: cashFiltered >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{seur(cashFiltered)}</div>
              <div className="sub2">Target 25% · {marginFiltered >= 0.25 ? 'superato' : 'sotto'}</div>
            </div>
          </div>

          <div className="panel pad p-due">
            <div className="micro duehd" style={{ marginBottom: dueList.length > 0 ? '10px' : '0' }}>{ic(PATH.cal, 13)} Prossime Scadenze</div>
            {dueList.length > 0 ? (
              <div className="duelist">
                {dueList.slice(0, 3).map((item, idx) => (
                  <div className="duerow" key={idx}>
                    <div className="duedate">
                      {item.date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                    </div>
                    <div className="dueinfo">
                      <div className="duename" title={item.name}>{item.name}</div>
                      <div className="dueprop" title={item.prop}>{item.prop}</div>
                    </div>
                    <div className="num dueamt">−{eur(item.amount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="duenone">{tf === 'GIORNO' ? 'Nessuna scadenza imminente' : 'Nessuna scadenza nel periodo'}</div>
            )}
          </div>

          <div className="panel pad p-flow">
            <div className="ph">
              <h3>{propId === 'ALL' ? 'Entrate vs Uscite' : 'Trend per Categoria'}</h3>
              <div className="leg2" style={{ flexWrap: 'wrap', justifyContent: 'flex-end', gap: '8px' }}>
                {propId === 'ALL' ? (
                  <>
                    <span className="micro"><span className="ln a" />Entrate</span>
                    <span className="micro"><span className="ln n" />Uscite</span>
                  </>
                ) : (
                  m.trendCategories?.map(cat => (
                    <span className="micro" key={cat.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span className="dot" style={{ background: cat.color, width: '8px', height: '8px', borderRadius: '50%' }} />
                      {cat.name}
                    </span>
                  ))
                )}
              </div>
            </div>
            {propId === 'ALL' ? (
              <DualLine data={filteredChartData} height={230} />
            ) : (
              <CategoryTrendChart data={filteredChartData} categories={filteredTrendCategories} height={230} />
            )}
          </div>

          <div className="panel pad p-split">
            <div className="ph"><h3>Ripartizione Uscite</h3><span className="micro">{m.periodLabel}</span></div>
            <div className="splitrow">
              <div className="donutwrap">
                <Donut items={activeCats} size={136} onToggleCategory={toggleCategory} />
                <div className="donutc">
                  <div className="num" style={{ fontSize: 18 }}>{eur(periodExpFiltered)}</div>
                  <div className="micro" style={{ fontSize: 9.5, marginTop: 2 }}>totale</div>
                </div>
              </div>
              <div className="leglist">
                {m.cats.length ? m.cats.map(c => {
                  const isExcluded = excludedCategories.includes(c.id);
                  return (
                    <div 
                      className="legrow" 
                      key={c.id} 
                      onClick={() => toggleCategory(c.id)} 
                      style={{ 
                        cursor: 'pointer', 
                        opacity: isExcluded ? 0.35 : 1, 
                        textDecoration: isExcluded ? 'line-through' : 'none',
                        transition: 'opacity 0.2s, text-decoration 0.2s'
                      }}
                    >
                      <span className="dot" style={{ background: c.color }} />
                      <span className="nm">{c.name}</span>
                      <span className="num">{eur(c.v)}</span>
                    </div>
                  );
                }) : <span className="muted">Nessuna uscita nel periodo</span>}
              </div>
            </div>
          </div>

          <div className="panel pad p-list">
            <div className="ph">
              <h3>Immobili in Portafoglio</h3>
              <span className="micro">{m.scope.length} asset · Rend. Portafoglio: {averageNetCapRate.toFixed(2)}%</span>
            </div>
            <div className="rows">
              {m.scope.map(p => { const cash = p.inc - p.exp; const col = cash > 0 ? 'var(--pos)' : cash < 0 ? 'var(--neg)' : 'var(--faint)'; const st = STATUS[p.status];
                const netCapRate = getPropertyNetCapRate(p);
                return <div className="prow" key={p.id} onClick={() => setPropId(propId === p.id ? 'ALL' : p.id)} style={{ cursor: 'pointer' }}>
                  <div className="tag2">{p.code}</div>
                  <div className="pmin"><div className="pname">{p.name} {st && <span className={`badge ${st.c}`}>{st.t}</span>}</div><div className="paddr">{p.address}</div></div>
                  <div className="num" style={{ fontSize: 13 }}>{eur(p.cur)}</div>
                  <div className="num accent" style={{ fontSize: 13, color: 'var(--accent)' }}>{netCapRate.toFixed(2)}%<span className="perm">net</span></div>
                  <div className="num" style={{ fontSize: 13, color: col }}>{cash === 0 ? '€ 0' : seur(cash)}<span className="perm">/m</span></div>
                </div>; })}
            </div>
          </div>

          <div className="panel pad p-map">
            <div className="ph"><h3>Mappa</h3><span className="micro">{propId === 'ALL' ? 'Portafoglio' : '1 selezionato'}</span></div>
            <MiniMap scope={m.scope} all={derived} selectedId={propId} theme={theme} onSelectProperty={setPropId} />
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

function DatePicker({ tf, view, setView, anchor, onCommit, pickRef }: any) {
  const a = anchor;
  if (tf === 'GIORNO') {
    const dim = daysInMonth(view.y, view.m), first = (jsDow(view.y, view.m, 1) + 6) % 7; const cells: any[] = [];
    for (let i = 0; i < first; i++) cells.push(<span className="ccell" key={'e' + i} />);
    for (let d = 1; d <= dim; d++) { const sel = a.y === view.y && a.m === view.m && a.d === d, now = NOW.y === view.y && NOW.m === view.m && NOW.d === d;
      cells.push(<button className={`ccell day${sel ? ' sel' : ''}${now ? ' today' : ''}`} key={d} onClick={() => onCommit({ y: view.y, m: view.m, d })}>{d}</button>); }
    return <div className="pickpop" ref={pickRef}><div className="pophint">Seleziona giorno</div>
      <div className="pophead"><button className="pnav" onClick={() => setView(addMonths(view.y, view.m, -1))}>{ic(PATH.chevL, 15)}</button><span className="ptitle">{MF[view.m]} {view.y}</span><button className="pnav" onClick={() => setView(addMonths(view.y, view.m, 1))}>{ic(PATH.chevR, 15)}</button></div>
      <div className="dow">{['L','M','M','G','V','S','D'].map((d, i) => <span key={i}>{d}</span>)}</div><div className="cal">{cells}</div>
      <button className="todaybtn" onClick={() => onCommit({ ...NOW })}>Oggi</button></div>;
  }
  if (tf === 'ANNO') {
    const base = Math.floor(view.y / 12) * 12; const cells = [];
    for (let i = 0; i < 12; i++) { const yy = base + i, sel = a.y === yy, now = NOW.y === yy; cells.push(<button className={`mcell${sel ? ' sel' : ''}${now ? ' now' : ''}`} key={yy} onClick={() => onCommit({ ...a, y: yy })}>{yy}</button>); }
    return <div className="pickpop" ref={pickRef}><div className="pophint">Seleziona anno</div>
      <div className="pophead"><button className="pnav" onClick={() => setView({ ...view, y: view.y - 12 })}>{ic(PATH.chevL, 15)}</button><span className="ptitle">{base}–{base + 11}</span><button className="pnav" onClick={() => setView({ ...view, y: view.y + 12 })}>{ic(PATH.chevR, 15)}</button></div>
      <div className="mgrid">{cells}</div><button className="todaybtn" onClick={() => onCommit({ ...NOW })}>Oggi</button></div>;
  }
  const cells = MA.map((mm, i) => { const sel = a.y === view.y && a.m === i, now = NOW.y === view.y && NOW.m === i; return <button className={`mcell${sel ? ' sel' : ''}${now ? ' now' : ''}`} key={i} onClick={() => onCommit({ ...a, y: view.y, m: i })}>{mm}</button>; });
  return <div className="pickpop" ref={pickRef}><div className="pophint">{tf === '6M' ? 'Mese finale (6 mesi)' : 'Seleziona mese'}</div>
    <div className="pophead"><button className="pnav" onClick={() => setView({ ...view, y: view.y - 1 })}>{ic(PATH.chevL, 15)}</button><span className="ptitle">{view.y}</span><button className="pnav" onClick={() => setView({ ...view, y: view.y + 1 })}>{ic(PATH.chevR, 15)}</button></div>
    <div className="mgrid">{cells}</div><button className="todaybtn" onClick={() => onCommit({ ...NOW })}>Oggi</button></div>;
}

const IPB_DASH_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&display=swap');
.ipb{ position: relative; --font:'Geist','DM Sans',system-ui,sans-serif; --mono:'Geist Mono',ui-monospace,monospace;
  --bg:#0a0e16; --panel:#111827; --panel-2:#151d2d; --inset:#0c121e; --border:rgba(255,255,255,.07); --border-2:rgba(255,255,255,.12);
  --text:#eaeff7; --dim:#8b97ab; --faint:#58637a; --accent:#2f8fff; --accent-2:#6f63ff; --accent-soft:rgba(47,143,255,.14); --glow:rgba(47,143,255,.28);
  --pos:#2fd6a3; --pos-soft:rgba(47,214,163,.14); --neg:#fb6f86; --neg-soft:rgba(251,111,134,.14); --warn:#f5b942; --warn-soft:rgba(245,185,66,.14);
  --indigo:#8b8bff; --indigo-soft:rgba(139,139,255,.12); --grid-line:rgba(255,255,255,.05); --r:11px; --r-sm:8px; --r-lg:16px;
  font-family:var(--font); color:var(--text); text-align:left; }
.ipb.light{ --bg:#f4f6fb; --panel:#fff; --panel-2:#fff; --inset:#f1f4f9; --border:rgba(15,23,42,.09); --border-2:rgba(15,23,42,.16);
  --text:#0c1424; --dim:#5a6679; --faint:#9aa6bb; --accent:#0a6cff; --accent-2:#5b4bff; --accent-soft:rgba(10,108,255,.10); --glow:rgba(10,108,255,.18);
  --pos:#0fa47a; --pos-soft:rgba(15,164,122,.12); --neg:#e23d63; --neg-soft:rgba(226,61,99,.10); --warn:#d98a0b; --warn-soft:rgba(217,138,11,.12);
  --indigo:#5b4bff; --indigo-soft:rgba(91,75,255,.10); --grid-line:rgba(15,23,42,.06); }
.ipb *{ box-sizing:border-box; }
.ipb .body{ display:flex; flex-direction:column; gap:18px; }
.ipb .micro{ font-family:var(--mono); font-size:10px; font-weight:500; letter-spacing:.12em; text-transform:uppercase; color:var(--faint); }
.ipb .num{ font-family:var(--mono); font-weight:600; letter-spacing:-.01em; color:var(--text); font-feature-settings:"tnum" 1; }
.ipb .muted{ color:var(--faint); font-size:12px; } .ipb .loading{ padding:80px; text-align:center; color:var(--faint); font-family:var(--mono); font-size:13px; }
.ipb .dot{ width:7px; height:7px; border-radius:50%; display:inline-block; flex:none; }
.ipb .chip{ display:inline-flex; align-items:center; gap:5px; font-family:var(--mono); font-size:10.5px; font-weight:600; padding:4px 8px; border-radius:7px; }
.ipb .chip.pos{ color:var(--pos); background:var(--pos-soft);} .ipb .chip.neg{ color:var(--neg); background:var(--neg-soft);}
.ipb .panel{ background:var(--panel); border:1px solid var(--border); border-radius:var(--r); position:relative; }
.ipb .panel.pad{ padding:20px; }
.ipb .ph{ display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.ipb .ph h3{ margin:0; font-size:13px; font-weight:600; }

.ipb .phead{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; }
.ipb .phead .eyebrow{ font-family:var(--mono); font-size:10px; font-weight:600; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); }
.ipb .phead h2{ margin:4px 0 0; font-size:24px; font-weight:700; }
.ipb .ctrls{ display:flex; align-items:center; gap:8px; flex-wrap:nowrap; }
.ipb .selbox{ position:relative; display:inline-flex; align-items:center; flex-shrink:1; min-width: 0; }
.ipb .selbox .lic{ position:absolute; left:10px; color:var(--dim); display:grid; pointer-events:none; }
.ipb .selbox select{ appearance:none; -webkit-appearance:none; background:var(--inset); border:1px solid var(--border); color:var(--text); font-family:var(--font); font-size:12.5px; font-weight:500; padding:7px 26px 7px 28px; border-radius:8px; cursor:pointer; outline:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238b97ab' stroke-width='2.4' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 8px center; text-overflow:ellipsis; }
.ipb .selbox select:focus{ border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
.ipb .seg{ display:inline-flex; gap:2px; padding:3px; background:var(--inset); border:1px solid var(--border); border-radius:8px; flex-shrink:0; }
.ipb .seg button{ border:none; background:transparent; cursor:pointer; font-family:var(--mono); font-size:10.5px; font-weight:500; letter-spacing:.02em; color:var(--dim); padding:5px 9px; border-radius:7px; }
.ipb .seg button.on{ background:var(--panel); color:var(--text); box-shadow:0 1px 0 var(--border-2); }
.ipb .datectl{ display:inline-flex; align-items:center; gap:2px; background:var(--inset); border:1px solid var(--border); border-radius:8px; padding:2px; flex-shrink:0; }
.ipb .datectl .dnav{ width:26px; height:26px; border:none; background:transparent; color:var(--dim); cursor:pointer; border-radius:6px; display:grid; place-items:center; }
.ipb .datectl .dnav:hover{ color:var(--text); background:var(--panel); }
.ipb .datectl .dlabel{ display:inline-flex; align-items:center; gap:8px; border:none; background:transparent; color:var(--text); font-family:var(--font); font-size:12.5px; font-weight:600; padding:5px 10px; border-radius:6px; cursor:pointer; white-space:nowrap; min-width:110px; justify-content:center; }
.ipb .datectl .dlabel:hover{ background:var(--panel); } .ipb .datectl .dlabel .clc{ color:var(--accent); display:grid; }

@media (max-width: 1000px) {
  .ipb .selbox select {
    max-width: 110px;
    font-size: 11px;
    padding: 5px 20px 5px 22px;
    background-position: right 6px center;
  }
  .ipb .seg {
    padding: 2px;
  }
  .ipb .seg button {
    padding: 3px 6px;
    font-size: 9.5px;
    border-radius: 6px;
  }
  .ipb .datectl .dnav {
    width: 24px;
    height: 24px;
  }
  .ipb .datectl .dlabel {
    font-size: 11px;
    padding: 3px 6px;
    min-width: 80px;
    gap: 4px;
  }
  .ipb .ctrls {
    gap: 4px;
  }
}

.ipb .bento{ display:grid; grid-template-columns:repeat(12,1fr); gap:16px; }
.ipb .p-value{ grid-column:span 5; display:flex; flex-direction:column; gap:14px; }
.ipb .p-value .hero{ font-family:var(--mono); font-size:40px; font-weight:600; letter-spacing:-.03em; }
.ipb .p-cash{ grid-column:span 4; display:flex; gap:26px; align-items:center; justify-content:flex-start; padding:22px 28px; }
.ipb .p-cash .ringwrap{ position:relative; flex:none; width:136px; height:136px; }
.ipb .p-cash .ringc{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
.ipb .p-cash .cashv{ font-size:36px; font-weight:700; margin:6px 0 2px; } .ipb .p-cash .sub2{ font-size:13px; color:var(--dim); }
.ipb .p-due{ grid-column:span 3; display:flex; flex-direction:column; }
.ipb .p-due .duehd{ display:flex; align-items:center; gap:8px; }
.ipb .p-due .duelist { display:flex; flex-direction:column; gap:4px; flex:1; justify-content:center; }
.ipb .p-due .duerow { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:6px 0; border-bottom:1px dashed var(--border); }
.ipb .p-due .duerow:last-child { border-bottom:none; }
.ipb .p-due .duedate { font-family:var(--mono); font-size:10px; font-weight:600; color:var(--accent); background:var(--accent-soft); padding:3px 6px; border-radius:5px; white-space:nowrap; flex-shrink:0; }
.ipb .p-due .dueinfo { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.ipb .p-due .duename { font-size:11px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ipb .p-due .dueprop { font-size:9.5px; color:var(--faint); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ipb .p-due .dueamt { font-size:11px; font-weight:700; color:var(--neg); white-space:nowrap; flex-shrink:0; }
.ipb .p-due .duenone{ font-size:12px; color:var(--faint); margin-top:12px; }
.ipb .p-flow{ grid-column:span 7; } .ipb .p-flow .leg2{ display:flex; gap:14px; } .ipb .p-flow .leg2 .micro{ display:flex; align-items:center; gap:6px; } .ipb .ln{ width:10px; height:2px; } .ipb .ln.a{ background:var(--accent);} .ipb .ln.n{ background:var(--neg);}
.ipb .p-split{ grid-column:span 5; }
.ipb .p-split .splitrow{ display:flex; gap:32px; align-items:center; padding:10px 14px; }
.ipb .donutwrap{ position:relative; flex:none; width:136px; height:136px; }
.ipb .donutc{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
.ipb .leglist{ flex:1; display:flex; flex-direction:column; gap:4px; }
.ipb .legrow{ display:flex; align-items:center; gap:12px; padding:6px 0; border-bottom:1px solid var(--border); }
.ipb .legrow:last-child{ border-bottom:none; }
.ipb .legrow .nm{ font-size:13.5px; color:var(--text); font-weight:500; flex:1; }
.ipb .legrow .num{ font-size:14px; font-weight:700; color:var(--text); }
.ipb .p-list{ grid-column:span 8; }
.ipb .rows .prow{ display:grid; grid-template-columns:30px 1.5fr 1fr 1fr 1.2fr; gap:14px; align-items:center; padding:11px 4px; border-top:1px solid var(--border); }
.ipb .rows .prow:first-child{ border-top:none; }
.ipb .tag2{ width:30px; height:30px; border-radius:8px; background:var(--accent-soft); color:var(--accent); display:grid; place-items:center; font-family:var(--mono); font-size:10px; font-weight:700; flex:none; }
.ipb .pmin{ min-width:0; } .ipb .pname{ font-size:13px; font-weight:600; display:flex; align-items:center; gap:8px; } .ipb .paddr{ font-size:11px; color:var(--faint); margin-top:1px; }
.ipb .perm{ color:var(--faint); font-size:10px; }
.ipb .badge{ font-family:var(--mono); font-size:8px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; padding:3px 6px; border-radius:5px; }
.ipb .b-rent{ background:var(--pos-soft); color:var(--pos);} .ipb .b-cant{ background:var(--warn-soft); color:var(--warn);} .ipb .b-empty{ background:var(--neg-soft); color:var(--neg);} .ipb .b-main{ background:var(--indigo-soft); color:var(--indigo);}
.ipb .p-map{ grid-column:span 4; display:flex; flex-direction:column; }

.ipb .chartbox{ position:relative; }
.ipb svg{ display:block; overflow:visible; }
.ipb .tip{ position:absolute; pointer-events:none; transform:translate(-50%,-120%); background:var(--panel-2); border:1px solid var(--border-2); border-radius:9px; padding:8px 11px; box-shadow:0 12px 30px -10px rgba(0,0,0,.6); white-space:nowrap; z-index:5; }
.ipb .tip .tlab{ font-family:var(--mono); font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); margin-bottom:4px; }
.ipb .tip .trow{ display:flex; align-items:center; justify-content:space-between; gap:14px; font-size:11px; padding:1px 0; } .ipb .tip .trow .nm{ display:flex; align-items:center; gap:6px; color:var(--dim); }

.ipb .map{ position:relative; flex:1; min-height:220px; border-radius:var(--r-sm); background:var(--inset); overflow:hidden; border:1px solid var(--border); }
.ipb .map.empty{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:var(--faint); font-size:11.5px; }
.ipb .custom-map-pin{ overflow:visible !important; }
.ipb .leaflet-container { outline:none; }

/* leaflet popup overrides */
.ipb .leaflet-popup-content-wrapper {
  background: var(--panel-2) !important;
  color: var(--text) !important;
  border: 1px solid var(--border-2) !important;
  border-radius: var(--r-sm) !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important;
  font-family: var(--font) !important;
  padding: 0 !important;
}
.ipb .leaflet-popup-tip {
  background: var(--panel-2) !important;
  border: 1px solid var(--border-2) !important;
}
.ipb .leaflet-popup-content {
  margin: 10px 14px !important;
  font-size: 11.5px !important;
  line-height: 1.4 !important;
}
.ipb .leaflet-popup-close-button {
  color: var(--dim) !important;
  font-size: 14px !important;
}
.ipb .leaflet-popup-close-button:hover {
  color: var(--text) !important;
}

.ipb .pickpop{ position:absolute; right:0; top:38px; z-index:60; background:var(--panel-2); border:1px solid var(--border-2); border-radius:14px; box-shadow:0 24px 60px -20px rgba(0,0,0,.7); padding:14px; width:272px; }
.ipb .pophint{ font-family:var(--mono); font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); margin:0 0 9px; }
.ipb .pophead{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; } .ipb .pophead .ptitle{ font-size:13px; font-weight:600; }
.ipb .pophead .pnav{ width:28px; height:28px; border:1px solid var(--border); background:var(--inset); color:var(--dim); border-radius:8px; cursor:pointer; display:grid; place-items:center; } .ipb .pophead .pnav:hover{ color:var(--text); border-color:var(--border-2); }
.ipb .dow{ display:grid; grid-template-columns:repeat(7,1fr); gap:2px; margin-bottom:4px; } .ipb .dow span{ text-align:center; font-family:var(--mono); font-size:9px; color:var(--faint); padding:4px 0; }
.ipb .cal{ display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
.ipb .ccell{ height:32px; border:none; background:transparent; border-radius:8px; padding:0; }
.ipb .ccell.day{ color:var(--dim); font-family:var(--mono); font-size:12px; cursor:pointer; } .ipb .ccell.day:hover{ background:var(--inset); color:var(--text); }
.ipb .ccell.today{ box-shadow:inset 0 0 0 1px var(--border-2); color:var(--text); } .ipb .ccell.sel{ background:var(--accent); color:#fff; font-weight:700; }
.ipb .mgrid{ display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
.ipb .mcell{ height:40px; border:1px solid var(--border); background:var(--inset); color:var(--dim); border-radius:9px; font-family:var(--mono); font-size:12px; cursor:pointer; } .ipb .mcell:hover{ color:var(--text); border-color:var(--border-2); }
.ipb .mcell.sel{ background:var(--accent); color:#fff; border-color:var(--accent); font-weight:700; } .ipb .mcell.now{ box-shadow:inset 0 0 0 1px var(--border-2); }
.ipb .todaybtn{ margin-top:10px; width:100%; height:32px; border:1px solid var(--border); background:var(--inset); color:var(--dim); border-radius:9px; font-family:var(--mono); font-size:11px; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; } .ipb .todaybtn:hover{ color:var(--text); border-color:var(--border-2); }

@media (max-width:1100px){
  .ipb .p-value,.ipb .p-cash,.ipb .p-due,.ipb .p-flow,.ipb .p-split,.ipb .p-list,.ipb .p-map{ grid-column:span 12; }
}

@media (min-width: 769px) {
  .ipb .phead {
    display: none !important;
  }
}
`;

export default GlobalDashboard;
