import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InvoiceRecord, TaxCategory, InvoiceBeneficiary, InvoicePaymentMethod, Property, Attachment, Scenario } from '../types';
import { db } from '../services/dbService';
import { computeDeduction } from '../services/taxDeductionService';
import {
  InvoiceTaxArchiveProps,
  YearDeductionSchedule,
  DEFAULT_PROPERTIES_MAP
} from './invoices/types';
import { InvoiceKpiCards } from './invoices/InvoiceKpiCards';
import { InvoiceFilterToolbar } from './invoices/InvoiceFilterToolbar';
import { InvoiceTable } from './invoices/InvoiceTable';
import { TaxRulesReferenceAccordion } from './invoices/TaxRulesReferenceAccordion';
import { InvoiceFormModal } from './invoices/InvoiceFormModal';
import { InvoiceDocumentPreviewModal } from './invoices/InvoiceDocumentPreviewModal';
import { InvoiceBackupRestoreModal } from './invoices/InvoiceBackupRestoreModal';

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
      } else {
        setInvoices([]);
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

  // Merged Properties Directory Map
  const propertyDirectory = useMemo(() => {
    const dir: Record<string, { name: string; city: string }> = {};

    properties.forEach(p => {
      dir[p.id] = { name: p.name, city: p.address || 'Italia' };
    });

    scenarios.forEach(s => {
      if (!dir[s.id]) {
        dir[s.id] = { name: s.name, city: s.data.propertyName || 'Progetto' };
      }
    });

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

    const ratioPercent = totalExpenses > 0 ? parseFloat(((deductibleBase / totalExpenses) * 100).toFixed(1)) : 0;

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
            type="button"
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
            type="button"
            onClick={exportToExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950/40 transition shadow-sm cursor-pointer"
          >
            <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Esporta Fascicolo Excel 730
          </button>
          <button
            type="button"
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
      <InvoiceKpiCards
        kpis={kpis}
        selectedYearData={selectedYearData}
        effectiveSelectedYear={effectiveSelectedYear}
        startYear={startYear}
        endYear={endYear}
        setSelectedKpiYear={setSelectedKpiYear}
        isYearPickerOpen={isYearPickerOpen}
        setIsYearPickerOpen={setIsYearPickerOpen}
        calendarButtonRef={calendarButtonRef}
        yearPickerRef={yearPickerRef}
        kpiTimeline={kpiTimeline}
        owner1Name={owner1Name}
        owner2Name={owner2Name}
        owner1Initial={owner1Initial}
        owner2Initial={owner2Initial}
        fmt={fmt}
      />

      {/* Filter & Search Toolbar */}
      <InvoiceFilterToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterProperty={filterProperty}
        setFilterProperty={setFilterProperty}
        filterYear={filterYear}
        setFilterYear={setFilterYear}
        filterBeneficiary={filterBeneficiary}
        setFilterBeneficiary={setFilterBeneficiary}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        filterOnlyMissing={filterOnlyMissing}
        setFilterOnlyMissing={setFilterOnlyMissing}
        propertyDirectory={propertyDirectory}
        availableYears={availableYears}
        owner1Name={owner1Name}
        owner2Name={owner2Name}
        owner1Initial={owner1Initial}
        owner2Initial={owner2Initial}
      />

      {/* Invoices Table View */}
      <InvoiceTable
        invoices={filteredInvoices}
        propertyDirectory={propertyDirectory}
        owner1Name={owner1Name}
        owner2Name={owner2Name}
        onEditInvoice={handleEditInvoice}
        onDeleteInvoice={handleDeleteInvoice}
        onPreviewDocument={previewDocument}
        onResetFilters={() => {
          setSearchQuery('');
          setFilterProperty('ALL');
          setFilterYear('ALL');
          setFilterBeneficiary('ALL');
          setFilterCategory('ALL');
          setFilterOnlyMissing(false);
        }}
        fmt={fmt}
      />

      {/* Tax Rules Reference Drawer / Accordion */}
      <TaxRulesReferenceAccordion
        isGuideOpen={isGuideOpen}
        setIsGuideOpen={setIsGuideOpen}
        owner1Name={owner1Name}
        owner2Name={owner2Name}
      />

      {/* MODAL: Inserimento / Modifica Fattura */}
      <InvoiceFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentEditingId={currentEditingId}
        formPropertyId={formPropertyId}
        setFormPropertyId={setFormPropertyId}
        propertyDirectory={propertyDirectory}
        formInvoiceNumber={formInvoiceNumber}
        setFormInvoiceNumber={setFormInvoiceNumber}
        formSupplier={formSupplier}
        setFormSupplier={setFormSupplier}
        formInvoiceDate={formInvoiceDate}
        setFormInvoiceDate={setFormInvoiceDate}
        formPaymentDate={formPaymentDate}
        setFormPaymentDate={setFormPaymentDate}
        formFiscalYear={formFiscalYear}
        setFormFiscalYear={setFormFiscalYear}
        formDescription={formDescription}
        setFormDescription={setFormDescription}
        formTaxCategory={formTaxCategory}
        setFormTaxCategory={setFormTaxCategory}
        formRateGiuseppe={formRateGiuseppe}
        setFormRateGiuseppe={setFormRateGiuseppe}
        formRateClaudia={formRateClaudia}
        setFormRateClaudia={setFormRateClaudia}
        formBeneficiary={formBeneficiary}
        setFormBeneficiary={setFormBeneficiary}
        formSplitGiuseppe={formSplitGiuseppe}
        setFormSplitGiuseppe={setFormSplitGiuseppe}
        formSplitClaudia={formSplitClaudia}
        setFormSplitClaudia={setFormSplitClaudia}
        formPaymentMethod={formPaymentMethod}
        setFormPaymentMethod={setFormPaymentMethod}
        formCroCode={formCroCode}
        setFormCroCode={setFormCroCode}
        formAmount={formAmount}
        setFormAmount={setFormAmount}
        formInvoiceFile={formInvoiceFile}
        setFormInvoiceFile={setFormInvoiceFile}
        formReceiptFile={formReceiptFile}
        setFormReceiptFile={setFormReceiptFile}
        currentModalCalc={currentModalCalc}
        handleFileUpload={handleFileUpload}
        onSubmit={handleFormSubmit}
        owner1Name={owner1Name}
        owner2Name={owner2Name}
        owner1Initial={owner1Initial}
        owner2Initial={owner2Initial}
        fmt={fmt}
      />

      {/* MODAL: Anteprima Documento Fiscale */}
      <InvoiceDocumentPreviewModal
        previewDoc={previewDoc}
        onClose={() => setPreviewDoc(null)}
        onDownload={downloadCurrentPreviewFile}
        propertyDirectory={propertyDirectory}
        owner1Name={owner1Name}
        owner2Name={owner2Name}
        owner1Initial={owner1Initial}
        owner2Initial={owner2Initial}
        fmt={fmt}
      />

      {/* Backup & Ripristino Modal */}
      <InvoiceBackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        backupModalTab={backupModalTab}
        setBackupModalTab={setBackupModalTab}
        invoices={invoices}
        kpis={{ totalExpenses: kpis.totalExpenses, totalDeductions: kpis.totalDeductions }}
        onExportJsonBackup={handleExportJsonBackup}
        importPendingInvoices={importPendingInvoices}
        importMeta={importMeta}
        importMode={importMode}
        setImportMode={setImportMode}
        importError={importError}
        isImportProcessing={isImportProcessing}
        isDraggingFile={isDraggingFile}
        setIsDraggingFile={setIsDraggingFile}
        importFileInputRef={importFileInputRef}
        handleImportFileInputChange={handleImportFileInputChange}
        handleDropFile={handleDropFile}
        executeImport={executeImport}
        resetImportSelection={resetImportSelection}
        fmt={fmt}
      />

      {/* Toast Notification */}
      {toast.visible && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs font-semibold shadow-2xl border border-slate-700 animate-slide-up">
          <span className="text-base">{toast.icon}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};
