import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { dec, feeBalance, feeTotal, num, round2, statusForPayment } from './money';

const amounts = (
  amount: number,
  discount = 0,
  surcharge = 0,
  paidAmount = 0,
): {
  amount: Prisma.Decimal;
  discount: Prisma.Decimal;
  surcharge: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
} => ({
  amount: dec(amount),
  discount: dec(discount),
  surcharge: dec(surcharge),
  paidAmount: dec(paidAmount),
});

describe('money helpers', () => {
  it('calcula el total de la cuota con descuento y recargo', () => {
    expect(num(feeTotal(amounts(6000, 500, 300)))).toBe(5800);
  });

  it('calcula el saldo pendiente', () => {
    expect(num(feeBalance(amounts(6000, 0, 0, 2500)))).toBe(3500);
  });

  it('define el estado según lo pagado', () => {
    expect(statusForPayment(dec(6000), dec(0))).toBe('PENDIENTE');
    expect(statusForPayment(dec(6000), dec(2500))).toBe('PARCIAL');
    expect(statusForPayment(dec(6000), dec(6000))).toBe('PAGA');
  });

  it('convierte valores nulos a cero y redondea a dos decimales', () => {
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(round2(1234.567)).toBe(1234.57);
  });
});
