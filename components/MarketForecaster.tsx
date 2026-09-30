import React, { useState, useMemo, useEffect } from 'react';
import { Property, ForecastSimulationConfig, PropertyForecastData, InvoiceRecord } from '../types';
import { calculatePropertyForecast, getDefaultSimulationConfig } from '../services/forecastService';
import { getMicroMarketMetrics } from '../services/openDataService';
import { db } from '../services/dbService';
import { getAnnualDeductionsByProperty, getDeductionSummaryForProperty } from '../services/taxDeductionService';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface MarketForecasterProps {
  property: Property;
  onSaveForecast?: (updatedProp: Property) => void;
}

const eur = (n: number) => '€ ' + Math.round(n || 0).toLocaleString('it-IT');
const seur = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + '€ ' + Math.abs(Math.round(n || 0)).toLocaleString('it-IT');

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const pData = payload[0]?.payload;
  const calY = pData?.calendarYear;
  return (
    <div className="mf-tooltip">
      <div className="mf-tt-label">
        Proiezione Anno {label} {calY ? `(${calY})` : ''}
        {pData?.isPayoffYear && (
          <span style={{ marginLeft: 6, fontSize: 9.5, color: '#38bdf8', background: 'rgba(56,189,248,0.2)', padding: '2px 5px', borderRadius: 4 }}>
            ESTINZIONE MUTUO
          </span>
        )}
      </div>
      {payload.map((p: any, i: number) => (
        <div className="mf-tt-row" key={i}>
          <span className="mf-tt-dot" style={{ background: p.color || p.stroke }} />
          <span className="mf-tt-name">{p.name}:</span>
          <span className="mf-tt-val">{eur(p.value)}</span>
        </div>
      ))}
      {pData?.taxDeduction > 0 && (
        <div className="mf-tt-row" style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', marginTop: 6, paddingTop: 6 }}>
          <span className="mf-tt-dot" style={{ background: '#a855f7' }} />
          <span className="mf-tt-name" style={{ color: '#c084fc' }}>Detrazione 730:</span>
          <span className="mf-tt-val" style={{ color: '#c084fc' }}>+{eur(pData.taxDeduction)}/anno</span>
        </div>
      )}
      {(pData?.annualMortgagePayment || 0) > 0 && (
        <>
          <div className="mf-tt-row" style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', marginTop: 4, paddingTop: 4, fontSize: 10.5 }}>
            <span className="mf-tt-dot" style={{ background: '#38bdf8' }} />
            <span className="mf-tt-name" style={{ color: '#bae6fd' }}>Rata Mutuo Annua:</span>
            <span className="mf-tt-val" style={{ color: '#bae6fd' }}>
              {eur(pData.annualMortgagePayment)}
              {pData.mortgageMonthsPaid < 12 ? ` (${pData.mortgageMonthsPaid} rate)` : ''}
            </span>
          </div>
          {(pData?.annualPrincipalPayment || 0) > 0 && (
            <div className="mf-tt-row" style={{ fontSize: 10 }}>
              <span className="mf-tt-dot" style={{ background: '#34d399' }} />
              <span className="mf-tt-name" style={{ color: '#a7f3d0' }}>↳ Quota Capitale:</span>
              <span className="mf-tt-val" style={{ color: '#34d399' }}>+{eur(pData.annualPrincipalPayment)} (Equity)</span>
            </div>
          )}
          {(pData?.annualInterestPayment || 0) > 0 && (
            <div className="mf-tt-row" style={{ fontSize: 10 }}>
              <span className="mf-tt-dot" style={{ background: '#f87171' }} />
              <span className="mf-tt-name" style={{ color: '#fca5a5' }}>↳ Quota Interessi:</span>
              <span className="mf-tt-val" style={{ color: '#f87171' }}>{eur(pData.annualInterestPayment)} (Costo banca)</span>
            </div>
          )}
        </>
      )}
      {pData?.ownershipMonths != null && pData?.ownershipMonths < 12 && (
        <div className="mf-tt-row" style={{ fontSize: 10.5, color: '#38bdf8' }}>
          <span className="mf-tt-dot" style={{ background: '#38bdf8' }} />
          <span className="mf-tt-name">Possesso Anno:</span>
          <span className="mf-tt-val">{pData.ownershipMonths} mesi su 12</span>
        </div>
      )}
      {pData?.netCashFlow != null && (
        <div className="mf-tt-row">
          <span className="mf-tt-dot" style={{ background: pData.netCashFlow >= 0 ? '#10b981' : '#f43f5e' }} />
          <span className="mf-tt-name">Net Cash Flow:</span>
          <span className="mf-tt-val" style={{ color: pData.netCashFlow >= 0 ? 'var(--pos, #10b981)' : 'var(--neg, #f43f5e)' }}>{seur(pData.netCashFlow)}/anno</span>
        </div>
      )}
    </div>
  );
};

export const MarketForecaster: React.FC<MarketForecasterProps> = ({ property, onSaveForecast }) => {
  const [config, setConfig] = useState<ForecastSimulationConfig>(() => {
    return property.forecastData?.config || getDefaultSimulationConfig(property);
  });

  const [metrics, setMetrics] = useState(property.forecastData?.metrics || null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [validationSuccessMsg, setValidationSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    db.getInvoices()
      .then(res => {
        if (active) setInvoices(res || []);
      })
      .catch(err => console.warn('[MarketForecaster] Failed loading invoices:', err));
    return () => { active = false; };
  }, [property.id]);

  const annualTaxDeductions = useMemo(() => {
    return getAnnualDeductionsByProperty(invoices, property.id);
  }, [invoices, property.id]);

  const deductionSummary = useMemo(() => {
    return getDeductionSummaryForProperty(invoices, property.id);
  }, [invoices, property.id]);

  const hasRealInvoices = deductionSummary.invoiceCount > 0 && deductionSummary.totalDeduction > 0;
  const isSimulatingRenovation = !hasRealInvoices && (config.simulationRenovationCost || 0) > 0;
  const simulatedQuota = isSimulatingRenovation
    ? (Math.min(config.simulationRenovationCost || 0, 96000) * ((config.simulationDeductionRate || 50) / 100)) / 10
    : 0;
  const effectiveQuota = hasRealInvoices ? deductionSummary.currentYearQuota : simulatedQuota;

  useEffect(() => {
    let isMounted = true;
    const loadMarketData = async () => {
      if (!property.forecastData?.metrics) {
        setLoadingMetrics(true);
        try {
          const fetchedMetrics = await getMicroMarketMetrics(
            property.address || property.name,
            property.address,
            property.coordinates?.lat,
            property.coordinates?.lng
          );
          if (isMounted) setMetrics(fetchedMetrics);
        } catch (e) {
          console.warn('[MarketForecaster] Error fetching micro market metrics:', e);
        } finally {
          if (isMounted) setLoadingMetrics(false);
        }
      }
    };
    loadMarketData();
    return () => { isMounted = false; };
  }, [property.id, property.address, property.coordinates?.lat, property.coordinates?.lng, property.forecastData?.metrics]);

  const forecastData: PropertyForecastData = useMemo(() => {
    return calculatePropertyForecast(property, config, metrics || undefined, annualTaxDeductions);
  }, [property, config, metrics, annualTaxDeductions]);

  const handleConfigChange = <K extends keyof ForecastSimulationConfig>(key: K, value: ForecastSimulationConfig[K]) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
  };

  const handleSave = () => {
    const updatedProp: Property = {
      ...property,
      energyClass: config.currentEnergyClass,
      forecastData
    };
    if (onSaveForecast) onSaveForecast(updatedProp);
  };

  // Validazione dell'Estinzione Parziale Mutuo: applica i nuovi parametri all'immobile
  const handleValidatePayoff = () => {
    const sum = forecastData.mortgagePayoffSummary;
    if (!sum || !sum.applicable) return;

    const confirmMsg = sum.strategy === 'REDUCE_INSTALLMENT'
      ? `Confermi l'applicazione dell'estinzione parziale di ${eur(sum.payoffAmount)}?\n\nNuova rata mensile: ${eur(sum.newMonthlyInstallment)} (Risparmio: ${eur(sum.monthlySavings)}/mese)\nNuovo debito residuo: ${eur(sum.newDebtAtPayoff)}\nRisparmio interessi totali stimato: ${eur(sum.totalInterestSaved)}`
      : `Confermi l'applicazione dell'estinzione parziale di ${eur(sum.payoffAmount)}?\n\nNuova durata residua: ${sum.newRemainingYears} anni (Risparmiati: ${sum.yearsSaved} anni)\nNuovo debito residuo: ${eur(sum.newDebtAtPayoff)}\nRisparmio interessi totali stimato: ${eur(sum.totalInterestSaved)}`;

    if (!window.confirm(confirmMsg)) return;

    const currentMortCost = property.recurringCosts?.find(c => c.category === 'MORTGAGE');
    let updatedRecurring = property.recurringCosts ? [...property.recurringCosts] : [];

    if (sum.strategy === 'REDUCE_INSTALLMENT') {
      if (currentMortCost) {
        updatedRecurring = updatedRecurring.map(c => c.category === 'MORTGAGE' ? { ...c, amount: sum.newMonthlyInstallment } : c);
      }
    }

    const updatedProp: Property = {
      ...property,
      financials: {
        ...(property.financials || { condoFees: 0, defaultTaxRate: 0, mortgageAmount: 0 }),
        mortgageAmount: sum.strategy === 'REDUCE_INSTALLMENT' && (property.financials?.mortgageAmount || 0) <= 10000
          ? sum.newMonthlyInstallment
          : sum.newDebtAtPayoff,
        mortgageDuration: sum.strategy === 'REDUCE_DURATION'
          ? Math.max(1, Math.round((property.financials?.mortgageDuration || 20) - sum.yearsSaved))
          : property.financials?.mortgageDuration
      },
      recurringCosts: updatedRecurring,
      forecastData: {
        ...forecastData,
        config: {
          ...config,
          simulationPayoffAmount: 0
        }
      }
    };

    setConfig(prev => ({ ...prev, simulationPayoffAmount: 0 }));
    if (onSaveForecast) onSaveForecast(updatedProp);

    setValidationSuccessMsg(`Estinzione parziale di ${eur(sum.payoffAmount)} applicata con successo ai parametri finanziari del mutuo!`);
    setTimeout(() => setValidationSuccessMsg(null), 7000);
  };

  const projections = forecastData.yearlyProjections;
  const baseYear = forecastData.baseYear || (property.purchaseDate ? parseInt(property.purchaseDate.substring(0, 4), 10) : new Date().getFullYear());
  const y5 = projections[4] || projections[projections.length - 1];
  const y10 = projections[9] || projections[projections.length - 1];

  const initialVal = property.currentValue || property.purchasePrice || 200000;
  const gain5y = y5 ? y5.propertyValue - initialVal : 0;
  const etfDiff10y = y10 ? (y10.accumulatedEquity + (y10.cumulativeNetCashFlow || 0)) - y10.etfWorldBenchmarkValue : 0;

  const payoffSummary = forecastData.mortgagePayoffSummary;

  const chartData = projections.map(p => ({
    year: `${p.year} (${p.calendarYear || baseYear + p.year - 1})`,
    yearNum: p.year,
    calendarYear: p.calendarYear || (baseYear + p.year - 1),
    propertyValue: p.propertyValue,
    accumulatedEquity: p.accumulatedEquity,
    remainingDebt: p.remainingMortgageDebt,
    etfBenchmark: p.etfWorldBenchmarkValue,
    netCashFlow: p.netCashFlow,
    taxDeduction: p.taxDeductionQuota || 0,
    netCashFlowWithoutTax: p.netCashFlowWithoutTax || p.netCashFlow,
    annualMortgagePayment: p.annualMortgagePayment,
    annualPrincipalPayment: p.annualPrincipalPayment,
    annualInterestPayment: p.annualInterestPayment,
    cumulativePrincipalPaid: p.cumulativePrincipalPaid,
    cumulativeInterestPaid: p.cumulativeInterestPaid,
    mortgageMonthsPaid: p.mortgageMonthsPaid,
    ownershipMonths: p.ownershipMonths,
    isPayoffYear: p.isPayoffYear
  }));

  const hasMortgage = (property.financials?.mortgageAmount && property.financials.mortgageAmount > 0) ||
    Boolean(property.recurringCosts?.some(c => c.category === 'MORTGAGE' && c.amount > 0));

  return (
    <div className="mf-container">
      <style>{MF_STYLES}</style>

      {/* Header Bar */}
      <div className="mf-header">
        <div>
          <div className="mf-eyebrow">Modulo 5 · Motore Previsionale Finanziario</div>
          <h2 className="mf-title">Trend Prezzi &amp; Simulazione Mercato (1-10 Anni)</h2>
          <p className="mf-sub">
            Orizzonte decennale dall'acquisto ({baseYear}) al {baseYear + 9}
            {forecastData.ownershipMonthsYear1 != null && forecastData.ownershipMonthsYear1 < 12 && (
              <span> · 📅 Anno 1: {forecastData.ownershipMonthsYear1} mesi possesso</span>
            )}
            {forecastData.mortgageMonthsYear1 != null && forecastData.mortgageMonthsYear1 < 12 && (
              <span> · 🏦 Mutuo Anno 1: {forecastData.mortgageMonthsYear1} rate pagate</span>
            )}
            {' · '}Direttiva Case Verdi, Estinzioni Mutuo &amp; Benchmark ETF
          </p>
        </div>
        <button className="mf-btn mf-btn-primary" onClick={handleSave}>
          💾 Salva Simulazione
        </button>
      </div>

      {validationSuccessMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', padding: '12px 16px', borderRadius: 10, fontSize: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>✅</span>
          <span>{validationSuccessMsg}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="mf-kpi-grid">
        <div className="mf-kpi-card mf-kpi-hero">
          <div className="mf-kpi-glow" />
          <div className="mf-kpi-top">
            <span className="mf-kpi-label">Valore Stimato (Anno 5 · {baseYear + 4})</span>
            <span className="mf-kpi-badge mf-badge-pos">{gain5y >= 0 ? '+' : ''}{((gain5y / initialVal) * 100).toFixed(1)}%</span>
          </div>
          <div className="mf-kpi-val">{eur(y5?.propertyValue || 0)}</div>
          <div className="mf-kpi-sub">Plusvalenza stimata: <span className="mf-pos">{seur(gain5y)}</span></div>
        </div>

        <div className="mf-kpi-card">
          <div className="mf-kpi-top">
            <span className="mf-kpi-label">Equità Netta Immobile (5a · {baseYear + 4})</span>
            <span className="mf-kpi-icon">🏠</span>
          </div>
          <div className="mf-kpi-val">{eur(y5?.accumulatedEquity || 0)}</div>
          <div className="mf-kpi-sub">Debito residuo mutuo: <span className="mf-neg">{eur(y5?.remainingMortgageDebt || 0)}</span></div>
        </div>

        <div className="mf-kpi-card">
          <div className="mf-kpi-top">
            <span className="mf-kpi-label">ROE Medio Annuo (Cash Equity)</span>
            <span className="mf-kpi-icon">📈</span>
          </div>
          <div className="mf-kpi-val mf-accent">{y5?.roePercent || 0}%</div>
          <div className="mf-kpi-sub">Rendimento su capitale versato</div>
        </div>

        <div className="mf-kpi-card">
          <div className="mf-kpi-top">
            <span className="mf-kpi-label">Diff. vs ETF World (10a · {baseYear + 9})</span>
            <span className={`mf-kpi-badge ${etfDiff10y >= 0 ? 'mf-badge-pos' : 'mf-badge-neg'}`}>
              {etfDiff10y >= 0 ? 'Supera ETF' : 'Sotto ETF'}
            </span>
          </div>
          <div className="mf-kpi-val" style={{ color: etfDiff10y >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
            {seur(etfDiff10y)}
          </div>
          <div className="mf-kpi-sub">Capitale composto su cash iniziale</div>
        </div>

        {/* Card Estinzione Mutuo se attiva, altrimenti Recupero Fiscale 730 */}
        {payoffSummary && payoffSummary.applicable ? (
          <div className="mf-kpi-card" style={{ borderColor: 'rgba(56, 189, 248, 0.45)', background: 'linear-gradient(180deg, rgba(56, 189, 248, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
            <div className="mf-kpi-top">
              <span className="mf-kpi-label" style={{ color: '#38bdf8' }}>Risparmio Estinzione Mutuo</span>
              <span className="mf-kpi-icon">🏦</span>
            </div>
            <div className="mf-kpi-val" style={{ color: '#38bdf8' }}>
              {seur(payoffSummary.totalInterestSaved)}
            </div>
            <div className="mf-kpi-sub" style={{ color: '#bae6fd' }}>
              {payoffSummary.strategy === 'REDUCE_INSTALLMENT'
                ? `Rata: ${eur(payoffSummary.originalMonthlyInstallment)} ➔ ${eur(payoffSummary.newMonthlyInstallment)} (-${eur(payoffSummary.monthlySavings)}/m)`
                : `Durata: ${payoffSummary.originalRemainingYears}a ➔ ${payoffSummary.newRemainingYears}a (-${payoffSummary.yearsSaved} anni)`}
            </div>
          </div>
        ) : (
          <div className="mf-kpi-card" style={{ borderColor: (config.includeTaxDeductions !== false && effectiveQuota > 0) ? 'rgba(168, 85, 247, 0.45)' : undefined, background: (config.includeTaxDeductions !== false && effectiveQuota > 0) ? 'linear-gradient(180deg, rgba(168, 85, 247, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)' : undefined }}>
            <div className="mf-kpi-top">
              <span className="mf-kpi-label" style={{ color: (config.includeTaxDeductions !== false && effectiveQuota > 0) ? '#c084fc' : undefined }}>Recupero Fiscale 730</span>
              <span className="mf-kpi-icon">🧾</span>
            </div>
            <div className="mf-kpi-val" style={{ color: (config.includeTaxDeductions !== false && effectiveQuota > 0) ? '#c084fc' : 'var(--dim)' }}>
              {config.includeTaxDeductions !== false && effectiveQuota > 0 ? `+${eur(effectiveQuota)}/a` : '€ 0'}
            </div>
            <div className="mf-kpi-sub" style={{ color: '#cbd5e1' }}>
              {hasRealInvoices
                ? `Totale detraibile: ${eur(deductionSummary.totalDeduction)} (${deductionSummary.invoiceCount} fatture)`
                : isSimulatingRenovation
                  ? `Simulazione: 10 rate su ${eur(config.simulationRenovationCost || 0)}`
                  : '10 rate annuali da lavori'}
            </div>
          </div>
        )}
      </div>

      {/* Main Layout: Control Sliders Left + Chart Right */}
      <div className="mf-main-grid">
        {/* Left Panel: Sliders & Controls */}
        <div className="mf-panel mf-controls-panel">
          <h3 className="mf-panel-title">⚙️ Parametri &amp; Scenari di Simulazione</h3>

          {/* Slider 1: Target Inflazione CPI */}
          <div className="mf-control-group">
            <div className="mf-control-label">
              <span>Target Inflazione CPI (FOI ISTAT)</span>
              <span className="mf-control-val">{config.cpiInflationTarget.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="6.0"
              step="0.1"
              value={config.cpiInflationTarget}
              onChange={e => handleConfigChange('cpiInflationTarget', parseFloat(e.target.value))}
              className="mf-slider"
            />
            <div className="mf-control-hints"><span>0% Stabile</span><span>2% Target BCE</span><span>6% Alta</span></div>
          </div>

          {/* Slider 2: Settimane Sfitto / Vacancy */}
          <div className="mf-control-group">
            <div className="mf-control-label">
              <span>Settimane Sfitto / Inoccupato (Annue)</span>
              <span className="mf-control-val">{config.vacancyWeeksPerYear} w</span>
            </div>
            <input
              type="range"
              min="0"
              max="8"
              step="1"
              value={config.vacancyWeeksPerYear}
              onChange={e => handleConfigChange('vacancyWeeksPerYear', parseInt(e.target.value))}
              className="mf-slider"
            />
            <div className="mf-control-hints"><span>0w (100% locato)</span><span>2w (Media)</span><span>8w (Alta rotazione)</span></div>
          </div>

          {/* BCE Scenario Buttons */}
          <div className="mf-control-group">
            <label className="mf-field-label">Scenario Tassi BCE</label>
            <div className="mf-seg-buttons">
              {(['STABLE', 'RISING', 'FALLING'] as const).map(scenario => (
                <button
                  key={scenario}
                  className={`mf-seg-btn ${config.bceInterestRateScenario === scenario ? 'active' : ''}`}
                  onClick={() => handleConfigChange('bceInterestRateScenario', scenario)}
                >
                  {scenario === 'STABLE' ? 'Stabili' : scenario === 'RISING' ? 'Rialzo (+0.75%)' : 'Calo (-0.75%)'}
                </button>
              ))}
            </div>
          </div>

          {/* Tax Regime Selector */}
          <div className="mf-control-group">
            <label className="mf-field-label">Regime Fiscale Locazione</label>
            <select
              className="mf-select"
              value={config.taxRegime}
              onChange={e => handleConfigChange('taxRegime', e.target.value as any)}
            >
              <option value="ESENTE_0">0% · Comodato d'Uso / Esente</option>
              <option value="CEDOLARE_21">Cedolare Secca 21% (Libero)</option>
              <option value="CEDOLARE_10">Cedolare Secca 10% (Concordato)</option>
              <option value="IRPEF_ORDINARIA">Tassazione Ord. IRPEF (Marginale)</option>
            </select>
          </div>

          {config.taxRegime === 'IRPEF_ORDINARIA' && (
            <div className="mf-control-group">
              <div className="mf-control-label">
                <span>Aliquota Marginale IRPEF Proprietario</span>
                <span className="mf-control-val">{config.ownerMarginalTaxRate || 35}%</span>
              </div>
              <input
                type="range"
                min="23"
                max="43"
                step="1"
                value={config.ownerMarginalTaxRate || 35}
                onChange={e => handleConfigChange('ownerMarginalTaxRate', parseInt(e.target.value))}
                className="mf-slider"
              />
            </div>
          )}

          {/* Energy Class Selector */}
          <div className="mf-control-group">
            <label className="mf-field-label">Classe Energetica Attuale Immobile</label>
            <select
              className="mf-select"
              value={config.currentEnergyClass || 'D'}
              onChange={e => handleConfigChange('currentEnergyClass', e.target.value as any)}
            >
              <option value="A">Classe A (+1.5% premio UE)</option>
              <option value="B">Classe B (+1.5% premio UE)</option>
              <option value="C">Classe C (Neutra)</option>
              <option value="D">Classe D (Neutra)</option>
              <option value="E">Classe E (-2.0% sanzione UE)</option>
              <option value="F">Classe F (-2.0% sanzione UE)</option>
              <option value="G">Classe G (-2.0% sanzione UE)</option>
            </select>
          </div>

          {/* Energy Class Toggle (EU Case Verdi) */}
          <div className="mf-toggle-card">
            <div className="mf-toggle-info">
              <span className="mf-toggle-title">🍃 Upgrade Classe Energetica (UE "Case Verdi")</span>
              <span className="mf-toggle-desc">
                Classe Attuale: <strong>{config.currentEnergyClass || 'D'}</strong>.
                {config.energyClassUpgrade
                  ? ' Upgrade a Classe A/B attivo (+1.5%/anno premio).'
                  : ['E','F','G'].includes(config.currentEnergyClass || '')
                    ? ' Penalizzazione -2.0%/anno attiva per classe inefficiente E-G.'
                    : ' Nessuna sanzione.'}
              </span>
            </div>
            <label className="mf-switch">
              <input
                type="checkbox"
                checked={config.energyClassUpgrade}
                onChange={e => handleConfigChange('energyClassUpgrade', e.target.checked)}
              />
              <span className="mf-switch-slider" />
            </label>
          </div>

          {/* Benchmark ETF World Toggle */}
          <div className="mf-toggle-card">
            <div className="mf-toggle-info">
              <span className="mf-toggle-title">📊 Benchmark ETF World (MSCI World)</span>
              <span className="mf-toggle-desc">
                Confronta l'accumulo patrimoniale dell'immobile rispetto all'investimento del solo capitale cash iniziale in un ETF Azionario Mondiale (rendimento est. {config.etfAnnualReturn || 7.0}%/anno).
              </span>
            </div>
            <label className="mf-switch">
              <input
                type="checkbox"
                checked={config.enableEtfBenchmark}
                onChange={e => handleConfigChange('enableEtfBenchmark', e.target.checked)}
              />
              <span className="mf-switch-slider" />
            </label>
          </div>

          {/* Tax Deductions 730 Control */}
          <div className="mf-toggle-card" style={{ borderColor: (config.includeTaxDeductions !== false && effectiveQuota > 0) ? 'rgba(168, 85, 247, 0.45)' : undefined, flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div className="mf-toggle-info">
                <span className="mf-toggle-title" style={{ color: '#c084fc', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🧾</span>
                  <span>Detrazioni Ristrutturazione 730 (10 Anni)</span>
                </span>
                <span className="mf-toggle-desc">
                  {hasRealInvoices ? (
                    <>Rilevate <strong>{deductionSummary.invoiceCount} fatture</strong> archiviate per questo immobile ({eur(deductionSummary.totalEligibleBase)} di spesa). Quota calcolata: <strong style={{ color: '#c084fc' }}>+{eur(deductionSummary.currentYearQuota)}/anno</strong> per 10 anni.</>
                  ) : (
                    <>Simula l'impatto fiscale in 10 rate annuali di futuri lavori di ristrutturazione/ecobonus previsti (es. per Besozzo 14).</>
                  )}
                </span>
              </div>
              <label className="mf-switch" style={{ flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={config.includeTaxDeductions !== false}
                  onChange={e => handleConfigChange('includeTaxDeductions', e.target.checked)}
                />
                <span className="mf-switch-slider" />
              </label>
            </div>

            {!hasRealInvoices && config.includeTaxDeductions !== false && (
              <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px dashed rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="mf-field-label" style={{ fontSize: 10.5, color: '#c084fc' }}>Spesa Lavori Prevista (€)</label>
                  <input
                    type="number"
                    step="1000"
                    placeholder="Es. 40000"
                    className="mf-select"
                    style={{ fontFamily: 'var(--mono)', padding: '6px 8px', fontSize: 11.5 }}
                    value={config.simulationRenovationCost || ''}
                    onChange={e => handleConfigChange('simulationRenovationCost', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="mf-field-label" style={{ fontSize: 10.5, color: '#c084fc' }}>Aliquota Bonus Detrazione</label>
                  <select
                    className="mf-select"
                    style={{ padding: '6px 8px', fontSize: 11.5 }}
                    value={config.simulationDeductionRate || 50}
                    onChange={e => handleConfigChange('simulationDeductionRate', parseInt(e.target.value, 10) || 50)}
                  >
                    <option value={50}>Bonus Casa 50% (Ristrutturazioni)</option>
                    <option value={65}>Ecobonus 65% (Efficienza energetica)</option>
                    <option value={36}>Bonus 36% (Seconda Casa)</option>
                  </select>
                </div>
                {(config.simulationRenovationCost || 0) > 0 && (
                  <div style={{ gridColumn: 'span 2', fontSize: 11, color: '#c084fc', background: 'rgba(168, 85, 247, 0.1)', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(168, 85, 247, 0.25)' }}>
                    Quota calcolata: <strong>+{eur(simulatedQuota)}/anno</strong> per 10 anni (Totale recupero 730: {eur(simulatedQuota * 10)})
                  </div>
                )}
              </div>
            )}
          </div>
          {/* RIEPILOGO FINANZIAMENTO MUTUO A SCADENZA */}
          {hasMortgage && (
            <div className="mf-toggle-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, background: 'rgba(15, 23, 42, 0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mf-toggle-title" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📑</span>
                  <span>Piano Mutuo a Scadenza</span>
                </span>
                <span style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>
                  {property.financials?.mortgageDuration || 30} anni
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 8px', borderRadius: 6 }}>
                  <span style={{ color: 'var(--dim)', fontSize: 9.5, display: 'block' }}>Capitale Erogato:</span>
                  <strong style={{ color: '#38bdf8', fontFamily: 'var(--mono)' }}>{eur(forecastData.initialLoanPrincipal || 0)}</strong>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 8px', borderRadius: 6 }}>
                  <span style={{ color: 'var(--dim)', fontSize: 9.5, display: 'block' }}>Interessi a Scadenza:</span>
                  <strong style={{ color: '#f87171', fontFamily: 'var(--mono)' }}>{eur(forecastData.totalMortgageInterestLifetime || 0)}</strong>
                </div>

                <div style={{ gridColumn: 'span 2', background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '6px 8px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: 'var(--dim)', fontSize: 9.5, display: 'block' }}>Totale (Capitale + Interessi):</span>
                    <strong style={{ color: '#38bdf8', fontFamily: 'var(--mono)', fontSize: 13 }}>
                      {eur(forecastData.totalMortgageCostLifetime || 0)}
                    </strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--dim)', fontSize: 9, display: 'block' }}>Tasso Applicato:</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#fcd34d' }}>
                      {forecastData.effectiveMortgageRate}%/a
                    </span>
                  </div>
                </div>
              </div>

              {/* Tasso Mutuo Custom Input */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 2 }}>
                <label className="mf-field-label" style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 0 }}>
                  Personalizza Tasso Annuo (%):
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="15"
                  placeholder="Es. 2.9"
                  className="mf-select"
                  style={{ width: 85, fontFamily: 'var(--mono)', padding: '4px 6px', fontSize: 11, textAlign: 'right' }}
                  value={config.simulationMortgageRate ?? 3.5}
                  onChange={e => handleConfigChange('simulationMortgageRate', Math.max(0.1, parseFloat(e.target.value) || 3.5))}
                />
              </div>
            </div>
          )}

          {/* SIMULATORE ESTINZIONI PARZIALI MUTUO */}
          {hasMortgage && (
            <div className="mf-toggle-card mf-payoff-box" style={{ borderColor: (config.simulationPayoffAmount || 0) > 0 ? 'rgba(56, 189, 248, 0.45)' : undefined, flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <span className="mf-toggle-title" style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🏦</span>
                    <span>Simulatore Estinzione Parziale Mutuo</span>
                  </span>
                  <span className="mf-toggle-desc">
                    Calcola l'impatto di un versamento straordinario sul debito residuo e il risparmio totale di interessi.
                  </span>
                </div>
                {(config.simulationPayoffAmount || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => handleConfigChange('simulationPayoffAmount', 0)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--dim)', fontSize: 10.5, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Azzera
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="mf-field-label" style={{ fontSize: 10.5, color: '#38bdf8' }}>Importo Estinzione (€)</label>
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    placeholder="Es. 10000"
                    className="mf-select"
                    style={{ fontFamily: 'var(--mono)', padding: '6px 8px', fontSize: 11.5 }}
                    value={config.simulationPayoffAmount || ''}
                    onChange={e => handleConfigChange('simulationPayoffAmount', Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                </div>
                <div>
                  <label className="mf-field-label" style={{ fontSize: 10.5, color: '#38bdf8' }}>Anno Esecuzione</label>
                  <select
                    className="mf-select"
                    style={{ padding: '6px 8px', fontSize: 11.5 }}
                    value={config.simulationPayoffYear || 3}
                    onChange={e => handleConfigChange('simulationPayoffYear', parseInt(e.target.value, 10))}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(y => (
                      <option key={y} value={y}>
                        Anno {y} ({baseYear + y - 1})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mf-field-label" style={{ fontSize: 10.5, color: '#38bdf8' }}>Strategia Estinzione Parziale</label>
                <div className="mf-seg-buttons">
                  <button
                    type="button"
                    className={`mf-seg-btn ${config.simulationPayoffStrategy !== 'REDUCE_DURATION' ? 'active' : ''}`}
                    onClick={() => handleConfigChange('simulationPayoffStrategy', 'REDUCE_INSTALLMENT')}
                    style={{ fontSize: 10, padding: '6px 8px' }}
                  >
                    📉 Riduci Rata Mensile
                  </button>
                  <button
                    type="button"
                    className={`mf-seg-btn ${config.simulationPayoffStrategy === 'REDUCE_DURATION' ? 'active' : ''}`}
                    onClick={() => handleConfigChange('simulationPayoffStrategy', 'REDUCE_DURATION')}
                    style={{ fontSize: 10, padding: '6px 8px' }}
                  >
                    ⏳ Riduci Durata Mutuo
                  </button>
                </div>
              </div>

              {/* Box Riepilogo Risparmio e Tasto Validazione */}
              {payoffSummary && payoffSummary.applicable && (
                <div className="mf-payoff-summary" style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: 8, padding: 10, marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>💡 Risultato Simulazione:</span>
                    <span style={{ fontSize: 10, color: '#7dd3fc', fontFamily: 'var(--mono)' }}>Anno {payoffSummary.payoffYear} ({payoffSummary.calendarYear})</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 8px', borderRadius: 6 }}>
                      <span style={{ color: 'var(--dim)', fontSize: 9.5, display: 'block' }}>Debito pre/post:</span>
                      <span style={{ fontFamily: 'var(--mono)' }}>{eur(payoffSummary.previousDebtAtPayoff)} ➔ <strong style={{ color: '#38bdf8' }}>{eur(payoffSummary.newDebtAtPayoff)}</strong></span>
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 8px', borderRadius: 6 }}>
                      <span style={{ color: 'var(--dim)', fontSize: 9.5, display: 'block' }}>Interessi Totali Risparmiati:</span>
                      <strong style={{ color: '#34d399', fontFamily: 'var(--mono)', fontSize: 12 }}>{seur(payoffSummary.totalInterestSaved)}</strong>
                    </div>

                    {payoffSummary.strategy === 'REDUCE_INSTALLMENT' ? (
                      <div style={{ gridColumn: 'span 2', background: 'rgba(255, 255, 255, 0.03)', padding: '6px 8px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ color: 'var(--dim)', fontSize: 9.5, display: 'block' }}>Nuova Rata Mensile:</span>
                          <span style={{ fontFamily: 'var(--mono)' }}>{eur(payoffSummary.originalMonthlyInstallment)} ➔ <strong style={{ color: '#38bdf8' }}>{eur(payoffSummary.newMonthlyInstallment)}/m</strong></span>
                        </div>
                        <span style={{ color: '#34d399', fontWeight: 700, fontSize: 11 }}>
                          +{eur(payoffSummary.monthlySavings)}/mese cashflow
                        </span>
                      </div>
                    ) : (
                      <div style={{ gridColumn: 'span 2', background: 'rgba(255, 255, 255, 0.03)', padding: '6px 8px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ color: 'var(--dim)', fontSize: 9.5, display: 'block' }}>Durata Residua Mutuo:</span>
                          <span style={{ fontFamily: 'var(--mono)' }}>{payoffSummary.originalRemainingYears} anni ➔ <strong style={{ color: '#38bdf8' }}>{payoffSummary.newRemainingYears} anni</strong></span>
                        </div>
                        <span style={{ color: '#34d399', fontWeight: 700, fontSize: 11 }}>
                          -{payoffSummary.yearsSaved} anni anticipati
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Pulsante Valida & Applica */}
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="mf-btn mf-btn-payoff"
                      onClick={handleValidatePayoff}
                      title="Salva e applica definitivamente questa estinzione ai parametri finanziari dell'immobile"
                      style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#fff', fontSize: 10.5, padding: '7px 12px' }}
                    >
                      <span>⚡ Valida &amp; Applica al Mutuo</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Recharts 4-Curve Chart */}
        <div className="mf-panel mf-chart-panel">
          <div className="mf-chart-header">
            <div>
              <h3 className="mf-panel-title">📉 Curva Previsionale &amp; Accumulo Patrimoniale (10 Anni)</h3>
              <p className="mf-chart-sub">Valore Immobile, Equità Accumulata, Debito Residuo e Benchmark ETF</p>
            </div>
          </div>

          <div className="mf-chart-box">
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--grid-line, rgba(255,255,255,0.06))" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--dim, #8b97ab)' }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'var(--dim, #8b97ab)' }}
                  tickFormatter={val => `€${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 15, fontSize: 11 }} />

                {/* Curve 1: Valore Immobile V(t) */}
                <Line
                  type="monotone"
                  dataKey="propertyValue"
                  name="Valore Immobile V(t)"
                  stroke="#2f8fff"
                  strokeWidth={2.8}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />

                {/* Curve 2: Equità Netta Accumulata */}
                <Line
                  type="monotone"
                  dataKey="accumulatedEquity"
                  name="Equità Netta (Valore − Mutuo)"
                  stroke="#6f63ff"
                  strokeWidth={2.5}
                  dot={false}
                />

                {/* Curve 3: Debito Mutuo Residuo */}
                <Line
                  type="monotone"
                  dataKey="remainingDebt"
                  name="Debito Mutuo Residuo"
                  stroke="#fb6f86"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />

                {/* Curve 4: ETF World Benchmark (Optional Toggle) */}
                {config.enableEtfBenchmark && (
                  <Line
                    type="monotone"
                    dataKey="etfBenchmark"
                    name="Benchmark ETF World (7%/a)"
                    stroke="#f5b942"
                    strokeWidth={2.5}
                    strokeDasharray="3 3"
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast Metrics Table (Years 1, 3, 5, 10) */}
          {/* Forecast Metrics Table (Years 1, 3, 5, 10 + Payoff Year if set) */}
          <div className="mf-table-box">
            <table className="mf-table">
              <thead>
                <tr>
                  <th>Orizzonte</th>
                  <th>Valore Immobile</th>
                  <th>Equità Netta</th>
                  <th>Debito Mutuo</th>
                  <th>Rata Mutuo/a</th>
                  <th>Canone Netto/a</th>
                  <th>Detrazione 730</th>
                  <th>NCF Annuo</th>
                  {config.enableEtfBenchmark && <th>ETF World</th>}
                </tr>
              </thead>
              <tbody>
                {Array.from(new Set([1, 3, 5, 10, config.simulationPayoffAmount ? (config.simulationPayoffYear || 3) : 1]))
                  .sort((a, b) => a - b)
                  .map(yr => {
                    const item = projections[yr - 1];
                    if (!item) return null;
                    const hasYrDeduction = (item.taxDeductionQuota || 0) > 0;
                    const isPayoff = item.isPayoffYear;
                    return (
                      <tr key={yr} style={{ background: isPayoff ? 'rgba(56, 189, 248, 0.08)' : undefined }}>
                        <td className="mf-td-year">
                          {yr} {yr === 1 ? 'Anno' : 'Anni'} ({item.calendarYear || baseYear + yr - 1})
                          {item.ownershipMonths != null && item.ownershipMonths < 12 && (
                            <span style={{ display: 'block', fontSize: 9.5, color: '#38bdf8' }}>
                              ({item.ownershipMonths} mesi possesso)
                            </span>
                          )}
                          {isPayoff && (
                            <span style={{ marginLeft: 6, fontSize: 9, color: '#38bdf8', border: '1px solid rgba(56,189,248,0.4)', borderRadius: 3, padding: '1px 3px' }}>
                              Estinzione
                            </span>
                          )}
                        </td>
                        <td className="mf-td-num">{eur(item.propertyValue)}</td>
                        <td className="mf-td-num mf-accent">{eur(item.accumulatedEquity)}</td>
                        <td className="mf-td-num mf-neg">{eur(item.remainingMortgageDebt)}</td>
                        <td className="mf-td-num" style={{ color: item.annualMortgagePayment ? '#fca5a5' : 'var(--dim)' }}>
                          {item.annualMortgagePayment ? eur(item.annualMortgagePayment) : '€ 0'}
                          {item.mortgageMonthsPaid != null && item.mortgageMonthsPaid < 12 && (item.annualMortgagePayment || 0) > 0 && (
                            <span style={{ display: 'block', fontSize: 9.5, color: '#f59e0b' }}>
                              ({item.mortgageMonthsPaid} rate)
                            </span>
                          )}
                          {(item.annualPrincipalPayment || 0) > 0 && (
                            <span style={{ display: 'block', fontSize: 9, color: '#34d399', fontFamily: 'var(--mono)' }}>
                              Cap: +{eur(item.annualPrincipalPayment || 0)}
                            </span>
                          )}
                          {(item.annualInterestPayment || 0) > 0 && (
                            <span style={{ display: 'block', fontSize: 9, color: '#f87171', fontFamily: 'var(--mono)' }}>
                              Int: -{eur(item.annualInterestPayment || 0)}
                            </span>
                          )}
                        </td>
                        <td className="mf-td-num">{eur(item.annualNetRent)}</td>
                        <td className="mf-td-num" style={{ color: hasYrDeduction ? '#c084fc' : 'var(--dim)' }}>
                          {config.includeTaxDeductions !== false
                            ? (hasYrDeduction ? `+${eur(item.taxDeductionQuota || 0)}` : '€ 0')
                            : 'Esclusa'}
                        </td>
                        <td className={`mf-td-num ${item.netCashFlow >= 0 ? 'mf-pos' : 'mf-neg'}`}>
                          {seur(item.netCashFlow)}
                        </td>
                        {config.enableEtfBenchmark && (
                          <td className="mf-td-num mf-warn">{eur(item.etfWorldBenchmarkValue)}</td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const MF_STYLES = `
.mf-container {
  display: flex; flex-direction: column; gap: 20px; text-align: left;
  --bg-panel: rgba(17, 24, 39, 0.85); --border-color: rgba(255, 255, 255, 0.08);
}
.mf-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.mf-eyebrow { font-family: var(--mono, monospace); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; color: var(--accent, #2f8fff); }
.mf-title { font-size: 22px; font-weight: 700; margin: 4px 0 2px; }
.mf-sub { font-size: 12px; color: var(--dim, #8b97ab); margin: 0; }
.mf-btn { border: none; cursor: pointer; font-weight: 700; font-size: 11px; text-transform: uppercase; padding: 10px 16px; border-radius: 9px; display: inline-flex; align-items: center; gap: 6px; }
.mf-btn-primary { background: var(--accent, #2f8fff); color: #fff; box-shadow: 0 6px 20px -8px var(--glow, rgba(47,143,255,0.4)); }
.mf-btn-primary:hover { filter: brightness(1.1); }

.mf-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
.mf-kpi-card { background: var(--panel, #111827); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; position: relative; overflow: hidden; }
.mf-kpi-hero { border-color: rgba(47, 143, 255, 0.3); background: linear-gradient(135deg, rgba(47, 143, 255, 0.08) 0%, rgba(17, 24, 39, 0.95) 100%); }
.mf-kpi-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.mf-kpi-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim, #8b97ab); }
.mf-kpi-val { font-family: var(--mono, monospace); font-size: 22px; font-weight: 700; color: var(--text, #eaeff7); }
.mf-kpi-sub { font-size: 10.5px; color: var(--dim, #8b97ab); margin-top: 4px; }
.mf-kpi-badge { font-family: var(--mono, monospace); font-size: 10px; font-weight: 700; padding: 3px 6px; border-radius: 5px; }
.mf-badge-pos { background: rgba(47, 214, 163, 0.15); color: #2fd6a3; }
.mf-badge-neg { background: rgba(251, 111, 134, 0.15); color: #fb6f86; }

.mf-main-grid { display: grid; grid-template-columns: 320px 1fr; gap: 18px; }
@media (max-width: 1024px) { .mf-main-grid { grid-template-columns: 1fr; } }

.mf-panel { background: var(--panel, #111827); border: 1px solid var(--border-color); border-radius: 14px; padding: 20px; }
.mf-panel-title { font-size: 14px; font-weight: 700; margin: 0 0 16px; }

.mf-control-group { margin-bottom: 18px; display: flex; flex-direction: column; gap: 6px; }
.mf-control-label { display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: var(--text, #eaeff7); }
.mf-control-val { font-family: var(--mono, monospace); color: var(--accent, #2f8fff); }
.mf-slider { width: 100%; height: 5px; border-radius: 3px; accent-color: var(--accent, #2f8fff); cursor: pointer; }
.mf-control-hints { display: flex; justify-content: space-between; font-size: 9px; color: var(--faint, #58637a); }

.mf-field-label { font-size: 11px; font-weight: 600; margin-bottom: 4px; }
.mf-select { background: var(--inset, #0c121e); border: 1px solid var(--border-color); color: var(--text, #eaeff7); font-size: 11px; padding: 9px 12px; border-radius: 8px; width: 100%; }
.mf-seg-buttons { display: flex; gap: 6px; }
.mf-seg-btn { flex: 1; font-size: 10px; font-weight: 600; padding: 8px; border-radius: 7px; border: 1px solid var(--border-color); background: var(--inset, #0c121e); color: var(--dim, #8b97ab); cursor: pointer; }
.mf-seg-btn.active { background: var(--accent, #2f8fff); color: #fff; border-color: var(--accent, #2f8fff); }

.mf-toggle-card { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border-radius: 10px; background: var(--inset, #0c121e); border: 1px solid var(--border-color); margin-bottom: 14px; }
.mf-toggle-title { font-size: 11px; font-weight: 700; display: block; }
.mf-toggle-desc { font-size: 9.5px; color: var(--dim, #8b97ab); margin-top: 3px; display: block; line-height: 1.3; }

.mf-switch { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; }
.mf-switch input { opacity: 0; width: 0; height: 0; }
.mf-switch-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--faint, #58637a); transition: .3s; border-radius: 20px; }
.mf-switch-slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
.mf-switch input:checked + .mf-switch-slider { background-color: var(--accent, #2f8fff); }
.mf-switch input:checked + .mf-switch-slider:before { transform: translateX(16px); }

.mf-chart-box { width: 100%; height: 380px; margin-top: 10px; }
.mf-chart-sub { font-size: 11px; color: var(--dim, #8b97ab); margin: 2px 0 0; }

.mf-tooltip { background: rgba(10, 14, 22, 0.95); border: 1px solid var(--border-color); padding: 10px 14px; border-radius: 8px; font-size: 11px; }
.mf-tt-label { font-weight: 700; color: var(--accent, #2f8fff); margin-bottom: 6px; }
.mf-tt-row { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
.mf-tt-dot { width: 6px; height: 6px; border-radius: 50%; }
.mf-tt-name { color: var(--dim, #8b97ab); }
.mf-tt-val { font-family: var(--mono, monospace); font-weight: 600; margin-left: auto; }

.mf-table-box { margin-top: 20px; overflow-x: auto; }
.mf-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.mf-table th { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border-color); color: var(--dim, #8b97ab); font-weight: 600; }
.mf-table td { padding: 10px; border-bottom: 1px solid var(--border-color); }
.mf-td-year { font-weight: 700; color: var(--text, #eaeff7); }
.mf-td-num { font-family: var(--mono, monospace); }

.mf-accent { color: var(--accent, #2f8fff); }
.mf-pos { color: #2fd6a3; }
.mf-neg { color: #fb6f86; }
.mf-warn { color: #f5b942; }

.mf-btn-payoff {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  color: #fff;
  border-radius: 7px;
  box-shadow: 0 4px 14px -4px rgba(2, 132, 199, 0.4);
  transition: all 0.2s ease;
}
.mf-btn-payoff:hover {
  filter: brightness(1.15);
  transform: translateY(-1px);
}
`;
