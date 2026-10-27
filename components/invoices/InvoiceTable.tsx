import React from 'react';
import { InvoiceRecord } from '../../types';
import { computeDeduction } from '../../services/taxDeductionService';
import { CategoryBadge, BeneficiaryBadge, PaymentBadge } from './InvoiceBadges';

interface InvoiceTableProps {
  invoices: InvoiceRecord[];
  propertyDirectory: Record<string, { name: string; city: string }>;
  owner1Name: string;
  owner2Name: string;
  onEditInvoice: (inv: InvoiceRecord) => void;
  onDeleteInvoice: (id: string) => void;
  onPreviewDocument: (inv: InvoiceRecord, type: 'invoice' | 'receipt') => void;
  onResetFilters: () => void;
  fmt: (num: number) => string;
}

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  invoices,
  propertyDirectory,
  owner1Name,
  owner2Name,
  onEditInvoice,
  onDeleteInvoice,
  onPreviewDocument,
  onResetFilters,
  fmt
}) => {
  const isOwner1 = (val?: string) => val === owner1Name || val === 'Giuseppe';
  const isOwner2 = (val?: string) => val === owner2Name || val === 'Claudia';

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Registro Pagamenti & Fatture per 730</h3>
          <p className="text-xs text-slate-400">Principio di cassa: l'anno fiscale segue la data di esecuzione del bonifico</p>
        </div>
        <div className="text-xs text-slate-500">
          Visualizzate: <strong className="text-slate-900 dark:text-white font-bold">{invoices.length}</strong> fatture
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
            {invoices.map(inv => {
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
                  <td className="py-3 px-4 whitespace-nowrap">
                    <CategoryBadge inv={inv} />
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <BeneficiaryBadge inv={inv} owner1Name={owner1Name} owner2Name={owner2Name} />
                  </td>
                  <td className="py-3 px-4">
                    <PaymentBadge method={inv.paymentMethod} croCode={inv.croCode} />
                  </td>
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
                          type="button"
                          onClick={() => onPreviewDocument(inv, 'invoice')}
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
                          type="button"
                          onClick={() => onPreviewDocument(inv, 'receipt')}
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
                        type="button"
                        onClick={() => onEditInvoice(inv)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="Modifica"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteInvoice(inv.id)}
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
      {invoices.length === 0 && (
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
            type="button"
            onClick={onResetFilters}
            className="text-xs text-emerald-600 hover:underline font-semibold cursor-pointer"
          >
            Reimposta filtri
          </button>
        </div>
      )}
    </div>
  );
};
