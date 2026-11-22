import axios from "axios";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { getSellerProduct } from "../../services/sellerService";
import {
  deleteProductImage, deleteTechnicalSheet, updateProductImage,
  uploadProductImage, uploadTechnicalSheet,
} from "../../services/productMediaService";
import type { ProductImage } from "../../types/product";
import { getApiErrorMessage } from "../../utils/apiError";
import { getMediaUrl } from "../../utils/mediaUrl";

interface MediaData { images: ProductImage[]; technicalSheet: string | null }
interface MediaState {
  scope: string;
  data: MediaData | null;
  loading: boolean;
  busy: boolean;
  requiresRefresh: boolean;
  error: string;
  message: string;
}
interface MediaRequest { scope: string; active: boolean; busy: boolean }

function mediaData(product: Awaited<ReturnType<typeof getSellerProduct>>): MediaData {
  return { images: product.images ?? [], technicalSheet: product.technical_sheet ?? null };
}

/** File operations are separate from product creation and commercial edits. */
export function ProductMediaManager({ productId }: { productId: number }) {
  const { user } = useAuth();
  const allowed = user?.role === "SELLER";
  const scope = `${user?.id ?? "anonymous"}:${user?.role ?? ""}:${productId}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const context = useRef<MediaRequest | null>(null);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<MediaState>({
    scope, data: null, loading: true, busy: false, requiresRefresh: false, error: "", message: "",
  });
  const [image, setImage] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const request = { scope, active: true, busy: false };
    context.current = request;
    setState({ scope, data: null, loading: allowed, busy: false, requiresRefresh: false, error: "", message: "" });
    setImage(null);
    setPdf(null);
    setAltText("");
    if (imageInput.current) imageInput.current.value = "";
    if (pdfInput.current) pdfInput.current.value = "";
    if (allowed) {
      void getSellerProduct(productId).then((product) => {
        if (request.active && scopeRef.current === scope) {
          setState({ scope, data: mediaData(product), loading: false, busy: false, requiresRefresh: false, error: "", message: "" });
        }
      }).catch((error: unknown) => {
        if (request.active && scopeRef.current === scope) setState({
          scope, data: null, loading: false, busy: false, requiresRefresh: true, message: "",
          error: getApiErrorMessage(error, "No se pudieron cargar los archivos del producto."),
        });
      });
    }
    return () => { request.active = false; };
  }, [allowed, productId, revision, scope]);

  function isCurrent(request: MediaRequest) {
    return request.active && context.current === request && scopeRef.current === request.scope;
  }

  async function runAction(action: () => Promise<unknown>, message: string, committed?: () => void) {
    const request = context.current;
    if (!allowed || !request?.active || request.busy || request.scope !== scope || state.requiresRefresh) return;
    request.busy = true;
    setState((current) => ({ ...current, busy: true, error: "", message: "" }));
    let saved = false;
    try {
      await action();
      saved = true;
      if (!isCurrent(request)) return;
      committed?.();
      const product = await getSellerProduct(productId);
      if (!isCurrent(request)) return;
      setState({ scope, data: mediaData(product), loading: false, busy: false, requiresRefresh: false, error: "", message });
    } catch (error) {
      if (!isCurrent(request)) return;
      // A network failure, upstream error or timeout can hide a committed
      // upload. Require a GET before another write to inspect the actual files.
      const uncertain = !axios.isAxiosError(error) || !error.response
        || error.response.status >= 500 || error.response.status === 408;
      setState((current) => ({
        ...current, busy: false, requiresRefresh: saved || uncertain,
        error: saved
          ? "La operación se guardó, pero no pudimos actualizar la lista. Actualiza los archivos antes de realizar otro cambio."
          : uncertain
            ? "No pudimos confirmar el resultado de la operación. Actualiza los archivos y revisa el resultado antes de volver a intentarlo."
            : getApiErrorMessage(error, "No se pudo modificar el archivo."),
      }));
    } finally {
      request.busy = false;
      if (isCurrent(request)) setState((current) => ({ ...current, busy: false }));
    }
  }

  function validationError(message: string) {
    setState((current) => ({ ...current, error: message, message: "" }));
  }

  function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!image) return validationError("Selecciona una imagen para subir.");
    if (!/\.(?:jpe?g|png|webp)$/i.test(image.name)
      || (image.type && !["image/jpeg", "image/png", "image/webp"].includes(image.type))) {
      return validationError("La imagen debe ser JPEG, PNG o WebP.");
    }
    if (image.size > 5 * 1024 * 1024) return validationError("La imagen no puede superar 5 MiB.");
    void runAction(() => uploadProductImage(productId, image, altText), "Imagen guardada.", () => {
      setImage(null);
      setAltText("");
      if (imageInput.current) imageInput.current.value = "";
    });
  }

  function uploadPdf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pdf) return validationError("Selecciona una ficha PDF para subir.");
    if (!/\.pdf$/i.test(pdf.name) || (pdf.type && pdf.type !== "application/pdf")) {
      return validationError("La ficha técnica debe ser un archivo PDF.");
    }
    if (pdf.size > 10 * 1024 * 1024) return validationError("La ficha PDF no puede superar 10 MiB.");
    void runAction(() => uploadTechnicalSheet(productId, pdf), "Ficha PDF guardada.", () => {
      setPdf(null);
      if (pdfInput.current) pdfInput.current.value = "";
    });
  }

  if (!allowed) return null;
  const current = state.scope === scope ? state : { ...state, data: null, loading: true, error: "", message: "" };
  const disabled = current.loading || current.busy || current.requiresRefresh;
  const technicalSheetUrl = getMediaUrl(current.data?.technicalSheet);
  return (
    <section aria-label="Archivos del producto" className="mt-8 space-y-6 border-t pt-8">
      <div>
        <h3 className="text-xl font-bold">Imágenes y ficha PDF</h3>
        <p className="mt-2 text-sm text-gray-600">Estos archivos son públicos y aparecen en el catálogo. No incluyas datos personales ni documentos privados.</p>
      </div>
      {current.loading && <p role="status">Cargando archivos...</p>}
      {current.busy && <p role="status">Guardando archivo...</p>}
      {current.message && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{current.message}</p>}
      {current.error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
        <p>{current.error}</p>
        <button type="button" disabled={current.busy} onClick={() => setRevision((value) => value + 1)} className="mt-3 rounded-lg border px-3 py-2">Actualizar archivos</button>
      </div>}
      {current.data && <>
        <div className="grid gap-4 md:grid-cols-2">
          {current.data.images.map((entry, index) => <ProductImageEditor key={`${scope}:${entry.id}`} image={entry} position={index + 1} disabled={disabled}
            save={(values) => { void runAction(() => updateProductImage(productId, entry.id, values), "Imagen actualizada."); }}
            makeMain={() => { void runAction(() => updateProductImage(productId, entry.id, { is_main: true }), "Imagen principal actualizada."); }}
            remove={() => { void runAction(() => deleteProductImage(productId, entry.id), "Imagen eliminada."); }} />)}
        </div>
        {current.data.images.length === 0 && <p className="text-sm text-gray-500">El producto todavía no tiene imágenes.</p>}

        <form onSubmit={uploadImage} className="space-y-3 rounded-xl border p-4">
          <h4 className="font-semibold">Añadir imagen</h4>
          <p className="text-xs text-gray-500">Hasta 12 imágenes por producto. La primera se utiliza como principal.</p>
          <label className="block text-sm">Imagen JPEG, PNG o WebP (máximo 5 MiB)
            <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled}
              onChange={(event) => setImage(event.target.files?.[0] ?? null)} className="mt-2 block w-full" />
          </label>
          <label className="block text-sm">Descripción de la nueva imagen
            <input value={altText} maxLength={180} disabled={disabled} onChange={(event) => setAltText(event.target.value)}
              className="mt-1 block w-full rounded-lg border px-3 py-2" />
          </label>
          <button disabled={disabled || !image} className="rounded-lg bg-green-700 px-4 py-2 text-white disabled:opacity-50">Subir imagen</button>
        </form>

        <div className="rounded-xl border p-4">
          <h4 className="font-semibold">Ficha técnica PDF</h4>
          {current.data.technicalSheet ? <div className="mt-3 flex flex-wrap items-center gap-4">
            {technicalSheetUrl ? <a href={technicalSheetUrl} download className="font-medium text-green-700 underline">Descargar ficha PDF actual</a>
              : <p role="alert">La ficha PDF no está disponible. Reemplázala o elimínala.</p>}
            <button type="button" disabled={disabled} onClick={() => { void runAction(() => deleteTechnicalSheet(productId), "Ficha PDF eliminada."); }}
              className="rounded-lg border border-red-200 px-3 py-2 text-red-700 disabled:opacity-50">Eliminar ficha PDF</button>
          </div> : <p className="mt-2 text-sm text-gray-500">No hay una ficha PDF adjunta.</p>}
          <form onSubmit={uploadPdf} className="mt-4 space-y-3">
            <label className="block text-sm">Ficha PDF (máximo 10 MiB)
              <input ref={pdfInput} type="file" accept="application/pdf,.pdf" disabled={disabled}
                onChange={(event) => setPdf(event.target.files?.[0] ?? null)} className="mt-2 block w-full" />
            </label>
            <p className="text-xs text-gray-500">Subir una nueva ficha reemplaza la anterior cuando el servidor confirma el cambio.</p>
            <button disabled={disabled || !pdf} className="rounded-lg bg-green-700 px-4 py-2 text-white disabled:opacity-50">Subir ficha PDF</button>
          </form>
        </div>
      </>}
    </section>
  );
}

function ProductImageEditor({ image, position, disabled, save, makeMain, remove }: {
  image: ProductImage;
  position: number;
  disabled: boolean;
  save: (values: { alt_text: string; order: number }) => void;
  makeMain: () => void;
  remove: () => void;
}) {
  const [altText, setAltText] = useState(image.alt_text ?? "");
  const [order, setOrder] = useState(image.order ?? 0);
  useEffect(() => { setAltText(image.alt_text ?? ""); }, [image.alt_text]);
  useEffect(() => { setOrder(image.order ?? 0); }, [image.order]);
  const imageUrl = getMediaUrl(image.image);
  return <article aria-label={`Imagen ${position}`} className="space-y-3 rounded-xl border p-4">
    {imageUrl ? <img src={imageUrl} alt={image.alt_text || `Imagen ${position}`} className="h-40 w-full rounded-lg object-contain" />
      : <p role="alert">La dirección de esta imagen no es válida. Reemplázala o elimínala.</p>}
    {image.is_main && <p className="text-sm font-semibold text-green-700">Imagen principal</p>}
    <form onSubmit={(event) => { event.preventDefault(); save({ alt_text: altText.trim(), order }); }} className="space-y-3">
      <label className="block text-sm">Descripción de imagen {position}
        <input value={altText} maxLength={180} disabled={disabled} onChange={(event) => setAltText(event.target.value)}
          className="mt-1 block w-full rounded-lg border px-3 py-2" />
      </label>
      <label className="block text-sm">Orden de imagen {position}
        <input type="number" min={0} max={2147483647} required value={order} disabled={disabled}
          onChange={(event) => setOrder(Number(event.target.value))} className="mt-1 block w-full rounded-lg border px-3 py-2" />
      </label>
      <button disabled={disabled} className="rounded-lg border px-3 py-2 disabled:opacity-50">Guardar imagen {position}</button>
    </form>
    <div className="flex flex-wrap gap-3">
      {!image.is_main && <button type="button" disabled={disabled} onClick={makeMain} className="rounded-lg border px-3 py-2 disabled:opacity-50">Hacer principal imagen {position}</button>}
      <button type="button" disabled={disabled} onClick={remove} className="rounded-lg border border-red-200 px-3 py-2 text-red-700 disabled:opacity-50">Eliminar imagen {position}</button>
    </div>
  </article>;
}
