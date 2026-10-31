import type { ReactNode } from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

interface Props {
  title: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  color?: string;
}

export function StatCard({ title, value, hint, icon, color = '#1e6b52' }: Props) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {value}
            </Typography>
            {hint && (
              <Typography variant="caption" color="text.secondary">
                {hint}
              </Typography>
            )}
          </Box>
          {icon && (
            <Box
              sx={{
                bgcolor: `${color}14`,
                color,
                borderRadius: 2,
                p: 1,
                display: 'flex',
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
