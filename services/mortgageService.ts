import {
  Property,
  MortgageSubrogation,
  MortgageRadarSettings,
  BankMortgageOffer,
  MarketReferenceIndices,
  EvaluatedBankOffer,
  PropertySubrogationOpportunity,
  MortgageRadarReport
} from '../types';
import { getMarketInfo } from './geminiService';


const safeNum = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) || !isFinite(val) ? 0 : val;
  if (typeof val === 'string') {
    const p = parseFloat(val);
    return isNaN(p) || !isFinite(p) ? 0 : p;
  }
  return 0;
};

export const toLocalIsoDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const addYearsToIsoDate = (isoDate: string, years: number): string => {
  const parts = (isoDate || '').split('-');
  if (parts.length < 3) return isoDate;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return isoDate;
  const targetYear = y + Math.max(0, Math.round(years));
  const maxDayInTargetMonth = new Date(targetYear, m, 0).getDate();
  const actualDay = Math.min(d, maxDayInTargetMonth);
  return `${targetYear}-${String(m).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
};

/**
 * Returns all mortgage subrogations for a property sorted chronologically (oldest -> newest).
 */
export const getPropertySubrogations = (
  property?: Property | Partial<Property> | null
): MortgageSubrogation[] => {
  if (!property) return [];
  const rawList: MortgageSubrogation[] = [
    ...(property.financials?.subrogations || []),
    ...(property.subrogations || []),
    ...(property.mortgageSubrogations || [])
  ];
  if (rawList.length === 0) return [];

  const uniqueMap = new Map<string, MortgageSubrogation>();
  rawList.forEach((item, idx) => {
    if (!item || !item.date) return;
    const key = item.id || `${item.date}_${idx}`;
    uniqueMap.set(key, {
      ...item,
      id: key,
      newMonthlyPayment: safeNum(item.newMonthlyPayment),
      newDurationYears: safeNum(item.newDurationYears) > 0 ? safeNum(item.newDurationYears) : 20,
      newRate: item.newRate !== undefined && item.newRate !== null ? safeNum(item.newRate) : undefined,
      residualPrincipal:
        item.residualPrincipal !== undefined && item.residualPrincipal !== null && safeNum(item.residualPrincipal) > 0
          ? safeNum(item.residualPrincipal)
          : undefined
    });
  });

  return Array.from(uniqueMap.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export interface ActiveMortgageState {
  isActive: boolean;
  monthlyPayment: number;
  configuredMonthlyPayment: number;
  rate: number;
  rateType?: 'FIXED' | 'VARIABLE';
  durationYears: number;
  startDate?: string;
  endDate?: string;
  bankName?: string;
  residualPrincipal?: number;
  isSubrogated: boolean;
  subrogationIndex: number; // 0 = original mortgage, 1..N = 1st..Nth subrogation
  activeSubrogation?: MortgageSubrogation;
}

/**
 * Resolves the active mortgage parameters for a property at a given target date.
 * - Before the first subrogation date: uses the original mortgage parameters.
 * - On or after a subrogation date: uses the latest subrogation whose date <= targetDate,
 *   checking whether targetDate is within [subrogation.date, subrogation.date + newDurationYears].
 */
export const getActiveMortgageAtDate = (
  property: Property | Partial<Property> | null | undefined,
  targetDate: Date = new Date(),
  options?: { monthGranularity?: boolean }
): ActiveMortgageState => {
  const monthGranularity = options?.monthGranularity ?? false;
  const fin = property?.financials;
  const baseMonthly = safeNum(fin?.mortgageAmount);
  const baseDuration = safeNum(fin?.mortgageDuration) > 0 ? safeNum(fin?.mortgageDuration) : 20;
  const baseRate = fin?.mortgageRate !== undefined && fin?.mortgageRate !== null && safeNum(fin.mortgageRate) >= 0
    ? safeNum(fin.mortgageRate)
    : 3.5;
  const baseStartStr = fin?.mortgageStartDate || '';
  const baseBankName = fin?.originalBankName;

  const subs = getPropertySubrogations(property);
  const targetIso = isNaN(targetDate.getTime()) ? toLocalIsoDate(new Date()) : toLocalIsoDate(targetDate);
  const targetMonthIso = targetIso.slice(0, 7);

  // Find latest subrogation whose start date <= targetDate
  let matchedSub: MortgageSubrogation | undefined;
  let matchedIndex = -1;

  for (let i = 0; i < subs.length; i++) {
    const s = subs[i];
    const sDate = (s.date || '').trim();
    if (!sDate) continue;
    const isApplicable = monthGranularity
      ? sDate.slice(0, 7) <= targetMonthIso
      : sDate <= targetIso;
    if (isApplicable) {
      matchedSub = s;
      matchedIndex = i;
    }
  }

  if (matchedSub) {
    const subDuration = safeNum(matchedSub.newDurationYears) > 0 ? safeNum(matchedSub.newDurationYears) : baseDuration;
    const subStartStr = matchedSub.date.trim();
    const subEndStr = addYearsToIsoDate(subStartStr, subDuration);
    const subPayment = safeNum(matchedSub.newMonthlyPayment);
    const subRate = matchedSub.newRate !== undefined && matchedSub.newRate !== null
      ? safeNum(matchedSub.newRate)
      : baseRate;

    const inWindow = monthGranularity
      ? targetMonthIso >= subStartStr.slice(0, 7) && targetMonthIso <= subEndStr.slice(0, 7)
      : targetIso >= subStartStr && targetIso <= subEndStr;

    const isActive = inWindow && subPayment > 0;

    return {
      isActive,
      monthlyPayment: isActive ? subPayment : 0,
      configuredMonthlyPayment: subPayment,
      rate: subRate,
      rateType: matchedSub.rateType,
      durationYears: subDuration,
      startDate: subStartStr,
      endDate: subEndStr,
      bankName: matchedSub.bankName || baseBankName,
      residualPrincipal: matchedSub.residualPrincipal,
      isSubrogated: true,
      subrogationIndex: matchedIndex + 1,
      activeSubrogation: matchedSub
    };
  }

  // Original mortgage (before any subrogation, or when no subrogations exist)
  if (baseMonthly <= 0) {
    return {
      isActive: false,
      monthlyPayment: 0,
      configuredMonthlyPayment: 0,
      rate: baseRate,
      durationYears: baseDuration,
      startDate: baseStartStr || undefined,
      bankName: baseBankName,
      isSubrogated: false,
      subrogationIndex: 0
    };
  }

  if (!baseStartStr || isNaN(new Date(baseStartStr).getTime())) {
    return {
      isActive: true,
      monthlyPayment: baseMonthly,
      configuredMonthlyPayment: baseMonthly,
      rate: baseRate,
      durationYears: baseDuration,
      bankName: baseBankName,
      isSubrogated: false,
      subrogationIndex: 0
    };
  }

  const baseEndStr = addYearsToIsoDate(baseStartStr, baseDuration);
  const inWindow = monthGranularity
    ? targetMonthIso >= baseStartStr.slice(0, 7) && targetMonthIso <= baseEndStr.slice(0, 7)
    : targetIso >= baseStartStr && targetIso <= baseEndStr;

  return {
    isActive: inWindow,
    monthlyPayment: inWindow ? baseMonthly : 0,
    configuredMonthlyPayment: baseMonthly,
    rate: baseRate,
    durationYears: baseDuration,
    startDate: baseStartStr,
    endDate: baseEndStr,
    bankName: baseBankName,
    isSubrogated: false,
    subrogationIndex: 0
  };
};

/**
 * Returns the active mortgage state at referenceDate, or if all subrogations are scheduled
 * in the future, returns the latest configured subrogation state (useful for 10-year forward forecasts).
 */
export const getLatestOrActiveMortgage = (
  property: Property | Partial<Property> | null | undefined,
  referenceDate: Date = new Date()
): ActiveMortgageState => {
  const activeNow = getActiveMortgageAtDate(property, referenceDate, { monthGranularity: true });
  if (activeNow.isSubrogated) {
    return activeNow;
  }
  const subs = getPropertySubrogations(property);
  if (subs.length > 0) {
    const latestSub = subs[subs.length - 1];
    const latestDate = new Date(latestSub.date);
    if (!isNaN(latestDate.getTime())) {
      return getActiveMortgageAtDate(property, latestDate, { monthGranularity: true });
    }
  }
  return activeNow;
};

export interface SubrogationTimelineItem {
  subrogation: MortgageSubrogation;
  index: number; // 1-based
  previousMonthlyPayment: number;
  newMonthlyPayment: number;
  monthlySavings: number; // positive = savings vs previous
  annualSavings: number;
  totalDurationSavings: number; // savings over newDurationYears
  remainingDurationSavings: number; // savings over remaining months from today
  cumulativeMonthlySavingsVsOriginal: number;
  endDate: string;
  totalMonths: number;
  elapsedMonths: number;
  remainingMonths: number;
  status: 'ACTIVE' | 'REPLACED' | 'UPCOMING' | 'EXPIRED';
}

/**
 * Computes the chronological timeline of subrogations with automatic savings metrics:
 * - Risparmio Mensile (€/mese)
 * - Risparmio Annuo (€/anno)
 * - Risparmio Stimato Residuo & Totale rispetto alla rata precedente
 */
export const calculateSubrogationTimeline = (
  property: Property | Partial<Property> | null | undefined,
  referenceDate: Date = new Date()
): {
  originalMonthlyPayment: number;
  originalRate: number;
  originalDurationYears: number;
  originalStartDate?: string;
  originalBankName?: string;
  items: SubrogationTimelineItem[];
  activeState: ActiveMortgageState;
} => {
  const fin = property?.financials;
  const originalMonthlyPayment = safeNum(fin?.mortgageAmount);
  const originalDurationYears = safeNum(fin?.mortgageDuration) > 0 ? safeNum(fin?.mortgageDuration) : 20;
  const originalRate = fin?.mortgageRate !== undefined && fin?.mortgageRate !== null ? safeNum(fin.mortgageRate) : 0;
  const originalStartDate = fin?.mortgageStartDate;
  const originalBankName = fin?.originalBankName;

  const subs = getPropertySubrogations(property);
  const activeState = getActiveMortgageAtDate(property, referenceDate, { monthGranularity: true });
  const refIso = toLocalIsoDate(referenceDate);
  const refMonthIso = refIso.slice(0, 7);

  let prevPayment = originalMonthlyPayment;
  const items: SubrogationTimelineItem[] = subs.map((sub, i) => {
    const newPayment = safeNum(sub.newMonthlyPayment);
    const effectivePrev = prevPayment > 0 ? prevPayment : newPayment;
    const monthlySavings = effectivePrev - newPayment;
    const annualSavings = monthlySavings * 12;

    const durYears = safeNum(sub.newDurationYears) > 0 ? safeNum(sub.newDurationYears) : originalDurationYears;
    const totalMonths = durYears * 12;
    const endDate = addYearsToIsoDate(sub.date, durYears);

    const startParts = sub.date.split('-');
    const startY = parseInt(startParts[0], 10) || referenceDate.getFullYear();
    const startM = (parseInt(startParts[1], 10) || 1) - 1;
    const rawElapsed = (referenceDate.getFullYear() - startY) * 12 + (referenceDate.getMonth() - startM);
    const elapsedMonths = Math.max(0, Math.min(totalMonths, rawElapsed));
    const remainingMonths = Math.max(0, totalMonths - elapsedMonths);

    const totalDurationSavings = monthlySavings * totalMonths;
    const remainingDurationSavings = monthlySavings * (rawElapsed < 0 ? totalMonths : remainingMonths);
    const cumulativeMonthlySavingsVsOriginal =
      originalMonthlyPayment > 0 ? originalMonthlyPayment - newPayment : monthlySavings;

    let status: 'ACTIVE' | 'REPLACED' | 'UPCOMING' | 'EXPIRED' = 'ACTIVE';
    if (sub.date.slice(0, 7) > refMonthIso) {
      status = 'UPCOMING';
    } else if (activeState.activeSubrogation?.id === sub.id) {
      status = activeState.isActive ? 'ACTIVE' : 'EXPIRED';
    } else if (i < subs.length - 1) {
      status = 'REPLACED';
    } else if (refMonthIso > endDate.slice(0, 7)) {
      status = 'EXPIRED';
    }

    prevPayment = newPayment;

    return {
      subrogation: sub,
      index: i + 1,
      previousMonthlyPayment: effectivePrev,
      newMonthlyPayment: newPayment,
      monthlySavings,
      annualSavings,
      totalDurationSavings,
      remainingDurationSavings,
      cumulativeMonthlySavingsVsOriginal,
      endDate,
      totalMonths,
      elapsedMonths,
      remainingMonths,
      status
    };
  });

  return {
    originalMonthlyPayment,
    originalRate,
    originalDurationYears,
    originalStartDate,
    originalBankName,
    items,
    activeState
  };
};

/**
 * Calculates mortgage progress stats (percent, paid, remaining, active bank, subrogation flag)
 * for PropertyAssetManager cards and detail views.
 */
export const calculatePropertyMortgageStats = (
  property: Property | Partial<Property> | null | undefined,
  referenceDate: Date = new Date()
): {
  percent: number;
  paid: number;
  remaining: number;
  totalToPay: number;
  elapsedMonths: number;
  totalMonths: number;
  monthlyInstallment: number;
  isSubrogated: boolean;
  bankName?: string;
  rate?: number;
} | null => {
  if (!property) return null;
  const active = getActiveMortgageAtDate(property, referenceDate, { monthGranularity: true });
  if (!active.configuredMonthlyPayment || !active.durationYears || !active.startDate) {
    return null;
  }

  const parseYearMonth = (iso?: string): { y: number; m: number } | null => {
    if (!iso) return null;
    const parts = iso.trim().split('-');
    if (parts.length < 2) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    if (isNaN(y) || isNaN(m)) return null;
    return { y, m };
  };

  const diffMonths = (start: { y: number; m: number }, end: { y: number; m: number }): number => {
    return Math.max(0, (end.y - start.y) * 12 + (end.m - start.m));
  };

  const activeStart = parseYearMonth(active.startDate);
  if (!activeStart) return null;

  const refYM = { y: referenceDate.getFullYear(), m: referenceDate.getMonth() };
  const installment = safeNum(active.configuredMonthlyPayment);
  const activeTotalMonths = active.durationYears * 12;
  const activeElapsedMonths = Math.max(0, Math.min(diffMonths(activeStart, refYM), activeTotalMonths));
  const activeRemainingMonths = Math.max(0, activeTotalMonths - activeElapsedMonths);

  // Accumulate installments paid in prior windows (original mortgage + superseded subrogations)
  let priorPaid = 0;
  let priorElapsedMonths = 0;

  if (active.isSubrogated && active.subrogationIndex > 0) {
    const subs = getPropertySubrogations(property);
    const fin = property.financials;
    const origPayment = safeNum(fin?.mortgageAmount);
    const origDurationMonths = (safeNum(fin?.mortgageDuration) > 0 ? safeNum(fin?.mortgageDuration) : 20) * 12;
    const origStart = parseYearMonth(fin?.mortgageStartDate || property.purchaseDate);
    const firstSubStart = parseYearMonth(subs[0]?.date);

    if (origPayment > 0 && origStart && firstSubStart) {
      const m0 = Math.min(origDurationMonths, diffMonths(origStart, firstSubStart));
      priorElapsedMonths += m0;
      priorPaid += m0 * origPayment;
    }

    for (let i = 0; i < active.subrogationIndex - 1; i++) {
      const sCurr = subs[i];
      const sNext = subs[i + 1];
      const currStart = parseYearMonth(sCurr?.date);
      const nextStart = parseYearMonth(sNext?.date);
      if (sCurr && currStart && nextStart) {
        const sDurMonths = (safeNum(sCurr.newDurationYears) > 0 ? safeNum(sCurr.newDurationYears) : 20) * 12;
        const mSub = Math.min(sDurMonths, diffMonths(currStart, nextStart));
        priorElapsedMonths += mSub;
        priorPaid += mSub * safeNum(sCurr.newMonthlyPayment);
      }
    }
  }

  const activePaid = installment * activeElapsedMonths;
  const remaining = installment * activeRemainingMonths;
  const paid = priorPaid + activePaid;
  const totalToPay = paid + remaining;
  const elapsedMonths = priorElapsedMonths + activeElapsedMonths;
  const totalMonths = elapsedMonths + activeRemainingMonths;
  const percent = totalToPay > 0 ? (paid / totalToPay) * 100 : (totalMonths > 0 ? (elapsedMonths / totalMonths) * 100 : 0);

  return {
    percent,
    paid,
    remaining,
    totalToPay,
    elapsedMonths,
    totalMonths,
    monthlyInstallment: active.monthlyPayment || installment,
    isSubrogated: active.isSubrogated,
    bankName: active.bankName,
    rate: active.rate
  };
};

// ============================================================================
// RADAR TASSI BANCHE (ITALIA & MILANO) & CONFRONTO SURROGHE
// ============================================================================

export const DEFAULT_MORTGAGE_RADAR_SETTINGS: MortgageRadarSettings = {
  enabled: true,
  autoTelegramAlert: true,
  minMonthlySavings: 30,
  minRateDeltaBps: 25,
  preferredRateType: 'ALL',
  checkIntervalHours: 24
};

export const getDefaultMarketIndices = (referenceDate: Date = new Date()): MarketReferenceIndices => ({
  irs10Y: 2.38,
  irs15Y: 2.44,
  irs20Y: 2.42,
  irs25Y: 2.36,
  irs30Y: 2.29,
  euribor1M: 2.38,
  euribor3M: 2.42,
  bceRate: 2.50,
  source: 'REFERENCE_BENCHMARK',
  updatedAt: toLocalIsoDate(referenceDate)
});

/**
 * Catalogo delle principali banche nazionali italiane e della piazza di Milano
 * attive nelle surroghe mutuo a costo zero (ex Legge Bersani 40/2007).
 */
export const buildItalianAndMilanBankCatalog = (
  indices: MarketReferenceIndices = getDefaultMarketIndices()
): BankMortgageOffer[] => {
  const irs20 = safeNum(indices.irs20Y) || 2.42;
  const irs25 = safeNum(indices.irs25Y) || 2.36;
  const eur3m = safeNum(indices.euribor3M) || 2.42;
  const updatedAt = indices.updatedAt || toLocalIsoDate(new Date());

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return [
    {
      bankId: 'banco-bpm-milano-fisso',
      bankName: 'Banco BPM (Banca Popolare di Milano)',
      hqCity: 'Milano (Piazza Filippo Meda)',
      isMilanFocused: true,
      productName: 'Mutuo Surroga Promo Fisso Last Minute / Green Milano',
      rateType: 'FIXED',
      referenceIndex: 'IRS 20A',
      referenceIndexRate: irs20,
      spread: 0.15,
      tan: round2(irs20 + 0.15),
      taeg: round2(irs20 + 0.27),
      greenTan: round2(irs20 - 0.05),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Sede storica Milano Piazza Meda · Surroga zero spese + sconto extra -20 bps per immobili Classe A/B/C',
      sourceUrl: 'https://www.bancobpm.it/privati/mutui/',
      updatedAt
    },
    {
      bankId: 'webank-bpm-milano-fisso',
      bankName: 'Webank (Gruppo Banco BPM Milano)',
      hqCity: 'Milano (Via Massaua)',
      isMilanFocused: true,
      productName: 'Mutuo Webank Surroga Fisso Zero Spese Online',
      rateType: 'FIXED',
      referenceIndex: 'IRS 20A',
      referenceIndexRate: irs20,
      spread: 0.12,
      tan: round2(irs20 + 0.12),
      taeg: round2(irs20 + 0.20),
      greenTan: round2(irs20 - 0.07),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Polo digitale Gruppo Banco BPM Milano · Perizia, istruttoria e incasso rata 100% gratuiti',
      sourceUrl: 'https://www.webank.it/webankpub/wb/prodotti.do?tab=Mutui',
      updatedAt
    },
    {
      bankId: 'intesa-sanpaolo-fisso',
      bankName: 'Intesa Sanpaolo',
      hqCity: 'Milano / Torino',
      isMilanFocused: true,
      productName: 'Mutuo Domus Surroga Fisso (Piano Base & Mutuo Green)',
      rateType: 'FIXED',
      referenceIndex: 'IRS 20A',
      referenceIndexRate: irs20,
      spread: 0.18,
      tan: round2(irs20 + 0.18),
      taeg: round2(irs20 + 0.31),
      greenTan: round2(irs20 - 0.04),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Direzione Regionale Milano e Lombardia · Condizioni dedicate Under 36 e Mutuo Green',
      sourceUrl: 'https://www.intesasanpaolo.com/it/persone-e-famiglie/prodotti/mutui.html',
      updatedAt
    },
    {
      bankId: 'credit-agricole-milano-fisso',
      bankName: 'Crédit Agricole Italia',
      hqCity: 'Milano / Parma',
      isMilanFocused: true,
      productName: 'Mutuo Crédit Agricole Surroga Greenback Fisso',
      rateType: 'FIXED',
      referenceIndex: 'IRS 25A',
      referenceIndexRate: irs25,
      spread: 0.14,
      tan: round2(irs25 + 0.14),
      taeg: round2(irs25 + 0.26),
      greenTan: round2(irs25 - 0.06),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Forte presidio filiali Milano · Opzione Flexi e sconto tasso -0.10% su riqualificazione energetica',
      sourceUrl: 'https://www.credit-agricole.it/privati/mutui',
      updatedAt
    },
    {
      bankId: 'mediobanca-premier-milano',
      bankName: 'Mediobanca Premier (ex CheBanca!)',
      hqCity: 'Milano (Via Arrigo Boito / Piazzetta Cuccia)',
      isMilanFocused: true,
      productName: 'Mutuo Surroga Fisso Risparmio & Valore',
      rateType: 'FIXED',
      referenceIndex: 'IRS 20A',
      referenceIndexRate: irs20,
      spread: 0.22,
      tan: round2(irs20 + 0.22),
      taeg: round2(irs20 + 0.35),
      greenTan: round2(irs20 + 0.03),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Gruppo Mediobanca Milano · Gestione fast-track per immobili residenziali a Milano e provincia',
      sourceUrl: 'https://www.mediobancapremier.com/it/privati/mutui.html',
      updatedAt
    },
    {
      bankId: 'unicredit-milano-fisso',
      bankName: 'UniCredit',
      hqCity: 'Milano (Piazza Gae Aulenti)',
      isMilanFocused: true,
      productName: 'Mutuo UniCredit Surroga Sostenibilità Energetica Fisso',
      rateType: 'FIXED',
      referenceIndex: 'IRS 20A',
      referenceIndexRate: irs20,
      spread: 0.23,
      tan: round2(irs20 + 0.23),
      taeg: round2(irs20 + 0.36),
      greenTan: round2(irs20 + 0.02),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Headquarter Piazza Gae Aulenti Milano · Taglio rata per immobili in classe energetica A, B o C',
      sourceUrl: 'https://www.unicredit.it/it/privati/mutui.html',
      updatedAt
    },
    {
      bankId: 'ing-milano-fisso',
      bankName: 'ING Italia',
      hqCity: 'Milano (Viale Fulvio Testi)',
      isMilanFocused: true,
      productName: 'Mutuo Arancio Surroga Tasso Fisso',
      rateType: 'FIXED',
      referenceIndex: 'IRS 20A',
      referenceIndexRate: irs20,
      spread: 0.20,
      tan: round2(irs20 + 0.20),
      taeg: round2(irs20 + 0.30),
      greenTan: round2(irs20),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Direzione Generale Milano Bicocca · Extra sconto -0.20% con addebito su Conto Corrente Arancio',
      sourceUrl: 'https://www.ing.it/mutuo-arancio/mutuo-surroga.html',
      updatedAt
    },
    {
      bankId: 'finecobank-milano-fisso',
      bankName: 'FinecoBank',
      hqCity: 'Milano (Piazza Durante)',
      isMilanFocused: true,
      productName: 'Mutuo Fineco Surroga Fisso / Green',
      rateType: 'FIXED',
      referenceIndex: 'IRS 20A',
      referenceIndexRate: irs20,
      spread: 0.25,
      tan: round2(irs20 + 0.25),
      taeg: round2(irs20 + 0.37),
      greenTan: round2(irs20 + 0.05),
      maxLtv: 75,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Sede centrale Milano Piazza Durante · Istruttoria digitale rapida per clienti e nuovi correntisti',
      sourceUrl: 'https://finecobank.com/it/online/mutui/surroga/',
      updatedAt
    },
    {
      bankId: 'bnl-bnp-paribas-fisso',
      bankName: 'BNL BNP Paribas',
      hqCity: 'Milano / Roma',
      isMilanFocused: true,
      productName: 'Mutuo BNL Surroga Trasformazione & Futuro Sostenibile',
      rateType: 'FIXED',
      referenceIndex: 'IRS 20A',
      referenceIndexRate: irs20,
      spread: 0.24,
      tan: round2(irs20 + 0.24),
      taeg: round2(irs20 + 0.38),
      greenTan: round2(irs20 + 0.04),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Torre Diamante Milano Porta Nuova · Surroga a zero spese notarili e peritali',
      sourceUrl: 'https://bnl.it/it/individui-e-famiglie/mutui',
      updatedAt
    },
    {
      bankId: 'bper-banca-fisso',
      bankName: 'BPER Banca',
      hqCity: 'Milano / Modena',
      isMilanFocused: false,
      productName: 'Mutuo Surroga BPER Tasso Fisso Pro',
      rateType: 'FIXED',
      referenceIndex: 'IRS 20A',
      referenceIndexRate: irs20,
      spread: 0.19,
      tan: round2(irs20 + 0.19),
      taeg: round2(irs20 + 0.32),
      greenTan: round2(irs20 - 0.01),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Rete ex UBI / Carige / BPER su Milano e Lombardia · Condizioni agevolate LTV <= 70%',
      sourceUrl: 'https://www.bper.it/privati/mutui-e-prestiti/mutui',
      updatedAt
    },
    {
      bankId: 'popolare-sondrio-milano',
      bankName: 'Banca Popolare di Sondrio',
      hqCity: 'Milano / Sondrio',
      isMilanFocused: true,
      productName: 'Mutuo Surroga Chirografario & Ipotecario Fisso Lombardia',
      rateType: 'FIXED',
      referenceIndex: 'IRS 20A',
      referenceIndexRate: irs20,
      spread: 0.21,
      tan: round2(irs20 + 0.21),
      taeg: round2(irs20 + 0.33),
      greenTan: round2(irs20 + 0.03),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Storica presenza su Milano e Lombardia · Zero penali e perizia a carico della banca',
      sourceUrl: 'https://www.popso.it/privati/mutui',
      updatedAt
    },
    {
      bankId: 'credem-banca-fisso',
      bankName: 'Credem Banca',
      hqCity: 'Milano / Reggio Emilia',
      isMilanFocused: false,
      productName: 'Mutuo Surroga Credem Tasso Fisso Garantito',
      rateType: 'FIXED',
      referenceIndex: 'IRS 20A',
      referenceIndexRate: irs20,
      spread: 0.17,
      tan: round2(irs20 + 0.17),
      taeg: round2(irs20 + 0.29),
      greenTan: round2(irs20 - 0.03),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Spread competitivo su LTV <= 70% e classi energetiche superiori',
      sourceUrl: 'https://www.credem.it/content/credem/it/privati/mutui-e-prestiti.html',
      updatedAt
    },
    {
      bankId: 'banca-sella-fisso',
      bankName: 'Banca Sella',
      hqCity: 'Milano / Biella',
      isMilanFocused: false,
      productName: 'Mutuo Sella Surroga Tasso Fisso 100% Online',
      rateType: 'FIXED',
      referenceIndex: 'IRS 20A',
      referenceIndexRate: irs20,
      spread: 0.22,
      tan: round2(irs20 + 0.22),
      taeg: round2(irs20 + 0.34),
      greenTan: round2(irs20 + 0.02),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Richiesta e delibera digitale con firma elettronica qualificata',
      sourceUrl: 'https://www.sella.it/banca-online/privati/mutui',
      updatedAt
    },
    {
      bankId: 'banco-bpm-milano-variabile',
      bankName: 'Banco BPM (Banca Popolare di Milano)',
      hqCity: 'Milano (Piazza Filippo Meda)',
      isMilanFocused: true,
      productName: 'Mutuo Surroga Variabile Promo Euribor 3M',
      rateType: 'VARIABLE',
      referenceIndex: 'Euribor 3M',
      referenceIndexRate: eur3m,
      spread: 0.45,
      tan: round2(eur3m + 0.45),
      taeg: round2(eur3m + 0.58),
      greenTan: round2(eur3m + 0.30),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Sede Milano Piazza Meda · Indicizzato Euribor 3M 360gg con opzione passaggio a fisso',
      sourceUrl: 'https://www.bancobpm.it/privati/mutui/',
      updatedAt
    },
    {
      bankId: 'intesa-sanpaolo-variabile',
      bankName: 'Intesa Sanpaolo',
      hqCity: 'Milano / Torino',
      isMilanFocused: true,
      productName: 'Mutuo Domus Surroga Variabile con CAP',
      rateType: 'VARIABLE',
      referenceIndex: 'Euribor 3M',
      referenceIndexRate: eur3m,
      spread: 0.50,
      tan: round2(eur3m + 0.50),
      taeg: round2(eur3m + 0.64),
      greenTan: round2(eur3m + 0.35),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Tasso variabile con tetto massimo (CAP) a tutela dai rialzi BCE',
      sourceUrl: 'https://www.intesasanpaolo.com/it/persone-e-famiglie/prodotti/mutui.html',
      updatedAt
    },
    {
      bankId: 'unicredit-milano-variabile',
      bankName: 'UniCredit',
      hqCity: 'Milano (Piazza Gae Aulenti)',
      isMilanFocused: true,
      productName: 'Mutuo UniCredit Surroga Variabile Euribor 3M',
      rateType: 'VARIABLE',
      referenceIndex: 'Euribor 3M',
      referenceIndexRate: eur3m,
      spread: 0.48,
      tan: round2(eur3m + 0.48),
      taeg: round2(eur3m + 0.61),
      greenTan: round2(eur3m + 0.32),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Headquarter Milano Piazza Gae Aulenti · Sconto spread per classi energetiche A/B',
      sourceUrl: 'https://www.unicredit.it/it/privati/mutui.html',
      updatedAt
    },
    {
      bankId: 'credit-agricole-milano-variabile',
      bankName: 'Crédit Agricole Italia',
      hqCity: 'Milano / Parma',
      isMilanFocused: true,
      productName: 'Mutuo Crédit Agricole Surroga Variabile con CAP',
      rateType: 'VARIABLE',
      referenceIndex: 'Euribor 3M',
      referenceIndexRate: eur3m,
      spread: 0.46,
      tan: round2(eur3m + 0.46),
      taeg: round2(eur3m + 0.59),
      greenTan: round2(eur3m + 0.31),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Rete filiali Milano · Tasso variabile con CAP massimo garantito',
      sourceUrl: 'https://www.credit-agricole.it/privati/mutui',
      updatedAt
    },
    {
      bankId: 'bcc-milano-fisso',
      bankName: 'BCC Milano (Gruppo BCC Iccrea)',
      hqCity: 'Milano / Carugate (Sede Direzionale)',
      isMilanFocused: true,
      productName: 'Mutuo Casa BCC Milano Surroga Tasso Fisso & Green',
      rateType: 'FIXED',
      referenceIndex: 'IRS 20A',
      referenceIndexRate: irs20,
      spread: 0.16,
      tan: round2(irs20 + 0.16),
      taeg: round2(irs20 + 0.28),
      greenTan: round2(irs20 - 0.04),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Maggiore banca cooperativa della Lombardia · Condizioni agevolate Soci BCC Milano e sconto Green',
      sourceUrl: 'https://www.bccmilano.it/privati/mutui',
      updatedAt
    },
    {
      bankId: 'bcc-milano-variabile',
      bankName: 'BCC Milano (Gruppo BCC Iccrea)',
      hqCity: 'Milano / Carugate (Sede Direzionale)',
      isMilanFocused: true,
      productName: 'Mutuo Casa BCC Milano Surroga Variabile Euribor 3M',
      rateType: 'VARIABLE',
      referenceIndex: 'Euribor 3M',
      referenceIndexRate: eur3m,
      spread: 0.44,
      tan: round2(eur3m + 0.44),
      taeg: round2(eur3m + 0.56),
      greenTan: round2(eur3m + 0.29),
      maxLtv: 80,
      zeroExpensesSubrogation: true,
      periziaGratuita: true,
      istruttoriaGratuita: true,
      notes: 'Sportelli a Milano e Città Metropolitana · Surroga zero spese e riduzione spread per Soci e Under 36',
      sourceUrl: 'https://www.bccmilano.it/privati/mutui',
      updatedAt
    }
  ];
};

/**
 * Calcola la rata mensile con ammortamento alla francese.
 */
export const calculateFrenchMonthlyPayment = (
  principal: number,
  annualRatePercent: number,
  totalMonths: number
): number => {
  const C = Math.max(0, safeNum(principal));
  const m = Math.max(1, Math.round(safeNum(totalMonths)));
  const rAnn = Math.max(0, safeNum(annualRatePercent));
  if (C <= 0) return 0;
  if (rAnn <= 0.0001) return Math.round((C / m) * 100) / 100;
  const i = rAnn / 100 / 12;
  const pow = Math.pow(1 + i, m);
  const payment = C * ((i * pow) / (pow - 1));
  return Math.round(payment * 100) / 100;
};

/**
 * Calcola il capitale residuo implicito dato l'importo della rata mensile attuale,
 * il tasso annuo attuale (%) e i mesi residui.
 */
export const calculateImpliedResidualPrincipal = (
  monthlyPayment: number,
  annualRatePercent: number,
  remainingMonths: number
): number => {
  const P = Math.max(0, safeNum(monthlyPayment));
  const m = Math.max(1, Math.round(safeNum(remainingMonths)));
  const rAnn = Math.max(0, safeNum(annualRatePercent));
  if (P <= 0) return 0;
  if (rAnn <= 0.0001) return Math.round(P * m);
  const i = rAnn / 100 / 12;
  const principal = P * ((1 - Math.pow(1 + i, -m)) / i);
  return Math.round(principal);
};

/**
 * Valuta un singolo immobile del portafoglio rispetto al catalogo delle offerte bancarie.
 */
export const evaluatePropertySubrogation = (
  property: Property,
  bankCatalog: BankMortgageOffer[],
  indices: MarketReferenceIndices,
  radarSettings: MortgageRadarSettings = DEFAULT_MORTGAGE_RADAR_SETTINGS,
  referenceDate: Date = new Date()
): PropertySubrogationOpportunity | null => {
  if (!property) return null;

  const active = getActiveMortgageAtDate(property, referenceDate, { monthGranularity: true });
  // Se il mutuo era configurato ma è già scaduto alla data di riferimento, non è più surrogabile
  if (active.configuredMonthlyPayment > 0 && !active.isActive) {
    return null;
  }

  let monthlyPayment = safeNum(active.monthlyPayment);
  let currentRate = safeNum(active.rate);
  let durationYears = safeNum(active.durationYears) > 0 ? safeNum(active.durationYears) : 20;
  let currentBankName = active.bankName || property.financials?.originalBankName || 'Banca Attuale';
  let currentRateType: 'FIXED' | 'VARIABLE' = active.rateType || 'FIXED';

  // Fallback se il mutuo è configurato solo nelle spese ricorrenti
  if (monthlyPayment <= 0 && Array.isArray(property.recurringCosts)) {
    const mortCost = property.recurringCosts.find(c => c.category === 'MORTGAGE' && safeNum(c.amount) > 0);
    if (mortCost) {
      monthlyPayment = mortCost.frequency === 'YEARLY' ? safeNum(mortCost.amount) / 12 : safeNum(mortCost.amount);
    }
  }

  if (monthlyPayment <= 0) return null;

  // Se mortgageAmount è stato inserito come capitale totale (> 10.000 €) invece che come rata mensile
  if (monthlyPayment > 10000) {
    const rateForCalc = currentRate > 0 ? currentRate : 3.5;
    monthlyPayment = calculateFrenchMonthlyPayment(monthlyPayment, rateForCalc, durationYears * 12);
  }

  if (currentRate <= 0) currentRate = 3.5;

  // Calcolo mesi trascorsi e mesi residui
  const totalMonths = durationYears * 12;
  let elapsedMonths = 0;
  const startStr = active.startDate || property.financials?.mortgageStartDate || property.purchaseDate;
  if (startStr) {
    const parts = startStr.trim().split('-');
    if (parts.length >= 2) {
      const sy = parseInt(parts[0], 10);
      const sm = parseInt(parts[1], 10) - 1;
      if (!isNaN(sy) && !isNaN(sm)) {
        const diff = (referenceDate.getFullYear() - sy) * 12 + (referenceDate.getMonth() - sm);
        if (diff >= totalMonths) {
          return null; // Mutuo estinto per scadenza naturale
        }
        elapsedMonths = Math.max(0, diff);
      }
    }
  }

  const remainingMonths = Math.max(12, totalMonths - elapsedMonths);
  const remainingYears = Math.max(1, Math.round(remainingMonths / 12));

  // Capitale residuo coerente con il flusso di rate residue
  const impliedPrincipal = calculateImpliedResidualPrincipal(monthlyPayment, currentRate, remainingMonths);
  const explicitPrincipal = safeNum(active.residualPrincipal);
  const estimatedResidualPrincipal =
    explicitPrincipal > 0 && Math.abs(explicitPrincipal - impliedPrincipal) / Math.max(1, impliedPrincipal) <= 0.15
      ? explicitPrincipal
      : impliedPrincipal;

  const propertyValue = Math.max(1, safeNum(property.currentValue) || safeNum(property.purchasePrice) || estimatedResidualPrincipal * 1.35);
  const estimatedLtv = Math.min(100, Math.round((estimatedResidualPrincipal / propertyValue) * 100));
  const isGreenProperty = ['A', 'B'].includes((property.energyClass || '').toUpperCase());

  // Indice IRS corrispondente alla durata residua effettiva
  const getTargetIrsForDuration = (remY: number): number => {
    if (remY <= 12) return safeNum(indices.irs10Y) || 2.38;
    if (remY <= 17) return safeNum(indices.irs15Y) || 2.44;
    if (remY <= 22) return safeNum(indices.irs20Y) || 2.42;
    if (remY <= 27) return safeNum(indices.irs25Y) || 2.36;
    return safeNum(indices.irs30Y) || 2.29;
  };

  const targetIrs = getTargetIrsForDuration(remainingYears);
  const baseIrs20 = safeNum(indices.irs20Y) || 2.42;
  const ltvSpreadDiscount = estimatedLtv <= 50 ? -0.05 : estimatedLtv > 80 ? 0.15 : 0;

  const minSavings = safeNum(radarSettings.minMonthlySavings) >= 0 ? safeNum(radarSettings.minMonthlySavings) : 30;
  const minBps = safeNum(radarSettings.minRateDeltaBps) >= 0 ? safeNum(radarSettings.minRateDeltaBps) : 25;
  const prefType = radarSettings.preferredRateType || 'ALL';

  const typeFilteredCatalog = bankCatalog.filter(b => {
    if (prefType === 'FIXED' && b.rateType !== 'FIXED') return false;
    if (prefType === 'VARIABLE' && b.rateType !== 'VARIABLE') return false;
    return true;
  });

  const ltvEligibleCatalog = typeFilteredCatalog.filter(b => (safeNum(b.maxLtv) || 80) >= estimatedLtv);
  const filteredCatalog = ltvEligibleCatalog.length > 0 ? ltvEligibleCatalog : typeFilteredCatalog;

  const evaluatedOffers: EvaluatedBankOffer[] = filteredCatalog.map(offer => {
    const isGreenRateApplied = Boolean(isGreenProperty && offer.greenTan !== undefined && offer.greenTan > 0);
    const baseTan = isGreenRateApplied ? safeNum(offer.greenTan) : safeNum(offer.tan);
    const offerBaseIndex = safeNum(offer.referenceIndexRate) || baseIrs20;
    const durationIrsDelta = offer.rateType === 'FIXED' ? targetIrs - offerBaseIndex : 0;
    const adjDelta = offer.rateType === 'FIXED' ? durationIrsDelta + ltvSpreadDiscount : ltvSpreadDiscount;
    const appliedTan = Math.max(0.5, Math.round((baseTan + adjDelta) * 100) / 100);
    const taegDiff = Math.max(0.08, safeNum(offer.taeg) - safeNum(offer.tan));
    const appliedTaeg = Math.round((appliedTan + taegDiff) * 100) / 100;

    // Usa impliedPrincipal per garantire che a parità di durata residua qualsiasi riduzione di TAN generi la riduzione esatta della rata
    const newMonthlyPayment = calculateFrenchMonthlyPayment(impliedPrincipal, appliedTan, remainingMonths);
    const monthlySavings = Math.round((monthlyPayment - newMonthlyPayment) * 100) / 100;
    const annualSavings = Math.round(monthlySavings * 12 * 100) / 100;
    const totalRemainingSavings = Math.round(monthlySavings * remainingMonths);
    const rateDelta = Math.round((currentRate - appliedTan) * 100) / 100;
    const rateDeltaBps = Math.round(rateDelta * 100);

    const isAdvantageous = monthlySavings >= minSavings && rateDeltaBps >= minBps;

    return {
      offer,
      appliedTan,
      appliedTaeg,
      isGreenRateApplied,
      newMonthlyPayment,
      monthlySavings,
      annualSavings,
      totalRemainingSavings,
      rateDelta,
      rateDeltaBps,
      isAdvantageous
    };
  });

  // Ordina per massimo risparmio mensile (e a parità di risparmio per TAEG più basso e banche su piazza di Milano)
  evaluatedOffers.sort((a, b) => {
    if (Math.abs(b.monthlySavings - a.monthlySavings) > 0.5) {
      return b.monthlySavings - a.monthlySavings;
    }
    if (a.appliedTaeg !== b.appliedTaeg) {
      return a.appliedTaeg - b.appliedTaeg;
    }
    return (b.offer.isMilanFocused ? 1 : 0) - (a.offer.isMilanFocused ? 1 : 0);
  });

  const bestOffer = evaluatedOffers.length > 0 ? evaluatedOffers[0] : null;
  const isAdvantageous = Boolean(bestOffer && bestOffer.isAdvantageous);

  let advantageReason: string | undefined;
  if (bestOffer && isAdvantageous) {
    advantageReason = `Risparmio di € ${bestOffer.monthlySavings.toFixed(0)}/mese (€ ${bestOffer.annualSavings.toFixed(0)}/anno) con ${bestOffer.offer.bankName} a TAN ${bestOffer.appliedTan.toFixed(2)}% (-${bestOffer.rateDeltaBps} bps)`;
  }

  return {
    propertyId: property.id,
    propertyName: property.name,
    propertyAddress: property.address,
    energyClass: property.energyClass,
    isGreenProperty,
    currentBankName,
    currentRate,
    currentRateType,
    currentMonthlyPayment: Math.round(monthlyPayment * 100) / 100,
    remainingYears,
    remainingMonths,
    estimatedResidualPrincipal,
    propertyValue,
    estimatedLtv,
    bestOffer,
    topOffers: evaluatedOffers,
    isAdvantageous,
    advantageReason
  };
};

/**
 * Analizza l'intero portafoglio immobiliare confrontando i mutui attivi con le banche italiane e di Milano.
 */
export const analyzePortfolioMortgages = (
  properties: Property[],
  radarSettings: MortgageRadarSettings = DEFAULT_MORTGAGE_RADAR_SETTINGS,
  customIndices?: MarketReferenceIndices,
  customBankCatalog?: BankMortgageOffer[],
  referenceDate: Date = new Date()
): MortgageRadarReport => {
  const indices = customIndices || getDefaultMarketIndices(referenceDate);
  const bankCatalog = customBankCatalog && customBankCatalog.length > 0
    ? customBankCatalog
    : buildItalianAndMilanBankCatalog(indices);

  const opportunities: PropertySubrogationOpportunity[] = [];
  for (const prop of properties || []) {
    const opp = evaluatePropertySubrogation(prop, bankCatalog, indices, radarSettings, referenceDate);
    if (opp) opportunities.push(opp);
  }

  // Ordina opportunità per risparmio mensile decrescente
  opportunities.sort((a, b) => (b.bestOffer?.monthlySavings || 0) - (a.bestOffer?.monthlySavings || 0));

  const advantageousList = opportunities.filter(o => o.isAdvantageous && o.bestOffer);
  const totalPotentialMonthlySavings = Math.round(
    advantageousList.reduce((acc, o) => acc + (o.bestOffer?.monthlySavings || 0), 0) * 100
  ) / 100;
  const totalPotentialAnnualSavings = Math.round(totalPotentialMonthlySavings * 12 * 100) / 100;
  const totalPotentialRemainingSavings = Math.round(
    advantageousList.reduce((acc, o) => acc + (o.bestOffer?.totalRemainingSavings || 0), 0)
  );

  return {
    generatedAt: referenceDate.toISOString(),
    indices,
    banksMonitoredCount: bankCatalog.length,
    propertiesAnalyzedCount: opportunities.length,
    advantageousCount: advantageousList.length,
    totalPotentialMonthlySavings,
    totalPotentialAnnualSavings,
    totalPotentialRemainingSavings,
    opportunities,
    bankCatalog
  };
};

const escapeHtmlClient = (str?: string): string => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

export const formatMortgageRadarTelegramReportClient = (
  report: MortgageRadarReport,
  radarSettings: MortgageRadarSettings = DEFAULT_MORTGAGE_RADAR_SETTINGS
): string => {
  const idx = report.indices || getDefaultMarketIndices();
  const minSav = radarSettings.minMonthlySavings ?? 30;
  const minBps = radarSettings.minRateDeltaBps ?? 25;
  const dateStr = (report.generatedAt || new Date().toISOString()).slice(0, 10).split('-').reverse().join('/');

  const lines: string[] = [
    `🏦 <b>ImmoPlan · Radar Tassi Mutui &amp; Surroghe (Italia &amp; Milano)</b>`,
    `📅 Rilevazione: <b>${escapeHtmlClient(dateStr)}</b> · Banche monitorate: <b>${report.banksMonitoredCount || 17}</b>`,
    `📊 Indici Mercato: <b>IRS 20A ${idx.irs20Y}%</b> | <b>IRS 25A ${idx.irs25Y}%</b> | <b>Euribor 3M ${idx.euribor3M}%</b> | <b>BCE ${idx.bceRate}%</b>`,
    ``
  ];

  const opps = report.opportunities || [];
  const advOpps = opps.filter(o => o.isAdvantageous && o.bestOffer);

  if (opps.length === 0) {
    lines.push(`ℹ️ <i>Nessun mutuo attivo rilevato sugli immobili in portafoglio.</i>`);
    return lines.join('\n');
  }

  if (advOpps.length > 0) {
    lines.push(`🔥 <b>OPPORTUNITÀ SURROGA VANTAGGIOSE: ${advOpps.length} su ${opps.length} mutui</b>`);
    lines.push(`💰 Risparmio Potenziale: <b>€ ${report.totalPotentialMonthlySavings.toFixed(2)}/mese</b> (<b>€ ${report.totalPotentialAnnualSavings.toFixed(0)}/anno</b>)`);
    lines.push(`🏆 Risparmio Totale Residuo: <b>€ ${report.totalPotentialRemainingSavings.toLocaleString('it-IT')}</b>`);
  } else {
    lines.push(`✅ <b>Analisi completata su ${opps.length} mutui attivi:</b> nessuna offerta supera attualmente la soglia configurata (min. € ${minSav}/mese e -${minBps} bps).`);
  }

  const listToRender = advOpps.length > 0 ? advOpps : opps;

  for (const opp of listToRender) {
    const best = opp.bestOffer;
    if (!best) continue;
    const propName = escapeHtmlClient(opp.propertyName || 'Immobile');
    const curBank = escapeHtmlClient(opp.currentBankName || 'Banca Attuale');
    const bestBank = escapeHtmlClient(best.offer.bankName);
    const bestCity = escapeHtmlClient(best.offer.hqCity);
    const bestProd = escapeHtmlClient(best.offer.productName);
    const greenTag = opp.isGreenProperty ? ` 🌿 <i>(Green Classe ${escapeHtmlClient(opp.energyClass)})</i>` : '';

    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━`);
    lines.push(`🏠 <b>${propName}</b>${greenTag}`);
    lines.push(`📍 <i>Mutuo Attuale:</i> ${curBank} · Rata <b>€ ${opp.currentMonthlyPayment.toFixed(2)}/m</b> · TAN <b>${opp.currentRate.toFixed(2)}%</b> (${opp.remainingYears}a residui, Cap. € ${opp.estimatedResidualPrincipal.toLocaleString('it-IT')})`);

    if (best.monthlySavings > 0) {
      lines.push(`🎯 <b>Migliore Surroga: ${bestBank}</b> (${bestCity})`);
      lines.push(`   • Prodotto: <i>${bestProd}</i>${best.isGreenRateApplied ? ' 🌿' : ''}`);
      lines.push(`   • Nuovo Tasso: <b>TAN ${best.appliedTan.toFixed(2)}%</b> (TAEG ${best.appliedTaeg.toFixed(2)}%) [<b>-${best.rateDelta.toFixed(2)}% / -${best.rateDeltaBps} bps</b>]`);
      lines.push(`   • Nuova Rata: <b>€ ${best.newMonthlyPayment.toFixed(2)}/mese</b>`);
      lines.push(`   • 📈 Risparmio: <b>€ ${best.monthlySavings.toFixed(2)}/mese</b> | <b>€ ${best.annualSavings.toFixed(0)}/anno</b>`);
      lines.push(`   • 💎 Risparmio Totale (${opp.remainingYears}a): <b>€ ${best.totalRemainingSavings.toLocaleString('it-IT')}</b>`);
      lines.push(`   • 📌 <i>Surroga Zero Spese (L. 40/2007): Perizia e Istruttoria gratuite</i>`);
      if (best.offer.sourceUrl) {
        lines.push(`   • 🔗 <a href="${escapeHtmlClient(best.offer.sourceUrl)}">Scheda Ufficiale Mutuo ${bestBank}</a>`);
      }

      const altOffers = (opp.topOffers || []).slice(1, 3).filter(a => a.monthlySavings > 0);
      if (altOffers.length > 0) {
        lines.push(`   🥈 <i>Altre Banche:</i>`);
        altOffers.forEach((alt, i) => {
          lines.push(`      ${i + 2}) <b>${escapeHtmlClient(alt.offer.bankName)}</b>: TAN ${alt.appliedTan.toFixed(2)}% → Rata € ${alt.newMonthlyPayment.toFixed(0)}/m (<b>-€ ${alt.monthlySavings.toFixed(0)}/m</b>)`);
        });
      }
    } else {
      lines.push(`ℹ️ <i>Il tasso attuale (${opp.currentRate.toFixed(2)}%) è già più basso o allineato alla migliore offerta di mercato (${bestBank}: TAN ${best.appliedTan.toFixed(2)}%).</i>`);
    }
  }

  return lines.join('\n');
};

/**
 * Interroga il backend (/api/mortgage-radar/check) per eseguire la scansione tassi
 * ed eventualmente inviare il report formattato su Telegram.
 * Se il server non è raggiungibile, esegue il motore localmente e invia direttamente via API Telegram.
 */
export const runMortgageRadarCheck = async (options: {
  properties: Property[];
  settings?: Partial<MortgageRadarSettings>;
  sendTelegram?: boolean;
  forceSend?: boolean;
  recipientChatId?: string;
  botToken?: string;
  customIndices?: MarketReferenceIndices;
  customBankCatalog?: BankMortgageOffer[];
}): Promise<MortgageRadarReport> => {
  const mergedSettings: MortgageRadarSettings = {
    ...DEFAULT_MORTGAGE_RADAR_SETTINGS,
    ...(options.settings || {})
  };

  const resolvedChatId = (options.recipientChatId || mergedSettings.recipientChatId || '').trim();
  const resolvedBotToken = (options.botToken || '').trim();

  try {
    const res = await fetch('/api/mortgage-radar/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: options.properties,
        minMonthlySavings: mergedSettings.minMonthlySavings,
        minRateDeltaBps: mergedSettings.minRateDeltaBps,
        preferredRateType: mergedSettings.preferredRateType,
        sendTelegram: Boolean(options.sendTelegram),
        forceSend: Boolean(options.forceSend),
        recipientChatId: resolvedChatId || undefined,
        botToken: resolvedBotToken || undefined,
        customIndices: options.customIndices,
        customBankOffers: options.customBankCatalog
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.report) {
        return {
          ...data.report,
          telegramSent: data.telegramSent,
          telegramMessage: data.telegramMessage,
          telegramError: data.telegramError
        };
      }
    }
  } catch (e) {
    console.warn('[MortgageRadar] Fallback calcolo client-side:', e);
  }

  const localReport = analyzePortfolioMortgages(
    options.properties,
    mergedSettings,
    options.customIndices,
    options.customBankCatalog
  );
  const tgMessage = formatMortgageRadarTelegramReportClient(localReport, mergedSettings);
  localReport.telegramMessage = tgMessage;

  if (options.sendTelegram && (localReport.advantageousCount > 0 || options.forceSend)) {
    if (!resolvedBotToken || !resolvedChatId) {
      localReport.telegramSent = false;
      localReport.telegramError = 'Bot Token Telegram o Chat ID destinatario non configurato nelle impostazioni.';
    } else {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${resolvedBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: resolvedChatId,
            text: tgMessage,
            parse_mode: 'HTML'
          })
        });
        const tgData = await tgRes.json().catch(() => ({}));
        if (tgRes.ok && tgData.ok) {
          localReport.telegramSent = true;
        } else {
          localReport.telegramSent = false;
          localReport.telegramError = tgData.description || `HTTP ${tgRes.status}`;
        }
      } catch (err: any) {
        localReport.telegramSent = false;
        localReport.telegramError = err?.message || 'Errore di rete invio Telegram';
      }
    }
  }

  return localReport;
};

/**
 * Aggiorna gli indici IRS / Euribor / BCE e gli spread delle banche italiane e di Milano
 * tramite Google Gemini 2.5 Flash Grounding (se l'API Key è configurata), con fallback sicuro.
 */
export const fetchLiveBankRatesWithAI = async (): Promise<{
  indices: MarketReferenceIndices;
  bankCatalog: BankMortgageOffer[];
}> => {
  try {
    const prompt = `Fornisci gli ultimi tassi di mercato aggiornati in Italia per i mutui ipotecari e surroghe (Banche nazionali e di Milano: Banco BPM, Intesa Sanpaolo, UniCredit, Mediobanca Premier, Webank, Crédit Agricole, ING, Fineco, BNL, BPER).
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa struttura numerica:
{
  "irs10Y": <numero es. 2.38>,
  "irs15Y": <numero es. 2.44>,
  "irs20Y": <numero es. 2.42>,
  "irs25Y": <numero es. 2.36>,
  "irs30Y": <numero es. 2.29>,
  "euribor1M": <numero es. 2.38>,
  "euribor3M": <numero es. 2.42>,
  "bceRate": <numero es. 2.50>
}`;
    const aiRes = await getMarketInfo(prompt);
    if (aiRes && aiRes.text) {
      const match = aiRes.text.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const clampRate = (val: any, fallback: number) => {
          const n = safeNum(val);
          return n >= 0.2 && n <= 10 ? Math.round(n * 100) / 100 : fallback;
        };
        const base = getDefaultMarketIndices();
        const indices: MarketReferenceIndices = {
          irs10Y: clampRate(parsed.irs10Y, base.irs10Y),
          irs15Y: clampRate(parsed.irs15Y, base.irs15Y),
          irs20Y: clampRate(parsed.irs20Y, base.irs20Y),
          irs25Y: clampRate(parsed.irs25Y, base.irs25Y),
          irs30Y: clampRate(parsed.irs30Y, base.irs30Y),
          euribor1M: clampRate(parsed.euribor1M, base.euribor1M),
          euribor3M: clampRate(parsed.euribor3M, base.euribor3M),
          bceRate: clampRate(parsed.bceRate, base.bceRate),
          source: 'GEMINI_GROUNDED',
          updatedAt: toLocalIsoDate(new Date())
        };
        return {
          indices,
          bankCatalog: buildItalianAndMilanBankCatalog(indices)
        };
      }
    }
  } catch (e) {
    console.warn('[MortgageRadar] AI Grounding non disponibile, uso benchmark:', e);
  }

  const indices = getDefaultMarketIndices();
  return {
    indices,
    bankCatalog: buildItalianAndMilanBankCatalog(indices)
  };
};


