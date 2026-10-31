import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';

// Las páginas se cargan bajo demanda para que el bundle inicial sea chico.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const GuardiansPage = lazy(() => import('./pages/GuardiansPage'));
const GuardianDetailPage = lazy(() => import('./pages/GuardianDetailPage'));
const StudentsPage = lazy(() => import('./pages/StudentsPage'));
const StudentDetailPage = lazy(() => import('./pages/StudentDetailPage'));
const ConceptsPage = lazy(() => import('./pages/ConceptsPage'));
const FeesPage = lazy(() => import('./pages/FeesPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const NewPaymentPage = lazy(() => import('./pages/NewPaymentPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const CashPage = lazy(() => import('./pages/CashPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function PageFallback() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <CircularProgress />
    </Box>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/familias" element={<GuardiansPage />} />
            <Route path="/familias/:id" element={<GuardianDetailPage />} />
            <Route path="/alumnos" element={<StudentsPage />} />
            <Route path="/alumnos/:id" element={<StudentDetailPage />} />
            <Route path="/conceptos" element={<ConceptsPage />} />
            <Route path="/cuotas" element={<FeesPage />} />
            <Route path="/pagos" element={<PaymentsPage />} />
            <Route path="/pagos/nuevo" element={<NewPaymentPage />} />
            <Route path="/egresos" element={<ExpensesPage />} />
            <Route path="/caja" element={<CashPage />} />
            <Route path="/reportes" element={<ReportsPage />} />
            <Route path="/usuarios" element={<UsersPage />} />
            <Route path="/configuracion" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
