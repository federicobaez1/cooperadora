import { Router } from 'express';
import { authRouter } from './modules/auth/routes';
import { usersRouter } from './modules/users/routes';
import { guardiansRouter } from './modules/guardians/routes';
import { studentsRouter } from './modules/students/routes';
import { conceptsRouter } from './modules/concepts/routes';
import { feesRouter } from './modules/fees/routes';
import { paymentsRouter } from './modules/payments/routes';
import { expensesRouter } from './modules/expenses/routes';
import { cashRouter } from './modules/cash/routes';
import { reportsRouter } from './modules/reports/routes';
import { settingsRouter } from './modules/settings/routes';

export const router = Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/guardians', guardiansRouter);
router.use('/students', studentsRouter);
router.use('/concepts', conceptsRouter);
router.use('/fees', feesRouter);
router.use('/payments', paymentsRouter);
router.use('/expenses', expensesRouter);
router.use('/cash', cashRouter);
router.use('/reports', reportsRouter);
router.use('/settings', settingsRouter);
