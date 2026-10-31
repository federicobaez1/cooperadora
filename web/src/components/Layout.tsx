import { useMemo, useState } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import SchoolIcon from '@mui/icons-material/School';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PaymentsIcon from '@mui/icons-material/Payments';
import AddCardIcon from '@mui/icons-material/AddCard';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CategoryIcon from '@mui/icons-material/Category';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import SettingsIcon from '@mui/icons-material/Settings';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import LogoutIcon from '@mui/icons-material/Logout';
import LockResetIcon from '@mui/icons-material/LockReset';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import { getErrorMessage } from '../utils/errors';
import { roleLabel } from '../utils/format';
import type { Role } from '../api/types';

const drawerWidth = 268;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: Role[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon />, roles: ['ADMIN', 'TESORERO', 'CONSULTA'] },
  { label: 'Registrar pago', path: '/pagos/nuevo', icon: <AddCardIcon />, roles: ['ADMIN', 'TESORERO'] },
  { label: 'Familias', path: '/familias', icon: <PeopleAltIcon />, roles: ['ADMIN', 'TESORERO', 'CONSULTA'] },
  { label: 'Alumnos', path: '/alumnos', icon: <SchoolIcon />, roles: ['ADMIN', 'TESORERO', 'CONSULTA'] },
  { label: 'Cuotas', path: '/cuotas', icon: <ReceiptLongIcon />, roles: ['ADMIN', 'TESORERO', 'CONSULTA'] },
  { label: 'Pagos', path: '/pagos', icon: <PaymentsIcon />, roles: ['ADMIN', 'TESORERO', 'CONSULTA'] },
  { label: 'Egresos', path: '/egresos', icon: <TrendingDownIcon />, roles: ['ADMIN', 'TESORERO'] },
  { label: 'Caja', path: '/caja', icon: <PointOfSaleIcon />, roles: ['ADMIN', 'TESORERO', 'CONSULTA'] },
  { label: 'Reportes', path: '/reportes', icon: <AssessmentIcon />, roles: ['ADMIN', 'TESORERO', 'CONSULTA'] },
  { label: 'Conceptos', path: '/conceptos', icon: <CategoryIcon />, roles: ['ADMIN', 'TESORERO'] },
  { label: 'Usuarios', path: '/usuarios', icon: <ManageAccountsIcon />, roles: ['ADMIN'] },
  { label: 'Configuración', path: '/configuracion', icon: <SettingsIcon />, roles: ['ADMIN'] },
];

const initials = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export function Layout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const notify = useToast();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  const items = useMemo(
    () => navItems.filter((item) => (user ? item.roles.includes(user.role) : false)),
    [user],
  );

  const currentTitle =
    items.find((item) => {
      if (item.path === '/pagos') {
        return pathname === '/pagos' || (pathname.startsWith('/pagos/') && pathname !== '/pagos/nuevo');
      }
      return pathname === item.path || pathname.startsWith(`${item.path}/`);
    })?.label ?? 'Cooperadora';

  const isSelected = (item: NavItem): boolean => {
    if (item.path === '/pagos') {
      return pathname === '/pagos' || (pathname.startsWith('/pagos/') && pathname !== '/pagos/nuevo');
    }
    return pathname === item.path || pathname.startsWith(`${item.path}/`);
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2.5, py: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2,
            bgcolor: 'primary.main',
            color: 'white',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <VolunteerActivismIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
            Cooperadora
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Gestión de pagos
          </Typography>
        </Box>
      </Box>
      <Divider />
      <List sx={{ px: 1.5, py: 2, flex: 1 }}>
        {items.map((item) => (
          <ListItemButton
            key={item.path}
            component={RouterLink}
            to={item.path}
            selected={isSelected(item)}
            onClick={() => setMobileOpen(false)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                '&:hover': { bgcolor: 'primary.dark' },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}
            />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          v1.0 · Sistema de cooperadora
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="inherit"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #e2e8e4',
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {isMobile && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 700 }}>
            {currentTitle}
          </Typography>
          <Tooltip title="Cuenta">
            <Button
              onClick={(event) => setAnchorEl(event.currentTarget)}
              sx={{ textTransform: 'none', color: 'text.primary', gap: 1 }}
            >
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14 }}>
                {initials(user?.name ?? '')}
              </Avatar>
              <Box sx={{ textAlign: 'left', display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                  {user?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {roleLabel[user?.role ?? ''] ?? user?.role}
                </Typography>
              </Box>
            </Button>
          </Tooltip>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                setPasswordOpen(true);
              }}
              sx={{ gap: 1.5 }}
            >
              <LockResetIcon fontSize="small" /> Cambiar contraseña
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                logout();
                navigate('/login');
              }}
              sx={{ gap: 1.5 }}
            >
              <LogoutIcon fontSize="small" /> Cerrar sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        {isMobile ? (
          <Drawer
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ '& .MuiDrawer-paper': { width: drawerWidth } }}
          >
            {drawerContent}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            open
            sx={{
              '& .MuiDrawer-paper': {
                width: drawerWidth,
                boxSizing: 'border-box',
                borderRight: '1px solid #e2e8e4',
              },
            }}
          >
            {drawerContent}
          </Drawer>
        )}
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          p: { xs: 2, sm: 3 },
          mt: { xs: 7, sm: 8 },
        }}
      >
        <Outlet />
      </Box>

      <Dialog open={passwordOpen} onClose={() => setPasswordOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Cambiar contraseña</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
          <TextField
            label="Contraseña actual"
            type="password"
            value={passwordForm.current}
            onChange={(event) => setPasswordForm((prev) => ({ ...prev, current: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Nueva contraseña"
            type="password"
            value={passwordForm.next}
            onChange={(event) => setPasswordForm((prev) => ({ ...prev, next: event.target.value }))}
            helperText="Mínimo 8 caracteres"
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPasswordOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={savingPassword || passwordForm.next.length < 8}
            onClick={async () => {
              setSavingPassword(true);
              try {
                await api.patch('/auth/me/password', {
                  currentPassword: passwordForm.current,
                  newPassword: passwordForm.next,
                });
                notify('Contraseña actualizada');
                setPasswordOpen(false);
                setPasswordForm({ current: '', next: '' });
              } catch (error) {
                notify(getErrorMessage(error), 'error');
              } finally {
                setSavingPassword(false);
              }
            }}
          >
            {savingPassword ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
