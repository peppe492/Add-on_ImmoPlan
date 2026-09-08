import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InvoiceRecord, TaxCategory, InvoiceBeneficiary, InvoicePaymentMethod, Property, Attachment, Scenario } from '../types';
import { db } from '../services/dbService';

interface InvoiceTaxArchiveProps {
  theme?: 'DEFAULT' | 'NEON';
  owner1Name?: string;
  owner2Name?: string;
}

// Initial sample data from tested prototype
const SAMPLE_INVOICES: InvoiceRecord[] = [
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

const DEFAULT_PROPERTIES_MAP: Record<string, { name: string; city: string }> = {
  'prop_01': { name: 'Trilocale Via Dante 45', city: 'Milano (MI)' },
  'prop_02': { name: 'Bilocale Corso Buenos Aires 12', city: 'Milano (MI)' },
  'prop_03': { name: 'Monolocale Via Po 8', city: 'Torino (TO)' }
};

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

export const InvoiceTaxArchive: React.FC<InvoiceTaxArchiveProps> = ({
  theme = 'DEFAULT',
  owner1Name: propOwner1,
  owner2Name: propOwner2
}) => {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Co-Owners / Beneficiaries custom names
  const [owner1Name, setOwner1Name] = useState<string>(propOwner1 || 'Giuseppe');
  const [owner2Name, setOwner2Name] = useState<string>(propOwner2 || 'Claudia');

  useEffect(() => {
    if (propOwner1) setOwner1Name(propOwner1);
    if (propOwner2) setOwner2Name(propOwner2);
  }, [propOwner1, propOwner2]);

  const isOwner1 = (val?: string) => val === owner1Name || val === 'Giuseppe';
  const isOwner2 = (val?: string) => val === owner2Name || val === 'Claudia';
  const owner1Initial = (owner1Name || 'G').charAt(0).toUpperCase();
  const owner2Initial = (owner2Name || 'C').charAt(0).toUpperCase();

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProperty, setFilterProperty] = useState<string>('ALL');
  const [filterYear, setFilterYear] = useState<string>('ALL');
  const [filterBeneficiary, setFilterBeneficiary] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterOnlyMissing, setFilterOnlyMissing] = useState<boolean>(false);

  // Accordion Guide State
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEditingId, setCurrentEditingId] = useState<string | null>(null);

  // Form Fields State
  const [formPropertyId, setFormPropertyId] = useState('prop_01');
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formInvoiceDate, setFormInvoiceDate] = useState('');
  const [formPaymentDate, setFormPaymentDate] = useState('');
  const [formFiscalYear, setFormFiscalYear] = useState(new Date().getFullYear());
  const [formDescription, setFormDescription] = useState('');
  const [formTaxCategory, setFormTaxCategory] = useState<TaxCategory>('BONUS_50');
  const [formRateGiuseppe, setFormRateGiuseppe] = useState<number>(50);
  const [formRateClaudia, setFormRateClaudia] = useState<number>(36);
  const [formBeneficiary, setFormBeneficiary] = useState<InvoiceBeneficiary>('50/50');
  const [formSplitGiuseppe, setFormSplitGiuseppe] = useState<number>(70);
  const [formSplitClaudia, setFormSplitClaudia] = useState<number>(30);
  const [formPaymentMethod, setFormPaymentMethod] = useState<InvoicePaymentMethod>('BONIFICO_PARLANTE');
  const [formCroCode, setFormCroCode] = useState('');
  const [formAmount, setFormAmount] = useState<number | ''>('');

  // Form Attachment Temp States
  const [formInvoiceFile, setFormInvoiceFile] = useState<Attachment | null>(null);
  const [formReceiptFile, setFormReceiptFile] = useState<Attachment | null>(null);

  // Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<{ invoice: InvoiceRecord; type: 'invoice' | 'receipt'; attachment: Attachment } | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; icon: string; visible: boolean }>({
    message: '',
    icon: '✓',
    visible: false
  });

  const showToast = (message: string, icon = '✓') => {
    setToast({ message, icon, visible: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3500);
  };

  // Backup & Ripristino State
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupModalTab, setBackupModalTab] = useState<'EXPORT' | 'IMPORT'>('EXPORT');
  const [importPendingInvoices, setImportPendingInvoices] = useState<InvoiceRecord[] | null>(null);
  const [importMeta, setImportMeta] = useState<{
    filename: string;
    count: number;
    totalAmount: number;
    attachmentsCount: number;
    exportDate?: string;
    years: number[];
  } | null>(null);
  const [importMode, setImportMode] = useState<'MERGE' | 'OVERWRITE'>('MERGE');
  const [importError, setImportError] = useState<string | null>(null);
  const [isImportProcessing, setIsImportProcessing] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  // KPI 4 Dynamic Reference Year State
  const [selectedKpiYear, setSelectedKpiYear] = useState<number | null>(null);
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const yearPickerRef = useRef<HTMLDivElement>(null);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);

  // Synchronize KPI 4 year if user filters by fiscal year in toolbar
  useEffect(() => {
    if (filterYear !== 'ALL') {
      const fy = parseInt(filterYear);
      if (!isNaN(fy)) {
        setSelectedKpiYear(fy);
      }
    }
  }, [filterYear]);

  // Close KPI 4 year picker when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        yearPickerRef.current &&
        !yearPickerRef.current.contains(target) &&
        calendarButtonRef.current &&
        !calendarButtonRef.current.contains(target)
      ) {
        setIsYearPickerOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isYearPickerOpen) {
        setIsYearPickerOpen(false);
      }
    };

    if (isYearPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isYearPickerOpen]);

  // Load Data from IndexedDB
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invs, props, scens, appData] = await Promise.all([
        db.getInvoices(),
        db.getProperties(),
        db.getScenarios(),
        db.getAppData()
      ]);

      if (appData) {
        if (appData.owner1Name && !propOwner1) setOwner1Name(appData.owner1Name);
        if (appData.owner2Name && !propOwner2) setOwner2Name(appData.owner2Name);
      }

      setProperties(props || []);
      setScenarios(scens || []);

      if (invs && invs.length > 0) {
        setInvoices(invs);
        localStorage.setItem('immoplan_invoices_initialized', 'true');
      } else {
        const hasInitialized = localStorage.getItem('immoplan_invoices_initialized');
        if (!hasInitialized) {
          // Seed with realistic sample invoices if DB has never been initialized
          const o1 = (appData && appData.owner1Name) || propOwner1 || 'Giuseppe';
          const o2 = (appData && appData.owner2Name) || propOwner2 || 'Claudia';
          const customizedSamples = SAMPLE_INVOICES.map(sample => {
            let ben = sample.beneficiary;
            if (ben === 'Giuseppe') ben = o1;
            else if (ben === 'Claudia') ben = o2;
            return { ...sample, beneficiary: ben };
          });
          await db.saveInvoicesBatch(customizedSamples);
          setInvoices(customizedSamples);
          localStorage.setItem('immoplan_invoices_initialized', 'true');
        } else {
          setInvoices([]);
        }
      }
    } catch (err) {
      console.error('Error loading invoices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleRestoreEvent = () => {
      loadData();
    };
    window.addEventListener('immoplan-db-restored', handleRestoreEvent);
    return () => window.removeEventListener('immoplan-db-restored', handleRestoreEvent);
  }, []);

  // Merged Properties Directory Map (Real properties first, then scenarios, then sample fallback)
  const propertyDirectory = useMemo(() => {
    const dir: Record<string, { name: string; city: string }> = {};

    // 1. Prioritize real properties from database
    properties.forEach(p => {
      dir[p.id] = { name: p.name, city: p.address || 'Italia' };
    });

    // 2. Merge scenarios if they have property identifiers
    scenarios.forEach(s => {
      if (!dir[s.id]) {
        dir[s.id] = { name: s.name, city: s.data.propertyName || 'Progetto' };
      }
    });

    // 3. Fallback for sample properties (prop_01, prop_02, prop_03)
    Object.entries(DEFAULT_PROPERTIES_MAP).forEach(([k, v]) => {
      if (!dir[k]) {
        dir[k] = v;
      }
    });

    return dir;
  }, [properties, scenarios]);

  // Currency Formatter
  const fmt = (num: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(num || 0);

  // Calculation Engine matching Italian Tax Rules
  const computeDeduction = (
    amount: number,
    category: TaxCategory,
    fallbackRate: number,
    rateG?: number,
    rateC?: number,
    ratioG = 0.5,
    ratioC = 0.5
  ) => {
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

  // Distinct Years for Filter Dropdown
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    invoices.forEach(i => years.add(i.fiscalYear));
    years.add(new Date().getFullYear());
    years.add(new Date().getFullYear() - 1);
    return Array.from(years).sort((a, b) => b - a);
  }, [invoices]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return invoices.filter(inv => {
      const matchSearch =
        !q ||
        inv.supplier.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.croCode && inv.croCode.toLowerCase().includes(q)) ||
        inv.description.toLowerCase().includes(q);

      const matchProp = filterProperty === 'ALL' || inv.propertyId === filterProperty;
      const matchYear = filterYear === 'ALL' || inv.fiscalYear.toString() === filterYear;
      const matchBen = filterBeneficiary === 'ALL' ||
        (isOwner1(filterBeneficiary) ? isOwner1(inv.beneficiary) :
         isOwner2(filterBeneficiary) ? isOwner2(inv.beneficiary) :
         inv.beneficiary === filterBeneficiary);
      const matchCat = filterCategory === 'ALL' || inv.taxCategory === filterCategory;
      const matchMissing =
        !filterOnlyMissing || (!inv.receiptAttachment || !inv.invoiceAttachment);

      return matchSearch && matchProp && matchYear && matchBen && matchCat && matchMissing;
    });
  }, [invoices, searchQuery, filterProperty, filterYear, filterBeneficiary, filterCategory, filterOnlyMissing, owner1Name, owner2Name]);

  // KPI Calculations
  const kpis = useMemo(() => {
    let totalExpenses = 0;
    let giuseppeExpenses = 0;
    let claudiaExpenses = 0;
    let deductibleBase = 0;
    let totalDeductions = 0;
    let yearlyQuota = 0;
    let giuseppeQuota = 0;
    let claudiaQuota = 0;

    filteredInvoices.forEach(inv => {
      totalExpenses += inv.amount;

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

      deductibleBase += calc.deductibleBase;
      totalDeductions += calc.totalDeduction;
      yearlyQuota += calc.yearlyQuota;

      giuseppeExpenses += inv.amount * gRatio;
      claudiaExpenses += inv.amount * cRatio;
      giuseppeQuota += calc.gYearly;
      claudiaQuota += calc.cYearly;
    });

    const ratioPercent = totalExpenses > 0 ? ((deductibleBase / totalExpenses) * 100).toFixed(1) : '0';

    return {
      totalExpenses,
      giuseppeExpenses,
      claudiaExpenses,
      deductibleBase,
      ratioPercent,
      totalDeductions,
      yearlyQuota,
      giuseppeQuota,
      claudiaQuota
    };
  }, [filteredInvoices]);

  // KPI 4: Dynamic 10-Year Timeline Calculation per Fiscal Year
  const { kpiTimeline, startYear, endYear } = useMemo(() => {
    const fiscalYears = filteredInvoices
      .map(inv => inv.fiscalYear)
      .filter(y => typeof y === 'number' && !isNaN(y));

    const sYear = fiscalYears.length > 0 ? Math.min(...fiscalYears) : new Date().getFullYear();
    const maxInvYear = fiscalYears.length > 0 ? Math.max(...fiscalYears) : sYear;
    // Multi-year deductions last 10 years (sYear to sYear + 9, or up to maxInvYear + 9)
    const eYear = Math.max(sYear + 9, maxInvYear + 9);

    const timeline: YearDeductionSchedule[] = [];

    for (let y = sYear; y <= eYear; y++) {
      let total = 0;
      let gAmount = 0;
      let cAmount = 0;
      let oneTimeDeductions = 0;
      let recurringDeductions = 0;
      let activeInvoicesCount = 0;

      filteredInvoices.forEach(inv => {
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
        const invYear = inv.fiscalYear;

        if (calc.installmentCount === 1) {
          if (y === invYear) {
            total += calc.totalDeduction;
            gAmount += calc.gTotal;
            cAmount += calc.cTotal;
            oneTimeDeductions += calc.totalDeduction;
            activeInvoicesCount++;
          }
        } else if (calc.installmentCount === 10) {
          if (y >= invYear && y < invYear + 10) {
            total += calc.yearlyQuota;
            gAmount += calc.gYearly;
            cAmount += calc.cYearly;
            recurringDeductions += calc.yearlyQuota;
            activeInvoicesCount++;
          }
        }
      });

      const relYear = y - sYear + 1;
      timeline.push({
        year: y,
        relativeYear: relYear,
        total,
        gAmount,
        cAmount,
        oneTimeDeductions,
        recurringDeductions,
        activeInvoicesCount,
        isYearOne: relYear === 1,
        hasOneTime: oneTimeDeductions > 0
      });
    }

    return { kpiTimeline: timeline, startYear: sYear, endYear: eYear };
  }, [filteredInvoices]);

  const effectiveSelectedYear = useMemo(() => {
    if (selectedKpiYear !== null && selectedKpiYear >= startYear && selectedKpiYear <= endYear) {
      return selectedKpiYear;
    }
    if (filterYear !== 'ALL') {
      const fy = parseInt(filterYear);
      if (!isNaN(fy) && fy >= startYear && fy <= endYear) return fy;
    }
    return startYear;
  }, [selectedKpiYear, startYear, endYear, filterYear]);

  const selectedYearData = useMemo<YearDeductionSchedule>(() => {
    const found = kpiTimeline.find(item => item.year === effectiveSelectedYear);
    return found || kpiTimeline[0] || {
      year: startYear,
      relativeYear: 1,
      total: 0,
      gAmount: 0,
      cAmount: 0,
      oneTimeDeductions: 0,
      recurringDeductions: 0,
      activeInvoicesCount: 0,
      isYearOne: true,
      hasOneTime: false
    };
  }, [kpiTimeline, effectiveSelectedYear, startYear]);

  // Modal Open for Add
  const openNewInvoiceModal = () => {
    setCurrentEditingId(null);
    setFormPropertyId(filterProperty !== 'ALL' ? filterProperty : Object.keys(propertyDirectory)[0] || 'prop_01');
    setFormInvoiceNumber('');
    setFormSupplier('');
    const today = new Date().toISOString().split('T')[0];
    setFormInvoiceDate(today);
    setFormPaymentDate(today);
    setFormFiscalYear(new Date().getFullYear());
    setFormDescription('');
    setFormTaxCategory('BONUS_50');
    setFormRateGiuseppe(50);
    setFormRateClaudia(36);
    setFormBeneficiary('50/50');
    setFormSplitGiuseppe(70);
    setFormSplitClaudia(30);
    setFormPaymentMethod('BONIFICO_PARLANTE');
    setFormCroCode('');
    setFormAmount('');
    setFormInvoiceFile(null);
    setFormReceiptFile(null);
    setIsModalOpen(true);
  };

  // Modal Open for Edit
  const handleEditInvoice = (inv: InvoiceRecord) => {
    setCurrentEditingId(inv.id);
    setFormPropertyId(inv.propertyId || 'prop_01');
    setFormInvoiceNumber(inv.invoiceNumber);
    setFormSupplier(inv.supplier);
    setFormInvoiceDate(inv.invoiceDate);
    setFormPaymentDate(inv.paymentDate);
    setFormFiscalYear(inv.fiscalYear);
    setFormDescription(inv.description);
    setFormTaxCategory(inv.taxCategory);
    setFormRateGiuseppe(inv.rateGiuseppe ?? 50);
    setFormRateClaudia(inv.rateClaudia ?? 36);
    if (isOwner1(inv.beneficiary)) {
      setFormBeneficiary(owner1Name);
    } else if (isOwner2(inv.beneficiary)) {
      setFormBeneficiary(owner2Name);
    } else {
      setFormBeneficiary(inv.beneficiary);
    }
    setFormSplitGiuseppe(inv.splitGiuseppePercent ?? 70);
    setFormSplitClaudia(inv.splitClaudiaPercent ?? 30);
    setFormPaymentMethod(inv.paymentMethod);
    setFormCroCode(inv.croCode || '');
    setFormAmount(inv.amount);
    setFormInvoiceFile(inv.invoiceAttachment || null);
    setFormReceiptFile(inv.receiptAttachment || null);
    setIsModalOpen(true);
  };

  // Delete Invoice
  const handleDeleteInvoice = async (id: string) => {
    if (window.confirm("Sei sicuro di voler eliminare questa voce dall'archivio fiscale?")) {
      await db.deleteInvoice(id);
      setInvoices(prev => prev.filter(i => i.id !== id));
      showToast("Fattura rimossa dall'archivio", '🗑️');
    }
  };

  // File Upload Helper
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'receipt') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const att: Attachment = {
          name: file.name,
          data: reader.result as string,
          type: file.type
        };
        if (type === 'invoice') {
          setFormInvoiceFile(att);
        } else {
          setFormReceiptFile(att);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Calculate modal dynamic rates
  const currentModalCalc = useMemo(() => {
    const numAmount = typeof formAmount === 'number' ? formAmount : parseFloat(formAmount) || 0;
    let fallbackRate = 50;
    if (formTaxCategory === 'BONUS_36') fallbackRate = 36;
    else if (formTaxCategory === 'ECOBONUS_65') fallbackRate = 65;
    else if (formTaxCategory === 'AGENZIA_19' || formTaxCategory === 'NOTAIO_MUTUO') fallbackRate = 19;
    else if (formTaxCategory === 'NONE') fallbackRate = 0;

    let ratioG = 0.5;
    let ratioC = 0.5;
    if (isOwner1(formBeneficiary)) {
      ratioG = 1.0;
      ratioC = 0.0;
    } else if (isOwner2(formBeneficiary)) {
      ratioG = 0.0;
      ratioC = 1.0;
    } else if (formBeneficiary === 'CUSTOM') {
      ratioG = formSplitGiuseppe / 100;
      ratioC = formSplitClaudia / 100;
    }

    return computeDeduction(
      numAmount,
      formTaxCategory,
      fallbackRate,
      formRateGiuseppe,
      formRateClaudia,
      ratioG,
      ratioC
    );
  }, [
    formAmount,
    formTaxCategory,
    formBeneficiary,
    formSplitGiuseppe,
    formSplitClaudia,
    formRateGiuseppe,
    formRateClaudia,
    owner1Name,
    owner2Name
  ]);

  // Form Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = typeof formAmount === 'number' ? formAmount : parseFloat(formAmount) || 0;

    let rate = 50;
    if (formTaxCategory === 'BONUS_36') rate = 36;
    else if (formTaxCategory === 'ECOBONUS_65') rate = 65;
    else if (formTaxCategory === 'AGENZIA_19' || formTaxCategory === 'NOTAIO_MUTUO') rate = 19;
    else if (formTaxCategory === 'NONE') rate = 0;

    let splitG = 50;
    let splitC = 50;
    if (isOwner1(formBeneficiary)) {
      splitG = 100;
      splitC = 0;
    } else if (isOwner2(formBeneficiary)) {
      splitG = 0;
      splitC = 100;
    } else if (formBeneficiary === 'CUSTOM') {
      splitG = formSplitGiuseppe;
      splitC = formSplitClaudia;
    }

    const savedBeneficiary: InvoiceBeneficiary = isOwner1(formBeneficiary)
      ? owner1Name
      : isOwner2(formBeneficiary)
      ? owner2Name
      : formBeneficiary;

    const record: InvoiceRecord = {
      id: currentEditingId || `inv_${Date.now()}`,
      propertyId: formPropertyId,
      invoiceNumber: formInvoiceNumber,
      supplier: formSupplier,
      invoiceDate: formInvoiceDate,
      paymentDate: formPaymentDate,
      fiscalYear: formFiscalYear,
      description: formDescription,
      taxCategory: formTaxCategory,
      rate: rate,
      rateGiuseppe: formTaxCategory === 'BONUS_SPLIT' ? formRateGiuseppe : rate,
      rateClaudia: formTaxCategory === 'BONUS_SPLIT' ? formRateClaudia : rate,
      beneficiary: savedBeneficiary,
      splitGiuseppePercent: splitG,
      splitClaudiaPercent: splitC,
      paymentMethod: formPaymentMethod,
      croCode: formCroCode,
      amount: numAmount,
      invoiceAttachment: formInvoiceFile,
      receiptAttachment: formReceiptFile
    };

    await db.saveInvoice(record);

    if (currentEditingId) {
      setInvoices(prev => prev.map(item => (item.id === currentEditingId ? record : item)));
      showToast('Fattura aggiornata con successo!');
    } else {
      setInvoices(prev => [record, ...prev]);
      showToast('Nuova fattura registrata con successo!');
    }

    setIsModalOpen(false);
  };

  // Preview Document Modal
  const previewDocument = (inv: InvoiceRecord, type: 'invoice' | 'receipt') => {
    const attachment = type === 'invoice' ? inv.invoiceAttachment : inv.receiptAttachment;
    if (!attachment) {
      showToast('Nessun allegato presente per questa voce', '⚠️');
      return;
    }
    setPreviewDoc({ invoice: inv, type, attachment });
  };

  // Download preview file
  const downloadCurrentPreviewFile = () => {
    if (!previewDoc || !previewDoc.attachment) return;
    const att = previewDoc.attachment;
    if (att.data) {
      const a = document.createElement('a');
      a.href = att.data;
      a.download = att.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Scaricamento ${att.name} completato!`, '📥');
    } else {
      const propInfo = propertyDirectory[previewDoc.invoice.propertyId] || { name: 'Immobile', city: '' };
      const text = `IMMEDIATE TAX RECEIPT / FATTURA DETRAZIONI 730\n\nImmobile: ${propInfo.name}\nFornitore: ${previewDoc.invoice.supplier}\nNumero: ${previewDoc.invoice.invoiceNumber}\nData: ${previewDoc.invoice.paymentDate}\nImporto: EUR ${previewDoc.invoice.amount}\nBeneficiario: ${previewDoc.invoice.beneficiary}\nDetrazione: ${previewDoc.invoice.taxCategory} (${previewDoc.invoice.rate}%)\nCRO: ${previewDoc.invoice.croCode || 'N/A'}\n`;
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.name.replace(/\.pdf$/, '') + '_certificato.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Download ${att.name} completato!`, '📥');
    }
  };

  // Export to Italian Excel / CSV
  const exportToExcel = () => {
    const headers = [
      'ID_Univoco',
      'Immobile',
      'Citta_Indirizzo',
      'Data_Pagamento_Cassa',
      'Anno_Fiscale_730',
      'Fornitore_RagioneSociale',
      'Numero_Fattura',
      'Data_Fattura',
      'Descrizione_Intervento',
      'Categoria_Detrazione',
      `Aliquota_${owner1Name}_%`,
      `Aliquota_${owner2Name}_%`,
      'Intestatario_Beneficiario',
      `Quota_${owner1Name}_%`,
      `Quota_${owner2Name}_%`,
      `Spesa_${owner1Name}_Euro`,
      `Spesa_${owner2Name}_Euro`,
      `Detrazione_${owner1Name}_Euro`,
      `Detrazione_${owner2Name}_Euro`,
      `Rata730_${owner1Name}_Euro`,
      `Rata730_${owner2Name}_Euro`,
      'Metodo_Pagamento',
      'Codice_CRO_TRN',
      'Importo_Fattura_Euro',
      'Base_Spesa_Ammessa_Euro',
      'Credito_Fiscale_Totale_Euro',
      'Rata_Annuale_730_Euro',
      'Anni_Rateizzazione',
      'Fattura_Presente',
      'Bonifico_Parlante_Presente'
    ];

    const rows = filteredInvoices.map(inv => {
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
      const prop = propertyDirectory[inv.propertyId] || { name: 'Immobile', city: '' };

      const gExpense = inv.amount * gRatio;
      const cExpense = inv.amount * cRatio;

      return [
        inv.id,
        `"${(prop.name || 'Immobile').replace(/"/g, '""')}"`,
        `"${(prop.city || '').replace(/"/g, '""')}"`,
        inv.paymentDate || '',
        inv.fiscalYear || '',
        `"${(inv.supplier || '').replace(/"/g, '""')}"`,
        `"${(inv.invoiceNumber || '').replace(/"/g, '""')}"`,
        inv.invoiceDate || '',
        `"${(inv.description || '').replace(/"/g, '""')}"`,
        `"${inv.taxCategory || ''}"`,
        rateG,
        rateC,
        `"${inv.beneficiary || ''}"`,
        (gRatio * 100).toFixed(0),
        (cRatio * 100).toFixed(0),
        gExpense.toFixed(2).replace('.', ','),
        cExpense.toFixed(2).replace('.', ','),
        calc.gTotal.toFixed(2).replace('.', ','),
        calc.cTotal.toFixed(2).replace('.', ','),
        calc.gYearly.toFixed(2).replace('.', ','),
        calc.cYearly.toFixed(2).replace('.', ','),
        `"${inv.paymentMethod || ''}"`,
        `"${(inv.croCode || '').replace(/"/g, '""')}"`,
        (inv.amount || 0).toFixed(2).replace('.', ','),
        calc.deductibleBase.toFixed(2).replace('.', ','),
        calc.totalDeduction.toFixed(2).replace('.', ','),
        calc.yearlyQuota.toFixed(2).replace('.', ','),
        calc.installmentCount,
        inv.invoiceAttachment ? 'SI' : 'NO',
        inv.receiptAttachment ? 'SI' : 'NO'
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const exportYear = filterYear !== 'ALL' ? filterYear : new Date().getFullYear();
    link.setAttribute('download', `ImmoPlan_Fascicolo_Fatture_Detrazioni_730_${exportYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Fascicolo Excel 730 scaricato con successo!', '📊');
  };

  // Helper parsers and normalizers for bulletproof JSON import
  const parseAmount = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    let s = String(val).replace(/[^0-9.,-]/g, '').trim();
    if (s.includes(',') && s.includes('.')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    const parsed = parseFloat(s);
    return isNaN(parsed) ? 0 : parsed;
  };

  const parseNum = (val: any, fallback?: number): number | undefined => {
    if (typeof val === 'number' && !isNaN(val)) return val;
    if (val !== undefined && val !== null && val !== '') {
      const s = String(val).replace(',', '.').trim();
      const parsed = parseFloat(s);
      if (!isNaN(parsed)) return parsed;
    }
    return fallback;
  };

  const sanitizeTaxCategory = (cat: any): TaxCategory => {
    if (!cat || typeof cat !== 'string') return 'NONE';
    const upper = cat.trim().toUpperCase();
    const valid: TaxCategory[] = [
      'BONUS_50',
      'BONUS_36',
      'BONUS_SPLIT',
      'ECOBONUS_65',
      'BONUS_MOBILI',
      'AGENZIA_19',
      'NOTAIO_MUTUO',
      'NONE'
    ];
    if (valid.includes(upper as TaxCategory)) return upper as TaxCategory;
    if (upper.includes('ECO') || upper.includes('65')) return 'ECOBONUS_65';
    if (upper.includes('MOBILI')) return 'BONUS_MOBILI';
    if (upper.includes('SPLIT')) return 'BONUS_SPLIT';
    if (upper.includes('36')) return 'BONUS_36';
    if (upper.includes('50')) return 'BONUS_50';
    if (upper.includes('AGENZIA')) return 'AGENZIA_19';
    if (upper.includes('NOTAIO')) return 'NOTAIO_MUTUO';
    return 'NONE';
  };

  const sanitizeBeneficiary = (ben: any): InvoiceBeneficiary => {
    if (!ben || typeof ben !== 'string') return '50/50';
    const trimmed = ben.trim();
    if (isOwner1(trimmed)) return owner1Name;
    if (isOwner2(trimmed)) return owner2Name;
    if (/^custom$/i.test(trimmed) || /^pers/i.test(trimmed)) return 'CUSTOM';
    return '50/50';
  };

  const sanitizePaymentMethod = (pm: any): InvoicePaymentMethod => {
    if (!pm || typeof pm !== 'string') return 'BONIFICO_ORDINARIO';
    const upper = pm.trim().toUpperCase();
    if (upper.includes('PARLANTE')) return 'BONIFICO_PARLANTE';
    if (upper.includes('POS') || upper.includes('CARTA')) return 'CARTA_POS';
    if (upper.includes('ASSEGNO')) return 'ASSEGNO';
    return 'BONIFICO_ORDINARIO';
  };

  const sanitizeAttachment = (att: any): Attachment | null => {
    if (!att || typeof att !== 'object') return null;
    if (typeof att.name === 'string' && att.name.trim()) {
      return {
        name: att.name.trim(),
        type: typeof att.type === 'string' ? att.type : 'application/pdf',
        data: typeof att.data === 'string' ? att.data : ''
      };
    }
    return null;
  };

  // Export JSON Backup of All Invoices & Parameters
  const handleExportJsonBackup = () => {
    try {
      const exportPayload = {
        version: '1.0',
        app: 'ImmoPlan',
        module: 'invoices',
        exportDate: new Date().toISOString(),
        totalRecords: invoices.length,
        totalAmount: invoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0),
        metadata: {
          system: 'Archivio Fatture & Detrazioni Fiscali 730',
          exportedAt: new Date().toLocaleString('it-IT'),
          propertiesCount: properties.length,
          totalTaxDeductions: kpis.totalDeductions,
          yearlyTaxQuota: kpis.yearlyQuota
        },
        invoices: invoices
      };

      const jsonStr = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.download = `immoplan_fatture_detrazioni_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Backup JSON esportato con successo (${invoices.length} fatture con allegati)`, '💾');
    } catch (err: any) {
      console.error('Export JSON error:', err);
      showToast(`Errore durante l'esportazione: ${err?.message || 'errore'}`, '⚠️');
    }
  };

  // Parse and Validate Imported JSON Backup
  const processImportFile = (file: File) => {
    setImportError(null);
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setImportError('Il file selezionato non ha estensione .json. Seleziona un file di backup valido.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text || !text.trim()) {
          setImportError('Il file JSON selezionato è vuoto.');
          return;
        }

        const parsed = JSON.parse(text);
        let rawList: any[] | null = null;
        let exportDate: string | undefined = parsed.exportDate || parsed.metadata?.exportedAt;

        if (Array.isArray(parsed.invoices)) {
          rawList = parsed.invoices;
        } else if (parsed.data && Array.isArray(parsed.data.invoices)) {
          rawList = parsed.data.invoices;
          if (!exportDate) exportDate = parsed.exportDate;
        } else if (Array.isArray(parsed.data)) {
          rawList = parsed.data;
          if (!exportDate) exportDate = parsed.exportDate;
        } else if (Array.isArray(parsed)) {
          rawList = parsed;
        } else if (Array.isArray(parsed.items)) {
          rawList = parsed.items;
        } else if (Array.isArray(parsed.records)) {
          rawList = parsed.records;
        }

        if (!rawList || rawList.length === 0) {
          setImportError('Nessun record fattura valido trovato nel file JSON.');
          setImportPendingInvoices(null);
          setImportMeta(null);
          return;
        }

        const normalized: InvoiceRecord[] = [];
        const yearsSet = new Set<number>();
        let attachmentsCount = 0;
        let totalAmount = 0;

        rawList.forEach((item: any, idx: number) => {
          if (!item || typeof item !== 'object') return;

          const numAmount = parseAmount(item.amount);
          const rawYear = parseNum(item.fiscalYear, new Date().getFullYear()) || new Date().getFullYear();
          const fYear = Math.round(rawYear);
          yearsSet.add(fYear);
          totalAmount += numAmount;

          const invoiceAtt = sanitizeAttachment(item.invoiceAttachment);
          const receiptAtt = sanitizeAttachment(item.receiptAttachment);

          if (invoiceAtt?.data || receiptAtt?.data) {
            attachmentsCount++;
          }

          const taxCategory = sanitizeTaxCategory(item.taxCategory);
          const beneficiary = sanitizeBeneficiary(item.beneficiary);
          const rateVal = parseNum(item.rate, 0) ?? 0;
          const rateGVal = parseNum(item.rateGiuseppe, undefined);
          const rateCVal = parseNum(item.rateClaudia, undefined);
          const splitGVal = parseNum(item.splitGiuseppePercent, undefined);
          const splitCVal = parseNum(item.splitClaudiaPercent, undefined);

          const record: InvoiceRecord = {
            id: item.id ? String(item.id) : `inv_imp_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            propertyId: item.propertyId ? String(item.propertyId) : 'prop_01',
            invoiceNumber: item.invoiceNumber || `FAT-IMP-${idx + 1}`,
            supplier: item.supplier || 'Fornitore sconosciuto',
            invoiceDate: item.invoiceDate || new Date().toISOString().slice(0, 10),
            paymentDate: item.paymentDate || item.invoiceDate || new Date().toISOString().slice(0, 10),
            fiscalYear: fYear,
            description: item.description || '',
            taxCategory: taxCategory,
            rate: rateVal,
            rateGiuseppe: rateGVal,
            rateClaudia: rateCVal,
            beneficiary: beneficiary,
            splitGiuseppePercent: splitGVal,
            splitClaudiaPercent: splitCVal,
            paymentMethod: sanitizePaymentMethod(item.paymentMethod),
            croCode: item.croCode ? String(item.croCode) : '',
            amount: numAmount,
            invoiceAttachment: invoiceAtt,
            receiptAttachment: receiptAtt,
            createdAt: item.createdAt || new Date().toISOString()
          };

          normalized.push(record);
        });

        if (normalized.length === 0) {
          setImportError('Nessun record compatibile con le fatture è stato trovato nel file.');
          setImportPendingInvoices(null);
          setImportMeta(null);
          return;
        }

        setImportPendingInvoices(normalized);
        setImportMeta({
          filename: file.name,
          count: normalized.length,
          totalAmount,
          attachmentsCount,
          exportDate,
          years: Array.from(yearsSet).sort((a, b) => a - b)
        });
        setImportError(null);
      } catch (err: any) {
        setImportError(`Errore di lettura JSON: ${err?.message || 'Sintassi JSON non valida'}`);
        setImportPendingInvoices(null);
        setImportMeta(null);
      }
    };
    reader.onerror = () => {
      setImportError('Errore durante la lettura del file dal disco.');
    };
    reader.readAsText(file);
  };

  const handleImportFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImportFile(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImportFile(e.dataTransfer.files[0]);
    }
  };

  const executeImport = async () => {
    if (!importPendingInvoices || importPendingInvoices.length === 0) return;

    if (importMode === 'OVERWRITE') {
      const confirmed = window.confirm(
        `ATTENZIONE: Operazione distruttiva!\n\nTutte le ${invoices.length} fatture attualmente in archivio verranno eliminate e sostituite con le ${importPendingInvoices.length} fatture del file di backup.\n\nVuoi davvero procedere?`
      );
      if (!confirmed) return;
    }

    setIsImportProcessing(true);
    try {
      let finalInvoices: InvoiceRecord[] = [];

      if (importMode === 'OVERWRITE') {
        // Atomic batch clear + insert in a single transaction
        await db.saveInvoicesBatch(importPendingInvoices, true);
        finalInvoices = importPendingInvoices;
      } else {
        const map = new Map<string, InvoiceRecord>();
        invoices.forEach(inv => map.set(inv.id, inv));
        importPendingInvoices.forEach(inv => map.set(inv.id, inv));
        finalInvoices = Array.from(map.values());
        await db.saveInvoicesBatch(finalInvoices, false);
      }

      setInvoices(finalInvoices);
      localStorage.setItem('immoplan_invoices_initialized', 'true');
      window.dispatchEvent(new CustomEvent('immoplan-db-restored', { detail: { stores: ['invoices'] } }));

      showToast(
        importMode === 'OVERWRITE'
          ? `Archivio sovrascritto con successo: ${finalInvoices.length} fatture salvate!`
          : `Importazione completata: ${importPendingInvoices.length} voci elaborate (${finalInvoices.length} totali in archivio)!`,
        '💾'
      );

      setImportPendingInvoices(null);
      setImportMeta(null);
      setIsBackupModalOpen(false);
    } catch (err: any) {
      console.error('Import execution error:', err);
      setImportError(`Errore durante il salvataggio: ${err?.message || 'errore sconosciuto'}`);
    } finally {
      setIsImportProcessing(false);
    }
  };

  const resetImportSelection = () => {
    setImportPendingInvoices(null);
    setImportMeta(null);
    setImportError(null);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
    }
  };

  // Helper Badge Renderers
  const renderCategoryBadge = (inv: InvoiceRecord) => {
    const rateG = inv.rateGiuseppe ?? inv.rate;
    const rateC = inv.rateClaudia ?? inv.rate;

    if (inv.taxCategory === 'BONUS_SPLIT' || (typeof inv.rateGiuseppe === 'number' && typeof inv.rateClaudia === 'number' && inv.rateGiuseppe !== inv.rateClaudia)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
          🛠️ Ristr. {rateG}% G / {rateC}% C
        </span>
      );
    }
    switch (inv.taxCategory) {
      case 'BONUS_50':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            🏠 50% Prima Casa
          </span>
        );
      case 'BONUS_36':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
            🏢 36% Seconda Casa
          </span>
        );
      case 'ECOBONUS_65':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
            🌿 Ecobonus 65%
          </span>
        );
      case 'BONUS_MOBILI':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
            🛋️ Mobili 50%
          </span>
        );
      case 'AGENZIA_19':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
            🏢 Agenzia 19%
          </span>
        );
      case 'NOTAIO_MUTUO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            📜 Notaio 19%
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Ordinaria (0%)
          </span>
        );
    }
  };

  const renderBeneficiaryBadge = (inv: InvoiceRecord) => {
    if (isOwner1(inv.beneficiary)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> {owner1Name} 100%
        </span>
      );
    }
    if (isOwner2(inv.beneficiary)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
          <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span> {owner2Name} 100%
        </span>
      );
    }
    if (inv.beneficiary === 'CUSTOM') {
      const g = inv.splitGiuseppePercent ?? 50;
      const c = inv.splitClaudiaPercent ?? (100 - g);
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-mono">
          {g}% {owner1Initial} / {c}% {owner2Initial}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        50/50 {owner1Initial} & {owner2Initial}
      </span>
    );
  };

  const renderPaymentBadge = (method: InvoicePaymentMethod, croCode?: string) => {
    let methodBadge = '';
    let isParlante = false;
    switch (method) {
      case 'BONIFICO_PARLANTE':
        methodBadge = 'Bonifico Parlante';
        isParlante = true;
        break;
      case 'CARTA_POS':
        methodBadge = 'Carta POS / Bancomat';
        break;
      case 'ASSEGNO':
        methodBadge = 'Assegno Bancario';
        break;
      default:
        methodBadge = 'Bonifico Ordinario';
        break;
    }

    return (
      <div className="space-y-0.5">
        <span
          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
            isParlante
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {methodBadge}
        </span>
        {croCode && <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]" title={croCode}>{croCode}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Action Header: Export + Add Invoice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>🏛️</span> Archivio Fatture & Detrazioni Fiscali 730
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fascicolo unico bonifici parlanti, quote detraibili IRPEF e rate decennali per {owner1Name} e {owner2Name}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => {
              setBackupModalTab('EXPORT');
              setIsBackupModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition shadow-sm cursor-pointer"
            title="Backup ed importazione parametri/dati archivio 730"
          >
            <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Backup & Ripristino
          </button>
          <button
            onClick={exportToExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950/40 transition shadow-sm cursor-pointer"
          >
            <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Esporta Fascicolo Excel 730
          </button>
          <button
            onClick={openNewInvoiceModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Registra Fattura / Spesa
          </button>
        </div>
      </div>

      {/* Strategy Banner */}
      <div className="rounded-2xl p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950/30 border border-blue-100 dark:border-indigo-900/40 text-xs flex items-start gap-3 shadow-sm">
        <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="font-bold text-blue-900 dark:text-blue-300">
            💡 Principi Fisco 730: Cassa, Ripartizione Personale & Decennale
          </p>
          <p className="text-blue-800/80 dark:text-slate-300 leading-relaxed">
            Le spese detraibili imputate ai cantieri di acquisto e ristrutturazione durano <strong>10 anni</strong> e competono personalmente a <strong>{owner1Name}</strong> e <strong>{owner2Name}</strong>. L'archivio calcola automaticamente la base ammessa, separa le aliquote (es. 50% Prima Casa vs 36% Seconda Casa) e produce il prospetto rate per la dichiarazione dei redditi annuale.
          </p>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Totale Spese */}
        <div className="rounded-2xl p-5 shadow-sm space-y-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Totale Spese Archiviate</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {fmt(kpis.totalExpenses)}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold" title={`Spese intestate a ${owner1Name}`}>
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> {owner1Initial}: {fmt(kpis.giuseppeExpenses)}
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-400 font-semibold" title={`Spese intestate a ${owner2Name}`}>
              <span className="w-2 h-2 rounded-full bg-pink-500"></span> {owner2Initial}: {fmt(kpis.claudiaExpenses)}
            </span>
          </div>
        </div>

        {/* KPI 2: Base Spesa Ammessa */}
        <div className="rounded-2xl p-5 shadow-sm space-y-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Base Spesa Detraibile Ammessa</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
            {fmt(kpis.deductibleBase)}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <span>{kpis.ratioPercent}% delle spese archiviate</span>
          </div>
        </div>

        {/* KPI 3: Credito Fiscale Totale */}
        <div className="rounded-2xl p-5 shadow-sm space-y-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Credito Fiscale Totale Spettante</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight text-purple-600 dark:text-purple-400">
            {fmt(kpis.totalDeductions)}
          </p>
          <p className="text-[11px] text-slate-400">Sgravio IRPEF complessivo su tutti gli anni</p>
        </div>

        {/* KPI 4: Rata Annuale 730 Dinamica */}
        <div className="rounded-2xl p-5 shadow-sm space-y-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 border-l-4 border-l-amber-500 relative">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block truncate" title={`Rata Fiscale 730 per il ${selectedYearData.relativeYear}° anno (${selectedYearData.year})`}>
                Rata Annuale 730 • {selectedYearData.relativeYear}° Anno
              </span>
            </div>

            {/* Stepper controls & Calendar Popover Trigger */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Prev Year Button */}
              <button
                type="button"
                onClick={() => {
                  const prev = effectiveSelectedYear - 1;
                  if (prev >= startYear) setSelectedKpiYear(prev);
                }}
                disabled={effectiveSelectedYear <= startYear}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                title="Anno precedente"
                aria-label="Anno precedente"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Interactive Calendar Trigger Button */}
              <button
                ref={calendarButtonRef}
                type="button"
                onClick={() => setIsYearPickerOpen(prev => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                  isYearPickerOpen
                    ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-500/30'
                    : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30 hover:scale-[1.02] active:scale-[0.98]'
                }`}
                title="Clicca per cambiare l'anno di riferimento (1° Anno, 2° Anno...)"
                aria-label="Cambia anno di riferimento 730"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-mono">{selectedYearData.year}</span>
                <svg className={`w-3 h-3 shrink-0 transition-transform duration-200 ${isYearPickerOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Next Year Button */}
              <button
                type="button"
                onClick={() => {
                  const next = effectiveSelectedYear + 1;
                  if (next <= endYear) setSelectedKpiYear(next);
                }}
                disabled={effectiveSelectedYear >= endYear}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                title="Anno successivo"
                aria-label="Anno successivo"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <p className="text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
            {fmt(selectedYearData.total)} <span className="text-xs font-bold text-slate-400">/ anno</span>
          </p>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold" title={`Rata annua per ${owner1Name}`}>
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> {owner1Initial}: {fmt(selectedYearData.gAmount)}
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-400 font-semibold" title={`Rata annua per ${owner2Name}`}>
              <span className="w-2 h-2 rounded-full bg-pink-500"></span> {owner2Initial}: {fmt(selectedYearData.cAmount)}
            </span>
          </div>

          {/* Subtitle / Context tag */}
          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px] flex items-center justify-between">
            {selectedYearData.oneTimeDeductions > 0 && selectedYearData.recurringDeductions > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 truncate" title={`Include 1ª quota decennale (${fmt(selectedYearData.recurringDeductions)}) e detrazioni uniche 19% (${fmt(selectedYearData.oneTimeDeductions)})`}>
                <span>⚡</span> Decennale ({fmt(selectedYearData.recurringDeductions)}) + {fmt(selectedYearData.oneTimeDeductions)} uniche 19%
              </span>
            ) : selectedYearData.oneTimeDeductions > 0 && selectedYearData.recurringDeductions === 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 truncate" title={`Solo detrazioni uniche 19% per ${fmt(selectedYearData.oneTimeDeductions)}`}>
                <span>⚡</span> Solo detrazioni uniche 19% (nessuna quota decennale)
              </span>
            ) : selectedYearData.recurringDeductions > 0 ? (
              <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 truncate" title={`Quota a regime decennale costante per l'anno ${selectedYearData.year}`}>
                <span>🔄</span> Quota regime decennale ({selectedYearData.relativeYear}/10)
              </span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1 truncate">
                <span>✓</span> Nessuna rata attiva per il {selectedYearData.year}
              </span>
            )}
          </div>

          {/* Floating Year Selector Popover */}
          {isYearPickerOpen && (
            <div
              ref={yearPickerRef}
              className="absolute top-14 right-0 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-3 space-y-2.5 animate-fade-in"
              style={{ maxHeight: '420px', overflowY: 'auto' }}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>📅</span> Anno di Riferimento 730
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Sgravio fiscale effettivo per ciascuna annualità
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsYearPickerOpen(false)}
                  className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Quick Jump Buttons */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedKpiYear(startYear);
                    setIsYearPickerOpen(false);
                  }}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border text-center transition-all cursor-pointer truncate ${
                    effectiveSelectedYear === startYear
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-750'
                  }`}
                  title={`1° Anno (${startYear})`}
                >
                  1° Anno ({startYear})
                </button>
                {endYear > startYear && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedKpiYear(startYear + 1);
                      setIsYearPickerOpen(false);
                    }}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border text-center transition-all cursor-pointer truncate ${
                      effectiveSelectedYear === startYear + 1
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-750'
                    }`}
                    title={`2° Anno a Regime (${startYear + 1})`}
                  >
                    2° Anno ({startYear + 1})
                  </button>
                )}
                {endYear > startYear + 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedKpiYear(endYear);
                      setIsYearPickerOpen(false);
                    }}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border text-center transition-all cursor-pointer truncate ${
                      effectiveSelectedYear === endYear
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-750'
                    }`}
                    title={`Ultimo Anno Decennale (${endYear})`}
                  >
                    10° Anno ({endYear})
                  </button>
                )}
              </div>

              {/* List of Years */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {kpiTimeline.map(item => {
                  const isSelected = item.year === effectiveSelectedYear;
                  return (
                    <button
                      key={item.year}
                      type="button"
                      onClick={() => {
                        setSelectedKpiYear(item.year);
                        setIsYearPickerOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white ring-1 ring-amber-500/30 font-medium'
                          : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-50/50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                            isSelected
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {item.relativeYear}°
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black">{item.year}</span>
                            {item.hasOneTime && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                                +19% uniche
                              </span>
                            )}
                            {item.relativeYear >= 2 && !item.hasOneTime && item.total > 0 && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                                regime
                              </span>
                            )}
                            {item.total === 0 && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                                concluso
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            G: {fmt(item.gAmount)} • C: {fmt(item.cAmount)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-xs font-black block font-mono ${isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                          {fmt(item.total)}
                        </span>
                        <span className="text-[9px] text-slate-400">/ anno</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Informative Note */}
              <div className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/40 text-[10px] text-amber-800 dark:text-amber-300 leading-tight">
                💡 <strong>1° Anno:</strong> include la 1ª quota decennale + 100% detrazioni 19% una tantum (notaio mutuo, agenzia). Negli <strong>anni 2-10</strong> restano le quote costanti dei bonus decennali.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="rounded-2xl p-4 shadow-sm space-y-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="md:col-span-1 relative">
            <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cerca fornitore, n. fattura, CRO..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white"
            />
          </div>

          {/* Property Filter */}
          <div>
            <select
              value={filterProperty}
              onChange={e => setFilterProperty(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white font-medium cursor-pointer"
            >
              <option value="ALL">Tutti gli Immobili</option>
              {Object.entries(propertyDirectory).map(([id, prop]) => (
                <option key={id} value={id}>
                  {prop.name} {prop.city ? `(${prop.city})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Fiscal Year Filter */}
          <div>
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white font-medium cursor-pointer"
            >
              <option value="ALL">Tutti gli Anni Fiscali</option>
              {availableYears.map(y => (
                <option key={y} value={y.toString()}>
                  Anno Fiscale {y} (730/{y + 1})
                </option>
              ))}
            </select>
          </div>

          {/* Beneficiary Filter */}
          <div>
            <select
              value={filterBeneficiary}
              onChange={e => setFilterBeneficiary(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white font-medium cursor-pointer"
            >
              <option value="ALL">Tutti i Contribuenti</option>
              <option value={owner1Name}>{owner1Name} (100%)</option>
              <option value={owner2Name}>{owner2Name} (100%)</option>
              <option value="50/50">Cointestato 50/50</option>
              <option value="CUSTOM">Quota Personalizzata</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white font-medium cursor-pointer"
            >
              <option value="ALL">Tutte le Detrazioni</option>
              <option value="BONUS_50">Ristrutturazione 50%</option>
              <option value="BONUS_36">Ristrutturazione 36%</option>
              <option value="BONUS_SPLIT">Aliquote Differenziate ({owner1Initial} & {owner2Initial})</option>
              <option value="ECOBONUS_65">Ecobonus 65%</option>
              <option value="BONUS_MOBILI">Bonus Mobili 50%</option>
              <option value="AGENZIA_19">Intermediazione 19%</option>
              <option value="NOTAIO_MUTUO">Notaio Mutuo 19%</option>
              <option value="NONE">Nessuna Detrazione</option>
            </select>
          </div>
        </div>

        {/* Quick Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-slate-500 dark:text-slate-400 scrollbar-hide">
          <span className="font-semibold shrink-0 text-slate-700 dark:text-slate-300">Filtri rapidi:</span>
          <button
            onClick={() => setFilterCategory('ALL')}
            className={`px-2.5 py-1 rounded-lg border transition ${
              filterCategory === 'ALL'
                ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Tutto
          </button>
          <button
            onClick={() => setFilterCategory('BONUS_50')}
            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:opacity-80 transition"
          >
            🛠️ Ristrutturazione 50%
          </button>
          <button
            onClick={() => setFilterCategory('ECOBONUS_65')}
            className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:opacity-80 transition"
          >
            🌿 Ecobonus 65%
          </button>
          <button
            onClick={() => setFilterCategory('BONUS_MOBILI')}
            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:opacity-80 transition"
          >
            🛋️ Bonus Mobili 50%
          </button>
          <button
            onClick={() => setFilterOnlyMissing(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg border transition flex items-center gap-1 ${
              filterOnlyMissing
                ? 'bg-amber-500 text-white dark:bg-amber-600 border-amber-600'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:opacity-80'
            }`}
          >
            <span>⚠️</span>
            <span>{filterOnlyMissing ? 'Filtro Mancanti ATTIVO' : 'Solo con allegati mancanti'}</span>
          </button>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterProperty('ALL');
              setFilterYear('ALL');
              setFilterBeneficiary('ALL');
              setFilterCategory('ALL');
              setFilterOnlyMissing(false);
            }}
            className="ml-auto text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline shrink-0"
          >
            Azzera filtri
          </button>
        </div>
      </div>

      {/* Invoices Table View */}
      <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Registro Pagamenti & Fatture per 730</h3>
            <p className="text-xs text-slate-400">Principio di cassa: l'anno fiscale segue la data di esecuzione del bonifico</p>
          </div>
          <div className="text-xs text-slate-500">
            Visualizzate: <strong className="text-slate-900 dark:text-white font-bold">{filteredInvoices.length}</strong> fatture
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <th className="py-3.5 px-4">Data Pag. (Cassa)</th>
                <th className="py-3.5 px-4">Immobile</th>
                <th className="py-3.5 px-4">Fornitore / N. Fattura</th>
                <th className="py-3.5 px-4">Categoria Detrazione</th>
                <th className="py-3.5 px-4">Intestatario</th>
                <th className="py-3.5 px-4">Metodo Pagamento</th>
                <th className="py-3.5 px-4 text-right">Importo Fattura</th>
                <th className="py-3.5 px-4 text-right">Rata 730</th>
                <th className="py-3.5 px-4 text-center">Allegati (PDF/IMG)</th>
                <th className="py-3.5 px-4 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredInvoices.map(inv => {
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
                const prop = propertyDirectory[inv.propertyId] || { name: 'Immobile', city: '' };

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition group">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-white">{inv.paymentDate}</div>
                      <div className="text-[10px] text-slate-400">
                        Anno: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{inv.fiscalYear}</strong>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{prop.name}</div>
                      <div className="text-[10px] text-slate-400">{prop.city}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{inv.supplier}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{inv.invoiceNumber}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-xs">{inv.description}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{renderCategoryBadge(inv)}</td>
                    <td className="py-3 px-4 whitespace-nowrap">{renderBeneficiaryBadge(inv)}</td>
                    <td className="py-3 px-4">{renderPaymentBadge(inv.paymentMethod, inv.croCode)}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white">
                      {fmt(inv.amount)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-amber-600 dark:text-amber-400">
                      {fmt(calc.yearlyQuota)}
                      <div className="text-[9px] text-slate-400 font-sans">
                        {calc.installmentCount === 0 ? 'nessuna detrazione' : calc.installmentCount === 1 ? 'quota unica 730' : '1 di 10 quote'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {inv.invoiceAttachment ? (
                          <button
                            onClick={() => previewDocument(inv, 'invoice')}
                            title={`Visualizza Fattura: ${inv.invoiceAttachment.name}`}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100 transition flex items-center gap-1 cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-[10px] font-bold">FAT</span>
                          </button>
                        ) : (
                          <span className="p-1 rounded text-[10px] bg-red-50 text-red-500 dark:bg-red-950/50" title="Manca documento fattura">
                            No FAT
                          </span>
                        )}

                        {inv.receiptAttachment ? (
                          <button
                            onClick={() => previewDocument(inv, 'receipt')}
                            title={`Visualizza Bonifico: ${inv.receiptAttachment.name}`}
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 hover:bg-blue-100 transition flex items-center gap-1 cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-[10px] font-bold">BON</span>
                          </button>
                        ) : (
                          <span className="p-1 rounded text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-950/50" title="Manca contabile bonifico">
                            No BON
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleEditInvoice(inv)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Modifica"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteInvoice(inv.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                          title="Elimina"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredInvoices.length === 0 && (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">
              Nessuna fattura corrispondente ai filtri selezionati
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterProperty('ALL');
                setFilterYear('ALL');
                setFilterBeneficiary('ALL');
                setFilterCategory('ALL');
                setFilterOnlyMissing(false);
              }}
              className="text-xs text-emerald-600 hover:underline font-semibold cursor-pointer"
            >
              Reimposta filtri
            </button>
          </div>
        )}
      </div>

      {/* Tax Rules Reference Drawer / Accordion */}
      <div className="rounded-2xl p-5 shadow-sm space-y-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setIsGuideOpen(prev => !prev)}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">📚</span>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
              Promemoria Requisiti Fisco per le Detrazioni Edilizie (Agenzia delle Entrate)
            </h4>
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transform transition-transform duration-200 ${isGuideOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {isGuideOpen && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-400">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
              <strong className="text-slate-900 dark:text-white flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Bonifico Dedicato ("Parlante")
              </strong>
              <p>
                Obbligatorio per Bonus Casa ed Ecobonus. Deve riportare: Causale normativa (art. 16-bis TUIR per 50% o L. 296/06 per 65%), Codice Fiscale dell'ordinante ({owner1Name} o {owner2Name}), P.IVA o CF dell'impresa esecutrice dei lavori.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
              <strong className="text-slate-900 dark:text-white flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                Asseverazione & Comunicazione ENEA
              </strong>
              <p>
                Obbligatoria entro 90 giorni dalla fine lavori per Ecobonus 65% e interventi di efficienza energetica (es. infissi, climatizzatori in pompa di calore, scaldacqua a PDC). Conservare ricevuta CPID.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
              <strong className="text-slate-900 dark:text-white flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Massimali di Spesa Vigenti
              </strong>
              <p>
                Bonus Ristrutturazioni 50%: tetto 96.000€ per unità immobiliare. Bonus Mobili: tetto 5.000€ (anno 2024). Spese agenzia immobiliare prima casa: detrazione 19% max 1.000€ spesa (190€). Notaio mutuo: 19% max 4.000€ spesa (760€).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Inserimento / Modifica Fattura */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📄</span>
                  <span>{currentEditingId ? `Modifica Fattura: ${formInvoiceNumber}` : 'Nuova Fattura & Detrazione Fiscale'}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Compila tutti i dettagli per l'archiviazione e il calcolo della detrazione per il 730
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              {/* Immobile */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Immobile / Cantiere di Riferimento *
                </label>
                <select
                  value={formPropertyId}
                  onChange={e => setFormPropertyId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium cursor-pointer"
                >
                  {Object.entries(propertyDirectory).map(([id, prop]) => (
                    <option key={id} value={id}>
                      {prop.name} {prop.city ? `(${prop.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Numero & Fornitore */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Numero Fattura / Parcella *
                  </label>
                  <input
                    type="text"
                    value={formInvoiceNumber}
                    onChange={e => setFormInvoiceNumber(e.target.value)}
                    required
                    placeholder="es. FAT-2024/098"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fornitore / Ragione Sociale *
                  </label>
                  <input
                    type="text"
                    value={formSupplier}
                    onChange={e => setFormSupplier(e.target.value)}
                    required
                    placeholder="es. EdilMilano Srl"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Date & Anno Fiscale */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Data Documento
                  </label>
                  <input
                    type="date"
                    value={formInvoiceDate}
                    onChange={e => setFormInvoiceDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                    Data Pagamento (Cassa) *
                  </label>
                  <input
                    type="date"
                    value={formPaymentDate}
                    onChange={e => {
                      setFormPaymentDate(e.target.value);
                      if (e.target.value) {
                        setFormFiscalYear(new Date(e.target.value).getFullYear());
                      }
                    }}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Anno Fiscale (730)
                  </label>
                  <input
                    type="number"
                    value={formFiscalYear}
                    readOnly
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 font-mono font-bold cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Descrizione */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descrizione Lavori / Fornitura
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="es. Rifacimento bagno, impianto idraulico a norma e posa rivestimenti"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Categoria & Beneficiario */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo Detrazione Fiscale *
                  </label>
                  <select
                    value={formTaxCategory}
                    onChange={e => setFormTaxCategory(e.target.value as TaxCategory)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold cursor-pointer"
                  >
                    <option value="BONUS_50">Bonus Casa / Ristrutturazione (50% - Prima Casa)</option>
                    <option value="BONUS_36">Bonus Casa / Ristrutturazione (36% - Seconda Casa)</option>
                    <option value="BONUS_SPLIT">🛠️ Aliquote Differenziate (es. 50% Prima Casa {owner1Initial} / 36% Seconda Casa {owner2Initial})</option>
                    <option value="ECOBONUS_65">Ecobonus Risparmio Energetico (65% in 10 rate)</option>
                    <option value="BONUS_MOBILI">Bonus Mobili & Elettrodomestici (50% in 10 rate, max 5.000€)</option>
                    <option value="AGENZIA_19">Intermediazione Agenzia (19% max 1.000€ spesa)</option>
                    <option value="NOTAIO_MUTUO">Parcella Notaio Mutuo (19% max 4.000€ spesa)</option>
                    <option value="NONE">Nessuna Detrazione (Spesa Ordinaria 0%)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Intestatario / Beneficiario Fiscale *
                  </label>
                  <select
                    value={formBeneficiary}
                    onChange={e => setFormBeneficiary(e.target.value as InvoiceBeneficiary)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold cursor-pointer"
                  >
                    <option value={owner1Name}>{owner1Name} (100%)</option>
                    <option value={owner2Name}>{owner2Name} (100%)</option>
                    <option value="50/50">Cointestato 50% {owner1Name} - 50% {owner2Name}</option>
                    <option value="CUSTOM">Percentuale Spesa Personalizzata ({owner1Initial} / {owner2Initial})</option>
                  </select>
                </div>
              </div>

              {/* Differentiated Rates Section */}
              {formTaxCategory === 'BONUS_SPLIT' && (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <span>🏛️</span> Aliquota Detrazione Fiscale Differenziata per Contribuente
                    </span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                      es. Prima Casa (50%) per {owner1Initial} e Seconda Casa (36%) per {owner2Initial}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-blue-700 dark:text-blue-400 mb-1">
                        Aliquota Fiscale {owner1Name}
                      </label>
                      <select
                        value={formRateGiuseppe}
                        onChange={e => setFormRateGiuseppe(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-xs font-bold text-blue-700 dark:text-blue-300 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                      >
                        <option value="50">50% (Prima Casa)</option>
                        <option value="36">36% (Seconda Casa)</option>
                        <option value="65">65% (Ecobonus)</option>
                        <option value="19">19% (Oneri 19%)</option>
                        <option value="0">0% (Nessuna detrazione)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-pink-700 dark:text-pink-400 mb-1">
                        Aliquota Fiscale {owner2Name}
                      </label>
                      <select
                        value={formRateClaudia}
                        onChange={e => setFormRateClaudia(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-pink-300 dark:border-pink-700 bg-white dark:bg-slate-900 text-xs font-bold text-pink-700 dark:text-pink-300 focus:ring-2 focus:ring-pink-500 focus:outline-none cursor-pointer"
                      >
                        <option value="36">36% (Seconda Casa)</option>
                        <option value="50">50% (Prima Casa)</option>
                        <option value="65">65% (Ecobonus)</option>
                        <option value="19">19% (Oneri 19%)</option>
                        <option value="0">0% (Nessuna detrazione)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Split Section */}
              {formBeneficiary === 'CUSTOM' && (
                <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-900 dark:text-purple-300">
                    <span className="flex items-center gap-1.5">
                      <span>⚖️</span> Ripartizione Personalizzata Cointestatari (Spesa & Detrazione 730)
                    </span>
                    <span className="text-[11px] font-mono bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded text-purple-700 dark:text-purple-300 font-bold">
                      Totale: {formSplitGiuseppe + formSplitClaudia}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-blue-700 dark:text-blue-400 mb-1">
                        Quota {owner1Name} (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formSplitGiuseppe}
                          onChange={e => {
                            const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                            setFormSplitGiuseppe(val);
                            setFormSplitClaudia(100 - val);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold text-blue-600 dark:text-blue-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-pink-700 dark:text-pink-400 mb-1">
                        Quota {owner2Name} (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formSplitClaudia}
                          onChange={e => {
                            const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                            setFormSplitClaudia(val);
                            setFormSplitGiuseppe(100 - val);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-pink-300 dark:border-pink-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold text-pink-600 dark:text-pink-400 focus:ring-2 focus:ring-pink-500 focus:outline-none"
                        />
                        <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Metodo Pagamento & CRO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Metodo Pagamento *
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={e => setFormPaymentMethod(e.target.value as InvoicePaymentMethod)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold cursor-pointer"
                  >
                    <option value="BONIFICO_PARLANTE">Bonifico Parlante Detrazione (L. 449/97 o L. 296/06)</option>
                    <option value="BONIFICO_ORDINARIO">Bonifico Bancario Ordinario</option>
                    <option value="CARTA_POS">Carta di Credito / Bancomat (Ammesso per Mobili)</option>
                    <option value="ASSEGNO">Assegno Bancario / Circolare</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Codice CRO / TRN Bonifico
                  </label>
                  <input
                    type="text"
                    value={formCroCode}
                    onChange={e => setFormCroCode(e.target.value)}
                    placeholder="es. TRN 030029381029381"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Importo & Calcolo Dinamico */}
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Importo Totale Fattura (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formAmount}
                    onChange={e => setFormAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-purple-700 dark:text-purple-300 mb-1">
                    Detrazione Spettante Totale
                  </label>
                  <div className="font-bold text-purple-600 dark:text-purple-400 text-sm py-2">
                    {fmt(currentModalCalc.totalDeduction)}
                    {formTaxCategory === 'BONUS_SPLIT' && (
                      <span className="text-[10px] text-slate-400 block font-normal">
                        ({owner1Initial}: {fmt(currentModalCalc.gTotal)} al {formRateGiuseppe}% | {owner2Initial}: {fmt(currentModalCalc.cTotal)} al {formRateClaudia}%)
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-amber-700 dark:text-amber-300 mb-1">
                    Rata 730
                  </label>
                  <div className="font-black text-amber-600 dark:text-amber-400 text-base py-1.5">
                    {currentModalCalc.installmentCount === 1
                      ? `${fmt(currentModalCalc.yearlyQuota)} (Rata unica)`
                      : `${fmt(currentModalCalc.yearlyQuota)} / anno`}
                    {formTaxCategory === 'BONUS_SPLIT' && (
                      <span className="text-[10px] text-amber-500/90 block font-normal">
                        ({owner1Initial}: {fmt(currentModalCalc.gYearly)}/a | {owner2Initial}: {fmt(currentModalCalc.cYearly)}/a)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Uploads (Fattura & Bonifico) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Fattura File */}
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-center hover:border-emerald-500 transition cursor-pointer relative bg-slate-50/50 dark:bg-slate-800/30">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.xml"
                    onChange={e => handleFileUpload(e, 'invoice')}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="space-y-1">
                    <svg className="w-6 h-6 mx-auto text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="font-bold text-slate-700 dark:text-slate-300 pointer-events-none">Allega Fattura (PDF/IMG)</p>
                    <p className="text-[11px] text-slate-400 truncate max-w-full pointer-events-none">
                      {formInvoiceFile ? formInvoiceFile.name : 'Nessun file selezionato'}
                    </p>
                    {formInvoiceFile && (
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <span className="text-[10px] text-emerald-500 font-semibold pointer-events-none">Caricato</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setFormInvoiceFile(null); }}
                          className="text-[10px] text-rose-500 hover:text-rose-700 font-bold underline cursor-pointer relative z-10"
                        >
                          Rimuovi
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ricevuta Bonifico File */}
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-center hover:border-emerald-500 transition cursor-pointer relative bg-slate-50/50 dark:bg-slate-800/30">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={e => handleFileUpload(e, 'receipt')}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="space-y-1">
                    <svg className="w-6 h-6 mx-auto text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="font-bold text-slate-700 dark:text-slate-300 pointer-events-none">Allega Ricevuta Bonifico Parlante</p>
                    <p className="text-[11px] text-slate-400 truncate max-w-full pointer-events-none">
                      {formReceiptFile ? formReceiptFile.name : 'Nessun file selezionato'}
                    </p>
                    {formReceiptFile && (
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <span className="text-[10px] text-emerald-500 font-semibold pointer-events-none">Caricato</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setFormReceiptFile(null); }}
                          className="text-[10px] text-rose-500 hover:text-rose-700 font-bold underline cursor-pointer relative z-10"
                        >
                          Rimuovi
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                >
                  Salva nell'Archivio Fiscale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Anteprima Documento Fiscale */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-sm">
                  DOC
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {previewDoc.attachment.name}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {(propertyDirectory[previewDoc.invoice.propertyId]?.name || 'Immobile')} • {previewDoc.invoice.supplier} • {fmt(previewDoc.invoice.amount)} • Pagato il {previewDoc.invoice.paymentDate}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadCurrentPreviewFile}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Scarica Documento
                </button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Document Body */}
            <div className="p-6 overflow-y-auto bg-slate-100 dark:bg-slate-950/80 flex-1 flex flex-col items-center justify-center min-h-[350px]">
              {previewDoc.attachment.data && (previewDoc.attachment.data.startsWith('data:image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(previewDoc.attachment.name || '')) ? (
                <div className="flex flex-col items-center justify-center p-4">
                  <img
                    src={previewDoc.attachment.data}
                    alt={previewDoc.attachment.name}
                    className="max-h-[60vh] max-w-full rounded-xl shadow-lg border border-slate-300 dark:border-slate-700 object-contain"
                  />
                  <p className="text-xs text-slate-400 mt-2 font-mono">
                    {previewDoc.attachment.name} ({previewDoc.attachment.type || 'immagine'})
                  </p>
                </div>
              ) : previewDoc.attachment.data && (previewDoc.attachment.data.startsWith('data:application/pdf') || (previewDoc.attachment.name || '').toLowerCase().endsWith('.pdf')) ? (
                <iframe
                  src={previewDoc.attachment.data}
                  title={previewDoc.attachment.name}
                  className="w-full h-[65vh] rounded-xl border border-slate-300 dark:border-slate-700"
                />
              ) : (
                /* High-fidelity tax receipt mockup matching prototype */
                <div className="w-full max-w-xl bg-white text-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 space-y-6 font-mono text-xs">
                  <div className="flex justify-between border-b pb-4">
                    <div>
                      <p className="font-bold text-base">
                        {previewDoc.type === 'receipt'
                          ? 'ISTITUTO BANCARIO ORDINANTE'
                          : previewDoc.invoice.supplier.toUpperCase()}
                      </p>
                      <p className="text-slate-500">
                        {previewDoc.type === 'receipt'
                          ? 'Filiale Digitale - Servizi Dispositivi Bonifici'
                          : 'P.IVA 08928371092 - REA MI-491029'}
                      </p>
                      <p className="text-slate-500">
                        {propertyDirectory[previewDoc.invoice.propertyId]?.name} - {propertyDirectory[previewDoc.invoice.propertyId]?.city}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-2 py-1 rounded font-bold text-[11px] ${
                          previewDoc.type === 'receipt'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {previewDoc.type === 'receipt' ? 'RICEVUTA BONIFICO PARLANTE' : 'FATTURA ELETTRONICA SDI'}
                      </span>
                      <p className="mt-2 font-bold">
                        {previewDoc.type === 'receipt' ? 'CRO / TRN' : 'Fattura N.'}{' '}
                        {previewDoc.type === 'receipt'
                          ? previewDoc.invoice.croCode || 'TRN-293810293'
                          : previewDoc.invoice.invoiceNumber}
                      </p>
                      <p className="text-slate-500">
                        Data: {previewDoc.type === 'receipt' ? previewDoc.invoice.paymentDate : previewDoc.invoice.invoiceDate}
                      </p>
                    </div>
                  </div>

                  <div className="border-b pb-4 space-y-1">
                    <p className="font-bold text-slate-600">ORDINANTE / BENEFICIARIO DETRAZIONE FISCALE:</p>
                    <p className="font-bold text-sm text-slate-900">
                      {previewDoc.invoice.beneficiary === '50/50'
                        ? `${owner1Name} & ${owner2Name} (50/50)`
                        : isOwner1(previewDoc.invoice.beneficiary)
                        ? `${owner1Name} (100% Sgravio IRPEF)`
                        : isOwner2(previewDoc.invoice.beneficiary)
                        ? `${owner2Name} (100% Sgravio IRPEF)`
                        : `Personalizzato (${previewDoc.invoice.splitGiuseppePercent ?? 50}% ${owner1Initial} / ${previewDoc.invoice.splitClaudiaPercent ?? 50}% ${owner2Initial})`}
                    </p>
                    <p className="text-slate-500">
                      Codice Fiscale Committente:{' '}
                      {isOwner2(previewDoc.invoice.beneficiary) ? 'BNCCLD88M41F205K' : 'RSSGPP85M01F205Z'}
                    </p>
                    <p className="text-slate-500">
                      Destinazione: {propertyDirectory[previewDoc.invoice.propertyId]?.name} ({propertyDirectory[previewDoc.invoice.propertyId]?.city})
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="font-bold text-slate-700">CAUSALE / DESCRIZIONE NORMATIVA:</p>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 leading-relaxed">
                      {previewDoc.invoice.description}
                      <br />
                      <span className="text-emerald-700 font-bold mt-1 inline-block">
                        Ammesso a: {previewDoc.invoice.taxCategory} (Aliquota Detrazione: {previewDoc.invoice.rate}% - Anno Fiscale {previewDoc.invoice.fiscalYear})
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-1">
                    <div className="flex justify-between font-bold text-sm">
                      <span>IMPORTO TOTALE REGISTRATO:</span>
                      <span className="text-emerald-700 text-base font-bold">{fmt(previewDoc.invoice.amount)}</span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Modalità: {previewDoc.invoice.paymentMethod} - Bonifico verificato conforme per CAF / Modello 730.
                    </p>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="font-bold flex items-center gap-1">
                        <span>✓</span> Certificato di Archiviazione Fiscale ImmoPlan
                      </p>
                      <p className="text-[10px]">Documento allegato: {previewDoc.attachment.name}</p>
                    </div>
                    <span className="font-bold text-emerald-700 font-mono">OK-730</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500">
              <span>
                Stato Archiviazione: <strong className="text-emerald-500">Conforme Fascicolo 730</strong>
              </span>
              <span>
                ID Voce: <code className="font-mono text-slate-400">{previewDoc.invoice.id}</code>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Backup & Ripristino Modal */}
      {isBackupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
                  💾
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    Backup & Ripristino Parametri 730
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Esporta o importa l'archivio fatture, bonifici parlanti, quote e parametri di detrazione
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsBackupModalOpen(false);
                  resetImportSelection();
                }}
                className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Tab Switcher */}
            <div className="px-6 pt-4 pb-0 bg-white dark:bg-slate-900">
              <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 max-w-md">
                <button
                  type="button"
                  onClick={() => setBackupModalTab('EXPORT')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    backupModalTab === 'EXPORT'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Esporta Backup JSON
                </button>
                <button
                  type="button"
                  onClick={() => setBackupModalTab('IMPORT')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    backupModalTab === 'IMPORT'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Importa / Ripristina JSON
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {backupModalTab === 'EXPORT' ? (
                /* EXPORT VIEW */
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                    <div className="font-bold flex items-center gap-2 mb-1 text-sm text-blue-950 dark:text-blue-300">
                      <span>📦</span> Contenuto del Pacchetto di Backup
                    </div>
                    Il file JSON generato contiene il salvataggio integrale di:
                    <ul className="list-disc pl-5 mt-1.5 space-y-0.5 text-blue-800/90 dark:text-slate-300">
                      <li>Tutte le fatture, note fornitore e date di pagamento (principio di cassa)</li>
                      <li>Parametri di aliquota e detrazione fiscale (50% Prima Casa, 36% Seconda Casa, Ecobonus 65%, Notaio 19%, ecc.)</li>
                      <li>Ripartizione delle quote tra Giuseppe e Claudia (50/50, 100% o percentuali personalizzate)</li>
                      <li>Codici CRO / TRN dei bonifici parlanti per CAF e Modello 730</li>
                      <li>Tutti i documenti allegati (fatture e ricevute) codificati in base64</li>
                    </ul>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fatture</span>
                      <p className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{invoices.length}</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Spesa Totale</span>
                      <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{fmt(kpis.totalExpenses)}</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Credito Fiscale</span>
                      <p className="text-base font-black text-purple-600 dark:text-purple-400 mt-0.5">{fmt(kpis.totalDeductions)}</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Allegati</span>
                      <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                        {invoices.reduce((acc, inv) => acc + (inv.invoiceAttachment?.data ? 1 : 0) + (inv.receiptAttachment?.data ? 1 : 0), 0)}
                      </p>
                    </div>
                  </div>

                  {/* Export Button */}
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={handleExportJsonBackup}
                      disabled={invoices.length === 0}
                      className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Scarica Backup JSON Completo ({invoices.length} Voci)
                    </button>
                    {invoices.length === 0 && (
                      <p className="text-center text-xs text-amber-500 mt-2">
                        Nessuna fattura presente in archivio da esportare.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                /* IMPORT VIEW */
                <div className="space-y-4">
                  <input
                    type="file"
                    ref={importFileInputRef}
                    accept=".json,application/json"
                    onChange={handleImportFileInputChange}
                    className="hidden"
                  />

                  {!importPendingInvoices ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingFile(true);
                      }}
                      onDragLeave={() => setIsDraggingFile(false)}
                      onDrop={handleDropFile}
                      onClick={() => importFileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                        isDraggingFile
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                          : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          Trascina qui il file JSON di backup o <span className="text-emerald-600 dark:text-emerald-400 underline">sfoglia dal computer</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          Supporta backup dedicato Fatture 730, backup globale ImmoPlan o elenchi JSON
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* File Preview and Options */
                    <div className="space-y-4">
                      {/* Detected File Badge */}
                      <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white">
                              FILE VALIDO
                            </span>
                            <span className="font-mono text-xs font-bold text-emerald-900 dark:text-emerald-200">
                              {importMeta?.filename}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-emerald-800/90 dark:text-slate-300 pt-1">
                            <div>
                              <strong>Fatture rilevate:</strong> {importMeta?.count}
                            </div>
                            <div>
                              <strong>Spesa totale:</strong> {fmt(importMeta?.totalAmount || 0)}
                            </div>
                            <div>
                              <strong>Allegati inclusi:</strong> {importMeta?.attachmentsCount}
                            </div>
                            {importMeta?.years && importMeta.years.length > 0 && (
                              <div>
                                <strong>Anni fiscali:</strong> {importMeta.years.join(', ')}
                              </div>
                            )}
                            {importMeta?.exportDate && (
                              <div className="sm:col-span-2 truncate">
                                <strong>Data export:</strong> {new Date(importMeta.exportDate).toLocaleString('it-IT')}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={resetImportSelection}
                          className="text-xs text-rose-500 hover:text-rose-700 font-bold underline shrink-0 cursor-pointer"
                        >
                          Cambia file
                        </button>
                      </div>

                      {/* Mode Selection */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Modalità di Ripristino nel Database
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label
                            className={`p-3.5 rounded-2xl border cursor-pointer transition block ${
                              importMode === 'MERGE'
                                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="importMode"
                                value="MERGE"
                                checked={importMode === 'MERGE'}
                                onChange={() => setImportMode('MERGE')}
                                className="text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                🔄 Unisci & Aggiorna (Consigliato)
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-5 leading-relaxed">
                              Aggiunge le nuove voci e aggiorna quelle con lo stesso ID. I dati correnti non presenti nel file restano intatti.
                            </p>
                          </label>

                          <label
                            className={`p-3.5 rounded-2xl border cursor-pointer transition block ${
                              importMode === 'OVERWRITE'
                                ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="importMode"
                                value="OVERWRITE"
                                checked={importMode === 'OVERWRITE'}
                                onChange={() => setImportMode('OVERWRITE')}
                                className="text-amber-600 focus:ring-amber-500"
                              />
                              <span className="font-bold text-xs text-amber-900 dark:text-amber-300">
                                ⚠️ Sovrascrivi Intero Archivio
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-5 leading-relaxed">
                              Cancella tutte le {invoices.length} voci attuali e le sostituisce integralmente con le {importPendingInvoices.length} voci del file.
                            </p>
                          </label>
                        </div>
                      </div>

                      {/* Execution Button */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={executeImport}
                          disabled={isImportProcessing}
                          className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm text-white shadow-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                            importMode === 'OVERWRITE'
                              ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                              : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                          } disabled:opacity-50`}
                        >
                          {isImportProcessing ? (
                            <span>Importazione in corso nel database...</span>
                          ) : (
                            <>
                              <span>{importMode === 'OVERWRITE' ? '⚠️' : '✓'}</span>
                              <span>
                                {importMode === 'OVERWRITE'
                                  ? `Sovrascrivi con ${importPendingInvoices.length} Fatture`
                                  : `Ripristina ed Unisci ${importPendingInvoices.length} Fatture`}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Error Notification */}
                  {importError && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                      <span className="text-base">⚠️</span>
                      <span>{importError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Archivio IndexedDB + Storage Centralizzato
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsBackupModalOpen(false);
                  resetImportSelection();
                }}
                className="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.visible && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold border border-slate-700 dark:border-slate-200">
            <span className="text-sm">{toast.icon}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};
