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
import PersonOffIcon from '@mui/icons-material/PersonOff';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import { api } from '../api/client';
import type { Paginated, Role, User } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PageHeader } from '../components/PageHeader';
import { PaginationBar } from '../components/PaginationBar';
import { StatusChip } from '../components/StatusChip';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDateTime, roleLabel } from '../utils/format';
import { getErrorMessage } from '../utils/errors';

const roles: Role[] = ['ADMIN', 'TESORERO', 'CONSULTA'];

const createSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá el nombre').max(120),
  email: z.string().trim().email('Email inválido').max(180),
  password: z.string().min(8, 'Mínimo 8 caracteres').max(100),
  role: z.enum(['ADMIN', 'TESORERO', 'CONSULTA']),
  active: z.boolean(),
});

const editSchema = createSchema.extend({
  password: z.string().max(100).optional(),
});

type FormValues = z.infer<typeof editSchema>;

const emptyValues: FormValues = {
  name: '',
  email: '',
  password: '',
  role: 'CONSULTA',
  active: true,
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { user: currentUser } = useAuth();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [toDeactivate, setToDeactivate] = useState<User | null>(null);

  const debouncedSearch = useDebouncedValue(search);

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', debouncedSearch, role, active, page, pageSize],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (role) params.role = role;
      if (active) params.active = active;
      return (await api.get<Paginated<User>>('/users', { params })).data;
    },
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(editing ? editSchema : createSchema),
    defaultValues: emptyValues,
  });

  const openCreate = () => {
    setEditing(null);
    reset(emptyValues);
    setDialogOpen(true);
  };

  const openEdit = (item: User) => {
    setEditing(item);
    reset({
      name: item.name,
      email: item.email,
      password: '',
      role: item.role,
      active: item.active,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: values.name,
        email: values.email,
        role: values.role,
        active: values.active,
        password: values.password || undefined,
      };
      if (editing) return api.put(`/users/${editing.id}`, payload);
      return api.post('/users', payload);
    },
    onSuccess: () => {
      notify(editing ? 'Usuario actualizado' : 'Usuario creado');
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (item: User) => api.delete(`/users/${item.id}`),
    onSuccess: () => {
      notify('Usuario desactivado');
      setToDeactivate(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  return (
    <Box>
      <PageHeader
        title="Usuarios"
        subtitle="Cuentas con acceso al sistema y sus roles"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Nuevo usuario
          </Button>
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
            label="Buscar por nombre o email"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <TextField
            select
            label="Rol"
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            {roles.map((item) => (
              <MenuItem key={item} value={item}>
                {roleLabel[item]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Estado"
            value={active}
            onChange={(event) => {
              setActive(event.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="true">Activos</MenuItem>
            <MenuItem value="false">Inactivos</MenuItem>
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
                    <TableCell>Nombre</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Rol</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Alta</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data?.data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No se encontraron usuarios.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.data.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.name}
                          {item.id === currentUser?.id && ' (vos)'}
                        </Typography>
                      </TableCell>
                      <TableCell>{item.email}</TableCell>
                      <TableCell>
                        <StatusChip status={item.role} />
                      </TableCell>
                      <TableCell>
                        <StatusChip status={item.active ? 'ACTIVO' : 'INACTIVO'} />
                      </TableCell>
                      <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => openEdit(item)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {item.active && item.id !== currentUser?.id && (
                          <Tooltip title="Desactivar">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setToDeactivate(item)}
                            >
                              <PersonOffIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {!item.active && (
                          <Tooltip title="Reactivar">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => {
                                setEditing(item);
                                reset({
                                  name: item.name,
                                  email: item.email,
                                  password: '',
                                  role: item.role,
                                  active: true,
                                });
                                setDialogOpen(true);
                              }}
                            >
                              <PersonAddAltIcon fontSize="small" />
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
          <DialogTitle>{editing ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
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
              />
              <TextField
                label="Email"
                type="email"
                {...register('email')}
                error={Boolean(errors.email)}
                helperText={errors.email?.message}
              />
              <TextField
                label={editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                type="password"
                {...register('password')}
                error={Boolean(errors.password)}
                helperText={
                  errors.password?.message ??
                  (editing ? 'Dejá vacío para mantener la actual' : 'Mínimo 8 caracteres')
                }
              />
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <TextField select label="Rol" {...field}>
                    {roles.map((item) => (
                      <MenuItem key={item} value={item}>
                        {roleLabel[item]}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <Controller
                name="active"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                      />
                    }
                    label="Usuario activo"
                    sx={{ gridColumn: { sm: 'span 2' } }}
                  />
                )}
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
        title="Desactivar usuario"
        description={`¿Confirmás desactivar a ${toDeactivate?.name}? No podrá iniciar sesión pero sus registros se conservan.`}
        confirmLabel="Desactivar"
        loading={deactivateMutation.isPending}
        onClose={() => setToDeactivate(null)}
        onConfirm={() => toDeactivate && deactivateMutation.mutate(toDeactivate)}
      />
    </Box>
  );
}
