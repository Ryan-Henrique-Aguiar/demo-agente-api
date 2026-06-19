import { prisma } from "../lib/prisma";

/**
 * Gera o próximo código sequencial para um determinado prefixo
 * (ex: "AGD" -> "AGD-1001", "AGD-1002", ...).
 *
 * Usa a tabela CodeSequence com upsert + incremento atômico para evitar
 * que duas requisições simultâneas gerem o mesmo código.
 */
export async function generateCode(prefix: "AGD" | "CRM" | "SUP"): Promise<string> {
  const sequence = await prisma.codeSequence.upsert({
    where: { id: prefix },
    create: { id: prefix, lastValue: 1001 },
    update: { lastValue: { increment: 1 } },
  });

  return `${prefix}-${sequence.lastValue}`;
}
