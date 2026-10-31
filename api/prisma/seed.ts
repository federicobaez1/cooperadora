import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { dec, feeTotal, statusForPayment } from '../src/utils/money';
import { dueDateFor } from '../src/utils/period';

const prisma = new PrismaClient();

const PERIOD = (offset: number): string => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

async function reset() {
  await prisma.cashSession.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.fee.deleteMany();
  await prisma.studentGuardian.deleteMany();
  await prisma.student.deleteMany();
  await prisma.guardian.deleteMany();
  await prisma.concept.deleteMany();
  await prisma.sequence.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
}

async function createPayment(options: {
  guardianId: string;
  userId: string;
  method: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'MERCADO_PAGO' | 'CHEQUE';
  date: Date;
  items: Array<{ feeId: string; amount: Prisma.Decimal }>;
  notes?: string;
}) {
  const total = options.items.reduce((acc, item) => acc.plus(item.amount), dec(0));
  const year = options.date.getFullYear();

  const sequence = await prisma.sequence.upsert({
    where: { name: `receipt-${year}` },
    create: { name: `receipt-${year}`, value: 1 },
    update: { value: { increment: 1 } },
  });

  const receiptNumber = `REC-${year}-${String(sequence.value).padStart(6, '0')}`;

  const payment = await prisma.payment.create({
    data: {
      receiptNumber,
      guardianId: options.guardianId,
      date: options.date,
      method: options.method,
      total,
      notes: options.notes,
      createdById: options.userId,
      allocations: {
        create: options.items.map((item) => ({ feeId: item.feeId, amount: item.amount })),
      },
    },
  });

  for (const item of options.items) {
    const fee = await prisma.fee.findUniqueOrThrow({ where: { id: item.feeId } });
    const paid = dec(fee.paidAmount).plus(item.amount);
    await prisma.fee.update({
      where: { id: fee.id },
      data: {
        paidAmount: paid,
        status: statusForPayment(feeTotal(fee), paid),
      },
    });
  }

  return payment;
}

async function main() {
  console.log('Limpiando datos previos...');
  await reset();

  console.log('Creando usuarios...');
  const [admin, tesorero, consulta] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Administrador',
        email: 'admin@cooperadora.edu',
        passwordHash: await bcrypt.hash('Admin1234', 10),
        role: 'ADMIN',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Tesorera',
        email: 'tesorero@cooperadora.edu',
        passwordHash: await bcrypt.hash('Tesorero1234', 10),
        role: 'TESORERO',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Consulta',
        email: 'consulta@cooperadora.edu',
        passwordHash: await bcrypt.hash('Consulta1234', 10),
        role: 'CONSULTA',
      },
    }),
  ]);

  await prisma.setting.createMany({
    data: [
      { key: 'cooperative.name', value: 'Cooperadora Escolar Manuel Belgrano' },
      { key: 'cooperative.address', value: 'Av. San Martín 1234, Buenos Aires' },
      { key: 'cooperative.cuit', value: '30-71234567-8' },
      { key: 'surcharge.percent', value: '10' },
      { key: 'receipt.prefix', value: 'REC' },
    ],
  });

  console.log('Creando conceptos...');
  const [cuotaSocial, matricula, taller, viaje] = await Promise.all([
    prisma.concept.create({
      data: {
        name: 'Cuota social',
        type: 'CUOTA_SOCIAL',
        defaultAmount: dec(6000),
        recurring: true,
        description: 'Cuota mensual de la cooperadora',
      },
    }),
    prisma.concept.create({
      data: {
        name: 'Matrícula 2026',
        type: 'MATRICULA',
        defaultAmount: dec(12000),
        description: 'Matrícula anual',
      },
    }),
    prisma.concept.create({
      data: {
        name: 'Taller de arte',
        type: 'ACTIVIDAD',
        defaultAmount: dec(4500),
        description: 'Taller extracurricular de arte',
      },
    }),
    prisma.concept.create({
      data: {
        name: 'Viaje fin de año',
        type: 'VIAJE',
        defaultAmount: dec(35000),
        description: 'Viaje de egresados',
      },
    }),
  ]);

  console.log('Creando familias y alumnos...');
  const maria = await prisma.guardian.create({
    data: {
      firstName: 'María',
      lastName: 'López',
      dni: '30111222',
      email: 'maria.lopez@example.com',
      phone: '11 5555-1111',
      address: 'Belgrano 123',
    },
  });
  const carlos = await prisma.guardian.create({
    data: {
      firstName: 'Carlos',
      lastName: 'Gómez',
      dni: '28444555',
      email: 'carlos.gomez@example.com',
      phone: '11 5555-2222',
      address: 'Belgrano 123',
    },
  });
  const laura = await prisma.guardian.create({
    data: {
      firstName: 'Laura',
      lastName: 'Fernández',
      dni: '32666777',
      email: 'laura.fernandez@example.com',
      phone: '11 5555-3333',
      address: 'Rivadavia 456',
    },
  });
  const diego = await prisma.guardian.create({
    data: {
      firstName: 'Diego',
      lastName: 'Sosa',
      dni: '25999888',
      email: 'diego.sosa@example.com',
      phone: '11 5555-4444',
      address: 'Mitre 789',
    },
  });
  const ana = await prisma.guardian.create({
    data: {
      firstName: 'Ana',
      lastName: 'Martínez',
      dni: '33777111',
      email: 'ana.martinez@example.com',
      phone: '11 5555-5555',
      address: 'Sarmiento 321',
    },
  });

  const sofia = await prisma.student.create({
    data: {
      firstName: 'Sofía',
      lastName: 'Gómez',
      dni: '45111222',
      birthDate: new Date('2014-04-12'),
      course: '1°',
      division: 'A',
      shift: 'Mañana',
    },
  });
  const mateo = await prisma.student.create({
    data: {
      firstName: 'Mateo',
      lastName: 'Gómez',
      dni: '45111223',
      birthDate: new Date('2014-08-23'),
      course: '1°',
      division: 'A',
      shift: 'Mañana',
    },
  });
  const valentina = await prisma.student.create({
    data: {
      firstName: 'Valentina',
      lastName: 'Fernández',
      dni: '44111333',
      birthDate: new Date('2013-02-05'),
      course: '2°',
      division: 'B',
      shift: 'Tarde',
    },
  });
  const joaquin = await prisma.student.create({
    data: {
      firstName: 'Joaquín',
      lastName: 'Sosa',
      dni: '43111444',
      birthDate: new Date('2012-11-17'),
      course: '3°',
      division: 'A',
      shift: 'Mañana',
    },
  });
  const martina = await prisma.student.create({
    data: {
      firstName: 'Martina',
      lastName: 'Sosa',
      dni: '45111445',
      birthDate: new Date('2014-06-30'),
      course: '1°',
      division: 'B',
      shift: 'Tarde',
    },
  });
  const benjamin = await prisma.student.create({
    data: {
      firstName: 'Benjamín',
      lastName: 'Fernández',
      dni: '42111555',
      birthDate: new Date('2011-09-09'),
      course: '4°',
      division: 'C',
      shift: 'Mañana',
    },
  });
  const emma = await prisma.student.create({
    data: {
      firstName: 'Emma',
      lastName: 'Martínez',
      dni: '44111666',
      birthDate: new Date('2013-12-01'),
      course: '2°',
      division: 'A',
      shift: 'Tarde',
    },
  });
  const lucas = await prisma.student.create({
    data: {
      firstName: 'Lucas',
      lastName: 'Martínez',
      dni: '41111777',
      birthDate: new Date('2010-03-21'),
      course: '5°',
      division: 'B',
      shift: 'Mañana',
    },
  });

  await prisma.studentGuardian.createMany({
    data: [
      { studentId: sofia.id, guardianId: maria.id, relation: 'MADRE', isPrimary: true },
      { studentId: sofia.id, guardianId: carlos.id, relation: 'PADRE', isPrimary: false },
      { studentId: mateo.id, guardianId: maria.id, relation: 'MADRE', isPrimary: true },
      { studentId: mateo.id, guardianId: carlos.id, relation: 'PADRE', isPrimary: false },
      { studentId: valentina.id, guardianId: laura.id, relation: 'MADRE', isPrimary: true },
      { studentId: benjamin.id, guardianId: laura.id, relation: 'MADRE', isPrimary: true },
      { studentId: joaquin.id, guardianId: diego.id, relation: 'PADRE', isPrimary: true },
      { studentId: martina.id, guardianId: diego.id, relation: 'PADRE', isPrimary: true },
      { studentId: emma.id, guardianId: ana.id, relation: 'MADRE', isPrimary: true },
      { studentId: lucas.id, guardianId: ana.id, relation: 'MADRE', isPrimary: true },
    ],
  });

  console.log('Generando cuotas...');
  const periods = [PERIOD(2), PERIOD(1), PERIOD(0)];
  const students = [sofia, mateo, valentina, joaquin, martina, benjamin, emma, lucas];
  const feeByStudentAndPeriod = new Map<string, string>();

  for (const student of students) {
    for (const period of periods) {
      const fee = await prisma.fee.create({
        data: {
          studentId: student.id,
          conceptId: cuotaSocial.id,
          period,
          amount: cuotaSocial.defaultAmount,
          dueDate: dueDateFor(period, 10),
        },
      });
      feeByStudentAndPeriod.set(`${student.id}:${period}`, fee.id);
    }
  }

  const matriculaFees = new Map<string, string>();
  for (const student of students) {
    const fee = await prisma.fee.create({
      data: {
        studentId: student.id,
        conceptId: matricula.id,
        period: '2026',
        amount: matricula.defaultAmount,
        dueDate: dueDateFor('2026-03', 15),
      },
    });
    matriculaFees.set(student.id, fee.id);
  }

  const fee = (studentId: string, period: string) => {
    const id = feeByStudentAndPeriod.get(`${studentId}:${period}`);
    if (!id) throw new Error(`Cuota no encontrada para ${studentId} ${period}`);
    return id;
  };

  console.log('Registrando pagos de ejemplo...');
  await createPayment({
    guardianId: maria.id,
    userId: tesorero.id,
    method: 'EFECTIVO',
    date: new Date(2026, 7, 12, 10, 30),
    items: [
      { feeId: fee(sofia.id, periods[0]), amount: dec(6000) },
      { feeId: fee(sofia.id, periods[1]), amount: dec(6000) },
      { feeId: fee(sofia.id, periods[2]), amount: dec(6000) },
      { feeId: matriculaFees.get(sofia.id)!, amount: dec(12000) },
    ],
    notes: 'Pago de cuotas y matrícula',
  });

  await createPayment({
    guardianId: maria.id,
    userId: tesorero.id,
    method: 'TRANSFERENCIA',
    date: new Date(2026, 8, 8, 15, 0),
    items: [
      { feeId: fee(mateo.id, periods[0]), amount: dec(6000) },
      { feeId: fee(mateo.id, periods[1]), amount: dec(6000) },
    ],
  });

  await createPayment({
    guardianId: laura.id,
    userId: admin.id,
    method: 'MERCADO_PAGO',
    date: new Date(2026, 8, 20, 9, 15),
    items: [
      { feeId: fee(valentina.id, periods[0]), amount: dec(6000) },
      { feeId: fee(valentina.id, periods[1]), amount: dec(3000) },
    ],
    notes: 'Pago parcial de la cuota de septiembre',
  });

  await createPayment({
    guardianId: diego.id,
    userId: tesorero.id,
    method: 'EFECTIVO',
    date: new Date(2026, 9, 5, 11, 45),
    items: [
      { feeId: fee(martina.id, periods[0]), amount: dec(6000) },
      { feeId: fee(martina.id, periods[1]), amount: dec(6000) },
    ],
  });

  await createPayment({
    guardianId: laura.id,
    userId: tesorero.id,
    method: 'TARJETA',
    date: new Date(2026, 9, 9, 17, 20),
    items: [{ feeId: fee(benjamin.id, periods[2]), amount: dec(3000) }],
    notes: 'Pago parcial de octubre',
  });

  console.log('Creando egresos...');
  await prisma.expense.createMany({
    data: [
      {
        date: new Date(2026, 8, 5),
        category: 'Limpieza',
        description: 'Insumos de limpieza para el salón',
        amount: dec(15000),
        method: 'EFECTIVO',
        createdById: tesorero.id,
      },
      {
        date: new Date(2026, 8, 18),
        category: 'Mantenimiento',
        description: 'Reparación de la bomba de agua',
        amount: dec(22000),
        method: 'TRANSFERENCIA',
        reference: 'TRF-8821',
        createdById: tesorero.id,
      },
      {
        date: new Date(2026, 9, 2),
        category: 'Materiales',
        description: 'Compra de materiales para el taller de arte',
        amount: dec(8500),
        method: 'EFECTIVO',
        createdById: tesorero.id,
      },
    ],
  });

  await prisma.cashSession.create({
    data: {
      openedAt: new Date(2026, 9, 30, 8, 0),
      closedAt: new Date(2026, 9, 30, 18, 0),
      openingAmount: dec(5000),
      expectedAmount: dec(14000),
      countedAmount: dec(14000),
      difference: dec(0),
      status: 'CERRADA',
      notes: 'Cierre de caja de ejemplo',
      openedById: tesorero.id,
      closedById: tesorero.id,
    },
  });

  const [userCount, studentCount, feeCount, paymentCount] = await Promise.all([
    prisma.user.count(),
    prisma.student.count(),
    prisma.fee.count(),
    prisma.payment.count(),
  ]);

  console.log('\nSeed completado:');
  console.log(`  Usuarios: ${userCount}`);
  console.log(`  Alumnos: ${studentCount}`);
  console.log(`  Cuotas: ${feeCount}`);
  console.log(`  Pagos: ${paymentCount}`);
  console.log('\nCredenciales:');
  console.log('  ADMIN    admin@cooperadora.edu / Admin1234');
  console.log('  TESORERO tesorero@cooperadora.edu / Tesorero1234');
  console.log('  CONSULTA consulta@cooperadora.edu / Consulta1234');
  console.log(`\nConceptos creados: ${[cuotaSocial, matricula, taller, viaje].map((c) => c.name).join(', ')}`);
  console.log(`  (consulta: ${consulta.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
