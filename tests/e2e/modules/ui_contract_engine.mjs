// tests/e2e/modules/ui_contract_engine.mjs
// Contract validators and state machines for Frontend features (F13, F14, F15, F16, F17, F18)

/**
 * Maps RentPaymentStatus to UI badge styles and localized text (F15).
 */
export function getRentBadgeInfo(status, daysUntilDue) {
  switch (status) {
    case 'SALDATO':
      return {
        label: 'Saldato',
        badgeColor: 'emerald',
        bgClass: 'bg-emerald-500/20',
        textClass: 'text-emerald-400',
        borderClass: 'border-emerald-500/30',
        icon: 'check-circle'
      };
    case 'IN_SCADENZA':
      return {
        label: daysUntilDue === 0 ? 'Scade Oggi' : `In Scadenza (${daysUntilDue} gg)`,
        badgeColor: 'amber',
        bgClass: 'bg-amber-500/20',
        textClass: 'text-amber-400',
        borderClass: 'border-amber-500/30',
        icon: 'clock'
      };
    case 'SCADUTO':
      const overdueDays = Math.abs(daysUntilDue);
      return {
        label: `Scaduto (${overdueDays} gg fa)`,
        badgeColor: 'rose',
        bgClass: 'bg-rose-500/20',
        textClass: 'text-rose-400',
        borderClass: 'border-rose-500/30',
        icon: 'alert-triangle'
      };
    case 'PROGRAMMATO':
    default:
      return {
        label: 'Programmato',
        badgeColor: 'slate',
        bgClass: 'bg-slate-500/20',
        textClass: 'text-slate-400',
        borderClass: 'border-slate-500/30',
        icon: 'calendar'
      };
  }
}

/**
 * Determines enablement and visibility for Rent Quick Action Buttons (F16).
 */
export function getRentQuickActionsState(rentItem) {
  const isPaid = rentItem.status === 'SALDATO';
  const hasTenantTelegram = Boolean(rentItem.tenantTelegramChatId && rentItem.tenantTelegramChatId.trim());

  return {
    canSendReminder: !isPaid,
    canGenerateReceipt: isPaid,
    canSendReceiptTelegram: isPaid && hasTenantTelegram,
    disabledReasons: {
      sendReminder: isPaid ? 'Canone già saldato' : null,
      generateReceipt: !isPaid ? 'Canone non ancora saldato' : null,
      sendReceiptTelegram: !isPaid
        ? 'Canone non saldato'
        : !hasTenantTelegram
        ? 'Inquilino sprovvisto di Chat ID Telegram'
        : null
    }
  };
}

/**
 * Validates Tenant Telegram Chat ID (F14).
 */
export function validateTelegramChatId(chatId) {
  if (!chatId || !chatId.trim()) {
    return { valid: true, sanitized: null }; // Optional field
  }
  const clean = chatId.trim();
  // Valid Telegram Chat ID is numeric (can be negative for groups/channels)
  if (/^-?\d+$/.test(clean)) {
    return { valid: true, sanitized: clean };
  }
  return {
    valid: false,
    error: 'Il Chat ID Telegram deve essere numerico (es. 123456789 o -100123456789 per gruppi)'
  };
}

/**
 * Filters and sorts notification history logs (F18).
 */
export function filterAndSortNotificationLogs(logs = [], filterChannel = 'ALL', filterStatus = 'ALL') {
  return (logs || [])
    .filter(log => {
      if (filterChannel !== 'ALL' && log.channel !== filterChannel) return false;
      if (filterStatus !== 'ALL' && log.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
