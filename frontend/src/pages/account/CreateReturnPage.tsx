import {
  useState,
  type FormEvent,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router";
import { createReturn } from "../../services/returnService";
import { getApiErrorMessage } from "../../utils/apiError";

export function CreateReturnPage() {
  const { orderId, itemId } =
    useParams<{
      orderId: string;
      itemId: string;
    }>();

  const navigate = useNavigate();

  const [reason, setReason] =
    useState("DEFECTIVE_PRODUCT");

  const [description, setDescription] =
    useState("");

  const [quantity, setQuantity] =
    useState(1);

  const [sending, setSending] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setSending(true);

      await createReturn(
        Number(itemId),
        {
          reason,
          description,
          quantity,
        }
      );

      navigate(
        "/account/returns"
      );
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo solicitar la devolución."
        )
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <Link
        to={`/account/orders/${orderId}`}
        className="text-sm font-medium text-green-700"
      >
        ← Volver a la orden
      </Link>

      <h2 className="mt-4 text-2xl font-bold">
        Solicitar devolución
      </h2>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4"
      >
        <select
          value={reason}
          onChange={(event) =>
            setReason(
              event.target.value
            )
          }
          className="w-full rounded-lg border px-3 py-2"
        >
          <option value="DEFECTIVE_PRODUCT">
            Producto defectuoso
          </option>

          <option value="WRONG_PRODUCT">
            Producto incorrecto
          </option>

          <option value="DAMAGED_PRODUCT">
            Producto dañado
          </option>

          <option value="NOT_AS_DESCRIBED">
            No coincide con la descripción
          </option>

          <option value="OTHER">
            Otro
          </option>
        </select>

        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(event) =>
            setQuantity(
              Number(
                event.target.value
              )
            )
          }
          className="w-full rounded-lg border px-3 py-2"
        />

        <textarea
          required
          rows={6}
          placeholder="Explicá el motivo..."
          value={description}
          onChange={(event) =>
            setDescription(
              event.target.value
            )
          }
          className="w-full rounded-lg border px-3 py-2"
        />

        <button
          disabled={sending}
          className="rounded-lg bg-red-700 px-5 py-3 font-medium text-white"
        >
          {sending
            ? "Enviando..."
            : "Solicitar devolución"}
        </button>
      </form>
    </section>
  );
}