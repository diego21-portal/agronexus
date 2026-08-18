import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  createAddress,
  deleteAddress,
  getAddresses,
  updateAddress,
} from "../../services/addressService";
import { getRegions } from "../../services/productService";
import type {
  Address,
  CreateAddressRequest,
} from "../../types/address";
import type { Region } from "../../types/product";
import { getApiErrorMessage } from "../../utils/apiError";

const emptyForm: CreateAddressRequest = {
  region: 0,
  street: "",
  number: "",
  city: "",
  province: "Mendoza",
  postal_code: "",
  reference: "",
  is_default: false,
};

export function AddressesPage() {
  const [addresses, setAddresses] =
    useState<Address[]>([]);

  const [regions, setRegions] =
    useState<Region[]>([]);

  const [form, setForm] =
    useState<CreateAddressRequest>(
      emptyForm
    );

  const [showForm, setShowForm] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  async function loadData() {
    try {
      setLoading(true);

      const [addressData, regionData] =
        await Promise.all([
          getAddresses(),
          getRegions(),
        ]);

      setAddresses(addressData);
      setRegions(regionData);

      if (regionData.length > 0) {
        setForm((current) => ({
          ...current,
          region:
            current.region ||
            regionData[0].id,
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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const created =
        await createAddress(form);

      setAddresses((current) => [
        ...current,
        created,
      ]);

      setForm({
        ...emptyForm,
        region:
          regions[0]?.id || 0,
      });

      setShowForm(false);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo guardar la dirección."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDefault(
    addressId: number
  ) {
    try {
      await updateAddress(
        addressId,
        {
          is_default: true,
        }
      );

      await loadData();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo cambiar la dirección predeterminada."
        )
      );
    }
  }

  async function handleDelete(
    addressId: number
  ) {
    if (
      !window.confirm(
        "¿Eliminar esta dirección?"
      )
    ) {
      return;
    }

    try {
      await deleteAddress(addressId);

      setAddresses((current) =>
        current.filter(
          (address) =>
            address.id !== addressId
        )
      );
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo eliminar la dirección."
        )
      );
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row">
        <div>
          <h2 className="text-2xl font-bold">
            Mis direcciones
          </h2>

          <p className="mt-1 text-gray-600">
            Administrá tus lugares de entrega.
          </p>
        </div>

        <button
          onClick={() =>
            setShowForm((current) => !current)
          }
          className="rounded-lg bg-green-700 px-4 py-2 font-medium text-white"
        >
          {showForm
            ? "Cancelar"
            : "Nueva dirección"}
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 grid gap-4 rounded-xl bg-gray-50 p-5 sm:grid-cols-2"
        >
          <select
            value={form.region}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                region: Number(
                  event.target.value
                ),
              }))
            }
            className="rounded-lg border border-gray-300 px-3 py-2 sm:col-span-2"
          >
            {regions.map((region) => (
              <option
                key={region.id}
                value={region.id}
              >
                {region.name}
              </option>
            ))}
          </select>

          <Input
            placeholder="Calle"
            value={form.street}
            onChange={(street) =>
              setForm((current) => ({
                ...current,
                street,
              }))
            }
          />

          <Input
            placeholder="Número"
            value={form.number}
            onChange={(number) =>
              setForm((current) => ({
                ...current,
                number,
              }))
            }
          />

          <Input
            placeholder="Ciudad"
            value={form.city}
            onChange={(city) =>
              setForm((current) => ({
                ...current,
                city,
              }))
            }
          />

          <Input
            placeholder="Provincia"
            value={form.province}
            onChange={(province) =>
              setForm((current) => ({
                ...current,
                province,
              }))
            }
          />

          <Input
            placeholder="Código postal"
            value={form.postal_code}
            onChange={(postal_code) =>
              setForm((current) => ({
                ...current,
                postal_code,
              }))
            }
          />

          <Input
            placeholder="Referencia"
            value={form.reference || ""}
            required={false}
            onChange={(reference) =>
              setForm((current) => ({
                ...current,
                reference,
              }))
            }
          />

          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  is_default:
                    event.target.checked,
                }))
              }
            />

            Dirección predeterminada
          </label>

          <button
            disabled={saving}
            className="rounded-lg bg-gray-900 px-4 py-2 text-white sm:col-span-2"
          >
            {saving
              ? "Guardando..."
              : "Guardar"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="mt-6">
          Cargando direcciones...
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <article
              key={address.id}
              className={
                address.is_default
                  ? "rounded-xl border-2 border-green-700 bg-green-50 p-5"
                  : "rounded-xl border border-gray-200 p-5"
              }
            >
              <p className="font-bold">
                {address.street}{" "}
                {address.number}
              </p>

              <p className="mt-1 text-gray-600">
                {address.city},{" "}
                {address.province}
              </p>

              <p className="text-sm text-gray-500">
                CP {address.postal_code}
              </p>

              {address.is_default && (
                <span className="mt-3 inline-block rounded-full bg-green-700 px-2 py-1 text-xs text-white">
                  Predeterminada
                </span>
              )}

              <div className="mt-5 flex gap-3">
                {!address.is_default && (
                  <button
                    onClick={() =>
                      handleDefault(
                        address.id
                      )
                    }
                    className="text-sm font-medium text-green-700"
                  >
                    Hacer predeterminada
                  </button>
                )}

                <button
                  onClick={() =>
                    handleDelete(
                      address.id
                    )
                  }
                  className="text-sm font-medium text-red-700"
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Input({
  placeholder,
  value,
  onChange,
  required = true,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <input
      required={required}
      placeholder={placeholder}
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      className="rounded-lg border border-gray-300 px-3 py-2"
    />
  );
}