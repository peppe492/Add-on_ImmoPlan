
export interface Attachment {
  name: string;
  data: string;
  type: string;
}

export interface Portfolio {
  id: string;
  name: string;
  owner: 'Giuseppe' | 'Claudia' | string;
  initialBalance: number;
}

export interface CostAssignment {
  portfolioId: string;
  amount: number;
  date: string;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  date: string;
}

export interface CostDetail {
  amount: number;
  isPaid: boolean;
  assignments: CostAssignment[];
  attachment?: Attachment;
  paidAmount?: number;
  paymentDate?: string;
  payments?: PaymentRecord[];
}

export interface RenovationItem {
  id: string;
  description: string;
  amount: number;
  isPaid: boolean;
  assignments: CostAssignment[];
  attachment?: Attachment;
  paidAmount?: number;
  paymentDate?: string;
  payments?: PaymentRecord[];
}

export interface CustomSensor {
  id: string;
  entity_id_suffix: string;
  name: string;
  type: 'PROPERTY_CASHFLOW' | 'PROPERTY_VALUE' | 'CATEGORY_TOTAL' | 'CALENDAR_EVENTS';
  targetId?: string; // 'GLOBAL' for global calendar
}

export interface FinancialData {
  propertyName: string;
  propertyId?: string;
  totalPrice: number;
  propertyPayments?: RenovationItem[];
  portfolios: Portfolio[]; 
  totalBudget: number;
  loanPercentage: number;
  theme?: 'DEFAULT' | 'NEON';
  apiKey?: string;
  owner1Name?: string;
  owner2Name?: string;
  purchaseCosts: {
    deposit: CostDetail;
    balance: CostDetail; // Nuovo campo: Saldo al Rogito (Cash)
    notary: CostDetail;
    agency: CostDetail;
    taxes: CostDetail;
    other: CostDetail;
  };
  renovationCosts: {
    works: number;
    worksBreakdown: RenovationItem[];
    materials: number;
    materialsBreakdown: RenovationItem[];
    design: CostDetail;
    contingency: number;
  };
  customSensors?: CustomSensor[];
}

export interface Scenario {
  id: string;
  name: string;
  date: string;
  propertyId?: string;
  data: FinancialData;
}

export interface SystemLog {
  id: number;
  message: string;
  type: 'info' | 'error' | 'success';
  time: string;
}

export interface RentalRecord {
  id: string;
  propertyId: string;
  month: number;
  year: number;
  transactionDate: string;
  income: number;
  isTaxable: boolean;
  mortgage: number;
  condo: number;
  utilities: number;
  internet: number;
  maintenance: number;
  taxes: number;
  other: number;
  notes?: string;
  tenantId?: string;
  landlordId?: string;
  attachment?: Attachment;
}

export interface Tenant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  taxCode?: string;
  notes?: string;
  attachments?: Attachment[];
  createdAt: string;
}

export interface Landlord {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  iban?: string;
  taxCode?: string;
  marginalTaxRate?: number;
  notes?: string;
  attachments?: Attachment[];
  createdAt: string;
}

export interface OwnerProfileSettings {
  id: string;
  name: string;
  marginalTaxRate?: number;
}

export interface ValuationRecord {
  id: string;
  date: string; // YYYY-MM-DD
  value: number;
}

export interface MicroMarketMetrics {
  zone: string;
  cap?: string;
  avgPriceSqm: number;
  avgRentSqmMonth: number;
  annualGrowthTrend: number; // e.g. 0.02 for +2%
  demographicTrend: number;  // e.g. 0.005 for +0.5%
  historicalIpabIndex?: number[];
  historicalFoiIndex?: number[];
  lastUpdated: string;
}

export interface ForecastSimulationConfig {
  cpiInflationTarget: number; // % (e.g. 2.0)
  vacancyWeeksPerYear: number; // (e.g. 2)
  bceInterestRateScenario: 'STABLE' | 'RISING' | 'FALLING';
  energyClassUpgrade: boolean; // toggle
  currentEnergyClass?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  targetEnergyClass?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  enableEtfBenchmark: boolean; // toggle
  etfAnnualReturn?: number; // % (e.g. 7.0 for ETF World)
  taxRegime: 'CEDOLARE_21' | 'CEDOLARE_10' | 'IRPEF_ORDINARIA';
  ownerMarginalTaxRate?: number; // % (e.g. 35 or 43)
}

export interface YearlyForecastResult {
  year: number;
  propertyValue: number;
  optimisticValue: number;
  pessimisticValue: number;
  annualGrossRent: number;
  annualNetRent: number;
  netCashFlow: number;
  cumulativeNetCashFlow: number;
  remainingMortgageDebt: number;
  accumulatedEquity: number;
  etfWorldBenchmarkValue: number;
  roePercent: number;
  energyPenaltyBonus: number;
}

export interface PropertyForecastData {
  config: ForecastSimulationConfig;
  yearlyProjections: YearlyForecastResult[];
  metrics: MicroMarketMetrics;
  lastSimulatedAt: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  type: 'RESIDENTIAL' | 'COMMERCIAL' | 'LAND' | 'GARAGE';
  purchaseDate: string;
  purchasePrice: number;
  currentValue: number;
  status: 'RENTED' | 'EMPTY' | 'RENOVATION' | 'MAIN_RESIDENCE';
  energyClass?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  surfaceSqm?: number;
  notes?: string;
  coordinates?: { lat: number; lng: number; };
  financials?: {
    mortgageAmount: number;
    mortgageDuration?: number;
    mortgageStartDate?: string;
    mortgageRate?: number;
    monthlyRent?: number;
    condoFees: number;
    defaultTaxRate: number;
    targetMargin?: number;
    initialInvestment?: number;
  };
  recurringCosts?: RecurringCost[];
  currentTenantId?: string; 
  documents?: Attachment[];
  valuations?: ValuationRecord[];
  forecastData?: PropertyForecastData;
}

export interface RecurringCost {
  id: string;
  name: string;
  category: 'MORTGAGE' | 'TAX' | 'MAINTENANCE' | 'UTILITY' | 'INSURANCE' | 'INTERNET' | 'OTHER';
  amount: number;
  frequency: 'MONTHLY' | 'YEARLY' | 'ONE_OFF';
  date?: string;
  referenceMonth?: number;
  referenceYear?: number;
  haEntityId?: string; 
}

export interface Deadline {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'RENT' | 'TAX' | 'MAINTENANCE' | 'CONTRACT' | 'CUSTOM' | 'OTHER';
  amount?: number;
  isCompleted: boolean;
  notes?: string;
  propertyId?: string;
  tenantId?: string;
}

export enum MainTab {
  DASHBOARD = 'DASHBOARD',
  PURCHASE = 'PURCHASE',
  PROPERTY_MGMT = 'PROPERTY_MGMT', 
  CALENDAR = 'CALENDAR',
  ADVISOR = 'ADVISOR',
  VISUALIZER = 'VISUALIZER',
  ADMIN = 'ADMIN',
  HELP = 'HELP'
}

export type HelpCategory =
  | 'GETTING_STARTED'
  | 'FORECASTER'
  | 'PROPERTY_MGMT'
  | 'TAXES_BONUS'
  | 'HOME_ASSISTANT'
  | 'FAQ_TROUBLESHOOTING';

export interface HelpArticle {
  id: string;
  title: string;
  category: HelpCategory;
  summary: string;
  content: string;
  tags: string[];
  readTimeMinutes?: number;
  featured?: boolean;
  relatedArticleIds?: string[];
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: HelpCategory;
  tags?: string[];
}

export interface HelpCategoryInfo {
  id: HelpCategory;
  label: string;
  icon: string;
  description: string;
  badgeColor: string;
}

export enum PurchaseTab { 
  INPUT = 'INPUT', 
  DASHBOARD = 'DASHBOARD',
  INVOICES = 'INVOICES'
}
export enum PropertyTab { ASSETS = 'ASSETS', RENTALS = 'RENTALS', CONTACTS = 'CONTACTS' }

export type TaxCategory = 
  | 'BONUS_50' 
  | 'BONUS_36' 
  | 'BONUS_SPLIT' 
  | 'ECOBONUS_65' 
  | 'BONUS_MOBILI' 
  | 'AGENZIA_19' 
  | 'NOTAIO_MUTUO' 
  | 'NONE';

export type InvoiceBeneficiary = 'Giuseppe' | 'Claudia' | '50/50' | 'CUSTOM' | string;

export type InvoicePaymentMethod = 'BONIFICO_PARLANTE' | 'BONIFICO_ORDINARIO' | 'CARTA_POS' | 'ASSEGNO';

export interface InvoiceRecord {
  id: string;
  propertyId: string;
  invoiceNumber: string;
  supplier: string;
  invoiceDate: string;
  paymentDate: string;
  fiscalYear: number;
  description: string;
  taxCategory: TaxCategory;
  rate: number;
  rateGiuseppe?: number;
  rateClaudia?: number;
  beneficiary: InvoiceBeneficiary;
  splitGiuseppePercent?: number;
  splitClaudiaPercent?: number;
  paymentMethod: InvoicePaymentMethod;
  croCode?: string;
  amount: number;
  invoiceAttachment?: Attachment | null;
  receiptAttachment?: Attachment | null;
  createdAt?: string;
}
