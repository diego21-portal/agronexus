import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router";
import { createComplaint } from "../../services/complaintService";
import { getOrderById } from "../../services/orderService";
import type { Order } from "../../types/order";
import { getApiErrorMessage } from "../../utils/apiError";

export function CreateComplaintPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);

  const [form, setForm] = useState({
    complaint_type: "PRODUCT_PROBLEM",
    title: "",
    description: "",
    order_item_id: "",
  });

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const id = Number(orderId);

      if (!Number.isInteger(id) || id <= 0) {
        setError("La orden no es válida.");
        setLoading(false);
        return;
      }

      try {
        const data = await getOrderById(id);
        setOrder(data);
      } catch {
        setError("No se pudo cargar la orden.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [orderId]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const id = Number(orderId);

    if (!Number.isInteger(id) || id <= 0) {
      setError("La orden no es válida.");
      return;
    }

    try {
      setSending(true);
      setError("");

      await createComplaint(id, {
        complaint_type: form.complaint_type,
        title: form.title,
        description: form.description,

        ...(form.order_item_id
          ? {
              order_item_id: Number(form.order_item_id),
            }
          : {}),
      });

      navigate("/account/complaints");
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo crear el reclamo."
        )
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        Cargando orden...
      </div>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <Link
        to={`/account/orders/${orderId}`}
        className="text-sm font-medium text-green-700"
      >
        ← Volver
      </Link>

      <h2 className="mt-4 text-2xl font-bold">
        Crear reclamo
      </h2>

      <p className="mt-2 text-gray-600">
        Informá un problema relacionado con tu pedido.
      </p>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">
            Tipo de reclamo
          </label>

          <select
            value={form.complaint_type}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                complaint_type: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="PRODUCT_PROBLEM">
              Problema con producto
            </option>

            <option value="SHIPPING_PROBLEM">
              Problema de envío
            </option>

            <option value="PAYMENT_PROBLEM">
              Problema de pago
            </option>

            <option value="OTHER">
              Otro
            </option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Producto relacionado
          </label>

          <select
            value={form.order_item_id}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                order_item_id: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">
              Reclamo general de la orden
            </option>

            {(order?.items ?? []).map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.product_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Título
          </label>

          <input
            required
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            placeholder="Ej: El producto llegó dañado"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Descripción
          </label>

          <textarea
            required
            rows={6}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="Explicá qué ocurrió..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        <button
          disabled={sending}
          className="rounded-lg bg-red-700 px-5 py-3 font-medium text-white hover:bg-red-800 disabled:opacity-50"
        >
          {sending
            ? "Enviando..."
            : "Enviar reclamo"}
        </button>
      </form>
    </section>
  );
}