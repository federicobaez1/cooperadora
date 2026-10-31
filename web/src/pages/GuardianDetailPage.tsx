import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddCardIcon from '@mui/icons-material/AddCard';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PaidIcon from '@mui/icons-material/Paid';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PeopleIcon from '@mui/icons-material/People';
import { api } from '../api/client';
import type { Fee, Guardian, Payment } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { StatusChip } from '../components/StatusChip';
import { useToast } from '../context/ToastContext';
import {
  formatDate,
  formatMoney,
  formatPeriod,
  methodLabel,
} from '../utils/format';
import { getErrorMessage } from '../utils/errors';
import { openReceipt } from '../utils/receipt';

interface AccountData {
  guardian: Guardian;
  fees: Fee[];
  payments: Payment[];
  summary: {
    studentsCount: number;
    feesCount: number;
    totalFees: number;
    totalPaid: number;
    balance: number;
    overdueBalance: number;
  };
}

export default function GuardianDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const notify = useToast();

  const { data, isLoading, error } = useQuery({
    queryKey: ['guardian-account', id],
    queryFn: async () => (await api.get<AccountData>(`/reports/account/${id}`)).data,
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data) {
    return <Alert severity="error">{getErrorMessage(error)}</Alert>;
  }

  const { guardian, summary } = data;

  const feeTotal = (fee: Fee) => fee.amount - fee.discount + fee.surcharge;
  const feeBalance = (fee: Fee) => feeTotal(fee) - fee.paidAmount;

  return (
    <Box>
      <PageHeader
        title={`${guardian.lastName}, ${guardian.firstName}`}
        subtitle={`Estado de cuenta · DNI ${guardian.dni}`}
        action={
          <>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/familias')}>
              Volver
            </Button>
            <Button
              variant="contained"
              startIcon={<AddCardIcon />}
              onClick={() => navigate(`/pagos/nuevo?guardianId=${guardian.id}`)}
            >
              Registrar pago
            </Button>
          </>
        }
      />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                Contacto
              </Typography>
              <Typography variant="body2">{guardian.phone || 'Sin teléfono'}</Typography>
              <Typography variant="body2">{guardian.email || 'Sin email'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Dirección
              </Typography>
              <Typography variant="body2">{guardian.address || '-'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Estado
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <StatusChip status={guardian.active ? 'ACTIVO' : 'INACTIVO'} />
              </Box>
            </Box>
          </Box>
          {guardian.notes && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary">
                Notas
              </Typography>
              <Typography variant="body2">{guardian.notes}</Typography>
            </>
          )}
        </CardContent>
      </Card>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        <StatCard
          title="Alumnos a cargo"
          value={String(summary.studentsCount)}
          icon={<PeopleIcon />}
          color="#1f6fa8"
        />
        <StatCard
          title="Total facturado"
          value={formatMoney(summary.totalFees)}
          hint={`${summary.feesCount} cuotas`}
          icon={<PaidIcon />}
        />
        <StatCard
          title="Total pagado"
          value={formatMoney(summary.totalPaid)}
          icon={<HourglassBottomIcon />}
          color="#2e7d32"
        />
        <StatCard
          title="Saldo pendiente"
          value={formatMoney(summary.balance)}
          hint={`Vencido: ${formatMoney(summary.overdueBalance)}`}
          icon={<WarningAmberIcon />}
          color="#b3261e"
        />
      </Box>

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Alumnos
      </Typography>
      <Paper sx={{ mb: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Alumno</TableCell>
                <TableCell>DNI</TableCell>
                <TableCell>Curso</TableCell>
                <TableCell>Turno</TableCell>
                <TableCell>Vínculo</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {guardian.students?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      Esta familia no tiene alumnos asociados.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {guardian.students?.map((link) => (
                <TableRow key={link.studentId} hover>
                  <TableCell>
                    {link.student?.lastName}, {link.student?.firstName}
                  </TableCell>
                  <TableCell>{link.student?.dni}</TableCell>
                  <TableCell>
                    {link.student?.course} {link.student?.division}
                  </TableCell>
                  <TableCell>{link.student?.shift}</TableCell>
                  <TableCell>{link.relation}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => navigate(`/alumnos/${link.studentId}`)}>
                      Ver alumno
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Cuotas
      </Typography>
      <Paper sx={{ mb: 3, overflow: 'hidden' }}>
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
              </TableRow>
            </TableHead>
            <TableBody>
              {data.fees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      No hay cuotas registradas.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {data.fees.map((fee) => (
                <TableRow key={fee.id} hover>
                  <TableCell>
                    {fee.student?.lastName}, {fee.student?.firstName}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Pagos
      </Typography>
      <Paper sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Recibo</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Medio</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Recibo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      No hay pagos registrados.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {data.payments.map((payment) => (
                <TableRow key={payment.id} hover>
                  <TableCell>{payment.receiptNumber}</TableCell>
                  <TableCell>{formatDate(payment.date)}</TableCell>
                  <TableCell>{methodLabel[payment.method] ?? payment.method}</TableCell>
                  <TableCell align="right">{formatMoney(payment.total)}</TableCell>
                  <TableCell>
                    <StatusChip status={payment.status} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Ver recibo PDF">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Los importes incluyen descuentos y recargos aplicados a cada cuota.
        </Typography>
      </Stack>
    </Box>
  );
}
