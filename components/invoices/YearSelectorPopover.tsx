import React from 'react';
import { YearDeductionSchedule } from './types';

interface YearSelectorPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  popoverRef: React.RefObject<HTMLDivElement | null>;
  startYear: number;
  endYear: number;
  effectiveSelectedYear: number;
  onSelectYear: (year: number) => void;
  kpiTimeline: YearDeductionSchedule[];
  fmt: (num: number) => string;
}

export const YearSelectorPopover: React.FC<YearSelectorPopoverProps> = ({
  isOpen,
  onClose,
  popoverRef,
  startYear,
  endYear,
  effectiveSelectedYear,
  onSelectYear,
  kpiTimeline,
  fmt
}) => {
  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef as any}
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
          onClick={onClose}
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
            onSelectYear(startYear);
            onClose();
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
              onSelectYear(startYear + 1);
              onClose();
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
              onSelectYear(endYear);
              onClose();
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
                onSelectYear(item.year);
                onClose();
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
  );
};
