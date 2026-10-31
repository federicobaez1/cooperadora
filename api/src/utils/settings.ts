import { prisma } from '../config/prisma';

export const getSettings = async (): Promise<Record<string, string>> => {
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
};

export const getSetting = async (key: string, fallback = ''): Promise<string> => {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? fallback;
};

export const upsertSettings = async (values: Record<string, string>): Promise<void> => {
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    ),
  );
};
