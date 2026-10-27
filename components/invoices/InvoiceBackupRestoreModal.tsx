import React from 'react';
import { InvoiceRecord } from '../../types';

interface InvoiceBackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  backupModalTab: 'EXPORT' | 'IMPORT';
  setBackupModalTab: (tab: 'EXPORT' | 'IMPORT') => void;
  invoices: InvoiceRecord[];
  kpis: { totalExpenses: number; totalDeductions: number };
  onExportJsonBackup: () => void;
  importPendingInvoices: InvoiceRecord[] | null;
  importMeta: {
    filename: string;
    count: number;
    totalAmount: number;
    attachmentsCount: number;
    years: number[];
    exportDate?: string;
  } | null;
  importMode: 'MERGE' | 'OVERWRITE';
  setImportMode: (mode: 'MERGE' | 'OVERWRITE') => void;
  importError: string | null;
  isImportProcessing: boolean;
  isDraggingFile: boolean;
  setIsDraggingFile: (val: boolean) => void;
  importFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImportFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDropFile: (e: React.DragEvent<HTMLDivElement>) => void;
  executeImport: () => Promise<void>;
  resetImportSelection: () => void;
  fmt: (num: number) => string;
}

export const InvoiceBackupRestoreModal: React.FC<InvoiceBackupRestoreModalProps> = ({
  isOpen,
  onClose,
  backupModalTab,
  setBackupModalTab,
  invoices,
  kpis,
  onExportJsonBackup,
  importPendingInvoices,
  importMeta,
  importMode,
  setImportMode,
  importError,
  isImportProcessing,
  isDraggingFile,
  setIsDraggingFile,
  importFileInputRef,
  handleImportFileInputChange,
  handleDropFile,
  executeImport,
  resetImportSelection,
  fmt
}) => {
  if (!isOpen) return null;

  return (
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
            type="button"
            onClick={() => {
              onClose();
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
                  <li>Ripartizione delle quote tra i comproprietari (50/50, 100% o percentuali personalizzate)</li>
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
                  onClick={onExportJsonBackup}
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
                ref={importFileInputRef as any}
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
              onClose();
              resetImportSelection();
            }}
            className="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
