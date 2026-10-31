import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import type { Paginated, Student, StudentStatus } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PageHeader } from '../components/PageHeader';
import { PaginationBar } from '../components/PaginationBar';
import { StatusChip } from '../components/StatusChip';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDate } from '../utils/format';
import { getErrorMessage } from '../utils/errors';

const statuses: StudentStatus[] = ['ACTIVO', 'INACTIVO', 'EGRESADO'];

const schema = z.object({
  firstName: z.string().trim().min(2, 'Ingresá el nombre'),
  lastName: z.string().trim().min(2, 'Ingresá el apellido'),
  dni: z.string().trim().min(5, 'Ingresá el DNI'),
  birthDate: z.string().optional(),
  course: z.string().trim().min(1, 'Ingresá el curso'),
  division: z.string().trim().min(1, 'Ingresá la división'),
  shift: z.string().trim().min(1, 'Ingresá el turno'),
  status: z.enum(['ACTIVO', 'INACTIVO', 'EGRESADO']),
  notes: z.string().trim().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
  firstName: '',
  lastName: '',
  dni: '',
  birthDate: '',
  course: '',
  division: '',
  shift: 'Mañana',
  status: 'ACTIVO',
  notes: '',
};

export default function StudentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useToast();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'TESORERO';

  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [toDeactivate, setToDeactivate] = useState<Student | null>(null);

  const debouncedSearch = useDebouncedValue(search);

  const { data, isLoading, error } = useQuery({
    queryKey: ['students', debouncedSearch, course, status, page, pageSize],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (course) params.course = course;
      if (status) params.status = status;
      return (await api.get<Paginated<Student>>('/students', { params })).data;
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
    reset(emptyValues);
    setDialogOpen(true);
  };

  const openEdit = (student: Student) => {
    setEditing(student);
    reset({
      firstName: student.firstName,
      lastName: student.lastName,
      dni: student.dni,
      birthDate: student.birthDate ? student.birthDate.slice(0, 10) : '',
      course: student.course,
      division: student.division,
      shift: student.shift,
      status: student.status,
      notes: student.notes ?? '',
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        birthDate: values.birthDate || undefined,
      };
      if (editing) return api.put(`/students/${editing.id}`, payload);
      return api.post('/students', payload);
    },
    onSuccess: () => {
      notify(editing ? 'Alumno actualizado' : 'Alumno creado');
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (student: Student) => api.delete(`/students/${student.id}`),
    onSuccess: () => {
      notify('Alumno marcado como inactivo');
      setToDeactivate(null);
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  return (
    <Box>
      <PageHeader
        title="Alumnos"
        subtitle="Alumnos asociados a las familias de la cooperadora"
        action={
          canEdit ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Nuevo alumno
            </Button>
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
            label="Buscar por nombre, apellido o DNI"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <TextField
            label="Curso"
            value={course}
            onChange={(event) => {
              setCourse(event.target.value);
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
                    <TableCell>DNI</TableCell>
                    <TableCell>Curso</TableCell>
                    <TableCell>Turno</TableCell>
                    <TableCell>Familias</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data?.data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No se encontraron alumnos.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.data.map((student) => (
                    <TableRow key={student.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {student.lastName}, {student.firstName}
                        </Typography>
                        {student.birthDate && (
                          <Typography variant="caption" color="text.secondary">
                            Nac. {formatDate(student.birthDate)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{student.dni}</TableCell>
                      <TableCell>
                        {student.course} {student.division}
                      </TableCell>
                      <TableCell>{student.shift}</TableCell>
                      <TableCell>
                        {student.guardians && student.guardians.length > 0
                          ? student.guardians
                              .map(
                                (link) =>
                                  `${link.guardian?.lastName}, ${link.guardian?.firstName}`,
                              )
                              .join(' · ')
                          : 'Sin familia'}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={student.status} />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Ver detalle">
                          <IconButton size="small" onClick={() => navigate(`/alumnos/${student.id}`)}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {canEdit && (
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => openEdit(student)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canEdit && student.status === 'ACTIVO' && (
                          <Tooltip title="Dar de baja">
                            <IconButton size="small" color="error" onClick={() => setToDeactivate(student)}>
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
          <DialogTitle>{editing ? 'Editar alumno' : 'Nuevo alumno'}</DialogTitle>
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
                label="Fecha de nacimiento"
                type="date"
                InputLabelProps={{ shrink: true }}
                {...register('birthDate')}
              />
              <TextField
                label="Curso"
                {...register('course')}
                error={Boolean(errors.course)}
                helperText={errors.course?.message}
              />
              <TextField
                label="División"
                {...register('division')}
                error={Boolean(errors.division)}
                helperText={errors.division?.message}
              />
              <TextField
                label="Turno"
                {...register('shift')}
                error={Boolean(errors.shift)}
                helperText={errors.shift?.message}
              />
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <TextField select label="Estado" {...field}>
                    {statuses.map((item) => (
                      <MenuItem key={item} value={item}>
                        {item}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
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
        title="Dar de baja al alumno"
        description={`¿Confirmás dar de baja a ${toDeactivate?.lastName}, ${toDeactivate?.firstName}? Sus cuotas y pagos se conservan.`}
        confirmLabel="Dar de baja"
        loading={deactivateMutation.isPending}
        onClose={() => setToDeactivate(null)}
        onConfirm={() => toDeactivate && deactivateMutation.mutate(toDeactivate)}
      />
    </Box>
  );
}
