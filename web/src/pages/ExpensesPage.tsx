import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CancelIcon from '@mui/icons-material/Cancel';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { api } from '../api/client';
import type { Expense, Paginated, PaymentMethod } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PageHeader } from '../components/PageHeader';
import { PaginationBar } from '../components/PaginationBar';
import { StatusChip } from '../components/StatusChip';
import { formatDate, formatMoney, methodLabel, today } from '../utils/format';
import { getErrorMessage } from '../utils/errors';

const methods: PaymentMethod[] = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MERCADO_PAGO', 'CHEQUE'];

const schema = z.object({
  date: z.string().min(1, 'Elegí una fecha'),
  category: z.string().trim().min(2, 'Ingresá la categoría').max(80),
  description: z.string().trim().min(3, 'Describí el egreso').max(2000),
  amount: z.coerce.number().positive('El monto debe ser mayor a cero'),
  method: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MERCADO_PAGO', 'CHEQUE']),
  reference: z.string().trim().max(120).optional(),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
  date: today(),
  category: '',
  description: '',
  amount: 0,
  method: 'EFECTIVO',
  reference: '',
};

interface ExpensesResponse extends Paginated<Expense> {
  totalActive: number;
}

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'TESORERO';

  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [toCancel, setToCancel] = useState<Expense | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const debouncedSearch = useDebouncedValue(search);

  const { data, isLoading, error } = useQuery({
    queryKey: ['expenses', debouncedSearch, from, to, status, page, pageSize],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (from) params.from = from;
      if (to) params.to = to;
      if (status) params.status = status;
      return (await api.get<ExpensesResponse>('/expenses', { params })).data;
    },
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues });

  const openCreate = () => {
    setEditing(null);
    reset({ ...emptyValues, date: today() });
    setDialogOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    reset({
      date: expense.date.slice(0, 10),
      category: expense.category,
      description: expense.description,
      amount: Number(expense.amount),
      method: expense.method,
      reference: expense.reference ?? '',
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = { ...values, reference: values.reference || undefined };
      if (editing) return api.put(`/expenses/${editing.id}`, payload);
      return api.post('/expenses', payload);
    },
    onSuccess: () => {
      notify(editing ? 'Egreso actualizado' : 'Egreso registrado');
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['cash-current'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: async () =>
      api.post(`/expenses/${toCancel?.id}/cancel`, { reason: cancelReason }),
    onSuccess: () => {
      notify('Egreso anulado');
      setToCancel(null);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['cash-current'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  return (
    <Box>
      <PageHeader
        title="Egresos"
        subtitle="Gastos y compras registrados por la cooperadora"
        action={
          canEdit ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Nuevo egreso
            </Button>
          ) : undefined
        }
      />

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              bgcolor: '#b3261e14',
              color: '#b3261e',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <TrendingDownIcon />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Total egresos activos (según filtros)
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {formatMoney(data?.totalActive ?? 0)}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr 1fr' },
            gap: 2,
          }}
        >
          <TextField
            label="Buscar descripción o referencia"
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
            label="Estado"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="ACTIVO">Activos</MenuItem>
            <MenuItem value="ANULADO">Anulados</MenuItem>
          </TextField>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getErrorMessage(error)}
        </Alert>
      )}

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
                    <TableCell>Fecha</TableCell>
                    <TableCell>Categoría</TableCell>
                    <TableCell>Descripción</TableCell>
                    <TableCell>Medio</TableCell>
                    <TableCell align="right">Monto</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data?.data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No se encontraron egresos.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.data.map((expense) => (
                    <TableRow key={expense.id} hover>
                      <TableCell>{formatDate(expense.date)}</TableCell>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{expense.description}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {expense.reference ? `Ref. ${expense.reference} · ` : ''}
                          Registrado por {expense.createdBy?.name ?? '-'}
                        </Typography>
                        {expense.status === 'ANULADO' && expense.cancelReason && (
                          <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                            Motivo: {expense.cancelReason}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{methodLabel[expense.method] ?? expense.method}</TableCell>
                      <TableCell align="right">{formatMoney(expense.amount)}</TableCell>
                      <TableCell>
                        <StatusChip status={expense.status} />
                      </TableCell>
                      <TableCell align="right">
                        {canEdit && expense.status === 'ACTIVO' && (
                          <>
                            <Tooltip title="Editar">
                              <IconButton size="small" onClick={() => openEdit(expense)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Anular">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setToCancel(expense);
                                  setCancelReason('');
                                }}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
          <DialogTitle>{editing ? 'Editar egreso' : 'Nuevo egreso'}</DialogTitle>
          <DialogContent>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
                pt: 1,
              }}
            >
              <TextField
                label="Fecha"
                type="date"
                InputLabelProps={{ shrink: true }}
                {...register('date')}
                error={Boolean(errors.date)}
                helperText={errors.date?.message}
              />
              <TextField
                label="Categoría"
                {...register('category')}
                error={Boolean(errors.category)}
                helperText={errors.category?.message}
              />
              <TextField
                label="Descripción"
                multiline
                minRows={2}
                sx={{ gridColumn: { sm: 'span 2' } }}
                {...register('description')}
                error={Boolean(errors.description)}
                helperText={errors.description?.message}
              />
              <TextField
                label="Monto"
                type="number"
                inputProps={{ step: '0.01', min: 0 }}
                {...register('amount', { valueAsNumber: true })}
                error={Boolean(errors.amount)}
                helperText={errors.amount?.message}
              />
              <Controller
                name="method"
                control={control}
                render={({ field }) => (
                  <TextField select label="Medio" {...field}>
                    {methods.map((item) => (
                      <MenuItem key={item} value={item}>
                        {methodLabel[item]}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <TextField
                label="Referencia (opcional)"
                {...register('reference')}
                sx={{ gridColumn: { sm: 'span 2' } }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={Boolean(toCancel)} onClose={() => setToCancel(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Anular egreso</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            El egreso deja de descontarse de la caja y los reportes, pero queda registrado.
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {toCancel?.description} · {formatMoney(toCancel?.amount ?? 0)}
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
            {cancelMutation.isPending ? 'Anulando...' : 'Anular egreso'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
