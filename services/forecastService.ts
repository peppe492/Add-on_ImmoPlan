import {
  Property,
  ForecastSimulationConfig,
  MicroMarketMetrics,
  YearlyForecastResult,
  PropertyForecastData,
  MortgagePayoffSimulationSummary
} from '../types';

/**
 * Returns default simulation configuration parameters for a property.
 */
export const getDefaultSimulationConfig = (property?: Property): ForecastSimulationConfig => {
  return {
    cpiInflationTarget: 2.0, // 2.0% annual inflation target
    vacancyWeeksPerYear: 2,   // 2 weeks/year average vacancy
    bceInterestRateScenario: 'STABLE',
    energyClassUpgrade: false,
    currentEnergyClass: property?.energyClass || 'D',
    targetEnergyClass: 'A',
    enableEtfBenchmark: true,
    etfAnnualReturn: 7.0,     // 7.0% nominal return for MSCI World ETF
    taxRegime: property?.financials?.taxRegime || (property?.financials?.defaultTaxRate === 0
      ? 'ESENTE_0'
      : property?.financials?.defaultTaxRate === 10
      ? 'CEDOLARE_10'
      : (property?.financials?.defaultTaxRate != null && property.financials.defaultTaxRate !== 21)
      ? 'IRPEF_ORDINARIA'
      : 'CEDOLARE_21'),
    ownerMarginalTaxRate: property?.financials?.marginalTaxRate ?? (property?.financials?.taxRegime === 'IRPEF_ORDINARIA' ? (property?.financials?.defaultTaxRate ?? 35) : 35),
    includeTaxDeductions: true,
    simulationRenovationCost: 0,
    simulationDeductionRate: 50,
    simulationPayoffAmount: 0,
    simulationPayoffYear: 3,
    simulationPayoffStrategy: 'REDUCE_INSTALLMENT'
  };
};

/**
 * Helper: French Amortization (Ammortamento alla Francese)
 * Calculates remaining loan principal after t years.
 */
const calculateRemainingMortgageDebt = (
  initialLoanAmount: number,
  annualRatePct: number,
  durationYears: number,
  yearsElapsed: number
): { remainingDebt: number; monthlyInstallment: number } => {
  if (!initialLoanAmount || initialLoanAmount <= 0 || !durationYears || durationYears <= 0) {
    return { remainingDebt: 0, monthlyInstallment: 0 };
  }

  if (yearsElapsed >= durationYears) {
    return { remainingDebt: 0, monthlyInstallment: 0 };
  }

  const n = durationYears * 12; // Total months
  const k = Math.min(yearsElapsed * 12, n); // Months elapsed

  // Handle 0% interest rate loan (e.g. subsidized loan / tasso zero)
  if (annualRatePct === 0) {
    const monthlyInstallment = initialLoanAmount / n;
    const remainingDebt = Math.max(0, initialLoanAmount * (1 - k / n));
    return {
      remainingDebt: Math.round(remainingDebt),
      monthlyInstallment: Math.round(monthlyInstallment)
    };
  }

  const effectiveRate = annualRatePct > 0 ? annualRatePct : 3.5;
  const r = effectiveRate / 12 / 100; // Monthly interest rate

  // PMT formula: P * (r * (1+r)^n) / ((1+r)^n - 1)
  const monthlyInstallment = initialLoanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  
  // Remaining balance formula: P * ((1+r)^n - (1+r)^k) / ((1+r)^n - 1)
  const remainingDebt = initialLoanAmount * (Math.pow(1 + r, n) - Math.pow(1 + r, k)) / (Math.pow(1 + r, n) - 1);

  return {
    remainingDebt: Math.max(0, remainingDebt),
    monthlyInstallment: Math.round(monthlyInstallment)
  };
};

/**
 * Calculates multi-year (1 to 10 years) dynamic price trend estimation and financial forecast.
 */
export const calculatePropertyForecast = (
  property: Property,
  config: ForecastSimulationConfig,
  customMetrics?: MicroMarketMetrics,
  annualTaxDeductions?: Record<number, number>
): PropertyForecastData => {
  const metrics: MicroMarketMetrics = customMetrics || {
    zone: property.address || property.name,
    avgPriceSqm: 2800,
    avgRentSqmMonth: 12.5,
    annualGrowthTrend: 0.018,
    demographicTrend: 0.003,
    lastUpdated: new Date().toISOString().split('T')[0]
  };

  const initialValue = property.currentValue > 0 ? property.currentValue : (property.purchasePrice || 200000);
  const purchasePrice = property.purchasePrice || initialValue;

  // 1. Calculate Initial Loan Amount & Monthly Payment
  let initialLoanAmount = 0;
  let monthlyMortgagePayment = 0;
  let durationYears = property.financials?.mortgageDuration || 20;
  let mortgageRate = property.financials?.mortgageRate || 3.5;

  // BCE Interest Rate Scenario adjustment on mortgage rate
  if (config.bceInterestRateScenario === 'RISING') {
    mortgageRate += 0.75;
  } else if (config.bceInterestRateScenario === 'FALLING') {
    mortgageRate = Math.max(0.5, mortgageRate - 0.75);
  }

  if (property.financials?.mortgageAmount && property.financials.mortgageAmount > 0) {
    if (property.financials.mortgageAmount > 10000) {
      initialLoanAmount = property.financials.mortgageAmount;
      const r = (mortgageRate > 0 ? mortgageRate : 3.5) / 12 / 100;
      const n = durationYears * 12;
      monthlyMortgagePayment = initialLoanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    } else {
      monthlyMortgagePayment = property.financials.mortgageAmount;
    }
  } else if (property.recurringCosts) {
    const mortCost = property.recurringCosts.find(c => c.category === 'MORTGAGE');
    if (mortCost && mortCost.amount > 0) {
      monthlyMortgagePayment = mortCost.frequency === 'MONTHLY' ? mortCost.amount : mortCost.amount / 12;
    }
  }

  if (initialLoanAmount === 0 && monthlyMortgagePayment > 0) {
    const r = (mortgageRate > 0 ? mortgageRate : 3.5) / 12 / 100;
    const n = durationYears * 12;
    // Exact Annuity Present Value Formula
    initialLoanAmount = monthlyMortgagePayment * (1 - Math.pow(1 + r, -n)) / r;
  }

  // Estimated purchase costs ~ 8% of purchase price (notary, agency, taxes)
  const purchaseExpenses = purchasePrice * 0.08;
  const initialCashEquity = property.financials?.initialInvestment || Math.max(
    10000,
    purchasePrice + purchaseExpenses - initialLoanAmount
  );

  // 2. Growth Factors & Adjustments
  const baseGrowthRate = (metrics.annualGrowthTrend || 0.018) + (metrics.demographicTrend || 0.003);

  // BCE Interest Rate Scenario adjustment on property growth
  let bceDelta = 0;
  if (config.bceInterestRateScenario === 'RISING') bceDelta = -0.0075; // -0.75%/year
  else if (config.bceInterestRateScenario === 'FALLING') bceDelta = 0.0075; // +0.75%/year

  // EU "Case Verdi" Energy Class Penalties/Bonuses
  const activeEnergyClass = config.energyClassUpgrade
    ? (config.targetEnergyClass || 'A')
    : (config.currentEnergyClass || property.energyClass || 'D');

  let energyDelta = 0;
  let energyPenaltyBonusVal = 0;
  if (['A', 'B'].includes(activeEnergyClass)) {
    energyDelta = 0.015; // +1.5% bonus annually for green classes A/B
    energyPenaltyBonusVal = initialValue * 0.015;
  } else if (['E', 'F', 'G'].includes(activeEnergyClass)) {
    energyDelta = -0.020; // -2.0% penalty annually for high-emission classes E/F/G
    energyPenaltyBonusVal = -initialValue * 0.020;
  }

  // Property Size Multiplier
  let sizeDelta = 0;
  if (property.surfaceSqm) {
    if (property.surfaceSqm < 65) sizeDelta = 0.003; // Small cuts +0.3%
    else if (property.surfaceSqm > 120) sizeDelta = -0.002; // Large cuts -0.2%
  }

  const netAnnualGrowthRate = baseGrowthRate + bceDelta + energyDelta + sizeDelta;

  // 3. Rent & Expenses Setup
  const monthlyRent = property.financials?.monthlyRent || (metrics.avgRentSqmMonth * (property.surfaceSqm || 70));
  const baseAnnualGrossRent = monthlyRent * 12;

  // Annual fixed recurring costs (condo, taxes, maintenance)
  let annualOperatingExpenses = (property.financials?.condoFees || 0) * 12;
  if (property.recurringCosts) {
    property.recurringCosts.forEach(c => {
      if (c.category !== 'MORTGAGE') {
        if (c.frequency === 'MONTHLY') annualOperatingExpenses += c.amount * 12;
        else if (c.frequency === 'YEARLY' || c.frequency === 'ONE_OFF') annualOperatingExpenses += c.amount;
      }
    });
  }

  // Base purchase year (Anno 1 = anno reale di acquisto registrato)
  let baseYear = new Date().getFullYear();
  if (property.purchaseDate) {
    const parsedY = parseInt(property.purchaseDate.substring(0, 4), 10);
    if (!isNaN(parsedY) && parsedY >= 1990 && parsedY <= 2050) {
      baseYear = parsedY;
    }
  }

  // Pre-calculate Mortgage Payoff Simulation if configured
  const simPayoffAmount = Math.max(0, config.simulationPayoffAmount || 0);
  const simPayoffYear = Math.max(1, Math.min(10, config.simulationPayoffYear || 3));
  const simStrategy = config.simulationPayoffStrategy || 'REDUCE_INSTALLMENT';

  // Base amortization schedule without payoff for baseline comparison
  const baselineSchedule: { remainingDebt: number; monthlyInstallment: number }[] = [];
  for (let y = 1; y <= 10; y++) {
    baselineSchedule.push(calculateRemainingMortgageDebt(
      initialLoanAmount,
      mortgageRate,
      durationYears,
      y
    ));
  }

  // Debt immediately prior to payoff year
  const debtPriorToPayoff = simPayoffYear === 1
    ? initialLoanAmount
    : calculateRemainingMortgageDebt(initialLoanAmount, mortgageRate, durationYears, simPayoffYear - 1).remainingDebt;

  const isPayoffApplicable = simPayoffAmount > 0 && debtPriorToPayoff > 0 && initialLoanAmount > 0;
  const actualPayoffAmount = isPayoffApplicable ? Math.min(simPayoffAmount, debtPriorToPayoff) : 0;
  const postPayoffPrincipal = Math.max(0, debtPriorToPayoff - actualPayoffAmount);
  const remainingYearsAtPayoff = Math.max(1, durationYears - (simPayoffYear - 1));

  let newMonthlyInstallmentPostPayoff = monthlyMortgagePayment;
  let newRemainingYearsPostPayoff = remainingYearsAtPayoff;
  let totalInterestSaved = 0;

  if (isPayoffApplicable && actualPayoffAmount > 0) {
    const effectiveR = (mortgageRate > 0 ? mortgageRate : 3.5) / 12 / 100;
    const nRemaining = remainingYearsAtPayoff * 12;

    if (simStrategy === 'REDUCE_INSTALLMENT') {
      // Strategy 1: Reduce Monthly Installment, keep original remaining duration
      if (postPayoffPrincipal === 0) {
        newMonthlyInstallmentPostPayoff = 0;
      } else if (effectiveR === 0) {
        newMonthlyInstallmentPostPayoff = postPayoffPrincipal / nRemaining;
      } else {
        newMonthlyInstallmentPostPayoff = postPayoffPrincipal * (effectiveR * Math.pow(1 + effectiveR, nRemaining)) / (Math.pow(1 + effectiveR, nRemaining) - 1);
      }
      // Interest saved = total installments that would have been paid vs new installments + payoff
      const oldTotalRemainingPayments = (monthlyMortgagePayment > 0 ? monthlyMortgagePayment : baselineSchedule[0].monthlyInstallment) * nRemaining;
      const newTotalRemainingPayments = newMonthlyInstallmentPostPayoff * nRemaining + actualPayoffAmount;
      totalInterestSaved = Math.max(0, Math.round(oldTotalRemainingPayments - newTotalRemainingPayments));
    } else {
      // Strategy 2: Reduce Duration, keep original monthly installment
      const origMonthly = monthlyMortgagePayment > 0 ? monthlyMortgagePayment : baselineSchedule[0].monthlyInstallment;
      if (postPayoffPrincipal === 0) {
        newRemainingYearsPostPayoff = 0;
        newMonthlyInstallmentPostPayoff = 0;
        totalInterestSaved = Math.max(0, Math.round(origMonthly * nRemaining - actualPayoffAmount));
      } else if (origMonthly <= postPayoffPrincipal * effectiveR) {
        // Fallback: installment doesn't cover interest
        newRemainingYearsPostPayoff = remainingYearsAtPayoff;
      } else if (effectiveR === 0) {
        const newMonths = Math.ceil(postPayoffPrincipal / origMonthly);
        newRemainingYearsPostPayoff = Number((newMonths / 12).toFixed(1));
        totalInterestSaved = 0;
      } else {
        // n = -ln(1 - (P * r / PMT)) / ln(1 + r)
        const numMonths = Math.ceil(-Math.log(1 - (postPayoffPrincipal * effectiveR / origMonthly)) / Math.log(1 + effectiveR));
        newRemainingYearsPostPayoff = Number((Math.max(1, numMonths) / 12).toFixed(1));
        const oldTotalPayments = origMonthly * nRemaining;
        const newTotalPayments = (origMonthly * numMonths) + actualPayoffAmount;
        totalInterestSaved = Math.max(0, Math.round(oldTotalPayments - newTotalPayments));
      }
    }
  }

  const mortgagePayoffSummary: MortgagePayoffSimulationSummary | undefined = isPayoffApplicable ? {
    payoffAmount: actualPayoffAmount,
    payoffYear: simPayoffYear,
    calendarYear: baseYear + (simPayoffYear - 1),
    strategy: simStrategy,
    previousDebtAtPayoff: Math.round(debtPriorToPayoff),
    newDebtAtPayoff: Math.round(postPayoffPrincipal),
    originalMonthlyInstallment: Math.round(monthlyMortgagePayment > 0 ? monthlyMortgagePayment : baselineSchedule[0].monthlyInstallment),
    newMonthlyInstallment: Math.round(newMonthlyInstallmentPostPayoff),
    monthlySavings: Math.max(0, Math.round((monthlyMortgagePayment > 0 ? monthlyMortgagePayment : baselineSchedule[0].monthlyInstallment) - newMonthlyInstallmentPostPayoff)),
    originalRemainingYears: remainingYearsAtPayoff,
    newRemainingYears: newRemainingYearsPostPayoff,
    yearsSaved: Number(Math.max(0, remainingYearsAtPayoff - newRemainingYearsPostPayoff).toFixed(1)),
    totalInterestSaved,
    applicable: true
  } : undefined;

  let cumulativeNetCashFlow = 0;
  const yearlyProjections: YearlyForecastResult[] = [];

  for (let year = 1; year <= 10; year++) {
    const calendarYear = baseYear + (year - 1);

    // Property Value V(t)
    const propertyValue = Math.round(initialValue * Math.pow(1 + netAnnualGrowthRate, year));
    const optimisticValue = Math.round(propertyValue * Math.pow(1.02, year));
    const pessimisticValue = Math.round(propertyValue * Math.pow(0.98, year));

    // Dynamic Indexed Gross Rent
    const cpiInflationRate = config.cpiInflationTarget / 100;
    const rentIndexingFactor = Math.pow(1 + cpiInflationRate * 0.75, year - 1);
    const annualGrossRent = baseAnnualGrossRent * rentIndexingFactor;

    // Vacancy Rate Deduction
    const vacancyRatio = Math.min(0.5, (config.vacancyWeeksPerYear || 0) / 52);
    const effectiveGrossRent = annualGrossRent * (1 - vacancyRatio);

    // Tax Regime Calculation
    let taxAmount = 0;
    if (config.taxRegime === 'ESENTE_0') {
      taxAmount = 0;
    } else if (config.taxRegime === 'CEDOLARE_21') {
      taxAmount = effectiveGrossRent * 0.21;
    } else if (config.taxRegime === 'CEDOLARE_10') {
      taxAmount = effectiveGrossRent * 0.10;
    } else if (config.taxRegime === 'IRPEF_ORDINARIA') {
      const marginalRate = (config.ownerMarginalTaxRate || 35) / 100;
      taxAmount = effectiveGrossRent * 0.95 * marginalRate; // 5% flat deduction for IRPEF
    }

    // Net operating rent (allows negative values when vacancy or operating expenses exceed rent)
    const annualNetRent = effectiveGrossRent - taxAmount - annualOperatingExpenses;

    // Mortgage Amortization & Debt (Incorporating Partial Payoff if applicable)
    let remainingDebt = 0;
    let annualMortgagePayment = 0;

    if (!isPayoffApplicable || year < simPayoffYear) {
      // Standard amortization prior to payoff
      const baseCalc = calculateRemainingMortgageDebt(
        initialLoanAmount,
        mortgageRate,
        durationYears,
        year
      );
      remainingDebt = baseCalc.remainingDebt;
      annualMortgagePayment = monthlyMortgagePayment > 0 ? monthlyMortgagePayment * 12 : baseCalc.monthlyInstallment * 12;
    } else {
      // Post-payoff or payoff year
      const yearsSincePayoff = year - (simPayoffYear - 1);
      if (simStrategy === 'REDUCE_INSTALLMENT') {
        const postCalc = calculateRemainingMortgageDebt(
          postPayoffPrincipal,
          mortgageRate,
          remainingYearsAtPayoff,
          yearsSincePayoff
        );
        remainingDebt = postCalc.remainingDebt;
        annualMortgagePayment = newMonthlyInstallmentPostPayoff * 12;
      } else {
        // Reduce duration strategy
        const postCalc = calculateRemainingMortgageDebt(
          postPayoffPrincipal,
          mortgageRate,
          Math.max(1, Math.ceil(newRemainingYearsPostPayoff)),
          yearsSincePayoff
        );
        remainingDebt = postCalc.remainingDebt;
        annualMortgagePayment = yearsSincePayoff <= newRemainingYearsPostPayoff
          ? (monthlyMortgagePayment > 0 ? monthlyMortgagePayment * 12 : baselineSchedule[0].monthlyInstallment * 12)
          : 0;
      }
    }

    // Net Cash Flow & 730 Tax Deductions Integration
    let taxDeductionQuota = (annualTaxDeductions && annualTaxDeductions[calendarYear]) ? annualTaxDeductions[calendarYear] : 0;
    if (taxDeductionQuota === 0 && (config.simulationRenovationCost || 0) > 0 && year <= 10) {
      const eligibleBase = Math.min(config.simulationRenovationCost || 0, 96000);
      const totalDetr = eligibleBase * ((config.simulationDeductionRate || 50) / 100);
      taxDeductionQuota = totalDetr / 10;
    }

    const netCashFlowWithoutTax = annualNetRent - annualMortgagePayment;
    const effectiveTaxDeduction = config.includeTaxDeductions !== false ? taxDeductionQuota : 0;
    const netCashFlow = netCashFlowWithoutTax + effectiveTaxDeduction;

    cumulativeNetCashFlow += netCashFlow;
    const accumulatedEquity = Math.max(0, propertyValue - remainingDebt);

    // ETF World Benchmark Compounding on Initial Cash Equity
    const etfAnnualReturnRate = (config.etfAnnualReturn || 7.0) / 100;
    const etfWorldBenchmarkValue = Math.round(initialCashEquity * Math.pow(1 + etfAnnualReturnRate, year));

    // ROE (Return on Investment % on Cash Equity) - protected against zero/negative equity
    const netProfitGain = (accumulatedEquity - initialCashEquity) + cumulativeNetCashFlow;
    const roePercent = initialCashEquity > 0
      ? Number(((netProfitGain / (initialCashEquity * year)) * 100).toFixed(2))
      : 0;

    yearlyProjections.push({
      year,
      calendarYear,
      propertyValue,
      optimisticValue,
      pessimisticValue,
      annualGrossRent: Math.round(annualGrossRent),
      annualNetRent: Math.round(annualNetRent),
      netCashFlow: Math.round(netCashFlow),
      cumulativeNetCashFlow: Math.round(cumulativeNetCashFlow),
      remainingMortgageDebt: Math.round(remainingDebt),
      accumulatedEquity: Math.round(accumulatedEquity),
      etfWorldBenchmarkValue,
      roePercent,
      energyPenaltyBonus: Math.round(energyPenaltyBonusVal),
      taxDeductionQuota: Math.round(taxDeductionQuota),
      netCashFlowWithoutTax: Math.round(netCashFlowWithoutTax),
      annualMortgagePayment: Math.round(annualMortgagePayment),
      isPayoffYear: isPayoffApplicable && year === simPayoffYear
    });
  }

  return {
    config,
    yearlyProjections,
    metrics,
    lastSimulatedAt: new Date().toISOString(),
    baseYear,
    mortgagePayoffSummary
  };
};

/**
 * Runs a Monte Carlo Simulation (500 iterations) with stochastic perturbations
 * to compute P10 (pessimistic), P50 (median), and P90 (optimistic) confidence bands.
 */
export const runMonteCarloSimulation = (
  property: Property,
  config: ForecastSimulationConfig,
  iterations = 500
): { p10: YearlyForecastResult[]; p50: YearlyForecastResult[]; p90: YearlyForecastResult[] } => {
  const allProjections: YearlyForecastResult[][] = [];

  for (let i = 0; i < iterations; i++) {
    // Perturb growth rate (+- 1.5% std dev) and inflation (+- 0.8% std dev)
    const randomGrowth = (Math.random() - 0.5) * 0.03;
    const randomInflation = (Math.random() - 0.5) * 0.016;

    const perturbedConfig: ForecastSimulationConfig = {
      ...config,
      cpiInflationTarget: Math.max(0, config.cpiInflationTarget + randomInflation * 100)
    };

    const perturbedMetrics: MicroMarketMetrics = {
      zone: property.address || property.name,
      avgPriceSqm: 2800,
      avgRentSqmMonth: 12.5,
      annualGrowthTrend: 0.018 + randomGrowth,
      demographicTrend: 0.003,
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    const res = calculatePropertyForecast(property, perturbedConfig, perturbedMetrics);
    allProjections.push(res.yearlyProjections);
  }

  // Extract P10, P50, P90 percentiles per year
  const p10: YearlyForecastResult[] = [];
  const p50: YearlyForecastResult[] = [];
  const p90: YearlyForecastResult[] = [];

  for (let y = 0; y < 10; y++) {
    const yearValues = allProjections.map(proj => proj[y]).sort((a, b) => a.propertyValue - b.propertyValue);
    const idx10 = Math.floor(iterations * 0.10);
    const idx50 = Math.floor(iterations * 0.50);
    const idx90 = Math.floor(iterations * 0.90);

    p10.push(yearValues[idx10]);
    p50.push(yearValues[idx50]);
    p90.push(yearValues[idx90]);
  }

  return { p10, p50, p90 };
};
