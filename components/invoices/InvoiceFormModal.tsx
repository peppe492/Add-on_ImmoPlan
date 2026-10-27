import React from 'react';
import { TaxCategory, InvoiceBeneficiary, InvoicePaymentMethod, Attachment } from '../../types';

interface ModalCalcResult {
  totalDeduction: number;
  yearlyQuota: number;
  installmentCount: number;
  gTotal: number;
  cTotal: number;
  gYearly: number;
  cYearly: number;
}

interface InvoiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEditingId: string | null;
  formPropertyId: string;
  setFormPropertyId: (val: string) => void;
  propertyDirectory: Record<string, { name: string; city: string }>;
  formInvoiceNumber: string;
  setFormInvoiceNumber: (val: string) => void;
  formSupplier: string;
  setFormSupplier: (val: string) => void;
  formInvoiceDate: string;
  setFormInvoiceDate: (val: string) => void;
  formPaymentDate: string;
  setFormPaymentDate: (val: string) => void;
  formFiscalYear: number;
  setFormFiscalYear: (val: number) => void;
  formDescription: string;
  setFormDescription: (val: string) => void;
  formTaxCategory: TaxCategory;
  setFormTaxCategory: (val: TaxCategory) => void;
  formRateGiuseppe: number;
  setFormRateGiuseppe: (val: number) => void;
  formRateClaudia: number;
  setFormRateClaudia: (val: number) => void;
  formBeneficiary: InvoiceBeneficiary;
  setFormBeneficiary: (val: InvoiceBeneficiary) => void;
  formSplitGiuseppe: number;
  setFormSplitGiuseppe: (val: number) => void;
  formSplitClaudia: number;
  setFormSplitClaudia: (val: number) => void;
  formPaymentMethod: InvoicePaymentMethod;
  setFormPaymentMethod: (val: InvoicePaymentMethod) => void;
  formCroCode: string;
  setFormCroCode: (val: string) => void;
  formAmount: number | '';
  setFormAmount: (val: number | '') => void;
  formInvoiceFile: Attachment | null;
  setFormInvoiceFile: React.Dispatch<React.SetStateAction<Attachment | null>>;
  formReceiptFile: Attachment | null;
  setFormReceiptFile: React.Dispatch<React.SetStateAction<Attachment | null>>;
  currentModalCalc: ModalCalcResult;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'receipt') => void;
  onSubmit: (e: React.FormEvent) => void;
  owner1Name: string;
  owner2Name: string;
  owner1Initial: string;
  owner2Initial: string;
  fmt: (num: number) => string;
}

export const InvoiceFormModal: React.FC<InvoiceFormModalProps> = ({
  isOpen,
  onClose,
  currentEditingId,
  formPropertyId,
  setFormPropertyId,
  propertyDirectory,
  formInvoiceNumber,
  setFormInvoiceNumber,
  formSupplier,
  setFormSupplier,
  formInvoiceDate,
  setFormInvoiceDate,
  formPaymentDate,
  setFormPaymentDate,
  formFiscalYear,
  setFormFiscalYear,
  formDescription,
  setFormDescription,
  formTaxCategory,
  setFormTaxCategory,
  formRateGiuseppe,
  setFormRateGiuseppe,
  formRateClaudia,
  setFormRateClaudia,
  formBeneficiary,
  setFormBeneficiary,
  formSplitGiuseppe,
  setFormSplitGiuseppe,
  formSplitClaudia,
  setFormSplitClaudia,
  formPaymentMethod,
  setFormPaymentMethod,
  formCroCode,
  setFormCroCode,
  formAmount,
  setFormAmount,
  formInvoiceFile,
  setFormInvoiceFile,
  formReceiptFile,
  setFormReceiptFile,
  currentModalCalc,
  handleFileUpload,
  onSubmit,
  owner1Name,
  owner2Name,
  owner1Initial,
  owner2Initial,
  fmt
}) => {
  if (!isOpen) return null;

  return (
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
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-4 text-xs">
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
              onClick={onClose}
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
  );
};
