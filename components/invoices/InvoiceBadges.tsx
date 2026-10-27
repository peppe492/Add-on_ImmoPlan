import React from 'react';
import { InvoiceRecord, InvoicePaymentMethod } from '../../types';

interface InvoiceBadgesProps {
  owner1Name: string;
  owner2Name: string;
}

export const CategoryBadge: React.FC<{ inv: InvoiceRecord }> = ({ inv }) => {
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

export const BeneficiaryBadge: React.FC<{ inv: InvoiceRecord; owner1Name: string; owner2Name: string }> = ({
  inv,
  owner1Name,
  owner2Name
}) => {
  const isOwner1 = (val?: string) => val === owner1Name || val === 'Giuseppe';
  const isOwner2 = (val?: string) => val === owner2Name || val === 'Claudia';
  const owner1Initial = (owner1Name || 'G').charAt(0).toUpperCase();
  const owner2Initial = (owner2Name || 'C').charAt(0).toUpperCase();

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

export const PaymentBadge: React.FC<{ method: InvoicePaymentMethod; croCode?: string }> = ({ method, croCode }) => {
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
      {croCode && (
        <span className="block font-mono text-[9px] text-slate-400 dark:text-slate-500 truncate max-w-[120px]" title={croCode}>
          {croCode}
        </span>
      )}
    </div>
  );
};
