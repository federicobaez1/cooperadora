import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { getErrorMessage } from '../utils/errors';

interface SettingsForm {
  name: string;
  address: string;
  cuit: string;
  surchargePercent: string;
  receiptPrefix: string;
}

const emptyForm: SettingsForm = {
  name: '',
  address: '',
  cuit: '',
  surchargePercent: '10',
  receiptPrefix: 'REC',
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [form, setForm] = useState<SettingsForm>(emptyForm);
  const [initialized, setInitialized] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['settings'],
    queryFn: async () =>
      (await api.get<{ data: Record<string, string> }>('/settings')).data.data,
  });

  useEffect(() => {
    if (!data || initialized) return;
    setForm({
      name: data['cooperative.name'] ?? '',
      address: data['cooperative.address'] ?? '',
      cuit: data['cooperative.cuit'] ?? '',
      surchargePercent: data['surcharge.percent'] ?? '10',
      receiptPrefix: data['receipt.prefix'] ?? 'REC',
    });
    setInitialized(true);
  }, [data, initialized]);

  const saveMutation = useMutation({
    mutationFn: async () =>
      api.put('/settings', {
        'cooperative.name': form.name,
        'cooperative.address': form.address,
        'cooperative.cuit': form.cuit,
        'surcharge.percent': form.surchargePercent,
        'receipt.prefix': form.receiptPrefix,
      }),
    onSuccess: () => {
      notify('Configuración guardada');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (mutationError) => notify(getErrorMessage(mutationError), 'error'),
  });

  const set = (key: keyof SettingsForm) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{getErrorMessage(error)}</Alert>;
  }

  return (
    <Box>
      <PageHeader
        title="Configuración"
        subtitle="Datos de la cooperadora y parámetros del sistema"
        action={
          isAdmin ? (
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={saveMutation.isPending || !form.name.trim()}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          ) : undefined
        }
      />

      {!isAdmin && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Solo el administrador puede modificar la configuración. Estás viendo los valores actuales.
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
          gap: 2,
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Datos institucionales
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Se utilizan en los recibos PDF y en la identidad del sistema.
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}
            >
              <TextField
                label="Nombre de la cooperadora"
                value={form.name}
                onChange={set('name')}
                disabled={!isAdmin}
                sx={{ gridColumn: { sm: 'span 2' } }}
                fullWidth
              />
              <TextField
                label="Dirección"
                value={form.address}
                onChange={set('address')}
                disabled={!isAdmin}
                sx={{ gridColumn: { sm: 'span 2' } }}
                fullWidth
              />
              <TextField
                label="CUIT"
                value={form.cuit}
                onChange={set('cuit')}
                disabled={!isAdmin}
                fullWidth
              />
              <TextField
                label="Prefijo de recibo"
                value={form.receiptPrefix}
                onChange={set('receiptPrefix')}
                disabled={!isAdmin}
                helperText="Ejemplo: REC"
                fullWidth
              />
            </Box>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Recargos por mora
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Porcentaje sugerido al aplicar recargos sobre cuotas vencidas.
            </Typography>
            <TextField
              label="Porcentaje de recargo"
              value={form.surchargePercent}
              onChange={set('surchargePercent')}
              disabled={!isAdmin}
              type="number"
              inputProps={{ min: 0, max: 100, step: '0.1' }}
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              sx={{ maxWidth: 240 }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Cómo funciona
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Reglas de negocio configuradas en el sistema.
            </Typography>
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              {[
                'Cada cuota pertenece a un alumno, concepto y período.',
                'Los pagos se imputan a una o más cuotas y generan un recibo numerado.',
                'Los pagos y egresos no se eliminan: se anulan con motivo y quedan auditados.',
                'El cierre de caja compara el efectivo contado con el saldo esperado.',
                'Los recargos se aplican solo a cuotas vencidas sin recargo previo.',
              ].map((rule) => (
                <Box key={rule} sx={{ display: 'flex', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      mt: 1,
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {rule}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Divider sx={{ my: 2.5 }} />
            <Typography variant="caption" color="text.secondary">
              Versión 1.0 · Sistema de gestión de pagos para cooperadoras escolares
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
