import { Link } from "react-router";
import { useAuth } from "../../features/auth/AuthContext";
import { StatusBadge } from "../../features/seller/StatusBadge";
import { useRemoteList, type RemoteListState } from "../../hooks/useRemoteList";
import { getMyComplaints } from "../../services/complaintService";
import { getFavorites } from "../../services/favoriteService";
import { getOrders } from "../../services/orderService";
import { getMyReturns } from "../../services/returnService";
import type { Order } from "../../types/order";
import { formatCurrency } from "../../utils/currency";

export function AccountOverviewPage() {
  const { user } = useAuth();
  return <AccountActivity key={user?.id} name={user?.first_name || user?.username} />;
}

function AccountActivity({ name }: { name?: string }) {
  const orders = useRemoteList(getOrders);
  const favorites = useRemoteList(getFavorites);
  const complaints = useRemoteList(getMyComplaints);
  const returns = useRemoteList(getMyReturns);

  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-2xl border border-agro-line bg-white p-5 sm:p-6">
        <h2 className="text-2xl font-bold text-agro-forest">
          {name ? `Hola, ${name}` : "Tu actividad"}
        </h2>
        <p className="mt-2 text-agro-muted">Consultá tus pedidos y administrá tu actividad.</p>
      </section>

      <section aria-label="Resumen de actividad" className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
        <StatCard title="Pedidos" link="/account/orders" state={orders.state} />
        <StatCard title="Favoritos" link="/account/favorites" {...favorites} />
        <StatCard title="Reclamos" link="/account/complaints" {...complaints} />
        <StatCard title="Devoluciones" link="/account/returns" {...returns} />
      </section>

      <section aria-labelledby="recent-orders-title" className="rounded-2xl border border-agro-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="recent-orders-title" className="text-xl font-bold text-agro-forest">Pedidos recientes</h2>
          <Link to="/account/orders" className="font-semibold text-agro-forest underline underline-offset-4">
            Ver todos
          </Link>
        </div>

        {orders.state.status === "loading" ? (
          <p role="status" className="mt-5 text-agro-muted">Cargando pedidos…</p>
        ) : orders.state.status === "error" ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
            <p role="alert">No pudimos cargar tus pedidos.</p>
            <button
              type="button"
              onClick={orders.retry}
              className="mt-3 min-h-11 rounded-lg border border-red-300 bg-white px-4 font-semibold hover:bg-red-100"
            >
              Reintentar pedidos
            </button>
          </div>
        ) : orders.state.items.length === 0 ? (
          <div className="mt-5 rounded-xl bg-agro-paper p-5 text-center">
            <p className="text-agro-muted">Todavía no realizaste compras.</p>
            <Link to="/products" className="mt-3 inline-block font-semibold text-agro-forest underline underline-offset-4">
              Explorar catálogo
            </Link>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {orders.state.items.slice(0, 5).map((order) => <RecentOrder key={order.id} order={order} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function RecentOrder({ order }: { order: Order }) {
  return (
    <li>
      <Link
        to={`/account/orders/${order.id}`}
        className="flex flex-col justify-between gap-3 rounded-xl border border-agro-line p-4 hover:border-agro-forest sm:flex-row sm:items-center"
      >
        <div>
          <p className="break-words font-bold">{order.order_number}</p>
          <p className="mt-1 text-sm text-agro-muted">{new Date(order.created_at).toLocaleDateString("es-AR")}</p>
        </div>
        <div className="space-y-1 sm:text-right">
          <p className="font-bold text-agro-forest">{formatCurrency(order.total)}</p>
          <StatusBadge status={order.status} />
        </div>
      </Link>
    </li>
  );
}

function StatCard({ title, state, link, retry }: {
  title: string;
  state: RemoteListState<unknown>;
  link: string;
  retry?: () => void;
}) {
  return (
    <article aria-label={title} className="min-w-0 rounded-xl border border-agro-line bg-white p-3 sm:p-4">
      <Link to={link} className="block break-words text-sm font-semibold text-agro-forest hover:underline">
        {title}
      </Link>
      <div aria-live="polite" className="mt-2">
        {state.status === "loaded" ? (
          <p className="text-2xl font-bold tabular-nums">{state.items.length}</p>
        ) : (
          <p className="text-sm text-agro-muted">
            {state.status === "loading" ? "Cargando…" : "No disponible"}
          </p>
        )}
      </div>
      {state.status === "error" && retry && (
        <button
          type="button"
          aria-label={`Reintentar ${title.toLowerCase()}`}
          onClick={retry}
          className="mt-1 min-h-11 font-semibold text-agro-forest underline underline-offset-4"
        >
          Reintentar
        </button>
      )}
    </article>
  );
}
