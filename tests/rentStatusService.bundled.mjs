// services/rentStatusService.ts
function isLeapYear(year) {
  return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
}
function getDaysInMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}
function getEffectiveRentDueDay(rentDueDay) {
  if (rentDueDay === void 0 || rentDueDay === null || isNaN(rentDueDay)) {
    return 5;
  }
  const intVal = Math.floor(rentDueDay);
  if (intVal < 1 || intVal > 31) {
    return 5;
  }
  return intVal;
}
function getUtcMidnight(dateInput) {
  if (!dateInput) {
    const now = /* @__PURE__ */ new Date();
    return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (typeof dateInput === "string") {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return Date.UTC(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    }
    const d = new Date(dateInput);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return Date.UTC(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
}
function calculateDaysUntilDue(dueDate, referenceDate) {
  const dueMidnight = getUtcMidnight(dueDate);
  const refMidnight = getUtcMidnight(referenceDate);
  const diffMs = dueMidnight - refMidnight;
  return Math.round(diffMs / (1e3 * 60 * 60 * 24));
}
function resolveRentDueDay(property, tenant) {
  if (tenant?.rentDueDay && tenant.rentDueDay >= 1 && tenant.rentDueDay <= 31) {
    return Math.floor(tenant.rentDueDay);
  }
  if (property.financials?.rentDueDay && property.financials.rentDueDay >= 1 && property.financials.rentDueDay <= 31) {
    return Math.floor(property.financials.rentDueDay);
  }
  if (property.rentDueDay && property.rentDueDay >= 1 && property.rentDueDay <= 31) {
    return Math.floor(property.rentDueDay);
  }
  return 5;
}
function calculateDueDate(year, month, rentDueDay) {
  const effectiveDueDay = getEffectiveRentDueDay(rentDueDay);
  const maxDays = getDaysInMonth(year, month);
  const clampedDay = Math.min(effectiveDueDay, maxDays);
  const yStr = String(year);
  const mStr = String(month + 1).padStart(2, "0");
  const dStr = String(clampedDay).padStart(2, "0");
  return `${yStr}-${mStr}-${dStr}`;
}
function getRentDueDate(propOrYear, tenantOrMonth, yearOrDueDay, month) {
  if (typeof propOrYear === "number") {
    const year = propOrYear;
    const m = typeof tenantOrMonth === "number" ? tenantOrMonth : 0;
    const dueDay = typeof yearOrDueDay === "number" ? yearOrDueDay : 5;
    return calculateDueDate(year, m, dueDay);
  } else {
    const property = propOrYear;
    const tenant = typeof tenantOrMonth === "object" ? tenantOrMonth : void 0;
    const y = typeof yearOrDueDay === "number" ? yearOrDueDay : (/* @__PURE__ */ new Date()).getFullYear();
    const m = typeof month === "number" ? month : (/* @__PURE__ */ new Date()).getMonth();
    const dueDay = resolveRentDueDay(property, tenant);
    return calculateDueDate(y, m, dueDay);
  }
}
function calculateRentStatus(firstArg, tenantArg, recordsArg, yearArg, monthArg, refDateArg, advanceDaysArg) {
  let property;
  let tenant;
  let rentalRecords;
  let year;
  let month;
  let referenceDate;
  let reminderAdvanceDays = 5;
  if ("property" in firstArg) {
    const p = firstArg;
    property = p.property;
    tenant = p.tenant;
    rentalRecords = p.rentalRecords || [];
    const now = p.referenceDate ? p.referenceDate instanceof Date ? p.referenceDate : new Date(p.referenceDate) : /* @__PURE__ */ new Date();
    year = p.year !== void 0 ? p.year : now.getFullYear();
    month = p.month !== void 0 ? p.month : now.getMonth();
    referenceDate = p.referenceDate;
    reminderAdvanceDays = p.reminderAdvanceDays !== void 0 ? p.reminderAdvanceDays : 5;
  } else {
    property = firstArg;
    tenant = tenantArg;
    rentalRecords = recordsArg || [];
    const now = refDateArg ? refDateArg instanceof Date ? refDateArg : new Date(refDateArg) : /* @__PURE__ */ new Date();
    year = yearArg !== void 0 ? yearArg : now.getFullYear();
    month = monthArg !== void 0 ? monthArg : now.getMonth();
    referenceDate = refDateArg;
    reminderAdvanceDays = advanceDaysArg !== void 0 ? advanceDaysArg : 5;
  }
  const monthlyRent = Number(property.financials?.monthlyRent) || 0;
  const rentDueDay = resolveRentDueDay(property, tenant);
  const dueDate = calculateDueDate(year, month, rentDueDay);
  const daysUntilDue = calculateDaysUntilDue(dueDate, referenceDate);
  const matchingRecords = rentalRecords.filter(
    (r) => r.propertyId === property.id && Number(r.year) === year && Number(r.month) === month
  );
  const totalPaid = matchingRecords.reduce((sum, r) => sum + (Number(r.income) || 0), 0);
  const isPaid = monthlyRent > 0 ? totalPaid >= monthlyRent : matchingRecords.length > 0;
  const remainingAmount = Math.max(0, monthlyRent - totalPaid);
  let paidDate;
  let paymentRecordId;
  let receiptId;
  if (matchingRecords.length > 0) {
    const sorted = [...matchingRecords].sort(
      (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
    );
    paidDate = sorted[0].transactionDate;
    paymentRecordId = sorted[0].id;
    receiptId = sorted.find((r) => Boolean(r.receiptId))?.receiptId;
  }
  let status;
  if (isPaid) {
    status = "SALDATO";
  } else if (daysUntilDue < 0) {
    status = "SCADUTO";
  } else if (daysUntilDue <= reminderAdvanceDays) {
    status = "IN_SCADENZA";
  } else {
    status = "PROGRAMMATO";
  }
  return {
    propertyId: property.id,
    propertyName: property.name,
    tenantId: tenant?.id || property.currentTenantId,
    tenantName: tenant?.name,
    tenantEmail: tenant?.email,
    tenantPhone: tenant?.phone,
    tenantTelegramChatId: tenant?.telegramChatId,
    monthlyRent,
    rentDueDay,
    dueDate,
    status,
    daysUntilDue,
    isPaid,
    paidDate,
    paidAmount: totalPaid,
    remainingAmount,
    paymentRecordId,
    receiptId,
    periodMonth: month,
    periodYear: year
  };
}
var evaluateRentStatusItem = calculateRentStatus;
function evaluateAllRents(firstArg, tenantsArg, recordsArg, yearArg, monthArg, refDateArg, advanceDaysArg) {
  let properties;
  let tenants;
  let rentalRecords;
  let year;
  let month;
  let referenceDate;
  let reminderAdvanceDays = 5;
  if (Array.isArray(firstArg)) {
    properties = firstArg;
    tenants = tenantsArg || [];
    rentalRecords = recordsArg || [];
    year = yearArg;
    month = monthArg;
    referenceDate = refDateArg;
    reminderAdvanceDays = advanceDaysArg !== void 0 ? advanceDaysArg : 5;
  } else {
    const p = firstArg;
    properties = p.properties || [];
    tenants = p.tenants || [];
    rentalRecords = p.rentalRecords || [];
    year = p.year;
    month = p.month;
    referenceDate = p.referenceDate;
    reminderAdvanceDays = p.reminderAdvanceDays !== void 0 ? p.reminderAdvanceDays : 5;
  }
  const now = referenceDate ? referenceDate instanceof Date ? referenceDate : new Date(referenceDate) : /* @__PURE__ */ new Date();
  const targetYear = year !== void 0 ? year : now.getFullYear();
  const targetMonth = month !== void 0 ? month : now.getMonth();
  const tenantMap = new Map(tenants.map((t) => [t.id, t]));
  const rentedProperties = properties.filter((p) => {
    const hasRent = p.financials && Number(p.financials.monthlyRent) > 0;
    const isRented = p.status === "RENTED" || Boolean(p.currentTenantId) || p.status !== "EMPTY" && p.status !== "MAIN_RESIDENCE";
    return hasRent && isRented;
  });
  return rentedProperties.map((property) => {
    const tenant = property.currentTenantId ? tenantMap.get(property.currentTenantId) : void 0;
    return calculateRentStatus({
      property,
      tenant,
      rentalRecords,
      year: targetYear,
      month: targetMonth,
      referenceDate,
      reminderAdvanceDays
    });
  });
}
var calculateMonthlyRentStatuses = evaluateAllRents;
function getRentStatusSummary(items) {
  const saldati = items.filter((i) => i.status === "SALDATO");
  const inScadenza = items.filter((i) => i.status === "IN_SCADENZA");
  const scaduti = items.filter((i) => i.status === "SCADUTO");
  const programmati = items.filter((i) => i.status === "PROGRAMMATO");
  return {
    total: items.length,
    saldatiCount: saldati.length,
    inScadenzaCount: inScadenza.length,
    scadutiCount: scaduti.length,
    programmatiCount: programmati.length,
    totalExpectedRent: items.reduce((acc, i) => acc + i.monthlyRent, 0),
    totalCollectedRent: items.reduce((acc, i) => acc + (i.paidAmount || 0), 0),
    saldati,
    inScadenza,
    scaduti,
    programmati
  };
}
export {
  calculateDaysUntilDue,
  calculateDueDate,
  calculateMonthlyRentStatuses,
  calculateRentStatus,
  evaluateAllRents,
  evaluateRentStatusItem,
  getDaysInMonth,
  getEffectiveRentDueDay,
  getRentDueDate,
  getRentStatusSummary,
  getUtcMidnight,
  isLeapYear,
  resolveRentDueDay
};
