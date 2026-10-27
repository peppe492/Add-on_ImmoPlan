import { InvoiceRecord, TaxCategory, InvoiceBeneficiary, InvoicePaymentMethod, Property, Attachment, Scenario } from '../../types';

export interface InvoiceTaxArchiveProps {
  theme?: 'DEFAULT' | 'NEON';
  owner1Name?: string;
  owner2Name?: string;
}

export interface YearDeductionSchedule {
  year: number;
  relativeYear: number;
  total: number;
  gAmount: number;
  cAmount: number;
  oneTimeDeductions: number;
  recurringDeductions: number;
  activeInvoicesCount: number;
  isYearOne: boolean;
  hasOneTime: boolean;
}

export interface InvoiceKpiSummary {
  totalInvoiced: number;
  totalEligible: number;
  totalDeduction: number;
  yearlyQuota: number;
  gShareTotal: number;
  cShareTotal: number;
  gYearlyQuota: number;
  cYearlyQuota: number;
  oneTimeDeductions: number;
  recurringDeductions: number;
  annualAverage: number;
}

export const DEFAULT_PROPERTIES_MAP: Record<string, { name: string; city: string }> = {
  'prop_01': { name: 'Trilocale Via Dante 45', city: 'Milano (MI)' },
  'prop_02': { name: 'Bilocale Corso Buenos Aires 12', city: 'Milano (MI)' },
  'prop_03': { name: 'Monolocale Via Po 8', city: 'Torino (TO)' }
};

export const SAMPLE_INVOICES: InvoiceRecord[] = [
  {
    id: 'inv_001',
    propertyId: 'prop_01',
    invoiceNumber: 'FAT-2024/118',
    supplier: 'Edilizia Lombarda Srl',
    invoiceDate: '2024-04-10',
    paymentDate: '2024-04-12',
    fiscalYear: 2024,
    description: 'Ristrutturazione bagno principale (G: Prima Casa 50% / C: Seconda Casa 36%)',
    taxCategory: 'BONUS_SPLIT',
    rate: 50,
    rateGiuseppe: 50,
    rateClaudia: 36,
    beneficiary: '50/50',
    splitGiuseppePercent: 50,
    splitClaudiaPercent: 50,
    paymentMethod: 'BONIFICO_PARLANTE',
    croCode: 'TRN 03002938102938102',
    amount: 14500.00,
    invoiceAttachment: { name: 'Fattura_EdiliziaLombarda_118.pdf', type: 'application/pdf', data: '' },
    receiptAttachment: { name: 'BonificoParlante_118.pdf', type: 'application/pdf', data: '' }
  },
  {
    id: 'inv_002',
    propertyId: 'prop_01',
    invoiceNumber: 'INF-2024/045',
    supplier: 'Schüco Infissi & Finestre Spa',
    invoiceDate: '2024-05-20',
    paymentDate: '2024-05-22',
    fiscalYear: 2024,
    description: 'Sostituzione 6 infissi in triplo vetro ad alta efficienza termica (Ecobonus 65%)',
    taxCategory: 'ECOBONUS_65',
    rate: 65,
    beneficiary: 'CUSTOM',
    splitGiuseppePercent: 70,
    splitClaudiaPercent: 30,
    paymentMethod: 'BONIFICO_PARLANTE',
    croCode: 'TRN 04918273645192837',
    amount: 12000.00,
    invoiceAttachment: { name: 'Fattura_Schuco_045.pdf', type: 'application/pdf', data: '' },
    receiptAttachment: { name: 'Bonifico_ENEA_Schuco.pdf', type: 'application/pdf', data: '' }
  },
  {
    id: 'inv_003',
    propertyId: 'prop_01',
    invoiceNumber: 'MOB-2024/88',
    supplier: 'Scavolini Store Milano',
    invoiceDate: '2024-06-15',
    paymentDate: '2024-06-15',
    fiscalYear: 2024,
    description: 'Cucina completa ed elettrodomestici in classe A+ (Bonus Mobili)',
    taxCategory: 'BONUS_MOBILI',
    rate: 50,
    beneficiary: 'Claudia',
    splitGiuseppePercent: 0,
    splitClaudiaPercent: 100,
    paymentMethod: 'CARTA_POS',
    croCode: 'POS-AUTH-992104',
    amount: 7200.00,
    invoiceAttachment: { name: 'Fattura_Cucina_Scavolini.pdf', type: 'application/pdf', data: '' },
    receiptAttachment: { name: 'Scontrino_POS_Scavolini.pdf', type: 'application/pdf', data: '' }
  },
  {
    id: 'inv_004',
    propertyId: 'prop_01',
    invoiceNumber: 'NOT-2024/012',
    supplier: 'Studio Notarile Avv. Dr. Ferrari',
    invoiceDate: '2024-02-18',
    paymentDate: '2024-02-18',
    fiscalYear: 2024,
    description: 'Parcella stipula atto di mutuo ipotecario per acquisto prima casa',
    taxCategory: 'NOTAIO_MUTUO',
    rate: 19,
    beneficiary: 'Giuseppe',
    splitGiuseppePercent: 100,
    splitClaudiaPercent: 0,
    paymentMethod: 'BONIFICO_ORDINARIO',
    croCode: 'TRN 01928374659283746',
    amount: 2200.00,
    invoiceAttachment: { name: 'Parcella_Notaio_Mutuo.pdf', type: 'application/pdf', data: '' },
    receiptAttachment: { name: 'Contabile_Notaio.pdf', type: 'application/pdf', data: '' }
  },
  {
    id: 'inv_005',
    propertyId: 'prop_01',
    invoiceNumber: 'MED-2024/302',
    supplier: 'Tecnocasa Immobili Milano',
    invoiceDate: '2024-01-25',
    paymentDate: '2024-01-25',
    fiscalYear: 2024,
    description: 'Provvigione mediazione acquisto immobile prima casa (detrazione 19% max 1.000€)',
    taxCategory: 'AGENZIA_19',
    rate: 19,
    beneficiary: '50/50',
    splitGiuseppePercent: 50,
    splitClaudiaPercent: 50,
    paymentMethod: 'BONIFICO_ORDINARIO',
    croCode: 'TRN 09182736450192834',
    amount: 4800.00,
    invoiceAttachment: { name: 'Fattura_Tecnocasa_Provvigione.pdf', type: 'application/pdf', data: '' },
    receiptAttachment: null
  },
  {
    id: 'inv_006',
    propertyId: 'prop_02',
    invoiceNumber: 'CAL-2025/014',
    supplier: 'Termoidraulica Clima Expert',
    invoiceDate: '2025-01-14',
    paymentDate: '2025-01-15',
    fiscalYear: 2025,
    description: 'Sostituzione pompa di calore ibrida e valvole termostatiche (Ecobonus)',
    taxCategory: 'ECOBONUS_65',
    rate: 65,
    beneficiary: 'Giuseppe',
    splitGiuseppePercent: 100,
    splitClaudiaPercent: 0,
    paymentMethod: 'BONIFICO_PARLANTE',
    croCode: 'TRN 07736251829304918',
    amount: 11050.00,
    invoiceAttachment: { name: 'Fattura_ClimaExpert_2025.pdf', type: 'application/pdf', data: '' },
    receiptAttachment: { name: 'BonificoParlante_Clima.pdf', type: 'application/pdf', data: '' }
  },
  {
    id: 'inv_007',
    propertyId: 'prop_03',
    invoiceNumber: 'VERN-2024/009',
    supplier: 'Decorazioni & Tinteggiature Po Srl',
    invoiceDate: '2024-03-12',
    paymentDate: '2024-03-12',
    fiscalYear: 2024,
    description: 'Tinteggiatura completa pareti e smaltatura porte interne',
    taxCategory: 'NONE',
    rate: 0,
    beneficiary: 'Claudia',
    splitGiuseppePercent: 0,
    splitClaudiaPercent: 100,
    paymentMethod: 'BONIFICO_ORDINARIO',
    croCode: 'TRN 08192830192837461',
    amount: 1600.00,
    invoiceAttachment: { name: 'Fattura_Tinteggiatura.pdf', type: 'application/pdf', data: '' },
    receiptAttachment: { name: 'Bonifico_Tinteggiatura.pdf', type: 'application/pdf', data: '' }
  }
];
