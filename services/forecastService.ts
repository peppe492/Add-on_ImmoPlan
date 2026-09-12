import {
  Property,
  ForecastSimulationConfig,
  MicroMarketMetrics,
  YearlyForecastResult,
  PropertyForecastData
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
    taxRegime: property?.financials?.defaultTaxRate === 10 ? 'CEDOLARE_10' : 'CEDOLARE_21',
    ownerMarginalTaxRate: 35
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

  const r = (annualRatePct > 0 ? annualRatePct : 3.5) / 12 / 100; // Monthly interest rate
  const n = durationYears * 12; // Total months
  const k = Math.min(yearsElapsed * 12, n); // Months elapsed

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
  customMetrics?: MicroMarketMetrics
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

  let cumulativeNetCashFlow = 0;
  const yearlyProjections: YearlyForecastResult[] = [];

  for (let year = 1; year <= 10; year++) {
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
    if (config.taxRegime === 'CEDOLARE_21') {
      taxAmount = effectiveGrossRent * 0.21;
    } else if (config.taxRegime === 'CEDOLARE_10') {
      taxAmount = effectiveGrossRent * 0.10;
    } else if (config.taxRegime === 'IRPEF_ORDINARIA') {
      const marginalRate = (config.ownerMarginalTaxRate || 35) / 100;
      taxAmount = effectiveGrossRent * 0.95 * marginalRate; // 5% flat deduction for IRPEF
    }

    const annualNetRent = Math.max(0, effectiveGrossRent - taxAmount - annualOperatingExpenses);

    // Mortgage Amortization & Debt
    const { remainingDebt, monthlyInstallment } = calculateRemainingMortgageDebt(
      initialLoanAmount,
      mortgageRate,
      durationYears,
      year
    );
    const annualMortgagePayment = monthlyMortgagePayment > 0 ? monthlyMortgagePayment * 12 : monthlyInstallment * 12;

    // Net Cash Flow & Equity
    const netCashFlow = annualNetRent - annualMortgagePayment;
    cumulativeNetCashFlow += netCashFlow;
    const accumulatedEquity = Math.max(0, propertyValue - remainingDebt);

    // ETF World Benchmark Compounding on Initial Cash Equity
    const etfAnnualReturnRate = (config.etfAnnualReturn || 7.0) / 100;
    const etfWorldBenchmarkValue = Math.round(initialCashEquity * Math.pow(1 + etfAnnualReturnRate, year));

    // ROE (Return on Investment % on Cash Equity)
    const netProfitGain = (accumulatedEquity - initialCashEquity) + cumulativeNetCashFlow;
    const roePercent = Number(((netProfitGain / (initialCashEquity * year)) * 100).toFixed(2));

    yearlyProjections.push({
      year,
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
      energyPenaltyBonus: Math.round(energyPenaltyBonusVal)
    });
  }

  return {
    config,
    yearlyProjections,
    metrics,
    lastSimulatedAt: new Date().toISOString()
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
