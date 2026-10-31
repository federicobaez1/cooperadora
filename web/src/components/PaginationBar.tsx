import { TablePagination } from '@mui/material';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function PaginationBar({ page, pageSize, total, onPageChange, onPageSizeChange }: Props) {
  return (
    <TablePagination
      component="div"
      count={total}
      page={Math.max(page - 1, 0)}
      rowsPerPage={pageSize}
      onPageChange={(_, nextPage) => onPageChange(nextPage + 1)}
      onRowsPerPageChange={(event) => onPageSizeChange(Number(event.target.value))}
      rowsPerPageOptions={[10, 20, 50, 100]}
      labelRowsPerPage="Filas por página"
      labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
    />
  );
}
