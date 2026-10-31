import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';

const schema = z.object({
  email: z.string().trim().email('Ingresá un email válido'),
  password: z.string().min(1, 'Ingresá la contraseña'),
});

type FormValues = z.infer<typeof schema>;

const demoUsers = [
  { label: 'Admin', email: 'admin@cooperadora.edu', password: 'Admin1234' },
  { label: 'Tesorero', email: 'tesorero@cooperadora.edu', password: 'Tesorero1234' },
  { label: 'Consulta', email: 'consulta@cooperadora.edu', password: 'Consulta1234' },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: 'admin@cooperadora.edu', password: 'Admin1234' },
  });

  if (user) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (values: FormValues) => {
    setError('');
    setSubmitting(true);
    try {
      await login(values.email, values.password);
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' },
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 6,
          color: 'white',
          background: 'linear-gradient(145deg, #124534 0%, #1e6b52 55%, #2f8a68 100%)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.16)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <VolunteerActivismIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
              Cooperadora Escolar
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              Manuel Belgrano
            </Typography>
          </Box>
        </Box>

        <Box>
          <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.03em', maxWidth: 520 }}>
            La gestión de pagos de la cooperadora, simple y ordenada.
          </Typography>
          <Typography sx={{ mt: 2, opacity: 0.85, maxWidth: 480 }}>
            Cuotas, pagos, recibos, caja y reportes en un solo lugar. Pensado para que la
            comisión directiva trabaje con información clara.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 4, flexWrap: 'wrap', gap: 1 }}>
            <Chip label="Cuotas por familia" sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: 'white' }} />
            <Chip label="Recibos PDF" sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: 'white' }} />
            <Chip label="Cierre de caja" sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: 'white' }} />
            <Chip label="Reportes" sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: 'white' }} />
          </Stack>
        </Box>

        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          Sistema de gestión de pagos · Proyecto académico 2026
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', placeItems: 'center', p: { xs: 2, sm: 4 } }}>
        <Card sx={{ width: '100%', maxWidth: 420 }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: 'primary.main',
                  color: 'white',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <LockOutlinedIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="h5">Ingresar</Typography>
                <Typography variant="body2" color="text.secondary">
                  Accedé con tu cuenta de la cooperadora
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 3 }} />

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <Stack spacing={2}>
                {error && <Alert severity="error">{error}</Alert>}
                <TextField
                  label="Email"
                  type="email"
                  fullWidth
                  autoComplete="email"
                  {...register('email')}
                  error={Boolean(errors.email)}
                  helperText={errors.email?.message}
                />
                <TextField
                  label="Contraseña"
                  type="password"
                  fullWidth
                  autoComplete="current-password"
                  {...register('password')}
                  error={Boolean(errors.password)}
                  helperText={errors.password?.message}
                />
                <Button type="submit" variant="contained" size="large" disabled={submitting}>
                  {submitting ? 'Ingresando...' : 'Ingresar'}
                </Button>
              </Stack>
            </form>

            <Divider sx={{ my: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Cuentas de demostración
              </Typography>
            </Divider>

            <Stack spacing={1}>
              {demoUsers.map((demo) => (
                <Button
                  key={demo.email}
                  variant="outlined"
                  color="inherit"
                  size="small"
                  onClick={() => {
                    setValue('email', demo.email);
                    setValue('password', demo.password);
                  }}
                  sx={{ justifyContent: 'space-between', color: 'text.secondary' }}
                >
                  <span>{demo.label}</span>
                  <span style={{ fontSize: 12 }}>{demo.email}</span>
                </Button>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
