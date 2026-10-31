import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { api } from '../api/client';
import type {
  Fee,
  Guardian,
  GuardianRelation,
  Paginated,
  Student,
  StudentGuardianLink,
} from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { StatusChip } from '../components/StatusChip';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  formatDate,
  formatMoney,
  formatPeriod,
  relationLabel,
} from '../utils/format';
import { getErrorMessage } from '../utils/errors';

const relations: GuardianRelation[] = ['MADRE', 'PADRE', 'TUTOR', 'OTRO'];

export default function StudentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const notify = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'TESORERO';

  const [linkOpen, setLinkOpen] = useState(false);
  const [selectedGuardian, setSelectedGuardian] = useState<Guardian | null>(null);
  const [relation, setRelation] = useState<GuardianRelation>('MADRE');
  const [isPrimary, setIsPrimary] = useState(false);
  const [toUnlink, setToUnlink] = useState<StudentGuardianLink | null>(null);

  const { data: student, isLoading, error } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => (await api.get<Student>(`/students/${id}`)).data,
    enabled: Boolean(id),
  });

  const { data: guardians } = useQuery({
    queryKey: ['guardians-options'],
    queryFn: async () =>
      (
        await api.get<Paginated<Guardian>>('/guardians', {
          params: { pageSize: 100, active: 'true' },
        })
      ).data.data,
    enabled: linkOpen,
  });

  const linkMutation = useMutation({
    mutationFn: async () =>
      api.post(`/students/${id}/guardians`, {
        guardianId: selectedGuardian?.id,
        relation,
        isPrimary,
      }),
    onSuccess: () => {
      notify('Familia vinculada');
      setLinkOpen(false);
      setSelectedGuardian(null);
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (link: StudentGuardianLink) =>
      api.delete(`/students/${id}/guardians/${link.guardianId}`),
    onSuccess: () => {
      notify('Vínculo eliminado');
      setToUnlink(null);
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
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

  if (error || !student) {
    return <Alert severity="error">{getErrorMessage(error)}</Alert>;
  }

  const feeTotal = (fee: Fee) => fee.amount - fee.discount + fee.surcharge;
  const feeBalance = (fee: Fee) => feeTotal(fee) - fee.paidAmount;

  return (
    <Box>
      <PageHeader
        title={`${student.lastName}, ${student.firstName}`}
        subtitle={`Alumno · DNI ${student.dni}`}
        action={
          <>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/alumnos')}>
              Volver
            </Button>
            {canEdit && (
              <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setLinkOpen(true)}>
                Vincular familia
              </Button>
            )}
          </>
        }
      />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr 1fr' },
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                Curso
              </Typography>
              <Typography variant="body2">
                {student.course} {student.division}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Turno
              </Typography>
              <Typography variant="body2">{student.shift}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Nacimiento
              </Typography>
              <Typography variant="body2">{formatDate(student.birthDate)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Estado
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <StatusChip status={student.status} />
              </Box>
            </Box>
          </Box>
          {student.notes && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                Notas
              </Typography>
              <Typography variant="body2">{student.notes}</Typography>
            </>
          )}
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Familias vinculadas
      </Typography>
      <Paper sx={{ mb: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Familia</TableCell>
                <TableCell>DNI</TableCell>
                <TableCell>Contacto</TableCell>
                <TableCell>Vínculo</TableCell>
                <TableCell>Principal</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {student.guardians?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      El alumno no tiene familias vinculadas.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {student.guardians?.map((link) => (
                <TableRow key={link.guardianId} hover>
                  <TableCell>
                    <Button size="small" onClick={() => navigate(`/familias/${link.guardianId}`)}>
                      {link.guardian?.lastName}, {link.guardian?.firstName}
                    </Button>
                  </TableCell>
                  <TableCell>{link.guardian?.dni}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{link.guardian?.phone || '-'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {link.guardian?.email || 'Sin email'}
                    </Typography>
                  </TableCell>
                  <TableCell>{relationLabel[link.relation] ?? link.relation}</TableCell>
                  <TableCell>{link.isPrimary ? 'Sí' : 'No'}</TableCell>
                  <TableCell align="right">
                    {canEdit && (
                      <Tooltip title="Desvincular">
                        <IconButton size="small" color="error" onClick={() => setToUnlink(link)}>
                          <LinkOffIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Cuotas del alumno
      </Typography>
      <Paper sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Concepto</TableCell>
                <TableCell>Período</TableCell>
                <TableCell>Vencimiento</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Pagado</TableCell>
                <TableCell align="right">Saldo</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {student.fees?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      No hay cuotas generadas para este alumno.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {student.fees?.map((fee) => (
                <TableRow key={fee.id} hover>
                  <TableCell>{fee.concept?.name}</TableCell>
                  <TableCell>{formatPeriod(fee.period)}</TableCell>
                  <TableCell>{formatDate(fee.dueDate)}</TableCell>
                  <TableCell align="right">{formatMoney(feeTotal(fee))}</TableCell>
                  <TableCell align="right">{formatMoney(fee.paidAmount)}</TableCell>
                  <TableCell align="right">{formatMoney(feeBalance(fee))}</TableCell>
                  <TableCell>
                    <StatusChip status={fee.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={linkOpen} onClose={() => setLinkOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Vincular familia</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
          <Autocomplete
            options={guardians ?? []}
            value={selectedGuardian}
            onChange={(_, value) => setSelectedGuardian(value)}
            getOptionLabel={(option) => `${option.lastName}, ${option.firstName} (${option.dni})`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="Familia" />}
            noOptionsText="Sin familias disponibles"
          />
          <TextField
            select
            label="Vínculo"
            value={relation}
            onChange={(event) => setRelation(event.target.value as GuardianRelation)}
          >
            {relations.map((item) => (
              <MenuItem key={item} value={item}>
                {relationLabel[item]}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Switch checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} />
            }
            label="Contacto principal"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLinkOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!selectedGuardian || linkMutation.isPending}
            onClick={() => linkMutation.mutate()}
          >
            {linkMutation.isPending ? 'Vinculando...' : 'Vincular'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toUnlink)}
        title="Desvincular familia"
        description={`¿Confirmás desvincular a ${toUnlink?.guardian?.lastName}, ${toUnlink?.guardian?.firstName} de este alumno?`}
        confirmLabel="Desvincular"
        loading={unlinkMutation.isPending}
        onClose={() => setToUnlink(null)}
        onConfirm={() => toUnlink && unlinkMutation.mutate(toUnlink)}
      />
    </Box>
  );
}
