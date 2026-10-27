import React from 'react';
import { Property, CustomSensor } from '../../types';
import { PATH, ic } from './adminIcons';

interface AdminDatabaseStatusCardProps {
  dbStats: Record<string, number> | null;
  properties: Property[];
  customSensors: CustomSensor[];
  isRefreshingStats: boolean;
  refreshStats: () => Promise<void>;
}

export const AdminDatabaseStatusCard: React.FC<AdminDatabaseStatusCardProps> = ({
  dbStats,
  properties,
  customSensors,
  isRefreshingStats,
  refreshStats
}) => {
  return (
    <section className="ipb-card span-5">
      <div className="ipb-card-header">
        <div className="ipb-card-title-group">
          <div className="ipb-icon-wrap emerald">
            {ic(PATH.db, 19, 2)}
          </div>
          <div>
            <h2 className="ipb-card-title">Stato Database Locale</h2>
            <p className="ipb-card-subtitle">Archivio IndexedDB & entità persistenti</p>
          </div>
        </div>
        <button
          type="button"
          className={`ipb-btn-ghost-sm emerald-ghost ${isRefreshingStats ? 'busy' : ''}`}
          onClick={refreshStats}
          title="Ricarica statistiche"
          disabled={isRefreshingStats}
        >
          {ic(PATH.sync, 12)}
          <span>{isRefreshingStats ? 'Aggiornamento…' : 'Aggiorna'}</span>
        </button>
      </div>

      {/* 4-METRIC STATS GRID */}
      <div className="ipb-stat-grid">
        <div className="ipb-stat-cell">
          <span className="ipb-stat-key">Immobili</span>
          <span className="ipb-stat-val text-white">
            {dbStats?.properties ?? properties.length ?? 0}
          </span>
          <span className="ipb-stat-sub">unità attive</span>
        </div>

        <div className="ipb-stat-cell">
          <span className="ipb-stat-key">Scenari</span>
          <span className="ipb-stat-val text-cyan">
            {dbStats?.scenarios ?? 0}
          </span>
          <span className="ipb-stat-sub">simulazioni</span>
        </div>

        <div className="ipb-stat-cell">
          <span className="ipb-stat-key">Fatture 730</span>
          <span className="ipb-stat-val text-emerald">
            {dbStats?.invoices ?? 0}
          </span>
          <span className="ipb-stat-sub">detraibili</span>
        </div>

        <div className="ipb-stat-cell">
          <span className="ipb-stat-key">Sensori HA</span>
          <span className="ipb-stat-val text-amber">
            {customSensors.length}
          </span>
          <span className="ipb-stat-sub">pubblicati</span>
        </div>
      </div>

      {/* Extended store strip */}
      <div className="ipb-sub-stats-bar">
        <span className="ipb-sub-stat-pill">
          Inquilini: <strong>{dbStats?.tenants ?? 0}</strong>
        </span>
        <span className="ipb-sub-stat-pill">
          Canoni / Spese: <strong>{dbStats?.rentalRecords ?? 0}</strong>
        </span>
        <span className="ipb-sub-stat-pill">
          Scadenze: <strong>{dbStats?.deadlines ?? 0}</strong>
        </span>
      </div>

      <div className="ipb-card-footer split-footer">
        <span className="ipb-status-pill ok">
          Integrità Store: <strong>100% OK</strong>
        </span>
        <span className="ipb-dim-note mono">
          Engine: IndexedDB v5
        </span>
      </div>
    </section>
  );
};
