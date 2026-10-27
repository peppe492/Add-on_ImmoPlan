import React from 'react';
import { PATH, ic } from './adminIcons';

interface AdminAiSettingsCardProps {
  apiKeyInput: string;
  setApiKeyInput: (val: string) => void;
  showKey: boolean;
  setShowKey: React.Dispatch<React.SetStateAction<boolean>>;
  apiKeySuccessMsg: boolean;
  handleSaveApiKey: () => void;
  handleClearApiKey: () => void;
}

export const AdminAiSettingsCard: React.FC<AdminAiSettingsCardProps> = ({
  apiKeyInput,
  setApiKeyInput,
  showKey,
  setShowKey,
  apiKeySuccessMsg,
  handleSaveApiKey,
  handleClearApiKey
}) => {
  return (
    <section className="ipb-card span-6" id="sec-api-theme">
      <div className="ipb-card-header">
        <div className="ipb-card-title-group">
          <div className="ipb-icon-wrap amber">
            {ic(PATH.key, 19, 2)}
          </div>
          <div>
            <h2 className="ipb-card-title">Chiave API Gemini AI</h2>
            <p className="ipb-card-subtitle">Abilita il consulente vocale, l'analisi delle fatture e le risposte AI</p>
          </div>
        </div>
      </div>

      <div className="ipb-key-section">
        <div className="ipb-key-input-row">
          <input
            className="ipb-input mono"
            type={showKey ? 'text' : 'password'}
            value={apiKeyInput}
            onChange={e => setApiKeyInput(e.target.value)}
            placeholder="Incolla API Key (AIzaSy...)"
          />
          <button
            type="button"
            className="ipb-input-addon-btn"
            onClick={() => setShowKey(!showKey)}
            title={showKey ? 'Nascondi chiave' : 'Mostra chiave'}
          >
            {ic(showKey ? PATH.eyeoff : PATH.eye, 16)}
          </button>
        </div>
        <div className="ipb-key-meta-row">
          <p className="ipb-field-desc">
            Genera una chiave gratuita su{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="ipb-link-accent"
            >
              Google AI Studio {ic(PATH.external, 11)}
            </a>
            . Memorizzata solo nel tuo browser.
          </p>
          {apiKeyInput && (
            <button
              type="button"
              className="ipb-btn-text-danger"
              onClick={handleClearApiKey}
              title="Rimuovi chiave salvata"
            >
              Rimuovi
            </button>
          )}
        </div>
      </div>

      <div className="ipb-card-footer end-footer">
        {apiKeySuccessMsg && (
          <span className="ipb-success-text" style={{ marginRight: 'auto' }}>
            {ic(PATH.check, 14, 2.5)}
            <span>Chiave API salvata con successo!</span>
          </span>
        )}
        <button
          type="button"
          className="ipb-btn ipb-btn-amber"
          onClick={handleSaveApiKey}
        >
          {ic(PATH.save, 14)}
          <span>Salva Chiave API</span>
        </button>
      </div>
    </section>
  );
};
