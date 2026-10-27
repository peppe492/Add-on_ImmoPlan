import React from 'react';

interface InvoiceFilterToolbarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  filterProperty: string;
  setFilterProperty: (val: string) => void;
  filterYear: string;
  setFilterYear: (val: string) => void;
  filterBeneficiary: string;
  setFilterBeneficiary: (val: string) => void;
  filterCategory: string;
  setFilterCategory: (val: string) => void;
  filterOnlyMissing: boolean;
  setFilterOnlyMissing: React.Dispatch<React.SetStateAction<boolean>>;
  propertyDirectory: Record<string, { name: string; city: string }>;
  availableYears: number[];
  owner1Name: string;
  owner2Name: string;
  owner1Initial: string;
  owner2Initial: string;
}

export const InvoiceFilterToolbar: React.FC<InvoiceFilterToolbarProps> = ({
  searchQuery,
  setSearchQuery,
  filterProperty,
  setFilterProperty,
  filterYear,
  setFilterYear,
  filterBeneficiary,
  setFilterBeneficiary,
  filterCategory,
  setFilterCategory,
  filterOnlyMissing,
  setFilterOnlyMissing,
  propertyDirectory,
  availableYears,
  owner1Name,
  owner2Name,
  owner1Initial,
  owner2Initial
}) => {
  return (
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
          type="button"
          onClick={() => setFilterCategory('ALL')}
          className={`px-2.5 py-1 rounded-lg border transition cursor-pointer ${
            filterCategory === 'ALL'
              ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white'
              : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Tutto
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('BONUS_50')}
          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:opacity-80 transition cursor-pointer"
        >
          🛠️ Ristrutturazione 50%
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('ECOBONUS_65')}
          className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:opacity-80 transition cursor-pointer"
        >
          🌿 Ecobonus 65%
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('BONUS_MOBILI')}
          className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:opacity-80 transition cursor-pointer"
        >
          🛋️ Bonus Mobili 50%
        </button>
        <button
          type="button"
          onClick={() => setFilterOnlyMissing(prev => !prev)}
          className={`px-2.5 py-1 rounded-lg border transition flex items-center gap-1 cursor-pointer ${
            filterOnlyMissing
              ? 'bg-amber-500 text-white dark:bg-amber-600 border-amber-600'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:opacity-80'
          }`}
        >
          <span>⚠️</span>
          <span>{filterOnlyMissing ? 'Filtro Mancanti ATTIVO' : 'Solo con allegati mancanti'}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchQuery('');
            setFilterProperty('ALL');
            setFilterYear('ALL');
            setFilterBeneficiary('ALL');
            setFilterCategory('ALL');
            setFilterOnlyMissing(false);
          }}
          className="ml-auto text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline shrink-0 cursor-pointer"
        >
          Azzera filtri
        </button>
      </div>
    </div>
  );
};
