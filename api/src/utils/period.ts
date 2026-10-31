export const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isValidPeriod = (period: string): boolean => PERIOD_REGEX.test(period);

export const periodFromDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const periodLabel = (period: string): string => {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
};

export const dueDateFor = (period: string, dueDay = 10): Date => {
  const [year, month] = period.split('-').map(Number);
  const safeDay = Math.min(Math.max(dueDay, 1), 28);
  return new Date(Date.UTC(year, month - 1, safeDay));
};

// Límites de calendario local expresados en UTC. Las fechas operativas
// (vencimientos, pagos, egresos) se guardan a medianoche UTC, así que filtrar
// con la medianoche local (UTC-3) dejaría afuera los registros del día 1.
export const startOfDayUtc = (date: Date = new Date()): Date =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

export const startOfMonthUtc = (date: Date = new Date()): Date =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));

export const endOfMonthUtc = (date: Date = new Date()): Date =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999));

export const dateRange = (from?: string, to?: string): { gte?: Date; lte?: Date } => {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) {
    const start = new Date(`${from}T00:00:00.000Z`);
    if (!Number.isNaN(start.getTime())) range.gte = start;
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999Z`);
    if (!Number.isNaN(end.getTime())) range.lte = end;
  }
  return range;
};
