import { InvoiceRecord, TaxCategory } from '../types';

export interface DeductionCalculationResult {
  deductibleBase: number;
  totalDeduction: number;
  yearlyQuota: number;
  gTotal: number;
  cTotal: number;
  gYearly: number;
  cYearly: number;
  installmentCount: number;
  rateG: number;
  rateC: number;
}

export const computeDeduction = (
  amount: number,
  category: TaxCategory,
  fallbackRate: number,
  rateG?: number,
  rateC?: number,
  ratioG = 0.5,
  ratioC = 0.5
): DeductionCalculationResult => {
  let gRate = typeof rateG === 'number' ? rateG : fallbackRate;
  let cRate = typeof rateC === 'number' ? rateC : fallbackRate;

  let eligible = amount;
  let installments = 10;

  if (category === 'AGENZIA_19') {
    eligible = Math.min(amount, 1000);
    installments = 1;
    gRate = 19;
    cRate = 19;
  } else if (category === 'NOTAIO_MUTUO') {
    eligible = Math.min(amount, 4000);
    installments = 1;
    gRate = 19;
    cRate = 19;
  } else if (category === 'BONUS_MOBILI') {
    eligible = Math.min(amount, 5000);
    installments = 10;
    gRate = 50;
    cRate = 50;
  } else if (category === 'BONUS_50') {
    eligible = Math.min(amount, 96000);
    installments = 10;
    gRate = 50;
    cRate = 50;
  } else if (category === 'BONUS_36') {
    eligible = Math.min(amount, 96000);
    installments = 10;
    gRate = 36;
    cRate = 36;
  } else if (category === 'BONUS_SPLIT') {
    eligible = Math.min(amount, 96000);
    installments = 10;
    // Differentiated rates for G and C
  } else if (category === 'ECOBONUS_65') {
    eligible = Math.min(amount, 96000);
    installments = 10;
    gRate = 65;
    cRate = 65;
  } else {
    return {
      deductibleBase: 0,
      totalDeduction: 0,
      yearlyQuota: 0,
      gTotal: 0,
      cTotal: 0,
      gYearly: 0,
      cYearly: 0,
      installmentCount: 0,
      rateG: 0,
      rateC: 0
    };
  }

  const baseG = eligible * ratioG;
  const baseC = eligible * ratioC;
  const deductionG = baseG * (gRate / 100);
  const deductionC = baseC * (cRate / 100);
  const totalDeduction = deductionG + deductionC;

  const yearlyG = installments === 1 ? deductionG : deductionG / installments;
  const yearlyC = installments === 1 ? deductionC : deductionC / installments;
  const yearlyQuota = yearlyG + yearlyC;

  return {
    deductibleBase: eligible,
    totalDeduction,
    yearlyQuota,
    gTotal: deductionG,
    cTotal: deductionC,
    gYearly: yearlyG,
    cYearly: yearlyC,
    installmentCount: installments,
    rateG: gRate,
    rateC: cRate
  };
};

/**
 * Calcola la quota di detrazione annuale spettante per ciascun anno solare per un dato immobile
 * (in Italia: spesa sostenuta nell'anno fiscale T -> quote detraibili per 10 anni).
 */
export const getAnnualDeductionsByProperty = (
  invoices: InvoiceRecord[],
  propertyId: string,
  owner1Name = 'Giuseppe',
  owner2Name = 'Claudia'
): Record<number, number> => {
  const propertyInvoices = (invoices || []).filter(inv => inv.propertyId === propertyId);
  return calculateYearlySchedule(propertyInvoices, owner1Name, owner2Name);
};

/**
 * Calcola la quota di detrazione annuale spettante complessivamente per l'intero portafoglio
 */
export const getAnnualDeductionsTotal = (
  invoices: InvoiceRecord[],
  owner1Name = 'Giuseppe',
  owner2Name = 'Claudia'
): Record<number, number> => {
  return calculateYearlySchedule(invoices || [], owner1Name, owner2Name);
};

const calculateYearlySchedule = (
  invoices: InvoiceRecord[],
  owner1Name: string,
  owner2Name: string
): Record<number, number> => {
  const schedule: Record<number, number> = {};

  const isOwner1 = (b?: string) => b === owner1Name || b === 'Giuseppe' || b === 'G';
  const isOwner2 = (b?: string) => b === owner2Name || b === 'Claudia' || b === 'C';

  (invoices || []).forEach(inv => {
    let gRatio = 0.5;
    let cRatio = 0.5;
    if (isOwner1(inv.beneficiary)) {
      gRatio = 1.0;
      cRatio = 0.0;
    } else if (isOwner2(inv.beneficiary)) {
      gRatio = 0.0;
      cRatio = 1.0;
    } else if (inv.beneficiary === 'CUSTOM' && typeof inv.splitGiuseppePercent === 'number') {
      gRatio = inv.splitGiuseppePercent / 100;
      cRatio = (100 - inv.splitGiuseppePercent) / 100;
    }

    const rateG = inv.rateGiuseppe ?? inv.rate;
    const rateC = inv.rateClaudia ?? inv.rate;
    const calc = computeDeduction(inv.amount, inv.taxCategory, inv.rate, rateG, rateC, gRatio, cRatio);
    const invYear = typeof inv.fiscalYear === 'number' && !isNaN(inv.fiscalYear) ? inv.fiscalYear : new Date().getFullYear();

    if (calc.installmentCount === 1) {
      schedule[invYear] = (schedule[invYear] || 0) + calc.totalDeduction;
    } else if (calc.installmentCount > 1) {
      for (let y = invYear; y < invYear + calc.installmentCount; y++) {
        schedule[y] = (schedule[y] || 0) + calc.yearlyQuota;
      }
    }
  });

  return schedule;
};

/**
 * Riepilogo generale delle detrazioni per un singolo immobile
 */
export const getDeductionSummaryForProperty = (
  invoices: InvoiceRecord[],
  propertyId: string,
  owner1Name = 'Giuseppe',
  owner2Name = 'Claudia'
) => {
  const propInvoices = (invoices || []).filter(inv => inv.propertyId === propertyId);
  const annualSchedule = getAnnualDeductionsByProperty(invoices, propertyId, owner1Name, owner2Name);
  
  let totalEligibleBase = 0;
  let totalDeduction = 0;
  const categoryBreakdown: Record<string, { count: number; totalAmount: number; totalDeduction: number; yearlyQuota: number }> = {};

  const isOwner1 = (b?: string) => b === owner1Name || b === 'Giuseppe' || b === 'G';
  const isOwner2 = (b?: string) => b === owner2Name || b === 'Claudia' || b === 'C';

  propInvoices.forEach(inv => {
    let gRatio = 0.5;
    let cRatio = 0.5;
    if (isOwner1(inv.beneficiary)) {
      gRatio = 1.0;
      cRatio = 0.0;
    } else if (isOwner2(inv.beneficiary)) {
      gRatio = 0.0;
      cRatio = 1.0;
    } else if (inv.beneficiary === 'CUSTOM' && typeof inv.splitGiuseppePercent === 'number') {
      gRatio = inv.splitGiuseppePercent / 100;
      cRatio = (100 - inv.splitGiuseppePercent) / 100;
    }

    const rateG = inv.rateGiuseppe ?? inv.rate;
    const rateC = inv.rateClaudia ?? inv.rate;
    const calc = computeDeduction(inv.amount, inv.taxCategory, inv.rate, rateG, rateC, gRatio, cRatio);

    totalEligibleBase += calc.deductibleBase;
    totalDeduction += calc.totalDeduction;

    const catKey = inv.taxCategory || 'OTHER';
    if (!categoryBreakdown[catKey]) {
      categoryBreakdown[catKey] = { count: 0, totalAmount: 0, totalDeduction: 0, yearlyQuota: 0 };
    }
    categoryBreakdown[catKey].count++;
    categoryBreakdown[catKey].totalAmount += inv.amount;
    categoryBreakdown[catKey].totalDeduction += calc.totalDeduction;
    categoryBreakdown[catKey].yearlyQuota += calc.yearlyQuota;
  });

  const years = Object.keys(annualSchedule).map(Number).sort((a, b) => a - b);
  const currentYear = new Date().getFullYear();
  const currentYearQuota = annualSchedule[currentYear] || 0;

  return {
    invoiceCount: propInvoices.length,
    totalEligibleBase,
    totalDeduction,
    currentYearQuota,
    annualSchedule,
    activeYears: years,
    categoryBreakdown
  };
};
