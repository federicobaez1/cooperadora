import { api } from '../api/client';

export const openReceipt = async (paymentId: string): Promise<void> => {
  const response = await api.get(`/payments/${paymentId}/receipt`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data as Blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
