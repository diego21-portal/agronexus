import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router";
import { useCart } from "../features/cart/CartContext";
import {
  createAddress,
  getAddresses,
} from "../services/addressService";
import { performCheckout } from "../services/checkoutService";
import { getRegions } from "../services/productService";
import type {
  Address,
  CreateAddressRequest,
} from "../types/address";
import type { PaymentMethod } from "../types/checkout";
import type { Region } from "../types/product";
import { getApiErrorMessage } from "../utils/apiError";
import {
  getCartItemAvailableStock,
  getCartItemProductName,
  getCartItemSubtotal,
} from "../utils/cart";
import { formatCurrency } from "../utils/currency";

const paymentOptions: Array<{
  value: PaymentMethod;
  label: string;
  description: string;
}> = [
  {
    value: "SIMULATED_CARD",
    label: "Tarjeta simulada",
    description:
      "El pago se aprueba automáticamente para demostrar el flujo.",
  },
  {
    value: "BANK_TRANSFER",
    label: "Transferencia simulada",
    description:
      "La orden puede quedar pendiente hasta confirmar el pago.",
  },
  {
    value: "CASH_ON_DELIVERY",
    label: "Pago contra entrega",
    description:
      "El pago se registra cuando se entrega el pedido.",
  },
];

const emptyAddressForm: CreateAddressRequest = {
  region: 0,
  street: "",
  number: "",
  city: "",
  province: "Mendoza",
  postal_code: "",
  reference: "",
  is_default: false,
};

export function CheckoutPage() {
  const navigate = useNavigate();

  const {
    cart,
    subtotal,
    loading: cartLoading,
    refreshCart,
  } = useCart();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);

  const [selectedAddressId, setSelectedAddressId] =
    useState<number | null>(null);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("SIMULATED_CARD");

  const [showAddressForm, setShowAddressForm] =
    useState(false);

  const [addressForm, setAddressForm] =
    useState<CreateAddressRequest>(emptyAddressForm);

  const [loading, setLoading] = useState(true);
  const [savingAddress, setSavingAddress] =
    useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadCheckoutData(): Promise<void> {
    try {
      setLoading(true);
      setError("");

      const [addressData, regionData] =
        await Promise.all([
          getAddresses(),
          getRegions(),
        ]);

      setAddresses(addressData);
      setRegions(regionData);

      const defaultAddress =
        addressData.find((address) => address.is_default) ||
        addressData[0];

      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
      }

      if (regionData.length > 0) {
        setAddressForm((current) => ({
          ...current,
          region: current.region || regionData[0].id,
        }));
      }
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudieron cargar las direcciones."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAddress(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    if (
      !addressForm.region ||
      !addressForm.street.trim() ||
      !addressForm.number.trim() ||
      !addressForm.city.trim() ||
      !addressForm.postal_code.trim()
    ) {
      setError(
        "Completá todos los campos obligatorios de la dirección."
      );
      return;
    }

    try {
      setSavingAddress(true);
      setError("");
      setMessage("");

      const createdAddress =
        await createAddress(addressForm);

      setAddresses((current) => [
        ...current,
        createdAddress,
      ]);

      setSelectedAddressId(createdAddress.id);
      setShowAddressForm(false);
      setAddressForm({
        ...emptyAddressForm,
        region: regions[0]?.id || 0,
      });

      setMessage("Dirección creada correctamente.");
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo crear la dirección."
        )
      );
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleCheckout(): Promise<void> {
    if (!selectedAddressId) {
      setError("Seleccioná una dirección de entrega.");
      return;
    }

    if (!cart || cart.items.length === 0) {
      setError("El carrito está vacío.");
      return;
    }

    const invalidStockItem = cart.items.find((item) => {
      const stock = getCartItemAvailableStock(item);

      return stock !== null && item.quantity > stock;
    });

    if (invalidStockItem) {
      setError(
        `No hay stock suficiente para ${getCartItemProductName(
          invalidStockItem
        )}.`
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      const checkoutResult = await performCheckout({
        shipping_address_id: selectedAddressId,
        payment_method: paymentMethod,
      });

      await refreshCart();

      navigate(
        `/orders/${checkoutResult.order.id}/confirmation`,
        {
          replace: true,
          state: {
            order: checkoutResult.order,
          },
        }
      );
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo confirmar la compra. El servidor no realizó ningún cobro."
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    void loadCheckoutData();
  }, []);

  if (loading || cartLoading) {
    return (
      <div className="rounded-2xl bg-white p-10 shadow-sm">
        Preparando checkout...
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <h1 className="text-2xl font-bold">
          No hay productos para comprar
        </h1>

        <Link
          to="/products"
          className="mt-5 inline-block rounded-lg bg-green-700 px-5 py-3 text-white"
        >
          Volver al catálogo
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
          Último paso
        </p>

        <h1 className="text-3xl font-bold">
          Confirmar compra
        </h1>

        <p className="mt-2 text-gray-600">
          Seleccioná la dirección y el método de pago.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-5 rounded-lg bg-green-50 p-4 text-green-700">
          {message}
        </div>
      )}

      <div className="grid gap-7 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Dirección de entrega
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  Elegí dónde querés recibir el pedido.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAddressForm((current) => !current)
                }
                className="rounded-lg border border-green-700 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
              >
                {showAddressForm
                  ? "Cancelar"
                  : "Nueva dirección"}
              </button>
            </div>

            {addresses.length === 0 && !showAddressForm && (
              <p className="mt-5 rounded-lg bg-yellow-50 p-4 text-yellow-800">
                No tenés direcciones guardadas. Creá una para
                continuar.
              </p>
            )}

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {addresses.map((address) => (
                <label
                  key={address.id}
                  className={
                    selectedAddressId === address.id
                      ? "cursor-pointer rounded-xl border-2 border-green-700 bg-green-50 p-4"
                      : "cursor-pointer rounded-xl border border-gray-200 p-4 hover:border-green-400"
                  }
                >
                  <div className="flex gap-3">
                    <input
                      type="radio"
                      name="address"
                      checked={
                        selectedAddressId === address.id
                      }
                      onChange={() =>
                        setSelectedAddressId(address.id)
                      }
                    />

                    <div>
                      <p className="font-bold">
                        {address.street} {address.number}
                      </p>

                      <p className="mt-1 text-sm text-gray-600">
                        {address.city}, {address.province}
                      </p>

                      <p className="text-sm text-gray-600">
                        CP {address.postal_code}
                      </p>

                      {address.reference && (
                        <p className="mt-2 text-xs text-gray-500">
                          {address.reference}
                        </p>
                      )}

                      {address.is_default && (
                        <span className="mt-2 inline-block rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                          Predeterminada
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {showAddressForm && (
              <form
                onSubmit={handleCreateAddress}
                className="mt-6 grid gap-4 rounded-xl border border-gray-200 p-5 md:grid-cols-2"
              >
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">
                    Región
                  </label>

                  <select
                    value={addressForm.region}
                    onChange={(event) =>
                      setAddressForm((current) => ({
                        ...current,
                        region: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value={0}>
                      Seleccionar región
                    </option>

                    {regions.map((region) => (
                      <option
                        key={region.id}
                        value={region.id}
                      >
                        {region.name}
                      </option>
                    ))}
                  </select>
                </div>

                <AddressInput
                  label="Calle"
                  value={addressForm.street}
                  onChange={(value) =>
                    setAddressForm((current) => ({
                      ...current,
                      street: value,
                    }))
                  }
                />

                <AddressInput
                  label="Número"
                  value={addressForm.number}
                  onChange={(value) =>
                    setAddressForm((current) => ({
                      ...current,
                      number: value,
                    }))
                  }
                />

                <AddressInput
                  label="Ciudad"
                  value={addressForm.city}
                  onChange={(value) =>
                    setAddressForm((current) => ({
                      ...current,
                      city: value,
                    }))
                  }
                />

                <AddressInput
                  label="Provincia"
                  value={addressForm.province}
                  onChange={(value) =>
                    setAddressForm((current) => ({
                      ...current,
                      province: value,
                    }))
                  }
                />

                <AddressInput
                  label="Código postal"
                  value={addressForm.postal_code}
                  onChange={(value) =>
                    setAddressForm((current) => ({
                      ...current,
                      postal_code: value,
                    }))
                  }
                />

                <AddressInput
                  label="Referencia"
                  value={addressForm.reference || ""}
                  required={false}
                  onChange={(value) =>
                    setAddressForm((current) => ({
                      ...current,
                      reference: value,
                    }))
                  }
                />

                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    checked={addressForm.is_default}
                    onChange={(event) =>
                      setAddressForm((current) => ({
                        ...current,
                        is_default: event.target.checked,
                      }))
                    }
                  />

                  Usar como dirección predeterminada
                </label>

                <button
                  disabled={savingAddress}
                  className="rounded-lg bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-50 md:col-span-2"
                >
                  {savingAddress
                    ? "Guardando..."
                    : "Guardar dirección"}
                </button>
              </form>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">
              Método de pago
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Los métodos de esta versión son simulados.
            </p>

            <div className="mt-5 space-y-3">
              {paymentOptions.map((option) => (
                <label
                  key={option.value}
                  className={
                    paymentMethod === option.value
                      ? "flex cursor-pointer gap-3 rounded-xl border-2 border-green-700 bg-green-50 p-4"
                      : "flex cursor-pointer gap-3 rounded-xl border border-gray-200 p-4"
                  }
                >
                  <input
                    type="radio"
                    name="payment_method"
                    checked={paymentMethod === option.value}
                    onChange={() =>
                      setPaymentMethod(option.value)
                    }
                  />

                  <div>
                    <p className="font-bold">
                      {option.label}
                    </p>

                    <p className="mt-1 text-sm text-gray-600">
                      {option.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-xl font-bold">
            Resumen final
          </h2>

          <div className="mt-5 max-h-80 space-y-4 overflow-y-auto">
            {cart.items.map((item) => (
              <div
                key={item.id}
                className="border-b pb-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {getCartItemProductName(item)}
                    </p>

                    <p className="text-sm text-gray-500">
                      Cantidad: {item.quantity}
                    </p>
                  </div>

                  <p className="font-medium">
                    {formatCurrency(
                      getCartItemSubtotal(item)
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3 border-b pb-5 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex justify-between">
              <span>Envío</span>
              <span>Calculado por el backend</span>
            </div>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            El total definitivo se informa después de validar
            stock, dirección, descuentos y envío.
          </p>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={
              submitting ||
              !selectedAddressId ||
              addresses.length === 0
            }
            className="mt-6 w-full rounded-lg bg-green-700 px-5 py-3 font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Confirmando compra..."
              : "Confirmar compra"}
          </button>

          <Link
            to="/cart"
            className="mt-3 block text-center text-sm font-medium text-gray-600"
          >
            Volver al carrito
          </Link>
        </aside>
      </div>
    </div>
  );
}

interface AddressInputProps {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}

function AddressInput({
  label,
  value,
  required = true,
  onChange,
}: AddressInputProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {label}
      </label>

      <input
        required={required}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-700"
      />
    </div>
  );
}