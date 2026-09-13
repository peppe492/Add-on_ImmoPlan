// services/notificationService.ts
import { NotificationSettings, NotificationLog, RentReceipt } from '../types';
import { db } from './dbService';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  reminderAdvanceDays: 5,
  autoCheckEnabled: true,
  homeAssistant: {
    enabled: true,
    updateSensors: true,
    persistentNotifications: true,
    sensorEntityId: 'sensor.immoplan_affitti_stato'
  },
  telegram: {
    enabled: false,
    botToken: '',
    ownerChatId: '',
    notifyOwnerOnDue: true,
    notifyTenantOnDue: true,
    autoSendReceiptToTenant: true
  }
};

export class NotificationService {
  async getSettings(): Promise<NotificationSettings> {
    try {
      const res = await fetch('/api/notifications/settings');
      if (res.ok) {
        const data = await res.json();
        if (data && data.settings) return data.settings;
      }
    } catch {
      // Fallback to IndexedDB
    }
    return db.getNotificationSettings();
  }

  async saveSettings(settings: NotificationSettings): Promise<void> {
    await db.saveNotificationSettings(settings);
    try {
      await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
    } catch (e) {
      console.warn('[NotificationService] Failed to push settings to server:', e);
    }
  }

  async testHomeAssistant(supervisorToken?: string): Promise<{ success: boolean; message: string; haVersion?: string }> {
    try {
      const res = await fetch('/api/notifications/test-ha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorToken })
      });
      if (!res.ok) {
        return { success: false, message: `Errore HTTP ${res.status}` };
      }
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e.message || 'Errore di connessione' };
    }
  }

  async testTelegram(botToken: string, chatId?: string): Promise<{ success: boolean; message: string; botUsername?: string }> {
    try {
      const res = await fetch('/api/notifications/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken, chatId })
      });
      if (!res.ok) {
        return { success: false, message: `Errore HTTP ${res.status}` };
      }
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e.message || 'Errore di connessione a Telegram' };
    }
  }

  async sendReminder(
    propertyId: string,
    channel: 'TELEGRAM' | 'HOME_ASSISTANT' | 'ALL' = 'ALL',
    customMessage?: string
  ): Promise<{ success: boolean; sentTo: string[]; error?: string }> {
    try {
      const res = await fetch('/api/notifications/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, channel, customMessage })
      });
      const data = await res.json();
      return data;
    } catch (e: any) {
      return { success: false, sentTo: [], error: e.message };
    }
  }

  async sendReceiptViaTelegram(
    receipt: RentReceipt,
    recipientChatId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/notifications/send-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt, recipientChatId })
      });
      const data = await res.json();
      return data;
    } catch (e: any) {
      return { success: false, message: e.message || 'Errore durante la trasmissione Telegram' };
    }
  }

  async getLogs(): Promise<NotificationLog[]> {
    try {
      const res = await fetch('/api/notifications/logs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch {
      // Fallback
    }
    return db.getNotificationLogs();
  }

  async clearLogs(): Promise<void> {
    await db.clearNotificationLogs();
    try {
      await fetch('/api/notifications/clear-logs', { method: 'POST' });
    } catch {}
  }
}

export const notificationService = new NotificationService();
