import React from 'react';
import { SystemLog } from '../../types';
import { PATH, ic } from './adminIcons';

interface AdminLogViewerCardProps {
  logs: SystemLog[];
  filteredLogs: SystemLog[];
  logFilter: 'ALL' | 'INFO' | 'SUCCESS' | 'ERROR' | 'OPENDATA';
  setLogFilter: (filter: 'ALL' | 'INFO' | 'SUCCESS' | 'ERROR' | 'OPENDATA') => void;
  logSearch: string;
  setLogSearch: (search: string) => void;
  handleTestIstatOpenData: () => Promise<void>;
  isTestingOpenData: boolean;
  handleCopyLogs: () => void;
  copyFeedback: boolean;
  terminalBodyRef: React.RefObject<HTMLDivElement | null>;
}

export const AdminLogViewerCard: React.FC<AdminLogViewerCardProps> = ({
  logs,
  filteredLogs,
  logFilter,
  setLogFilter,
  logSearch,
  setLogSearch,
  handleTestIstatOpenData,
  isTestingOpenData,
  handleCopyLogs,
  copyFeedback,
  terminalBodyRef
}) => {
  return (
    <section className="ipb-card span-12 ipb-terminal-card" id="sec-logs">
      <div className="ipb-terminal-header">
        <div className="ipb-mac-dots">
          <span className="dot red" />
          <span className="dot amber" />
          <span className="dot emerald" />
          <span className="ipb-terminal-title mono">immoplan_system.log</span>
        </div>

        <div className="ipb-terminal-controls">
          <div className="ipb-terminal-filter-pills">
            <button
              type="button"
              className={`ipb-mini-pill ${logFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setLogFilter('ALL')}
            >
              Tutti ({logs.length})
            </button>
            <button
              type="button"
              className={`ipb-mini-pill ${logFilter === 'INFO' ? 'active' : ''}`}
              onClick={() => setLogFilter('INFO')}
            >
              Info
            </button>
            <button
              type="button"
              className={`ipb-mini-pill ${logFilter === 'SUCCESS' ? 'active' : ''}`}
              onClick={() => setLogFilter('SUCCESS')}
            >
              Success
            </button>
            <button
              type="button"
              className={`ipb-mini-pill ${logFilter === 'ERROR' ? 'active' : ''}`}
              onClick={() => setLogFilter('ERROR')}
            >
              Error
            </button>
            <button
              type="button"
              className={`ipb-mini-pill ${logFilter === 'OPENDATA' ? 'active' : ''}`}
              onClick={() => setLogFilter('OPENDATA')}
              title="Filtra gli eventi relativi alle chiamate OpenData, ISTAT e OMI"
            >
              🏛️ OpenData / ISTAT ({logs.filter(l => l.message.includes('[OpenData') || l.message.includes('[ISTAT') || l.message.includes('[OMI')).length})
            </button>
          </div>

          <input
            type="text"
            className="ipb-terminal-search"
            placeholder="Cerca nei log…"
            value={logSearch}
            onChange={e => setLogSearch(e.target.value)}
          />

          <button
            type="button"
            className="ipb-btn-ghost-sm"
            onClick={handleTestIstatOpenData}
            disabled={isTestingOpenData}
            title="Esegui test in tempo reale del dialogo con le API ISTAT e OpenData"
            style={{ borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
          >
            {isTestingOpenData ? (
              <>
                <span className="ipb-pulse-dot mini" />
                <span>Test ISTAT…</span>
              </>
            ) : (
              <>
                <span>⚡ Test ISTAT / OpenData</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="ipb-btn-ghost-sm"
            onClick={handleCopyLogs}
            title="Copia log filtrati negli appunti"
          >
            {ic(copyFeedback ? PATH.check : PATH.copy, 12)}
            <span>{copyFeedback ? 'Copiato!' : 'Copia'}</span>
          </button>

          <span className="ipb-event-counter mono">
            <span className="ipb-pulse-dot mini" />
            {filteredLogs.length} eventi
          </span>
        </div>
      </div>

      <div className="ipb-terminal-body" ref={terminalBodyRef as any}>
        {filteredLogs.length === 0 ? (
          <p className="ipb-log-empty mono">
            {logs.length === 0
              ? '// In attesa di log ed eventi di sistema…'
              : '// Nessun log corrisponde ai filtri impostati.'}
          </p>
        ) : (
          filteredLogs.map(log => {
            const isOpenDataLog = log.message.includes('[OpenData') || log.message.includes('[ISTAT') || log.message.includes('[OMI');
            return (
              <div className={`ipb-log-row ${isOpenDataLog ? 'opendata-row' : ''}`} key={log.id}>
                <span className="ipb-log-time mono">[{log.time}]</span>
                <span className={`ipb-log-badge mono ${log.type}`}>
                  {log.type.toUpperCase()}:
                </span>
                {isOpenDataLog && (
                  <span className="ipb-log-opendata-tag mono">ISTAT/OPEN-DATA</span>
                )}
                <span className="ipb-log-msg mono">{log.message}</span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
