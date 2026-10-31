import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PaidIcon from '@mui/icons-material/Paid';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SchoolIcon from '@mui/icons-material/School';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import AddCardIcon from '@mui/icons-material/AddCard';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { api } from '../api/client';
import type { CashSession, Payment, ReportSummary } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { formatDate, formatDateTime, formatMoney } from '../utils/format';
import { getErrorMessage } from '../utils/errors';

interface DashboardData {
  summary: ReportSummary;
  monthlyIncome: Array<{ month: string; total: number }>;
  recentPayments: Payment[];
  delinquents: Array<{
    studentId: string;
    student: string;
    course: string;
    division: string;
    debt: number;
    feesCount: number;
  }>;
  cashSession: CashSession | null;
}

const monthShort = (period: string): string => {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, 1)
    .toLocaleDateString('es-AR', { month: 'short' })
    .replace('.', '');
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<DashboardData>('/reports/dashboard')).data,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data) {
    return <Alert severity="error">{getErrorMessage(error)}</Alert>;
  }

  const { summary } = data;
  const chartData = data.monthlyIncome.map((item) => ({
    name: monthShort(item.month),
    total: item.total,
  }));

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        subtitle="Resumen de la situación de la cooperadora"
        action={
          <>
            <Button
              variant="outlined"
              startIcon={<ReceiptLongIcon />}
              onClick={() => navigate('/cuotas')}
            >
              Generar cuotas
            </Button>
            <Button
              variant="contained"
              startIcon={<AddCardIcon />}
              onClick={() => navigate('/pagos/nuevo')}
            >
              Registrar pago
            </Button>
          </>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        <StatCard
          title="Recaudado del mes"
          value={formatMoney(summary.income)}
          hint={`${summary.paymentsCount} pagos registrados`}
          icon={<PaidIcon />}
        />
        <StatCard
          title="Saldo pendiente"
          value={formatMoney(summary.pending.balance)}
          hint={`${summary.pending.count} cuotas abiertas`}
          icon={<HourglassBottomIcon />}
          color="#b26a00"
        />
        <StatCard
          title="Deuda vencida"
          value={formatMoney(summary.overdue.balance)}
          hint={`${summary.overdue.count} cuotas vencidas`}
          icon={<WarningAmberIcon />}
          color="#b3261e"
        />
        <StatCard
          title="Alumnos activos"
          value={String(summary.activeStudents)}
          hint={`${summary.activeGuardians} familias activas`}
          icon={<SchoolIcon />}
          color="#1f6fa8"
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
          gap: 2,
          mb: 3,
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recaudación {new Date().getFullYear()}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Ingresos por mes según fecha de pago
            </Typography>
            <Box sx={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8e4" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    tickFormatter={(value: number) =>
                      value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`
                    }
                  />
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                  <Bar dataKey="total" fill="#1e6b52" radius={[6, 6, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <PointOfSaleIcon color="primary" />
              <Typography variant="h6">Caja</Typography>
            </Box>
            {data.cashSession ? (
              <>
                <Typography variant="body2" color="text.secondary">
                  Abierta por {data.cashSession.openedBy?.name ?? '-'}
                </Typography>
                <Typography variant="h5" sx={{ mt: 1, fontWeight: 700 }}>
                  {formatMoney(data.cashSession.openingAmount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Fondo inicial · {formatDateTime(data.cashSession.openedAt)}
                </Typography>
                <Button
                  variant="contained"
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/caja')}
                >
                  Gestionar caja
                </Button>
              </>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  No hay una caja abierta en este momento.
                </Typography>
                <Button
                  variant="outlined"
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/caja')}
                >
                  Abrir caja
                </Button>
              </>
            )}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Accesos rápidos
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button size="small" onClick={() => navigate('/reportes')} sx={{ justifyContent: 'flex-start' }}>
                Ver reportes
              </Button>
              <Button size="small" onClick={() => navigate('/cuotas')} sx={{ justifyContent: 'flex-start' }}>
                Cuotas pendientes
              </Button>
              <Button size="small" onClick={() => navigate('/familias')} sx={{ justifyContent: 'flex-start' }}>
                Estado de cuenta por familia
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Últimos pagos
            </Typography>
            {data.recentPayments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Todavía no hay pagos registrados.
              </Typography>
            ) : (
              <List disablePadding>
                {data.recentPayments.map((payment) => (
                  <ListItem
                    key={payment.id}
                    disableGutters
                    secondaryAction={
                      <Typography variant="subtitle2">{formatMoney(payment.total)}</Typography>
                    }
                  >
                    <ListItemText
                      primary={`${payment.guardian?.lastName}, ${payment.guardian?.firstName}`}
                      secondary={`${payment.receiptNumber} · ${formatDate(payment.date)}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Mayores deudores
            </Typography>
            {data.delinquents.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No hay cuotas vencidas.
              </Typography>
            ) : (
              <List disablePadding>
                {data.delinquents.map((item) => (
                  <ListItem
                    key={item.studentId}
                    disableGutters
                    secondaryAction={
                      <Typography variant="subtitle2" color="error">
                        {formatMoney(item.debt)}
                      </Typography>
                    }
                  >
                    <ListItemText
                      primary={item.student}
                      secondary={`${item.course} ${item.division} · ${item.feesCount} cuotas`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
