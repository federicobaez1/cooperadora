import { describe, expect, it } from 'vitest';
import {
  dateRange,
  dueDateFor,
  endOfMonthUtc,
  isValidPeriod,
  startOfDayUtc,
  startOfMonthUtc,
} from './period';

describe('period helpers', () => {
  it('valida períodos mensuales', () => {
    expect(isValidPeriod('2026-10')).toBe(true);
    expect(isValidPeriod('2026-13')).toBe(false);
    expect(isValidPeriod('2026-1')).toBe(false);
  });

  it('genera vencimientos a medianoche UTC sin desbordar el mes', () => {
    expect(dueDateFor('2026-10', 10).toISOString()).toBe('2026-10-10T00:00:00.000Z');
    expect(dueDateFor('2026-02', 31).toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it('construye rangos inclusivos en UTC', () => {
    const range = dateRange('2026-10-01', '2026-10-31');
    expect(range.gte?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(range.lte?.toISOString()).toBe('2026-10-31T23:59:59.999Z');
  });

  it('calcula límites de calendario local expresados en UTC', () => {
    const reference = new Date('2026-10-31T19:31:00.000Z');
    expect(startOfDayUtc(reference).toISOString()).toBe('2026-10-31T00:00:00.000Z');
    expect(startOfMonthUtc(reference).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(endOfMonthUtc(reference).toISOString()).toBe('2026-10-31T23:59:59.999Z');
  });
});
