export const formatMoney = (value: number | string | null | undefined): string => {
  const amount = Number(value ?? 0);
  return `$ ${amount.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Las fechas operativas (pagos, egresos, vencimientos, nacimientos) se guardan
// como fecha calendario a medianoche UTC. Se formatean en UTC para no correrlas
// un día en zonas horarias negativas como Argentina (UTC-3).
export const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-AR', { timeZone: 'UTC' });
};

export const formatDateTime = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
};

export const formatPeriod = (period?: string | null): string => {
  if (!period) return '-';
  if (/^\d{4}$/.test(period)) return period;
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  const label = new Date(year, month - 1, 1).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

// Fecha de hoy según el calendario local. No usar toISOString(): en Argentina
// (UTC-3) a partir de las 21:00 devuelve el día siguiente.
export const today = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
};

export const currentPeriod = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const fullName = (person?: { firstName?: string; lastName?: string } | null): string =>
  person ? `${person.lastName ?? ''}, ${person.firstName ?? ''}`.replace(/^, /, '') : '-';

export const roleLabel: Record<string, string> = {
  ADMIN: 'Administrador',
  TESORERO: 'Tesorero',
  CONSULTA: 'Consulta',
};

export const methodLabel: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  MERCADO_PAGO: 'Mercado Pago',
  CHEQUE: 'Cheque',
};

export const conceptTypeLabel: Record<string, string> = {
  CUOTA_SOCIAL: 'Cuota social',
  MATRICULA: 'Matrícula',
  ACTIVIDAD: 'Actividad',
  VIAJE: 'Viaje',
  OTRO: 'Otro',
};

export const relationLabel: Record<string, string> = {
  PADRE: 'Padre',
  MADRE: 'Madre',
  TUTOR: 'Tutor',
  OTRO: 'Otro',
};
