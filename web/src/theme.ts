import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1e6b52',
      light: '#4a9a7a',
      dark: '#124534',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#c98a2e',
      light: '#e6b463',
      dark: '#8f5f17',
    },
    background: {
      default: '#f4f6f5',
      paper: '#ffffff',
    },
    success: { main: '#2e7d32' },
    warning: { main: '#b26a00' },
    error: { main: '#b3261e' },
    info: { main: '#1f6fa8' },
    text: {
      primary: '#1d2621',
      secondary: '#5c6b63',
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily:
      '"Inter", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, paddingInline: 18 },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: '1px solid #e2e8e4' },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: '1px solid #e2e8e4', borderRadius: 16 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 700, color: '#425049', backgroundColor: '#f8faf9' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiSelect: {
      defaultProps: { size: 'small' },
    },
  },
});
