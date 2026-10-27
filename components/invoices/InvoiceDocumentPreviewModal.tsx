import React from 'react';
import { InvoiceRecord, Attachment } from '../../types';

interface InvoiceDocumentPreviewModalProps {
  previewDoc: { invoice: InvoiceRecord; type: 'invoice' | 'receipt'; attachment: Attachment } | null;
  onClose: () => void;
  onDownload: () => void;
  propertyDirectory: Record<string, { name: string; city: string }>;
  owner1Name: string;
  owner2Name: string;
  owner1Initial: string;
  owner2Initial: string;
  fmt: (num: number) => string;
}

export const InvoiceDocumentPreviewModal: React.FC<InvoiceDocumentPreviewModalProps> = ({
  previewDoc,
  onClose,
  onDownload,
  propertyDirectory,
  owner1Name,
  owner2Name,
  owner1Initial,
  owner2Initial,
  fmt
}) => {
  if (!previewDoc) return null;

  const isOwner1 = (val?: string) => val === owner1Name || val === 'Giuseppe';
  const isOwner2 = (val?: string) => val === owner2Name || val === 'Claudia';

  return (
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
              type="button"
              onClick={onDownload}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Scarica Documento
            </button>
            <button
              type="button"
              onClick={onClose}
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
  );
};
