import { Link } from "react-router";
import fieldImage from "../assets/campo.webp";
import fieldImageSmall from "../assets/campo-movil.webp";
import { ProductCardSkeleton } from "../components/ui/Skeleton";
import { ProductCard } from "../features/products/ProductCard";
import { useRemoteList } from "../hooks/useRemoteList";
import { getCategories, getFeaturedProducts } from "../services/productService";

export function HomePage() {
  const { state: categories, retry: retryCategories } = useRemoteList(getCategories);
  const { state: featured, retry: retryFeatured } = useRemoteList(getFeaturedProducts);

  return (
    <div className="space-y-10 sm:space-y-14">
      <section className="grid grid-cols-1 overflow-hidden rounded-3xl border border-agro-line bg-agro-cream lg:grid-cols-[1fr_1.12fr]">
        <div className="min-w-0 self-center px-5 py-8 sm:px-9 sm:py-12 xl:px-12">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-agro-forest">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-agro-ochre" />
            Marketplace agroindustrial
          </p>
          <h1 className="mt-3 max-w-[13ch] font-display text-[clamp(2.6rem,5.4vw,5.6rem)] leading-[0.98] tracking-tight text-agro-forest">
            Maquinaria y repuestos para el campo.
          </h1>
          <p className="mt-4 max-w-[39ch] text-base leading-relaxed text-agro-muted sm:mt-5 sm:text-lg">
            Encontrá equipos, repuestos e insumos de vendedores especializados.
          </p>
          <Link to="/products" className="mt-6 inline-flex min-h-12 items-center gap-3 rounded-lg bg-agro-forest px-5 py-3 font-semibold text-white hover:bg-agro-deep sm:mt-8">
            Ver catálogo <span aria-hidden="true">→</span>
          </Link>
        </div>
        <picture className="relative block min-w-0 overflow-hidden bg-agro-line">
          <source media="(max-width: 640px)" srcSet={fieldImageSmall} />
          <img
            className="aspect-[2/1] w-full object-cover object-[57%_54%] lg:absolute lg:inset-0 lg:h-full lg:object-[56%_center]"
            src={fieldImage}
            alt="Tractor trabajando entre surcos de cultivo al pie de la montaña"
            width={1280}
            height={960}
            fetchPriority="high"
          />
        </picture>
      </section>

      <section aria-labelledby="home-categories">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="home-categories" className="font-display text-3xl tracking-tight text-agro-forest sm:text-4xl">
            Categorías
          </h2>
          <Link to="/products" className="text-sm font-semibold text-agro-forest underline underline-offset-4">
            Ver todos los productos
          </Link>
        </div>

        {categories.status === "loading" ? (
          <p role="status" className="text-agro-muted">Cargando categorías…</p>
        ) : categories.status === "error" ? (
          <SectionError message="No pudimos cargar las categorías." retry={retryCategories} />
        ) : categories.items.length === 0 ? (
          <p className="text-agro-muted">Todavía no hay categorías disponibles.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.items.map((category) => (
              <Link
                to={`/products?${new URLSearchParams({ category: category.slug })}`}
                key={category.id}
                className="group flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-agro-line bg-white p-4 hover:border-agro-forest hover:bg-agro-mist sm:p-5"
              >
                <span className="min-w-0">
                  <span className="block break-words text-lg font-bold text-agro-forest">{category.name}</span>
                  {category.description && (
                    <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-agro-muted">{category.description}</span>
                  )}
                </span>
                <span aria-hidden="true" className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full bg-agro-mist text-xl text-agro-forest group-hover:bg-white">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="home-featured">
        <h2 id="home-featured" className="mb-4 font-display text-3xl tracking-tight text-agro-forest sm:text-4xl">
          Productos destacados
        </h2>
        {featured.status === "loading" ? (
          <>
            <p role="status" className="sr-only">Cargando productos destacados…</p>
            <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => <ProductCardSkeleton key={index} />)}
            </div>
          </>
        ) : featured.status === "error" ? (
          <SectionError message="No pudimos cargar los productos destacados." retry={retryFeatured} />
        ) : featured.items.length === 0 ? (
          <p className="text-agro-muted">Todavía no hay productos destacados.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.items.map((product) => <ProductCard key={product.id} product={product} headingLevel={3} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
      <p role="alert">{message}</p>
      <button type="button" onClick={retry} className="mt-2 min-h-11 rounded-lg border border-red-300 bg-white px-4 font-semibold hover:bg-red-100">
        Reintentar
      </button>
    </div>
  );
}
