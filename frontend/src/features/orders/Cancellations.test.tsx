import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { actOnCancellation, getCancellations, requestShipmentCancellation, withdrawCancellation } from "../../services/cancellationService";
import type { CancellationRequest } from "../../types/cancellation";
import type { Shipment } from "../../types/order";
import { deferred } from "../../test/asyncFixtures";
import { CancellationManagementPage } from "./CancellationManagementPage";
import { ShipmentSummary } from "./ShipmentSummary";
import { OrderAmounts } from "./OrderAmounts";

vi.mock("../../services/cancellationService", () => ({
  requestShipmentCancellation: vi.fn(), getCancellations: vi.fn(),
  actOnCancellation: vi.fn(), withdrawCancellation: vi.fn(),
}));
beforeEach(() => vi.resetAllMocks());

const request: CancellationRequest = {
  id: 7, shipment: 11, order_id: 1, order_number: "AGX-001", seller: 3,
  seller_name: "Repuestos Mendoza", status: "REQUESTED", reason: "Ya no necesito los productos de este envío.",
  resolution: "", is_pre_dispatch: false, refunded_amount: "0.00",
  created_at: "2026-11-15T12:00:00Z", updated_at: "2026-11-15T12:00:00Z",
  inspections: [{ id: 91, order_item: 51, product_name: "Filtro hidráulico", expected_quantity: 2,
    received_quantity: 0, restocked_quantity: 0, defective_quantity: 0, quarantined_quantity: 0,
    received_at: null, inspected_at: null }],
};
const shipment: Shipment = {
  id: 11, seller: 3, seller_name: "Repuestos Mendoza", status: "IN_TRANSIT",
  seller_subtotal: "200.00", can_request_cancellation: true,
};
const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

test("una solicitud retirada permite iniciar otra sobre el mismo envío", async () => {
  vi.mocked(requestShipmentCancellation).mockResolvedValue({ ...request, id: 8 });
  render(<ShipmentSummary allowCancellation shipments={[{ ...shipment,
    cancellation: { ...request, status: "WITHDRAWN" }, can_request_cancellation: true,
  }]} />, { wrapper });
  expect(screen.getByText(/Solicitud anterior: Solicitud retirada/)).toBeVisible();
  await userEvent.setup().click(screen.getByRole("button", { name: "Solicitar cancelación de este envío" }));
  expect(screen.getByLabelText("Motivo de cancelación")).toBeEnabled();
  await userEvent.setup().type(screen.getByLabelText("Motivo de cancelación"), request.reason);
  await userEvent.setup().click(screen.getByRole("button", { name: "Confirmar solicitud" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Cancelación solicitada");
});

test("los importes advierten cuando el historial anterior necesita conciliación", () => {
  render(<OrderAmounts original="200.00" refunded="0.00" net="200.00" reviewRequired />);
  expect(screen.getByRole("status")).toHaveTextContent("Revisión de reembolsos históricos pendiente");
});

test("solicitar en tránsito conserva el seguimiento físico y afecta solo al vendedor seleccionado", async () => {
  const user = userEvent.setup();
  vi.mocked(requestShipmentCancellation).mockResolvedValue(request);
  render(<ShipmentSummary allowCancellation shipments={[shipment, { ...shipment, id: 12, seller: 4, seller_name: "Bombas Córdoba" }]} />, { wrapper });
  const selected = within(screen.getByRole("article", { name: "Envío de Repuestos Mendoza" }));
  const other = within(screen.getByRole("article", { name: "Envío de Bombas Córdoba" }));

  await user.click(selected.getByRole("button", { name: "Solicitar cancelación de este envío" }));
  expect(selected.getByText(/El paquete ya fue despachado/)).toBeVisible();
  await user.type(selected.getByLabelText("Motivo de cancelación"), request.reason);
  await user.click(selected.getByRole("button", { name: "Confirmar solicitud" }));

  expect(await selected.findByRole("status")).toHaveTextContent("Cancelación solicitada");
  expect(selected.getByText("En tránsito")).toBeVisible();
  expect(selected.queryByText("Cancelado")).not.toBeInTheDocument();
  expect(other.getByRole("button", { name: "Solicitar cancelación de este envío" })).toBeEnabled();
  expect(requestShipmentCancellation).toHaveBeenCalledExactlyOnceWith(11, request.reason);
});

test("antes del despacho presenta la cancelación completada y actualiza la información del pedido", async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  vi.mocked(requestShipmentCancellation).mockResolvedValue({ ...request, status: "COMPLETED", is_pre_dispatch: true, refunded_amount: "200.00" });
  render(<ShipmentSummary allowCancellation onCancellationChange={changed} shipments={[{ ...shipment, status: "PREPARING" }]} />, { wrapper });
  await user.click(screen.getByRole("button", { name: "Cancelar productos de este vendedor" }));
  expect(screen.getByText(/Al confirmar se cancelarán estos productos/)).toBeVisible();
  await user.type(screen.getByLabelText("Motivo de cancelación"), request.reason);
  await user.click(screen.getByRole("button", { name: "Confirmar solicitud" }));

  expect(await screen.findByRole("status")).toHaveTextContent("Cancelación completada");
  expect(screen.getByText("Cancelado")).toBeVisible();
  expect(changed).toHaveBeenCalledOnce();
});

test("bloquea doble envío mientras espera y conserva el motivo si falla la solicitud", async () => {
  const user = userEvent.setup();
  const pending = deferred<CancellationRequest>();
  vi.mocked(requestShipmentCancellation).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(request);
  render(<ShipmentSummary allowCancellation shipments={[shipment]} />, { wrapper });
  await user.click(screen.getByRole("button", { name: "Solicitar cancelación de este envío" }));
  await user.type(screen.getByLabelText("Motivo de cancelación"), request.reason);
  await user.dblClick(screen.getByRole("button", { name: "Confirmar solicitud" }));
  expect(screen.getByLabelText("Motivo de cancelación")).toBeDisabled();
  expect(requestShipmentCancellation).toHaveBeenCalledOnce();
  await act(async () => { pending.reject(new Error("Sin conexión")); });
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo solicitar la cancelación.");
  expect(screen.getByLabelText("Motivo de cancelación")).toHaveValue(request.reason);
  await user.click(screen.getByRole("button", { name: "Confirmar solicitud" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Cancelación solicitada");
});

test("descarta la solicitud que termina después de abandonar el envío", async () => {
  const user = userEvent.setup();
  const pending = deferred<CancellationRequest>();
  const changed = vi.fn();
  vi.mocked(requestShipmentCancellation).mockReturnValue(pending.promise);
  const view = render(<ShipmentSummary allowCancellation onCancellationChange={changed} shipments={[shipment]} />, { wrapper });
  await user.click(screen.getByRole("button", { name: "Solicitar cancelación de este envío" }));
  await user.type(screen.getByLabelText("Motivo de cancelación"), request.reason);
  await user.click(screen.getByRole("button", { name: "Confirmar solicitud" }));
  view.rerender(<ShipmentSummary allowCancellation onCancellationChange={changed} shipments={[{ ...shipment, id: 12, seller_name: "Bombas Córdoba" }]} />);
  await act(async () => { pending.resolve(request); });
  expect(changed).not.toHaveBeenCalled();
  expect(screen.queryByText("Cancelación solicitada")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Solicitar cancelación de este envío" })).toBeEnabled();
});

test("el comprador retira una solicitud pendiente y no dispone de acciones de recepción o reembolso", async () => {
  const user = userEvent.setup();
  vi.mocked(getCancellations).mockResolvedValue([request]);
  vi.mocked(withdrawCancellation).mockResolvedValue({ ...request, status: "WITHDRAWN" });
  render(<CancellationManagementPage role="customer" />, { wrapper });
  await user.click(await screen.findByRole("button", { name: "Retirar solicitud" }));

  expect(await screen.findByText("Solicitud retirada")).toBeVisible();
  expect(withdrawCancellation).toHaveBeenCalledExactlyOnceWith(7);
  expect(screen.queryByRole("button", { name: /Confirmar retorno|Registrar recepción|reembolso/ })).not.toBeInTheDocument();
});

test("el vendedor recibe e inspecciona defectuosos sin ofrecer reposición automática ni reembolso", async () => {
  const user = userEvent.setup();
  const returning = { ...request, status: "RETURNING" as const };
  const received = { ...request, status: "RECEIVED" as const, inspections: [{ ...request.inspections[0], received_quantity: 2, quarantined_quantity: 2 }] };
  const inspected = { ...request, status: "INSPECTED" as const, inspections: [{ ...request.inspections[0], received_quantity: 2, defective_quantity: 2 }] };
  vi.mocked(getCancellations).mockResolvedValue([request]);
  vi.mocked(actOnCancellation).mockResolvedValueOnce(returning).mockResolvedValueOnce(received).mockResolvedValueOnce(inspected);
  render(<CancellationManagementPage role="seller" />, { wrapper });

  await user.click(await screen.findByRole("button", { name: "Confirmar retorno en camino" }));
  await user.clear(await screen.findByLabelText("Recibidas de Filtro hidráulico"));
  await user.type(screen.getByLabelText("Recibidas de Filtro hidráulico"), "2");
  await user.click(screen.getByRole("button", { name: "Registrar recepción" }));
  expect(await screen.findByText(/Pendientes de revisión: 2/)).toBeVisible();
  await user.clear(await screen.findByLabelText("Defectuosas de Filtro hidráulico"));
  await user.type(screen.getByLabelText("Defectuosas de Filtro hidráulico"), "2");
  await user.type(screen.getByLabelText("Resultado de la revisión"), "Ambas unidades presentan roturas y no son aptas para venta.");
  await user.click(screen.getByRole("button", { name: "Guardar inspección" }));

  expect(await screen.findByText("Inspección completada. Administración debe registrar el reembolso.")).toBeVisible();
  expect(actOnCancellation).toHaveBeenNthCalledWith(2, "seller", 7, { action: "receive", items: [{ order_item: 51, received_quantity: 2 }] });
  expect(actOnCancellation).toHaveBeenNthCalledWith(3, "seller", 7, {
    action: "inspect", items: [{ order_item: 51, restocked_quantity: 0, defective_quantity: 2 }],
    resolution: "Ambas unidades presentan roturas y no son aptas para venta.",
  });
  expect(screen.queryByRole("button", { name: "Completar cancelación y registrar reembolso" })).not.toBeInTheDocument();
});

test("administración completa el reembolso después de la inspección", async () => {
  const user = userEvent.setup();
  vi.mocked(getCancellations).mockResolvedValue([{ ...request, status: "INSPECTED" }]);
  vi.mocked(actOnCancellation).mockResolvedValue({ ...request, status: "COMPLETED", refunded_amount: "200.00" });
  render(<CancellationManagementPage role="admin" />, { wrapper });
  await user.click(await screen.findByRole("button", { name: "Completar cancelación y registrar reembolso" }));
  expect(await screen.findByText("Cancelación completada")).toBeVisible();
  expect(actOnCancellation).toHaveBeenCalledExactlyOnceWith("admin", 7, { action: "complete", resolution: "" });
  expect(screen.queryByRole("button", { name: "Completar cancelación y registrar reembolso" })).not.toBeInTheDocument();
});

test("reintentar el reembolso de envío conserva la clave de operación para evitar duplicaciones", async () => {
  const user = userEvent.setup();
  vi.mocked(getCancellations).mockResolvedValue([{ ...request, status: "COMPLETED", shipping_refundable_amount: "50.00" }]);
  vi.mocked(actOnCancellation).mockRejectedValueOnce(new Error("Respuesta perdida")).mockResolvedValueOnce({ ...request, status: "COMPLETED", refunded_amount: "250.00", shipping_refundable_amount: "0.00" });
  render(<CancellationManagementPage role="admin" />, { wrapper });
  await user.type(await screen.findByLabelText("Importe de envío a reembolsar"), "50");
  await user.type(screen.getByLabelText("Motivo del reembolso de envío"), "La devolución completa del envío fue autorizada.");
  await user.click(screen.getByRole("button", { name: "Registrar reembolso de envío" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar la operación.");
  await user.click(screen.getByRole("button", { name: "Registrar reembolso de envío" }));
  await screen.findByText("La operación quedó registrada.");
  const first = vi.mocked(actOnCancellation).mock.calls[0][2];
  const second = vi.mocked(actOnCancellation).mock.calls[1][2];
  expect(first.operation_key).toBeTruthy();
  expect(second).toEqual(first);
  expect(second.amount).toBe("50");
});
