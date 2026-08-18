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

import {
  createSellerProduct,
  getSellerProduct,
  updateSellerProduct,
} from "../../services/sellerService";

import {
  getBrands,
  getCategories,
  getRegions,
} from "../../services/productService";

import type {
  Brand,
  Category,
  Region,
} from "../../types/product";

import type {
  SellerProductPayload,
} from "../../types/seller";

import {
  sellerProductSchema,
} from "../../schemas/businessSchemas";

import {
  getFirstZodError,
} from "../../utils/zodError";

import { getApiErrorMessage } from "../../utils/apiError";

const initialForm: SellerProductPayload = {
  category: 0,
  brand: null,
  region: 0,

  name: "",
  sku: "",

  short_description: "",
  description: "",
  technical_description: "",

  price: "",
  discount_price: null,

  unit: "unidad",

  stock: 0,
  minimum_stock: 0,

  condition: "NEW",
  status: "DRAFT",

  warranty: "",

  shipping_available: true,
  is_active: true,
  is_featured: false,
};

export function SellerProductFormPage() {
  const { productId } =
    useParams<{
      productId?: string;
    }>();

  const navigate = useNavigate();

  const editing =
    Boolean(productId);

  const [form, setForm] =
    useState<SellerProductPayload>(
      initialForm
    );

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [brands, setBrands] =
    useState<Brand[]>([]);

  const [regions, setRegions] =
    useState<Region[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function load() {
      try {
        const [
          categoryData,
          brandData,
          regionData,
        ] = await Promise.all([
          getCategories(),
          getBrands(),
          getRegions(),
        ]);

        setCategories(
          categoryData
        );

        setBrands(brandData);
        setRegions(regionData);

        if (editing) {
          const product =
            await getSellerProduct(
              Number(productId)
            );

          setForm({
            category:
              product.category?.id ||
              0,

            brand:
              product.brand?.id ||
              null,

            region:
              product.region?.id ||
              0,

            name: product.name,

            sku: product.sku,

            short_description:
              product.short_description,

            description:
              product.description,

            technical_description:
              product.technical_description ||
              "",

            price:
              product.price,

            discount_price:
              product.discount_price ||
              null,

            unit:
              product.unit,

            stock:
              product.stock,

            minimum_stock:
              product.minimum_stock,

            condition:
              product.condition,

            status:
              product.status,

            warranty:
              product.warranty ||
              "",

            shipping_available:
              product.shipping_available,

            is_active:
              product.is_active !==
              false,

            is_featured:
              product.is_featured,
          });
        } else {
          setForm(
            (current) => ({
              ...current,

              category:
                categoryData[0]
                  ?.id || 0,

              brand:
                brandData[0]
                  ?.id || null,

              region:
                regionData[0]
                  ?.id || 0,
            })
          );
        }
      } catch (requestError) {
        setError(
          getApiErrorMessage(
            requestError,
            "No se pudo preparar el formulario."
          )
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [editing, productId]);

  function updateField<
    K extends keyof SellerProductPayload
  >(
    field: K,
    value:
      SellerProductPayload[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit( event: FormEvent<HTMLFormElement> ) {
    const validation =
      sellerProductSchema.safeParse(
        form
      );

    if (!validation.success) {
      setError(
        getFirstZodError(
          validation.error
        )
      );

      return;
    }    
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      if (editing) {
        await updateSellerProduct(
          Number(productId),
          form
        );
      } else {
        await createSellerProduct(
          form
        );
      }

      navigate(
        "/seller/products"
      );
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo guardar el producto."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8">
        Cargando formulario...
      </div>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <Link
        to="/seller/products"
        className="text-sm font-semibold text-green-700"
      >
        ← Volver a productos
      </Link>

      <h2 className="mt-4 text-2xl font-bold">
        {editing
          ? "Editar producto"
          : "Nuevo producto"}
      </h2>

      <p className="mt-1 text-gray-600">
        Completá la información comercial y técnica.
      </p>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-7 space-y-8"
      >
        <FormSection
          title="Información principal"
        >
          <Field
            label="Nombre"
            value={form.name}
            onChange={(value) =>
              updateField(
                "name",
                value
              )
            }
          />

          <Field
            label="SKU"
            value={form.sku}
            onChange={(value) =>
              updateField(
                "sku",
                value
              )
            }
          />

          <SelectField
            label="Categoría"
            value={
              form.category
            }
            options={categories.map(
              (category) => ({
                value:
                  category.id,
                label:
                  category.name,
              })
            )}
            onChange={(value) =>
              updateField(
                "category",
                Number(value)
              )
            }
          />

          <SelectField
            label="Marca"
            value={
              form.brand || ""
            }
            options={brands.map(
              (brand) => ({
                value: brand.id,
                label: brand.name,
              })
            )}
            onChange={(value) =>
              updateField(
                "brand",
                value
                  ? Number(value)
                  : null
              )
            }
          />

          <SelectField
            label="Región"
            value={
              form.region
            }
            options={regions.map(
              (region) => ({
                value: region.id,
                label: region.name,
              })
            )}
            onChange={(value) =>
              updateField(
                "region",
                Number(value)
              )
            }
          />

          <SelectField
            label="Unidad"
            value={form.unit}
            options={[
              {
                value: "unidad",
                label: "Unidad",
              },
              {
                value: "kg",
                label: "Kilogramo",
              },
              {
                value: "litro",
                label: "Litro",
              },
              {
                value: "bolsa",
                label: "Bolsa",
              },
            ]}
            onChange={(value) =>
              updateField(
                "unit",
                String(value)
              )
            }
          />
        </FormSection>

        <FormSection
          title="Descripción"
        >
          <TextArea
            label="Descripción corta"
            value={
              form.short_description
            }
            onChange={(value) =>
              updateField(
                "short_description",
                value
              )
            }
          />

          <TextArea
            label="Descripción completa"
            value={
              form.description
            }
            onChange={(value) =>
              updateField(
                "description",
                value
              )
            }
          />

          <TextArea
            label="Información técnica"
            value={
              form.technical_description
            }
            onChange={(value) =>
              updateField(
                "technical_description",
                value
              )
            }
          />

          <TextArea
            label="Garantía"
            value={
              form.warranty
            }
            onChange={(value) =>
              updateField(
                "warranty",
                value
              )
            }
          />
        </FormSection>

        <FormSection
          title="Precio y stock"
        >
          <Field
            type="number"
            label="Precio"
            value={form.price}
            onChange={(value) =>
              updateField(
                "price",
                value
              )
            }
          />

          <Field
            type="number"
            label="Precio con descuento"
            required={false}
            value={
              form.discount_price ||
              ""
            }
            onChange={(value) =>
              updateField(
                "discount_price",
                value || null
              )
            }
          />

          <NumberField
            label="Stock"
            value={form.stock}
            onChange={(value) =>
              updateField(
                "stock",
                value
              )
            }
          />

          <NumberField
            label="Stock mínimo"
            value={
              form.minimum_stock
            }
            onChange={(value) =>
              updateField(
                "minimum_stock",
                value
              )
            }
          />
        </FormSection>

        <FormSection
          title="Publicación"
        >
          <SelectField
            label="Condición"
            value={
              form.condition
            }
            options={[
              {
                value: "NEW",
                label: "Nuevo",
              },
              {
                value: "USED",
                label: "Usado",
              },
              {
                value: "REFURBISHED",
                label:
                  "Reacondicionado",
              },
            ]}
            onChange={(value) =>
              updateField(
                "condition",
                String(value)
              )
            }
          />

          <SelectField
            label="Estado"
            value={
              form.status
            }
            options={[
              {
                value: "DRAFT",
                label: "Borrador",
              },
              {
                value: "PUBLISHED",
                label: "Publicado",
              },
            ]}
            onChange={(value) =>
              updateField(
                "status",
                String(value)
              )
            }
          />

          <Checkbox
            label="Envío disponible"
            checked={
              form.shipping_available
            }
            onChange={(value) =>
              updateField(
                "shipping_available",
                value
              )
            }
          />

          <Checkbox
            label="Producto activo"
            checked={
              form.is_active
            }
            onChange={(value) =>
              updateField(
                "is_active",
                value
              )
            }
          />
        </FormSection>

        <div className="flex justify-end gap-3 border-t pt-6">
          <Link
            to="/seller/products"
            className="rounded-lg border px-5 py-3 font-medium"
          >
            Cancelar
          </Link>

          <button
            disabled={saving}
            className="rounded-lg bg-green-700 px-6 py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Guardando..."
              : editing
                ? "Guardar cambios"
                : "Crear producto"}
          </button>
        </div>
      </form>
    </section>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-4 border-b pb-3 text-lg font-bold">
        {title}
      </h3>

      <div className="grid gap-4 md:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium">
        {label}
      </span>

      <input
        required={required}
        type={type}
        min={
          type === "number"
            ? "0"
            : undefined
        }
        step={
          type === "number"
            ? "0.01"
            : undefined
        }
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="w-full rounded-lg border border-gray-300 px-3 py-2"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (
    value: number
  ) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium">
        {label}
      </span>

      <input
        required
        type="number"
        min="0"
        value={value}
        onChange={(event) =>
          onChange(
            Number(
              event.target.value
            )
          )
        }
        className="w-full rounded-lg border border-gray-300 px-3 py-2"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <label className="md:col-span-2">
      <span className="mb-1 block text-sm font-medium">
        {label}
      </span>

      <textarea
        rows={4}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="w-full rounded-lg border border-gray-300 px-3 py-2"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | number;
  options: Array<{
    value: string | number;
    label: string;
  }>;
  onChange: (
    value: string | number
  ) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="w-full rounded-lg border border-gray-300 px-3 py-2"
      >
        {options.map(
          (option) => (
            <option
              key={
                option.value
              }
              value={
                option.value
              }
            >
              {option.label}
            </option>
          )
        )}
      </select>
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (
    value: boolean
  ) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked
          )
        }
      />

      <span className="font-medium">
        {label}
      </span>
    </label>
  );
}