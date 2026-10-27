import React from 'react';
import { FinancialData } from '../../types';
import { PATH, ic } from './adminIcons';

interface AdminThemeSettingsCardProps {
  appData: FinancialData;
  setTheme: (theme: 'DEFAULT' | 'NEON') => void;
  isNeon: boolean;
}

export const AdminThemeSettingsCard: React.FC<AdminThemeSettingsCardProps> = ({
  appData,
  setTheme,
  isNeon
}) => {
  return (
    <section className="ipb-card span-6">
      <div className="ipb-card-header">
        <div className="ipb-card-title-group">
          <div className="ipb-icon-wrap purple">
            {ic(PATH.palette, 19, 2)}
          </div>
          <div>
            <h2 className="ipb-card-title">Personalizzazione Tema Grafico</h2>
            <p className="ipb-card-subtitle">Seleziona lo stile visivo tra Cyber Bento Dark ad alto contrasto o Light</p>
          </div>
        </div>
      </div>

      <div className="ipb-theme-grid">
        <button
          type="button"
          className={`ipb-theme-card ${appData.theme === 'DEFAULT' ? 'active' : ''}`}
          onClick={() => setTheme('DEFAULT')}
        >
          <div className="ipb-theme-preview light-swatch">
            <span>Aa</span>
          </div>
          <div className="ipb-theme-info">
            <span className="ipb-theme-name">Default · Chiaro</span>
            <span className="ipb-theme-desc">Stile Standard Light pulito</span>
          </div>
          {appData.theme === 'DEFAULT' && <span className="ipb-active-badge" />}
        </button>

        <button
          type="button"
          className={`ipb-theme-card ${isNeon ? 'active' : ''}`}
          onClick={() => setTheme('NEON')}
        >
          <div className="ipb-theme-preview dark-swatch">
            <span>Aa</span>
          </div>
          <div className="ipb-theme-info">
            <span className="ipb-theme-name">Bento · Dark</span>
            <span className="ipb-theme-desc">Cyber Glow • Alto Contrasto</span>
          </div>
          {isNeon && <span className="ipb-active-badge" />}
        </button>
      </div>

      <div className="ipb-card-footer split-footer">
        <span className="ipb-dim-note">
          Preset attivo: <strong className="text-accent">{isNeon ? 'Cyber Bento Dark' : 'Default Chiaro'}</strong>
        </span>
        <span className="ipb-status-pill ok">Design System v2.1</span>
      </div>
    </section>
  );
};
