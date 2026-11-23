import { useEffect, useState } from "react";
import { Link } from "react-router";

import { GlobalSearchBar } from "../components/ui/GlobalSearchBar";

import {
  ProductCardSkeleton,
} from "../components/ui/Skeleton";

import { ProductCard } from "../features/products/ProductCard";

import {
  getCategories,
  getFeaturedProducts,
} from "../services/productService";

type SectionState<T> =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; items: T[] };

function useHomeSection<T>(load: () => Promise<T[]>) {
  const [state, setState] = useState<SectionState<T>>({ status: "loading" });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void load().then(
      (items) => { if (active) setState({ status: "loaded", items }); },
      () => { if (active) setState({ status: "error" }); },
    );
    return () => { active = false; };
  }, [load, revision]);

  function retry() {
    setState({ status: "loading" });
    setRevision((value) => value + 1);
  }
  return { state, retry };
}

export function HomePage() {
  const { state: categories, retry: retryCategories } = useHomeSection(getCategories);
  const { state: featured, retry: retryFeatured } = useHomeSection(getFeaturedProducts);

  return (
    <div className="space-y-16">
      {/* HERO */}

      <section className="overflow-hidden rounded-3xl bg-gray-900">
        <div className="grid lg:grid-cols-2">
          <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14 lg:py-20">
            <span className="w-fit rounded-full bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-400">
              Marketplace
              agroindustrial
            </span>

            <h1 className="mt-6 max-w-2xl text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
              Todo lo que el campo
              necesita en un solo
              lugar.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-gray-300">
              Encontrá maquinaria,
              repuestos, herramientas
              e insumos técnicos de
              vendedores
              especializados.
            </p>

            <div className="mt-8 max-w-2xl">
              <GlobalSearchBar
                large
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-sm text-gray-400">
              <span>
                ✓ Stock actualizado
              </span>

              <span>
                ✓ Seguimiento
              </span>

              <span>
                ✓ Vendedores
                especializados
              </span>
            </div>
          </div>

          <div className="relative hidden min-h-[520px] lg:block">
            <div className="absolute inset-0 bg-gradient-to-br from-green-700 to-green-950" />

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="text-8xl">
                  🌾
                </div>

                <p className="mt-5 text-2xl font-bold">
                  Tecnología para el
                  agro
                </p>

                <p className="mt-2 text-green-100">
                  Compra. Venta.
                  Logística.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORÍAS */}

      <section aria-labelledby="home-categories-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
              Explorar
            </p>

            <h2 id="home-categories-heading" className="mt-2 text-3xl font-bold">
              Categorías
            </h2>
          </div>

          <Link
            to="/products"
            className="text-sm font-semibold text-green-700"
          >
            Ver catálogo →
          </Link>
        </div>

        {categories.status === "loading" && (
          <p role="status" className="mt-7 text-sm text-gray-600">Cargando categorías…</p>
        )}
        {categories.status === "error" && (
          <SectionError message="No pudimos cargar las categorías." retry={retryCategories} />
        )}
        {categories.status === "loaded" && (categories.items.length ? (
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.items.slice(0, 8).map((category) => (
              <Link
                key={category.id}
                to={`/products?category=${encodeURIComponent(category.slug)}`}
                className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-green-300 hover:shadow-md"
              >
                <h3 className="font-bold">{category.name}</h3>
                {category.description && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{category.description}</p>}
                <p className="mt-4 text-sm font-semibold text-green-700">Explorar →</p>
              </Link>
            ))}
          </div>
        ) : <p className="mt-7 text-sm text-gray-600">Todavía no hay categorías disponibles.</p>)}
      </section>

      {/* DESTACADOS */}

      <section aria-labelledby="home-featured-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
              Selección AgroNexus
            </p>

            <h2 id="home-featured-heading" className="mt-2 text-3xl font-bold">
              Productos destacados
            </h2>

            <p className="mt-2 text-gray-600">
              Una selección de
              productos disponibles en
              el marketplace.
            </p>
          </div>

          <Link
            to="/products"
            className="hidden text-sm font-semibold text-green-700 sm:block"
          >
            Todos los productos →
          </Link>
        </div>

        {featured.status === "loading" && (
          <div role="status" aria-label="Cargando productos destacados" className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({
              length: 4,
            }).map((_, index) => (
              <ProductCardSkeleton
                key={index}
              />
            ))}
          </div>
        )}
        {featured.status === "error" && (
          <SectionError message="No pudimos cargar los productos destacados." retry={retryFeatured} />
        )}
        {featured.status === "loaded" && (featured.items.length ? (
          <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featured.items
              .slice(0, 8)
              .map(
                (product) => (
                  <ProductCard
                    key={
                      product.id
                    }
                    product={
                      product
                    }
                  />
                )
              )}
          </div>
        ) : (
          <div className="mt-7 rounded-2xl bg-gray-100 p-8 text-center text-gray-600">
            Todavía no hay productos
            destacados.
          </div>
        ))}
      </section>

      {/* PROPUESTA DE VALOR */}

      <section className="grid gap-5 md:grid-cols-3">
        <BenefitCard
          icon="🔎"
          title="Catálogo técnico"
          description="Información detallada, marcas, categorías, precios y disponibilidad."
        />

        <BenefitCard
          icon="🚚"
          title="Seguimiento"
          description="Controlá el estado de tu compra desde la orden hasta la entrega."
        />

        <BenefitCard
          icon="🤝"
          title="Marketplace especializado"
          description="Compradores y vendedores conectados dentro del ecosistema agrícola."
        />
      </section>

      {/* VENDEDOR */}

      <section className="overflow-hidden rounded-3xl bg-green-700">
        <div className="grid gap-8 px-6 py-10 text-white sm:px-10 lg:grid-cols-[1fr_auto] lg:items-center lg:px-14">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-green-100">
              Vendé en AgroNexus
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Llevá tu negocio agrícola
              al marketplace.
            </h2>

            <p className="mt-3 max-w-2xl text-green-100">
              Gestioná catálogo,
              stock, ventas, preguntas
              y envíos desde un portal
              especializado.
            </p>
          </div>

          <Link
            to="/register"
            className="w-fit rounded-xl bg-white px-6 py-3 font-bold text-green-800 transition hover:bg-green-50"
          >
            Crear cuenta
          </Link>
        </div>
      </section>
    </div>
  );
}

function SectionError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p role="alert">{message}</p>
      <button type="button" onClick={retry} className="rounded-lg border border-amber-400 bg-white px-4 py-2 font-semibold hover:bg-amber-100">
        Reintentar
      </button>
    </div>
  );
}

function BenefitCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <span className="text-3xl">
        {icon}
      </span>

      <h3 className="mt-4 text-lg font-bold">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-gray-600">
        {description}
      </p>
    </article>
  );
}
