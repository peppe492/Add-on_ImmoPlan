import React from 'react';
import { YearDeductionSchedule } from './types';
import { YearSelectorPopover } from './YearSelectorPopover';

interface InvoiceKpisData {
  totalExpenses: number;
  giuseppeExpenses: number;
  claudiaExpenses: number;
  deductibleBase: number;
  ratioPercent: number;
  totalDeductions: number;
}

interface InvoiceKpiCardsProps {
  kpis: InvoiceKpisData;
  selectedYearData: YearDeductionSchedule;
  effectiveSelectedYear: number;
  startYear: number;
  endYear: number;
  setSelectedKpiYear: (year: number) => void;
  isYearPickerOpen: boolean;
  setIsYearPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  calendarButtonRef: React.RefObject<HTMLButtonElement | null>;
  yearPickerRef: React.RefObject<HTMLDivElement | null>;
  kpiTimeline: YearDeductionSchedule[];
  owner1Name: string;
  owner2Name: string;
  owner1Initial: string;
  owner2Initial: string;
  fmt: (num: number) => string;
}

export const InvoiceKpiCards: React.FC<InvoiceKpiCardsProps> = ({
  kpis,
  selectedYearData,
  effectiveSelectedYear,
  startYear,
  endYear,
  setSelectedKpiYear,
  isYearPickerOpen,
  setIsYearPickerOpen,
  calendarButtonRef,
  yearPickerRef,
  kpiTimeline,
  owner1Name,
  owner2Name,
  owner1Initial,
  owner2Initial,
  fmt
}) => {
  return (
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
              ref={calendarButtonRef as any}
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
        <YearSelectorPopover
          isOpen={isYearPickerOpen}
          onClose={() => setIsYearPickerOpen(false)}
          popoverRef={yearPickerRef}
          startYear={startYear}
          endYear={endYear}
          effectiveSelectedYear={effectiveSelectedYear}
          onSelectYear={setSelectedKpiYear}
          kpiTimeline={kpiTimeline}
          fmt={fmt}
        />
      </div>
    </div>
  );
};
