// tests/e2e/modules/persistence_engine.mjs
// Schema validator & persistence contract for F4

export function validateRentReceipt(receipt) {
  const errors = [];
  if (!receipt) return { valid: false, errors: ['Receipt is null or undefined'] };

  if (typeof receipt.id !== 'string' || !receipt.id) errors.push('Missing or invalid id');
  if (typeof receipt.receiptNumber !== 'number' || receipt.receiptNumber < 1) errors.push('Invalid receiptNumber: must be integer >= 1');
  if (typeof receipt.fiscalYear !== 'number' || receipt.fiscalYear < 2000) errors.push('Invalid fiscalYear');
  if (typeof receipt.formattedNumber !== 'string' || !receipt.formattedNumber.includes('/')) errors.push('Invalid formattedNumber: expected "N/YYYY"');
  if (typeof receipt.issueDate !== 'string') errors.push('Missing issueDate');
  if (typeof receipt.propertyId !== 'string' || !receipt.propertyId) errors.push('Missing propertyId');
  if (typeof receipt.propertyName !== 'string') errors.push('Missing propertyName');
  if (typeof receipt.tenantId !== 'string') errors.push('Missing tenantId');
  if (typeof receipt.tenantName !== 'string' || !receipt.tenantName) errors.push('Missing tenantName');
  if (typeof receipt.landlordName !== 'string' || !receipt.landlordName) errors.push('Missing landlordName');
  if (typeof receipt.totalAmount !== 'number' || isNaN(receipt.totalAmount) || receipt.totalAmount < 0) errors.push('Invalid totalAmount');
  if (!['CEDOLARE_SECCA', 'ORDINARIO', 'ESENTE'].includes(receipt.taxRegime)) errors.push('Invalid taxRegime');
  if (typeof receipt.stampDutyApplied !== 'boolean') errors.push('Missing stampDutyApplied boolean');
  if (typeof receipt.stampDutyAmount !== 'number') errors.push('Missing stampDutyAmount number');

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateNotificationSettings(settings) {
  const errors = [];
  if (!settings) return { valid: false, errors: ['Settings is null or undefined'] };

  if (typeof settings.reminderAdvanceDays !== 'number' || settings.reminderAdvanceDays < 0 || settings.reminderAdvanceDays > 30) {
    errors.push('reminderAdvanceDays must be an integer between 0 and 30');
  }
  if (typeof settings.autoCheckEnabled !== 'boolean') errors.push('autoCheckEnabled must be boolean');

  if (!settings.homeAssistant || typeof settings.homeAssistant !== 'object') {
    errors.push('Missing homeAssistant configuration object');
  } else {
    if (typeof settings.homeAssistant.enabled !== 'boolean') errors.push('homeAssistant.enabled must be boolean');
    if (typeof settings.homeAssistant.sensorEntityId !== 'string') errors.push('homeAssistant.sensorEntityId must be string');
  }

  if (!settings.telegram || typeof settings.telegram !== 'object') {
    errors.push('Missing telegram configuration object');
  } else {
    if (typeof settings.telegram.enabled !== 'boolean') errors.push('telegram.enabled must be boolean');
    if (typeof settings.telegram.botToken !== 'string') errors.push('telegram.botToken must be string');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateNotificationLog(log) {
  const errors = [];
  if (!log) return { valid: false, errors: ['Log is null or undefined'] };

  if (typeof log.id !== 'string' || !log.id) errors.push('Missing log id');
  if (typeof log.timestamp !== 'string') errors.push('Missing timestamp');
  if (!['TELEGRAM', 'HOME_ASSISTANT'].includes(log.channel)) errors.push('Invalid channel');
  if (!['REMINDER_UPCOMING', 'REMINDER_OVERDUE', 'RECEIPT_SENT', 'TEST'].includes(log.type)) errors.push('Invalid log type');
  if (typeof log.recipient !== 'string') errors.push('Missing recipient');
  if (!['SUCCESS', 'FAILED'].includes(log.status)) errors.push('Invalid status');

  return {
    valid: errors.length === 0,
    errors
  };
}
