import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { api } from '../api/client';
import type {
  Fee,
  Guardian,
  Paginated,
  Payment,
  PaymentMethod,
} from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PageHeader } from '../components/PageHeader';
import { StatusChip } from '../components/StatusChip';
import {
  formatDate,
  formatMoney,
  formatPeriod,
  methodLabel,
  today,
} from '../utils/format';
import { getErrorMessage } from '../utils/errors';
import { openReceipt } from '../utils/receipt';

const methods: PaymentMethod[] = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MERCADO_PAGO', 'CHEQUE'];

export default function NewPaymentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [search, setSearch] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<PaymentMethod>('EFECTIVO');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [created, setCreated] = useState<Payment | null>(null);

  const paramGuardianId = searchParams.get('guardianId');
  const debouncedSearch = useDebouncedValue(search);

  const { data: preloadedGuardian } = useQuery({
    queryKey: ['guardian', paramGuardianId],
    queryFn: async () => (await api.get<Guardian>(`/guardians/${paramGuardianId}`)).data,
    enabled: Boolean(paramGuardianId) && !guardian,
  });

  const activeGuardian = guardian ?? preloadedGuardian ?? null;

  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ['guardian-search', debouncedSearch],
    queryFn: async () =>
      (
        await api.get<Paginated<Guardian>>('/guardians', {
          params: { search: debouncedSearch, active: 'true', pageSize: 15 },
        })
      ).data.data,
    enabled: !activeGuardian && debouncedSearch.trim().length >= 2,
  });

  const { data: feesData, isLoading: feesLoading } = useQuery({
    queryKey: ['guardian-fees', activeGuardian?.id],
    queryFn: async () =>
      (
        await api.get<Paginated<Fee>>('/fees', {
          params: { guardianId: activeGuardian?.id, pageSize: 100 },
        })
      ).data,
    enabled: Boolean(activeGuardian),
  });

  const payableFees = useMemo(
    () =>
      (feesData?.data ?? []).filter(
        (fee) => fee.status === 'PENDIENTE' || fee.status === 'PARCIAL',
      ),
    [feesData],
  );

  const feeTotal = (fee: Fee) => fee.amount - fee.discount + fee.surcharge;
  const feeBalance = (fee: Fee) => feeTotal(fee) - fee.paidAmount;

  const selected = payableFees
    .filter((fee) => amounts[fee.id] !== undefined)
    .map((fee) => ({ fee, amount: Number(amounts[fee.id]) }));

  const selectedTotal = selected.reduce(
    (acc, item) => acc + (Number.isFinite(item.amount) ? item.amount : 0),
    0,
  );

  const hasInvalidAmount = selected.some(
    (item) =>
      !Number.isFinite(item.amount) ||
      item.amount <= 0 ||
      item.amount > Math.round(feeBalance(item.fee) * 100) / 100 + 0.001,
  );

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!activeGuardian) throw new Error('Elegí una familia');
      if (selected.length === 0) throw new Error('Seleccioná al menos una cuota');
      return api.post<Payment>('/payments', {
        guardianId: activeGuardian.id,
        method,
        date: date || undefined,
        notes: notes || undefined,
        items: selected.map((item) => ({ feeId: item.fee.id, amount: item.amount })),
      });
    },
    onSuccess: (response) => {
      setCreated(response.data);
      setAmounts({});
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['guardian-fees'] });
      queryClient.invalidateQueries({ queryKey: ['guardian-account'] });
      queryClient.invalidateQueries({ queryKey: ['fees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  if (user?.role === 'CONSULTA') {
    return <Navigate to="/pagos" replace />;
  }

  const toggleFee = (fee: Fee) => {
    setAmounts((prev) => {
      const next = { ...prev };
      if (next[fee.id] !== undefined) {
        delete next[fee.id];
      } else {
        next[fee.id] = (Math.round(feeBalance(fee) * 100) / 100).toFixed(2);
      }
      return next;
    });
  };

  const selectGuardian = (value: Guardian) => {
    setGuardian(value);
    setAmounts({});
    setSearch('');
  };

  return (
    <Box>
      <PageHeader
        title="Registrar pago"
        subtitle="Seleccioná la familia, las cuotas y el medio de pago"
        action={
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/pagos')}>
            Volver a pagos
          </Button>
        }
      />

      {!activeGuardian ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Buscar familia
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Ingresá apellido, DNI o email del socio responsable del pago.
            </Typography>
            <TextField
              label="Buscar familia"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              fullWidth
              autoFocus
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
            />

            {searching && (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            )}

            {!searching && debouncedSearch.length >= 2 && searchResults?.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No se encontraron familias con ese criterio.
              </Alert>
            )}

            {searchResults && searchResults.length > 0 && (
              <Paper variant="outlined" sx={{ mt: 2, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Familia</TableCell>
                      <TableCell>DNI</TableCell>
                      <TableCell>Alumnos</TableCell>
                      <TableCell align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {searchResults.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          {item.lastName}, {item.firstName}
                        </TableCell>
                        <TableCell>{item.dni}</TableCell>
                        <TableCell>
                          {item.students?.map((link) => link.student?.firstName).join(', ') || '-'}
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" variant="contained" onClick={() => selectGuardian(item)}>
                            Seleccionar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Card>
            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="h6">
                  {activeGuardian.lastName}, {activeGuardian.firstName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  DNI {activeGuardian.dni} · {activeGuardian.phone || 'Sin teléfono'} ·{' '}
                  {activeGuardian.email || 'Sin email'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Alumnos:{' '}
                  {activeGuardian.students
                    ?.map((link) => `${link.student?.firstName} ${link.student?.lastName}`)
                    .join(', ') || '-'}
                </Typography>
              </Box>
              <Button
                onClick={() => {
                  setGuardian(null);
                  setSearchParams({});
                }}
              >
                Cambiar familia
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Cuotas pendientes
              </Typography>
              {feesLoading ? (
                <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : payableFees.length === 0 ? (
                <Alert severity="success">Esta familia no tiene cuotas pendientes de pago.</Alert>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell>Alumno</TableCell>
                        <TableCell>Concepto</TableCell>
                        <TableCell>Período</TableCell>
                        <TableCell>Vencimiento</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell align="right">Saldo</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell align="right">Importe a pagar</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {payableFees.map((fee) => {
                        const isSelected = amounts[fee.id] !== undefined;
                        return (
                          <TableRow key={fee.id} hover selected={isSelected}>
                            <TableCell padding="checkbox">
                              <Checkbox checked={isSelected} onChange={() => toggleFee(fee)} />
                            </TableCell>
                            <TableCell>
                              {fee.student?.lastName}, {fee.student?.firstName}
                            </TableCell>
                            <TableCell>{fee.concept?.name}</TableCell>
                            <TableCell>{formatPeriod(fee.period)}</TableCell>
                            <TableCell>{formatDate(fee.dueDate)}</TableCell>
                            <TableCell align="right">{formatMoney(feeTotal(fee))}</TableCell>
                            <TableCell align="right">{formatMoney(feeBalance(fee))}</TableCell>
                            <TableCell>
                              <StatusChip status={fee.status} />
                            </TableCell>
                            <TableCell align="right">
                              <TextField
                                type="number"
                                value={amounts[fee.id] ?? ''}
                                onChange={(event) =>
                                  setAmounts((prev) => ({ ...prev, [fee.id]: event.target.value }))
                                }
                                disabled={!isSelected}
                                inputProps={{ min: 0, step: '0.01' }}
                                sx={{ width: 130 }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                Podés modificar el importe para registrar un pago parcial. El saldo de la cuota se
                actualiza automáticamente.
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Datos del pago
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                }}
              >
                <TextField
                  select
                  label="Medio de pago"
                  value={method}
                  onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                >
                  {methods.map((item) => (
                    <MenuItem key={item} value={item}>
                      {methodLabel[item]}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Fecha"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
                <TextField
                  label="Notas"
                  multiline
                  minRows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  sx={{ gridColumn: { sm: 'span 2' } }}
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between',
                  alignItems: { xs: 'stretch', sm: 'center' },
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {selected.length} cuota(s) seleccionada(s)
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {formatMoney(selectedTotal)}
                  </Typography>
                  {hasInvalidAmount && (
                    <Typography variant="caption" color="error">
                      Revisá los importes: deben ser mayores a cero y no superar el saldo.
                    </Typography>
                  )}
                </Box>
                <Button
                  variant="contained"
                  size="large"
                  disabled={
                    selected.length === 0 ||
                    hasInvalidAmount ||
                    paymentMutation.isPending
                  }
                  onClick={() => paymentMutation.mutate()}
                >
                  {paymentMutation.isPending ? 'Registrando...' : 'Confirmar pago'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      <Dialog open={Boolean(created)} onClose={() => setCreated(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon color="success" /> Pago registrado
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Recibo emitido
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            {created?.receiptNumber}
          </Typography>
          <Typography variant="body2">
            Total: <strong>{formatMoney(created?.total ?? 0)}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Las cuotas quedaron actualizadas con el pago registrado.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap' }}>
          <Button onClick={() => setCreated(null)}>Cerrar</Button>
          <Button
            startIcon={<PictureAsPdfIcon />}
            onClick={async () => {
              if (!created) return;
              try {
                await openReceipt(created.id);
              } catch (receiptError) {
                notify(getErrorMessage(receiptError), 'error');
              }
            }}
          >
            Ver recibo
          </Button>
          <Button variant="contained" onClick={() => navigate('/pagos')}>
            Ir a pagos
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
