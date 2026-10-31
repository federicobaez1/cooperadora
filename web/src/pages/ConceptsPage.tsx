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
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Switch,
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
import BlockIcon from '@mui/icons-material/Block';
import { api } from '../api/client';
import type { Concept, ConceptType } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { StatusChip } from '../components/StatusChip';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { conceptTypeLabel, formatMoney } from '../utils/format';
import { getErrorMessage } from '../utils/errors';

const types: ConceptType[] = ['CUOTA_SOCIAL', 'MATRICULA', 'ACTIVIDAD', 'VIAJE', 'OTRO'];

const schema = z.object({
  name: z.string().trim().min(2, 'Ingresá el nombre'),
  type: z.enum(['CUOTA_SOCIAL', 'MATRICULA', 'ACTIVIDAD', 'VIAJE', 'OTRO']),
  defaultAmount: z.coerce.number().positive('El monto debe ser mayor a cero'),
  recurring: z.boolean(),
  description: z.string().trim().max(2000).optional(),
  active: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
  name: '',
  type: 'CUOTA_SOCIAL',
  defaultAmount: 0,
  recurring: true,
  description: '',
  active: true,
};

export default function ConceptsPage() {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'TESORERO';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Concept | null>(null);
  const [toDisable, setToDisable] = useState<Concept | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['concepts'],
    queryFn: async () => (await api.get<{ data: Concept[] }>('/concepts')).data.data,
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
    reset(emptyValues);
    setDialogOpen(true);
  };

  const openEdit = (concept: Concept) => {
    setEditing(concept);
    reset({
      name: concept.name,
      type: concept.type,
      defaultAmount: Number(concept.defaultAmount),
      recurring: concept.recurring,
      description: concept.description ?? '',
      active: concept.active,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = { ...values, description: values.description || undefined };
      if (editing) return api.put(`/concepts/${editing.id}`, payload);
      return api.post('/concepts', payload);
    },
    onSuccess: () => {
      notify(editing ? 'Concepto actualizado' : 'Concepto creado');
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['concepts'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  const disableMutation = useMutation({
    mutationFn: async (concept: Concept) => api.delete(`/concepts/${concept.id}`),
    onSuccess: () => {
      notify('Concepto desactivado');
      setToDisable(null);
      queryClient.invalidateQueries({ queryKey: ['concepts'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  return (
    <Box>
      <PageHeader
        title="Conceptos"
        subtitle="Cuotas, matrículas y actividades que cobra la cooperadora"
        action={
          canEdit ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Nuevo concepto
            </Button>
          ) : undefined
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{getErrorMessage(error)}</Alert>}

      <Paper sx={{ overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Concepto</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell align="right">Monto base</TableCell>
                  <TableCell>Recurrente</TableCell>
                  <TableCell align="right">Cuotas generadas</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No hay conceptos creados.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {data?.map((concept) => (
                  <TableRow key={concept.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {concept.name}
                      </Typography>
                      {concept.description && (
                        <Typography variant="caption" color="text.secondary">
                          {concept.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{conceptTypeLabel[concept.type] ?? concept.type}</TableCell>
                    <TableCell align="right">{formatMoney(concept.defaultAmount)}</TableCell>
                    <TableCell>{concept.recurring ? 'Sí' : 'No'}</TableCell>
                    <TableCell align="right">{concept._count?.fees ?? 0}</TableCell>
                    <TableCell>
                      <StatusChip status={concept.active ? 'ACTIVO' : 'INACTIVO'} />
                    </TableCell>
                    <TableCell align="right">
                      {canEdit && (
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => openEdit(concept)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canEdit && concept.active && user?.role === 'ADMIN' && (
                        <Tooltip title="Desactivar">
                          <IconButton size="small" color="error" onClick={() => setToDisable(concept)}>
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
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
          <DialogTitle>{editing ? 'Editar concepto' : 'Nuevo concepto'}</DialogTitle>
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
                label="Nombre"
                {...register('name')}
                error={Boolean(errors.name)}
                helperText={errors.name?.message}
                sx={{ gridColumn: { sm: 'span 2' } }}
              />
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <TextField select label="Tipo" {...field}>
                    {types.map((item) => (
                      <MenuItem key={item} value={item}>
                        {conceptTypeLabel[item]}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <TextField
                label="Monto base"
                type="number"
                inputProps={{ step: '0.01', min: 0 }}
                {...register('defaultAmount', { valueAsNumber: true })}
                error={Boolean(errors.defaultAmount)}
                helperText={errors.defaultAmount?.message}
              />
              <Controller
                name="recurring"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />
                    }
                    label="Cuota recurrente (mensual)"
                  />
                )}
              />
              <Controller
                name="active"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />
                    }
                    label="Activo"
                  />
                )}
              />
              <TextField
                label="Descripción"
                multiline
                minRows={2}
                sx={{ gridColumn: { sm: 'span 2' } }}
                {...register('description')}
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

      <ConfirmDialog
        open={Boolean(toDisable)}
        title="Desactivar concepto"
        description={`¿Confirmás desactivar "${toDisable?.name}"? No se podrán generar nuevas cuotas con este concepto.`}
        confirmLabel="Desactivar"
        loading={disableMutation.isPending}
        onClose={() => setToDisable(null)}
        onConfirm={() => toDisable && disableMutation.mutate(toDisable)}
      />
    </Box>
  );
}
