import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Alert, Snackbar } from '@mui/material';

type Severity = 'success' | 'error' | 'warning' | 'info';

type Notify = (message: string, severity?: Severity) => void;

const ToastContext = createContext<Notify>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<Severity>('success');

  const notify = useCallback<Notify>((text, nextSeverity = 'success') => {
    setMessage(text);
    setSeverity(nextSeverity);
    setOpen(true);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={5000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={severity}
          variant="filled"
          onClose={() => setOpen(false)}
          sx={{ width: '100%' }}
        >
          {message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export const useToast = (): Notify => useContext(ToastContext);
