
import { FinancialData, Scenario, RentalRecord, Tenant, Landlord, Property, SystemLog } from '../types';

const DB_NAME = 'ImmoPlanDB';
const DB_VERSION = 3;

export class ImmoPlanDB {
  private db: IDBDatabase | null = null;
  public onLog: (msg: string, type: 'info' | 'error' | 'success') => void = () => {};
  private syncBlockedUntil = 0; // Timestamp fino al quale il sync è bloccato

  private async remoteLog(log: SystemLog) {
    try {
      // PERCORSO RELATIVO ESPLICITO: ./api/log
      await fetch('./api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log)
      });
    } catch (e) {}
  }

  private log(msg: string, type: 'info' | 'error' | 'success' = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logObj: SystemLog = { id: Date.now(), message: msg, type, time: timestamp };
    this.onLog(msg, type);
    this.remoteLog(logObj);
  }

  // --- SYNC BLOCKING LOGIC ---
  public blockSync(ms: number) {
    this.syncBlockedUntil = Date.now() + ms;
  }

  public isSyncBlocked(): boolean {
    return Date.now() < this.syncBlockedUntil;
  }
  // ---------------------------

  async init(): Promise<void> {
    if (this.db) {
       await this.pullFromServer();
       return;
    }

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const stores = ['config', 'scenarios', 'rentalRecords', 'tenants', 'landlords', 'properties', 'systemLogs'];
        stores.forEach(s => {
          if (!db.objectStoreNames.contains(s)) {
            db.createObjectStore(s, s === 'config' ? undefined : { keyPath: 'id' });
          }
        });
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    await this.pullFromServer();
  }

  /**
   * PULL: Scarica lo stato globale dal database centralizzato
   */
  async pullFromServer(): Promise<boolean> {
    if (!this.db) return false;
    try {
      const response = await fetch('./api/sync?t=' + Date.now()); 
      if (response.status === 404) return false;
      if (!response.ok) throw new Error(`Server status: ${response.status}`);

      const data = await response.json();
      if (!data || Object.keys(data).length === 0) return false;

      const storeNames = ['config', 'scenarios', 'rentalRecords', 'tenants', 'landlords', 'properties'];
      const tx = this.db.transaction(storeNames, 'readwrite');
      
      const replaceStore = (storeName: string, items: any) => {
        const store = tx.objectStore(storeName);
        store.clear(); 
        if (Array.isArray(items)) {
          items.forEach(item => store.put(item));
        } else if (items) {
          store.put(items, 'current_state');
        }
      };

      if (data.config) replaceStore('config', data.config);
      if (data.scenarios) replaceStore('scenarios', data.scenarios);
      if (data.rentalRecords) replaceStore('rentalRecords', data.rentalRecords);
      if (data.tenants) replaceStore('tenants', data.tenants);
      if (data.landlords) replaceStore('landlords', data.landlords);
      if (data.properties) replaceStore('properties', data.properties);

      return new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => {
          this.log('Errore sync locale', 'error');
          resolve(false);
        };
      });
    } catch (e: any) {
      console.error("Sync Error:", e);
      if (e.message && e.message.includes("Server status")) {
         this.log(`Errore Server: ${e.message}`, 'error');
      }
      return false;
    }
  }

  /**
   * PUSH: Invia lo stato locale al database centralizzato (SOLO STORAGE)
   */
  private async pushToServer(): Promise<void> {
    if (!this.db) return;
    try {
      const [config, scenarios, rentalRecords, tenants, landlords, properties] = await Promise.all([
        this.getAppData(),
        this.getScenarios(),
        this.getRentalRecords(),
        this.getTenants(),
        this.getLandlords(),
        this.getProperties()
      ]);

      const fullDump = { config, scenarios, rentalRecords, tenants, landlords, properties };

      await fetch('./api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullDump)
      });
    } catch (e) {
      console.error("Push Error", e);
    }
  }

  /**
   * TRIGGER MANUALE SENSORI HA
   */
  async triggerHASensorSync(): Promise<{success: boolean, message?: string}> {
      try {
          this.log("Avvio aggiornamento manuale sensori HA...", 'info');
          const res = await fetch('./api/ha/push_sensors', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
              this.log(`Aggiornamento completato: ${data.updated} aggiornati, ${data.failed} falliti.`, 'success');
              return { success: true };
          } else {
              throw new Error(data.error || 'Errore sconosciuto');
          }
      } catch (e: any) {
          this.log(`Errore Aggiornamento Sensori: ${e.message}`, 'error');
          return { success: false, message: e.message };
      }
  }

  async saveAppData(data: FinancialData): Promise<void> { 
    await this.put('config', data, 'current_state'); 
    await this.pushToServer(); 
  }
  
  async saveScenario(scenario: Scenario): Promise<void> { 
    await this.put('scenarios', scenario); 
    await this.pushToServer(); 
  }

  async deleteScenario(id: string): Promise<void> { 
    await this.delete('scenarios', id); 
    this.log(`Scenario eliminato: ${id}`, 'success');
    await this.pushToServer(); 
  }

  async saveRentalRecord(record: RentalRecord): Promise<void> { 
    await this.put('rentalRecords', record); 
    await this.pushToServer(); 
  }

  async deleteRentalRecord(id: string): Promise<void> { 
    await this.delete('rentalRecords', id); 
    this.log(`Transazione eliminata: ${id}`, 'success');
    await this.pushToServer(); 
  }

  async saveProperty(property: Property): Promise<void> { 
    await this.put('properties', property); 
    await this.pushToServer(); 
  }

  async deleteProperty(id: string): Promise<void> { 
    await this.delete('properties', id); 
    this.log(`Proprietà eliminata: ${id}`, 'success');
    await this.pushToServer(); 
  }

  async saveTenant(tenant: Tenant): Promise<void> { 
    await this.put('tenants', tenant); 
    await this.pushToServer(); 
  }

  async deleteTenant(id: string): Promise<void> { 
    await this.delete('tenants', id); 
    this.log(`Inquilino eliminato: ${id}`, 'success');
    await this.pushToServer(); 
  }

  async saveLandlord(landlord: Landlord): Promise<void> { 
    await this.put('landlords', landlord); 
    await this.pushToServer(); 
  }

  async deleteLandlord(id: string): Promise<void> { 
    await this.delete('landlords', id); 
    this.log(`Locatore eliminato: ${id}`, 'success');
    await this.pushToServer(); 
  }

  async getAppData(): Promise<FinancialData | null> { return this.get<FinancialData>('config', 'current_state'); }
  async getScenarios(): Promise<Scenario[]> { return this.getAll<Scenario>('scenarios'); }
  async getRentalRecords(): Promise<RentalRecord[]> { return this.getAll<RentalRecord>('rentalRecords'); }
  async getProperties(): Promise<Property[]> { return this.getAll<Property>('properties'); }
  async getTenants(): Promise<Tenant[]> { return this.getAll<Tenant>('tenants'); }
  async getLandlords(): Promise<Landlord[]> { return this.getAll<Landlord>('landlords'); }
  async getLogs(): Promise<SystemLog[]> { return this.getAll<SystemLog>('systemLogs'); }

  async getStats(): Promise<Record<string, number>> {
    if (!this.db) return {};
    const stores = ['scenarios', 'rentalRecords', 'tenants', 'landlords', 'properties'];
    const stats: Record<string, number> = {};
    await Promise.all(stores.map(storeName => {
        return new Promise<void>((resolve) => {
            const tx = this.db!.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).count();
            req.onsuccess = () => { stats[storeName] = req.result; resolve(); };
        });
    }));
    return stats;
  }

  async saveLog(log: SystemLog): Promise<void> {
    await this.put('systemLogs', log);
    this.remoteLog(log);
  }

  async clearAll(): Promise<void> {
    if (this.db) this.db.close();
    await fetch('./api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async importFullDatabase(jsonString: string): Promise<boolean> {
      try {
          const parsed = JSON.parse(jsonString);
          const data = parsed.data || parsed;
          const storeNames = ['config', 'scenarios', 'rentalRecords', 'tenants', 'landlords', 'properties'];
          const tx = this.db!.transaction(storeNames, 'readwrite');
          storeNames.forEach(s => {
              if (data[s]) {
                  const store = tx.objectStore(s);
                  store.clear();
                  if (Array.isArray(data[s])) data[s].forEach((item: any) => store.put(item));
                  else store.put(data[s], 'current_state');
              }
          });
          return new Promise((resolve) => {
              tx.oncomplete = async () => { await this.pushToServer(); resolve(true); };
          });
      } catch (e) { return false; }
  }

  async exportFullDatabase(): Promise<string> {
    const [config, scenarios, rentalRecords, tenants, landlords, properties] = await Promise.all([
        this.getAppData(), this.getScenarios(), this.getRentalRecords(), this.getTenants(), this.getLandlords(), this.getProperties()
    ]);
    return JSON.stringify({ exportDate: new Date().toISOString(), data: { config, scenarios, rentalRecords, tenants, landlords, properties } }, null, 2);
  }

  private async put(storeName: string, value: any, key?: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      key ? store.put(value, key) : store.put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async get<T>(storeName: string, key: string): Promise<T | null> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  }

  private async delete(storeName: string, key: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const db = new ImmoPlanDB();
