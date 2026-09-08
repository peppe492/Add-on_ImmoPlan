
import { FinancialData, Scenario, RentalRecord, Tenant, Landlord, Property, SystemLog, Deadline, InvoiceRecord } from '../types';

const DB_NAME = 'ImmoPlanDB';
const DB_VERSION = 5; // Bump version for invoices store

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
        const stores = ['config', 'scenarios', 'rentalRecords', 'tenants', 'landlords', 'properties', 'systemLogs', 'deadlines', 'invoices'];
        stores.forEach(s => {
          if (!db.objectStoreNames.contains(s)) {
            const store = db.createObjectStore(s, s === 'config' ? undefined : { keyPath: 'id' });
            if (s === 'invoices') {
              store.createIndex('propertyId', 'propertyId', { unique: false });
              store.createIndex('fiscalYear', 'fiscalYear', { unique: false });
            }
          } else if (s === 'invoices') {
            const store = (request.transaction as IDBTransaction).objectStore('invoices');
            if (!store.indexNames.contains('propertyId')) {
              store.createIndex('propertyId', 'propertyId', { unique: false });
            }
            if (!store.indexNames.contains('fiscalYear')) {
              store.createIndex('fiscalYear', 'fiscalYear', { unique: false });
            }
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

      const storeNames = ['config', 'scenarios', 'rentalRecords', 'tenants', 'landlords', 'properties', 'deadlines', 'invoices'];
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
      if (data.deadlines) replaceStore('deadlines', data.deadlines);
      if (data.invoices) replaceStore('invoices', data.invoices);

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
      const [config, scenarios, rentalRecords, tenants, landlords, properties, deadlines, invoices] = await Promise.all([
        this.getAppData(),
        this.getScenarios(),
        this.getRentalRecords(),
        this.getTenants(),
        this.getLandlords(),
        this.getProperties(),
        this.getDeadlines(),
        this.getInvoices()
      ]);

      const fullDump = { config, scenarios, rentalRecords, tenants, landlords, properties, deadlines, invoices };

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

  /**
   * Aggiorna in modo atomico i nomi dei due proprietari/beneficiari:
   * - Config / appData
   * - Tutti gli scenari salvati
   * - Tutte le fatture salvate
   * Esegue un unico pushToServer alla fine per evitare decine di POST ridondanti.
   */
  async updateOwnerNamesCascade(
    o1: string,
    o2: string,
    oldO1: string,
    oldO2: string,
    updatedAppData: FinancialData
  ): Promise<{ updatedScenarios: Scenario[]; invoiceCount: number }> {
    if (!this.db) await this.init();

    const targetStores = ['config', 'scenarios', 'invoices'];
    const tx = this.db!.transaction(targetStores, 'readwrite');
    const configStore = tx.objectStore('config');
    const scenariosStore = tx.objectStore('scenarios');
    const invoicesStore = tx.objectStore('invoices');

    // 1. Salva config
    configStore.put(updatedAppData, 'current_state');

    // 2. Aggiorna scenari
    const updatedScenarios: Scenario[] = [];
    const scReq = scenariosStore.getAll();
    await new Promise<void>((resolve, reject) => {
      scReq.onsuccess = () => {
        const scenarios = (scReq.result || []) as Scenario[];
        scenarios.forEach(sc => {
          if (sc && sc.data) {
            sc.data.owner1Name = o1;
            sc.data.owner2Name = o2;
            if (sc.data.portfolios) {
              sc.data.portfolios = sc.data.portfolios.map(p => {
                let newOwner = p.owner;
                let newName = p.name;
                if (p.owner === oldO1 || p.owner === 'Giuseppe') {
                  newOwner = o1;
                  newName = newName.replace(oldO1, o1).replace('Giuseppe', o1);
                } else if (p.owner === oldO2 || p.owner === 'Claudia') {
                  newOwner = o2;
                  newName = newName.replace(oldO2, o2).replace('Claudia', o2);
                }
                return { ...p, owner: newOwner, name: newName };
              });
            }
            scenariosStore.put(sc);
          }
          updatedScenarios.push(sc);
        });
        resolve();
      };
      scReq.onerror = () => reject(scReq.error);
    });

    // 3. Aggiorna fatture
    let updatedInvoicesCount = 0;
    const invReq = invoicesStore.getAll();
    await new Promise<void>((resolve, reject) => {
      invReq.onsuccess = () => {
        const invoices = (invReq.result || []) as InvoiceRecord[];
        invoices.forEach(inv => {
          let changed = false;
          if (inv.beneficiary === oldO1 || inv.beneficiary === 'Giuseppe') {
            inv.beneficiary = o1;
            changed = true;
          } else if (inv.beneficiary === oldO2 || inv.beneficiary === 'Claudia') {
            inv.beneficiary = o2;
            changed = true;
          }
          if (changed) {
            invoicesStore.put(inv);
            updatedInvoicesCount++;
          }
        });
        resolve();
      };
      invReq.onerror = () => reject(invReq.error);
    });

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // 4. Invia una sola volta lo stato aggiornato al server di sync
    await this.pushToServer();
    this.log(`Nomi co-proprietari aggiornati: "${o1}" e "${o2}" (${updatedScenarios.length} scenari, ${updatedInvoicesCount} fatture)`, 'success');

    return { updatedScenarios, invoiceCount: updatedInvoicesCount };
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

  async saveDeadline(deadline: Deadline): Promise<void> {
    await this.put('deadlines', deadline);
    await this.pushToServer();
  }

  async deleteDeadline(id: string): Promise<void> {
    await this.delete('deadlines', id);
    this.log(`Scadenza eliminata: ${id}`, 'success');
    await this.pushToServer();
  }

  async saveInvoice(invoice: InvoiceRecord): Promise<void> {
    await this.put('invoices', invoice);
    await this.pushToServer();
  }

  async saveInvoicesBatch(invoices: InvoiceRecord[], clearFirst: boolean = false): Promise<void> {
    if (!this.db) await this.init();
    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction('invoices', 'readwrite');
      const store = tx.objectStore('invoices');
      if (clearFirst) {
        store.clear();
      }
      invoices.forEach(inv => store.put(inv));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.log(`Salvate in blocco ${invoices.length} fatture${clearFirst ? ' (archivio reimpostato)' : ''}`, 'success');
    await this.pushToServer();
  }

  async clearInvoices(): Promise<void> {
    if (!this.db) await this.init();
    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction('invoices', 'readwrite');
      const store = tx.objectStore('invoices');
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.log('Tutte le fatture sono state rimosse dal database', 'info');
    await this.pushToServer();
  }

  async exportInvoices(): Promise<string> {
    const invoices = await this.getInvoices();
    return JSON.stringify({
      version: '1.0',
      app: 'ImmoPlan',
      module: 'invoices',
      exportDate: new Date().toISOString(),
      totalRecords: invoices.length,
      totalAmount: invoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0),
      invoices
    }, null, 2);
  }

  async deleteInvoice(id: string): Promise<void> {
    await this.delete('invoices', id);
    this.log(`Fattura eliminata: ${id}`, 'success');
    await this.pushToServer();
  }

  async getAppData(): Promise<FinancialData | null> { return this.get<FinancialData>('config', 'current_state'); }
  async getScenarios(): Promise<Scenario[]> { return this.getAll<Scenario>('scenarios'); }
  async getRentalRecords(): Promise<RentalRecord[]> { return this.getAll<RentalRecord>('rentalRecords'); }
  async getProperties(): Promise<Property[]> { return this.getAll<Property>('properties'); }
  async getTenants(): Promise<Tenant[]> { return this.getAll<Tenant>('tenants'); }
  async getLandlords(): Promise<Landlord[]> { return this.getAll<Landlord>('landlords'); }
  async getDeadlines(): Promise<Deadline[]> { return this.getAll<Deadline>('deadlines'); }
  async getInvoices(): Promise<InvoiceRecord[]> { return this.getAll<InvoiceRecord>('invoices'); }
  async getLogs(): Promise<SystemLog[]> { return this.getAll<SystemLog>('systemLogs'); }

  async getStats(): Promise<Record<string, number>> {
    if (!this.db) return {};
    const stores = ['scenarios', 'rentalRecords', 'tenants', 'landlords', 'properties', 'deadlines', 'invoices'];
    const stats: Record<string, number> = {};
    await Promise.all(stores.map(storeName => {
        return new Promise<void>((resolve) => {
            const tx = this.db!.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).count();
            req.onsuccess = () => { stats[storeName] = req.result; resolve(); };
            req.onerror = () => { stats[storeName] = 0; resolve(); };
        });
    }));
    return stats;
  }

  async saveLog(log: SystemLog): Promise<void> {
    await this.put('systemLogs', log);
    this.remoteLog(log);
  }

  async clearAll(): Promise<void> {
    try {
      localStorage.removeItem('immoplan_invoices_initialized');
    } catch (e) {}
    if (this.db) this.db.close();
    await fetch('./api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async importFullDatabase(jsonString: string, allowedStores?: string[]): Promise<boolean> {
      try {
          this.log(`Avvio importazione database selettiva...`, 'info');
          const parsed = JSON.parse(jsonString);
          const backupData = parsed.data || parsed;
          const storeNames = ['config', 'scenarios', 'rentalRecords', 'tenants', 'landlords', 'properties', 'deadlines', 'invoices'];
          const targetStores = allowedStores ? storeNames.filter(s => allowedStores.includes(s)) : storeNames;

          if (targetStores.length === 0) {
              this.log(`Nessun tipo di dato selezionato per il ripristino.`, 'info');
              return true;
          }

          this.log(`Ripristino categorie: ${targetStores.join(', ')}`, 'info');

          // --- APPROCCIO DIRETTO AL SERVER ---
          // Bypassa IndexedDB come intermediario per evitare race conditions.

          // 1. Leggi i dati correnti dal server
          let currentServerData: any = {};
          try {
              const resp = await fetch('./api/sync?t=' + Date.now());
              if (resp.ok) {
                  const json = await resp.json();
                  if (json && Object.keys(json).length > 0) currentServerData = json;
              }
          } catch (e) {
              this.log('Avviso: dati server non disponibili, si usa solo il backup.', 'info');
          }

          // 2. Unisci il backup nei dati correnti (solo per le categorie selezionate)
          const mergedData = { ...currentServerData };
          targetStores.forEach(s => {
              if (backupData[s] !== undefined) {
                  mergedData[s] = backupData[s];
                  const count = Array.isArray(backupData[s]) ? backupData[s].length : 1;
                  this.log(`Categoria '${s}' ripristinata con ${count} record.`, 'info');
              } else {
                  this.log(`Categoria '${s}' non presente nel backup. Saltata.`, 'info');
              }
          });

          // 3. Scrivi i dati sul server (fonte di verità persistente se disponibile)
          let serverSynced = false;
          try {
            const pushResp = await fetch('./api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mergedData)
            });
            if (pushResp.ok) {
              serverSynced = true;
            } else {
              this.log(`Avviso server HTTP ${pushResp.status}: applico ripristino diretto su IndexedDB locale`, 'info');
            }
          } catch (netErr) {
            this.log('Server di sync non raggiungibile: applico ripristino su IndexedDB locale', 'info');
          }

          // 4. Aggiorna IndexedDB dal server o direttamente dal backup
          if (serverSynced) {
            await this.pullFromServer();
          } else {
            if (!this.db) await this.init();
            const tx = this.db!.transaction(targetStores, 'readwrite');
            targetStores.forEach(s => {
              if (backupData[s] !== undefined) {
                const store = tx.objectStore(s);
                store.clear();
                if (Array.isArray(backupData[s])) {
                  backupData[s].forEach((item: any) => store.put(item));
                } else if (backupData[s]) {
                  store.put(backupData[s], s === 'config' ? 'current_state' : undefined);
                }
              }
            });
            await new Promise<void>((resolve, reject) => {
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
            });
          }

          if (targetStores.includes('invoices')) {
            try {
              localStorage.setItem('immoplan_invoices_initialized', 'true');
            } catch (e) {}
          }

          this.log(`Ripristino completato con successo!`, 'success');
          return true;

      } catch (e: any) {
          this.log(`Errore critico importazione: ${e.message}`, 'error');
          console.error("importFullDatabase error:", e);
          return false;
      }
  }

  async exportFullDatabase(): Promise<string> {
    const [config, scenarios, rentalRecords, tenants, landlords, properties, deadlines, invoices] = await Promise.all([
        this.getAppData(), this.getScenarios(), this.getRentalRecords(), this.getTenants(), this.getLandlords(), this.getProperties(), this.getDeadlines(), this.getInvoices()
    ]);
    return JSON.stringify({ exportDate: new Date().toISOString(), data: { config, scenarios, rentalRecords, tenants, landlords, properties, deadlines, invoices } }, null, 2);
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
