/**
 * Helper simples de validação de presença de campos obrigatórios.
 *
 * Mantemos a validação manual (sem bibliotecas como zod/joi) para deixar o
 * projeto de demonstração leve. Caso o projeto cresça, vale migrar para uma
 * lib de schema validation.
 */
export function validateRequiredFields(
  body: Record<string, unknown>,
  requiredFields: string[]
): string[] {
  const missing: string[] = [];

  for (const field of requiredFields) {
    const value = body[field];
    if (value === undefined || value === null || value === "") {
      missing.push(field);
    }
  }

  return missing;
}
