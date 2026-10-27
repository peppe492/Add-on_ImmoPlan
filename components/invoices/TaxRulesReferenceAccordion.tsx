import React from 'react';

interface TaxRulesReferenceAccordionProps {
  isGuideOpen: boolean;
  setIsGuideOpen: React.Dispatch<React.SetStateAction<boolean>>;
  owner1Name: string;
  owner2Name: string;
}

export const TaxRulesReferenceAccordion: React.FC<TaxRulesReferenceAccordionProps> = ({
  isGuideOpen,
  setIsGuideOpen,
  owner1Name,
  owner2Name
}) => {
  return (
    <div className="rounded-2xl p-5 shadow-sm space-y-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsGuideOpen(prev => !prev)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📚</span>
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
            Promemoria Requisiti Fisco per le Detrazioni Edilizie (Agenzia delle Entrate)
          </h4>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transform transition-transform duration-200 ${isGuideOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isGuideOpen && (
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-400">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
            <strong className="text-slate-900 dark:text-white flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Bonifico Dedicato ("Parlante")
            </strong>
            <p>
              Obbligatorio per Bonus Casa ed Ecobonus. Deve riportare: Causale normativa (art. 16-bis TUIR per 50% o L. 296/06 per 65%), Codice Fiscale dell'ordinante ({owner1Name} o {owner2Name}), P.IVA o CF dell'impresa esecutrice dei lavori.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
            <strong className="text-slate-900 dark:text-white flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-teal-500"></span>
              Asseverazione & Comunicazione ENEA
            </strong>
            <p>
              Obbligatoria entro 90 giorni dalla fine lavori per Ecobonus 65% e interventi di efficienza energetica (es. infissi, climatizzatori in pompa di calore, scaldacqua a PDC). Conservare ricevuta CPID.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
            <strong className="text-slate-900 dark:text-white flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              Massimali di Spesa Vigenti
            </strong>
            <p>
              Bonus Ristrutturazioni 50%: tetto 96.000€ per unità immobiliare. Bonus Mobili: tetto 5.000€ (anno 2024). Spese agenzia immobiliare prima casa: detrazione 19% max 1.000€ spesa (190€). Notaio mutuo: 19% max 4.000€ spesa (760€).
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
