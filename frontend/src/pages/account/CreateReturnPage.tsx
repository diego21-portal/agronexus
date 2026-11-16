import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { createReturn } from "../../services/returnService";
import { getOrderById } from "../../services/orderService";
import { returnReasonLabels, type ReturnReason } from "../../types/return";
import type { OrderItem } from "../../types/order";
import { getApiErrorMessage } from "../../utils/apiError";

export function CreateReturnPage() {
  const { orderId, itemId } = useParams<{ orderId: string; itemId: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<OrderItem | null>(null);
  const [reason, setReason] = useState<ReturnReason>("DEFECTIVE_PRODUCT");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    const current = ++generation.current;
    setItem(null);
    setReason("DEFECTIVE_PRODUCT");
    setDescription("");
    setQuantity(1);
    setError("");
    setLoading(true);
    setSending(false);
    busy.current = false;
    async function loadItem() {
      const orderNumber = Number(orderId);
      const itemNumber = Number(itemId);
      if (![orderNumber, itemNumber].every((value) => Number.isSafeInteger(value) && value > 0)) {
        setError("La compra seleccionada no es válida.");
        setLoading(false);
        return;
      }
      try {
        const order = await getOrderById(orderNumber);
        if (current !== generation.current) return;
        const selectedItem = order.items?.find((product) => product.id === itemNumber);
        if (order.id !== orderNumber || !selectedItem) throw new Error("Producto no encontrado en la compra.");
        setItem(selectedItem);
      } catch (requestError) {
        if (current === generation.current) setError(getApiErrorMessage(requestError, "No se pudo cargar el producto de tu compra."));
      } finally {
        if (current === generation.current) setLoading(false);
      }
    }
    void loadItem();
    return () => { generation.current += 1; };
  }, [orderId, itemId]);

  const canReturn = item && (item.can_request_return ?? item.is_delivered);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !item || !canReturn) return;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > item.quantity) {
      setError("La cantidad debe ser entera y no superar las unidades compradas.");
      return;
    }
    if (description.trim().length < 10) {
      setError("Explicá el motivo con al menos 10 caracteres.");
      return;
    }
    const current = generation.current;
    try {
      busy.current = true;
      setSending(true);
      setError("");
      await createReturn(item.id, { reason, description: description.trim(), quantity });
      if (current === generation.current) navigate("/account/returns");
    } catch (requestError) {
      if (current === generation.current) setError(getApiErrorMessage(requestError, "No se pudo solicitar la devolución."));
    } finally {
      if (current === generation.current) {
        busy.current = false;
        setSending(false);
      }
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <Link to={`/account/orders/${orderId}`} className="text-sm font-medium text-green-700">← Volver a la orden</Link>
      <h2 className="mt-4 text-2xl font-bold">Solicitar devolución</h2>
      {loading && <p className="mt-5">Cargando el producto de tu compra...</p>}
      {error && <div role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>}
      {!loading && item && !canReturn && <p className="mt-5 rounded-lg bg-gray-50 p-4">Este producto no está habilitado para una nueva solicitud de devolución. Revisá su entrega y tus solicitudes existentes.</p>}
      {!loading && item && canReturn && (
        <form aria-label="Solicitar devolución de compra" onSubmit={handleSubmit} className="mt-6 space-y-4">
          <p className="rounded-xl bg-gray-50 p-4"><strong>{item.product_name}</strong><br />Compraste {item.quantity} {item.quantity === 1 ? "unidad" : "unidades"}.</p>
          <fieldset disabled={sending} className="space-y-4">
            <label className="block">Motivo
              <select aria-label="Motivo" value={reason} onChange={(event) => setReason(event.target.value as ReturnReason)} className="mt-1 w-full rounded-lg border px-3 py-2">
                {Object.entries(returnReasonLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block">Unidades a devolver
              <input aria-label="Unidades a devolver" type="number" required min={1} max={item.quantity} step={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-1 w-full rounded-lg border px-3 py-2" />
            </label>
            <label className="block">Descripción del problema
              <textarea aria-label="Descripción del problema" required minLength={10} rows={6} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
            </label>
            <p className="text-sm text-gray-600">La solicitud será revisada. Recibir un producto o aprobar su devolución no lo agrega al stock disponible.</p>
            <button disabled={sending} className="rounded-lg bg-red-700 px-5 py-3 font-medium text-white disabled:opacity-50">{sending ? "Enviando..." : "Solicitar devolución"}</button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
