import type { ZodError } from "zod";

export function getFirstZodError(
  error: ZodError
): string {
  return (
    error.issues[0]
      ?.message ||
    "Revisá los datos ingresados."
  );
}