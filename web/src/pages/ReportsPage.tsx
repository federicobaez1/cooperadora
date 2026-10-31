import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PaidIcon from '@mui/icons-material/Paid';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api/client';
import type { ReportSummary } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { formatDate, formatMoney, methodLabel, today } from '../utils/format';
import { getErrorMessage } from '../utils/errors';

interface IncomeByMethod {
  method: string;
  total: number;
  count: number;
}

interface MonthlyIncome {
  month: string;
  total: number;
}

interface Delinquent {
  studentId: string;
  student: string;
  dni: string;
  course: string;
  division: string;
  guardians: string[];
  feesCount: number;
  debt: number;
  oldestDueDate: string;
}

interface CashBookEntry {
  type: 'INGRESO' | 'EGRESO';
  date: string;
  description: string;
  method: string;
  amount: number;
  reference: string;
  balance: number;
}

interface CashBook {
  period: { from: string | null; to: string | null };
  entries: CashBookEntry[];
  totals: { income: number; expenses: number; balance: number };
}

const firstDayOfMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

const monthShort = (period: string): string => {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, 1)
    .toLocaleDateString('es-AR', { month: 'short' })
    .replace('.', '');
};

const pieColors = ['#1e6b52', '#2f8a68', '#c98a2e', '#1f6fa8', '#8f5f17'];

const toCsv = (rows: Array<Array<string | number>>): string =>
  rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? '');
          return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(';'),
    )
    .join('\n');

const downloadCsv = (filename: string, rows: Array<Array<string | number>>): void => {
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function ReportsPage() {
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(today());
  const [year, setYear] = useState(new Date().getFullYear());
  const [delinquentLimit, setDelinquentLimit] = useState('10');

  const params = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
    }),
    [from, to],
  );

  const summaryQuery = useQuery({
    queryKey: ['report-summary', params],
    queryFn: async () => (await api.get<ReportSummary>('/reports/summary', { params })).data,
  });

  const methodsQuery = useQuery({
    queryKey: ['report-methods', params],
    queryFn: async () =>
      (
        await api.get<{ period: unknown; data: IncomeByMethod[] }>(
          '/reports/income-by-method',
          { params },
        )
      ).data.data,
  });

  const monthlyQuery = useQuery({
    queryKey: ['report-monthly', year],
    queryFn: async () =>
      (
        await api.get<{ year: number; data: MonthlyIncome[] }>('/reports/monthly-income', {
          params: { year },
        })
      ).data.data,
  });

  const delinquentsQuery = useQuery({
    queryKey: ['report-delinquents', delinquentLimit],
    queryFn: async () =>
      (
        await api.get<{ data: Delinquent[]; totalDebt: number }>('/reports/delinquents', {
          params: { limit: Number(delinquentLimit) || 10 },
        })
      ).data,
  });

  const cashBookQuery = useQuery({
    queryKey: ['report-cash-book', params],
    queryFn: async () => (await api.get<CashBook>('/reports/cash-book', { params })).data,
  });

  const summary = summaryQuery.data;

  const chartData = (monthlyQuery.data ?? []).map((item) => ({
    name: monthShort(item.month),
    total: item.total,
  }));

  const pieData = (methodsQuery.data ?? []).map((item) => ({
    name: methodLabel[item.method] ?? item.method,
    value: item.total,
  }));

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, index) => current - index);
  }, []);

  const exportSummary = () => {
    if (!summary) return;
    downloadCsv(`resumen-${from}-${to}.csv`, [
      ['Reporte', 'Desde', from, 'Hasta', to],
      [],
      ['Ingresos', summary.income],
      ['Egresos', summary.expenses],
      ['Balance', summary.balance],
      ['Pagos registrados', summary.paymentsCount],
      ['Egresos registrados', summary.expensesCount],
      ['Saldo pendiente', summary.pending.balance],
      ['Deuda vencida', summary.overdue.balance],
      ['Alumnos activos', summary.activeStudents],
      ['Familias activas', summary.activeGuardians],
    ]);
  };

  const exportCashBook = () => {
    if (!cashBookQuery.data) return;
    downloadCsv(`libro-caja-${from}-${to}.csv`, [
      ['Tipo', 'Fecha', 'Descripción', 'Medio', 'Referencia', 'Importe', 'Saldo'],
      ...cashBookQuery.data.entries.map((entry) => [
        entry.type,
        formatDate(entry.date),
        entry.description,
        methodLabel[entry.method] ?? entry.method,
        entry.reference,
        entry.amount,
        entry.balance,
      ]),
      [],
      ['Totales', '', '', '', '', '', ''],
      ['Ingresos', cashBookQuery.data.totals.income],
      ['Egresos', cashBookQuery.data.totals.expenses],
      ['Balance', cashBookQuery.data.totals.balance],
    ]);
  };

  const exportDelinquents = () => {
    if (!delinquentsQuery.data) return;
    downloadCsv('morosos.csv', [
      ['Alumno', 'DNI', 'Curso', 'División', 'Familias', 'Cuotas', 'Deuda', 'Vencimiento más antiguo'],
      ...delinquentsQuery.data.data.map((item) => [
        item.student,
        item.dni,
        item.course,
        item.division,
        item.guardians.join(' / '),
        item.feesCount,
        item.debt,
        formatDate(item.oldestDueDate),
      ]),
    ]);
  };

  return (
    <Box>
      <PageHeader
        title="Reportes"
        subtitle="Ingresos, egresos, deudas y libro de caja"
        action={
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportSummary}
            disabled={!summary}
          >
            Exportar resumen
          </Button>
        }
      />

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
            gap: 2,
            alignItems: 'center',
          }}
        >
          <TextField
            label="Desde"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <TextField
            label="Hasta"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setFrom(firstDayOfMonth());
                setTo(today());
              }}
            >
              Mes actual
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                const now = new Date();
                setFrom(`${now.getFullYear()}-01-01`);
                setTo(today());
              }}
            >
              Año actual
            </Button>
          </Box>
        </Box>
      </Paper>

      {summaryQuery.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getErrorMessage(summaryQuery.error)}
        </Alert>
      )}

      {summaryQuery.isLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        summary && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(4, 1fr)' },
                gap: 2,
                mb: 3,
              }}
            >
              <StatCard
                title="Ingresos del período"
                value={formatMoney(summary.income)}
                hint={`${summary.paymentsCount} pagos`}
                icon={<PaidIcon />}
              />
              <StatCard
                title="Egresos del período"
                value={formatMoney(summary.expenses)}
                hint={`${summary.expensesCount} movimientos`}
                icon={<TrendingDownIcon />}
                color="#b3261e"
              />
              <StatCard
                title="Balance del período"
                value={formatMoney(summary.balance)}
                icon={<AccountBalanceWalletIcon />}
                color={summary.balance >= 0 ? '#2e7d32' : '#b3261e'}
              />
              <StatCard
                title="Deuda vencida"
                value={formatMoney(summary.overdue.balance)}
                hint={`${summary.overdue.count} cuotas · pendiente total ${formatMoney(
                  summary.pending.balance,
                )}`}
                icon={<WarningAmberIcon />}
                color="#b26a00"
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6">Recaudación mensual</Typography>
                    <TextField
                      select
                      label="Año"
                      value={year}
                      onChange={(event) => setYear(Number(event.target.value))}
                      sx={{ width: 120 }}
                    >
                      {years.map((item) => (
                        <MenuItem key={item} value={item}>
                          {item}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                  <Box sx={{ width: '100%', height: 300 }}>
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
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Ingresos por medio de pago
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Según el período seleccionado
                  </Typography>
                  {pieData.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No hay ingresos en el período.
                    </Typography>
                  ) : (
                    <>
                      <Box sx={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={pieData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={55}
                              outerRadius={90}
                              paddingAngle={2}
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => formatMoney(Number(value))} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                      <Divider sx={{ my: 1 }} />
                      {(methodsQuery.data ?? []).map((item) => (
                        <Box
                          key={item.method}
                          sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            {methodLabel[item.method] ?? item.method} ({item.count})
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {formatMoney(item.total)}
                          </Typography>
                        </Box>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            </Box>
          </>
        )
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box>
              <Typography variant="h6">Alumnos morosos</Typography>
              <Typography variant="body2" color="text.secondary">
                Cuotas vencidas sin pagar, ordenadas por deuda
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                select
                label="Límite"
                value={delinquentLimit}
                onChange={(event) => setDelinquentLimit(event.target.value)}
                sx={{ width: 110 }}
              >
                {['5', '10', '20', '50'].map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                startIcon={<DownloadIcon />}
                onClick={exportDelinquents}
                disabled={!delinquentsQuery.data}
              >
                CSV
              </Button>
            </Box>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Alumno</TableCell>
                  <TableCell>Curso</TableCell>
                  <TableCell>Familias</TableCell>
                  <TableCell align="right">Cuotas</TableCell>
                  <TableCell>Vencimiento más antiguo</TableCell>
                  <TableCell align="right">Deuda</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {delinquentsQuery.data?.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                        No hay cuotas vencidas.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {delinquentsQuery.data?.data.map((item) => (
                  <TableRow key={item.studentId} hover>
                    <TableCell>{item.student}</TableCell>
                    <TableCell>
                      {item.course} {item.division}
                    </TableCell>
                    <TableCell>{item.guardians.join(' · ') || '-'}</TableCell>
                    <TableCell align="right">{item.feesCount}</TableCell>
                    <TableCell>{formatDate(item.oldestDueDate)}</TableCell>
                    <TableCell align="right" sx={{ color: '#b3261e', fontWeight: 600 }}>
                      {formatMoney(item.debt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box>
              <Typography variant="h6">Libro de caja</Typography>
              <Typography variant="body2" color="text.secondary">
                Ingresos y egresos ordenados por fecha con saldo acumulado
              </Typography>
            </Box>
            <Button
              startIcon={<DownloadIcon />}
              onClick={exportCashBook}
              disabled={!cashBookQuery.data}
            >
              Exportar CSV
            </Button>
          </Box>
          {cashBookQuery.isLoading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 440 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Descripción</TableCell>
                    <TableCell>Medio</TableCell>
                    <TableCell align="right">Importe</TableCell>
                    <TableCell align="right">Saldo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cashBookQuery.data?.entries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                          No hay movimientos en el período.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {cashBookQuery.data?.entries.map((entry, index) => (
                    <TableRow key={`${entry.type}-${entry.reference}-${index}`} hover>
                      <TableCell>{formatDate(entry.date)}</TableCell>
                      <TableCell>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: entry.type === 'INGRESO' ? 'success.main' : 'error.main',
                          }}
                        >
                          {entry.type}
                        </Typography>
                      </TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>{methodLabel[entry.method] ?? entry.method}</TableCell>
                      <TableCell align="right">{formatMoney(entry.amount)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {formatMoney(entry.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {cashBookQuery.data && cashBookQuery.data.entries.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <strong>Totales</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>
                          Ing. {formatMoney(cashBookQuery.data.totals.income)} · Egr.{' '}
                          {formatMoney(cashBookQuery.data.totals.expenses)}
                        </strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatMoney(cashBookQuery.data.totals.balance)}</strong>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
