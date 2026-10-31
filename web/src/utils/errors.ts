import axios from 'axios';

export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor. Verificá que la API esté levantada.';
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado';
};
