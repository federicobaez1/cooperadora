import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
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
import VisibilityIcon from '@mui/icons-material/Visibility';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import { api } from '../api/client';
import type { Guardian, Paginated } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PageHeader } from '../components/PageHeader';
import { PaginationBar } from '../components/PaginationBar';
import { StatusChip } from '../components/StatusChip';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatMoney } from '../utils/format';
import { getErrorMessage } from '../utils/errors';

const schema = z.object({
  firstName: z.string().trim().min(2, 'Ingresá el nombre'),
  lastName: z.string().trim().min(2, 'Ingresá el apellido'),
  dni: z.string().trim().min(5, 'Ingresá el DNI'),
  email: z.string().trim().email('Email inválido').or(z.literal('')).optional(),
  phone: z.string().trim().max(40, 'Máximo 40 caracteres').optional(),
  address: z.string().trim().max(255, 'Máximo 255 caracteres').optional(),
  notes: z.string().trim().max(2000, 'Máximo 2000 caracteres').optional(),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
  firstName: '',
  lastName: '',
  dni: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
};

export default function GuardiansPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useToast();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'TESORERO';

  const [search, setSearch] = useState('');
  const [active, setActive] = useState('true');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Guardian | null>(null);
  const [toDeactivate, setToDeactivate] = useState<Guardian | null>(null);

  const debouncedSearch = useDebouncedValue(search);

  const { data, isLoading, error } = useQuery({
    queryKey: ['guardians', debouncedSearch, active, page, pageSize],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (active !== 'all') params.active = active;
      return (await api.get<Paginated<Guardian>>('/guardians', { params })).data;
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues });

  const openCreate = () => {
    setEditing(null);
    reset(emptyValues);
    setDialogOpen(true);
  };

  const openEdit = (guardian: Guardian) => {
    setEditing(guardian);
    reset({
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      dni: guardian.dni,
      email: guardian.email ?? '',
      phone: guardian.phone ?? '',
      address: guardian.address ?? '',
      notes: guardian.notes ?? '',
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = { ...values, email: values.email || undefined };
      if (editing) return api.put(`/guardians/${editing.id}`, payload);
      return api.post('/guardians', payload);
    },
    onSuccess: () => {
      notify(editing ? 'Familia actualizada' : 'Familia creada');
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['guardians'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (guardian: Guardian) => api.delete(`/guardians/${guardian.id}`),
    onSuccess: () => {
      notify('Familia desactivada');
      setToDeactivate(null);
      queryClient.invalidateQueries({ queryKey: ['guardians'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  return (
    <Box>
      <PageHeader
        title="Familias"
        subtitle="Socios de la cooperadora y alumnos a su cargo"
        action={
          canEdit ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Nueva familia
            </Button>
          ) : undefined
        }
      />

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' },
            gap: 2,
          }}
        >
          <TextField
            label="Buscar por nombre, DNI o email"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            fullWidth
          />
          <TextField
            select
            label="Estado"
            value={active}
            onChange={(event) => {
              setActive(event.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="true">Activas</MenuItem>
            <MenuItem value="false">Inactivas</MenuItem>
            <MenuItem value="all">Todas</MenuItem>
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
                    <TableCell>Familia</TableCell>
                    <TableCell>DNI</TableCell>
                    <TableCell>Contacto</TableCell>
                    <TableCell>Alumnos</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data?.data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No se encontraron familias.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.data.map((guardian) => (
                    <TableRow key={guardian.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {guardian.lastName}, {guardian.firstName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {guardian._count?.payments ?? 0} pagos registrados
                        </Typography>
                      </TableCell>
                      <TableCell>{guardian.dni}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{guardian.phone || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {guardian.email || 'Sin email'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {guardian.students && guardian.students.length > 0 ? (
                          guardian.students.map((link) => (
                            <Typography key={link.studentId} variant="body2">
                              {link.student?.lastName}, {link.student?.firstName} ·{' '}
                              {link.student?.course} {link.student?.division}
                            </Typography>
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Sin alumnos
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={guardian.active ? 'ACTIVO' : 'INACTIVO'} />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Ver estado de cuenta">
                          <IconButton size="small" onClick={() => navigate(`/familias/${guardian.id}`)}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {canEdit && (
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => openEdit(guardian)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canEdit && guardian.active && (
                          <Tooltip title="Desactivar">
                            <IconButton size="small" color="error" onClick={() => setToDeactivate(guardian)}>
                              <PersonOffIcon fontSize="small" />
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
          <DialogTitle>{editing ? 'Editar familia' : 'Nueva familia'}</DialogTitle>
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
                {...register('firstName')}
                error={Boolean(errors.firstName)}
                helperText={errors.firstName?.message}
              />
              <TextField
                label="Apellido"
                {...register('lastName')}
                error={Boolean(errors.lastName)}
                helperText={errors.lastName?.message}
              />
              <TextField
                label="DNI"
                {...register('dni')}
                error={Boolean(errors.dni)}
                helperText={errors.dni?.message}
              />
              <TextField
                label="Teléfono"
                {...register('phone')}
                error={Boolean(errors.phone)}
                helperText={errors.phone?.message}
              />
              <TextField
                label="Email"
                type="email"
                {...register('email')}
                error={Boolean(errors.email)}
                helperText={errors.email?.message}
              />
              <TextField
                label="Dirección"
                {...register('address')}
                error={Boolean(errors.address)}
                helperText={errors.address?.message}
              />
              <TextField
                label="Notas"
                multiline
                minRows={2}
                sx={{ gridColumn: { sm: 'span 2' } }}
                {...register('notes')}
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
        open={Boolean(toDeactivate)}
        title="Desactivar familia"
        description={`¿Confirmás desactivar a ${toDeactivate?.lastName}, ${toDeactivate?.firstName}? No se borrarán sus pagos ni cuotas.`}
        confirmLabel="Desactivar"
        loading={deactivateMutation.isPending}
        onClose={() => setToDeactivate(null)}
        onConfirm={() => toDeactivate && deactivateMutation.mutate(toDeactivate)}
      />
    </Box>
  );
}
