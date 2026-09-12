import React, { useState, useMemo, useEffect } from 'react';
import { Property, ForecastSimulationConfig, PropertyForecastData } from '../types';
import { calculatePropertyForecast, getDefaultSimulationConfig } from '../services/forecastService';
import { getMicroMarketMetrics } from '../services/openDataService';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface MarketForecasterProps {
  property: Property;
  onSaveForecast?: (updatedProp: Property) => void;
}

const eur = (n: number) => '€ ' + Math.round(n || 0).toLocaleString('it-IT');
const seur = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + '€ ' + Math.abs(Math.round(n || 0)).toLocaleString('it-IT');

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="mf-tooltip">
      <div className="mf-tt-label">Proiezione Anno {label}</div>
      {payload.map((p: any, i: number) => (
        <div className="mf-tt-row" key={i}>
          <span className="mf-tt-dot" style={{ background: p.color || p.stroke }} />
          <span className="mf-tt-name">{p.name}:</span>
          <span className="mf-tt-val">{eur(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export const MarketForecaster: React.FC<MarketForecasterProps> = ({ property, onSaveForecast }) => {
  const [config, setConfig] = useState<ForecastSimulationConfig>(() => {
    return property.forecastData?.config || getDefaultSimulationConfig(property);
  });

  const [metrics, setMetrics] = useState(property.forecastData?.metrics || null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

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
  }, [property]);

  const forecastData: PropertyForecastData = useMemo(() => {
    return calculatePropertyForecast(property, config, metrics || undefined);
  }, [property, config, metrics]);

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

  const projections = forecastData.yearlyProjections;
  const y5 = projections[4] || projections[projections.length - 1];
  const y10 = projections[9] || projections[projections.length - 1];

  const initialVal = property.currentValue || property.purchasePrice || 200000;
  const gain5y = y5 ? y5.propertyValue - initialVal : 0;
  const etfDiff10y = y10 ? (y10.accumulatedEquity + (y10.cumulativeNetCashFlow || 0)) - y10.etfWorldBenchmarkValue : 0;

  const chartData = projections.map(p => ({
    year: `Anno ${p.year}`,
    yearNum: p.year,
    propertyValue: p.propertyValue,
    accumulatedEquity: p.accumulatedEquity,
    remainingDebt: p.remainingMortgageDebt,
    etfBenchmark: p.etfWorldBenchmarkValue,
    netCashFlow: p.netCashFlow
  }));

  return (
    <div className="mf-container">
      <style>{MF_STYLES}</style>

      {/* Header Bar */}
      <div className="mf-header">
        <div>
          <div className="mf-eyebrow">Modulo 5 · Motore Previsionale Finanziario</div>
          <h2 className="mf-title">Trend Prezzi &amp; Simulazione Mercato (1-10 Anni)</h2>
          <p className="mf-sub">Analisi deterministica, impatto Direttiva UE Case Verdi e benchmark competitivo ETF World</p>
        </div>
        <button className="mf-btn mf-btn-primary" onClick={handleSave}>
          💾 Salva Simulazione
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="mf-kpi-grid">
        <div className="mf-kpi-card mf-kpi-hero">
          <div className="mf-kpi-glow" />
          <div className="mf-kpi-top">
            <span className="mf-kpi-label">Valore Stimato (5 Anni)</span>
            <span className="mf-kpi-badge mf-badge-pos">{gain5y >= 0 ? '+' : ''}{((gain5y / initialVal) * 100).toFixed(1)}%</span>
          </div>
          <div className="mf-kpi-val">{eur(y5?.propertyValue || 0)}</div>
          <div className="mf-kpi-sub">Plusvalenza stimata: <span className="mf-pos">{seur(gain5y)}</span></div>
        </div>

        <div className="mf-kpi-card">
          <div className="mf-kpi-top">
            <span className="mf-kpi-label">Equità Netta Immobile (5a)</span>
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
            <span className="mf-kpi-label">Diff. vs ETF World (10 Anni)</span>
            <span className={`mf-kpi-badge ${etfDiff10y >= 0 ? 'mf-badge-pos' : 'mf-badge-neg'}`}>
              {etfDiff10y >= 0 ? 'Supera ETF' : 'Sotto ETF'}
            </span>
          </div>
          <div className="mf-kpi-val" style={{ color: etfDiff10y >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
            {seur(etfDiff10y)}
          </div>
          <div className="mf-kpi-sub">Capitale composto su cash iniziale</div>
        </div>
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
          <div className="mf-table-box">
            <table className="mf-table">
              <thead>
                <tr>
                  <th>Orizzonte</th>
                  <th>Valore Immobile</th>
                  <th>Equità Netta</th>
                  <th>Debito Mutuo</th>
                  <th>Canone Netto/a</th>
                  <th>NCF Annuo</th>
                  {config.enableEtfBenchmark && <th>ETF World</th>}
                </tr>
              </thead>
              <tbody>
                {[1, 3, 5, 10].map(yr => {
                  const item = projections[yr - 1];
                  if (!item) return null;
                  return (
                    <tr key={yr}>
                      <td className="mf-td-year">{yr} {yr === 1 ? 'Anno' : 'Anni'}</td>
                      <td className="mf-td-num">{eur(item.propertyValue)}</td>
                      <td className="mf-td-num mf-accent">{eur(item.accumulatedEquity)}</td>
                      <td className="mf-td-num mf-neg">{eur(item.remainingMortgageDebt)}</td>
                      <td className="mf-td-num">{eur(item.annualNetRent)}</td>
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
`;
