// components/RentReceiptModal.tsx
import React, { useState } from 'react';
import { RentReceipt, Tenant } from '../types';
import { downloadReceiptPdf } from '../services/receiptPdfService';
import { notificationService } from '../services/notificationService';

interface RentReceiptModalProps {
  receipt: RentReceipt;
  tenant?: Tenant;
  onClose: () => void;
  onReceiptUpdated?: (receipt: RentReceipt) => void;
}

export const RentReceiptModal: React.FC<RentReceiptModalProps> = ({
  receipt,
  tenant,
  onClose,
  onReceiptUpdated
}) => {
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleDownload = () => {
    downloadReceiptPdf(receipt);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendTelegram = async () => {
    setSendingTelegram(true);
    setTelegramStatus(null);
    try {
      const res = await notificationService.sendReceiptViaTelegram(receipt, tenant?.telegramChatId);
      setTelegramStatus(res);
    } catch (e: any) {
      setTelegramStatus({ success: false, message: e.message || 'Errore invio Telegram' });
    } finally {
      setSendingTelegram(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-slate-800/80 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl font-bold border border-indigo-500/30">
              📄
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Quietanza di Pagamento N. {receipt.formattedNumber}
              </h3>
              <p className="text-xs text-slate-400">
                Data emissione: {receipt.issueDate.split('T')[0]} · {receipt.competencePeriod}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Receipt Content Preview */}
        <div className="p-6 space-y-6 max-h-[68vh] overflow-y-auto text-sm print:p-0 print:bg-white print:text-black">
          {/* Status Alert if Sent */}
          {telegramStatus && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
                telegramStatus.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <span>{telegramStatus.success ? '✅' : '⚠️'}</span>
              <span>{telegramStatus.message}</span>
            </div>
          )}

          {/* Parties Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                Locatore (Proprietario)
              </span>
              <p className="font-medium text-white">{receipt.landlordName}</p>
              <p className="text-xs text-slate-400">CF: {receipt.landlordTaxCode || '-'}</p>
              {receipt.landlordAddress && (
                <p className="text-xs text-slate-400 mt-1">{receipt.landlordAddress}</p>
              )}
            </div>

            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                Conduttore (Inquilino)
              </span>
              <p className="font-medium text-white">{receipt.tenantName}</p>
              <p className="text-xs text-slate-400">CF: {receipt.tenantTaxCode || '-'}</p>
              {tenant?.telegramChatId && (
                <p className="text-xs text-sky-400 mt-1 flex items-center gap-1">
                  <span>✈️ Chat ID:</span> {tenant.telegramChatId}
                </p>
              )}
            </div>
          </div>

          {/* Property & Competence */}
          <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Immobile e Competenza
            </span>
            <div className="flex justify-between items-center mt-1">
              <div>
                <p className="font-medium text-white">{receipt.propertyName}</p>
                <p className="text-xs text-slate-400">{receipt.propertyAddress || '-'}</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {receipt.competencePeriod}
                </span>
              </div>
            </div>
          </div>

          {/* Accounting Table */}
          <div className="border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/80 text-xs font-semibold text-slate-300 uppercase">
                  <th className="py-2.5 px-4">Voce Contabile</th>
                  <th className="py-2.5 px-4 text-right">Importo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-200">
                <tr>
                  <td className="py-2.5 px-4">Canone di locazione pattuito</td>
                  <td className="py-2.5 px-4 text-right font-medium">
                    € {receipt.rentAmount.toFixed(2)}
                  </td>
                </tr>
                {receipt.expensesAmount > 0 && (
                  <tr>
                    <td className="py-2.5 px-4">Oneri accessori / Spese condominiali</td>
                    <td className="py-2.5 px-4 text-right font-medium">
                      € {receipt.expensesAmount.toFixed(2)}
                    </td>
                  </tr>
                )}
                <tr className="bg-indigo-950/40 font-bold text-white text-base">
                  <td className="py-3 px-4">Totale Corrisposto e Saldato</td>
                  <td className="py-3 px-4 text-right text-emerald-400">
                    € {receipt.totalAmount.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Tax clause & notes */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">Dichiarazione di quietanza liberatoria:</p>
            <p>Regime fiscale: <strong>{receipt.taxRegime}</strong></p>
            {receipt.stampDutyApplied ? (
              <p className="text-amber-400">
                Imposta di bollo di € 2,00 assolta sull'originale ai sensi dell'art. 13 DPR 642/1972.
              </p>
            ) : (
              <p>
                {receipt.taxRegime === 'CEDOLARE_SECCA'
                  ? 'Operazione soggetta a cedolare secca ex art. 3 D.Lgs. 23/2011. Imposta di bollo non dovuta.'
                  : 'Esente da imposta di bollo.'}
              </p>
            )}
            <p className="italic text-slate-400 pt-1">
              "Il locatore rilascia la presente quale quietanza liberatoria a saldo di quanto sopra specificato."
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-800/80 px-6 py-4 border-t border-slate-700 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <span>📥</span> Scarica PDF
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-sm font-medium transition flex items-center gap-2"
            >
              <span>🖨️</span> Stampa
            </button>
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={handleSendTelegram}
              disabled={sendingTelegram}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                sendingTelegram
                  ? 'bg-sky-700 text-white cursor-wait'
                  : 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-500/20'
              }`}
            >
              <span>{sendingTelegram ? '⏳' : '✈️'}</span>
              <span>{sendingTelegram ? 'Invio in corso...' : 'Invia via Telegram'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm font-medium transition"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
