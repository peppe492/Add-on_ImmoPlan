import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/dbService';
import { Deadline, Property, FinancialData, Scenario, CostDetail, RenovationItem, RecurringCost, RentalRecord } from '../types';

// Helper per formattare una Date locale in YYYY-MM-DD senza shift di fuso orario UTC
const toLocalDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Helper per formattare data YYYY-MM-DD in visualizzazione italiana DD/MM/YYYY
const formatItalianDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

// Helper per estrarre il giorno del mese da stringa di data in modo sicuro
const extractDay = (dateStr?: string, defaultDay = 1): number => {
  if (!dateStr) return defaultDay;
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return parseInt(parts[2]) || defaultDay;
  }
  if (parts.length === 2) {
    return parseInt(parts[1]) || defaultDay;
  }
  const m = dateStr.match(/\b([1-9]|[12]\d|3[01])\b/);
  return m ? parseInt(m[1]) : defaultDay;
};

// Pulizia nome immobile per confronto intelligente
const cleanName = (s?: string): string => {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/progetto demo:?/gi, '')
    .replace(/progetto:?/gi, '')
    .replace(/immobile:?/gi, '')
    .replace(/scenario:?/gi, '')
    .replace(/acquisto:?/gi, '')
    .replace(/ristrutturazione:?/gi, '')
    .replace(/lavori:?/gi, '')
    .replace(/preventivo:?/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .trim();
};

const STOP_WORDS = new Set([
  'via', 'viale', 'corso', 'piazza', 'strada', 'vicolo', 'largo',
  'bilocale', 'trilocale', 'monolocale', 'quadrilocale', 'pentalocale', 'loft', 'villa', 'casa', 'appartamento',
  'demo', 'progetto', 'scenario', 'bozza', 'acquisto', 'ristrutturazione', 'nuovo', 'nuova',
  'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una'
]);

const getSignificantTokens = (s?: string): string[] => {
  if (!s) return [];
  const cleaned = cleanName(s);
  return cleaned
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
};

// Trova l'immobile corrispondente a un set di dati finanziari (config o scenario)
const findPropertyForFinancialData = (
  props: Property[],
  finData: FinancialData,
  scenarioName?: string,
  scenarioPropertyId?: string
): Property | undefined => {
  if (!props || props.length === 0 || !finData) return undefined;

  // 1. Corrispondenza esplicita su propertyId
  const explicitId = (finData as any).propertyId || (finData as any).targetPropertyId || scenarioPropertyId;
  if (explicitId) {
    const matched = props.find(p => p.id === explicitId);
    if (matched) return matched;
  }

  // 2. Corrispondenza per nome esatto pulito
  const namesToTry = [finData.propertyName, scenarioName].filter(Boolean) as string[];
  for (const raw of namesToTry) {
    const targetClean = cleanName(raw);
    if (!targetClean) continue;

    const exact = props.find(p => cleanName(p.name) === targetClean);
    if (exact) return exact;
  }

  // 3. Corrispondenza per inclusione o sottostringa
  for (const raw of namesToTry) {
    const targetClean = cleanName(raw);
    if (!targetClean) continue;

    const included = props.find(p => {
      const pClean = cleanName(p.name);
      return pClean && (targetClean.includes(pClean) || pClean.includes(targetClean));
    });
    if (included) return included;
  }

  // 4. Corrispondenza per token / parole chiave significative (es. "Navigli", "Garibaldi", "Roma", ecc.)
  for (const raw of namesToTry) {
    const targetTokens = getSignificantTokens(raw);
    if (targetTokens.length === 0) continue;

    for (const prop of props) {
      const propTokens = getSignificantTokens(prop.name);
      const hasCommonToken = targetTokens.some(t => propTokens.includes(t));
      if (hasCommonToken) return prop;
    }
  }

  // 5. Se esiste un unico immobile a sistema, qualsiasi spesa appartiene ad esso
  if (props.length === 1) {
    return props[0];
  }

  return undefined;
};

export const CalendarManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Database states
  const [properties, setProperties] = useState<Property[]>([]);
  const [config, setConfig] = useState<FinancialData | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [manualDeadlines, setManualDeadlines] = useState<Deadline[]>([]);
  const [rentalRecords, setRentalRecords] = useState<RentalRecord[]>([]);

  // Filtro immobile selezionato
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string>('ALL');

  // Gestione pannello collegamento scenari
  const [showScenarioLinker, setShowScenarioLinker] = useState(false);

  // Form state per nuova scadenza manuale
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<Deadline['type']>('CUSTOM');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [formPropertyId, setFormPropertyId] = useState<string>('');

  const propertyColors = [
    'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
    'bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30',
    'bg-teal-500/20 text-teal-700 dark:text-teal-400 border-teal-500/30',
    'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
    'bg-pink-500/20 text-pink-700 dark:text-pink-400 border-pink-500/30',
    'bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
    'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
  ];

  const propertyColorMap = useMemo(() => {
    const map = new Map<string, string>();
    properties.forEach((p, index) => {
      map.set(p.id, propertyColors[index % propertyColors.length]);
    });
    return map;
  }, [properties]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [props, appConfig, allScenarios, dbDeadlines, dbRecords] = await Promise.all([
        db.getProperties().then(r => r || []),
        db.getAppData(),
        db.getScenarios().then(r => r || []),
        db.getDeadlines().then(r => r || []),
        db.getRentalRecords().then(r => r || [])
      ]);
      setProperties(props);
      setConfig(appConfig);
      setScenarios(allScenarios);
      setManualDeadlines(dbDeadlines);
      setRentalRecords(dbRecords);
    } catch (e) {
      console.error('Errore nel caricamento dati calendario:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Collega uno scenario ad un immobile
  const handleLinkScenario = async (scenarioId: string, propertyId: string) => {
    const scn = scenarios.find(s => s.id === scenarioId);
    if (!scn) return;
    const targetProp = properties.find(p => p.id === propertyId);
    const updated: Scenario = {
      ...scn,
      propertyId: propertyId || undefined,
      data: {
        ...scn.data,
        propertyId: propertyId || undefined,
        propertyName: targetProp ? targetProp.name : scn.data.propertyName
      }
    };
    await db.saveScenario(updated);
    setScenarios(prev => prev.map(s => s.id === scenarioId ? updated : s));
  };

  // Collega il config corrente ad un immobile
  const handleLinkConfig = async (propertyId: string) => {
    if (!config) return;
    const targetProp = properties.find(p => p.id === propertyId);
    const updated: FinancialData = {
      ...config,
      propertyId: propertyId || undefined,
      propertyName: targetProp ? targetProp.name : config.propertyName
    };
    await db.saveAppData(updated);
    setConfig(updated);
  };

  // Generazione automatica scadenze da:
  // 1. Costi di acquisto (caparra, saldo, notaio, agenzia, imposte, altre spese o prezzo acquisto)
  // 2. Costi di ristrutturazione (progettazione, lavori, materiali, o spese straordinarie)
  // 3. Scheda economica immobile: Mutuo, Affitto, Spese condominiali, Costi ricorrenti (mensili, annuali, una tantum)
  const autoDeadlines = useMemo(() => {
    const auto: Deadline[] = [];
    const today = new Date();
    const todayStr = toLocalDateStr(today);

    // Costruzione orizzonte temporale mesi per ricorrenze (mutuo, affitto, condominio, costi ricorrenti)
    // Copre da 12 mesi fa a 24 mesi avanti attorno a oggi, più il mese correntemente visualizzato
    const monthsSet = new Set<string>();
    const monthsToGenerate: { year: number; month: number }[] = [];

    const addMonth = (y: number, m: number) => {
      const key = `${y}-${m}`;
      if (!monthsSet.has(key)) {
        monthsSet.add(key);
        monthsToGenerate.push({ year: y, month: m });
      }
    };

    // Range attorno a oggi (-12 a +24 mesi)
    for (let i = -12; i <= 24; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      addMonth(d.getFullYear(), d.getMonth());
    }

    // Range attorno alla data visualizzata nel calendario (-6 a +6 mesi)
    for (let i = -6; i <= 6; i++) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      addMonth(d.getFullYear(), d.getMonth());
    }

    // Raccogli tutti i dataset finanziari (config attivo + scenari salvati)
    interface FinDataset {
      id: string;
      finData: FinancialData;
      scenarioName?: string;
      scenarioPropertyId?: string;
      isCurrent: boolean;
    }
    const datasets: FinDataset[] = [];
    if (config) {
      datasets.push({
        id: 'config_current',
        finData: config,
        scenarioName: undefined,
        scenarioPropertyId: config.propertyId,
        isCurrent: true
      });
    }
    scenarios.forEach(s => {
      if (s.data) {
        const isDuplicate = config && cleanName(s.data.propertyName) === cleanName(config.propertyName);
        if (!isDuplicate) {
          datasets.push({
            id: s.id,
            finData: s.data,
            scenarioName: s.name,
            scenarioPropertyId: s.propertyId,
            isCurrent: false
          });
        }
      }
    });

    // Traccia scadenze già generate per evitare duplicati
    const generatedIds = new Set<string>();

    // Traccia quali immobili hanno già un set dettagliato di spese di acquisto e ristrutturazione
    const propertiesWithDetailedPurchase = new Set<string>();
    const propertiesWithDetailedRenovation = new Set<string>();

    // ------------------------------------------------------------------------------------
    // SEZIONE 1: Costi di Acquisto e Ristrutturazione da config e scenari
    // ------------------------------------------------------------------------------------
    datasets.forEach(({ finData, scenarioName, scenarioPropertyId }) => {
      const matchedProp = findPropertyForFinancialData(properties, finData, scenarioName, scenarioPropertyId);
      const propId = matchedProp ? matchedProp.id : undefined;
      const propName = matchedProp ? matchedProp.name : (finData.propertyName || 'Acquisto');

      if (propId) {
        propertiesWithDetailedPurchase.add(propId);
      }

      // 1A. Costi di Acquisto
      if (finData.purchaseCosts) {
        const purchaseLabels: Record<string, string> = {
          deposit: 'Caparra / Anticipo',
          balance: 'Saldo al Rogito',
          notary: 'Notaio',
          agency: 'Agenzia Immobiliare',
          taxes: 'Imposte di Registro',
          other: 'Altre Spese Acquisto'
        };

        (Object.keys(purchaseLabels) as (keyof typeof finData.purchaseCosts)[]).forEach(key => {
          const detail = finData.purchaseCosts[key] as CostDetail | undefined;
          if (detail && detail.amount && detail.amount > 0) {
            const dateVal =
              (detail.paymentDate ? detail.paymentDate.split('T')[0] : '') ||
              (detail.assignments?.find(a => a.date && a.amount > 0)?.date?.split('T')[0] || '') ||
              (detail.payments?.find(p => p.date && p.amount > 0)?.date?.split('T')[0] || '') ||
              (matchedProp?.purchaseDate ? matchedProp.purchaseDate.split('T')[0] : '') ||
              todayStr;

            const isPaid = Boolean(detail.isPaid || (detail.paidAmount && detail.paidAmount >= detail.amount));
            const id = propId
              ? `auto_purch_${propId}_${key}`
              : `auto_purch_global_${key}_${cleanName(finData.propertyName)}`;

            if (!generatedIds.has(id)) {
              generatedIds.add(id);
              auto.push({
                id,
                title: `${propName}: Acquisto - ${purchaseLabels[key]}`,
                date: dateVal,
                type: key === 'taxes' ? 'TAX' : 'CONTRACT',
                amount: detail.amount,
                isCompleted: isPaid,
                propertyId: propId,
                notes: `Scadenza da Costi di Acquisto (${purchaseLabels[key]})`
              });
            }
          }
        });
      }

      // 1B. Eventuali pagamenti specifici sull'immobile (propertyPayments)
      if (Array.isArray(finData.propertyPayments)) {
        finData.propertyPayments.forEach((p: RenovationItem) => {
          if (p && p.amount && p.amount > 0) {
            const dateVal =
              (p.paymentDate ? p.paymentDate.split('T')[0] : '') ||
              (p.assignments?.find(a => a.date)?.date?.split('T')[0] || '') ||
              (matchedProp?.purchaseDate ? matchedProp.purchaseDate.split('T')[0] : '') ||
              todayStr;

            const isPaid = Boolean(p.isPaid || (p.paidAmount && p.paidAmount >= p.amount));
            const id = propId
              ? `auto_proppay_${propId}_${p.id}`
              : `auto_proppay_global_${p.id}`;

            if (!generatedIds.has(id)) {
              generatedIds.add(id);
              auto.push({
                id,
                title: `${propName}: Acquisto - ${p.description || 'Rata Immobile'}`,
                date: dateVal,
                type: 'CONTRACT',
                amount: p.amount,
                isCompleted: isPaid,
                propertyId: propId,
                notes: 'Scadenza Pagamento Immobile'
              });
            }
          }
        });
      }

      // 1C. Costi di Ristrutturazione
      if (finData.renovationCosts) {
        const r = finData.renovationCosts;
        let hasRenovItems = false;

        // Progettazione & Tecnici
        const designDetail = typeof r.design === 'object' ? r.design : (r.design ? { amount: Number(r.design), isPaid: false } as CostDetail : null);
        if (designDetail && designDetail.amount && designDetail.amount > 0) {
          hasRenovItems = true;
          const dateVal =
            (designDetail.paymentDate ? designDetail.paymentDate.split('T')[0] : '') ||
            (designDetail.assignments?.find(a => a.date)?.date?.split('T')[0] || '') ||
            (matchedProp?.purchaseDate ? matchedProp.purchaseDate.split('T')[0] : '') ||
            todayStr;

          const isPaid = Boolean(designDetail.isPaid || (designDetail.paidAmount && designDetail.paidAmount >= designDetail.amount));
          const id = propId
            ? `auto_renov_${propId}_design`
            : `auto_renov_global_design_${cleanName(finData.propertyName)}`;

          if (!generatedIds.has(id)) {
            generatedIds.add(id);
            auto.push({
              id,
              title: `${propName}: Ristrutturazione - Progettazione & Tecnici`,
              date: dateVal,
              type: 'MAINTENANCE',
              amount: designDetail.amount,
              isCompleted: isPaid,
              propertyId: propId,
              notes: 'Scadenza da Costi Ristrutturazione (Progettazione)'
            });
          }
        }

        // Lavori & Impianti (worksBreakdown)
        if (Array.isArray(r.worksBreakdown)) {
          r.worksBreakdown.forEach((w: RenovationItem) => {
            if (w && w.amount && w.amount > 0) {
              hasRenovItems = true;
              const dateVal =
                (w.paymentDate ? w.paymentDate.split('T')[0] : '') ||
                (w.assignments?.find(a => a.date)?.date?.split('T')[0] || '') ||
                (matchedProp?.purchaseDate ? matchedProp.purchaseDate.split('T')[0] : '') ||
                todayStr;

              const isPaid = Boolean(w.isPaid || (w.paidAmount && w.paidAmount >= w.amount));
              const id = propId
                ? `auto_renov_w_${propId}_${w.id}`
                : `auto_renov_w_global_${w.id}`;

              if (!generatedIds.has(id)) {
                generatedIds.add(id);
                auto.push({
                  id,
                  title: `${propName}: Lavori - ${w.description || 'Lavori'}`,
                  date: dateVal,
                  type: 'MAINTENANCE',
                  amount: w.amount,
                  isCompleted: isPaid,
                  propertyId: propId,
                  notes: 'Scadenza da Lavori di Ristrutturazione'
                });
              }
            }
          });
        }

        // Materiali & Finiture (materialsBreakdown)
        if (Array.isArray(r.materialsBreakdown)) {
          r.materialsBreakdown.forEach((m: RenovationItem) => {
            if (m && m.amount && m.amount > 0) {
              hasRenovItems = true;
              const dateVal =
                (m.paymentDate ? m.paymentDate.split('T')[0] : '') ||
                (m.assignments?.find(a => a.date)?.date?.split('T')[0] || '') ||
                (matchedProp?.purchaseDate ? matchedProp.purchaseDate.split('T')[0] : '') ||
                todayStr;

              const isPaid = Boolean(m.isPaid || (m.paidAmount && m.paidAmount >= m.amount));
              const id = propId
                ? `auto_renov_m_${propId}_${m.id}`
                : `auto_renov_m_global_${m.id}`;

              if (!generatedIds.has(id)) {
                generatedIds.add(id);
                auto.push({
                  id,
                  title: `${propName}: Materiali - ${m.description || 'Materiali'}`,
                  date: dateVal,
                  type: 'MAINTENANCE',
                  amount: m.amount,
                  isCompleted: isPaid,
                  propertyId: propId,
                  notes: 'Scadenza da Materiali di Ristrutturazione'
                });
              }
            }
          });
        }

        if (hasRenovItems && propId) {
          propertiesWithDetailedRenovation.add(propId);
        }
      }
    });

    // ------------------------------------------------------------------------------------
    // SEZIONE 2: Scheda Economica & Dati Finanziari per ciascun singolo Immobile
    // (Prezzo Acquisto se non dettagliato, Mutuo, Affitto, Spese Condominiali, Ricorrenti, Una Tantum)
    // ------------------------------------------------------------------------------------
    properties.forEach(prop => {
      // 2A. Spese di Acquisto direttamente dall'Anagrafica dell'immobile se non dettagliate in uno scenario
      if (!propertiesWithDetailedPurchase.has(prop.id) && prop.purchasePrice && prop.purchasePrice > 0) {
        const purchDate = (prop.purchaseDate ? prop.purchaseDate.split('T')[0] : '') || todayStr;
        const initialInv = prop.financials?.initialInvestment || 0;
        const balancePrice = initialInv > 0 && initialInv < prop.purchasePrice ? prop.purchasePrice - initialInv : prop.purchasePrice;

        // Saldo / Rogito Acquisto
        const balanceId = `auto_purch_prop_${prop.id}_balance`;
        if (!generatedIds.has(balanceId)) {
          generatedIds.add(balanceId);
          auto.push({
            id: balanceId,
            title: `${prop.name}: Acquisto - Saldo al Rogito`,
            date: purchDate,
            type: 'CONTRACT',
            amount: balancePrice,
            isCompleted: purchDate < todayStr, // Se nel passato si presume perfezionato
            propertyId: prop.id,
            notes: 'Spesa di acquisto da Prezzo di Compravendita immobile'
          });
        }

        // Eventuale Anticipo / Capitale Iniziale
        if (initialInv > 0) {
          const depositId = `auto_purch_prop_${prop.id}_deposit`;
          if (!generatedIds.has(depositId)) {
            generatedIds.add(depositId);
            auto.push({
              id: depositId,
              title: `${prop.name}: Acquisto - Anticipo / Spese Iniziali`,
              date: purchDate,
              type: 'CONTRACT',
              amount: initialInv,
              isCompleted: purchDate <= todayStr,
              propertyId: prop.id,
              notes: 'Anticipo e spese iniziali da Scheda Economica Immobile'
            });
          }
        }
      }

      // 2B. Eventuali Affitti (Canone di locazione mensile)
      const hasRent = prop.financials && prop.financials.monthlyRent && prop.financials.monthlyRent > 0;
      const isRentedStatus = prop.status === 'RENTED' || Boolean(prop.currentTenantId);
      // Se lo stato è RENTED, o ha un inquilino collegato, o ha un canone di locazione attivo
      if (hasRent && (isRentedStatus || (prop.status !== 'EMPTY' && prop.status !== 'MAIN_RESIDENCE'))) {
        monthsToGenerate.forEach(({ year, month }) => {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-05`;
          const id = `auto_rent_${prop.id}_${dateStr}`;
          if (!generatedIds.has(id)) {
            generatedIds.add(id);
            // Verifica se questo affitto è già stato saldato/registrato nel registro affitti
            const isRecorded = rentalRecords.some(r =>
              r.propertyId === prop.id &&
              r.year === year &&
              r.month === month &&
              (r.income || 0) > 0
            );

            auto.push({
              id,
              title: `${prop.name}: Canone Affitto`,
              date: dateStr,
              type: 'RENT',
              amount: prop.financials!.monthlyRent,
              isCompleted: isRecorded,
              propertyId: prop.id,
              notes: isRecorded ? 'Canone saldato e registrato in Gestione Affitti' : 'Scadenza mensile da Scheda Economica (Affitto)'
            });
          }
        });
      }

      // 2C. Spese Condominiali mensili
      if (prop.financials && prop.financials.condoFees && prop.financials.condoFees > 0) {
        const hasCondoInRecurring = prop.recurringCosts?.some(c =>
          c.category === 'MAINTENANCE' && c.name?.toLowerCase().includes('condomin')
        );
        if (!hasCondoInRecurring) {
          monthsToGenerate.forEach(({ year, month }) => {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-10`;
            const id = `auto_condo_${prop.id}_${dateStr}`;
            if (!generatedIds.has(id)) {
              generatedIds.add(id);
              auto.push({
                id,
                title: `${prop.name}: Spese Condominiali`,
                date: dateStr,
                type: 'MAINTENANCE',
                amount: prop.financials!.condoFees,
                isCompleted: false,
                propertyId: prop.id,
                notes: 'Scadenza mensile da Scheda Economica (Condominio)'
              });
            }
          });
        }
      }

      // 2D. Rata Mensile Mutuo
      if (prop.financials && prop.financials.mortgageAmount && prop.financials.mortgageAmount > 0) {
        const hasExplicitMortgage = prop.recurringCosts?.some(c => c.category === 'MORTGAGE');
        if (!hasExplicitMortgage) {
          const monthly = prop.financials.mortgageAmount;
          const durationYears = prop.financials.mortgageDuration || 20;

          let startYear = 2020;
          let startMonth = 0;
          let day = 1;

          if (prop.financials.mortgageStartDate) {
            const parts = prop.financials.mortgageStartDate.split('-');
            if (parts.length >= 3) {
              startYear = parseInt(parts[0]) || 2020;
              startMonth = (parseInt(parts[1]) || 1) - 1;
              day = parseInt(parts[2]) || 1;
            }
          } else if (prop.purchaseDate) {
            const parts = prop.purchaseDate.split('-');
            if (parts.length >= 3) {
              startYear = parseInt(parts[0]) || 2020;
              startMonth = (parseInt(parts[1]) || 1) - 1;
              day = parseInt(parts[2]) || 1;
            }
          }

          const endYear = startYear + durationYears;
          const endMonth = startMonth;

          monthsToGenerate.forEach(({ year, month }) => {
            const isAfterStart = year > startYear || (year === startYear && month >= startMonth);
            const isBeforeEnd = year < endYear || (year === endYear && month <= endMonth);

            if (isAfterStart && isBeforeEnd) {
              const maxDay = new Date(year, month + 1, 0).getDate();
              const actualDay = Math.min(day, maxDay);
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
              const id = `auto_mortg_${prop.id}_${dateStr}`;

              if (!generatedIds.has(id)) {
                generatedIds.add(id);
                auto.push({
                  id,
                  title: `${prop.name}: Rata Mutuo`,
                  date: dateStr,
                  type: 'CONTRACT',
                  amount: monthly,
                  isCompleted: false,
                  propertyId: prop.id,
                  notes: 'Scadenza mensile da Scheda Economica (Mutuo)'
                });
              }
            }
          });
        }
      }

      // 2E. Costi Ricorrenti e Spese specificati nella scheda economica dell'immobile
      if (Array.isArray(prop.recurringCosts)) {
        prop.recurringCosts.forEach((cost: RecurringCost) => {
          if (!cost.amount || cost.amount <= 0) return;

          const isRenovExpense =
            cost.category === 'MAINTENANCE' &&
            Boolean(cost.name?.match(/ristruttur|lavor|cantier|impiant|bagno|cucina|finitur|opere/i));

          const costType: Deadline['type'] = isRenovExpense
            ? 'MAINTENANCE'
            : cost.category === 'MORTGAGE'
            ? 'CONTRACT'
            : cost.category === 'TAX'
            ? 'TAX'
            : 'MAINTENANCE';

          const titlePrefix = isRenovExpense
            ? `${prop.name}: Ristrutturazione - ${cost.name}`
            : `${prop.name}: ${cost.name}`;

          // MENSILE
          if (cost.frequency === 'MONTHLY') {
            const day = extractDay(cost.date, 1);

            monthsToGenerate.forEach(({ year, month }) => {
              if (cost.referenceYear != null && cost.referenceMonth != null) {
                if (year < cost.referenceYear || (year === cost.referenceYear && month < cost.referenceMonth)) {
                  return;
                }
              }

              const maxDay = new Date(year, month + 1, 0).getDate();
              const actualDay = Math.min(day, maxDay);
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
              const id = `auto_cost_${prop.id}_${cost.id}_${dateStr}`;

              if (!generatedIds.has(id)) {
                generatedIds.add(id);
                auto.push({
                  id,
                  title: titlePrefix,
                  date: dateStr,
                  type: costType,
                  amount: cost.amount,
                  isCompleted: false,
                  propertyId: prop.id,
                  notes: `Scadenza Mensile (${cost.name})`
                });
              }
            });
          }

          // ANNUALE
          else if (cost.frequency === 'YEARLY') {
            let monthIndex = cost.referenceMonth != null ? cost.referenceMonth : 0;
            let dayIndex = 1;

            if (cost.date) {
              const parts = cost.date.split('T')[0].split('-');
              if (parts.length >= 3) {
                monthIndex = (parseInt(parts[1]) || 1) - 1;
                dayIndex = parseInt(parts[2]) || 1;
              } else if (parts.length === 2) {
                monthIndex = (parseInt(parts[0]) || 1) - 1;
                dayIndex = parseInt(parts[1]) || 1;
              }
            }

            const currentY = today.getFullYear();
            const viewY = currentDate.getFullYear();
            const yearsToGen = new Set<number>([
              currentY - 2,
              currentY - 1,
              currentY,
              currentY + 1,
              currentY + 2,
              viewY - 1,
              viewY,
              viewY + 1
            ]);
            if (cost.referenceYear) yearsToGen.add(cost.referenceYear);

            yearsToGen.forEach(y => {
              if (cost.referenceYear != null && y < cost.referenceYear) return;

              const maxDay = new Date(y, monthIndex + 1, 0).getDate();
              const actualDay = Math.min(dayIndex, maxDay);
              const dateStr = `${y}-${String(monthIndex + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
              const id = `auto_cost_${prop.id}_${cost.id}_${dateStr}`;

              if (!generatedIds.has(id)) {
                generatedIds.add(id);
                auto.push({
                  id,
                  title: titlePrefix,
                  date: dateStr,
                  type: costType,
                  amount: cost.amount,
                  isCompleted: false,
                  propertyId: prop.id,
                  notes: `Scadenza Annuale (${cost.name})`
                });
              }
            });
          }

          // UNA TANTUM (Spesa singola da scheda economica)
          else if (cost.frequency === 'ONE_OFF') {
            let dateStr = todayStr;
            if (cost.date) {
              dateStr = cost.date.split('T')[0];
            } else if (cost.referenceYear) {
              const m = String((cost.referenceMonth ?? 0) + 1).padStart(2, '0');
              dateStr = `${cost.referenceYear}-${m}-01`;
            }

            const id = `auto_cost_${prop.id}_${cost.id}_${dateStr}`;
            if (!generatedIds.has(id)) {
              generatedIds.add(id);
              auto.push({
                id,
                title: titlePrefix,
                date: dateStr,
                type: costType,
                amount: cost.amount,
                isCompleted: false,
                propertyId: prop.id,
                notes: `Spesa Una Tantum (${cost.name})`
              });
            }
          }
        });
      }
    });

    return auto;
  }, [properties, config, scenarios, rentalRecords, currentDate]);

  // Unione delle scadenze manuali e automatiche:
  // Se una scadenza automatica è stata modificata/completata e salvata nel DB, la versione manuale ha precedenza
  const allDeadlines = useMemo(() => {
    const manualMap = new Map(manualDeadlines.map(d => [d.id, d]));
    const merged: Deadline[] = [...manualDeadlines];

    autoDeadlines.forEach(auto => {
      if (!manualMap.has(auto.id)) {
        merged.push(auto);
      }
    });

    return merged;
  }, [manualDeadlines, autoDeadlines]);

  // Salvataggio nuova scadenza manuale
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const newDeadline: Deadline = {
      id: Date.now().toString(),
      title,
      date,
      type,
      amount: amount ? Number(amount) : undefined,
      notes,
      isCompleted: false,
      propertyId: formPropertyId || undefined
    };
    await db.saveDeadline(newDeadline);
    setManualDeadlines(prev => [...prev.filter(d => d.id !== newDeadline.id), newDeadline]);
    setShowForm(false);
    setTitle('');
    setDate('');
    setAmount('');
    setNotes('');
    setFormPropertyId('');
  };

  // Toggle completato / pagato
  const handleToggleCompleted = async (deadline: Deadline) => {
    const updated: Deadline = { ...deadline, isCompleted: !deadline.isCompleted };
    await db.saveDeadline(updated);
    setManualDeadlines(prev => [...prev.filter(d => d.id !== updated.id), updated]);
  };

  // Eliminazione scadenza manuale
  const handleDelete = async (id: string) => {
    if (window.confirm('Eliminare questa scadenza?')) {
      await db.deleteDeadline(id);
      setManualDeadlines(prev => prev.filter(d => d.id !== id));
    }
  };

  // Giorni del mese corrente per la visualizzazione a griglia (immune da timezone shift)
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = [];
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Lunedì come primo giorno
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Mese precedente
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      days.push({ date: d, dateStr: toLocalDateStr(d), isCurrentMonth: false });
    }
    // Mese corrente
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, dateStr: toLocalDateStr(d), isCurrentMonth: true });
    }
    // Riempimento mese successivo
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, dateStr: toLocalDateStr(d), isCurrentMonth: false });
    }
    return days;
  }, [currentDate]);

  // Filtro immobile: calcola scadenze per griglia e sidebar
  const { overdue, today, upcoming, gridDeadlines, totalFilteredCount } = useMemo(() => {
    const now = new Date();
    const todayStr = toLocalDateStr(now);

    const upcomingLimitDate = new Date(now);
    upcomingLimitDate.setDate(upcomingLimitDate.getDate() + 7);
    const upcomingLimitStr = toLocalDateStr(upcomingLimitDate);

    const result = {
      overdue: [] as Deadline[],
      today: [] as Deadline[],
      upcoming: [] as Deadline[],
      gridDeadlines: new Map<string, Deadline[]>(),
      totalFilteredCount: 0
    };

    allDeadlines.forEach(d => {
      // FILTRO RIGOROSO PER IMMOBILE:
      // Se è selezionato un singolo immobile, mostra ESCLUSIVAMENTE le scadenze relative ad esso
      if (selectedPropertyFilter !== 'ALL') {
        if (d.propertyId !== selectedPropertyFilter) return;
      }

      result.totalFilteredCount++;

      // Inserisci nella griglia del calendario
      if (!result.gridDeadlines.has(d.date)) {
        result.gridDeadlines.set(d.date, []);
      }
      result.gridDeadlines.get(d.date)!.push(d);

      // Le scadenze completate non compaiono nella sidebar imminenti
      if (d.isCompleted) return;

      if (d.date < todayStr) {
        result.overdue.push(d);
      } else if (d.date === todayStr) {
        result.today.push(d);
      } else if (d.date <= upcomingLimitStr) {
        result.upcoming.push(d);
      }
    });

    const sortFn = (a: Deadline, b: Deadline) => a.date.localeCompare(b.date);
    result.overdue.sort(sortFn);
    result.today.sort(sortFn);
    result.upcoming.sort(sortFn);

    return result;
  }, [allDeadlines, selectedPropertyFilter]);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const getStyleForDeadline = (d: Deadline) => {
    if (d.isCompleted) {
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 opacity-60 line-through';
    }
    if (d.propertyId && propertyColorMap.has(d.propertyId)) {
      return propertyColorMap.get(d.propertyId)!;
    }
    // Stile default per scadenze globali
    return 'bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/30';
  };

  const formatCurrency = (amount?: number) =>
    amount != null ? `€ ${Math.round(amount).toLocaleString('it-IT')}` : '';

  const selectedProperty = useMemo(() => {
    return properties.find(p => p.id === selectedPropertyFilter);
  }, [properties, selectedPropertyFilter]);

  const handleOpenForm = () => {
    if (selectedPropertyFilter !== 'ALL') {
      setFormPropertyId(selectedPropertyFilter);
    } else {
      setFormPropertyId('');
    }
    setShowForm(!showForm);
  };

  // Calcolo scadenze per ciascun immobile per mostrare conteggi nel dropdown
  const propertyDeadlineCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allDeadlines.forEach(d => {
      if (d.propertyId) {
        counts.set(d.propertyId, (counts.get(d.propertyId) || 0) + 1);
      }
    });
    return counts;
  }, [allDeadlines]);

  if (loading) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <span className="font-semibold text-slate-500">Caricamento calendario &amp; scadenze...</span>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto h-[calc(100vh-100px)] flex flex-col font-sans animate-fade-in">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">Calendario &amp; Scadenze</h1>
            {selectedProperty && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-500/10 text-brand-600 border border-brand-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-500" />
                {selectedProperty.name}
              </span>
            )}
            <span className="text-xs text-slate-400 font-semibold">
              ({totalFilteredCount} {totalFilteredCount === 1 ? 'scadenza' : 'scadenze'})
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={prevMonth}
              title="Mese precedente"
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button
              onClick={nextMonth}
              title="Mese successivo"
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
            <button
              onClick={goToToday}
              className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
            >
              Oggi
            </button>
            <span className="text-foreground font-semibold ml-2 text-base">
              {currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          {/* Filtro Immobili */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Filtro Immobile:</label>
            <select 
              value={selectedPropertyFilter} 
              onChange={(e) => setSelectedPropertyFilter(e.target.value)}
              className="p-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm w-full sm:w-auto min-w-[220px]"
            >
              <option value="ALL">Tutti gli Immobili ({allDeadlines.length})</option>
              {properties.map(p => {
                const count = propertyDeadlineCounts.get(p.id) || 0;
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <button
            onClick={() => setShowScenarioLinker(!showScenarioLinker)}
            title="Gestisci collegamento tra scenari di acquisto/ristrutturazione e immobili"
            className={`px-3 py-2 border rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap ${
              showScenarioLinker
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Collega Piani
          </button>

          <button 
            onClick={handleOpenForm} 
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            {showForm ? 'Annulla' : 'Nuova Scadenza'}
          </button>
        </div>
      </header>

      {/* Banner Dettaglio Immobile Selezionato con Scheda Economica Attiva */}
      {selectedProperty && (
        <div className="bg-white dark:bg-slate-800 border border-brand-500/30 rounded-2xl p-4 mb-5 shadow-xs shrink-0 animate-fade-in flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center font-bold text-lg border border-brand-500/20">
              {selectedProperty.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">{selectedProperty.name}</h3>
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {selectedProperty.type}
                </span>
                <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                  selectedProperty.status === 'RENTED'
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : selectedProperty.status === 'RENOVATION'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {selectedProperty.status === 'RENTED' ? 'Affittato' : selectedProperty.status === 'RENOVATION' ? 'Cantiere' : selectedProperty.status === 'MAIN_RESIDENCE' ? 'Abitazione' : 'Sfitto'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                {selectedProperty.financials?.mortgageAmount ? (
                  <span className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                    🏦 Mutuo: €{Math.round(selectedProperty.financials.mortgageAmount).toLocaleString('it-IT')}/m
                  </span>
                ) : null}
                {selectedProperty.financials?.monthlyRent ? (
                  <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    🔑 Affitto: €{Math.round(selectedProperty.financials.monthlyRent).toLocaleString('it-IT')}/m
                  </span>
                ) : null}
                {selectedProperty.financials?.condoFees ? (
                  <span className="flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400">
                    🏢 Spese Cond.: €{Math.round(selectedProperty.financials.condoFees).toLocaleString('it-IT')}/m
                  </span>
                ) : null}
                {selectedProperty.purchasePrice ? (
                  <span className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
                    🏷️ Acquisto: €{Math.round(selectedProperty.purchasePrice).toLocaleString('it-IT')}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800/40">
              {totalFilteredCount} Scadenze Collegate
            </span>
            <button
              onClick={() => setSelectedPropertyFilter('ALL')}
              className="text-xs underline text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1"
            >
              Mostra Tutti
            </button>
          </div>
        </div>
      )}

      {/* Pannello Gestione Collegamento Piani / Scenari di Acquisto & Ristrutturazione */}
      {showScenarioLinker && (
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-4 rounded-2xl mb-5 shrink-0 animate-slide-in">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-bold text-sm text-purple-900 dark:text-purple-200 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                Collega Piani di Acquisto &amp; Ristrutturazione agli Immobili
              </h4>
              <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                Associa ciascun piano finanziario (scheda Acquisto o scenari salvati) all&apos;immobile del tuo patrimonio per mostrare automaticamente tutte le sue spese di acquisto e ristrutturazione quando usi il filtro.
              </p>
            </div>
            <button onClick={() => setShowScenarioLinker(false)} className="text-purple-600 dark:text-purple-400 hover:text-purple-900 text-sm font-bold">✕ Chiudi</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Config Corrente / Attivo */}
            {config && (
              <div className="p-3 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800/60 rounded-xl flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase">Progetto Attivo (Editor Acquisto)</span>
                <span className="font-semibold text-xs truncate" title={config.propertyName}>{config.propertyName || 'Bozza Corrente'}</span>
                <div className="mt-1">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Immobile Associato:</label>
                  <select
                    value={config.propertyId || ''}
                    onChange={(e) => handleLinkConfig(e.target.value)}
                    className="w-full p-1.5 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-1 focus:ring-purple-500 outline-none"
                  >
                    <option value="">Nessuno (Globale / Auto-Match)</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Scenari Salvati */}
            {scenarios.map(scn => (
              <div key={scn.id} className="p-3 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800/60 rounded-xl flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase">Scenario: {scn.date}</span>
                <span className="font-semibold text-xs truncate" title={scn.name}>{scn.name}</span>
                <div className="mt-1">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Immobile Associato:</label>
                  <select
                    value={scn.propertyId || scn.data?.propertyId || ''}
                    onChange={(e) => handleLinkScenario(scn.id, e.target.value)}
                    className="w-full p-1.5 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-1 focus:ring-purple-500 outline-none"
                  >
                    <option value="">Nessuno (Globale / Auto-Match)</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Aggiungi Scadenza Manuale */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6 shrink-0 animate-slide-in">
          <h3 className="font-bold text-lg mb-4">Aggiungi Nuova Scadenza</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Titolo *</label>
              <input 
                required 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                type="text" 
                placeholder="Es. Rata Assicurazione" 
                className="w-full p-2.5 border rounded-lg bg-transparent border-slate-300 dark:border-slate-600 text-sm focus:ring-2 focus:ring-brand-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Data Scadenza *</label>
              <input 
                required 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                type="date" 
                className="w-full p-2.5 border rounded-lg bg-transparent border-slate-300 dark:border-slate-600 text-sm focus:ring-2 focus:ring-brand-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Immobile Collegato</label>
              <select 
                value={formPropertyId} 
                onChange={e => setFormPropertyId(e.target.value)} 
                className="w-full p-2.5 border rounded-lg bg-transparent border-slate-300 dark:border-slate-600 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="">Nessuno (Scadenza Generale)</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Tipo Scadenza</label>
              <select 
                value={type} 
                onChange={e => setType(e.target.value as any)} 
                className="w-full p-2.5 border rounded-lg bg-transparent border-slate-300 dark:border-slate-600 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="RENT">Affitto</option>
                <option value="TAX">Tasse / Fisco</option>
                <option value="MAINTENANCE">Manutenzione / Lavori / Ristrutturazione</option>
                <option value="CONTRACT">Contratto / Mutuo / Rogito / Acquisto</option>
                <option value="CUSTOM">Altro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Importo (€)</label>
              <input 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                type="number" 
                placeholder="Es. 500" 
                className="w-full p-2.5 border rounded-lg bg-transparent border-slate-300 dark:border-slate-600 text-sm focus:ring-2 focus:ring-brand-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Note Opzionali</label>
              <input 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                type="text" 
                placeholder="Note o dettagli..." 
                className="w-full p-2.5 border rounded-lg bg-transparent border-slate-300 dark:border-slate-600 text-sm focus:ring-2 focus:ring-brand-500 outline-none" 
              />
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <button 
              type="button" 
              onClick={() => setShowForm(false)} 
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Annulla
            </button>
            <button 
              type="submit" 
              className="px-6 py-2 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 text-sm shadow-sm"
            >
              Salva Scadenza
            </button>
          </div>
        </form>
      )}

      {/* Main Layout */}
      <div className="flex flex-1 gap-6 min-h-0 flex-col md:flex-row overflow-hidden">
        
        {/* Sidebar: Scadenze Imminenti & Scadute */}
        <aside className="w-full md:w-80 shrink-0 flex flex-col gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2 sticky top-0 bg-white dark:bg-slate-800 z-10">
            <h2 className="font-semibold text-lg">Scadenze Imminenti</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {overdue.length + today.length + upcoming.length}
            </span>
          </div>

          {selectedProperty && (
            <div className="text-xs bg-brand-50 dark:bg-brand-950/40 p-2.5 rounded-lg border border-brand-200 dark:border-brand-800/40 text-brand-700 dark:text-brand-300 flex items-center justify-between">
              <span>Filtrato: <b>{selectedProperty.name}</b></span>
              <button 
                onClick={() => setSelectedPropertyFilter('ALL')} 
                className="underline hover:text-brand-900 dark:hover:text-brand-100 text-[11px]"
              >
                Mostra Tutti
              </button>
            </div>
          )}
          
          {/* Scadute (Overdue) */}
          {overdue.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-bold text-red-500 uppercase tracking-wider flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                Scadute ({overdue.length})
              </div>
              {overdue.map(d => {
                const prop = properties.find(p => p.id === d.propertyId);
                return (
                  <div key={d.id} className="p-3 border border-red-500/30 bg-red-500/10 rounded-lg flex flex-col gap-2 group transition-colors hover:bg-red-500/20">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-sm block truncate" title={d.title}>{d.title}</span>
                        <span className="text-xs opacity-75">Scaduta il {formatItalianDate(d.date)}</span>
                        {prop && selectedPropertyFilter === 'ALL' && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[10px] font-bold rounded bg-red-500/20 text-red-700 dark:text-red-300">
                            {prop.name}
                          </span>
                        )}
                      </div>
                      <span className="text-red-500 font-bold text-sm shrink-0">{formatCurrency(d.amount)}</span>
                    </div>
                    <div className="flex gap-1.5 mt-1">
                      <button 
                        onClick={() => handleToggleCompleted(d)} 
                        className="flex-1 py-1.5 bg-red-500 text-white rounded font-medium text-xs shadow-sm hover:bg-red-600 transition-colors opacity-90 hover:opacity-100"
                      >
                        Segna come Pagato
                      </button>
                      {!d.id.startsWith('auto_') && (
                        <button 
                          onClick={() => handleDelete(d.id)} 
                          title="Elimina scadenza" 
                          className="px-2 py-1 bg-red-200 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded text-xs hover:bg-red-300"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Oggi (Today) */}
          {today.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="text-xs font-bold text-orange-500 uppercase tracking-wider flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                Oggi ({today.length})
              </div>
              {today.map(d => {
                const prop = properties.find(p => p.id === d.propertyId);
                return (
                  <div key={d.id} className="p-3 border border-orange-500/30 bg-orange-500/10 rounded-lg flex flex-col gap-2 group transition-colors hover:bg-orange-500/20">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-sm block truncate" title={d.title}>{d.title}</span>
                        {prop && selectedPropertyFilter === 'ALL' && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[10px] font-bold rounded bg-orange-500/20 text-orange-700 dark:text-orange-300">
                            {prop.name}
                          </span>
                        )}
                      </div>
                      <span className="text-orange-500 font-bold text-sm shrink-0">{formatCurrency(d.amount)}</span>
                    </div>
                    <div className="flex gap-1.5 mt-1">
                      <button 
                        onClick={() => handleToggleCompleted(d)} 
                        className="flex-1 py-1.5 bg-orange-500 text-white rounded font-medium text-xs shadow-sm hover:bg-orange-600 transition-colors opacity-90 hover:opacity-100"
                      >
                        Segna come Pagato
                      </button>
                      {!d.id.startsWith('auto_') && (
                        <button 
                          onClick={() => handleDelete(d.id)} 
                          title="Elimina scadenza" 
                          className="px-2 py-1 bg-orange-200 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded text-xs hover:bg-orange-300"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Prossimi 7 giorni (Upcoming) */}
          {upcoming.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="text-xs font-bold text-blue-500 uppercase tracking-wider">
                Prossimi 7 giorni ({upcoming.length})
              </div>
              {upcoming.map(d => {
                const prop = properties.find(p => p.id === d.propertyId);
                return (
                  <div key={d.id} className="p-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg flex flex-col gap-2 group transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-sm block truncate" title={d.title}>{d.title}</span>
                        <span className="text-xs text-slate-500">{formatItalianDate(d.date)}</span>
                        {prop && selectedPropertyFilter === 'ALL' && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[10px] font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {prop.name}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-sm shrink-0">{formatCurrency(d.amount)}</span>
                    </div>
                    <div className="flex gap-1.5 mt-1">
                      <button 
                        onClick={() => handleToggleCompleted(d)} 
                        className="flex-1 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded font-medium text-xs shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        Segna come Pagato
                      </button>
                      {!d.id.startsWith('auto_') && (
                        <button 
                          onClick={() => handleDelete(d.id)} 
                          title="Elimina scadenza" 
                          className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs hover:bg-slate-300"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {overdue.length === 0 && today.length === 0 && upcoming.length === 0 && (
            <div className="text-center p-8 opacity-60 flex flex-col items-center justify-center gap-2">
              <span className="text-3xl">🎉</span>
              <p className="text-sm font-semibold">Nessuna scadenza imminente!</p>
              <span className="text-xs text-slate-400">Tutti i pagamenti del periodo sono in regola.</span>
            </div>
          )}
        </aside>

        {/* Calendar Grid */}
        <main className="flex-1 flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden min-h-0">
          {/* Header Giorni Settimana */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shrink-0">
            {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
              <div key={day} className="p-2 md:p-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{day}</div>
            ))}
          </div>

          {/* Griglia Calendario */}
          <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-slate-200 dark:bg-slate-700 gap-px overflow-y-auto">
            {calendarDays.map((cell, i) => {
              const cellDeadlines = gridDeadlines.get(cell.dateStr) || [];
              const isToday = cell.dateStr === toLocalDateStr(new Date());
              
              return (
                <div 
                  key={i} 
                  className={`bg-white dark:bg-slate-800 p-1.5 md:p-2 min-h-[90px] flex flex-col gap-1 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-750 ${
                    !cell.isCurrentMonth ? 'opacity-40 bg-slate-50/50 dark:bg-slate-850/50' : ''
                  } ${isToday ? 'bg-brand-50/40 dark:bg-brand-900/10 ring-1 ring-inset ring-brand-500/30' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${
                      isToday 
                        ? 'text-brand-600 dark:text-brand-400 font-black bg-brand-100 dark:bg-brand-900/40 w-5 h-5 flex items-center justify-center rounded-full' 
                        : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {cell.date.getDate()}
                    </span>
                    {cellDeadlines.length > 0 && (
                      <span className="text-[10px] font-bold text-slate-400">
                        {cellDeadlines.length}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 overflow-y-auto max-h-[95px] scrollbar-hide">
                    {cellDeadlines.map(d => (
                      <div 
                        key={d.id} 
                        onClick={() => handleToggleCompleted(d)}
                        title={`${d.title} - ${formatCurrency(d.amount)}${d.isCompleted ? ' (Pagato)' : ' (Clicca per completare)'}`}
                        className={`text-[11px] p-1 rounded-md border cursor-pointer transition-all hover:scale-[0.98] flex items-center justify-between gap-1 shadow-2xs ${getStyleForDeadline(d)}`}
                      >
                        <span className="truncate flex-1 font-medium">{d.title}</span>
                        {d.amount != null && d.amount > 0 && (
                          <span className="font-bold text-[10px] shrink-0 opacity-90">
                            €{Math.round(d.amount).toLocaleString('it-IT')}
                          </span>
                        )}
                        {d.isCompleted && (
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 shrink-0">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};
