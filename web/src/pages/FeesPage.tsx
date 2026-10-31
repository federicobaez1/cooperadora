import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
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
import PercentIcon from '@mui/icons-material/Percent';
import BlockIcon from '@mui/icons-material/Block';
import { api } from '../api/client';
import type { Concept, Fee, FeeStatus, Paginated } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PageHeader } from '../components/PageHeader';
import { PaginationBar } from '../components/PaginationBar';
import { StatusChip } from '../components/StatusChip';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { currentPeriod, formatDate, formatMoney, formatPeriod } from '../utils/format';
import { getErrorMessage } from '../utils/errors';

const statuses: FeeStatus[] = ['PENDIENTE', 'PARCIAL', 'PAGA', 'ANULADA'];

const generateSchema = z.object({
  conceptId: z.string().min(1, 'Elegí un concepto'),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Elegí un período'),
  dueDay: z.coerce.number().int().min(1, 'Mínimo 1').max(28, 'Máximo 28'),
  amount: z.string().optional(),
});

type GenerateValues = z.infer<typeof generateSchema>;

export default function FeesPage() {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'TESORERO';

  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [surchargeOpen, setSurchargeOpen] = useState(false);
  const [surchargePercent, setSurchargePercent] = useState('10');
  const [toCancel, setToCancel] = useState<Fee | null>(null);

  const debouncedSearch = useDebouncedValue(search);

  const { data, isLoading, error } = useQuery({
    queryKey: ['fees', debouncedSearch, period, status, page, pageSize],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (period) params.period = period;
      if (status) params.status = status;
      return (await api.get<Paginated<Fee>>('/fees', { params })).data;
    },
  });

  const { data: concepts } = useQuery({
    queryKey: ['concepts-active'],
    queryFn: async () =>
      (
        await api.get<{ data: Concept[] }>('/concepts', { params: { active: 'true' } })
      ).data.data,
    enabled: generateOpen,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GenerateValues>({
    resolver: zodResolver(generateSchema),
    defaultValues: { conceptId: '', period: currentPeriod(), dueDay: 10, amount: '' },
  });

  const generateMutation = useMutation({
    mutationFn: async (values: GenerateValues) => {
      const amount = values.amount ? Number(values.amount) : undefined;
      if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
        throw new Error('El monto debe ser mayor a cero');
      }
      return api.post<{ created: number; skipped: number }>('/fees/generate', {
        conceptId: values.conceptId,
        period: values.period,
        dueDay: values.dueDay,
        amount,
      });
    },
    onSuccess: (response) => {
      notify(
        `Cuotas generadas: ${response.data.created}. Omitidas por duplicado: ${response.data.skipped}.`,
      );
      setGenerateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['fees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  const surchargeMutation = useMutation({
    mutationFn: async () =>
      api.post<{ updated: number }>('/fees/apply-surcharges', {
        percent: Number(surchargePercent),
      }),
    onSuccess: (response) => {
      notify(`Recargos aplicados a ${response.data.updated} cuotas`);
      setSurchargeOpen(false);
      queryClient.invalidateQueries({ queryKey: ['fees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: async (fee: Fee) => api.post(`/fees/${fee.id}/cancel`),
    onSuccess: () => {
      notify('Cuota anulada');
      setToCancel(null);
      queryClient.invalidateQueries({ queryKey: ['fees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  const feeTotal = (fee: Fee) => fee.amount - fee.discount + fee.surcharge;
  const feeBalance = (fee: Fee) => feeTotal(fee) - fee.paidAmount;

  return (
    <Box>
      <PageHeader
        title="Cuotas"
        subtitle="Cuotas emitidas por alumno, concepto y período"
        action={
          canEdit ? (
            <>
              <Button variant="outlined" startIcon={<PercentIcon />} onClick={() => setSurchargeOpen(true)}>
                Aplicar recargos
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  reset({ conceptId: '', period: currentPeriod(), dueDay: 10, amount: '' });
                  setGenerateOpen(true);
                }}
              >
                Generar cuotas
              </Button>
            </>
          ) : undefined
        }
      />

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr' },
            gap: 2,
          }}
        >
          <TextField
            label="Buscar alumno o DNI"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <TextField
            label="Período"
            type="month"
            InputLabelProps={{ shrink: true }}
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value);
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
            {statuses.map((item) => (
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
                    <TableCell>Alumno</TableCell>
                    <TableCell>Concepto</TableCell>
                    <TableCell>Período</TableCell>
                    <TableCell>Vencimiento</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Pagado</TableCell>
                    <TableCell align="right">Saldo</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data?.data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No se encontraron cuotas.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.data.map((fee) => (
                    <TableRow key={fee.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {fee.student?.lastName}, {fee.student?.firstName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {fee.student?.course} {fee.student?.division}
                        </Typography>
                      </TableCell>
                      <TableCell>{fee.concept?.name}</TableCell>
                      <TableCell>{formatPeriod(fee.period)}</TableCell>
                      <TableCell>{formatDate(fee.dueDate)}</TableCell>
                      <TableCell align="right">{formatMoney(feeTotal(fee))}</TableCell>
                      <TableCell align="right">{formatMoney(fee.paidAmount)}</TableCell>
                      <TableCell align="right">{formatMoney(feeBalance(fee))}</TableCell>
                      <TableCell>
                        <StatusChip status={fee.status} />
                      </TableCell>
                      <TableCell align="right">
                        {canEdit && fee.status !== 'ANULADA' && fee.paidAmount === 0 && (
                          <Tooltip title="Anular cuota">
                            <IconButton size="small" color="error" onClick={() => setToCancel(fee)}>
                              <BlockIcon fontSize="small" />
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

      <Dialog open={generateOpen} onClose={() => setGenerateOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit((values) => generateMutation.mutate(values))}>
          <DialogTitle>Generar cuotas del período</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Se generará una cuota por cada alumno activo. Las cuotas ya existentes del mismo
              concepto y período se omiten automáticamente.
            </DialogContentText>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}
            >
              <Controller
                name="conceptId"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    label="Concepto"
                    {...field}
                    error={Boolean(errors.conceptId)}
                    helperText={errors.conceptId?.message}
                    sx={{ gridColumn: { sm: 'span 2' } }}
                  >
                    {concepts?.map((concept) => (
                      <MenuItem key={concept.id} value={concept.id}>
                        {concept.name} · {formatMoney(concept.defaultAmount)}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <TextField
                label="Período"
                type="month"
                InputLabelProps={{ shrink: true }}
                {...register('period')}
                error={Boolean(errors.period)}
                helperText={errors.period?.message}
              />
              <TextField
                label="Día de vencimiento"
                type="number"
                inputProps={{ min: 1, max: 28 }}
                {...register('dueDay', { valueAsNumber: true })}
                error={Boolean(errors.dueDay)}
                helperText={errors.dueDay?.message}
              />
              <TextField
                label="Monto (opcional)"
                type="number"
                inputProps={{ step: '0.01', min: 0 }}
                {...register('amount')}
                helperText="Vacío usa el monto base del concepto"
                sx={{ gridColumn: { sm: 'span 2' } }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setGenerateOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? 'Generando...' : 'Generar'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={surchargeOpen} onClose={() => setSurchargeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Aplicar recargos por mora</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Se aplicará el recargo a las cuotas vencidas que todavía no lo tengan.
          </DialogContentText>
          <TextField
            label="Porcentaje"
            type="number"
            value={surchargePercent}
            onChange={(event) => setSurchargePercent(event.target.value)}
            inputProps={{ min: 0, max: 100, step: '0.1' }}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSurchargeOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={surchargeMutation.isPending || Number(surchargePercent) <= 0}
            onClick={() => surchargeMutation.mutate()}
          >
            {surchargeMutation.isPending ? 'Aplicando...' : 'Aplicar'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toCancel)}
        title="Anular cuota"
        description={`¿Confirmás anular la cuota de ${toCancel?.concept?.name} de ${toCancel?.student?.lastName}, ${toCancel?.student?.firstName}?`}
        confirmLabel="Anular"
        loading={cancelMutation.isPending}
        onClose={() => setToCancel(null)}
        onConfirm={() => toCancel && cancelMutation.mutate(toCancel)}
      />
    </Box>
  );
}
