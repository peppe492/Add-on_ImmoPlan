import React, { useState, useMemo, useRef, useEffect } from 'react';
import { HelpArticle, FaqItem, HelpCategory } from '../types';
import { HELP_CATEGORIES, HELP_ARTICLES, HELP_FAQS } from '../services/helpData';

interface HelpCenterProps {
  theme?: 'DEFAULT' | 'NEON';
}

export const HelpCenter: React.FC<HelpCenterProps> = ({ theme = 'DEFAULT' }) => {
  const isNeon = theme === 'NEON';
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Platform detection for keyboard shortcut display (Mac vs Windows/Linux)
  const isMac = useMemo(() => {
    return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  }, []);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | 'ALL'>('ALL');
  const [activeArticle, setActiveArticle] = useState<HelpArticle | null>(null);
  const [activeFaqId, setActiveFaqId] = useState<string | null>(null);
  const [activeToolTab, setActiveToolTab] = useState<'MORTGAGE' | 'GREEN_HOMES' | 'TAX_COMPARE'>('MORTGAGE');
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);

  // Mini-Calculator 1: French Mortgage Simulator State
  const [calcLoanAmount, setCalcLoanAmount] = useState<number>(160000);
  const [calcRate, setCalcRate] = useState<number>(3.5);
  const [calcYears, setCalcYears] = useState<number>(20);

  // Mini-Calculator 2: EU Green Homes Impact State
  const [calcPropertyValue, setCalcPropertyValue] = useState<number>(220000);
  const [calcEnergyClass, setCalcEnergyClass] = useState<'AB' | 'CD' | 'EFG'>('EFG');

  // Mini-Calculator 3: Tax Regime Comparison State
  const [calcMonthlyRent, setCalcMonthlyRent] = useState<number>(900);
  const [calcIrpefBracket, setCalcIrpefBracket] = useState<number>(35);

  // Global Keyboard Shortcuts (Cmd+K / Ctrl+K and Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'Escape') {
        if (activeArticle) {
          setActiveArticle(null);
        } else if (document.activeElement === searchInputRef.current) {
          setSearchQuery('');
          searchInputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeArticle]);

  // Safe Clipboard Copy Helper with Fallback
  const copyToClipboard = async (text: string, key: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedCodeKey(key);
      setTimeout(() => {
        setCopiedCodeKey(null);
      }, 2200);
    } catch (err) {
      console.warn('Clipboard write error, falling back to execCommand:', err);
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopiedCodeKey(key);
        setTimeout(() => {
          setCopiedCodeKey(null);
        }, 2200);
      } catch (fallbackErr) {
        console.error('Fallback clipboard copy failed:', fallbackErr);
      }
    }
  };

  // French Mortgage Calculation with Dynamic Progression
  const mortgageResults = useMemo(() => {
    const P = Math.max(0, calcLoanAmount);
    const r = (Math.max(0.1, calcRate) / 100) / 12;
    const n = Math.max(1, calcYears) * 12;

    const monthly = P > 0 ? P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : 0;
    const totalPaid = monthly * n;
    const totalInterest = Math.max(0, totalPaid - P);

    // Remaining debt at year yr
    const debtAtYear = (yr: number) => {
      const m = Math.min(n, yr * 12);
      if (m >= n || P === 0) return 0;
      return P * (Math.pow(1 + r, n) - Math.pow(1 + r, m)) / (Math.pow(1 + r, n) - 1);
    };

    // Calculate dynamic checkpoints: 5 years, 10 years, and final payoff year
    const y1 = Math.min(5, Math.floor(calcYears / 2));
    const y2 = Math.min(10, Math.floor(calcYears * 0.75));
    const y3 = calcYears;

    return {
      monthly: Math.round(monthly * 100) / 100,
      totalPaid: Math.round(totalPaid),
      totalInterest: Math.round(totalInterest),
      y1,
      y2,
      y3,
      debtY1: Math.round(debtAtYear(y1)),
      debtY2: Math.round(debtAtYear(y2)),
      debtY3: Math.round(debtAtYear(y3)),
      amortizedY1: Math.round(P - debtAtYear(y1)),
      amortizedY2: Math.round(P - debtAtYear(y2)),
      amortizedY3: Math.round(P)
    };
  }, [calcLoanAmount, calcRate, calcYears]);

  // Case Verdi Impact Calculation
  const greenHomesResults = useMemo(() => {
    const V0 = Math.max(0, calcPropertyValue);
    let delta = 0;
    let label = 'Neutro (0.0%)';
    if (calcEnergyClass === 'AB') {
      delta = 0.015; // +1.5%
      label = '+1.5% Bonus Green';
    } else if (calcEnergyClass === 'EFG') {
      delta = -0.020; // -2.0%
      label = '-2.0% Penalizzazione';
    }

    const neutralAnnualGrowth = 0.021; // +2.1% market baseline
    const adjustedGrowth = neutralAnnualGrowth + delta;

    const neutralY5 = Math.round(V0 * Math.pow(1 + neutralAnnualGrowth, 5));
    const neutralY10 = Math.round(V0 * Math.pow(1 + neutralAnnualGrowth, 10));

    const adjustedY5 = Math.round(V0 * Math.pow(1 + adjustedGrowth, 5));
    const adjustedY10 = Math.round(V0 * Math.pow(1 + adjustedGrowth, 10));

    const diffY5 = adjustedY5 - neutralY5;
    const diffY10 = adjustedY10 - neutralY10;

    return {
      label,
      adjustedY5,
      adjustedY10,
      diffY5,
      diffY10,
      pctY10: (((adjustedY10 - V0) / (V0 || 1)) * 100).toFixed(1)
    };
  }, [calcPropertyValue, calcEnergyClass]);

  // Tax Regime Comparison Calculation
  const taxResults = useMemo(() => {
    const annualRent = Math.max(0, calcMonthlyRent) * 12;
    // Cedolare 21%
    const taxCedolare21 = Math.round(annualRent * 0.21);
    const netCedolare21 = Math.round(annualRent - taxCedolare21);

    // Cedolare 10%
    const taxCedolare10 = Math.round(annualRent * 0.10);
    const netCedolare10 = Math.round(annualRent - taxCedolare10);

    // IRPEF Ordinaria (base imponibile 95% del canone)
    const baseIrpef = annualRent * 0.95;
    const taxIrpef = Math.round(baseIrpef * (calcIrpefBracket / 100));
    const netIrpef = Math.round(annualRent - taxIrpef);

    const saving10vs21 = taxCedolare21 - taxCedolare10;
    const saving21vsIrpef = taxIrpef - taxCedolare21;

    return {
      annualRent,
      taxCedolare21,
      netCedolare21,
      taxCedolare10,
      netCedolare10,
      taxIrpef,
      netIrpef,
      saving10vs21,
      saving21vsIrpef
    };
  }, [calcMonthlyRent, calcIrpefBracket]);

  // Multi-term Search Filter for Articles
  const filteredArticles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);

    return HELP_ARTICLES.filter(art => {
      const matchCat = selectedCategory === 'ALL' || art.category === selectedCategory;
      if (!matchCat) return false;
      if (terms.length === 0) return true;

      const title = art.title.toLowerCase();
      const summary = art.summary.toLowerCase();
      const content = art.content.toLowerCase();
      const tags = art.tags.map(t => t.toLowerCase());

      return terms.every(term =>
        title.includes(term) ||
        summary.includes(term) ||
        content.includes(term) ||
        tags.some(t => t.includes(term))
      );
    });
  }, [searchQuery, selectedCategory]);

  // Multi-term Search Filter for FAQs
  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);

    return HELP_FAQS.filter(faq => {
      const matchCat = selectedCategory === 'ALL' || faq.category === selectedCategory;
      if (!matchCat) return false;
      if (terms.length === 0) return true;

      const question = faq.question.toLowerCase();
      const answer = faq.answer.toLowerCase();
      const tags = (faq.tags || []).map(t => t.toLowerCase());

      return terms.every(term =>
        question.includes(term) ||
        answer.includes(term) ||
        tags.some(t => t.includes(term))
      );
    });
  }, [searchQuery, selectedCategory]);

  const triggerGeminiChat = (customPrompt?: string) => {
    const prompt = customPrompt || (activeArticle ? `Vorrei chiarimenti sull'argomento: "${activeArticle.title}".` : "Ho una domanda sulla gestione dei miei immobili in ImmoPlan.");
    window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { prompt } }));
  };

  const eur = (val: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
  };

  // Helper to format inline markdown (bold, code, math variables)
  const renderInlineText = (text: string): React.ReactNode => {
    // Regex tokens: **bold**, `code`, $math$
    const parts = text.split(/(\*\*.*?\*\*|`.*?`|\$.*?\$)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-bold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={idx} className="font-mono bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-cyan-400 px-1.5 py-0.5 rounded text-[11px] font-semibold">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('$') && part.endsWith('$')) {
        const cleanMath = part
          .slice(1, -1)
          .replace(/\\Delta/g, 'Δ')
          .replace(/\\text\{([^}]+)\}/g, '$1')
          .replace(/\\mathbf\{([^}]+)\}/g, '$1')
          .replace(/\\in/g, '∈')
          .replace(/\\times/g, '×');
        return (
          <span key={idx} className="font-mono font-semibold px-1 py-0.5 rounded bg-blue-50/80 dark:bg-slate-800/80 text-brand-700 dark:text-cyan-300 text-xs">
            {cleanMath}
          </span>
        );
      }
      return part;
    });
  };

  // Clean LaTeX representation for readable math formulas
  const cleanLatex = (formula: string) => {
    return formula
      .replace(/\$\$/g, '')
      .replace(/\\mathbf\{([^}]+)\}/g, '$1')
      .replace(/\\text\{([^}]+)\}/g, '$1')
      .replace(/\\times/g, ' × ')
      .replace(/\\cdot/g, ' · ')
      .replace(/\\in/g, ' ∈ ')
      .replace(/\\approx/g, ' ≈ ')
      .replace(/\\Delta/g, 'Δ')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
      .replace(/\\/g, '');
  };

  // Comprehensive Markdown & Table Parser
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    const renderedElements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBuffer: string[] = [];
    let codeBlockKey = 0;

    let inTable = false;
    let tableBuffer: string[] = [];

    const flushTable = (keyIndex: number) => {
      if (tableBuffer.length < 2) {
        tableBuffer = [];
        inTable = false;
        return;
      }

      // Filter out separator lines (e.g. | :--- | :---: |)
      const nonSeparatorRows = tableBuffer.filter(row => !row.match(/^\|\s*[:\-\s|]+\|$/));
      if (nonSeparatorRows.length === 0) {
        tableBuffer = [];
        inTable = false;
        return;
      }

      const headerRow = nonSeparatorRows[0];
      const dataRows = nonSeparatorRows.slice(1);

      const headerCols = headerRow
        .split('|')
        .map(c => c.trim())
        .filter((c, i, arr) => i > 0 && i < arr.length - 1);

      renderedElements.push(
        <div key={`table_${keyIndex}`} className="my-5 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-heading font-bold uppercase tracking-wider text-[11px]">
              <tr>
                {headerCols.map((col, idx) => (
                  <th key={idx} className="p-3.5 sm:px-4">
                    {renderInlineText(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/40">
              {dataRows.map((row, rIdx) => {
                const cols = row
                  .split('|')
                  .map(c => c.trim())
                  .filter((c, i, arr) => i > 0 && i < arr.length - 1);
                return (
                  <tr key={rIdx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    {cols.map((cell, cIdx) => (
                      <td key={cIdx} className="p-3.5 sm:px-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                        {renderInlineText(cell)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );

      tableBuffer = [];
      inTable = false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks
      if (line.startsWith('```')) {
        if (inTable) flushTable(i);

        if (inCodeBlock) {
          const codeText = codeBuffer.join('\n');
          const currentKey = `code_${codeBlockKey++}`;
          renderedElements.push(
            <div key={currentKey} className="my-5 relative rounded-2xl overflow-hidden bg-slate-950 text-slate-100 border border-slate-800 text-xs shadow-md">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Configurazione YAML / Codice
                </span>
                <button
                  onClick={() => copyToClipboard(codeText, currentKey)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 font-sans text-xs font-semibold"
                >
                  {copiedCodeKey === currentKey ? '✓ Copiato!' : '📋 Copia Codice'}
                </button>
              </div>
              <pre className="p-4 overflow-x-auto font-mono text-[11.5px] leading-relaxed">
                <code>{codeText}</code>
              </pre>
            </div>
          );
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // Markdown Tables
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        inTable = true;
        tableBuffer.push(line.trim());
        continue;
      } else if (inTable) {
        flushTable(i);
      }

      // Headings
      if (line.startsWith('### ')) {
        renderedElements.push(
          <h3 key={i} className="text-base sm:text-lg font-heading font-black mt-6 mb-2.5 text-brand-600 dark:text-cyan-400">
            {line.replace('### ', '')}
          </h3>
        );
      } else if (line.startsWith('#### ')) {
        renderedElements.push(
          <h4 key={i} className="text-xs sm:text-sm font-heading font-bold mt-4 mb-2 text-slate-800 dark:text-slate-200 uppercase tracking-wide">
            {line.replace('#### ', '')}
          </h4>
        );
      } else if (line.startsWith('---')) {
        renderedElements.push(<hr key={i} className="my-6 border-slate-200 dark:border-slate-800" />);
      } else if (line.trim().startsWith('$$') && line.trim().endsWith('$$')) {
        const formulaClean = cleanLatex(line.trim());
        const formulaKey = `formula_${i}`;
        renderedElements.push(
          <div key={i} className="my-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-cyan-50/80 dark:from-slate-950 dark:to-cyan-950/40 border border-blue-200/80 dark:border-cyan-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
            <div className="font-mono text-center sm:text-left font-bold text-xs sm:text-sm text-brand-700 dark:text-cyan-300 tracking-wide">
              📐 {formulaClean}
            </div>
            <button
              onClick={() => copyToClipboard(formulaClean, formulaKey)}
              className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800 hover:bg-white text-slate-600 dark:text-slate-300 text-[11px] font-semibold border border-slate-200 dark:border-slate-700 transition-colors shrink-0"
            >
              {copiedCodeKey === formulaKey ? '✓ Copiata!' : 'Copia Formula'}
            </button>
          </div>
        );
      } else if (line.trim().match(/^\d+\.\s+/)) {
        const itemText = line.trim().replace(/^\d+\.\s+/, '');
        renderedElements.push(
          <div key={i} className="ml-2 sm:ml-4 my-1.5 flex items-start gap-2.5 text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-500/10 text-brand-600 dark:text-cyan-400 text-[11px] font-bold flex items-center justify-center font-mono mt-0.5">
              {line.trim().match(/^\d+/)?.[0]}
            </span>
            <div className="flex-1">{renderInlineText(itemText)}</div>
          </div>
        );
      } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const itemText = line.trim().replace(/^[-*]\s+/, '');
        renderedElements.push(
          <div key={i} className="ml-2 sm:ml-4 my-1.5 flex items-start gap-2 text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
            <span className="text-brand-500 dark:text-cyan-400 font-bold shrink-0 mt-0.5">•</span>
            <div className="flex-1">{renderInlineText(itemText)}</div>
          </div>
        );
      } else if (line.trim().startsWith('> ')) {
        renderedElements.push(
          <blockquote key={i} className="my-3 pl-4 py-1.5 border-l-4 border-brand-500 bg-brand-50/40 dark:bg-slate-800/40 rounded-r-xl text-xs text-slate-600 dark:text-slate-300 italic">
            {renderInlineText(line.trim().replace(/^>\s+/, ''))}
          </blockquote>
        );
      } else if (line.trim().length > 0) {
        renderedElements.push(
          <p key={i} className="my-2.5 text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
            {renderInlineText(line)}
          </p>
        );
      }
    }

    if (inTable) flushTable(lines.length);

    return renderedElements;
  };

  const currentCategoryInfo = HELP_CATEGORIES.find(c => c.id === selectedCategory);

  return (
    <div className={`w-full max-w-7xl mx-auto space-y-8 animate-fade-in ${isNeon ? 'text-white' : 'text-slate-800'}`}>
      
      {/* 1. Bento Header & Hero Search Bar */}
      <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl relative overflow-hidden transition-all ${
        isNeon
          ? 'bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/90 border-slate-800'
          : 'bg-gradient-to-br from-white via-blue-50/40 to-slate-50 border-slate-200'
      }`}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-brand-500/10 text-brand-500 dark:text-cyan-400 border border-brand-500/20">
              <span>📖 Knowledge Base &amp; Manuali</span>
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-cyan-400 animate-pulse"></span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-black tracking-tight">
              Centro Guide, Formule &amp; Documentazione
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Consulta i manuali operativi, gli algoritmi di previsione decennale (MarketForecaster), le normative fiscali 730 e le configurazioni per Home Assistant.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => triggerGeminiChat()}
              className="px-4 py-2.5 rounded-xl font-heading font-bold text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 flex items-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>✨ Chiedi all'Assistente AI</span>
            </button>
            <button
              onClick={() => window.print()}
              className={`px-4 py-2.5 rounded-xl font-heading font-bold text-xs border flex items-center gap-2 transition-all ${
                isNeon ? 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
              }`}
            >
              <span>🖨️ Stampa Documentazione</span>
            </button>
          </div>
        </div>

        {/* Live Search Box */}
        <div className="mt-6 relative z-10">
          <div className={`p-2 rounded-2xl border flex items-center gap-3 shadow-inner transition-all ${
            isNeon ? 'bg-slate-950/80 border-slate-700 focus-within:border-cyan-500' : 'bg-white border-slate-300 focus-within:border-brand-500 ring-2 focus-within:ring-brand-500/20'
          }`}>
            <div className="pl-3 text-slate-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cerca per parole chiave (es. 'Case Verdi', 'Ammortamento Francese', 'ROE', 'Bonus 50%', 'Webhook')..."
              className="w-full bg-transparent border-none outline-none text-xs sm:text-sm font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                className="px-2 py-1 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white"
                title="Azzera ricerca"
              >
                ✕
              </button>
            )}
            <div className="hidden sm:flex items-center gap-1.5 pr-3 text-[11px] text-slate-400 font-mono">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-sans">
                {isMac ? '⌘' : 'Ctrl'}
              </kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-sans">K</kbd>
            </div>
          </div>

          {/* Quick Filter Tag Pills */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Popolari:</span>
            {['Case Verdi', 'Ammortamento Francese', 'ROE', 'ETF World', 'Bonus 50%', 'Cedolare Secca', 'Bonifico Parlante', 'Home Assistant', 'Backup JSON'].map(tag => (
              <button
                key={tag}
                onClick={() => setSearchQuery(tag)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all shrink-0 ${
                  searchQuery.toLowerCase() === tag.toLowerCase()
                    ? 'bg-brand-500 text-white border-brand-500'
                    : isNeon
                    ? 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Bento Category Navigation Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
            selectedCategory === 'ALL'
              ? (isNeon ? 'bg-cyan-950/40 border-cyan-500 shadow-cyan-500/20 shadow-lg' : 'bg-brand-50 border-brand-500 shadow-md')
              : (isNeon ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300')
          }`}
        >
          <div className="text-xl mb-2">📚</div>
          <div>
            <div className="font-heading font-extrabold text-xs sm:text-sm">Tutte le Guide</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{HELP_ARTICLES.length} guide · {HELP_FAQS.length} FAQ</div>
          </div>
        </button>

        {HELP_CATEGORIES.map(cat => {
          const isSelected = selectedCategory === cat.id;
          const artCount = HELP_ARTICLES.filter(a => a.category === cat.id).length;
          const faqCount = HELP_FAQS.filter(f => f.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between group ${
                isSelected
                  ? (isNeon ? 'bg-cyan-950/40 border-cyan-500 shadow-cyan-500/20 shadow-lg' : 'bg-brand-50 border-brand-500 shadow-md')
                  : (isNeon ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300')
              }`}
            >
              <div className="text-xl mb-2 group-hover:scale-110 transition-transform">{cat.icon}</div>
              <div>
                <div className="font-heading font-extrabold text-xs sm:text-sm line-clamp-1">{cat.label}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {artCount} {artCount === 1 ? 'guida' : 'guide'} · {faqCount} FAQ
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Interactive Bento Formula Playground (Mini-Calculators) */}
      <div className={`p-6 sm:p-7 rounded-3xl border shadow-xl relative overflow-hidden ${
        isNeon ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 mb-1">
              <span>⚡ Laboratorio Interattivo Formule</span>
            </div>
            <h2 className="text-lg sm:text-xl font-heading font-black">
              Simulatore Rapido degli Algoritmi Finanziari
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sperimenta in tempo reale le formule matematiche descritte nei manuali: ammortamento mutuo, svalutazione Case Verdi e convenienza fiscale.
            </p>
          </div>

          {/* Playground Tool Tabs */}
          <div className={`p-1 rounded-xl border flex gap-1 self-start sm:self-auto shrink-0 ${
            isNeon ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setActiveToolTab('MORTGAGE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeToolTab === 'MORTGAGE'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              🏦 Mutuo Francese
            </button>
            <button
              onClick={() => setActiveToolTab('GREEN_HOMES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeToolTab === 'GREEN_HOMES'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              🌱 Case Verdi UE
            </button>
            <button
              onClick={() => setActiveToolTab('TAX_COMPARE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeToolTab === 'TAX_COMPARE'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              🧾 Fisco 21% vs 10%
            </button>
          </div>
        </div>

        {/* Tab 1: Mortgage Simulator */}
        {activeToolTab === 'MORTGAGE' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 animate-fade-in">
            <div className="lg:col-span-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Importo Finanziato Mutuo: <span className="text-brand-500 font-extrabold">{eur(calcLoanAmount)}</span>
                </label>
                <input
                  type="range"
                  min="30000"
                  max="500000"
                  step="5000"
                  value={calcLoanAmount}
                  onChange={e => setCalcLoanAmount(Number(e.target.value))}
                  className="w-full accent-brand-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Tasso Annuo Nominale (TAN): <span className="text-brand-500 font-extrabold">{calcRate.toFixed(2)}%</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="7.0"
                  step="0.1"
                  value={calcRate}
                  onChange={e => setCalcRate(Number(e.target.value))}
                  className="w-full accent-brand-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Durata Ammortamento: <span className="text-brand-500 font-extrabold">{calcYears} Anni ({calcYears * 12} rate)</span>
                </label>
                <div className="flex gap-2">
                  {[10, 15, 20, 25, 30].map(y => (
                    <button
                      key={y}
                      onClick={() => setCalcYears(y)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        calcYears === y
                          ? 'bg-brand-500 text-white border-brand-500'
                          : isNeon
                          ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                          : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {y}a
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results Bento Cards */}
            <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className={`p-4 rounded-2xl border ${isNeon ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[11px] font-bold text-slate-400 uppercase">Rata Mensile Costante</div>
                <div className="text-xl sm:text-2xl font-heading font-black text-brand-500 dark:text-cyan-400 mt-1">
                  {eur(mortgageResults.monthly)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Quota capitale + interessi</div>
              </div>

              <div className={`p-4 rounded-2xl border ${isNeon ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[11px] font-bold text-slate-400 uppercase">Totale Interessi Passivi</div>
                <div className="text-xl sm:text-2xl font-heading font-black text-amber-500 mt-1">
                  {eur(mortgageResults.totalInterest)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Detraibili al 19% su 1° casa</div>
              </div>

              <div className={`p-4 rounded-2xl border ${isNeon ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[11px] font-bold text-slate-400 uppercase">Montante Totale Dovuto</div>
                <div className="text-xl sm:text-2xl font-heading font-black text-slate-800 dark:text-slate-100 mt-1">
                  {eur(mortgageResults.totalPaid)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Capitale + Interessi</div>
              </div>

              <div className={`col-span-2 sm:col-span-3 p-4 rounded-2xl border ${isNeon ? 'bg-slate-950/40 border-slate-800' : 'bg-blue-50/50 border-blue-100'}`}>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Evoluzione del Debito Residuo e Capitale Rimborsato:</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Dopo {mortgageResults.y1} Anni</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-sm block">{eur(mortgageResults.debtY1)}</span>
                    <span className="text-[10px] text-emerald-500 block font-semibold">+{eur(mortgageResults.amortizedY1)} equità</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Dopo {mortgageResults.y2} Anni</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-sm block">{eur(mortgageResults.debtY2)}</span>
                    <span className="text-[10px] text-emerald-500 block font-semibold">+{eur(mortgageResults.amortizedY2)} equità</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">A Scadenza ({mortgageResults.y3}a)</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm block">0 € (Estinto)</span>
                    <span className="text-[10px] text-emerald-500 block font-semibold">+{eur(mortgageResults.amortizedY3)} 100% equità</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Green Homes EU Simulator */}
        {activeToolTab === 'GREEN_HOMES' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 animate-fade-in">
            <div className="lg:col-span-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Valore Immobile Stimato: <span className="text-emerald-500 font-extrabold">{eur(calcPropertyValue)}</span>
                </label>
                <input
                  type="range"
                  min="80000"
                  max="600000"
                  step="10000"
                  value={calcPropertyValue}
                  onChange={e => setCalcPropertyValue(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                  Classe Energetica Attuale (Direttiva EPBD):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setCalcEnergyClass('AB')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      calcEnergyClass === 'AB'
                        ? 'bg-emerald-500 text-white border-emerald-500 font-bold shadow-md'
                        : isNeon ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="text-sm font-black">Classe A / B</div>
                    <div className="text-[10px] opacity-80">+1.5% annuo</div>
                  </button>

                  <button
                    onClick={() => setCalcEnergyClass('CD')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      calcEnergyClass === 'CD'
                        ? 'bg-brand-500 text-white border-brand-500 font-bold shadow-md'
                        : isNeon ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="text-sm font-black">Classe C / D</div>
                    <div className="text-[10px] opacity-80">Neutro (0.0%)</div>
                  </button>

                  <button
                    onClick={() => setCalcEnergyClass('EFG')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      calcEnergyClass === 'EFG'
                        ? 'bg-rose-500 text-white border-rose-500 font-bold shadow-md'
                        : isNeon ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="text-sm font-black">Classe E / F / G</div>
                    <div className="text-[10px] opacity-80">-2.0% annuo</div>
                  </button>
                </div>
              </div>
            </div>

            {/* Case Verdi Results */}
            <div className="lg:col-span-7 grid grid-cols-2 gap-3">
              <div className={`p-4 rounded-2xl border ${isNeon ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[11px] font-bold text-slate-400 uppercase">Valore Proiettato a 5 Anni</div>
                <div className="text-2xl font-heading font-black mt-1 text-slate-800 dark:text-slate-100">
                  {eur(greenHomesResults.adjustedY5)}
                </div>
                <div className={`text-[11px] font-bold mt-1 ${greenHomesResults.diffY5 > 0 ? 'text-emerald-500' : greenHomesResults.diffY5 < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                  {greenHomesResults.diffY5 > 0 ? `+${eur(greenHomesResults.diffY5)}` : eur(greenHomesResults.diffY5)} rispetto al mercato neutro
                </div>
              </div>

              <div className={`p-4 rounded-2xl border ${isNeon ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[11px] font-bold text-slate-400 uppercase">Valore Proiettato a 10 Anni</div>
                <div className="text-2xl font-heading font-black mt-1 text-slate-800 dark:text-slate-100">
                  {eur(greenHomesResults.adjustedY10)}
                </div>
                <div className={`text-[11px] font-bold mt-1 ${greenHomesResults.diffY10 > 0 ? 'text-emerald-500' : greenHomesResults.diffY10 < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                  {greenHomesResults.diffY10 > 0 ? `+${eur(greenHomesResults.diffY10)}` : eur(greenHomesResults.diffY10)} di differenziale UE
                </div>
              </div>

              <div className={`col-span-2 p-4 rounded-2xl border ${isNeon ? 'bg-slate-950/40 border-slate-800' : 'bg-emerald-50/50 border-emerald-200'}`}>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  <span>💡 Verdetto del Simulatore:</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-black ${calcEnergyClass === 'AB' ? 'bg-emerald-500/20 text-emerald-600' : calcEnergyClass === 'EFG' ? 'bg-rose-500/20 text-rose-600' : 'bg-slate-200 text-slate-700'}`}>
                    {greenHomesResults.label}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {calcEnergyClass === 'EFG'
                    ? `Attenzione: l'immobile in classe energetica sfavorevole accumula in 10 anni una penalizzazione stimata di ben ${eur(Math.abs(greenHomesResults.diffY10))}. Investire in un intervento di efficientamento energetico (pompa di calore e serramenti con detrazione Ecobonus 65%) protegge il valore del capitale.`
                    : calcEnergyClass === 'AB'
                    ? `Ottima performance: l'immobile green ad alta efficienza beneficia dell'apprezzamento premiante del mercato (+1.5% annuo), generando un surplus patrimoniale di ${eur(greenHomesResults.diffY10)} a 10 anni rispetto a un immobile energivoro.`
                    : 'Performance neutra: l\'immobile in classe C o D non subisce svalutazioni immediate da "Brown Discount", ma richiederà interventi manutentivi nei prossimi cicli.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Tax Regime Comparison */}
        {activeToolTab === 'TAX_COMPARE' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 animate-fade-in">
            <div className="lg:col-span-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Canone Mensile di Locazione: <span className="text-purple-500 font-extrabold">{eur(calcMonthlyRent)}/mese</span>
                </label>
                <input
                  type="range"
                  min="400"
                  max="3000"
                  step="50"
                  value={calcMonthlyRent}
                  onChange={e => setCalcMonthlyRent(Number(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <span className="text-[11px] text-slate-400">Canone Annuo Lordo: {eur(taxResults.annualRent)}</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Scaglione IRPEF Marginale Proprietario:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[23, 35, 43].map(pct => (
                    <button
                      key={pct}
                      onClick={() => setCalcIrpefBracket(pct)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        calcIrpefBracket === pct
                          ? 'bg-purple-600 text-white border-purple-600 font-bold shadow-md'
                          : isNeon ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="text-sm font-black">{pct}%</div>
                      <div className="text-[10px] opacity-80">IRPEF</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tax Comparison Results */}
            <div className="lg:col-span-7 grid grid-cols-3 gap-2 sm:gap-3">
              <div className={`p-3.5 rounded-2xl border ${isNeon ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Cedolare 10% (3+2)</span>
                <div className="text-lg sm:text-xl font-heading font-black text-emerald-500 mt-1">
                  {eur(taxResults.netCedolare10)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Tasse: {eur(taxResults.taxCedolare10)}/anno</div>
                <div className="mt-2 text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold rounded">
                  + Sconto 25% IMU
                </div>
              </div>

              <div className={`p-3.5 rounded-2xl border ${isNeon ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Cedolare 21% (4+4)</span>
                <div className="text-lg sm:text-xl font-heading font-black text-brand-500 mt-1">
                  {eur(taxResults.netCedolare21)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Tasse: {eur(taxResults.taxCedolare21)}/anno</div>
                <div className="mt-2 text-[10px] px-1.5 py-0.5 bg-brand-500/10 text-brand-600 dark:text-cyan-400 font-bold rounded">
                  Canone di mercato
                </div>
              </div>

              <div className={`p-3.5 rounded-2xl border ${isNeon ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">IRPEF Ordinaria</span>
                <div className="text-lg sm:text-xl font-heading font-black text-rose-500 mt-1">
                  {eur(taxResults.netIrpef)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Tasse: {eur(taxResults.taxIrpef)}/anno</div>
                <div className="mt-2 text-[10px] px-1.5 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold rounded">
                  Detraibile con 730
                </div>
              </div>

              <div className={`col-span-3 p-3.5 rounded-2xl border ${isNeon ? 'bg-slate-950/40 border-slate-800' : 'bg-purple-50/50 border-purple-100'}`}>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  <strong>Risparmio fiscale:</strong> con il Canone Concordato (10%) risparmi{' '}
                  <span className="text-emerald-500 font-bold">{eur(taxResults.saving10vs21)}/anno</span> rispetto alla Cedolare al 21%, e{' '}
                  <span className="text-emerald-500 font-bold">{eur(taxResults.taxIrpef - taxResults.taxCedolare10)}/anno</span> rispetto al regime IRPEF.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Articles Grid Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-heading font-black tracking-tight">
              {currentCategoryInfo ? `${currentCategoryInfo.icon} ${currentCategoryInfo.label}` : 'Tutte le Guide & Manuali'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {filteredArticles.length} {filteredArticles.length === 1 ? 'articolo disponibile' : 'articoli disponibili'}
              {searchQuery && ` per la ricerca "${searchQuery}"`}
            </p>
          </div>

          {selectedCategory === 'FAQ_TROUBLESHOOTING' && (
            <a
              href="#faq-section"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-500 dark:text-cyan-400 hover:underline"
            >
              <span>Vai alle Domande Frequenti FAQ ↓</span>
            </a>
          )}
        </div>

        {filteredArticles.length === 0 ? (
          <div className={`p-8 rounded-3xl border text-center space-y-3 ${isNeon ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="text-3xl">🔍</div>
            <h3 className="font-heading font-bold text-sm">Nessuna guida trovata per i criteri specificati</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Prova a cercare con un termine diverso oppure seleziona "Tutte le Guide" per visualizzare l'elenco completo.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('ALL'); }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-500 text-white hover:bg-brand-600 transition-colors"
            >
              Azzera Filtri
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredArticles.map(article => {
              const cat = HELP_CATEGORIES.find(c => c.id === article.category);
              return (
                <div
                  key={article.id}
                  onClick={() => setActiveArticle(article)}
                  className={`p-5 rounded-3xl border shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
                    article.featured
                      ? (isNeon ? 'bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border-cyan-500/40 hover:border-cyan-400' : 'bg-gradient-to-b from-white to-blue-50/30 border-brand-200 hover:border-brand-400')
                      : (isNeon ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300')
                  }`}
                >
                  {article.featured && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-500 text-white">
                      In Evidenza
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{cat?.icon || '📄'}</span>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        {cat?.label || article.category}
                      </span>
                    </div>

                    <h3 className="font-heading font-extrabold text-sm sm:text-base leading-snug group-hover:text-brand-500 dark:group-hover:text-cyan-400 transition-colors">
                      {article.title}
                    </h3>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                      {article.summary}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">⏱️ {article.readTimeMinutes || 5} min</span>
                    </div>
                    <span className="font-heading font-bold text-brand-500 dark:text-cyan-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Leggi guida →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Home Assistant Quick Config Bento Card */}
      <div className={`p-6 sm:p-7 rounded-3xl border shadow-xl relative overflow-hidden ${
        isNeon ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
              <span>🤖 Snippet Rapido Home Assistant</span>
            </div>
            <h3 className="text-lg font-heading font-black">Configurazione Sensori REST per Lovelace</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Incolla questo blocco nel tuo <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">configuration.yaml</code> per monitorare il cashflow in tempo reale.
            </p>
          </div>

          <button
            onClick={() => copyToClipboard(`sensor:
  - platform: rest
    name: "ImmoPlan Valore Patrimonio"
    resource: "http://localhost:3000/api/properties/summary"
    value_template: "{{ value_json.totalEstimatedValue }}"
    unit_of_measurement: "EUR"
    device_class: monetary
    scan_interval: 3600
  - platform: rest
    name: "ImmoPlan Cash Flow Mensile"
    resource: "http://localhost:3000/api/properties/summary"
    value_template: "{{ value_json.monthlyNetCashflow }}"
    unit_of_measurement: "EUR"
    device_class: monetary
    scan_interval: 1800`, 'ha_quick_yaml')}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 shrink-0 transition-colors shadow-md"
          >
            {copiedCodeKey === 'ha_quick_yaml' ? '✓ Copiato!' : '📋 Copia Codice YAML'}
          </button>
        </div>
      </div>

      {/* 6. Interactive FAQ Accordion Section */}
      <div id="faq-section" className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-6 ${
        isNeon ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20 mb-1">
              <span>❓ Domande Frequenti</span>
            </div>
            <h2 className="text-xl font-heading font-black tracking-tight">FAQ &amp; Risoluzione Problemi Rapida</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Risposte immediate alle domande ricorrenti su calcoli, privacy, backup e configurazioni ({filteredFaqs.length} FAQ attive).
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setActiveFaqId(activeFaqId ? null : (filteredFaqs[0]?.id || null))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                isNeon ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              }`}
            >
              {activeFaqId ? 'Comprimi tutte' : 'Espandi prima'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {filteredFaqs.map(faq => {
            const isOpen = activeFaqId === faq.id;
            return (
              <div
                key={faq.id}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  isOpen
                    ? (isNeon ? 'bg-slate-950/70 border-cyan-500/50 shadow-md' : 'bg-blue-50/30 border-brand-300 shadow-sm')
                    : (isNeon ? 'bg-slate-900/40 border-slate-800 hover:border-slate-700' : 'bg-slate-50/50 border-slate-200 hover:border-slate-300')
                }`}
              >
                <button
                  onClick={() => setActiveFaqId(isOpen ? null : faq.id)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-heading font-bold text-xs sm:text-sm"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-brand-500 dark:text-cyan-400 shrink-0 font-extrabold text-sm sm:text-base">Q.</span>
                    <span>{faq.question}</span>
                  </span>
                  <span className={`transform transition-transform text-slate-400 text-lg ${isOpen ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </button>

                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 animate-fade-in">
                    <p className="mt-2">{faq.answer}</p>
                    {faq.tags && faq.tags.length > 0 && (
                      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                        {faq.tags.map(t => (
                          <span key={t} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 7. Slide-over / Modal Reader for Selected Article */}
      {activeArticle && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-fade-in no-print"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveArticle(null);
          }}
        >
          <div className={`w-full max-w-4xl max-h-[90vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden animate-scale-up ${
            isNeon ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-slate-800 border-slate-200'
          }`}>
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/40">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-500/10 text-brand-500 dark:text-cyan-400">
                    {HELP_CATEGORIES.find(c => c.id === activeArticle.category)?.label || activeArticle.category}
                  </span>
                  <span className="text-xs text-slate-400">⏱️ {activeArticle.readTimeMinutes || 5} min di lettura</span>
                </div>
                <h2 className="text-lg sm:text-2xl font-heading font-black leading-snug">
                  {activeArticle.title}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-2 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                  title="Stampa guida"
                >
                  🖨️
                </button>
                <button
                  onClick={() => setActiveArticle(null)}
                  className="p-2 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors font-bold"
                  title="Chiudi guida (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Article Content */}
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm">
              <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-slate-950/60 border border-blue-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                {activeArticle.summary}
              </div>

              <div className="prose dark:prose-invert max-w-none">
                {renderFormattedContent(activeArticle.content)}
              </div>

              {/* Related Articles Section */}
              {activeArticle.relatedArticleIds && activeArticle.relatedArticleIds.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Guide correlate consigliate:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeArticle.relatedArticleIds.map(relId => {
                      const relArticle = HELP_ARTICLES.find(a => a.id === relId);
                      if (!relArticle) return null;
                      return (
                        <button
                          key={relId}
                          onClick={() => setActiveArticle(relArticle)}
                          className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-3 group ${
                            isNeon ? 'bg-slate-950/60 border-slate-800 hover:border-cyan-500/50' : 'bg-slate-50 border-slate-200 hover:border-brand-400'
                          }`}
                        >
                          <span className="text-lg">📄</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-heading font-bold text-xs group-hover:text-brand-500 dark:group-hover:text-cyan-400 truncate">
                              {relArticle.title}
                            </div>
                            <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                              {relArticle.summary}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Argomenti correlati:</span>
                {activeArticle.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => triggerGeminiChat(`Ho una domanda specifica sulla guida "${activeArticle.title}". Puoi spiegarmela in dettaglio applicandola ai miei immobili?`)}
                className="px-4 py-2.5 rounded-xl font-heading font-bold text-xs bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center gap-2 hover:opacity-95 transition-opacity"
              >
                <span>✨ Chiedi chiarimenti all'AI su questa guida</span>
              </button>

              <button
                onClick={() => setActiveArticle(null)}
                className="px-5 py-2.5 rounded-xl font-heading font-bold text-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
