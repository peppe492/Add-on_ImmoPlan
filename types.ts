
export interface Attachment {
  name: string;
  data: string;
  type: string;
}

export interface CostDetail {
  amount: number;
  paidAmount?: number; // Nuovo campo per pagamenti parziali
  isPaid: boolean;
  paymentDate: string;
  attachment?: Attachment;
}

export interface RenovationItem {
  id: string;
  description: string;
  amount: number;
  isPaid: boolean;
  paymentDate: string;
  attachment?: Attachment;
}

export interface CustomSensor {
  id: string; // generated uuid
  entity_id_suffix: string; // e.g. "cashflow_viaroma" -> sensor.immoplan_cashflow_viaroma
  name: string;
  type: 'PROPERTY_CASHFLOW' | 'PROPERTY_VALUE' | 'CATEGORY_TOTAL';
  targetId?: string; // Property ID or Category ID
}

export interface FinancialData {
  propertyName: string;
  totalPrice: number;
  propertyPayments?: RenovationItem[]; // Nuovo: Lista acconti/tranche prezzo immobile
  totalBudget: number;
  liquidityGiuseppe: number;
  liquidityClaudia: number;
  loanPercentage: number;
  purchaseCosts: {
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
    design: CostDetail | number;
    contingency: number;
  };
  customSensors?: CustomSensor[]; // New field for custom sensors configuration
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

export interface RentalData {
  propertyValue: number;
  monthlyRent: number;
  mortgage: number;
  condo: number;
  utilities: number;
  internet: number;
  maintenance: number;
  taxes: number;
  taxRate: number;
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
    mortgageDuration?: number; // Anni
    mortgageStartDate?: string;
    mortgageRate?: number; // Percentuale interesse
    monthlyRent?: number; // Canone attuale o stimato
    condoFees: number;
    defaultTaxRate: number;
    targetMargin?: number; // Margine percentuale desiderato
  };
  recurringCosts?: RecurringCost[];
  currentTenantId?: string; 
  documents?: Attachment[];
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
