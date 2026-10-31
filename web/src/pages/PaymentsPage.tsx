import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddCardIcon from '@mui/icons-material/AddCard';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CancelIcon from '@mui/icons-material/Cancel';
import { api } from '../api/client';
import type { Paginated, Payment, PaymentMethod, PaymentStatus } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PageHeader } from '../components/PageHeader';
import { PaginationBar } from '../components/PaginationBar';
import { StatusChip } from '../components/StatusChip';
import { formatDate, formatDateTime, formatMoney, methodLabel } from '../utils/format';
import { getErrorMessage } from '../utils/errors';
import { openReceipt } from '../utils/receipt';

const methods: PaymentMethod[] = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MERCADO_PAGO', 'CHEQUE'];
const paymentStatuses: PaymentStatus[] = ['ACTIVO', 'ANULADO'];

export default function PaymentsPage() {
  const navigate = useNavigate();
  const notify = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'TESORERO';

  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<Payment | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const debouncedSearch = useDebouncedValue(search);

  const { data, isLoading, error } = useQuery({
    queryKey: ['payments', debouncedSearch, from, to, method, status, page, pageSize],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (from) params.from = from;
      if (to) params.to = to;
      if (method) params.method = method;
      if (status) params.status = status;
      return (await api.get<Paginated<Payment>>('/payments', { params })).data;
    },
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['payment', detailId],
    queryFn: async () => (await api.get<Payment>(`/payments/${detailId}`)).data,
    enabled: Boolean(detailId),
  });

  const cancelMutation = useMutation({
    mutationFn: async () =>
      api.post(`/payments/${toCancel?.id}/cancel`, { reason: cancelReason }),
    onSuccess: () => {
      notify('Pago anulado correctamente');
      setToCancel(null);
      setCancelReason('');
      setDetailId(null);
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['fees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['guardian-account'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  return (
    <Box>
      <PageHeader
        title="Pagos"
        subtitle="Recibos emitidos y pagos registrados"
        action={
          canEdit ? (
            <Button
              variant="contained"
              startIcon={<AddCardIcon />}
              onClick={() => navigate('/pagos/nuevo')}
            >
              Registrar pago
            </Button>
          ) : undefined
        }
      />

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr', lg: '2fr 1fr 1fr 1fr 1fr' },
            gap: 2,
          }}
        >
          <TextField
            label="Buscar recibo, familia o DNI"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <TextField
            label="Desde"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
          <TextField
            label="Hasta"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
          <TextField
            select
            label="Medio"
            value={method}
            onChange={(event) => {
              setMethod(event.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            {methods.map((item) => (
              <MenuItem key={item} value={item}>
                {methodLabel[item]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Estado"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            {paymentStatuses.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{getErrorMessage(error)}</Alert>}

      <Paper sx={{ overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Recibo</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Familia</TableCell>
                    <TableCell>Medio</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data?.data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No se encontraron pagos.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.data.map((payment) => (
                    <TableRow key={payment.id} hover>
                      <TableCell>{payment.receiptNumber}</TableCell>
                      <TableCell>{formatDate(payment.date)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {payment.guardian?.lastName}, {payment.guardian?.firstName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {payment._count?.allocations ?? 0} cuotas imputadas
                        </Typography>
                      </TableCell>
                      <TableCell>{methodLabel[payment.method] ?? payment.method}</TableCell>
                      <TableCell align="right">{formatMoney(payment.total)}</TableCell>
                      <TableCell>
                        <StatusChip status={payment.status} />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Ver detalle">
                          <IconButton size="small" onClick={() => setDetailId(payment.id)}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Recibo PDF">
                          <IconButton
                            size="small"
                            onClick={async () => {
                              try {
                                await openReceipt(payment.id);
                              } catch (receiptError) {
                                notify(getErrorMessage(receiptError), 'error');
                              }
                            }}
                          >
                            <PictureAsPdfIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {canEdit && payment.status === 'ACTIVO' && (
                          <Tooltip title="Anular pago">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setToCancel(payment);
                                setCancelReason('');
                              }}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {data && (
              <PaginationBar
                page={page}
                pageSize={pageSize}
                total={data.pagination.total}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            )}
          </>
        )}
      </Paper>

      <Dialog open={Boolean(detailId)} onClose={() => setDetailId(null)} maxWidth="md" fullWidth>
        <DialogTitle>Detalle del pago</DialogTitle>
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
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Recibo
                  </Typography>
                  <Typography variant="body2">{detail.receiptNumber}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Fecha
                  </Typography>
                  <Typography variant="body2">{formatDate(detail.date)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Medio de pago
                  </Typography>
                  <Typography variant="body2">
                    {methodLabel[detail.method] ?? detail.method}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Familia
                  </Typography>
                  <Typography variant="body2">
                    {detail.guardian?.lastName}, {detail.guardian?.firstName}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Registrado por
                  </Typography>
                  <Typography variant="body2">{detail.createdBy?.name ?? '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Estado
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <StatusChip status={detail.status} />
                  </Box>
                </Box>
              </Box>

              {detail.status === 'ANULADO' && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Anulado por {detail.cancelledBy?.name ?? '-'} el{' '}
                  {formatDateTime(detail.cancelledAt)}. Motivo: {detail.cancelReason}
                </Alert>
              )}

              <Divider sx={{ my: 2 }} />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Alumno</TableCell>
                    <TableCell>Concepto</TableCell>
                    <TableCell>Período</TableCell>
                    <TableCell align="right">Importe</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detail.allocations?.map((allocation) => (
                    <TableRow key={allocation.id}>
                      <TableCell>
                        {allocation.fee?.student?.lastName}, {allocation.fee?.student?.firstName}
                      </TableCell>
                      <TableCell>{allocation.fee?.concept?.name}</TableCell>
                      <TableCell>{allocation.fee?.period}</TableCell>
                      <TableCell align="right">{formatMoney(allocation.amount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3}>
                      <strong>Total</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{formatMoney(detail.total)}</strong>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              {detail.notes && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Notas: {detail.notes}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDetailId(null)}>Cerrar</Button>
          {detail && (
            <Button
              startIcon={<PictureAsPdfIcon />}
              onClick={async () => {
                try {
                  await openReceipt(detail.id);
                } catch (receiptError) {
                  notify(getErrorMessage(receiptError), 'error');
                }
              }}
            >
              Ver recibo
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(toCancel)} onClose={() => setToCancel(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Anular pago</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            El pago queda registrado como anulado y las cuotas vuelven a su saldo anterior.
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Recibo {toCancel?.receiptNumber} · {formatMoney(toCancel?.total ?? 0)}
          </Typography>
          <TextField
            label="Motivo de la anulación"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            multiline
            minRows={2}
            fullWidth
            required
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setToCancel(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            disabled={cancelReason.trim().length < 3 || cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
          >
            {cancelMutation.isPending ? 'Anulando...' : 'Anular pago'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
