import React from 'react';
import { NotificationSettings } from '../../types';
import { DEFAULT_MORTGAGE_RADAR_SETTINGS } from '../../services/mortgageService';
import { PATH, ic } from './adminIcons';

interface AdminTelegramCardProps {
  notifSettings: NotificationSettings;
  setNotifSettings: React.Dispatch<React.SetStateAction<NotificationSettings>>;
  isSavingNotifs: boolean;
  notifSuccessMsg: string;
  handleSaveNotifs: () => Promise<void>;
  showTgToken: boolean;
  setShowTgToken: React.Dispatch<React.SetStateAction<boolean>>;
  tgTestFeedback: { success: boolean; message: string } | null;
  isTestingTg: boolean;
  handleTestTelegram: () => Promise<void>;
  isRunningRadarTest: boolean;
  radarTestFeedback: { success: boolean; message: string } | null;
  handleRunAdminMortgageRadar: (sendTg: boolean) => Promise<void>;
  handleToggleRadarEnabled: (newVal: boolean) => Promise<void>;
}

export const AdminTelegramCard: React.FC<AdminTelegramCardProps> = ({
  notifSettings,
  setNotifSettings,
  isSavingNotifs,
  notifSuccessMsg,
  handleSaveNotifs,
  showTgToken,
  setShowTgToken,
  tgTestFeedback,
  isTestingTg,
  handleTestTelegram,
  isRunningRadarTest,
  radarTestFeedback,
  handleRunAdminMortgageRadar,
  handleToggleRadarEnabled
}) => {
  return (
    <section className="ipb-card span-12" id="sec-notifications">
      <div className="ipb-card-header">
        <div className="ipb-card-title-group">
          <div className="ipb-icon-wrap cyan">
            <span className="text-base">✈️</span>
          </div>
          <div>
            <h2 className="ipb-card-title">Scadenziario Canoni & Bot Telegram</h2>
            <p className="ipb-card-subtitle">Promemoria automatici e invio quietanze PDF</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {notifSuccessMsg && (
            <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30">
              <span>✓</span> {notifSuccessMsg}
            </span>
          )}
          <button
            type="button"
            className="ipb-btn ipb-btn-primary"
            onClick={handleSaveNotifs}
            disabled={isSavingNotifs}
          >
            {ic(PATH.save, 14)}
            <span>{isSavingNotifs ? 'Salvataggio…' : 'Salva Automazioni'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 p-6">
        <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
            <span>⏱️</span>
            <span>Parametri Scadenziario</span>
          </div>
          <div className="ipb-field">
            <label>Anticipo Promemoria Scadenza (Giorni)</label>
            <input
              type="number"
              min="1"
              max="30"
              className="ipb-input mono"
              value={notifSettings.reminderAdvanceDays}
              onChange={e => setNotifSettings({ ...notifSettings, reminderAdvanceDays: parseInt(e.target.value) || 5 })}
            />
            <p className="text-[11px] text-slate-400 mt-1">Giorni prima della scadenza in cui inviare il promemoria (default: 5).</p>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-700/60">
            <div>
              <span className="text-xs font-bold text-slate-200 block">Controllo Automatico Attivo</span>
              <span className="text-[10px] text-slate-400">Verifica scadenze a ogni avvio e su base oraria</span>
            </div>
            <input
              type="checkbox"
              checked={notifSettings.autoCheckEnabled}
              onChange={e => setNotifSettings({ ...notifSettings, autoCheckEnabled: e.target.checked })}
              className="w-4 h-4 rounded text-brand-600 cursor-pointer"
            />
          </div>
        </div>

        <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
              <span>✈️</span>
              <span>Bot Telegram</span>
            </div>
            <input
              type="checkbox"
              checked={notifSettings.telegram.enabled}
              onChange={e => setNotifSettings({
                ...notifSettings,
                telegram: { ...notifSettings.telegram, enabled: e.target.checked }
              })}
              className="w-4 h-4 rounded text-sky-500 cursor-pointer"
            />
          </div>

          <div className="space-y-3">
            <div className="ipb-field">
              <label>Bot Token Telegram</label>
              <div className="relative">
                <input
                  type={showTgToken ? 'text' : 'password'}
                  placeholder="123456789:ABCdefGHI..."
                  className="ipb-input mono pr-10"
                  value={notifSettings.telegram.botToken}
                  onChange={e => setNotifSettings({
                    ...notifSettings,
                    telegram: { ...notifSettings.telegram, botToken: e.target.value }
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowTgToken(!showTgToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  {showTgToken ? 'Nascondi' : 'Mostra'}
                </button>
              </div>
            </div>

            <div className="ipb-field">
              <label>Chat ID Proprietario (Alerts &amp; Quietanze)</label>
              <input
                type="text"
                placeholder="Es. 123456789"
                className="ipb-input mono"
                value={notifSettings.telegram.ownerChatId}
                onChange={e => setNotifSettings({
                  ...notifSettings,
                  telegram: { ...notifSettings.telegram, ownerChatId: e.target.value }
                })}
              />
            </div>

            <div className="space-y-1.5 text-xs text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifSettings.telegram.notifyOwnerOnDue}
                  onChange={e => setNotifSettings({
                    ...notifSettings,
                    telegram: { ...notifSettings.telegram, notifyOwnerOnDue: e.target.checked }
                  })}
                  className="w-3.5 h-3.5 rounded text-sky-500"
                />
                <span>Invia alert al proprietario su canoni in scadenza</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifSettings.telegram.notifyTenantOnDue}
                  onChange={e => setNotifSettings({
                    ...notifSettings,
                    telegram: { ...notifSettings.telegram, notifyTenantOnDue: e.target.checked }
                  })}
                  className="w-3.5 h-3.5 rounded text-sky-500"
                />
                <span>Invia promemoria automatico all'inquilino (se impostato Chat ID)</span>
              </label>
            </div>
          </div>

          {tgTestFeedback && (
            <div className={`p-2.5 rounded-xl border text-xs ${tgTestFeedback.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
              {tgTestFeedback.message}
            </div>
          )}

          <button
            type="button"
            onClick={handleTestTelegram}
            disabled={isTestingTg}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <span>{isTestingTg ? '⏳' : '⚡'}</span>
            <span>{isTestingTg ? 'Verifica Telegram…' : 'Testa Bot Telegram'}</span>
          </button>
        </div>

        {/* RADAR TASSI MUTUI & SURROGHE (BANCHE ITALIA & MILANO) */}
        <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800 space-y-4 md:col-span-2">
          
          {/* Header Card & Master Switch Toggle per Attivare/Disattivare la Visualizzazione nell'App */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border bg-slate-950/70 border-slate-700/60">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all ${
                (notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS).enabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-500 border border-slate-700'
              }`}>
                📡
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-100">
                    Radar Tassi Banche · Italia &amp; Milano
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide transition-all ${
                    (notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS).enabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS).enabled ? '🟢 ATTIVO E VISIBILE NELL\'APP' : '⚪ DISATTIVATO (NASCOSTO NELL\'APP)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 max-w-2xl">
                  {(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS).enabled
                    ? 'La funzionalità è attiva e visibile: il pulsante, il banner nella scheda Patrimonio e il box di confronto mutui sono mostrati normalmente.'
                    : 'La funzionalità è disattivata: tutti i componenti del Radar sono completamente nascosti nell\'app e i report automatici sono sospesi.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleToggleRadarEnabled(!(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS).enabled)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  (notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS).enabled
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/25'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
                }`}
              >
                <span>{(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS).enabled ? '✓ Funzionalità Attiva' : '✕ Funzionalità Disattivata'}</span>
                <span className="text-[10px] opacity-80">
                  (Clicca per {(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS).enabled ? 'Disattivare' : 'Attivare'})
                </span>
              </button>
            </div>
          </div>

          {!(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS).enabled && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
              <span className="text-lg shrink-0">⚠️</span>
              <span>
                La funzionalità e la visualizzazione di <strong>"📡 RADAR TASSI BANCHE · ITALIA &amp; MILANO"</strong> sono attualmente <strong>disattivate</strong>. Nella sezione Patrimonio non verranno mostrati né il pulsante in alto, né il banner, né il modulo di confronto banche. Per ripristinarli, clicca sul pulsante <strong>"Attiva"</strong> qui sopra.
              </span>
            </div>
          )}

          <div className={`space-y-4 transition-all ${
            !(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS).enabled ? 'opacity-40 pointer-events-none' : ''
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-slate-400">
                Monitora i tassi mutuo (TAN/TAEG, IRS/Euribor) di 19 offerte di surroga (BCC Milano, Banco BPM, Webank, Mediobanca Premier, Intesa Sanpaolo, UniCredit, Crédit Agricole, ING, Fineco, BNL, BPER, Credem, Banca Sella).
              </p>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS).autoTelegramAlert}
                  onChange={e => setNotifSettings({
                    ...notifSettings,
                    mortgageRadar: {
                      ...(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS),
                      autoTelegramAlert: e.target.checked
                    }
                  })}
                  className="w-4 h-4 rounded text-sky-500 cursor-pointer"
                />
                <span>Report Automatico Telegram</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="ipb-field">
                <label>Risparmio Minimo Rata (€/mese)</label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="5"
                  className="ipb-input mono"
                  value={(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS).minMonthlySavings}
                  onChange={e => setNotifSettings({
                    ...notifSettings,
                    mortgageRadar: {
                      ...(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS),
                      minMonthlySavings: Math.max(0, isNaN(parseFloat(e.target.value)) ? 0 : parseFloat(e.target.value))
                    }
                  })}
                />
              </div>
              <div className="ipb-field">
                <label>Delta Tasso Minimo (bps)</label>
                <input
                  type="number"
                  min="0"
                  max="300"
                  step="5"
                  className="ipb-input mono"
                  value={(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS).minRateDeltaBps}
                  onChange={e => setNotifSettings({
                    ...notifSettings,
                    mortgageRadar: {
                      ...(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS),
                      minRateDeltaBps: Math.max(0, isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10))
                    }
                  })}
                />
              </div>
              <div className="ipb-field">
                <label>Preferenza Tipo Tasso</label>
                <select
                  className="ipb-input"
                  value={(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS).preferredRateType}
                  onChange={e => setNotifSettings({
                    ...notifSettings,
                    mortgageRadar: {
                      ...(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS),
                      preferredRateType: e.target.value as 'ALL' | 'FIXED' | 'VARIABLE'
                    }
                  })}
                >
                  <option value="ALL">Fisso + Variabile (Migliore Assoluto)</option>
                  <option value="FIXED">Solo Tasso Fisso (IRS)</option>
                  <option value="VARIABLE">Solo Tasso Variabile (Euribor)</option>
                </select>
              </div>
              <div className="ipb-field">
                <label>Chat ID Destinatario (Opz.)</label>
                <input
                  type="text"
                  placeholder="Default: Chat ID Proprietario"
                  className="ipb-input mono"
                  value={(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS).recipientChatId || ''}
                  onChange={e => setNotifSettings({
                    ...notifSettings,
                    mortgageRadar: {
                      ...(notifSettings.mortgageRadar || DEFAULT_MORTGAGE_RADAR_SETTINGS),
                      recipientChatId: e.target.value || undefined
                    }
                  })}
                />
              </div>
            </div>

            {radarTestFeedback && (
              <div className={`p-2.5 rounded-xl border text-xs ${radarTestFeedback.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
                {radarTestFeedback.message}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleRunAdminMortgageRadar(false)}
                disabled={isRunningRadarTest}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <span>{isRunningRadarTest ? '⏳' : '🔍'}</span>
                <span>Analizza Tassi Mutui Ora</span>
              </button>
              <button
                type="button"
                onClick={() => handleRunAdminMortgageRadar(true)}
                disabled={isRunningRadarTest}
                className="flex-1 py-2 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <span>{isRunningRadarTest ? '⏳' : '✈️'}</span>
                <span>Analizza &amp; Invia Report su Telegram</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
