
import React, { useState } from 'react';
import { FinancialData } from '../types';
import { analyzeFinancialScenario, getMarketInfo } from '../services/geminiService';

interface Props {
  data: FinancialData;
}

export const AIAdvisor: React.FC<Props> = ({ data }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{ text: string; sources?: any[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'ANALYZE' | 'SEARCH'>('ANALYZE');

  const handleAnalyze = async () => {
    setIsLoading(true);
    try {
      const context = JSON.stringify(data, null, 2);
      const result = await analyzeFinancialScenario(context);
      setAnalysis(result.text);
    } catch (e) {
      alert("Errore durante l'analisi AI.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    try {
      const result = await getMarketInfo(searchQuery);
      setSearchResult(result);
    } catch (e) {
      alert("Errore durante la ricerca.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Mode Switcher */}
      <div className="flex justify-center">
        <div className="inline-flex bg-slate-200/50 p-1.5 rounded-2xl">
          <button
            onClick={() => setMode('ANALYZE')}
            className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${mode === 'ANALYZE' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <span className="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-brain"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M12 5v14"/></svg> Analisi Strategica</span>
          </button>
          <button
             onClick={() => setMode('SEARCH')}
             className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${mode === 'SEARCH' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <span className="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Ricerca Mercato</span>
          </button>
        </div>
      </div>

      {mode === 'ANALYZE' && (
        <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-r from-brand-500 to-brand-700 p-8 text-white relative overflow-hidden">
             {/* Decorative circles */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
             <h3 className="text-2xl font-bold mb-2 relative z-10">Consulente Finanziario AI</h3>
             <p className="text-brand-100 relative z-10 max-w-xl">
               Gemini 3 Pro analizzerà i tuoi dati per trovare inefficienze, rischi di liquidità e opportunità di risparmio nascoste.
             </p>
          </div>
          
          <div className="p-8">
            {!analysis ? (
              <div className="text-center py-12">
                 <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-500"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
                 <button
                  onClick={handleAnalyze}
                  disabled={isLoading}
                  className="bg-brand-600 text-white py-4 px-10 rounded-2xl font-bold shadow-glow hover:shadow-lg hover:bg-brand-700 transition-all disabled:opacity-50 disabled:shadow-none transform active:scale-95"
                >
                  {isLoading ? 'Analisi in corso...' : 'Avvia Analisi Completa'}
                </button>
                <p className="text-slate-400 text-sm mt-4">L'analisi potrebbe richiedere fino a 30 secondi.</p>
              </div>
            ) : (
              <div className="animate-fade-in">
                 <div className="prose prose-slate prose-lg max-w-none prose-headings:text-slate-800 prose-p:text-slate-600 prose-a:text-brand-600">
                    <div dangerouslySetInnerHTML={{ __html: analysis.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900">$1</strong>') }} />
                 </div>
                 <div className="mt-8 pt-8 border-t border-slate-100 flex justify-center">
                    <button onClick={() => setAnalysis(null)} className="text-brand-600 font-semibold hover:bg-brand-50 px-6 py-2 rounded-xl transition-colors">
                       🔄 Nuova Analisi
                    </button>
                 </div>
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'SEARCH' && (
        <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-100 min-h-[500px] flex flex-col">
          <div className="text-center mb-8">
             <h3 className="text-2xl font-bold text-slate-900 mb-2">Chiedi al Mercato</h3>
             <p className="text-slate-500">Dati in tempo reale su prezzi, tassi e normative.</p>
          </div>

          <div className="flex gap-2 mb-8 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="es. Costo medio posa parquet Roma 2024"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-500 outline-none text-lg shadow-inner"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="absolute right-2 top-2 bottom-2 bg-brand-600 text-white px-6 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-md"
            >
              {isLoading ? '...' : 'Cerca'}
            </button>
          </div>

          {searchResult ? (
            <div className="flex-1 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
              <p className="text-slate-800 leading-relaxed text-lg">{searchResult.text}</p>
              {searchResult.sources && searchResult.sources.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-200/60">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Fonti Verificate</p>
                  <div className="flex flex-wrap gap-2">
                    {searchResult.sources.map((s, idx) => (
                      <a key={idx} href={s.uri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-brand-600 hover:border-brand-300 hover:shadow-sm transition-all truncate max-w-[200px]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> {s.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-50">
               <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-slate-350 dark:text-slate-500 mb-4 opacity-35"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
               <p>Inserisci una domanda per iniziare</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
