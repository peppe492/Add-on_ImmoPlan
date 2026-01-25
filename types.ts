
export interface Attachment {
  name: string;
  data: string;
  type: string;
}

export interface Portfolio {
  id: string;
  name: string;
  owner: 'Giuseppe' | 'Claudia';
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
  totalPrice: number;
  propertyPayments?: RenovationItem[];
  portfolios: Portfolio[]; 
  totalBudget: number;
  loanPercentage: number;
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
  notes?: string;
  attachments?: Attachment[];
  createdAt: string;
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
  };
  recurringCosts?: RecurringCost[];
  currentTenantId?: string; 
  documents?: Attachment[];
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

export enum MainTab {
  DASHBOARD = 'DASHBOARD',
  PURCHASE = 'PURCHASE',
  PROPERTY_MGMT = 'PROPERTY_MGMT', 
  ADVISOR = 'ADVISOR',
  VISUALIZER = 'VISUALIZER',
  ADMIN = 'ADMIN'
}

export enum PurchaseTab { INPUT = 'INPUT', DASHBOARD = 'DASHBOARD' }
export enum PropertyTab { ASSETS = 'ASSETS', RENTALS = 'RENTALS', CONTACTS = 'CONTACTS' }
