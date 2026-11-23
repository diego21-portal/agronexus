import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../features/auth/AuthContext";
import { useCart } from "../features/cart/CartContext";
import { DeliveryAddress } from "../features/orders/DeliveryAddress";
import { getAuthSession } from "../lib/tokenStorage";
import { createAddress, getAddresses } from "../services/addressService";
import { getCheckoutQuote, performCheckout } from "../services/checkoutService";
import { getRegions } from "../services/productService";
import type { Address, CreateAddressRequest } from "../types/address";
import {
  paymentMethodLabels, type CheckoutApiError, type CheckoutQuote, type CheckoutRequest, type PaymentMethod,
} from "../types/checkout";
import type { Region } from "../types/product";
import { getApiErrorMessage } from "../utils/apiError";
import { getCartItemAvailableStock, getCartItemProductId, getCartItemProductName, getCartItemSubtotal } from "../utils/cart";
import { formatCurrency } from "../utils/currency";

const ATTEMPT_PREFIX = "agronexus_checkout_attempt:";
const emptyAddress: CreateAddressRequest = {
  region: 0, street: "", number: "", city: "", province: "Mendoza", postal_code: "", reference: "", is_default: false,
};

interface CheckoutAttempt {
  ownerId: number;
  quote: CheckoutQuote;
  request: CheckoutRequest;
  signature: string;
  phase: "review" | "uncertain";
}

function isQuote(value: unknown): value is CheckoutQuote {
  if (typeof value !== "object" || value === null) return false;
  const quote = value as Partial<CheckoutQuote>;
  return typeof quote.quote_token === "string" && typeof quote.expires_at === "string"
    && Array.isArray(quote.items) && quote.items.every((item) => item && typeof item.product_name === "string"
      && typeof item.quantity === "number" && typeof item.total_price === "string")
    && typeof quote.total === "string" && typeof quote.subtotal === "string"
    && typeof quote.discount_total === "string" && typeof quote.shipping_cost === "string"
    && quote.currency === "ARS" && typeof quote.shipping_address_snapshot?.street === "string";
}

function readPendingAttempt(ownerId?: number): CheckoutAttempt | null {
  if (ownerId === undefined) return null;
  try {
    const raw = sessionStorage.getItem(`${ATTEMPT_PREFIX}${ownerId}`);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const attempt = value as Partial<CheckoutAttempt>;
    if (attempt.ownerId !== ownerId || !isQuote(attempt.quote) || !attempt.request
      || typeof attempt.request.address_id !== "number" || typeof attempt.request.idempotency_key !== "string"
      || attempt.request.quote_token !== attempt.quote.quote_token
      || !(attempt.request.payment_method in paymentMethodLabels) || typeof attempt.signature !== "string") return null;
    return { ...attempt, phase: "uncertain" } as CheckoutAttempt;
  } catch {
    return null;
  }
}

function persistAttempt(attempt: CheckoutAttempt): void {
  try { sessionStorage.setItem(`${ATTEMPT_PREFIX}${attempt.ownerId}`, JSON.stringify(attempt)); } catch {
    // In-memory recovery remains available if this browser disallows storage.
  }
}

function removePendingAttempt(ownerId: number): void {
  try { sessionStorage.removeItem(`${ATTEMPT_PREFIX}${ownerId}`); } catch { /* Storage can be disabled. */ }
}

function attemptKey(): string {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const ownerId = user?.id;
  const { cart, subtotal, loading: cartLoading, refreshCart, acknowledgeCheckout } = useCart();
  const [attempt, setAttempt] = useState<CheckoutAttempt | null>(() => readPendingAttempt(ownerId));
  const attemptRef = useRef(attempt);
  const accountRef = useRef(ownerId);
  accountRef.current = ownerId;
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [dataOwner, setDataOwner] = useState<number>();
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(attempt?.request.address_id ?? null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(attempt?.request.payment_method ?? "SIMULATED_CARD");
  const [addressForm, setAddressForm] = useState<CreateAddressRequest>(emptyAddress);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingAddress, setSavingAddress] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const operation = useRef(0);
  const quoteBusy = useRef(false);
  const confirmBusy = useRef(false);
  const addressBusy = useRef(false);
  const mounted = useRef(true);
  const activeAttempt = attempt?.ownerId === ownerId ? attempt : null;
  const visibleAddresses = dataOwner === ownerId ? addresses : [];
  const selectedAddress = visibleAddresses.find((address) => address.id === selectedAddressId);
  const signature = JSON.stringify({
    ownerId, address: selectedAddress, paymentMethod, cartId: cart?.id,
    items: cart?.items.map((item) => [item.id, getCartItemProductId(item), item.quantity, item.unit_price, getCartItemSubtotal(item)]),
  });
  const signatureRef = useRef(signature);
  signatureRef.current = signature;
  const inputsLocked = confirming || savingAddress || activeAttempt?.phase === "uncertain";

  const updateAttempt = useCallback((next: CheckoutAttempt | null) => {
    attemptRef.current = next;
    setAttempt(next);
  }, []);

  const invalidateReview = useCallback(() => {
    if (confirmBusy.current || attemptRef.current?.phase === "uncertain") return;
    operation.current += 1;
    quoteBusy.current = false;
    setQuoting(false);
    updateAttempt(null);
    setMessage("");
  }, [updateAttempt]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; operation.current += 1; };
  }, []);

  useEffect(() => {
    let active = true;
    const session = getAuthSession().generation;
    operation.current += 1;
    quoteBusy.current = false;
    confirmBusy.current = false;
    addressBusy.current = false;
    setQuoting(false);
    setConfirming(false);
    setSavingAddress(false);
    setError("");
    setMessage("");
    const restored = readPendingAttempt(ownerId);
    updateAttempt(restored);
    setSelectedAddressId(restored?.request.address_id ?? null);
    setPaymentMethod(restored?.request.payment_method ?? "SIMULATED_CARD");
    setLoading(true);
    if (ownerId === undefined) {
      setLoading(false);
      return () => { active = false; };
    }
    void Promise.all([getAddresses(), getRegions()]).then(([addressData, regionData]) => {
      if (!active || accountRef.current !== ownerId || getAuthSession().generation !== session) return;
      setAddresses(addressData);
      setRegions(regionData);
      setDataOwner(ownerId);
      setSelectedAddressId(restored?.request.address_id
        ?? addressData.find((address) => address.is_default)?.id ?? addressData[0]?.id ?? null);
      setAddressForm({ ...emptyAddress, region: regionData[0]?.id ?? 0 });
    }).catch((requestError: unknown) => {
      if (active && accountRef.current === ownerId && getAuthSession().generation === session) {
        setError(getApiErrorMessage(requestError, "No se pudieron cargar las direcciones. Intenta recargar la página."));
      }
    }).finally(() => {
      if (active && accountRef.current === ownerId && getAuthSession().generation === session) setLoading(false);
    });
    return () => { active = false; };
  }, [ownerId, updateAttempt]);

  useEffect(() => {
    const current = attemptRef.current;
    if (current?.phase === "review" && current.signature !== signature) {
      operation.current += 1;
      quoteBusy.current = false;
      setQuoting(false);
      updateAttempt(null);
      setMessage("La selección cambió. Revisa nuevamente la compra para obtener el total actualizado.");
    }
  }, [signature, updateAttempt]);

  useEffect(() => {
    if (attempt?.phase !== "review") return;
    const token = attempt.quote.quote_token;
    const remaining = Date.parse(attempt.quote.expires_at) - Date.now();
    const timer = window.setTimeout(() => {
      if (attemptRef.current?.phase === "review" && attemptRef.current.quote.quote_token === token) {
        updateAttempt(null);
        setMessage("La revisión venció. Vuelve a revisar la compra antes de confirmar.");
      }
    }, Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [attempt, updateAttempt]);

  async function handleCreateAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addressBusy.current || inputsLocked) return;
    if (!addressForm.region || !addressForm.street.trim() || !addressForm.number.trim()
      || !addressForm.city.trim() || !addressForm.province.trim() || !addressForm.postal_code.trim()) {
      setError("Completa los campos obligatorios de la dirección.");
      return;
    }
    const account = ownerId;
    const session = getAuthSession().generation;
    invalidateReview();
    addressBusy.current = true;
    setSavingAddress(true);
    setError("");
    try {
      const created = await createAddress(addressForm);
      if (!mounted.current || accountRef.current !== account || getAuthSession().generation !== session) return;
      invalidateReview();
      setAddresses((current) => [...current, created]);
      setSelectedAddressId(created.id);
      setShowAddressForm(false);
      setAddressForm({ ...emptyAddress, region: regions[0]?.id ?? 0 });
      setMessage("Dirección guardada. Revisa la compra para calcular su entrega.");
    } catch (requestError) {
      if (mounted.current && accountRef.current === account && getAuthSession().generation === session) {
        setError(getApiErrorMessage(requestError, "No se pudo guardar la dirección."));
      }
    } finally {
      if (mounted.current && accountRef.current === account && getAuthSession().generation === session) {
        addressBusy.current = false;
        setSavingAddress(false);
      }
    }
  }

  async function handleReview() {
    if (quoteBusy.current || confirmBusy.current || addressBusy.current || attemptRef.current?.phase === "uncertain") return;
    if (!ownerId || !selectedAddressId || !cart?.items.length) {
      setError("Selecciona una dirección y agrega productos al carrito.");
      return;
    }
    const invalid = cart.items.find((item) => {
      const stock = getCartItemAvailableStock(item);
      return stock !== null && item.quantity > stock;
    });
    if (invalid) { setError(`No hay stock suficiente para ${getCartItemProductName(invalid)}.`); return; }
    const version = ++operation.current;
    const inputSignature = signatureRef.current;
    const account = ownerId;
    const session = getAuthSession().generation;
    quoteBusy.current = true;
    setQuoting(true);
    updateAttempt(null);
    setError("");
    setMessage("");
    try {
      const quote = await getCheckoutQuote({ address_id: selectedAddressId, payment_method: paymentMethod });
      if (!mounted.current || version !== operation.current || accountRef.current !== account
        || getAuthSession().generation !== session || signatureRef.current !== inputSignature) return;
      updateAttempt({ ownerId: account, quote, signature: inputSignature, phase: "review", request: {
        address_id: selectedAddressId, payment_method: paymentMethod, quote_token: quote.quote_token,
        idempotency_key: attemptKey(),
      } });
    } catch (requestError) {
      if (mounted.current && version === operation.current && getAuthSession().generation === session) {
        setError(getApiErrorMessage(requestError, "No se pudo revisar la compra. Intenta nuevamente."));
      }
    } finally {
      if (mounted.current && version === operation.current && getAuthSession().generation === session) {
        quoteBusy.current = false;
        setQuoting(false);
      }
    }
  }

  async function handleConfirm() {
    const current = attemptRef.current;
    if (confirmBusy.current || addressBusy.current || !current || current.ownerId !== ownerId) return;
    if (current.phase === "review" && (current.signature !== signatureRef.current
      || Date.parse(current.quote.expires_at) <= Date.now())) {
      invalidateReview();
      setMessage("La selección cambió o la revisión venció. Revisa otra vez antes de confirmar.");
      return;
    }
    const version = ++operation.current;
    const session = getAuthSession().generation;
    const sent: CheckoutAttempt = { ...current, phase: "uncertain" };
    confirmBusy.current = true;
    updateAttempt(sent);
    persistAttempt(sent);
    setConfirming(true);
    setError("");
    setMessage("");
    try {
      const order = await performCheckout(sent.request);
      if (!mounted.current || version !== operation.current || accountRef.current !== sent.ownerId
        || getAuthSession().generation !== session) return;
      removePendingAttempt(sent.ownerId);
      // The purchase succeeded. An auxiliary cache request cannot undo that
      // result or prevent showing its confirmation.
      acknowledgeCheckout?.(sent.quote.cart_id);
      navigate(`/orders/${order.id}/confirmation`, { replace: true });
      void refreshCart().catch(() => undefined);
    } catch (requestError) {
      if (!mounted.current || version !== operation.current || accountRef.current !== sent.ownerId
        || getAuthSession().generation !== session) return;
      const failure = axios.isAxiosError<CheckoutApiError>(requestError) ? requestError.response : undefined;
      if (failure?.status === 409 && failure.data?.code === "quote_changed") {
        removePendingAttempt(sent.ownerId);
        const quote = failure.data.quote;
        if (isQuote(quote)) {
          updateAttempt({ ...sent, quote, phase: "review", signature: signatureRef.current,
            request: { ...sent.request, quote_token: quote.quote_token, idempotency_key: attemptKey() } });
        } else updateAttempt(null);
        setError(failure.data.detail || "Los datos de la compra cambiaron. Revisa el nuevo total antes de confirmar.");
      } else if (failure && failure.status >= 400 && failure.status < 500
        && failure.status !== 408 && failure.status !== 429) {
        removePendingAttempt(sent.ownerId);
        updateAttempt(null);
        setError(getApiErrorMessage(requestError, "No se pudo confirmar esta revisión. Revisa nuevamente la compra."));
      } else {
        // Preserve exactly the same payload for an ambiguous network outcome.
        updateAttempt(sent);
        persistAttempt(sent);
        setError("No pudimos comprobar si la compra quedó registrada. Recupera la confirmación antes de iniciar otra compra.");
      }
    } finally {
      if (mounted.current && version === operation.current && getAuthSession().generation === session) {
        confirmBusy.current = false;
        setConfirming(false);
      }
    }
  }

  if ((loading || cartLoading) && !activeAttempt) return <div className="rounded-2xl bg-white p-10 shadow-sm">Preparando compra...</div>;
  if (!cart?.items.length && !activeAttempt) return <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
    {error && <p role="alert" className="mb-5 text-red-700">{error}</p>}
    <h1 className="text-2xl font-bold">No hay productos para comprar</h1>
    <Link to="/products" className="mt-5 inline-block rounded-lg bg-green-700 px-5 py-3 text-white">Volver al catálogo</Link>
  </div>;

  const activeStep = confirming || activeAttempt?.phase === "uncertain" ? "Confirmación"
    : activeAttempt ? "Revisión" : "Entrega";

  return <div>
    <header className="mb-7">
      <h1 className="font-display text-4xl leading-tight text-agro-forest sm:text-5xl">Revisar y confirmar compra</h1>
      <ol aria-label="Etapas de la compra" className="mt-4 grid max-w-lg grid-cols-3 gap-1 rounded-xl border border-agro-line bg-white p-1 text-center text-xs sm:gap-2 sm:text-sm">
        {["Entrega", "Revisión", "Confirmación"].map((step) => (
          <li key={step} aria-current={step === activeStep ? "step" : undefined}
            className={`min-w-0 rounded-lg px-1 py-2.5 font-semibold ${step === activeStep ? "bg-agro-forest text-white" : "text-agro-muted"}`}>
            {step}
          </li>
        ))}
      </ol>
    </header>
    {error && <div role="alert" className="mb-5 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>}
    {message && <p role="status" className="mb-5 rounded-lg bg-blue-50 p-4 text-blue-900">{message}</p>}
    {activeAttempt?.phase === "uncertain" && !confirming && <div className="mb-5 rounded-lg bg-amber-50 p-4 text-amber-900">
      <p>Hay una confirmación pendiente de comprobar. Conservamos la compra revisada para recuperar su resultado.</p>
      <Link to="/account/orders" className="mt-2 inline-block font-semibold underline">Ver mis pedidos</Link>
    </div>}
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-7">
      <div className="min-w-0 space-y-5">
        <section className="rounded-2xl border border-agro-line bg-white p-4 sm:p-6">
          <h2 className="text-xl font-bold">Dirección de entrega</h2>
          <fieldset disabled={inputsLocked} className="mt-5 min-w-0 space-y-4 disabled:opacity-70">
            <legend className="sr-only">Selecciona una dirección</legend>
            {!visibleAddresses.length && <p className="text-sm text-gray-600">Guarda una dirección para calcular el envío.</p>}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {visibleAddresses.map((address) => <label key={address.id} className="flex cursor-pointer gap-3 rounded-xl border p-4">
                <input type="radio" name="address" checked={selectedAddressId === address.id} onChange={() => {
                  invalidateReview(); setSelectedAddressId(address.id); setError("");
                }} />
                <span className="min-w-0 break-words"><strong className="block">{address.street} {address.number}</strong>
                  <span className="block text-sm">{address.city}, {address.province}</span>
                  <span className="block text-sm">CP {address.postal_code}</span>
                  {address.reference && <span className="block text-sm">{address.reference}</span>}
                </span>
              </label>)}
            </div>
            <button type="button" onClick={() => setShowAddressForm((open) => !open)} className="rounded-lg border px-4 py-2 font-medium">
              {showAddressForm ? "Cerrar formulario de dirección" : "Nueva dirección"}
            </button>
          </fieldset>
          {showAddressForm && <form onSubmit={handleCreateAddress} className="mt-5">
            <fieldset disabled={inputsLocked || savingAddress} className="grid min-w-0 grid-cols-1 gap-4 rounded-xl border border-agro-line p-3 md:grid-cols-2 md:p-5 disabled:opacity-70">
              <label><span className="mb-1 block text-sm font-medium">Región</span>
                <select required value={addressForm.region} onChange={(event) => setAddressForm((form) => ({ ...form, region: Number(event.target.value) }))} className="w-full rounded-lg border px-3 py-2">
                  <option value={0}>Seleccionar región</option>
                  {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
                </select>
              </label>
              {([ ["street", "Calle"], ["number", "Número"], ["city", "Ciudad"], ["province", "Provincia"], ["postal_code", "Código postal"], ["reference", "Referencia"] ] as const).map(([field, label]) =>
                <label key={field}><span className="mb-1 block text-sm font-medium">{label}</span>
                  <input required={field !== "reference"} value={addressForm[field] ?? ""} onChange={(event) => setAddressForm((form) => ({ ...form, [field]: event.target.value }))} className="w-full rounded-lg border px-3 py-2" />
                </label>)}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={addressForm.is_default} onChange={(event) => setAddressForm((form) => ({ ...form, is_default: event.target.checked }))} />Usar como predeterminada</label>
              <button disabled={savingAddress} className="rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white">{savingAddress ? "Guardando..." : "Guardar dirección"}</button>
            </fieldset>
          </form>}
        </section>
        <section className="rounded-2xl border border-agro-line bg-white p-4 sm:p-6">
          <h2 className="text-xl font-bold">Método de pago</h2>
          <p className="mt-2 text-sm text-gray-600">Esta demostración registra todos los métodos como aprobados. No realiza cobros reales.</p>
          <fieldset disabled={inputsLocked} className="mt-5 min-w-0 space-y-3 disabled:opacity-70">
            <legend className="sr-only">Selecciona un método de pago simulado</legend>
            {(Object.entries(paymentMethodLabels) as [PaymentMethod, string][]).map(([method, label]) => <label key={method} className="flex cursor-pointer gap-3 rounded-xl border p-4">
              <input type="radio" name="payment_method" checked={paymentMethod === method} onChange={() => {
                invalidateReview(); setPaymentMethod(method); setError("");
              }} /><span className="font-semibold">{label}</span>
            </label>)}
          </fieldset>
        </section>
        {activeAttempt && <DeliveryAddress snapshot={activeAttempt.quote.shipping_address_snapshot} source="CHECKOUT" title="Entrega revisada" />}
      </div>
      <aside className="h-fit min-w-0 rounded-2xl border border-agro-line bg-white p-4 sm:p-6 lg:sticky lg:top-32">
        <h2 className="text-xl font-bold">{activeAttempt ? "Revisión de tu compra" : "Tu carrito"}</h2>
        <div className="mt-5 max-h-80 space-y-4 overflow-y-auto">
          {activeAttempt ? activeAttempt.quote.items.map((item) => <article key={item.cart_item_id} className="border-b pb-4">
            <p className="break-words font-semibold">{item.product_name}</p>
            <p className="text-sm text-gray-600">{item.seller_name}</p>
            <div className="mt-2 flex flex-wrap justify-between gap-x-3 text-sm"><span>{item.quantity} × {formatCurrency(item.unit_price)}</span><strong>{formatCurrency(item.total_price)}</strong></div>
          </article>) : cart?.items.map((item) => <article key={item.id} className="flex flex-wrap justify-between gap-x-3 border-b pb-4">
            <div className="min-w-0 break-words"><p className="font-semibold">{getCartItemProductName(item)}</p><p className="text-sm">Cantidad: {item.quantity}</p></div>
            <strong>{formatCurrency(getCartItemSubtotal(item))}</strong>
          </article>)}
        </div>
        {activeAttempt ? <>
          <dl className="mt-5 space-y-3 text-sm">
            <Amount label="Subtotal" value={activeAttempt.quote.subtotal} />
            <Amount label="Descuentos" value={activeAttempt.quote.discount_total} />
            <Amount label="Envío" value={activeAttempt.quote.shipping_cost} />
            <Amount label="Total a confirmar" value={activeAttempt.quote.total} total />
          </dl>
          <p className="mt-3 text-sm text-gray-600">Pago: {paymentMethodLabels[activeAttempt.request.payment_method]}</p>
          {activeAttempt.quote.price_changed && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Los precios se actualizaron respecto del carrito. Revisa este total antes de confirmar.</p>}
          {activeAttempt.phase === "review" && <p className="mt-4 text-xs text-gray-500">Revisión válida hasta {new Date(activeAttempt.quote.expires_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}.</p>}
          <button type="button" onClick={() => void handleConfirm()} disabled={confirming || savingAddress} className="mt-6 w-full rounded-lg bg-agro-forest px-4 py-3 font-semibold text-white hover:bg-agro-deep disabled:opacity-50">
            {confirming ? "Confirmando..." : activeAttempt.phase === "uncertain" ? "Recuperar confirmación" : "Confirmar compra"}
          </button>
          {activeAttempt.phase === "review" && <button type="button" onClick={invalidateReview} className="mt-3 w-full rounded-lg border px-4 py-2 font-medium">Cambiar selección</button>}
        </> : <>
          <div className="mt-5 flex flex-wrap justify-between gap-x-3 text-sm"><span>Importe del carrito</span><strong>{formatCurrency(subtotal)}</strong></div>
          <p className="mt-4 text-sm text-gray-600">Revisa la compra para conocer el envío, los descuentos y el total antes de confirmar.</p>
          <button type="button" onClick={() => void handleReview()} disabled={quoting || savingAddress || loading || !selectedAddressId || !cart?.items.length} className="mt-6 w-full rounded-lg bg-agro-forest px-4 py-3 font-semibold text-white hover:bg-agro-deep disabled:opacity-50">
            {quoting ? "Revisando..." : "Revisar compra"}
          </button>
        </>}
        <Link to={activeAttempt?.phase === "uncertain" ? "/account/orders" : "/cart"} className="mt-4 block text-center text-sm font-medium text-gray-600 underline">
          {activeAttempt?.phase === "uncertain" ? "Consultar mis pedidos" : "Volver al carrito"}
        </Link>
      </aside>
    </div>
  </div>;
}

function Amount({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  return <div className={`flex flex-wrap justify-between gap-x-3 ${total ? "border-t pt-4 text-xl font-bold text-agro-forest" : ""}`}>
    <dt>{label}</dt><dd>{formatCurrency(value)}</dd>
  </div>;
}
