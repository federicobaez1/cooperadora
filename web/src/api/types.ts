export type Role = 'ADMIN' | 'TESORERO' | 'CONSULTA';
export type StudentStatus = 'ACTIVO' | 'INACTIVO' | 'EGRESADO';
export type GuardianRelation = 'PADRE' | 'MADRE' | 'TUTOR' | 'OTRO';
export type ConceptType = 'CUOTA_SOCIAL' | 'MATRICULA' | 'ACTIVIDAD' | 'VIAJE' | 'OTRO';
export type FeeStatus = 'PENDIENTE' | 'PARCIAL' | 'PAGA' | 'ANULADA';
export type PaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'MERCADO_PAGO' | 'CHEQUE';
export type PaymentStatus = 'ACTIVO' | 'ANULADO';
export type ExpenseStatus = 'ACTIVO' | 'ANULADO';
export type CashSessionStatus = 'ABIERTA' | 'CERRADA';

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt?: string;
}

export interface Guardian {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  active: boolean;
  students?: StudentGuardianLink[];
  payments?: Payment[];
  _count?: { payments: number };
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  birthDate?: string | null;
  course: string;
  division: string;
  shift: string;
  status: StudentStatus;
  notes?: string | null;
  guardians?: StudentGuardianLink[];
  fees?: Fee[];
}

export interface StudentGuardianLink {
  studentId: string;
  guardianId: string;
  relation: GuardianRelation;
  isPrimary: boolean;
  student?: Student;
  guardian?: Guardian;
}

export interface Concept {
  id: string;
  name: string;
  type: ConceptType;
  defaultAmount: number;
  recurring: boolean;
  description?: string | null;
  active: boolean;
  _count?: { fees: number };
}

export interface Allocation {
  id: string;
  paymentId: string;
  feeId: string;
  amount: number;
  fee?: Fee;
}

export interface Fee {
  id: string;
  studentId: string;
  conceptId: string;
  period: string;
  amount: number;
  discount: number;
  surcharge: number;
  paidAmount: number;
  dueDate: string;
  status: FeeStatus;
  notes?: string | null;
  student?: Student;
  concept?: Concept;
  allocations?: Allocation[];
}

export interface Payment {
  id: string;
  receiptNumber: string;
  guardianId: string;
  date: string;
  method: PaymentMethod;
  total: number;
  notes?: string | null;
  status: PaymentStatus;
  guardian?: Guardian;
  createdBy?: { id: string; name: string };
  cancelledBy?: { id: string; name: string } | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  allocations?: Allocation[];
  _count?: { allocations: number };
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  status: ExpenseStatus;
  createdBy?: { id: string; name: string };
  cancelReason?: string | null;
}

export interface CashSession {
  id: string;
  openedAt: string;
  closedAt?: string | null;
  openingAmount: number;
  expectedAmount?: number | null;
  countedAmount?: number | null;
  difference?: number | null;
  status: CashSessionStatus;
  notes?: string | null;
  openedBy?: { id: string; name: string };
  closedBy?: { id: string; name: string } | null;
}

export interface ReportSummary {
  period: { from: string; to: string };
  income: number;
  expenses: number;
  balance: number;
  paymentsCount: number;
  expensesCount: number;
  pending: { count: number; total: number; balance: number };
  overdue: { count: number; balance: number };
  activeStudents: number;
  activeGuardians: number;
}
