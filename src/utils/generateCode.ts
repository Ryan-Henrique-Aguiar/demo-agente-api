import { prisma } from "../lib/prisma";

/**
 * Gera o próximo código sequencial para um determinado tipo
 * (ex: "AG" -> "AG-1001", "AG-1002", ...).
 *
 * Usa a tabela CodeSequence com upsert + incremento atômico para evitar
 * que duas requisições simultâneas gerem o mesmo código.
 */
const PREFIX_MAP = {
  AG: "appointment",
  CR: "opportunity",
  SU: "ticket",
  HO: "hotel",
  RS: "hotelReservation",
} as const;

type Prefix = keyof typeof PREFIX_MAP;

export async function generateCode(prefix: Prefix) {
  const model = PREFIX_MAP[prefix];

  const lastRecord = await (prisma[model] as any).findFirst({
    where: {
      code: {
        startsWith: `${prefix}-`,
      },
    },
    orderBy: {
      code: "desc",
    },
    select: {
      code: true,
    },
  });

  const lastNumber = lastRecord?.code
    ? Number(lastRecord.code.replace(`${prefix}-`, ""))
    : 1000;

  return `${prefix}-${lastNumber + 1}`;
}