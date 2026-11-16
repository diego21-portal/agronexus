import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "../../lib/api";
import { deferred } from "../../test/asyncFixtures";
import type { ReturnRequest } from "../../types/return";
import { ReturnManagementPage } from "./ReturnManagementPage";

vi.mock("../../lib/api", () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());

const base: ReturnRequest = {
  id: 7, order_item_id: 51, order_number: "AGX-RETORNO", product_name: "Filtro recibido",
  reason: "DEFECTIVE_PRODUCT", description: "Las dos unidades presentan defectos.", quantity: 2,
  requested_refund_amount: "100.00", approved_refund_amount: "100.00", status: "APPROVED",
  created_at: "2026-11-15T10:00:00Z",
  inspection: {
    id: 12, expected_quantity: 2, received_quantity: 0, restocked_quantity: 0,
    defective_quantity: 0, quarantined_quantity: 0, received_at: null, inspected_at: null,
  },
};

async function mount(record: ReturnRequest, role: "admin" | "seller" = "seller") {
  vi.mocked(api.get).mockResolvedValue({ data: [record] });
  render(<ReturnManagementPage role={role} />);
  await userEvent.click(await screen.findByRole("button", { name: "Gestionar devolución de Filtro recibido" }));
  return within(screen.getByRole("region", { name: "Gestionar devolución" }));
}

test("recibe en cuarentena y clasifica defectuosos sin pedir reposición ni habilitar reembolso al vendedor", async () => {
  const received: ReturnRequest = { ...base, status: "PRODUCT_RECEIVED", inspection: { ...base.inspection!, received_quantity: 2, quarantined_quantity: 2 } };
  const inspected: ReturnRequest = { ...received, status: "INSPECTED", inspection: { ...received.inspection!, defective_quantity: 2, quarantined_quantity: 0 } };
  vi.mocked(api.post).mockResolvedValueOnce({ data: received }).mockResolvedValueOnce({ data: inspected });
  const editor = await mount(base);
  fireEvent.change(editor.getByLabelText("Total de unidades recibidas"), { target: { value: "2" } });
  await userEvent.click(editor.getByRole("button", { name: "Registrar recepción" }));
  expect(api.post).toHaveBeenNthCalledWith(1, "/seller/returns/7/receive/", { received_quantity: 2, note: "" });
  expect(await screen.findByRole("status")).toHaveTextContent("pendientes de inspección");
  expect(editor.queryByRole("button", { name: "Registrar reembolso simulado" })).not.toBeInTheDocument();
  fireEvent.change(editor.getByLabelText("Total de unidades defectuosas"), { target: { value: "2" } });
  await userEvent.type(editor.getByLabelText("Nota de inspección"), "Ambas unidades están rotas y no son aptas para venta.");
  await userEvent.click(editor.getByRole("button", { name: "Registrar inspección" }));
  expect(api.post).toHaveBeenNthCalledWith(2, "/seller/returns/7/inspect/", { restocked_quantity: 0, defective_quantity: 2, note: "Ambas unidades están rotas y no son aptas para venta." });
  expect(await editor.findByText("La decisión y el reembolso corresponden a administración.")).toBeVisible();
  expect(api.patch).not.toHaveBeenCalled();
});

test("una revisión apta conserva la clasificación defectuosa previa", async () => {
  const record: ReturnRequest = { ...base, status: "PRODUCT_RECEIVED", inspection: { ...base.inspection!, received_quantity: 2, defective_quantity: 1, quarantined_quantity: 1 } };
  vi.mocked(api.post).mockResolvedValue({ data: { ...record, status: "INSPECTED" } });
  const editor = await mount(record);
  fireEvent.change(editor.getByLabelText("Total de unidades aptas para venta"), { target: { value: "1" } });
  await userEvent.type(editor.getByLabelText("Nota de inspección"), "Una unidad sellada está apta para venta.");
  await userEvent.click(editor.getByRole("button", { name: "Registrar inspección" }));
  expect(api.post).toHaveBeenCalledWith("/seller/returns/7/inspect/", { restocked_quantity: 1, defective_quantity: 1, note: "Una unidad sellada está apta para venta." });
});

test("rechaza cantidades excesivas incluso si se omite la validación nativa", async () => {
  const editor = await mount(base);
  fireEvent.change(editor.getByLabelText("Total de unidades recibidas"), { target: { value: "3" } });
  fireEvent.submit(editor.getByRole("form", { name: "Registrar recepción" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("total esperado");
  expect(api.post).not.toHaveBeenCalled();
});

test("bloquea la gestión y evita repetir una recepción mientras guarda", async () => {
  const pending = deferred<{ data: ReturnRequest }>();
  vi.mocked(api.post).mockReturnValueOnce(pending.promise);
  const editor = await mount(base);
  fireEvent.change(editor.getByLabelText("Total de unidades recibidas"), { target: { value: "2" } });
  await userEvent.dblClick(editor.getByRole("button", { name: "Registrar recepción" }));
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(editor.getByLabelText("Total de unidades recibidas")).toBeDisabled();
  expect(editor.getByRole("button", { name: "Cerrar gestión" })).toBeDisabled();
  pending.resolve({ data: { ...base, status: "PRODUCT_RECEIVED" } });
  await screen.findByRole("status");
});

test("administración usa IN_REVIEW sin ofrecer saltos a recibido o reembolsado", async () => {
  const requested: ReturnRequest = { ...base, status: "REQUESTED", inspection: null, allowed_statuses: ["IN_REVIEW", "APPROVED", "REJECTED"] };
  vi.mocked(api.patch).mockResolvedValue({ data: { ...requested, status: "IN_REVIEW" } });
  const editor = await mount(requested, "admin");
  expect(editor.queryByRole("combobox")).not.toBeInTheDocument();
  expect(editor.queryByRole("button", { name: "Registrar recepción" })).not.toBeInTheDocument();
  expect(editor.queryByRole("button", { name: "Registrar reembolso simulado" })).not.toBeInTheDocument();
  await userEvent.click(editor.getByRole("button", { name: "Pasar a revisión" }));
  expect(api.patch).toHaveBeenCalledWith("/admin/returns/7/status/", { status: "IN_REVIEW", resolution: "" });
});

test("el reembolso respeta el máximo y utiliza la operación financiera del servidor", async () => {
  const inspected: ReturnRequest = { ...base, status: "INSPECTED", allowed_statuses: ["REFUNDED"] };
  vi.mocked(api.patch).mockResolvedValue({ data: { ...inspected, status: "REFUNDED", allowed_statuses: ["CLOSED"] } });
  const editor = await mount(inspected, "admin");
  fireEvent.change(editor.getByLabelText("Reembolso aprobado"), { target: { value: "100.01" } });
  await userEvent.click(editor.getByRole("button", { name: "Registrar reembolso simulado" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("importe solicitado");
  expect(api.patch).not.toHaveBeenCalled();
  fireEvent.change(editor.getByLabelText("Reembolso aprobado"), { target: { value: "100.00" } });
  await userEvent.click(editor.getByRole("button", { name: "Registrar reembolso simulado" }));
  expect(api.patch).toHaveBeenCalledWith("/admin/returns/7/status/", { status: "REFUNDED", approved_refund_amount: "100.00", resolution: "" });
  expect(await screen.findByRole("status")).toHaveTextContent("Reembolso simulado registrado");
});

test("un aprobado histórico requiere registrar explícitamente su recepción", async () => {
  const editor = await mount({ ...base, inspection: null });
  expect(editor.getByLabelText("Total de unidades recibidas")).toHaveValue(0);
  expect(editor.getByLabelText("Total de unidades recibidas")).toHaveAttribute("max", "2");
  expect(editor.queryByRole("form", { name: "Registrar inspección" })).not.toBeInTheDocument();
});

test("una solicitud cerrada permanece de consulta", async () => {
  const editor = await mount({ ...base, status: "CLOSED", allowed_statuses: [] }, "admin");
  expect(editor.queryByRole("form")).not.toBeInTheDocument();
  expect(editor.queryByRole("button", { name: "Registrar reembolso simulado" })).not.toBeInTheDocument();
  expect(editor.getByText("La recepción y la inspección de esta solicitud ya no se pueden modificar.")).toBeVisible();
});
