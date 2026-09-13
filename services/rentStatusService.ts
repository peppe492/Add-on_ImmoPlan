import { Property, Tenant, RentalRecord, RentPaymentStatus, RentStatusItem } from '../types';

/**
 * Checks whether a given year is a leap year in the Gregorian calendar.
 * Rules: divisible by 4, but not by 100 unless also divisible by 400.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Returns the exact number of days in a given month and year.
 * Handles Gregorian leap years correctly (e.g. 2024 -> 29, 2026 -> 28, 2000 -> 29, 2100 -> 28).
 * Note: month is 0-indexed (0 = January, 11 = December).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Normalizes and clamps a rent due day to a valid integer between 1 and 31.
 * Defaults to 5 if undefined, null, or out of range.
 */
export function getEffectiveRentDueDay(rentDueDay?: number | null): number {
  if (rentDueDay === undefined || rentDueDay === null || isNaN(rentDueDay)) {
    return 5;
  }
  const intVal = Math.floor(rentDueDay);
  if (intVal < 1 || intVal > 31) {
    return 5;
  }
  return intVal;
}

/**
 * Normalizes a date input to UTC midnight timestamp in milliseconds.
 * Ensures calendar-day difference calculation is invariant to time-of-day and timezone offsets.
 */
export function getUtcMidnight(dateInput?: string | Date): number {
  if (!dateInput) {
    const now = new Date();
    return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (typeof dateInput === 'string') {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return Date.UTC(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    }
    const d = new Date(dateInput);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return Date.UTC(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
}

/**
 * Calculates the integer signed difference in calendar days between referenceDate and dueDate.
 * Formula: dueDate - referenceDate
 * Result:
 *  - Negative: Overdue (e.g. -3 = 3 days overdue)
 *  - 0: Due today
 *  - Positive: Upcoming (e.g. 5 = due in 5 days)
 */
export function calculateDaysUntilDue(dueDate: string, referenceDate?: string | Date): number {
  const dueMidnight = getUtcMidnight(dueDate);
  const refMidnight = getUtcMidnight(referenceDate);
  const diffMs = dueMidnight - refMidnight;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Resolves the agreed rent due day by checking tenant first, then property financials, then property root, defaulting to 5.
 */
export function resolveRentDueDay(property: Property, tenant?: Tenant | Tenant[]): number {
  const actualTenant = Array.isArray(tenant) ? tenant.find(t => t.id === property.currentTenantId) : tenant;
  if (actualTenant?.rentDueDay && actualTenant.rentDueDay >= 1 && actualTenant.rentDueDay <= 31) {
    return Math.floor(actualTenant.rentDueDay);
  }
  if (property.financials?.rentDueDay && property.financials.rentDueDay >= 1 && property.financials.rentDueDay <= 31) {
    return Math.floor(property.financials.rentDueDay);
  }
  if (property.rentDueDay && property.rentDueDay >= 1 && property.rentDueDay <= 31) {
    return Math.floor(property.rentDueDay);
  }
  return 5;
}

/**
 * Calculates the exact ISO dueDate string (YYYY-MM-DD) for a given month and year,
 * clamping the day to the last valid day of that specific month.
 * Examples:
 * - calculateDueDate(2026, 1, 31) => "2026-02-28"
 * - calculateDueDate(2024, 1, 31) => "2024-02-29" (leap year)
 * - calculateDueDate(2026, 3, 31) => "2026-04-30" (April has 30 days)
 */
export function calculateDueDate(year: number, month: number, rentDueDay?: number | null): string {
  const effectiveDueDay = getEffectiveRentDueDay(rentDueDay);
  const maxDays = getDaysInMonth(year, month);
  const clampedDay = Math.min(effectiveDueDay, maxDays);

  const yStr = String(year);
  const mStr = String(month + 1).padStart(2, '0');
  const dStr = String(clampedDay).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Pure calculation engine to get the rent due date.
 * Supports both (year, month, rentDueDay) and (property, tenant, year, month).
 */
export function getRentDueDate(
  propOrYear: Property | number,
  tenantOrMonth?: Tenant | Tenant[] | number,
  yearOrDueDay?: number | null,
  month?: number
): string {
  if (typeof propOrYear === 'number') {
    const year = propOrYear;
    const m = typeof tenantOrMonth === 'number' ? tenantOrMonth : 0;
    const dueDay = typeof yearOrDueDay === 'number' ? yearOrDueDay : 5;
    return calculateDueDate(year, m, dueDay);
  } else {
    const property = propOrYear;
    const tenant = (typeof tenantOrMonth === 'object' && tenantOrMonth !== null) ? tenantOrMonth : undefined;
    const y = typeof yearOrDueDay === 'number' ? yearOrDueDay : new Date().getFullYear();
    const m = typeof month === 'number' ? month : new Date().getMonth();
    const dueDay = resolveRentDueDay(property, tenant as any);
    return calculateDueDate(y, m, dueDay);
  }
}

export interface CalculateRentStatusParams {
  property: Property;
  tenant?: Tenant | Tenant[];
  rentalRecords: RentalRecord[];
  year?: number;
  month?: number; // 0 to 11
  referenceDate?: string | Date;
  reminderAdvanceDays?: number; // default: 5
}

/**
 * Evaluates the rent payment status for a single property and month.
 * Supports both an options object and positional arguments.
 */
export function calculateRentStatus(params: CalculateRentStatusParams): RentStatusItem;
export function calculateRentStatus(
  property: Property,
  tenant?: Tenant | Tenant[],
  rentalRecords?: RentalRecord[],
  year?: number,
  month?: number,
  referenceDate?: string | Date,
  reminderAdvanceDays?: number
): RentStatusItem;
export function calculateRentStatus(
  firstArg: Property | CalculateRentStatusParams,
  tenantArg?: Tenant | Tenant[],
  recordsArg?: RentalRecord[],
  yearArg?: number,
  monthArg?: number,
  refDateArg?: string | Date,
  advanceDaysArg?: number
): RentStatusItem {
  let property: Property;
  let tenant: Tenant | undefined;
  let rentalRecords: RentalRecord[];
  let year: number;
  let month: number;
  let referenceDate: string | Date | undefined;
  let reminderAdvanceDays = 5;

  if ('property' in (firstArg as any)) {
    const p = firstArg as CalculateRentStatusParams;
    property = p.property;
    tenant = Array.isArray(p.tenant) ? p.tenant.find(t => t.id === property.currentTenantId) : p.tenant;
    rentalRecords = p.rentalRecords || [];
    const now = p.referenceDate ? (p.referenceDate instanceof Date ? p.referenceDate : new Date(p.referenceDate)) : new Date();
    year = p.year !== undefined ? p.year : now.getFullYear();
    month = p.month !== undefined ? p.month : now.getMonth();
    referenceDate = p.referenceDate;
    reminderAdvanceDays = p.reminderAdvanceDays !== undefined ? p.reminderAdvanceDays : 5;
  } else {
    property = firstArg as Property;
    tenant = Array.isArray(tenantArg) ? tenantArg.find(t => t.id === property.currentTenantId) : tenantArg;
    rentalRecords = recordsArg || [];
    const now = refDateArg ? (refDateArg instanceof Date ? refDateArg : new Date(refDateArg)) : new Date();
    year = yearArg !== undefined ? yearArg : now.getFullYear();
    month = monthArg !== undefined ? monthArg : now.getMonth();
    referenceDate = refDateArg;
    reminderAdvanceDays = advanceDaysArg !== undefined ? advanceDaysArg : 5;
  }

  const monthlyRent = Number(property.financials?.monthlyRent) || 0;
  const rentDueDay = resolveRentDueDay(property, tenant);
  const dueDate = calculateDueDate(year, month, rentDueDay);
  const daysUntilDue = calculateDaysUntilDue(dueDate, referenceDate);

  // Cross-reference rental records for this property, year, and month
  const matchingRecords = rentalRecords.filter(r =>
    r.propertyId === property.id &&
    Number(r.year) === year &&
    Number(r.month) === month
  );

  const totalPaid = matchingRecords.reduce((sum, r) => sum + (Number(r.income) || 0), 0);
  const isPaid = monthlyRent > 0 ? totalPaid >= monthlyRent : matchingRecords.length > 0;
  const remainingAmount = Math.max(0, monthlyRent - totalPaid);

  let paidDate: string | undefined;
  let paymentRecordId: string | undefined;
  let receiptId: string | undefined;

  if (matchingRecords.length > 0) {
    const sorted = [...matchingRecords].sort((a, b) =>
      new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
    );
    paidDate = sorted[0].transactionDate;
    paymentRecordId = sorted[0].id;
    receiptId = sorted.find(r => Boolean(r.receiptId))?.receiptId;
  }

  // Determine Status
  let status: RentPaymentStatus;
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

/** Alias for calculateRentStatus */
export const evaluateRentStatusItem = calculateRentStatus;

export interface EvaluateAllRentsParams {
  properties: Property[];
  tenants: Tenant[];
  rentalRecords: RentalRecord[];
  year?: number;
  month?: number; // 0 to 11
  referenceDate?: string | Date;
  reminderAdvanceDays?: number; // default: 5
}

/**
 * Calculates rent statuses for all actively rented properties for a specified month (or current month).
 * Supports both an options object and positional arguments.
 */
export function evaluateAllRents(params: EvaluateAllRentsParams): RentStatusItem[];
export function evaluateAllRents(
  properties: Property[],
  tenants: Tenant[],
  rentalRecords: RentalRecord[],
  year?: number,
  month?: number,
  referenceDate?: string | Date,
  reminderAdvanceDays?: number
): RentStatusItem[];
export function evaluateAllRents(
  firstArg: Property[] | EvaluateAllRentsParams,
  tenantsArg?: Tenant[],
  recordsArg?: RentalRecord[],
  yearArg?: number,
  monthArg?: number,
  refDateArg?: string | Date,
  advanceDaysArg?: number
): RentStatusItem[] {
  let properties: Property[];
  let tenants: Tenant[];
  let rentalRecords: RentalRecord[];
  let year: number | undefined;
  let month: number | undefined;
  let referenceDate: string | Date | undefined;
  let reminderAdvanceDays = 5;

  if (Array.isArray(firstArg)) {
    properties = firstArg;
    tenants = tenantsArg || [];
    rentalRecords = recordsArg || [];
    year = yearArg;
    month = monthArg;
    referenceDate = refDateArg;
    reminderAdvanceDays = advanceDaysArg !== undefined ? advanceDaysArg : 5;
  } else {
    const p = firstArg as EvaluateAllRentsParams;
    properties = p.properties || [];
    tenants = p.tenants || [];
    rentalRecords = p.rentalRecords || [];
    year = p.year;
    month = p.month;
    referenceDate = p.referenceDate;
    reminderAdvanceDays = p.reminderAdvanceDays !== undefined ? p.reminderAdvanceDays : 5;
  }

  const now = referenceDate ? (referenceDate instanceof Date ? referenceDate : new Date(referenceDate)) : new Date();
  const targetYear = year !== undefined ? year : now.getFullYear();
  const targetMonth = month !== undefined ? month : now.getMonth();

  const tenantMap = new Map(tenants.map(t => [t.id, t]));

  const rentedProperties = properties.filter(p => {
    const hasRent = p.financials && Number(p.financials.monthlyRent) > 0;
    const isRented = p.status === 'RENTED' || Boolean(p.currentTenantId) || (p.status !== 'EMPTY' && p.status !== 'MAIN_RESIDENCE');
    return hasRent && isRented;
  });

  return rentedProperties.map(property => {
    const tenant = property.currentTenantId ? tenantMap.get(property.currentTenantId) : undefined;
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

/** Alias for evaluateAllRents */
export const calculateMonthlyRentStatuses = evaluateAllRents;

/**
 * Summary breakdown of rent statuses for dashboard cards and notifications.
 */
export function getRentStatusSummary(items: RentStatusItem[]) {
  const saldati = items.filter(i => i.status === 'SALDATO');
  const inScadenza = items.filter(i => i.status === 'IN_SCADENZA');
  const scaduti = items.filter(i => i.status === 'SCADUTO');
  const programmati = items.filter(i => i.status === 'PROGRAMMATO');

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
