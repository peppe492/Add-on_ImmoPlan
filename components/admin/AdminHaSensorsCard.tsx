import React from 'react';
import { CustomSensor, Property, NotificationSettings } from '../../types';
import { PATH, ic, SENSOR_TYPE_LABEL } from './adminIcons';

interface AdminHaSensorsCardProps {
  notifSettings: NotificationSettings;
  setNotifSettings: React.Dispatch<React.SetStateAction<NotificationSettings>>;
  isSyncingSensors: boolean;
  handleManualSync: () => Promise<void>;
  isTestingHA: boolean;
  handleTestHA: () => Promise<void>;
  haTestFeedback: { success: boolean; message: string } | null;
  customSensors: CustomSensor[];
  handleDeleteSensor: (id: string) => Promise<void>;
  newSensor: Partial<CustomSensor>;
  setNewSensor: React.Dispatch<React.SetStateAction<Partial<CustomSensor>>>;
  handleSensorTypeChange: (type: CustomSensor['type']) => void;
  properties: Property[];
  handleAddSensor: () => Promise<void>;
}

export const AdminHaSensorsCard: React.FC<AdminHaSensorsCardProps> = ({
  notifSettings,
  setNotifSettings,
  isSyncingSensors,
  handleManualSync,
  isTestingHA,
  handleTestHA,
  haTestFeedback,
  customSensors,
  handleDeleteSensor,
  newSensor,
  setNewSensor,
  handleSensorTypeChange,
  properties,
  handleAddSensor
}) => {
  return (
    <section className="ipb-card span-12" id="sec-ha-danger">
      <div className="ipb-card-header">
        <div className="ipb-card-title-group">
          <div className="ipb-icon-wrap cyan">
            {ic(PATH.chip, 19, 2)}
          </div>
          <div>
            <h2 className="ipb-card-title">Integrazione Home Assistant</h2>
            <p className="ipb-card-subtitle">Sensori di stato, notifiche persistenti e telemetria personalizzata</p>
          </div>
        </div>
        <button
          type="button"
          className={`ipb-btn ipb-btn-cyan ${isSyncingSensors ? 'busy' : ''}`}
          onClick={handleManualSync}
          disabled={isSyncingSensors}
        >
          {ic(PATH.sync, 13)}
          <span>{isSyncingSensors ? 'Sincronizzazione…' : 'Forza Push HA'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 p-6">
        <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
              <span>🏠</span>
              <span>Home Assistant Supervisor</span>
            </div>
            <input
              type="checkbox"
              checked={notifSettings.homeAssistant.enabled}
              onChange={e => setNotifSettings({
                ...notifSettings,
                homeAssistant: { ...notifSettings.homeAssistant, enabled: e.target.checked }
              })}
              className="w-4 h-4 rounded text-sky-500 cursor-pointer"
            />
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-xl">
              <span>Aggiornamento Sensore Stato</span>
              <span className="font-mono text-cyan-400 text-[11px]">{notifSettings.homeAssistant.sensorEntityId}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-xl">
              <span>Notifiche Persistenti UI</span>
              <input
                type="checkbox"
                checked={notifSettings.homeAssistant.persistentNotifications}
                onChange={e => setNotifSettings({
                  ...notifSettings,
                  homeAssistant: { ...notifSettings.homeAssistant, persistentNotifications: e.target.checked }
                })}
                className="w-3.5 h-3.5 rounded text-sky-500 cursor-pointer"
              />
            </div>
          </div>
          {haTestFeedback && (
            <div className={`p-2.5 rounded-xl border text-xs ${haTestFeedback.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
              {haTestFeedback.message}
            </div>
          )}
          <button
            type="button"
            onClick={handleTestHA}
            disabled={isTestingHA}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <span>{isTestingHA ? '⏳' : '⚡'}</span>
            <span>{isTestingHA ? 'Verifica in corso…' : 'Testa Connessione HA'}</span>
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800 h-full">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm mb-4">
              <span>📡</span>
              <span>Sensori Personalizzati</span>
            </div>
            {/* LISTA SENSORI ATTIVI */}
            <div className="ipb-sensors-container">
              {customSensors.length === 0 ? (
                <div className="ipb-empty-sensors">
                  <p>Nessun sensore personalizzato configurato. Utilizza il modulo qui sotto per crearne uno e integrarlo in Home Assistant.</p>
                </div>
              ) : (
                <div className="ipb-sensors-list">
                  {customSensors.map(s => (
                    <div className="ipb-sensor-item" key={s.id}>
                      <div className="ipb-sensor-left">
                        <span className="ipb-sensor-live-dot" />
                        <div>
                          <div className="ipb-sensor-name">{s.name}</div>
                          <div className="ipb-sensor-id mono">sensor.immoplan_{s.entity_id_suffix}</div>
                        </div>
                      </div>
                      <div className="ipb-sensor-right">
                        <span className="ipb-sensor-target-tag">
                          {s.targetId === 'GLOBAL' ? 'GLOBALE' : s.targetId}
                        </span>
                        <span className="ipb-sensor-tag">
                          {SENSOR_TYPE_LABEL[s.type] || s.type}
                        </span>
                        <button
                          type="button"
                          className="ipb-btn-trash"
                          onClick={() => handleDeleteSensor(s.id)}
                          title="Elimina sensore"
                        >
                          {ic(PATH.trash, 14)}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FORM ORGANIZZATO A GRID PER AGGIUNTA SENSORE */}
            <div className="ipb-add-sensor-box">
              <div className="ipb-add-title">Aggiungi Nuovo Sensore Home Assistant</div>
              <div className="ipb-add-grid">
                <div className="ipb-field">
                  <label>Nome Sensore</label>
                  <input
                    className="ipb-input"
                    value={newSensor.name || ''}
                    onChange={e => setNewSensor({ ...newSensor, name: e.target.value })}
                    placeholder="Es. Cashflow Navigli"
                  />
                </div>

                <div className="ipb-field">
                  <label>Entity ID Suffix</label>
                  <div className="ipb-prefixed-input">
                    <span className="ipb-prefix-label mono">sensor.immoplan_</span>
                    <input
                      className="ipb-input bare"
                      value={newSensor.entity_id_suffix || ''}
                      onChange={e => setNewSensor({ ...newSensor, entity_id_suffix: e.target.value })}
                      placeholder="cashflow_loft"
                    />
                  </div>
                </div>

                <div className="ipb-field">
                  <label>Tipologia Metrica</label>
                  <select
                    className="ipb-input ipb-select"
                    value={newSensor.type || 'PROPERTY_CASHFLOW'}
                    onChange={e => handleSensorTypeChange(e.target.value as any)}
                  >
                    <option value="PROPERTY_CASHFLOW">Cashflow Netto</option>
                    <option value="PROPERTY_VALUE">Valore Attuale</option>
                    <option value="CATEGORY_TOTAL">Totale Categoria Spesa</option>
                    <option value="CALENDAR_EVENTS">Calendario & Scadenze (JSON)</option>
                  </select>
                </div>

                <div className="ipb-field">
                  <label>Target Entità</label>
                  <select
                    className="ipb-input ipb-select"
                    value={newSensor.type === 'CALENDAR_EVENTS' ? 'GLOBAL' : (newSensor.targetId || '')}
                    disabled={newSensor.type === 'CALENDAR_EVENTS'}
                    onChange={e => setNewSensor({ ...newSensor, targetId: e.target.value })}
                  >
                    {newSensor.type === 'CALENDAR_EVENTS' ? (
                      <option value="GLOBAL">Globale (Tutti gli immobili & scadenze)</option>
                    ) : newSensor.type === 'CATEGORY_TOTAL' ? (
                      <>
                        <option value="">Seleziona Categoria…</option>
                        <option value="MORTGAGE">Mutui & Finanziamenti</option>
                        <option value="TAX">Tasse (IMU, TARI, Cedolare)</option>
                        <option value="MAINTENANCE">Manutenzione Ordinaria/Straord.</option>
                      </>
                    ) : properties.length > 0 ? (
                      <>
                        <option value="">Seleziona Immobile…</option>
                        {properties.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </>
                    ) : (
                      <option value="" disabled>Nessun immobile configurato</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="ipb-add-actions">
                <span className="ipb-sensor-preview-note mono">
                  Anteprima: <strong>sensor.immoplan_{newSensor.entity_id_suffix ? newSensor.entity_id_suffix.toLowerCase().replace(/[^a-z0-9_]/g, '_') : 'nome_sensore'}</strong>
                </span>
                <button
                  type="button"
                  className="ipb-btn ipb-btn-primary"
                  onClick={handleAddSensor}
                >
                  {ic(PATH.plus, 14)}
                  <span>Registra Sensore</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
