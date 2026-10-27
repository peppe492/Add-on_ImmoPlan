import React from 'react';
import { PATH, ic } from './adminIcons';

interface AdminUserProfilesCardProps {
  owner1Input: string;
  setOwner1Input: (val: string) => void;
  owner2Input: string;
  setOwner2Input: (val: string) => void;
  u1Initial: string;
  u2Initial: string;
  handleResetDefaultOwners: () => void;
  handleSaveOwners: () => Promise<void>;
  isSavingOwners: boolean;
  ownerSuccessMsg: string;
}

export const AdminUserProfilesCard: React.FC<AdminUserProfilesCardProps> = ({
  owner1Input,
  setOwner1Input,
  owner2Input,
  setOwner2Input,
  u1Initial,
  u2Initial,
  handleResetDefaultOwners,
  handleSaveOwners,
  isSavingOwners,
  ownerSuccessMsg
}) => {
  return (
    <section className="ipb-card span-7" id="sec-users-db">
      <div className="ipb-card-header">
        <div className="ipb-card-title-group">
          <div className="ipb-icon-wrap blue">
            {ic(PATH.users, 19, 2)}
          </div>
          <div>
            <h2 className="ipb-card-title">Anagrafica Utenti & Beneficiari</h2>
            <p className="ipb-card-subtitle">Nomi sincronizzati a cascata in Portafogli, Schede Finanziarie e Detrazioni 730</p>
          </div>
        </div>
        <button
          type="button"
          className="ipb-btn-ghost-sm"
          onClick={handleResetDefaultOwners}
          title="Ripristina 'Giuseppe' e 'Claudia'"
        >
          {ic(PATH.refresh, 12)}
          <span>Default</span>
        </button>
      </div>

      <div className="ipb-users-grid">
        {/* UTENTE 1 */}
        <div className="ipb-user-box blue-box">
          <div className="ipb-user-box-header">
            <span className="ipb-user-tag blue">
              <span className="ipb-user-dot blue" />
              Utente 1 (Principale)
            </span>
            <span className="ipb-initial-badge blue">
              Iniziale: <strong>{u1Initial}</strong>
            </span>
          </div>
          <input
            className="ipb-input"
            type="text"
            value={owner1Input}
            onChange={e => setOwner1Input(e.target.value)}
            placeholder="Giuseppe"
          />
          <p className="ipb-user-hint">Assegnatario quote A e crediti IRPEF primari</p>
        </div>

        {/* UTENTE 2 */}
        <div className="ipb-user-box pink-box">
          <div className="ipb-user-box-header">
            <span className="ipb-user-tag pink">
              <span className="ipb-user-dot pink" />
              Utente 2 (Cointestatario)
            </span>
            <span className="ipb-initial-badge pink">
              Iniziale: <strong>{u2Initial}</strong>
            </span>
          </div>
          <input
            className="ipb-input"
            type="text"
            value={owner2Input}
            onChange={e => setOwner2Input(e.target.value)}
            placeholder="Claudia"
          />
          <p className="ipb-user-hint">Assegnatario quote B e detrazioni seconda casa</p>
        </div>
      </div>

      <div className="ipb-card-footer">
        <div className="ipb-feedback-area">
          {ownerSuccessMsg ? (
            <span className="ipb-success-text">
              {ic(PATH.check, 14, 2.5)}
              <span>{ownerSuccessMsg}</span>
            </span>
          ) : (
            <span className="ipb-dim-note">Salvataggio atomico su Store config, scenari e fatture</span>
          )}
        </div>
        <button
          type="button"
          className="ipb-btn ipb-btn-primary"
          onClick={handleSaveOwners}
          disabled={isSavingOwners}
        >
          {ic(PATH.save, 14)}
          <span>{isSavingOwners ? 'Salvataggio in corso…' : 'Salva Nomi Utenti'}</span>
        </button>
      </div>
    </section>
  );
};
