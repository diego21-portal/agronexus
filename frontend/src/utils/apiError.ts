import axios from "axios";

export function getApiErrorMessage(
  error: unknown,
  fallbackMessage = "Ocurrió un error inesperado."
): string {
  if (!axios.isAxiosError(error)) {
    return fallbackMessage;
  }

  const data = error.response?.data;

  if (!data) {
    if (error.code === "ERR_NETWORK") {
      return "No se pudo conectar con el servidor.";
    }

    return fallbackMessage;
  }

  if (typeof data === "string") {
    return data;
  }

  if (
    typeof data === "object" &&
    data !== null
  ) {
    const errorData = data as Record<string, unknown>;

    if (typeof errorData.detail === "string") {
      return errorData.detail;
    }

    if (typeof errorData.message === "string") {
      return errorData.message;
    }

    const nonFieldErrors =
      errorData.non_field_errors;

    if (
      Array.isArray(nonFieldErrors) &&
      nonFieldErrors.length > 0
    ) {
      return String(nonFieldErrors[0]);
    }

    const firstField = Object.keys(errorData)[0];

    if (firstField) {
      const firstError = errorData[firstField];

      if (
        Array.isArray(firstError) &&
        firstError.length > 0
      ) {
        return `${firstField}: ${String(firstError[0])}`;
      }

      if (typeof firstError === "string") {
        return `${firstField}: ${firstError}`;
      }
    }
  }

  return fallbackMessage;
}