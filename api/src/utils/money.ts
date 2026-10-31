import { FeeStatus, Prisma } from '@prisma/client';

export const dec = (value: string | number | Prisma.Decimal): Prisma.Decimal => new Prisma.Decimal(value);

export const num = (value: Prisma.Decimal | number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  return Number(value);
};

type FeeAmounts = {
  amount: Prisma.Decimal;
  discount: Prisma.Decimal;
  surcharge: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
};

export const feeTotal = (fee: Pick<FeeAmounts, 'amount' | 'discount' | 'surcharge'>): Prisma.Decimal =>
  dec(fee.amount).minus(fee.discount).plus(fee.surcharge);

export const feeBalance = (fee: FeeAmounts): Prisma.Decimal => feeTotal(fee).minus(fee.paidAmount);

export const statusForPayment = (total: Prisma.Decimal, paid: Prisma.Decimal): FeeStatus => {
  if (paid.lte(0)) return 'PENDIENTE';
  if (paid.gte(total)) return 'PAGA';
  return 'PARCIAL';
};

export const round2 = (value: number): number => Math.round(value * 100) / 100;
