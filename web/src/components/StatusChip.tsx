import { Chip } from '@mui/material';

type ChipColor = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

const map: Record<string, { label: string; color: ChipColor }> = {
  PENDIENTE: { label: 'Pendiente', color: 'warning' },
  PARCIAL: { label: 'Parcial', color: 'info' },
  PAGA: { label: 'Paga', color: 'success' },
  ANULADA: { label: 'Anulada', color: 'default' },
  ACTIVO: { label: 'Activo', color: 'success' },
  ANULADO: { label: 'Anulado', color: 'error' },
  INACTIVO: { label: 'Inactivo', color: 'default' },
  EGRESADO: { label: 'Egresado', color: 'default' },
  ABIERTA: { label: 'Abierta', color: 'success' },
  CERRADA: { label: 'Cerrada', color: 'default' },
  ADMIN: { label: 'Administrador', color: 'primary' },
  TESORERO: { label: 'Tesorero', color: 'info' },
  CONSULTA: { label: 'Consulta', color: 'default' },
};

export function StatusChip({ status }: { status?: string | null }) {
  if (!status) return null;
  const item = map[status] ?? { label: status, color: 'default' as const };
  return <Chip size="small" label={item.label} color={item.color} />;
}
