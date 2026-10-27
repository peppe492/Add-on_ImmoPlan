import React from 'react';
import { PATH, ic } from './adminIcons';

interface AdminDangerZoneCardProps {
  confirmResetOpen: boolean;
  setConfirmResetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onResetDatabase: () => void;
}

export const AdminDangerZoneCard: React.FC<AdminDangerZoneCardProps> = ({
  confirmResetOpen,
  setConfirmResetOpen,
  onResetDatabase
}) => {
  return (
    <section className="ipb-card span-12 ipb-danger-card">
      <div className="ipb-card-header">
        <div className="ipb-card-title-group">
          <div className="ipb-icon-wrap rose">
            {ic(PATH.warn, 19, 2)}
          </div>
          <div>
            <h2 className="ipb-card-title text-rose">Manutenzione Critica</h2>
            <p className="ipb-card-subtitle">Reset di fabbrica & Ripristino</p>
          </div>
        </div>
      </div>

      <div className="ipb-danger-body">
        <div className="ipb-danger-callout">
          <div className="ipb-callout-header">
            {ic(PATH.warn, 14, 2)}
            <strong>Attenzione: Operazione Irreversibile</strong>
          </div>
          <p className="ipb-callout-text">
            L'eliminazione cancella l'intero database IndexedDB: immobili, spese, storico fatture 730, scenari di simulazione e configurazione locale.
          </p>
        </div>

        {confirmResetOpen && (
          <div className="ipb-confirm-drawer">
            <div className="ipb-confirm-title">
              {ic(PATH.shield, 15)}
              <span>Confermi l'eliminazione definitiva del database?</span>
            </div>
            <div className="ipb-confirm-actions">
              <button
                type="button"
                className="ipb-btn ipb-btn-ghost-sm"
                onClick={() => setConfirmResetOpen(false)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="ipb-btn ipb-btn-danger"
                onClick={() => {
                  setConfirmResetOpen(false);
                  onResetDatabase();
                }}
              >
                {ic(PATH.trash, 13)}
                <span>Sì, Cancella Tutto</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="ipb-card-footer">
        {!confirmResetOpen ? (
          <button
            type="button"
            className="ipb-btn ipb-btn-danger wide"
            onClick={() => setConfirmResetOpen(true)}
          >
            {ic(PATH.trash, 14)}
            <span>Elimina Database Locale</span>
          </button>
        ) : (
          <span className="ipb-dim-note text-rose">Conferma richiesta nel riquadro superiore</span>
        )}
      </div>
    </section>
  );
};
