/**
 * Helper simples de validação de presença de campos obrigatórios.
 *
 * Mantemos a validação manual (sem bibliotecas como zod/joi) para deixar o
 * projeto de demonstração leve. Caso o projeto cresça, vale migrar para uma
 * lib de schema validation.
 */
export function validateRequiredFields(body: Record<string, unknown>, fields: string[]) {
  const missing = fields.filter((field) => {
    const value = body[field];

    return (
      value === undefined ||
      value === null ||
      value === ''
    );
  });

  if (missing.length === 0) {
    return null;
  }

  return missing.map((field) => `Campo obrigatório ausente: ${field}`);
}
