import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { api } from '../api/client';
import type { CashSession, Expense, Payment } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { PaginationBar } from '../components/PaginationBar';
import { StatusChip } from '../components/StatusChip';
import { StatCard } from '../components/StatCard';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  methodLabel,
} from '../utils/format';
import { getErrorMessage } from '../utils/errors';

interface CashSummary {
  cashIncome: number;
  cashExpenses: number;
  paymentsCount: number;
  expensesCount: number;
  expectedAmount?: number;
  openingAmount?: number;
  countedAmount?: number;
  difference?: number;
}

interface CurrentResponse {
  session: CashSession | null;
  summary: CashSummary | null;
}

interface SessionDetail {
  session: CashSession;
  payments: Payment[];
  expenses: Expense[];
  summary: CashSummary;
}

interface SessionsResponse {
  data: CashSession[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export default function CashPage() {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'TESORERO';

  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('0');
  const [countedAmount, setCountedAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: current, isLoading } = useQuery({
    queryKey: ['cash-current'],
    queryFn: async () => (await api.get<CurrentResponse>('/cash/current')).data,
  });

  const { data: sessions } = useQuery({
    queryKey: ['cash-sessions', page, pageSize],
    queryFn: async () =>
      (await api.get<SessionsResponse>('/cash/sessions', { params: { page, pageSize } })).data,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['cash-session', detailId],
    queryFn: async () => (await api.get<SessionDetail>(`/cash/sessions/${detailId}`)).data,
    enabled: Boolean(detailId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cash-current'] });
    queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['cash-session'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const openMutation = useMutation({
    mutationFn: async () =>
      api.post('/cash/open', {
        openingAmount: Number(openingAmount) || 0,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      notify('Caja abierta');
      setOpenDialog(false);
      setNotes('');
      invalidate();
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  const closeMutation = useMutation({
    mutationFn: async () =>
      api.post('/cash/close', {
        countedAmount: Number(countedAmount) || 0,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      notify('Caja cerrada correctamente');
      setCloseDialog(false);
      setNotes('');
      setCountedAmount('');
      invalidate();
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const session = current?.session ?? null;
  const summary = current?.summary ?? null;

  return (
    <Box>
      <PageHeader
        title="Caja"
        subtitle="Apertura, cierre y movimientos de efectivo"
        action={
          canEdit ? (
            session ? (
              <Button
                variant="contained"
                color="error"
                startIcon={<LockIcon />}
                onClick={() => {
                  setCountedAmount(String(summary?.expectedAmount ?? 0));
                  setNotes('');
                  setCloseDialog(true);
                }}
              >
                Cerrar caja
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<LockOpenIcon />}
                onClick={() => {
                  setOpeningAmount('0');
                  setNotes('');
                  setOpenDialog(true);
                }}
              >
                Abrir caja
              </Button>
            )
          ) : undefined
        }
      />

      {session ? (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1,
                  mb: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <PointOfSaleIcon color="primary" />
                  <Box>
                    <Typography variant="h6">Caja abierta</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Abierta por {session.openedBy?.name ?? '-'} el{' '}
                      {formatDateTime(session.openedAt)}
                    </Typography>
                  </Box>
                </Box>
                <StatusChip status={session.status} />
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(4, 1fr)' },
                  gap: 2,
                }}
              >
                <StatCard
                  title="Fondo inicial"
                  value={formatMoney(session.openingAmount)}
                  icon={<PointOfSaleIcon />}
                />
                <StatCard
                  title="Ingresos en efectivo"
                  value={formatMoney(summary?.cashIncome ?? 0)}
                  hint={`${summary?.paymentsCount ?? 0} pagos`}
                  icon={<PointOfSaleIcon />}
                  color="#2e7d32"
                />
                <StatCard
                  title="Egresos en efectivo"
                  value={formatMoney(summary?.cashExpenses ?? 0)}
                  hint={`${summary?.expensesCount ?? 0} egresos`}
                  icon={<PointOfSaleIcon />}
                  color="#b3261e"
                />
                <StatCard
                  title="Saldo esperado"
                  value={formatMoney(summary?.expectedAmount ?? 0)}
                  icon={<PointOfSaleIcon />}
                  color="#1f6fa8"
                />
              </Box>
            </CardContent>
          </Card>
        </>
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>
          No hay una caja abierta. Abrí la caja para registrar el fondo inicial del día.
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Historial de cajas
      </Typography>
      <Paper sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Apertura</TableCell>
                <TableCell>Cierre</TableCell>
                <TableCell>Abrió</TableCell>
                <TableCell align="right">Fondo</TableCell>
                <TableCell align="right">Esperado</TableCell>
                <TableCell align="right">Contado</TableCell>
                <TableCell align="right">Diferencia</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions?.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      Todavía no hay cajas registradas.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {sessions?.data.map((item) => {
                const difference = item.difference ?? 0;
                return (
                  <TableRow key={item.id} hover>
                    <TableCell>{formatDateTime(item.openedAt)}</TableCell>
                    <TableCell>{item.closedAt ? formatDateTime(item.closedAt) : '-'}</TableCell>
                    <TableCell>{item.openedBy?.name ?? '-'}</TableCell>
                    <TableCell align="right">{formatMoney(item.openingAmount)}</TableCell>
                    <TableCell align="right">
                      {item.expectedAmount === null || item.expectedAmount === undefined
                        ? '-'
                        : formatMoney(item.expectedAmount)}
                    </TableCell>
                    <TableCell align="right">
                      {item.countedAmount === null || item.countedAmount === undefined
                        ? '-'
                        : formatMoney(item.countedAmount)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ color: difference === 0 ? 'text.primary' : '#b3261e', fontWeight: 600 }}
                    >
                      {item.difference === null || item.difference === undefined
                        ? '-'
                        : formatMoney(difference)}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={item.status} />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        startIcon={<VisibilityIcon />}
                        onClick={() => setDetailId(item.id)}
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        {sessions && (
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={sessions.pagination.total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Abrir caja</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
          <TextField
            label="Fondo inicial"
            type="number"
            inputProps={{ step: '0.01', min: 0 }}
            value={openingAmount}
            onChange={(event) => setOpeningAmount(event.target.value)}
            fullWidth
          />
          <TextField
            label="Notas (opcional)"
            multiline
            minRows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={openMutation.isPending || Number(openingAmount) < 0}
            onClick={() => openMutation.mutate()}
          >
            {openMutation.isPending ? 'Abriendo...' : 'Abrir caja'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={closeDialog} onClose={() => setCloseDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Cerrar caja</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
          <Alert severity="info">
            Saldo esperado: <strong>{formatMoney(summary?.expectedAmount ?? 0)}</strong>
          </Alert>
          <TextField
            label="Efectivo contado"
            type="number"
            inputProps={{ step: '0.01', min: 0 }}
            value={countedAmount}
            onChange={(event) => setCountedAmount(event.target.value)}
            fullWidth
            autoFocus
          />
          {countedAmount !== '' && (
            <Typography
              variant="body2"
              color={
                Math.round((Number(countedAmount) - (summary?.expectedAmount ?? 0)) * 100) === 0
                  ? 'success.main'
                  : 'error'
              }
            >
              Diferencia: {formatMoney(Number(countedAmount) - (summary?.expectedAmount ?? 0))}
            </Typography>
          )}
          <TextField
            label="Notas (opcional)"
            multiline
            minRows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCloseDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            disabled={closeMutation.isPending || countedAmount === '' || Number(countedAmount) < 0}
            onClick={() => closeMutation.mutate()}
          >
            {closeMutation.isPending ? 'Cerrando...' : 'Cerrar caja'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(detailId)} onClose={() => setDetailId(null)} maxWidth="md" fullWidth>
        <DialogTitle>Detalle de caja</DialogTitle>
        <DialogContent>
          {detailLoading || !detail ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.5,
                  mb: 2,
                }}
              >
                <Typography variant="body2">
                  <strong>Apertura:</strong> {formatDateTime(detail.session.openedAt)}
                </Typography>
                <Typography variant="body2">
                  <strong>Cierre:</strong>{' '}
                  {detail.session.closedAt ? formatDateTime(detail.session.closedAt) : 'Abierta'}
                </Typography>
                <Typography variant="body2">
                  <strong>Fondo inicial:</strong> {formatMoney(detail.session.openingAmount)}
                </Typography>
                <Typography variant="body2">
                  <strong>Esperado:</strong> {formatMoney(detail.summary.expectedAmount ?? 0)}
                </Typography>
                {detail.session.countedAmount !== null &&
                  detail.session.countedAmount !== undefined && (
                    <>
                      <Typography variant="body2">
                        <strong>Contado:</strong> {formatMoney(detail.session.countedAmount)}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color:
                            Number(detail.session.difference ?? 0) === 0
                              ? 'success.main'
                              : 'error.main',
                          fontWeight: 600,
                        }}
                      >
                        <strong>Diferencia:</strong> {formatMoney(detail.session.difference ?? 0)}
                      </Typography>
                    </>
                  )}
              </Box>

              <Divider sx={{ mb: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Ingresos en efectivo
              </Typography>
              <Paper variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Recibo</TableCell>
                      <TableCell>Familia</TableCell>
                      <TableCell>Medio</TableCell>
                      <TableCell align="right">Importe</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.payments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography variant="body2" color="text.secondary">
                            Sin ingresos en efectivo.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {detail.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{payment.receiptNumber}</TableCell>
                        <TableCell>
                          {payment.guardian?.lastName}, {payment.guardian?.firstName}
                        </TableCell>
                        <TableCell>{methodLabel[payment.method] ?? payment.method}</TableCell>
                        <TableCell align="right">{formatMoney(payment.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>

              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Egresos en efectivo
              </Typography>
              <Paper variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Fecha</TableCell>
                      <TableCell>Descripción</TableCell>
                      <TableCell align="right">Importe</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.expenses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3}>
                          <Typography variant="body2" color="text.secondary">
                            Sin egresos en efectivo.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {detail.expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{formatDate(expense.date)}</TableCell>
                        <TableCell>{expense.description}</TableCell>
                        <TableCell align="right">{formatMoney(expense.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setDetailId(null)}>Cerrar</Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
