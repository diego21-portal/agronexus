import { AxiosError, AxiosHeaders } from "axios";
import { expect, test } from "vitest";
import { getApiErrorMessage } from "./apiError";

function apiError(status: number, data: unknown, contentType?: string) {
  const headers = contentType ? { "Content-Type": contentType } : {};
  return new AxiosError("Request failed", undefined, undefined, undefined, {
    status, data, statusText: "", headers, config: { headers: new AxiosHeaders() },
  });
}

test.each([
  [503, "<!doctype html><h1>Service Unavailable</h1>", "text/html; charset=utf-8"],
  [403, "Acceso temporalmente suspendido", "application/xhtml+xml"],
  [400, "   <html><title>Bad request</title></html>"],
  [502, "Bad Gateway", "text/plain"],
])("ante un cuerpo de proxy %s muestra el mensaje contextual", (status, body, type?) => {
  expect(getApiErrorMessage(apiError(status, body, type), "Reintenta cargar el listado.")).toBe("Reintenta cargar el listado.");
});

test("conserva el detalle JSON y las validaciones por campo", () => {
  expect(getApiErrorMessage(apiError(409, { detail: "El precio cambió." }))).toBe("El precio cambió.");
  expect(getApiErrorMessage(apiError(400, { email: ["Formato inválido."] }))).toBe("email: Formato inválido.");
  expect(getApiErrorMessage(apiError(400, " Solicitud incompleta. ", "text/plain"))).toBe("Solicitud incompleta.");
});
