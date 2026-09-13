// tests/e2e/modules/rent_status_engine.mjs
// Opaque-box reference & contract engine for F1 (Due Date), F2 (Rent Status), F3 (Server Cron Fix)

export function getDaysInMonth(year, monthIndex) {
  // monthIndex is 0-indexed (0 = Jan, 1 = Feb, ..., 11 = Dec)
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Calculates the exact rent due date for a property and tenant in a given month.
 * Priority: tenant.rentDueDay -> property.financials.rentDueDay -> default 5.
 * Automatically clamps to the maximum days of the target month.
 */
export function calculateRentDueDate(property, tenant, year, monthIndex) {
  let targetDay = 5;

  if (tenant && typeof tenant.rentDueDay === 'number' && !isNaN(tenant.rentDueDay) && tenant.rentDueDay >= 1 && tenant.rentDueDay <= 31) {
    targetDay = tenant.rentDueDay;
  } else if (property?.financials && typeof property.financials.rentDueDay === 'number' && !isNaN(property.financials.rentDueDay) && property.financials.rentDueDay >= 1 && property.financials.rentDueDay <= 31) {
    targetDay = property.financials.rentDueDay;
  }

  const maxDayInMonth = getDaysInMonth(year, monthIndex);
  const clampedDay = Math.min(Math.max(1, targetDay), maxDayInMonth);

  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(clampedDay).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Evaluates the payment status for a rent item against today's reference date.
 * Returns RentStatusItem matching the PROJECT.md interface contract.
 */
export function evaluateRentStatus(
  property,
  tenant,
  rentalRecords = [],
  todayStr = null,
  reminderAdvanceDays = 5,
  targetYear = null,
  targetMonthIndex = null
) {
  const today = todayStr ? new Date(`${todayStr}T00:00:00.000Z`) : new Date();
  const year = targetYear !== null ? targetYear : today.getUTCFullYear();
  const month = targetMonthIndex !== null ? targetMonthIndex : today.getUTCMonth();

  const dueDateStr = calculateRentDueDate(property, tenant, year, month);
  const dueDate = new Date(`${dueDateStr}T00:00:00.000Z`);

  // Difference in calendar days
  const diffMs = dueDate.getTime() - today.getTime();
  const daysUntilDue = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const monthlyRent = property?.financials?.monthlyRent || 0;

  // Search for payments in rentalRecords for this property, year, and month
  const matchingRecords = (rentalRecords || []).filter(
    r => r.propertyId === property.id && r.year === year && r.month === month && (r.income || 0) > 0
  );

  const totalPaid = matchingRecords.reduce((sum, r) => sum + (r.income || 0), 0);
  const isPaid = totalPaid >= monthlyRent && monthlyRent > 0;
  const paymentRecord = matchingRecords[0];

  let status = 'PROGRAMMATO';
  if (isPaid) {
    status = 'SALDATO';
  } else if (daysUntilDue < 0) {
    status = 'SCADUTO';
  } else if (daysUntilDue <= reminderAdvanceDays) {
    status = 'IN_SCADENZA';
  } else {
    status = 'PROGRAMMATO';
  }

  return {
    propertyId: property.id,
    propertyName: property.name,
    tenantId: tenant?.id,
    tenantName: tenant?.name,
    tenantEmail: tenant?.email,
    tenantPhone: tenant?.phone,
    tenantTelegramChatId: tenant?.telegramChatId,
    monthlyRent,
    rentDueDay: tenant?.rentDueDay || property?.financials?.rentDueDay || 5,
    dueDate: dueDateStr,
    status,
    daysUntilDue,
    isPaid,
    paidDate: paymentRecord?.transactionDate,
    paidAmount: totalPaid,
    paymentRecordId: paymentRecord?.id,
    notes: paymentRecord?.notes
  };
}

/**
 * Hourly server deadline reconciliation (Feature F3 Fix).
 * Eliminates false overdue alarms by checking rentalRecords.
 */
export function reconcileServerRentDeadlines(properties, rentalRecords = [], todayStr = null) {
  const today = todayStr ? new Date(`${todayStr}T00:00:00.000Z`) : new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const todayIso = today.toISOString().split('T')[0];

  const deadlines = [];

  properties.forEach(prop => {
    if (!prop.financials || !prop.financials.monthlyRent || prop.financials.monthlyRent <= 0) {
      return;
    }

    // Generate deadline for current month
    const targetDateStr = calculateRentDueDate(prop, null, year, month);
    const hasPaid = (rentalRecords || []).some(
      r => r.propertyId === prop.id && r.year === year && r.month === month && (r.income || 0) >= prop.financials.monthlyRent
    );

    const isOverdue = targetDateStr <= todayIso && !hasPaid;

    deadlines.push({
      id: `auto_rent_${prop.id}_${targetDateStr}`,
      title: `${prop.name}: Affitto`,
      date: targetDateStr,
      amount: prop.financials.monthlyRent,
      isCompleted: hasPaid,
      propertyId: prop.id,
      isOverdueAlarmTriggerable: isOverdue
    });
  });

  return deadlines;
}
